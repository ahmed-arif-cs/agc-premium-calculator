import "server-only";

import type { OCRProvider } from "../providerInterface";
import { getOCRProvider, isOCRConfigured } from "../env";
import { NoopOCRProvider } from "./noopProvider";

/**
 * Provider registry — a small, explicit map from a provider name (the
 * value of `OCR_PROVIDER`) to a factory that builds an `OCRProvider`.
 *
 * Only `"none"` is registered today, resolving to `NoopOCRProvider` —
 * this task's scope is the *architecture*, not a connected vendor (see
 * `README.md`). Adding a real provider later (a local Tesseract worker,
 * Google Cloud Vision, AWS Textract, Azure AI Vision, etc.) means
 * writing one new `providers/<vendor>Provider.ts` that implements
 * `OCRProvider` (`../providerInterface.ts`) and adding one more entry to
 * this map — nothing else in `src/lib/ocr/` or any caller (`ocrService.ts`,
 * every `src/app/api/ocr/*` route) needs to change, exactly like adding
 * a fourth AI vendor only ever touched `src/lib/ai/providers/index.ts`
 * plus one new file.
 */
const registry: Record<string, () => OCRProvider> = {
  none: () => new NoopOCRProvider(),
};

/**
 * Resolves the configured provider (`OCR_PROVIDER`) to a concrete
 * `OCRProvider` instance. Falls back to `NoopOCRProvider` whenever the
 * named provider isn't registered (including the default, unset case,
 * and — today — literally every case, since no vendor is registered
 * yet) — this function never throws and never returns `undefined`, so
 * it's always safe to call during app startup/module init.
 *
 * Callers that need to distinguish "really configured" from "silently
 * using the no-op fallback" should check `isOCRConfigured()` (`../env.ts`)
 * themselves first — this factory intentionally doesn't throw that
 * distinction away, but doesn't repeat it either.
 */
export function resolveOCRProvider(): OCRProvider {
  const name = getOCRProvider();
  const factory = registry[name];
  return factory ? factory() : new NoopOCRProvider();
}

export { isOCRConfigured };
export { NoopOCRProvider };
