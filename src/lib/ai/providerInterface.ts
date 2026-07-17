import type { GenerateRequest, GenerateResult } from "./types";

/**
 * The contract every AI provider implementation must satisfy.
 *
 * This is the seam the rest of the architecture (`AIService`) codes
 * against, instead of any one vendor's SDK — swapping providers, or
 * adding a new one, means writing one new file that implements this
 * interface, not touching `aiService.ts`, `promptManager.ts`, or
 * `conversationManager.ts`.
 *
 * `providers/noopProvider.ts` is the only implementation in this task's
 * scope (a safe default that reports "not configured" rather than doing
 * nothing silently) — a real vendor implementation (OpenAI, Anthropic,
 * etc.) is deliberately out of scope here (see `README.md`'s Task 25
 * note) and can be added later as `providers/<vendor>Provider.ts`
 * without any change to this interface.
 */
export interface AIProvider {
  /** Machine-readable identifier, e.g. `"openai"`, `"anthropic"`, `"none"`. Used for logging/diagnostics. */
  readonly name: string;

  /**
   * Produce the next assistant message for the given request.
   *
   * Implementations should throw an `AIProviderError` (never a raw/vendor
   * error) on any failure, using the most specific `AIErrorCode` that
   * applies — this is what lets `AIService` and any future caller react
   * uniformly regardless of which provider is configured.
   */
  generate(request: GenerateRequest): Promise<GenerateResult>;
}
