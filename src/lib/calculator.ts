/**
 * Pure calculation logic for the AGC Premium Calculator.
 *
 * The internal expression string uses ASCII operators (`+ - * / ^`), `%`,
 * `!` (factorial), parentheses `(` `)`, function names (`sin(` etc.) and
 * constants (`π`, `e`), with no spaces. Display symbols (× ÷ −) are produced
 * only by `formatExpressionForDisplay`, so logic and presentation stay decoupled.
 *
 * Evaluation uses a hand-written shunting-yard → RPN evaluator (no `eval`).
 */

export type OperatorSymbol = "+" | "-" | "*" | "/" | "^";

export type AngleMode = "deg" | "rad";

export type TokenType =
  | "number"
  | "constant"
  | "operator"
  | "function"
  | "percent"
  | "factorial"
  | "lparen"
  | "rparen";

export interface Token {
  type: TokenType;
  value: string;
}

const FUNCTIONS = new Set<string>(["sin", "cos", "tan", "sqrt", "log", "ln"]);

const CONSTANTS: Record<string, number> = {
  "π": Math.PI,
  e: Math.E,
};

const PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 3,
};

const RIGHT_ASSOC = new Set<string>(["^"]);

const OPERATOR_CHARS = new Set<string>(["+", "-", "*", "/", "^", "−", "×", "÷"]);

export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculatorError";
  }
}

/** Normalize any operator character (ASCII or display symbol) to canonical ASCII. */
function normalizeOperator(char: string): OperatorSymbol {
  switch (char) {
    case "×":
    case "*":
      return "*";
    case "÷":
    case "/":
      return "/";
    case "−":
    case "-":
      return "-";
    case "^":
      return "^";
    case "+":
      return "+";
    default:
      return "+";
  }
}

/**
 * Read a numeric literal starting at index `i`.
 * Scientific notation (`e`/`E`) is only consumed when it forms a valid
 * exponent (optional sign + digits), so a trailing `e` constant is left
 * for the tokenizer to handle as a standalone constant.
 */
function readNumber(
  src: string,
  i: number,
  prefix = "",
): { value: string; next: number } {
  let num = prefix;
  while (i < src.length && /[0-9.]/.test(src[i])) {
    num += src[i];
    i += 1;
  }

  if (i < src.length && (src[i] === "e" || src[i] === "E")) {
    let j = i + 1;
    let sign = "";
    if (j < src.length && (src[j] === "+" || src[j] === "-")) {
      sign = src[j];
      j += 1;
    }
    if (j < src.length && /[0-9]/.test(src[j])) {
      num += src[i] + sign;
      i = j;
      while (i < src.length && /[0-9]/.test(src[i])) {
        num += src[i];
        i += 1;
      }
    }
    // else: not a valid exponent — leave the `e` for constant handling.
  }

  return { value: num, next: i };
}

/** Read a contiguous run of lowercase letters. */
function readWord(src: string, i: number): { value: string; next: number } {
  let word = "";
  while (i < src.length && /[a-z]/.test(src[i])) {
    word += src[i];
    i += 1;
  }
  return { value: word, next: i };
}

