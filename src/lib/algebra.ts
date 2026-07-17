/**
 * Linear & quadratic single-variable equation solver for the AGC Premium Calculator.
 *
 * Parses each side of an equation into a polynomial (sum of `{ coeff, power }`
 * terms), combines LHS − RHS, and solves via the linear or quadratic formula.
 *
 * Supported term shapes: `x`, `-x`, `2x`, `2*x`, `3x^2`, `x^2`, `5`, `-5`,
 * decimals. Implicit multiplication between a number and the variable (and
 * between variable factors) is supported. Parentheses are NOT supported —
 * the spec allows skipping them.
 *
 * Pure TypeScript — no React, no DOM, no `eval`.
 */
import { CalculatorError, formatResult } from "@/lib/calculator";

export interface Solution {
  variable: string;
  value: number;
  display: string;
}

interface Term {
  coeff: number;
  power: number;
}

interface AlgToken {
  type: "number" | "var" | "op" | "power";
  value: string;
}

/** Reserved function/constant words, ignored when detecting the variable. */
const RESERVED_WORDS = /\b(?:sin|cos|tan|sqrt|log|ln|pi|e)\b/g;

/** Collect distinct single-letter variables on one side of the equation. */
function findVariables(side: string): Set<string> {
  const cleaned = side.toLowerCase().replace(RESERVED_WORDS, " ");
  const vars = new Set<string>();
  for (const ch of cleaned) {
    if (/[a-z]/.test(ch)) {
      vars.add(ch);
    }
  }
  return vars;
}

/** Determine the single variable letter for the whole equation. */
function determineVariable(equation: string): string {
  const parts = equation.split("=");
  const vars = new Set<string>();
  for (const part of parts) {
    for (const v of findVariables(part)) {
      vars.add(v);
    }
  }
  if (vars.size === 0) {
    throw new CalculatorError("No variable found in equation");
  }
  if (vars.size > 1) {
    throw new CalculatorError("Only single-variable equations are supported");
  }
  for (const v of vars) {
    return v;
  }
  // Unreachable — vars is non-empty here.
  throw new CalculatorError("No variable found in equation");
}

/** Tokenize one side: numbers, the variable letter, `^`, `*`, `+`, `-`. */
function tokenizeSide(side: string, variable: string): AlgToken[] {
  const tokens: AlgToken[] = [];
  const src = side.replace(/\s+/g, "");
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < src.length && /[0-9.]/.test(src[i])) {
        num += src[i];
        i += 1;
      }
      tokens.push({ type: "number", value: num });
    } else if (ch === variable) {
      tokens.push({ type: "var", value: ch });
      i += 1;
    } else if (ch === "^") {
      tokens.push({ type: "power", value: ch });
      i += 1;
    } else if (ch === "*" || ch === "+" || ch === "-") {
      tokens.push({ type: "op", value: ch });
      i += 1;
    } else {
      throw new CalculatorError(`Invalid character in equation: ${ch}`);
    }
  }
  return tokens;
}

