import "server-only";

import type { ChatImageAttachment, ChatMessage, ChatRole } from "./types";

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export class ConversationNotFoundError extends Error {
  constructor(readonly conversationId: string) {
    super(`No conversation found with id "${conversationId}".`);
    this.name = "ConversationNotFoundError";
  }
}

let messageCounter = 0;

function nextMessageId(): string {
  messageCounter += 1;
  return `msg_${Date.now().toString(36)}_${messageCounter.toString(36)}`;
}

export class ConversationManager {
  private readonly conversations = new Map<string, Conversation>();

  create(conversationId?: string): Conversation {
    const id = conversationId ?? nextMessageId();
    const existing = this.conversations.get(id);
    if (existing) return existing;

    const now = new Date().toISOString();
    const conversation: Conversation = { id, messages: [], createdAt: now, updatedAt: now };
    this.conversations.set(id, conversation);
    return conversation;
  }

  get(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  getOrCreate(conversationId: string): Conversation {
    return this.get(conversationId) ?? this.create(conversationId);
  }

  addMessage(conversationId: string, role: ChatRole, content: string, images?: ChatImageAttachment[]): ChatMessage {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new ConversationNotFoundError(conversationId);

    const message: ChatMessage = {
      id: nextMessageId(),
      role,
      content,
      createdAt: new Date().toISOString(),
      ...(images && images.length > 0 ? { images } : {}),
    };

    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    return message;
  }

  getHistory(conversationId: string, maxMessages?: number): ChatMessage[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];
    if (maxMessages === undefined || conversation.messages.length <= maxMessages) {
      return [...conversation.messages];
    }
    return conversation.messages.slice(-maxMessages);
  }

  clear(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    conversation.messages = [];
    conversation.updatedAt = new Date().toISOString();
  }

  delete(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  listConversationIds(): string[] {
    return Array.from(this.conversations.keys());
  }
}