/** Tokenize a raw expression string. */
export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const src = expression.replace(/\s+/g, "");
  let i = 0;

  while (i < src.length) {
    const char = src[i];

    if (/[0-9.]/.test(char)) {
      const { value, next } = readNumber(src, i);
      tokens.push({ type: "number", value });
      i = next;
    } else if (/[a-z]/.test(char)) {
      const { value: word, next } = readWord(src, i);
      if (FUNCTIONS.has(word)) {
        // Functions must be followed by "(".
        if (src[next] !== "(") {
          throw new CalculatorError("Invalid expression");
        }
        tokens.push({ type: "function", value: word });
        i = next;
      } else if (word === "e" || word === "pi") {
        tokens.push({
          type: "constant",
          value: word === "pi" ? "π" : word,
        });
        i = next;
      } else {
        throw new CalculatorError("Unknown token");
      }
    } else if (char === "π") {
      tokens.push({ type: "constant", value: "π" });
      i += 1;
    } else if (char === "%") {
      tokens.push({ type: "percent", value: "%" });
      i += 1;
    } else if (char === "!") {
      tokens.push({ type: "factorial", value: "!" });
      i += 1;
    } else if (char === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i += 1;
    } else if (char === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i += 1;
    } else if (OPERATOR_CHARS.has(char)) {
      const normalized = normalizeOperator(char);
      const prev = tokens[tokens.length - 1];

      if (
        normalized === "-" &&
        (!prev || prev.type === "operator" || prev.type === "lparen")
      ) {
        // Unary minus — attach to the following number.
        const { value, next } = readNumber(src, i + 1, "-");
        if (value !== "-") {
          tokens.push({ type: "number", value });
          i = next;
        } else {
          tokens.push({ type: "operator", value: normalized });
          i += 1;
        }
      } else {
        tokens.push({ type: "operator", value: normalized });
        i += 1;
      }
    } else {
      throw new CalculatorError("Invalid character");
    }
  }

  return tokens;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) {
    throw new CalculatorError("Invalid factorial");
  }
  if (n > 170) {
    throw new CalculatorError("Result is not finite");
  }
  let result = 1;
  for (let k = 2; k <= n; k += 1) {
    result *= k;
  }
  return result;
}

function applyFunction(name: string, x: number, angleMode: AngleMode): number {
  switch (name) {
    case "sin":
      return Math.sin(angleMode === "deg" ? (x * Math.PI) / 180 : x);
    case "cos":
      return Math.cos(angleMode === "deg" ? (x * Math.PI) / 180 : x);
    case "tan":
      return Math.tan(angleMode === "deg" ? (x * Math.PI) / 180 : x);
    case "sqrt":
      if (x < 0) throw new CalculatorError("Invalid square root");
      return Math.sqrt(x);
    case "log":
      if (x <= 0) throw new CalculatorError("Invalid logarithm");
      return Math.log10(x);
    case "ln":
      if (x <= 0) throw new CalculatorError("Invalid logarithm");
      return Math.log(x);
    default:
      throw new CalculatorError("Unknown function");
  }
}

function applyOperator(op: string, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new CalculatorError("Cannot divide by zero");
      return a / b;
    case "^": {
      const result = Math.pow(a, b);
      if (!Number.isFinite(result)) {
        throw new CalculatorError("Result is not finite");
      }
      return result;
    }
    default:
      throw new CalculatorError("Unknown operator");
  }
}

/**
 * Evaluate a raw expression string into a number.
 * Throws CalculatorError on invalid input.
 */
