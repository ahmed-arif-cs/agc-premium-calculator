/**
 * Pure logic for the Programmer Calculator mode — base conversion (BIN/OCT/DEC/HEX),
 * configurable bit-width (8/16/32/64) with two's-complement negative numbers, and
 * bitwise operators (AND/OR/XOR/NOT/NAND/NOR/shift-left/shift-right/unsigned-shift-right).
 *
 * Uses BigInt throughout so 64-bit values don't lose precision to JS's
 * float64-backed Number type (which only safely represents ~53 bits).
 * Completely independent of `calculator.ts`'s expression evaluator — this
 * module works on a single running integer value, not an expression string.
 */

export type BitWidth = 8 | 16 | 32 | 64;
export type NumBase = "BIN" | "OCT" | "DEC" | "HEX";

export class ProgrammerCalculatorError extends Error {}

const BASE_RADIX: Record<NumBase, number> = {
  BIN: 2,
  OCT: 8,
  DEC: 10,
  HEX: 16,
};

const BASE_DIGIT_RE: Record<NumBase, RegExp> = {
  BIN: /^[01]*$/,
  OCT: /^[0-7]*$/,
  DEC: /^[0-9]*$/,
  HEX: /^[0-9a-fA-F]*$/,
};

function modulusFor(width: BitWidth): bigint {
  return 1n << BigInt(width);
}

function signBoundaryFor(width: BitWidth): bigint {
  return 1n << BigInt(width - 1);
}

export function wrapToBitWidth(value: bigint, width: BitWidth): bigint {
  const mod = modulusFor(width);
  let v = value % mod;
  if (v < 0n) v += mod;
  return v;
}

export function toSignedDisplay(unsigned: bigint, width: BitWidth): bigint {
  const boundary = signBoundaryFor(width);
  return unsigned >= boundary ? unsigned - modulusFor(width) : unsigned;
}

export function isValidForBase(text: string, base: NumBase): boolean {
  return BASE_DIGIT_RE[base].test(text);
}

export function parseInBase(text: string, base: NumBase, width: BitWidth): bigint {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "-") return 0n;
  const negative = base === "DEC" && trimmed.startsWith("-");
  const digits = negative ? trimmed.slice(1) : trimmed;
  if (!isValidForBase(digits, base)) {
    throw new ProgrammerCalculatorError(`Invalid ${base} digits`);
  }
  const basePrefix: Record<NumBase, string> = { BIN: "b", OCT: "o", DEC: "", HEX: "x" };
  let magnitude: bigint;
  try {
    magnitude = digits === "" ? 0n : BigInt(`0${basePrefix[base]}${digits}`);
  } catch {
    throw new ProgrammerCalculatorError(`Couldn't parse ${base} value`);
  }
  return wrapToBitWidth(negative ? -magnitude : magnitude, width);
}

export function formatInBase(unsigned: bigint, base: NumBase, width: BitWidth): string {
  if (base === "DEC") {
    return toSignedDisplay(unsigned, width).toString(10);
  }
  const radix = BASE_RADIX[base];
  const str = unsigned.toString(radix);
  return base === "HEX" ? str.toUpperCase() : str;
}

export function toBinaryString(unsigned: bigint, width: BitWidth): string {
  return unsigned.toString(2).padStart(width, "0");
}

export function toggleBit(unsigned: bigint, bitIndex: number, width: BitWidth): bigint {
  if (bitIndex < 0 || bitIndex >= width) return unsigned;
  return wrapToBitWidth(unsigned ^ (1n << BigInt(bitIndex)), width);
}

export type BitwiseBinaryOp = "AND" | "OR" | "XOR" | "NAND" | "NOR" | "LSH" | "RSH" | "URSH";

export function applyBitwiseBinary(
  a: bigint,
  b: bigint,
  op: BitwiseBinaryOp,
  width: BitWidth,
): bigint {
  switch (op) {
    case "AND":
      return wrapToBitWidth(a & b, width);
    case "OR":
      return wrapToBitWidth(a | b, width);
    case "XOR":
      return wrapToBitWidth(a ^ b, width);
    case "NAND":
      return wrapToBitWidth(~(a & b), width);
    case "NOR":
      return wrapToBitWidth(~(a | b), width);
    case "LSH":
      return wrapToBitWidth(a << (b % BigInt(width)), width);
    case "RSH": {
      const signed = toSignedDisplay(a, width);
      return wrapToBitWidth(signed >> (b % BigInt(width)), width);
    }
    case "URSH": {
      const shift = b % BigInt(width);
      return wrapToBitWidth(a >> shift, width);
    }
    default:
      return a;
  }
}

export function applyNot(a: bigint, width: BitWidth): bigint {
  return wrapToBitWidth(~a, width);
}

export type ArithmeticOp = "+" | "-" | "*" | "/" | "%";

export function applyArithmetic(a: bigint, b: bigint, op: ArithmeticOp, width: BitWidth): bigint {
  const sa = toSignedDisplay(a, width);
  const sb = toSignedDisplay(b, width);
  switch (op) {
    case "+":
      return wrapToBitWidth(sa + sb, width);
    case "-":
      return wrapToBitWidth(sa - sb, width);
    case "*":
      return wrapToBitWidth(sa * sb, width);
    case "/":
      if (sb === 0n) throw new ProgrammerCalculatorError("Division by zero");
      return wrapToBitWidth(sa / sb, width);
    case "%":
      if (sb === 0n) throw new ProgrammerCalculatorError("Division by zero");
      return wrapToBitWidth(sa % sb, width);
    default:
      return a;
  }
}

export function convertBitWidth(unsigned: bigint, fromWidth: BitWidth, toWidth: BitWidth): bigint {
  const signed = toSignedDisplay(unsigned, fromWidth);
  return wrapToBitWidth(signed, toWidth);
}
