/**
 * Shared types for the OCR architecture.
 *
 * Mirrors the shape of `src/lib/ai/types.ts` on purpose — same pattern
 * (provider-agnostic vocabulary, a single normalized error type, a
 * factory-friendly result shape), applied to image recognition instead
 * of chat. Every other file in `src/lib/ocr/` is built on this
 * vocabulary: `providerInterface.ts` (what a provider must implement),
 * `providers/noopProvider.ts` (the safe default), `ocrService.ts` (what
 * orchestrates a request), and `receiptParser.ts`/`mathParser.ts` (what
 * turns a provider's raw text into something mode-specific and useful).
 *
 * FOUNDATION LAYER — architecture only. No vendor OCR API (Google Cloud
 * Vision, AWS Textract, Azure AI Vision, OCR.space, etc.) is called
 * anywhere in this project; see `README.md` in this directory for the
 * full scope note and `providers/noopProvider.ts` for the only
 * implementation this task ships.
 */

/** The three recognition modes this architecture is built to support. */
export type OCRMode = "text" | "receipt" | "math";

/** A single image, already decoded from its `data:` URL by the caller (see `imageInput.ts`). */
export interface OCRImageInput {
  /** Base64-encoded image bytes — no `data:...;base64,` prefix. */
  data: string;
  /** e.g. `"image/png"`, `"image/jpeg"`, `"image/webp"`. */
  mimeType: string;
}

/** Per-request tuning, honored on a best-effort basis by each provider. */
export interface OCRRequestOptions {
  /** BCP-47-ish language hint, e.g. `"en"`. Provider-specific; safe to ignore. */
  language?: string;
}

/** Everything a provider needs to recognize one image. */
export interface OCRRequest {
  image: OCRImageInput;
  mode: OCRMode;
  options?: OCRRequestOptions;
}

/**
 * What a provider hands back after a successful recognition — raw,
 * unparsed text plus optional confidence/raw-payload metadata. Turning
 * this into something mode-specific (a receipt's line items, a math
 * expression) is deliberately *not* this type's job — that's
 * `receiptParser.ts`/`mathParser.ts`'s job, kept separate so a future
 * provider only ever needs to produce text, never provider-specific
 * structured output.
 */
export interface OCRRawResult {
  /** The provider's raw recognized text, unmodified. */
  text: string;
  /** 0–1, when the provider reports one. */
  confidence?: number;
  /** The provider's raw, unmodified response — kept for debugging only, never relied upon by callers. */
  raw?: unknown;
}

/**
 * A stable set of machine-readable failure reasons every provider maps
 * its own errors onto, so calling code (`ocrService.ts`, and each
 * `src/app/api/ocr/*` route) can react the same way regardless of which
 * provider is configured — the same role `AIErrorCode` plays for the AI
 * architecture.
 */
export type OCRErrorCode =
  | "not_configured"
  | "not_implemented"
  | "invalid_request"
  | "image_too_large"
  | "unsupported_image_type"
  | "authentication_failed"
  | "rate_limited"
  | "provider_error"
  | "network_error"
  | "unknown";

/** A normalized error type every provider throws instead of a vendor-specific error shape. */
export class OCRProviderError extends Error {
  readonly code: OCRErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: OCRErrorCode, cause?: unknown) {
    super(message);
    this.name = "OCRProviderError";
    this.code = code;
    this.cause = cause;
  }
}
