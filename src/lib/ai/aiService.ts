import "server-only";

import type { AIProvider } from "./providerInterface";
import { resolveProvider } from "./providers";
import { PromptManager, createDefaultPromptManager } from "./promptManager";
import { ConversationManager } from "./conversationManager";
import { isAIConfigured } from "./env";
import type { ChatImageAttachment, ChatMessage, GenerateOptions, GenerateResult } from "./types";

export interface SendMessageParams {
  conversationId: string;
  input: string;
  templateId: string;
  variables?: Record<string, string>;
  options?: GenerateOptions;
  maxHistoryMessages?: number;
  images?: ChatImageAttachment[];
}

export class AIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly promptManager: PromptManager,
    private readonly conversationManager: ConversationManager
  ) {}

  getPromptManager(): PromptManager {
    return this.promptManager;
  }

  getConversationManager(): ConversationManager {
    return this.conversationManager;
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async sendMessage(params: SendMessageParams): Promise<GenerateResult> {
    const { conversationId, input, templateId, variables = {}, options, maxHistoryMessages, images } = params;

    this.conversationManager.getOrCreate(conversationId);
    this.conversationManager.addMessage(conversationId, "user", input, images);

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

export function getAIService(): AIService {
  if (!sharedService) {
    sharedService = new AIService(resolveProvider(), createDefaultPromptManager(), new ConversationManager());
  }
  return sharedService;
}

export { isAIConfigured };