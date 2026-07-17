/**
 * Math Image Recognition — turns a provider's raw recognized text
 * (whatever `OCRProvider.recognize({ mode: "math" })` returns, currently
 * always a thrown `not_configured` from `NoopOCRProvider`, since no
 * vendor is connected — see `README.md`) into a single candidate
 * expression string in this project's own calculator grammar
 * (`src/lib/calculator.ts`'s tokenizer/evaluator).
 *
 * Follows the exact same "never trust the recognizer for the actual
 * arithmetic" rule `src/app/api/ai/calculate/route.ts` already
 * established for the AI Calculator: this file only ever normalizes
 * *symbols* (a handwritten "×" OCR'd as "x", a printed "÷" as "/", a
 * long dash as "-") into this app's grammar — it never evaluates
 * anything itself. The caller (`ocrService.ts`'s `recognizeMath()`, and
 * ultimately `src/app/api/ocr/math/route.ts`) is expected to run the
 * returned candidate through the calculator's own, completely
 * unchanged `evaluateExpression`, exactly like the AI Calculator route
 * does with the AI's own `expression` field — so a recognition mistake
 * can produce a "couldn't evaluate that" error, never a silently wrong
 * number.
 */

/** Maps common OCR/handwriting renderings of math symbols onto this app's own grammar (see `src/lib/calculator.ts`). */
const SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[×✕✖]/g, "*"],
  [/[÷]/g, "/"],
  [/[−–—]/g, "-"], // minus sign / en dash / em dash -> ASCII hyphen-minus
  [/[’‘´`]/g, "'"],
  [/π/g, "pi"],
  [/√/g, "sqrt"],
  [/[,]/g, ""], // thousands separators OCR sometimes inserts between digit groups
];

/**
 * Normalizes OCR-flavored symbols in `text` into this project's own
 * expression grammar. Exported separately from `extractExpression()` so
 * a caller that already has a known-good candidate substring can still
 * reuse the same symbol normalization.
 */
export function normalizeMathSymbols(text: string): string {
  let normalized = text;
  for (const [pattern, replacement] of SYMBOL_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

/** Characters a normalized candidate expression is allowed to contain. */
const EXPRESSION_CHAR_PATTERN = /^[0-9+\-*/^().!%\s a-zA-Z]*$/;

/**
 * Finds the best candidate math expression substring within raw OCR
 * text, normalizes its symbols, and returns it — or `null` if nothing
 * resembling an expression was found.
 *
 * Strategy (deliberately simple and conservative, matching this
 * directory's "architecture, not a fully trained recognizer" scope):
 * 1. Normalize known OCR symbol substitutions across the whole text.
 * 2. Drop everything from a trailing "=" onward on each line (a
 *    worked problem's own handwritten/printed answer is not something
 *    this app should trust — it recomputes the answer itself).
 * 3. Pick the longest line that contains at least one digit and at
 *    least one operator, on the assumption that the "busiest" line is
 *    the actual problem rather than a page header/footer.
 * 4. Strip anything outside the small set of characters this app's own
 *    tokenizer (`src/lib/calculator.ts`) understands, so a stray OCR
 *    artifact can't reach the evaluator.
 */
export function extractExpression(rawText: string): string | null {
  const normalized = normalizeMathSymbols(rawText);

  const candidates = normalized
    .split(/\r?\n/)
    .map((line) => line.split("=")[0].trim())
    .filter((line) => /\d/.test(line) && /[+\-*/^]/.test(line));

  if (candidates.length === 0) return null;

  const best = candidates.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );

  if (!EXPRESSION_CHAR_PATTERN.test(best)) {
    // Strip any character this app's grammar doesn't understand rather
    // than rejecting the whole candidate outright.
    const cleaned = best.replace(/[^0-9+\-*/^().!% a-zA-Z]/g, "").trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  return best.replace(/\s+/g, "");
}
