import "server-only";

/**
 * OCR Service environment variable access.
 *
 * FOUNDATION LAYER ONLY — architecture, not a connected vendor. This
 * module exists so that every future piece of the OCR architecture
 * (`ocrService.ts`, `providers/`) reads its configuration from exactly
 * one place, with one consistent "not configured" story, instead of
 * each file reaching into `process.env` directly — the exact same
 * pattern `src/lib/ai/env.ts` established for the AI architecture, and
 * `src/lib/supabase/env.ts` before that for cloud sync.
 *
 * Nothing in this file throws at import/build time, and no API key is
 * hardcoded, checked in, or given a default value anywhere in this
 * project — every value below is read from the environment only, and
 * every one of them is left blank in `.env`/`.env.example` on purpose.
 * The app must keep working with zero OCR provider configured at all —
 * `resolveOCRProvider()` (`providers/index.ts`) always falls back to
 * `NoopProvider`, exactly like the AI architecture's `resolveProvider()`
 * falls back to its own `NoopProvider`.
 *
 * `import "server-only"` guards this file the same way `src/lib/ai/env.ts`
 * does — an OCR API key must never be bundled into client JavaScript,
 * so nothing here is safe to import from a `"use client"` file (there is
 * no client-side OCR code in this task's scope in the first place — see
 * this directory's `README.md`).
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Which provider the OCR Service Layer should resolve to (e.g. a future
 * `"tesseract"`, `"google-vision"`, `"aws-textract"`, `"azure-vision"`).
 * Defaults to `"none"` — the safe, always-available value that resolves
 * to `providers/noopProvider.ts` — so an unset/blank environment never
 * crashes anything that merely checks which provider is configured.
 *
 * No provider name currently resolves to anything other than
 * `NoopProvider` (see `providers/index.ts`) — this accessor exists so
 * that plugging in a real provider later is purely an environment
 * change plus one new provider file, not a change to how configuration
 * is read.
 */
export function getOCRProvider(): string {
  return (readEnv("OCR_PROVIDER") ?? "none").toLowerCase();
}

/**
 * The model/engine identifier to request from a future configured
 * provider (e.g. a specific Textract API version, a Tesseract language
 * pack). Optional — a provider implementation may fall back to its own
 * default when this is unset.
 */
export function getOCRModel(): string | undefined {
  return readEnv("OCR_MODEL");
}

/**
 * Secret API key for a future configured provider. Server-only — bypasses
 * nothing on its own, but must never reach the browser. Left unread by
 * every provider in this task's scope (`NoopProvider` never needs a
 * key), and left blank in `.env`/`.env.example` — present now purely so
 * a future real provider has a single, established place to read it
 * from instead of inventing its own `process.env` access pattern.
 */
export function getOCRApiKey(): string | undefined {
  return readEnv("OCR_API_KEY");
}

/**
 * Optional custom API base URL, for a self-hosted or proxied OCR
 * endpoint. Most future providers can ignore this and use their own
 * default endpoint.
 */
export function getOCRBaseUrl(): string | undefined {
  return readEnv("OCR_BASE_URL");
}

/**
 * True once a real provider (anything other than `"none"`) is named
 * *and* an API key is present. Lets callers — chiefly
 * `providers/index.ts`'s provider factory, `ocrService.ts`, and every
 * `src/app/api/ocr/*` route — check availability without assuming a key
 * is set, mirroring `isAIConfigured()`'s role for the AI architecture.
 *
 * Always `false` in this task's shipped state, since `OCR_PROVIDER` is
 * left blank in `.env`/`.env.example` and no vendor provider is
 * registered in `providers/index.ts` yet — every `src/app/api/ocr/*`
 * route therefore always returns a clear `503`/`not_configured` today,
 * by design, rather than silently doing nothing or fabricating a result.
 */
export function isOCRConfigured(): boolean {
  return getOCRProvider() !== "none" && Boolean(readEnv("OCR_API_KEY"));
}
