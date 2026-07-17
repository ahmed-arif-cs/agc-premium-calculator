# OCR architecture (architecture only — no vendor OCR API connected)

This directory holds a production-ready **architecture** for three OCR
features — **Image to Text**, **Receipt Reading**, and **Math Image
Recognition** — deliberately scoped the same way `src/lib/ai/` was at
Task 25: every seam a real implementation needs (a provider contract,
an environment-configuration layer, a provider registry with a safe
default, an orchestration service, and — one layer up — three
`src/app/api/ocr/*` routes) is built and wired end to end, but **no
third-party OCR API is called anywhere in this project.** `OCR_PROVIDER`
is left blank in `.env`/`.env.example`, no vendor is registered in
`providers/index.ts`'s registry, and the only provider implementation
shipped is `providers/noopProvider.ts`, which makes no network call and
always throws a typed `"not_configured"` error. This is an explicit,
narrower scope than `src/lib/ai/`'s own providers (which do make real
`fetch` calls once a vendor key is supplied) — this task's instructions
were to build the architecture only.

With every OCR env var left blank (the state this project ships in),
all three `src/app/api/ocr/*` routes still work correctly: they validate
the request, then return a clear `503`/`{ code: "not_configured" }`
instead of doing nothing silently or fabricating a result.

## Why this exists

An OCR feature needs the same five things a chat feature does: a stable
interface any vendor can implement, a place to manage configuration, a
provider registry with a safe default, a single orchestration layer,
and a client-server seam that never exposes a secret key. `src/lib/ocr/*`
is entirely `import "server-only"` guarded, same as `src/lib/ai/*` — no
OCR API key (were one ever configured) could reach the browser through
this directory.

What's specific to OCR, and not shared with the AI architecture, is the
**mode-specific structuring** layer: a provider's job ends at producing
raw recognized text; turning that text into a receipt's line items or a
solvable math expression is pure, provider-agnostic string parsing
(`receiptParser.ts`, `mathParser.ts`) that works identically no matter
which vendor eventually recognizes the text.

## Pieces

| Piece | File | Role |
|---|---|---|
| Environment configuration | `env.ts` | The one place `OCR_PROVIDER`/`OCR_MODEL`/`OCR_API_KEY`/`OCR_BASE_URL` are read, with `isOCRConfigured()` — always `false` today, since no vendor is registered — mirroring `src/lib/ai/env.ts`. `import "server-only"` guarded. |
| Shared types | `types.ts` | `OCRMode`/`OCRImageInput`/`OCRRequest`/`OCRRawResult`/`OCRProviderError` — the provider-agnostic vocabulary every other file here is built on, mirroring `src/lib/ai/types.ts`. |
| **Provider Interface** | `providerInterface.ts` | The `OCRProvider` contract (`name` + `recognize(request)`) any vendor implementation must satisfy. This is the seam `OCRService` codes against instead of any one SDK — adding a provider later never touches this file. |
| Provider registry | `providers/index.ts` | `resolveOCRProvider()` — maps `OCR_PROVIDER`'s value to a concrete `OCRProvider`. Only `"none"` is registered today, defaulting to `NoopOCRProvider`. Never throws, never returns `undefined`. |
| Default (only) provider | `providers/noopProvider.ts` | `NoopOCRProvider` — makes no network call, no third-party OCR API call of any kind; its `recognize()` throws a typed `OCRProviderError` (`"not_configured"`) so "no provider configured" is an explicit, catchable outcome. |
| Image input validation | `imageInput.ts` | `parseImageDataUrl()` — validates and decodes a `data:image/...;base64,...` URL (the same shape `src/hooks/useProfile.ts` already uses for avatars) into `OCRImageInput`, rejecting oversized payloads and unsupported MIME types with typed errors before any recognition is attempted. |
| **Receipt parsing** | `receiptParser.ts` | `parseReceiptText()` — pure, network-free string parsing that turns raw recognized text into `merchant`/`date`/`items`/`subtotal`/`tax`/`total`/`currency`. Every field is optional; a line that doesn't clearly match is left out rather than guessed at. |
| **Math expression extraction** | `mathParser.ts` | `extractExpression()` — normalizes OCR-flavored symbols (×, ÷, − dashes, π, √) into this app's own expression grammar and picks the most likely candidate line, dropping anything after a trailing `=` since this app recomputes the answer itself. Never evaluates anything. |
| **OCR Service Layer** | `ocrService.ts` | `OCRService` — the single orchestration entry point, mirroring `src/lib/ai/aiService.ts`. `recognizeText()`, `recognizeReceipt()`, `recognizeMath()` each call the resolved `OCRProvider` and, for the latter two, the matching parser. `getOCRService()` returns a shared, lazily-constructed instance. |
| Route error mapping | `routeHelpers.ts` | `handleOCRRouteError()`/`statusForOCRErrorCode()` — shared `OCRProviderError` → HTTP response mapping used by all three routes below (kept out of any one `route.ts`, since a Next.js route file may only export recognized route handlers). |
| **Image to Text connection** | `src/app/api/ocr/image-to-text/route.ts` | `POST /api/ocr/image-to-text` — validates the request, checks `isOCRConfigured()`, calls `getOCRService().recognizeText()`, returns `{ text, confidence?, provider }`. |
| **Receipt Reading connection** | `src/app/api/ocr/receipt/route.ts` | `POST /api/ocr/receipt` — same shape, calls `recognizeReceipt()`, returns the structured receipt fields plus `rawText`. |
| **Math Image Recognition connection** | `src/app/api/ocr/math/route.ts` | `POST /api/ocr/math` — calls `recognizeMath()`, then always re-evaluates the extracted `expression` with `src/lib/calculator.ts`'s own, completely unchanged `evaluateExpression`/`formatResult` — the recognized image is never trusted for the arithmetic itself, only for identifying the expression, the exact same rule `src/app/api/ai/calculate/route.ts` already applies to the AI Calculator's own `expression` field. |
| Barrel export | `index.ts` | Re-exports everything above (except `routeHelpers.ts`, imported directly by each route) from one entry point (`@/lib/ocr`). |

