import "server-only";

import type { AIProvider } from "../providerInterface";
import { getAIProvider, isAIConfigured } from "../env";
import { NoopProvider } from "./noopProvider";
import { OpenAIProvider } from "./openaiProvider";
import { ClaudeProvider } from "./claudeProvider";
import { GeminiProvider } from "./geminiProvider";

/**
 * Provider registry — a small, explicit map from a provider name (the
 * value of `AI_PROVIDER`) to a factory that builds an `AIProvider`.
 *
 * As of **Task 26**, three real vendor names resolve to real (but
 * intentionally not-yet-connected — see each file's own doc comment)
 * provider classes: `"openai"` → `OpenAIProvider`, `"claude"` →
 * `ClaudeProvider`, `"gemini"` → `GeminiProvider`. `"none"` (the
 * default) still resolves to `NoopProvider`, unchanged from Task 25.
 * None of the three new classes make a network call — see
 * `openaiProvider.ts`/`claudeProvider.ts`/`geminiProvider.ts` — so
 * selecting one of them via `AI_PROVIDER` only changes *which* typed
 * "not configured"/"not yet connected" error `AIService.sendMessage()`
 * surfaces, not what actually happens over the network (nothing does).
 * Wiring a fourth vendor in later means adding one more
 * `providers/<vendor>Provider.ts` implementing `AIProvider`
 * (`../providerInterface.ts`) and one more entry in this map — nothing
 * else in `src/lib/ai/` or any caller needs to change.
 */
const registry: Record<string, () => AIProvider> = {
  none: () => new NoopProvider(),
  openai: () => new OpenAIProvider(),
  claude: () => new ClaudeProvider(),
  gemini: () => new GeminiProvider(),
};

/**
 * Resolves the configured provider (`AI_PROVIDER`) to a concrete
 * `AIProvider` instance. Falls back to `NoopProvider` whenever the named
 * provider isn't registered (including the default, unset case) — this
 * function never throws and never returns `undefined`, so it's always
 * safe to call during app startup/module init, exactly like
 * `isSupabaseConfigured()`'s callers never need to guard against a
 * missing client.
 *
 * Callers that need to distinguish "really configured" from "silently
 * using the no-op fallback" should check `isAIConfigured()`
 * (`../env.ts`) themselves — this factory intentionally doesn't throw
 * that distinction away, but doesn't repeat it either.
 */
export function resolveProvider(): AIProvider {
  const name = getAIProvider();
  const factory = registry[name];
  return factory ? factory() : new NoopProvider();
}

export { isAIConfigured };
export { OpenAIProvider, ClaudeProvider, GeminiProvider, NoopProvider };
