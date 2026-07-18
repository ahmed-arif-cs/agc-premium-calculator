/**
 * Shared types for the AI architecture (Task 25).
 */

export type ChatRole = "system" | "user" | "assistant";

/**
 * An inline image attached to a message (Task: AI Chat media upload/scan).
 * `data` is raw base64 — no `data:` URL prefix — so every provider can
 * hand it straight to its own vendor wire format (Gemini's
 * `inlineData.data`, etc.) without re-parsing.
 */
export interface ChatImageAttachment {
  mimeType: string;
  data: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  images?: ChatImageAttachment[];
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface GenerateRequest {
  messages: ChatMessage[];
  options?: GenerateOptions;
}

export interface GenerateResult {
  message: ChatMessage;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export type AIErrorCode =
  | "not_configured"
  | "not_implemented"
  | "invalid_request"
  | "authentication_failed"
  | "rate_limited"
  | "provider_error"
  | "network_error"
  | "unknown";

export class AIProviderError extends Error {
  readonly code: AIErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: AIErrorCode, cause?: unknown) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.cause = cause;
  }
}