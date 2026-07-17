import "server-only";

import type { OCRProvider } from "./providerInterface";
import { resolveOCRProvider } from "./providers";
import { isOCRConfigured } from "./env";
import type { OCRImageInput, OCRRequestOptions } from "./types";
import { parseReceiptText, type ReceiptParseResult } from "./receiptParser";
import { extractExpression } from "./mathParser";

export interface RecognizeTextResult {
  text: string;
  confidence?: number;
  provider: string;
}

export interface RecognizeReceiptResult extends ReceiptParseResult {
  rawText: string;
  confidence?: number;
  provider: string;
}

export interface RecognizeMathResult {
  /** The best candidate expression in this app's own grammar, or `null` if none was found — never guessed. */
  expression: string | null;
  rawText: string;
  confidence?: number;
  provider: string;
}

/**
 * The OCR Service Layer — the single, top-level entry point the rest of
 * this project (a future API route, server action, or background job)
 * is meant to call, instead of reaching into an `OCRProvider`,
 * `receiptParser.ts`, or `mathParser.ts` directly.
 *
 * Mirrors `src/lib/ai/aiService.ts`'s role for the AI architecture:
 * wires the provider (recognition) together with the mode-specific
 * parsers (structuring) for three things — `recognizeText()`,
 * `recognizeReceipt()`, `recognizeMath()` — each a thin, well-defined
 * seam that `src/app/api/ocr/image-to-text/route.ts`,
 * `src/app/api/ocr/receipt/route.ts`, and `src/app/api/ocr/math/route.ts`
 * call into.
 *
 * The provider is injected (constructor parameter), not hardcoded, so a
 * test — or a future caller that needs an isolated provider instance —
 * can supply its own `OCRProvider` instead of the shared, module-level
 * default `getOCRService()` wires up below.
 */
export class OCRService {
  constructor(private readonly provider: OCRProvider) {}

  /** The provider's own name (`"none"` when unconfigured) — useful for logging/diagnostics. */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Image to Text — returns the provider's recognized text verbatim, with
   * no further structuring. Throws an `OCRProviderError` with code
   * `"not_configured"` (via `NoopOCRProvider`) if no real provider is
   * configured — the caller's job (a future route or UI) is to catch
   * that and show/return an appropriate message; this layer doesn't
   * swallow or hide it.
   */
  async recognizeText(image: OCRImageInput, options?: OCRRequestOptions): Promise<RecognizeTextResult> {
    const raw = await this.provider.recognize({ image, mode: "text", options });
    return { text: raw.text, confidence: raw.confidence, provider: this.provider.name };
  }

  /**
   * Receipt Reading — recognizes the image, then structures the raw text
   * into merchant/date/items/subtotal/tax/total via `parseReceiptText()`.
   * `rawText` is always included alongside the structured fields so a
   * caller can fall back to it when a particular field wasn't found.
   */
  async recognizeReceipt(image: OCRImageInput, options?: OCRRequestOptions): Promise<RecognizeReceiptResult> {
    const raw = await this.provider.recognize({ image, mode: "receipt", options });
    const parsed = parseReceiptText(raw.text);
    return { ...parsed, rawText: raw.text, confidence: raw.confidence, provider: this.provider.name };
  }

  /**
   * Math Image Recognition — recognizes the image, then extracts a
   * candidate expression in this app's own grammar via
   * `extractExpression()`. Deliberately does **not** evaluate the
   * expression itself — the caller (`src/app/api/ocr/math/route.ts`) is
   * expected to run the returned candidate through
   * `src/lib/calculator.ts`'s own `evaluateExpression`, the same
   * "recognizer proposes, the deterministic engine computes" split
   * `src/app/api/ai/calculate/route.ts` already uses for the AI
   * Calculator.
   */
  async recognizeMath(image: OCRImageInput, options?: OCRRequestOptions): Promise<RecognizeMathResult> {
    const raw = await this.provider.recognize({ image, mode: "math", options });
    const expression = extractExpression(raw.text);
    return { expression, rawText: raw.text, confidence: raw.confidence, provider: this.provider.name };
  }
}

let sharedService: OCRService | undefined;

/**
 * Returns a shared, module-level `OCRService`, constructing it on first
 * call with `providers/index.ts`'s `resolveOCRProvider()` (which itself
 * always degrades to `NoopOCRProvider`, since no vendor provider is
 * registered yet — see `providers/index.ts`).
 *
 * A future caller that needs full isolation (tests, or a scenario where
 * a specific provider instance is required) can instead construct
 * `new OCRService(...)` directly with its own `OCRProvider` instead of
 * using this shared accessor.
 */
export function getOCRService(): OCRService {
  if (!sharedService) {
    sharedService = new OCRService(resolveOCRProvider());
  }
  return sharedService;
}

export { isOCRConfigured };
