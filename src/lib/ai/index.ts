import "server-only";

/**
 * Barrel export for the AI architecture (Task 25).
 *
 * A future caller (a server action, API route, or background job — no
 * AI UI exists in this task's scope) can import everything it needs from
 * `@/lib/ai` instead of reaching into individual files, e.g.:
 *
 * ```ts
 * import { getAIService, isAIConfigured, AIProviderError } from "@/lib/ai";
 * ```
 */

export * from "./types";
export * from "./providerInterface";
export * from "./promptManager";
export * from "./conversationManager";
export { getAIService, isAIConfigured, AIService } from "./aiService";
export type { SendMessageParams } from "./aiService";
export {
  resolveProvider,
  OpenAIProvider,
  ClaudeProvider,
  GeminiProvider,
  NoopProvider,
} from "./providers";
export {
  getAIProvider,
  getAIModel,
  getAIBaseUrl,
  getOpenAIConfig,
  getClaudeConfig,
  getGeminiConfig,
  isOpenAIConfigured,
  isClaudeConfigured,
  isGeminiConfigured,
} from "./env";
export type { ProviderEnvConfig } from "./env";