export function evaluateExpression(
  expression: string,
  angleMode: AngleMode = "deg",
): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) {
    throw new CalculatorError("Empty expression");
  }

  const output: Token[] = [];
  const ops: Token[] = [];

  const isOperator = (t: Token) => t.type === "operator";

  for (const token of tokens) {
    switch (token.type) {
      case "number":
      case "constant":
        output.push(token);
        break;
      case "function":
        ops.push(token);
        break;
      case "percent":
      case "factorial":
        // Postfix operators apply to the preceding operand.
        output.push(token);
        break;
      case "lparen":
        ops.push(token);
        break;
      case "rparen": {
        let foundParen = false;
        while (ops.length > 0) {
          const top = ops[ops.length - 1];
          if (top.type === "lparen") {
            foundParen = true;
            break;
          }
          output.push(ops.pop() as Token);
        }
        if (!foundParen) {
          throw new CalculatorError("Mismatched parentheses");
        }
        ops.pop(); // remove "("
        if (ops.length > 0 && ops[ops.length - 1].type === "function") {
          output.push(ops.pop() as Token);
        }
        break;
      }
      case "operator": {
        while (
          ops.length > 0 &&
          isOperator(ops[ops.length - 1]) &&
          ops[ops.length - 1].type === "operator"
        ) {
          const top = ops[ops.length - 1];
          const topPrec = PRECEDENCE[top.value];
          const curPrec = PRECEDENCE[token.value];
          const shouldPop = RIGHT_ASSOC.has(token.value)
            ? topPrec > curPrec
            : topPrec >= curPrec;
          if (!shouldPop) break;
          output.push(ops.pop() as Token);
        }
        ops.push(token);
        break;
      }
      default:
        break;
    }
  }

  while (ops.length > 0) {
    const top = ops.pop() as Token;
    if (top.type === "lparen" || top.type === "rparen") {
      throw new CalculatorError("Mismatched parentheses");
    }
    output.push(top);
  }

  const stack: number[] = [];

  for (const token of output) {
    switch (token.type) {
      case "number": {
        const value = Number.parseFloat(token.value);
        if (Number.isNaN(value)) {
          throw new CalculatorError("Invalid number");
        }
        stack.push(value);
        break;
      }
      case "constant": {
        const value = CONSTANTS[token.value];
        if (value === undefined) {
          throw new CalculatorError("Unknown constant");
        }
        stack.push(value);
        break;
      }
      case "percent": {
        const operand = stack.pop();
        if (operand === undefined) {
          throw new CalculatorError("Invalid expression");
        }
        stack.push(operand / 100);
        break;
      }
      case "factorial": {
        const operand = stack.pop();
        if (operand === undefined) {
          throw new CalculatorError("Invalid expression");
        }
        stack.push(factorial(operand));
        break;
      }
      case "function": {
        const operand = stack.pop();
        if (operand === undefined) {
          throw new CalculatorError("Invalid expression");
        }
        stack.push(applyFunction(token.value, operand, angleMode));
        break;
      }
      case "operator": {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) {
          throw new CalculatorError("Invalid expression");
        }
        stack.push(applyOperator(token.value, a, b));
        break;
      }
      default:
        break;
    }
  }

  if (stack.length !== 1) {
    throw new CalculatorError("Invalid expression");
  }

  const result = stack[0];
  if (!Number.isFinite(result)) {
    throw new CalculatorError("Result is not finite");
  }
  return result;
}

/** Format a numeric result for display, taming floating-point noise. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CalculatorError("Result is not finite");
  }
  if (value === 0) return "0";

  const abs = Math.abs(value);
  if (abs >= 1e16 || abs < 1e-9) {
    return value.toExponential(6).replace(/\.?0+e/, "e");
  }

  // 12 significant digits cleans up float artifacts like 0.1 + 0.2.
  const cleaned = Number(value.toPrecision(12));
  return cleaned.toString();
}

/** Format the raw internal expression into a human-friendly display string. */
export function formatExpressionForDisplay(expression: string): string {
  if (!expression) return "";

  let out = "";
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];

    if (/[a-z]/.test(char)) {
      const { value: word, next } = readWord(expression, i);
      out += word;
      i = next;
    } else if (char === "*") {
      out += " × ";
      i += 1;
    } else if (char === "/") {
      out += " ÷ ";
      i += 1;
    } else if (char === "+") {
      out += " + ";
      i += 1;
    } else if (char === "-") {
      const prev = out.slice(-1);
      const isUnary =
        i === 0 || "+-×÷*/^(".includes(prev) || prev === "";
      out += isUnary ? "−" : " − ";
      i += 1;
    } else if (char === "^") {
      out += "^";
      i += 1;
    } else if (char === "!") {
      out += "!";
      i += 1;
    } else {
      out += char;
      i += 1;
    }
  }

  return out.replace(/\s+/g, " ").trim();
}

/**
 * Attempt to compute a live preview; returns null when the expression is
 * not currently evaluable.
 */
export function computePreview(
  expression: string,
  angleMode: AngleMode = "deg",
): string | null {
  if (!expression) return null;

  try {
    return formatResult(evaluateExpression(expression, angleMode));
  } catch {
    // fall through to the trimmed fallback
  }

  const trimmed = expression.replace(/[+\-*/^]+$/, "");
  if (trimmed && trimmed !== expression) {
    try {
      return formatResult(evaluateExpression(trimmed, angleMode));
    } catch {
      return null;
    }
  }

  return null;
}

/** Extract the trailing numeric segment (the operand currently being typed). */
export function lastNumberSegment(expression: string): string {
  const match = expression.match(/(-?\d*\.?\d*(?:[eE][-+]?\d+)?)$/);
  return match ? match[1] : "";
}

/** Generate a unique id (browser-safe, no external deps). */
export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