/** Parse one side of the equation into a list of polynomial terms. */
function parseSide(side: string, variable: string): Term[] {
  const tokens = tokenizeSide(side, variable);
  if (tokens.length === 0) {
    return [{ coeff: 0, power: 0 }];
  }

  let pos = 0;

  function peek(): AlgToken | null {
    return pos < tokens.length ? tokens[pos] : null;
  }
  function next(): AlgToken {
    const t = tokens[pos];
    if (!t) throw new CalculatorError("Unexpected end of equation");
    pos += 1;
    return t;
  }

  function parseFactor(): Term {
    const t = peek();
    if (!t) throw new CalculatorError("Unexpected end of equation");

    if (t.type === "number") {
      next();
      const coeff = Number.parseFloat(t.value);
      if (Number.isNaN(coeff)) {
        throw new CalculatorError("Invalid number in equation");
      }
      return { coeff, power: 0 };
    }
    if (t.type === "var") {
      next();
      let power = 1;
      const p = peek();
      if (p && p.type === "power") {
        next();
        const expToken = peek();
        if (!expToken || expToken.type !== "number") {
          throw new CalculatorError("Expected exponent after ^");
        }
        next();
        const exp = Number.parseFloat(expToken.value);
        if (Number.isNaN(exp) || !Number.isInteger(exp)) {
          throw new CalculatorError("Invalid exponent");
        }
        power = exp;
      }
      return { coeff: 1, power };
    }
    throw new CalculatorError(`Unexpected token: ${t.value}`);
  }

  function parseTerm(): Term {
    let result = parseFactor();
    let p = peek();
    while (
      p &&
      ((p.type === "op" && p.value === "*") ||
        p.type === "number" ||
        p.type === "var")
    ) {
      if (p.type === "op" && p.value === "*") {
        next();
      }
      const f = parseFactor();
      // Multiplication: coeffs multiply, powers add.
      result = {
        coeff: result.coeff * f.coeff,
        power: result.power + f.power,
      };
      p = peek();
    }
    return result;
  }

  function parseExpr(): Term[] {
    const terms: Term[] = [];

    // Optional leading sign.
    let sign = 1;
    const first = peek();
    if (first && first.type === "op" && (first.value === "+" || first.value === "-")) {
      if (first.value === "-") sign = -1;
      next();
    }

    let term = parseTerm();
    term = { coeff: term.coeff * sign, power: term.power };
    terms.push(term);

    let p = peek();
    while (p && p.type === "op" && (p.value === "+" || p.value === "-")) {
      const op = next().value;
      let t = parseTerm();
      t = { coeff: t.coeff * (op === "-" ? -1 : 1), power: t.power };
      terms.push(t);
      p = peek();
    }
    return terms;
  }

  return parseExpr();
}

/**
 * Solve a single-variable linear or quadratic equation.
 * Throws `CalculatorError` for invalid input, unsupported degrees,
 * or equations with no/infinite solutions.
 */
export function solveEquation(equation: string): Solution {
  const parts = equation.split("=");
  if (parts.length !== 2) {
    throw new CalculatorError("Invalid equation");
  }

  const variable = determineVariable(equation);

  const lhs = parseSide(parts[0], variable);
  const rhs = parseSide(parts[1], variable);

  // Combine LHS − RHS into coefficients per power.
  const coeffs = new Map<number, number>();
  for (const t of lhs) {
    if (t.power > 2 || t.power < 0) {
      throw new CalculatorError("Only linear and quadratic equations are supported");
    }
    coeffs.set(t.power, (coeffs.get(t.power) ?? 0) + t.coeff);
  }
  for (const t of rhs) {
    if (t.power > 2 || t.power < 0) {
      throw new CalculatorError("Only linear and quadratic equations are supported");
    }
    coeffs.set(t.power, (coeffs.get(t.power) ?? 0) - t.coeff);
  }

  const a = coeffs.get(2) ?? 0;
  const b = coeffs.get(1) ?? 0;
  const c = coeffs.get(0) ?? 0;

  // Quadratic (a ≠ 0): ax² + bx + c = 0.
  if (Math.abs(a) > 1e-12) {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -1e-12) {
      throw new CalculatorError("No real solution");
    }
    const sqrtD = Math.sqrt(Math.max(0, discriminant));
    const r1 = (-b + sqrtD) / (2 * a);
    const r2 = (-b - sqrtD) / (2 * a);
    const f1 = formatResult(r1);
    const f2 = formatResult(r2);
    if (Math.abs(r1 - r2) < 1e-12) {
      return { variable, value: r1, display: `${variable} = ${f1}` };
    }
    return { variable, value: r1, display: `${variable} = ${f1}, ${f2}` };
  }

  // Linear (a = 0): bx + c = 0 → x = −c/b.
  if (Math.abs(b) < 1e-12) {
    if (Math.abs(c) < 1e-12) {
      throw new CalculatorError("Infinite solutions");
    }
    throw new CalculatorError("No solution");
  }

  const value = -c / b;
  const formatted = formatResult(value);
  return { variable, value, display: `${variable} = ${formatted}` };
}
