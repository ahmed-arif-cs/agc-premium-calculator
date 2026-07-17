import "server-only";

import type { AIProvider } from "../providerInterface";
import type { ChatMessage, GenerateRequest, GenerateResult } from "../types";
import { AIProviderError } from "../types";
import { getOpenAIConfig, isProviderConfigComplete, type ProviderEnvConfig } from "../env";

/** The wire shape OpenAI's Chat Completions API expects for one message. */
export interface OpenAIWireMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Modular OpenAI provider (Task 26, connected in Task 29's "Connect AI
 * Chat" pass).
 *
 * Reads its configuration from the environment
 * (`OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL`, via `env.ts`'s
 * `getOpenAIConfig()` — no key is hardcoded anywhere in this file) and
 * shapes/sends a real Chat Completions request via `fetch`. Every failure
 * mode (missing config, HTTP error, network error, malformed response) is
 * normalized into a typed `AIProviderError` so `AIService` and the
 * `/api/ai/chat` route can react uniformly regardless of which vendor is
 * configured — this file is the only one that needs to change to
 * add/adjust OpenAI support; `providerInterface.ts`, `aiService.ts`,
 * `promptManager.ts`, and `conversationManager.ts` don't need to know
 * OpenAI exists.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private readonly config: ProviderEnvConfig;

  constructor(config: ProviderEnvConfig = getOpenAIConfig()) {
    this.config = config;
  }

  /** True once an API key and model are both present. Never throws. */
  isConfigured(): boolean {
    return isProviderConfigComplete(this.config);
  }

  /**
   * Maps this project's provider-agnostic `ChatMessage[]` onto OpenAI's
   * own `{ role, content }` wire shape. Pure and network-free — useful on
   * its own for tests/inspection, and reused by `generate()` below once a
   * future task actually sends this payload somewhere.
   */
  toWireMessages(messages: ChatMessage[]): OpenAIWireMessage[] {
    return messages.map((message) => ({ role: message.role, content: message.content }));
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    if (!this.isConfigured()) {
      throw new AIProviderError(
        "OpenAI provider is not configured. Set OPENAI_API_KEY (and optionally " +
          "OPENAI_MODEL/OPENAI_BASE_URL) in your environment — see src/lib/ai/README.md.",
        "not_configured"
      );
    }

    const baseUrl = (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const body = {
      model: this.config.model,
      messages: this.toWireMessages(request.messages),
      temperature: request.options?.temperature,
      max_tokens: request.options?.maxTokens,
      stop: request.options?.stopSequences,
    };

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new AIProviderError(
        "Network error while calling the OpenAI API.",
        "network_error",
        cause
      );
    }

    if (!response.ok) {
      throw mapOpenAIHttpError(response.status, await safeReadText(response));
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (cause) {
      throw new AIProviderError(
        "OpenAI returned a response that could not be parsed as JSON.",
        "provider_error",
        cause
      );
    }

    const content = extractOpenAIContent(data);
    if (content === undefined) {
      throw new AIProviderError(
        "OpenAI's response did not contain a recognizable assistant message.",
        "provider_error",
        data
      );
    }

    return {
      message: {
        id: `openai:${Date.now().toString(36)}`,
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      },
      usage: extractOpenAIUsage(data),
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

function mapOpenAIHttpError(status: number, bodyText: string | undefined): AIProviderError {
  const detail = bodyText ? bodyText.slice(0, 500) : `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new AIProviderError("OpenAI rejected the configured API key.", "authentication_failed", detail);
  }
  if (status === 429) {
    return new AIProviderError("OpenAI rate-limited this request.", "rate_limited", detail);
  }
  if (status >= 400 && status < 500) {
    return new AIProviderError("OpenAI rejected the request as invalid.", "invalid_request", detail);
  }
  return new AIProviderError("OpenAI's API returned an error.", "provider_error", detail);
}

interface OpenAIChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function extractOpenAIContent(data: unknown): string | undefined {
  const response = data as OpenAIChatCompletionResponse;
  const content = response?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : undefined;
}

function extractOpenAIUsage(data: unknown): GenerateResult["usage"] {
  const usage = (data as OpenAIChatCompletionResponse)?.usage;
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}
