/**
 * Natural-language math parser for the AGC Premium Calculator.
 *
 * Converts short English math phrases ("25% of 400", "sqrt of 16",
 * "12 plus 8") into the engine's internal expression format, then
 * evaluates them via `evaluateExpression` from "@/lib/calculator".
 *
 * No React, no DOM, no `eval`. Pure TypeScript.
 */
import {
  CalculatorError,
  evaluateExpression,
  formatResult,
  type AngleMode,
} from "@/lib/calculator";

export interface ParsedInput {
  expression: string;
  result: string;
}

/** Reserved function/constant words — used by `looksLikeEquation`. */
const RESERVED_WORDS = /\b(?:sin|cos|tan|sqrt|log|ln|pi|e)\b/g;

/**
 * Parse a short natural-language math phrase into an evaluated result.
 * Throws `CalculatorError("Could not understand that expression")` when the
 * cleaned input cannot be evaluated.
 */
export function parseNaturalInput(
  text: string,
  angleMode: AngleMode = "deg",
): ParsedInput {
  let s = text.toLowerCase().trim();

  // Drop leading conversational keywords ("what is", "calculate", "equals", "=").
  s = s.replace(/^(?:what is|calculate|equals|=)\s*/, "");

  // Remove thousands separators: "1,000" → "1000".
  s = s.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");

  // "X percent off Y" / "X% off Y" → (Y*(1 - X/100))
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*(?:percent|%)\s*off\s*(\d+(?:\.\d+)?)/g,
    "($2*(1-$1/100))",
  );

  // "X [percent|%] of Y" → (X/100*Y)
  // `\bof\b` ensures we don't match "off" (handled above anyway).
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*(?:percent|%)?\s*\bof\b\s*(\d+(?:\.\d+)?)/g,
    "($1/100*$2)",
  );

  // "sqrt of (X)" / "square root of (X)" → sqrt(X) (parens optional).
  s = s.replace(
    /(?:square root of|sqrt of)\s*\(?(\d+(?:\.\d+)?)\)?/g,
    "sqrt($1)",
  );

  // Word operators — longer phrases first to avoid partial matches.
  s = s.replace(/\bmultiplied by\b/g, "*");
  s = s.replace(/\bdivided by\b/g, "/");
  s = s.replace(/\bto the power of\b/g, "^");
  s = s.replace(/\bpower of\b/g, "^");
  s = s.replace(/\bproduct of\b/g, "*");
  s = s.replace(/\bplus\b/g, "+");
  s = s.replace(/\bminus\b/g, "-");
  s = s.replace(/\btimes\b/g, "*");
  s = s.replace(/\bover\b/g, "/");
  // Note: "mod"/"modulo" are intentionally NOT replaced (the engine's `%`
  // is percent, not modulo), per spec.

  // Constants — normalize pi/π to π, and leave standalone "e" as "e"
  // (the engine already recognizes it). `\be\b` preserves scientific
  // notation like "1e5" because there's no word boundary inside "1e5".
  s = s.replace(/\bpi\b|π/g, "π");
  s = s.replace(/\be\b/g, "e");

  // Collapse any remaining whitespace.
  s = s.replace(/\s+/g, "");

  let value: number;
  try {
    value = evaluateExpression(s, angleMode);
  } catch {
    throw new CalculatorError("Could not understand that expression");
  }
  const result = formatResult(value);
  return { expression: s, result };
}

/**
 * Heuristic: does this text look like a single-variable equation?
 * True when the text contains "=" AND has at least one letter a-z that
 * isn't part of a reserved function/constant word. Used to route input
 * to the algebra solver instead of the NL parser.
 */
export function looksLikeEquation(text: string): boolean {
  if (!text.includes("=")) return false;
  const cleaned = text.toLowerCase().replace(RESERVED_WORDS, "");
  return /[a-z]/.test(cleaned);
}
