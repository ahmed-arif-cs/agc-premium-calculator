import "server-only";

/**
 * Barrel export for the OCR architecture.
 *
 * A future caller (an API route, server action, or background job — no
 * OCR UI exists in this task's scope, see `README.md`) can import
 * everything it needs from `@/lib/ocr` instead of reaching into
 * individual files, e.g.:
 *
 * ```ts
 * import { getOCRService, isOCRConfigured, OCRProviderError } from "@/lib/ocr";
 * ```
 */

export * from "./types";
export * from "./providerInterface";
export * from "./receiptParser";
export * from "./mathParser";
export * from "./imageInput";
export {
  getOCRService,
  isOCRConfigured,
  OCRService,
} from "./ocrService";
export type {
  RecognizeTextResult,
  RecognizeReceiptResult,
  RecognizeMathResult,
} from "./ocrService";
export { resolveOCRProvider, NoopOCRProvider } from "./providers";
export {
  getOCRProvider,
  getOCRModel,
  getOCRApiKey,
  getOCRBaseUrl,
} from "./env";
