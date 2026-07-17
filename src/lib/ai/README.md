# AI architecture (Task 25, providers prepared in Task 26, connected in Task 29, AI Calculator added in Task 30)

This directory holds the AI **architecture** and the real provider
implementations backing this app's AI Chat feature
(`src/components/chat/`, served from `/chat`, reached from the
calculator's topbar) and, since Task 30, its AI Calculator feature
(`src/components/calculator/AICalculatorPanel.tsx`, opened from the
calculator's own topbar — natural-language calculations, formula
explanations, and step-by-step solutions layered on top of, and never
replacing, `src/lib/calculator.ts`'s existing engine). No API key of
any kind is hardcoded, defaulted, or checked into this project — every
value below is read from the environment only. Three modular providers
— OpenAI, Claude (Anthropic), and Gemini (Google) — each read their own
dedicated environment variables, shape a request into that vendor's own
wire format, and make a real `fetch` call to that vendor's API.
Switching providers is a one-line environment change (`AI_PROVIDER`) —
no code change, and no change to either AI feature's own UI or API
route. Everything here still follows the same "foundation layer, safe
with nothing configured" philosophy `src/lib/supabase/` established for
cloud sync: with every AI env var left blank, the app (and both AI
features) keep working — `isAIConfigured()` is `false`, each feature
shows a clear, honest "not configured" notice instead of a fabricated
reply, and nothing else in the calculator is affected either way.

## Why this exists

An AI-powered chat feature needs five things: a stable interface any
vendor can implement, a place to manage prompt templates, a place to
manage conversation state, a single orchestration layer tying them
together, and — the piece this task adds — a way for a browser to
actually reach that orchestration layer without ever seeing a secret key.
`src/lib/ai/*` is entirely `import "server-only"` guarded; the one and
only client-server seam is `POST /api/ai/chat`
(`src/app/api/ai/chat/route.ts`), which the chat UI calls with a plain
`{ conversationId, message }` JSON body and gets back `{ reply, provider }`
— never a key, never a raw provider response, never anything that
identifies which vendor produced the reply beyond its registered name.

## Pieces

| Piece | File | Role |
|---|---|---|
| Environment configuration | `env.ts` | The one place `AI_PROVIDER`/`AI_MODEL`/`AI_API_KEY`/`AI_BASE_URL` (generic) and each vendor's own `OPENAI_*`/`ANTHROPIC_*`/`GEMINI_*` variables are read, with one consistent error message and `isAIConfigured()`/`isOpenAIConfigured()`/`isClaudeConfigured()`/`isGeminiConfigured()` checks that never throw — mirrors `src/lib/supabase/env.ts`. `import "server-only"` guarded; no key can reach the browser through this file. |
| Shared types | `types.ts` | `ChatRole`/`ChatMessage`/`GenerateRequest`/`GenerateResult`/`AIProviderError` — the provider-agnostic vocabulary every other file here is built on. |
| **Provider Interface** | `providerInterface.ts` | The `AIProvider` contract (`name` + `generate(request)`) any vendor implementation must satisfy. This is the seam `AIService` codes against instead of any one SDK — swapping or adding a provider never touches this file. |
| Provider registry | `providers/index.ts` | `resolveProvider()` — maps `AI_PROVIDER`'s value (`"none"` \| `"openai"` \| `"claude"` \| `"gemini"`) to a concrete `AIProvider`, defaulting to `NoopProvider` for unrecognized/unset. Never throws, never returns `undefined`. This is the whole "easy provider switching" mechanism — one environment variable, no code change. |
| Default provider | `providers/noopProvider.ts` | `NoopProvider` — the fallback for `"none"`/unrecognized. Makes no network call; its `generate()` throws a typed `AIProviderError` (`"not_configured"`) so "no provider configured" is an explicit, catchable outcome rather than a silent no-op or a crash. |
| OpenAI provider | `providers/openaiProvider.ts` | `OpenAIProvider` — reads `OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL`, shapes the request via `toWireMessages()`, and calls `POST {baseUrl}/chat/completions` with a real `fetch`. HTTP/network/parse failures are normalized into a typed `AIProviderError` (`authentication_failed`/`rate_limited`/`invalid_request`/`provider_error`/`network_error`). |
| Claude provider | `providers/claudeProvider.ts` | `ClaudeProvider` — reads `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`/`ANTHROPIC_BASE_URL`, shapes the request via `toWireRequest()` (pulling system message(s) into a top-level `system` string, per Anthropic's own API shape), and calls `POST {baseUrl}/messages` with a real `fetch`. Same normalized-error handling as OpenAI. |
| Gemini provider | `providers/geminiProvider.ts` | `GeminiProvider` — reads `GEMINI_API_KEY`/`GEMINI_MODEL`/`GEMINI_BASE_URL`, shapes the request via `toWireRequest()` (mapping `"assistant"` → `"model"`, system message(s) into `systemInstruction`), and calls `POST {baseUrl}/models/{model}:generateContent` with a real `fetch`. Same normalized-error handling as the other two. |
| **Prompt Manager** | `promptManager.ts` | `PromptManager` — registers/renders named prompt templates (`{{variableName}}` placeholders) and builds the full `ChatMessage[]` a provider receives from a template + variables + conversation history. `createDefaultPromptManager()` ships with one starting template, `"general-assistant"`, used by `/api/ai/chat`. |
| **Conversation Manager** | `conversationManager.ts` | `ConversationManager` — an in-memory, server-process-lifetime store of conversations (`create`/`get`/`getOrCreate`/`addMessage`/`getHistory`/`clear`/`delete`), keyed by the `conversationId` the chat UI generates and persists client-side (`localStorage`). No database persistence — a server restart starts fresh conversation context, though the UI's own `localStorage` transcript is unaffected. |
| **AI Service Layer** | `aiService.ts` | `AIService` — the single orchestration entry point. `sendMessage()` records the user's message, builds the prompt via `PromptManager`, calls the resolved `AIProvider`, records the reply, and returns it. `getAIService()` returns a shared, lazily-constructed instance wired from `env.ts`/`providers/index.ts`. |
| **The connection** | `src/app/api/ai/chat/route.ts` | `POST /api/ai/chat` — the only client-server seam for AI Chat. Validates the request body, checks `isAIConfigured()`, calls `getAIService().sendMessage()`, and maps any thrown `AIProviderError` to an HTTP status + `{ error, code }` body (never leaking `error.cause`, which may hold a raw provider response). Called from `ChatWindow.tsx`. |
| **The AI Calculator connection** (Task 30) | `src/app/api/ai/calculate/route.ts` | `POST /api/ai/calculate` — the client-server seam for the AI Calculator panel (`AICalculatorPanel.tsx`). Registers its own `"ai-calculator-assistant"` prompt template on the same shared `PromptManager`, asks the configured provider for a structured `{ expression, explanation, steps }` reply, then always re-computes the actual number by calling this project's own, completely unchanged `evaluateExpression`/`formatResult` (`src/lib/calculator.ts`) on the AI's `expression` — the AI is never trusted for the arithmetic itself, only for understanding the question and writing the explanation/steps. |
| Barrel export | `index.ts` | Re-exports everything above from one entry point (`@/lib/ai`) — used by `src/app/api/ai/chat/route.ts` and `src/app/api/ai/calculate/route.ts`. |

## Setup

1. Copy `.env.example` to `.env` (already done for this project).
2. Set `AI_PROVIDER` to `"openai"`, `"claude"`, or `"gemini"` to select
   which provider `resolveProvider()` builds (leave it blank/`"none"` to
   keep using the safe `NoopProvider` default — the chat page still works,
   it just always shows the "not configured" notice).
3. Fill in that vendor's own section — **only that vendor's key is
   required**, since each provider reads its own dedicated variables:
   - **OpenAI** — `OPENAI_API_KEY` (required), `OPENAI_MODEL` (defaults to
     `"gpt-4o-mini"`), `OPENAI_BASE_URL` (optional — e.g. an Azure OpenAI
     deployment or self-hosted-compatible gateway).
   - **Claude (Anthropic)** — `ANTHROPIC_API_KEY` (required),
     `ANTHROPIC_MODEL` (defaults to `"claude-sonnet-4-6"`),
     `ANTHROPIC_BASE_URL` (optional).
   - **Gemini (Google)** — `GEMINI_API_KEY` (required), `GEMINI_MODEL`
     (defaults to `"gemini-flash-latest"`), `GEMINI_BASE_URL` (optional).
   - **Never commit a real key value** — these files are for local
     configuration only. `.env` is already git-ignored by this project.
4. Restart the dev server (env vars are read at request time via
   `process.env`, but Next.js only reloads `.env` on process start).
   Visit `/chat` (or the AI Chat icon in the calculator's topbar) and send
   a message — it now reaches your configured provider for real.
5. **Switching providers later is just step 2 again** — change
   `AI_PROVIDER`, restart, done. No file in this directory or in
   `src/components/chat/` needs to change to switch, add a fourth vendor's
   *credentials*, or run with a different vendor already registered.
6. Leaving everything blank is still fully supported —
   `isAIConfigured()` is `false`, `resolveProvider()` returns
   `NoopProvider`, `/api/ai/chat` responds `503` with
   `{ code: "not_configured" }`, and the chat UI shows that as a plain
   system notice rather than doing anything silently wrong.
7. To add a fourth vendor entirely: implement `AIProvider`
   (`providerInterface.ts`) in a new `providers/<vendor>Provider.ts`
   (reading its own `env.ts` accessor, following the existing three as a
   template) and register it in `providers/index.ts`'s `registry` map —
   nothing in `aiService.ts`, `promptManager.ts`,
   `conversationManager.ts`, `providerInterface.ts`, or
   `src/app/api/ai/chat/route.ts` needs to change.

## Security notes

- No provider file, the API route, `env.ts`, or any other file in this
  project logs, returns, or otherwise exposes an API key. Only the
  `Authorization`/`x-api-key`/`x-goog-api-key` request header sent
  directly to that vendor's own API ever carries it.
- `/api/ai/chat`'s error responses only ever include a human-readable
  message and a machine-readable `AIErrorCode` — never `error.cause`
  (which may hold a raw HTTP response body from the vendor). The route
  logs that detail server-side (`console.error`) for debugging, where it
  never reaches the browser.
- Every provider file is `import "server-only"` guarded, alongside
  `env.ts`, `aiService.ts`, `promptManager.ts`, and
  `conversationManager.ts` — none of them can be imported from a
  `"use client"` file; the Next.js build itself would fail if something
  tried.

## AI Calculator (Task 30)

`src/components/calculator/AICalculatorPanel.tsx`, opened from a topbar
button in `Calculator.tsx`, is the second feature this architecture
backs. It asks the same shared `getAIService()` for three things only —
a machine-parsable `expression` (in this app's own internal expression
grammar), a plain-language `explanation`, and an ordered `steps`
walkthrough — via a dedicated `"ai-calculator-assistant"` prompt
template registered on the shared `PromptManager` by
`src/app/api/ai/calculate/route.ts` the first time it runs. The AI is
never the source of truth for the actual number: the route always
evaluates the AI's `expression` itself with `evaluateExpression`/
`formatResult` (`src/lib/calculator.ts`, completely unchanged), and
returns that computed result alongside the AI's explanation and steps.
If the AI produces something the engine can't evaluate, the route
returns a clear `provider_error` rather than guessing. Each request uses
a fresh, one-shot `conversationId` that is deleted from
`ConversationManager` again once the reply comes back, since this
feature asks one question at a time rather than holding a running
conversation the way AI Chat does.

## Explicitly out of scope for this task

- **No new AI UI** — the Chat Window/Message List/Chat Input/Loading
  State built in Tasks 27-28 are unchanged in shape; only their data
  source changed (a real `fetch` to `/api/ai/chat` instead of a local
  `setTimeout`).
- **No persistence for `ConversationManager`** — still in-memory only,
  matching Task 25's original scope; a future task can swap in a
  Supabase-backed implementation behind the same shape without changing
  `AIService` or the route.
- **No change to any existing calculator feature** — the calculator,
  converters, history, favorites, settings, cloud sync/backup/restore/
  multi-device sync, and auth foundations (Tasks 1-24) are completely
  untouched by this task.
