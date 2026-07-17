import type { OCRRequest, OCRRawResult } from "./types";

/**
 * The contract every OCR provider implementation must satisfy.
 *
 * This is the seam the rest of the architecture (`OCRService`) codes
 * against, instead of any one vendor's SDK — adding a real vendor later
 * (Google Cloud Vision, AWS Textract, Azure AI Vision, a self-hosted
 * Tesseract worker, etc.) means writing one new
 * `providers/<vendor>Provider.ts` that implements this interface and
 * registering it in `providers/index.ts`'s registry — nothing in
 * `ocrService.ts`, `receiptParser.ts`, or `mathParser.ts` needs to
 * change.
 *
 * `providers/noopProvider.ts` is the only implementation in this task's
 * scope (a safe default that reports "not configured" rather than doing
 * nothing silently, or ever calling out to a third-party OCR API) — see
 * this directory's `README.md` for the scope note.
 */
export interface OCRProvider {
  /** Machine-readable identifier, e.g. `"tesseract"`, `"google-vision"`, `"none"`. Used for logging/diagnostics. */
  readonly name: string;

  /**
   * Recognize text in the given image for the given mode.
   *
   * `mode` is a hint a real provider may use to pick a specialized
   * recognition path (e.g. a document/receipt-tuned model vs. a
   * general one) — every provider must still work with `mode` ignored,
   * since mode-specific *structuring* of the result (receipt fields, a
   * math expression) happens one layer up, in `ocrService.ts` via
   * `receiptParser.ts`/`mathParser.ts`, not inside the provider itself.
   *
   * Implementations should throw an `OCRProviderError` (never a raw/
   * vendor error) on any failure, using the most specific `OCRErrorCode`
   * that applies — this is what lets `OCRService` and every
   * `src/app/api/ocr/*` route react uniformly regardless of which
   * provider is configured.
   */
  recognize(request: OCRRequest): Promise<OCRRawResult>;
}
