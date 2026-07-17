import "server-only";

import type { ChatMessage, ChatRole } from "./types";

/** A single conversation: an ordered message list plus its own bookkeeping timestamps. */
export interface Conversation {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

/** Thrown when a `ConversationManager` method is asked for a conversation id it doesn't have. */
export class ConversationNotFoundError extends Error {
  constructor(readonly conversationId: string) {
    super(`No conversation found with id "${conversationId}".`);
    this.name = "ConversationNotFoundError";
  }
}

let messageCounter = 0;

/** A simple, dependency-free unique id — no external id/uuid package needed for this foundation layer. */
function nextMessageId(): string {
  messageCounter += 1;
  return `msg_${Date.now().toString(36)}_${messageCounter.toString(36)}`;
}

/**
 * Owns conversation state — the message history `PromptManager`/`AIProvider`
 * read from and `AIService` appends to on every turn.
 *
 * This is an **in-memory, server-process-lifetime** store (a plain `Map`),
 * deliberately: this task builds the AI architecture only, with no AI UI
 * and no persistence layer wired up (see `README.md`'s Task 25 note) —
 * there is nothing yet that needs a conversation to survive a server
 * restart. A future task can add a persisted-backing implementation
 * (e.g. a Supabase table, following this project's existing
 * `src/lib/supabase/*Sync.ts` conventions) behind the same shape this
 * class exposes, without changing `AIService` or `PromptManager`.
 *
 * Not a React hook and has no UI dependency — safe to use from a future
 * server-only route/action, matching this task's "no AI UI" scope.
 */
export class ConversationManager {
  private readonly conversations = new Map<string, Conversation>();

  /**
   * Creates a new, empty conversation. If `conversationId` is omitted, a
   * new id is generated; if it's supplied and already exists, the
   * existing conversation is returned unchanged rather than being reset —
   * callers that need a guaranteed-fresh conversation should `delete()`
   * first, or omit `conversationId` and let one be generated.
   */
  create(conversationId?: string): Conversation {
    const id = conversationId ?? nextMessageId();
    const existing = this.conversations.get(id);
    if (existing) return existing;

    const now = new Date().toISOString();
    const conversation: Conversation = { id, messages: [], createdAt: now, updatedAt: now };
    this.conversations.set(id, conversation);
    return conversation;
  }

  /** Returns a conversation by id, or `undefined` if it doesn't exist. Never creates one. */
  get(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  /** Returns a conversation by id, creating an empty one on first access — a convenience over `get()`/`create()`. */
  getOrCreate(conversationId: string): Conversation {
    return this.get(conversationId) ?? this.create(conversationId);
  }

  /**
   * Appends a new message to a conversation, stamping it with a
   * generated id and the current time, and returns the stored message.
   * Throws `ConversationNotFoundError` if `conversationId` doesn't exist —
   * callers should `getOrCreate()` first, exactly as `AIService` does.
   */
  addMessage(conversationId: string, role: ChatRole, content: string): ChatMessage {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new ConversationNotFoundError(conversationId);

    const message: ChatMessage = {
      id: nextMessageId(),
      role,
      content,
      createdAt: new Date().toISOString(),
    };

    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    return message;
  }

  /**
   * Returns a conversation's message history, oldest first. When
   * `maxMessages` is given, only the most recent `maxMessages` are
   * returned (a simple, provider-agnostic way to bound how much history
   * is sent on a long-running conversation) — a future token-aware
   * trimming strategy can replace this without changing this method's
   * signature or any caller.
   *
   * Returns an empty array (never throws) for an unknown conversation id,
   * since "no history yet" and "conversation doesn't exist" should look
   * the same to a caller that's only building a prompt.
   */
  getHistory(conversationId: string, maxMessages?: number): ChatMessage[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];
    if (maxMessages === undefined || conversation.messages.length <= maxMessages) {
      return [...conversation.messages];
    }
    return conversation.messages.slice(-maxMessages);
  }

  /** Removes every message from a conversation without deleting the conversation itself. No-op if it doesn't exist. */
  clear(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    conversation.messages = [];
    conversation.updatedAt = new Date().toISOString();
  }

  /** Deletes a conversation entirely. No-op if it doesn't exist. */
  delete(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /** Every conversation id currently held, for diagnostics/tests. */
  listConversationIds(): string[] {
    return Array.from(this.conversations.keys());
  }
}
