import "server-only";

import type { AIProvider } from "../providerInterface";
import type { ChatMessage, GenerateRequest, GenerateResult } from "../types";
import { AIProviderError } from "../types";
import { getClaudeConfig, isProviderConfigComplete, type ProviderEnvConfig } from "../env";

/** The wire shape Anthropic's Messages API expects for one non-system message. */
export interface ClaudeWireMessage {
  role: "user" | "assistant";
  content: string;
}

/** Anthropic's Messages API takes the system prompt as its own top-level field, not as a message. */
export interface ClaudeWireRequest {
  system?: string;
  messages: ClaudeWireMessage[];
}

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Modular Claude (Anthropic) provider (Task 26, connected in Task 29's
 * "Connect AI Chat" pass).
 *
 * Reads its configuration from the environment
 * (`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`/`ANTHROPIC_BASE_URL`, via
 * `env.ts`'s `getClaudeConfig()` — no key is hardcoded anywhere in this
 * file) and sends a real request to Anthropic's Messages API via
 * `fetch`, pulling any `"system"`-role message(s) out into a separate
 * top-level `system` string, since Anthropic's API (unlike OpenAI's)
 * doesn't accept a system message inside the `messages` array. Every
 * failure mode (missing config, HTTP error, network error, malformed
 * response) is normalized into a typed `AIProviderError` so `AIService`
 * and the `/api/ai/chat` route can react uniformly regardless of which
 * vendor is configured.
 */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude";

  private readonly config: ProviderEnvConfig;

  constructor(config: ProviderEnvConfig = getClaudeConfig()) {
    this.config = config;
  }

  /** True once an API key and model are both present. Never throws. */
  isConfigured(): boolean {
    return isProviderConfigComplete(this.config);
  }

  /**
   * Maps this project's provider-agnostic `ChatMessage[]` onto
   * Anthropic's own wire shape: every `"system"`-role message is joined
   * into one top-level `system` string, and every remaining `"user"`/
   * `"assistant"` message is passed through in order. Pure and
   * network-free — reused by `generate()` below once a future task
   * actually sends this payload somewhere.
   */
  toWireRequest(messages: ChatMessage[]): ClaudeWireRequest {
    const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
    const conversation = messages
      .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    return {
      system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
      messages: conversation,
    };
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    if (!this.isConfigured()) {
      throw new AIProviderError(
        "Claude provider is not configured. Set ANTHROPIC_API_KEY (and optionally " +
          "ANTHROPIC_MODEL/ANTHROPIC_BASE_URL) in your environment — see src/lib/ai/README.md.",
        "not_configured"
      );
    }

    const baseUrl = (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const wire = this.toWireRequest(request.messages);
    const body = {
      model: this.config.model,
      system: wire.system,
      messages: wire.messages,
      max_tokens: request.options?.maxTokens ?? 1024,
      temperature: request.options?.temperature,
      stop_sequences: request.options?.stopSequences,
    };

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey ?? "",
          "anthropic-version": ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new AIProviderError(
        "Network error while calling the Anthropic API.",
        "network_error",
        cause
      );
    }

    if (!response.ok) {
      throw mapClaudeHttpError(response.status, await safeReadText(response));
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (cause) {
      throw new AIProviderError(
        "Anthropic returned a response that could not be parsed as JSON.",
        "provider_error",
        cause
      );
    }

    const content = extractClaudeContent(data);
    if (content === undefined) {
      throw new AIProviderError(
        "Anthropic's response did not contain a recognizable assistant message.",
        "provider_error",
        data
      );
    }

    return {
      message: {
        id: `claude:${Date.now().toString(36)}`,
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      },
      usage: extractClaudeUsage(data),
      raw: data,
    };
  }
}

async function safeReadText(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

function mapClaudeHttpError(status: number, bodyText: string | undefined): AIProviderError {
  const detail = bodyText ? bodyText.slice(0, 500) : `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new AIProviderError("Anthropic rejected the configured API key.", "authentication_failed", detail);
  }
  if (status === 429) {
    return new AIProviderError("Anthropic rate-limited this request.", "rate_limited", detail);
  }
  if (status >= 400 && status < 500) {
    return new AIProviderError("Anthropic rejected the request as invalid.", "invalid_request", detail);
  }
  return new AIProviderError("Anthropic's API returned an error.", "provider_error", detail);
}

interface AnthropicMessagesResponse {
  content?: { type?: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

function extractClaudeContent(data: unknown): string | undefined {
  const response = data as AnthropicMessagesResponse;
  const textBlocks = response?.content?.filter((block) => block?.type === "text" && typeof block.text === "string");
  if (!textBlocks || textBlocks.length === 0) return undefined;
  return textBlocks.map((block) => block.text).join("\n\n");
}

function extractClaudeUsage(data: unknown): GenerateResult["usage"] {
  const usage = (data as AnthropicMessagesResponse)?.usage;
  if (!usage) return undefined;
  const promptTokens = usage.input_tokens;
  const completionTokens = usage.output_tokens;
  return {
    promptTokens,
    completionTokens,
    totalTokens:
      promptTokens !== undefined && completionTokens !== undefined
        ? promptTokens + completionTokens
        : undefined,
  };
}
