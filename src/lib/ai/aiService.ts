import "server-only";

import type { AIProvider } from "./providerInterface";
import { resolveProvider } from "./providers";
import { PromptManager, createDefaultPromptManager } from "./promptManager";
import { ConversationManager } from "./conversationManager";
import { isAIConfigured } from "./env";
import type { ChatMessage, GenerateOptions, GenerateResult } from "./types";

export interface SendMessageParams {
  conversationId: string;
  /** The person's new message text. */
  input: string;
  /** Which registered `PromptManager` template to render as the system prompt. */
  templateId: string;
  /** Values to fill the template's `{{variableName}}` placeholders with. */
  variables?: Record<string, string>;
  options?: GenerateOptions;
  /** Bounds how much prior history is sent — see `ConversationManager.getHistory()`. */
  maxHistoryMessages?: number;
}

/**
 * The AI Service Layer — the single, top-level entry point the rest of
 * this project (a future server action, API route, or background job)
 * is meant to call, instead of reaching into `PromptManager`,
 * `ConversationManager`, or an `AIProvider` directly.
 *
 * Wires the other three architectural pieces together for one thing:
 * `sendMessage()` — record the person's message, build the full prompt
 * from the conversation's history, ask the configured provider to
 * generate a reply, record that reply, and hand it back. Each piece it
 * depends on is injected (constructor parameters), not hardcoded, so a
 * test — or a future caller that needs an isolated conversation store —
 * can supply its own `ConversationManager`/`PromptManager`/`AIProvider`
 * instead of the shared, module-level defaults `createAIService()`
 * wires up below.
 *
 * No AI UI calls this yet, by this task's own scope — this class exists
 * so that when one does, it has exactly one well-defined seam to call
 * into, with the provider/prompt/conversation plumbing already solved.
 */
export class AIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly promptManager: PromptManager,
    private readonly conversationManager: ConversationManager
  ) {}

  /** Exposed so a caller can register additional templates on the exact instance this service uses. */
  getPromptManager(): PromptManager {
    return this.promptManager;
  }

  /** Exposed so a caller can inspect/clear conversation state directly when needed. */
  getConversationManager(): ConversationManager {
    return this.conversationManager;
  }

  /** The provider's own name (`"none"` when unconfigured) — useful for logging/diagnostics. */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Records `input` as a new user message, builds the full prompt from
   * the named template + the conversation's own history, asks the
   * configured provider to generate the next assistant message, records
   * that reply, and returns it.
   *
   * Throws an `AIProviderError` with code `"not_configured"` (via the
   * `NoopProvider`) if no real provider is configured — the caller's job
   * (a future AI UI or route) is to catch that and show/return an
   * appropriate message; this layer doesn't swallow or hide it, since
   * silently doing nothing would be worse than an explicit, typed error.
   */
  async sendMessage(params: SendMessageParams): Promise<GenerateResult> {
    const { conversationId, input, templateId, variables = {}, options, maxHistoryMessages } = params;

    this.conversationManager.getOrCreate(conversationId);
    this.conversationManager.addMessage(conversationId, "user", input);

    const history: ChatMessage[] = this.conversationManager.getHistory(
      conversationId,
      maxHistoryMessages
    );
    const messages = this.promptManager.buildMessages(templateId, variables, history);

    const result = await this.provider.generate({ messages, options });

    this.conversationManager.addMessage(conversationId, result.message.role, result.message.content);

    return result;
  }
}

let sharedService: AIService | undefined;

/**
 * Returns a shared, module-level `AIService`, constructing it on first
 * call with `providers/index.ts`'s `resolveProvider()` (which itself
 * degrades to `NoopProvider` whenever no real provider is configured —
 * see `isAIConfigured()` below for how to check that up front) and a
 * fresh `ConversationManager` + this project's default `PromptManager`.
 *
 * A future caller that needs full isolation (tests, or a scenario where
 * conversations genuinely shouldn't share state) can instead construct
 * `new AIService(...)` directly with its own provider/prompt/conversation
 * instances instead of using this shared accessor.
 */
export function getAIService(): AIService {
  if (!sharedService) {
    sharedService = new AIService(resolveProvider(), createDefaultPromptManager(), new ConversationManager());
  }
  return sharedService;
}

export { isAIConfigured };