## Setup

There is nothing to configure today — every OCR env var is left blank
in `.env`/`.env.example` on purpose, and no vendor provider is
registered. All three routes work correctly in this state: they return
`503`/`{ code: "not_configured" }` rather than doing anything silently
wrong.

To connect a real provider later:

1. Implement `OCRProvider` (`providerInterface.ts`) in a new
   `providers/<vendor>Provider.ts` — reading its own configuration via
   `env.ts` (or a new vendor-specific accessor added there, following
   `src/lib/ai/env.ts`'s per-vendor `ProviderEnvConfig` pattern), shaping
   a request into that vendor's own wire format, and mapping every
   failure mode into a typed `OCRProviderError` — using
   `src/lib/ai/providers/openaiProvider.ts` as a template for the shape
   of that work.
2. Register it in `providers/index.ts`'s `registry` map under its own
   name.
3. Set `OCR_PROVIDER` (and that vendor's own API key) in the
   environment and restart the dev server.

Nothing in `ocrService.ts`, `receiptParser.ts`, `mathParser.ts`,
`imageInput.ts`, `routeHelpers.ts`, or any of the three
`src/app/api/ocr/*` routes needs to change to add a provider — the same
one-file-plus-one-registry-entry story `src/lib/ai/README.md` documents
for adding a fourth AI vendor.

## Security notes

- No provider file, route, `env.ts`, or any other file in this project
  logs, returns, or otherwise exposes an OCR API key (were one ever
  configured) — mirrors `src/lib/ai/README.md`'s own security notes.
- Every `src/app/api/ocr/*` route's error responses only ever include a
  human-readable message and a machine-readable `OCRErrorCode` — never
  `error.cause` (which may hold a raw provider response). Server-side
  `console.error` logging carries that detail instead.
- `imageInput.ts` enforces a MIME-type allowlist (PNG/JPEG/WEBP) and a
  base64-length ceiling (`MAX_IMAGE_BASE64_LENGTH`, ~6 MB decoded)
  before any image data reaches a provider, so an oversized or
  unexpected upload is rejected with a typed `400` before any
  recognition is attempted.
- Every file in this directory (other than the three route handlers
  themselves, which are the necessary client-server seam) is
  `import "server-only"` guarded — none of them can be imported from a
  `"use client"` file; the Next.js build itself would fail if something
  tried.

## Explicitly out of scope for this task

- **No vendor OCR API is called** — this is the one constraint this
  task's own instructions called out explicitly. `providers/index.ts`'s
  registry has exactly one entry (`"none"` → `NoopOCRProvider`); no
  `fetch` call to Google Cloud Vision, AWS Textract, Azure AI Vision,
  OCR.space, Tesseract's own cloud offerings, or any other third-party
  OCR API exists anywhere in this project.
- **No new OCR UI** — no button, panel, or image-upload affordance was
  added to the calculator's existing UI. This task's instructions were
  to implement the architecture only; every existing calculator/
  converter/history/memory/settings/favorites/about/account/profile
  component, the AI Chat and AI Calculator features, AGC branding/PDF
  exports/favicon, Guest Mode, Google/GitHub Login, and every prior
  task's cloud sync/backup/restore/multi-device-sync feature are
  completely untouched.
- **No new dependency** — `imageInput.ts`'s validation, `receiptParser.ts`,
  and `mathParser.ts` are all plain TypeScript string/regex logic;
  nothing in this directory required adding a package. `package.json`/
  lockfiles are unchanged.
- **No persistence** — like `src/lib/ai/conversationManager.ts`'s
  original scope, there is no database table or store for OCR requests/
  results; each request is stateless.
