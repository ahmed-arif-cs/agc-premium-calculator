import "server-only";

import type { OCRProvider } from "../providerInterface";
import type { OCRRequest, OCRRawResult } from "../types";
import { OCRProviderError } from "../types";

/**
 * The default — and, in this task's scope, the *only* — provider.
 * Used whenever no real provider is configured (`OCR_PROVIDER` unset/
 * `"none"`, which is every environment this project ships with, since
 * `.env`/`.env.example` leave it blank on purpose).
 *
 * This is the OCR-architecture equivalent of `src/lib/ai/providers/
 * noopProvider.ts`: rather than the provider factory
 * (`providers/index.ts`) returning `undefined`/`null` and pushing a
 * null-check onto every caller, it always returns a real `OCRProvider`
 * — this one — so `OCRService` can be constructed and wired up freely,
 * and only fails, with a clear and specific error, at the moment
 * something actually tries to recognize an image with no provider
 * configured. No network call is ever made by this provider, and no
 * third-party OCR API is called anywhere in this project — it exists
 * purely to make "not configured" an explicit, typed outcome instead of
 * a crash or a silent no-op.
 */
export class NoopOCRProvider implements OCRProvider {
  readonly name = "none";

  async recognize(_request: OCRRequest): Promise<OCRRawResult> {
    throw new OCRProviderError(
      "No OCR provider is configured. This project ships with only the " +
        "architecture connected to a safe default — see src/lib/ocr/README.md " +
        "for how a real provider would be added.",
      "not_configured"
    );
  }
}
