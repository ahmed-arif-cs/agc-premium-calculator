import "server-only";

import type { AIProvider } from "../providerInterface";
import type { ChatMessage, GenerateRequest, GenerateResult } from "../types";
import { AIProviderError } from "../types";
import { getGeminiConfig, isProviderConfigComplete, type ProviderEnvConfig } from "../env";

export interface GeminiWirePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiWireContent {
  role: "user" | "model";
  parts: GeminiWirePart[];
}

export interface GeminiWireRequest {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiWireContent[];
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  private readonly config: ProviderEnvConfig;

  constructor(config: ProviderEnvConfig = getGeminiConfig()) {
    this.config = config;
  }

  isConfigured(): boolean {
    return isProviderConfigComplete(this.config);
  }

  toWireRequest(messages: ChatMessage[]): GeminiWireRequest {
    const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
    const contents: GeminiWireContent[] = messages
      .filter((m) => m.role !== "system")
      .map((message) => {
        const parts: GeminiWirePart[] = [];
        if (message.content.trim().length > 0) {
          parts.push({ text: message.content });
        }
        for (const image of message.images ?? []) {
          parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
        }
        if (parts.length === 0) parts.push({ text: "" });

        return {
          role: message.role === "assistant" ? "model" : "user",
          parts,
        };
      });

    return {
      systemInstruction:
        systemParts.length > 0 ? { parts: [{ text: systemParts.join("\n\n") }] } : undefined,
      contents,
    };
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    if (!this.isConfigured()) {
      throw new AIProviderError(
        "Gemini provider is not configured. Set GEMINI_API_KEY (and optionally " +
          "GEMINI_MODEL/GEMINI_BASE_URL) in your environment — see src/lib/ai/README.md.",
        "not_configured"
      );
    }

    const baseUrl = (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const wire = this.toWireRequest(request.messages);
    const body = {
      systemInstruction: wire.systemInstruction,
      contents: wire.contents,
      generationConfig: {
        temperature: request.options?.temperature,
        maxOutputTokens: request.options?.maxTokens,
        stopSequences: request.options?.stopSequences,
      },
    };

    let response: Response;
    try {
      response = await fetch(
        `${baseUrl}/models/${encodeURIComponent(this.config.model ?? "")}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.apiKey ?? "",
          },
          body: JSON.stringify(body),
        }
      );
    } catch (cause) {
      throw new AIProviderError(
        "Network error while calling the Gemini API.",
        "network_error",
        cause
      );
    }

    if (!response.ok) {
      throw mapGeminiHttpError(response.status, await safeReadText(response));
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (cause) {
      throw new AIProviderError(
        "Gemini returned a response that could not be parsed as JSON.",
        "provider_error",
        cause
      );
    }

    const content = extractGeminiContent(data);
    if (content === undefined) {
      throw new AIProviderError(
        "Gemini's response did not contain a recognizable assistant message.",
        "provider_error",
        data
      );
    }

    return {
      message: {
        id: `gemini:${Date.now().toString(36)}`,
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      },
      usage: extractGeminiUsage(data),
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

function mapGeminiHttpError(status: number, bodyText: string | undefined): AIProviderError {
  const detail = bodyText ? bodyText.slice(0, 500) : `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new AIProviderError("Gemini rejected the configured API key.", "authentication_failed", detail);
  }
  if (status === 429) {
    return new AIProviderError("AGC Premium is currently handling a high volume of requests. Please try again shortly.", "rate_limited", detail);
  }
  if (status >= 400 && status < 500) {
    return new AIProviderError("Gemini rejected the request as invalid.", "invalid_request", detail);
  }
  return new AIProviderError("Gemini's API returned an error.", "provider_error", detail);
}

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

function extractGeminiContent(data: unknown): string | undefined {
  const response = data as GeminiGenerateContentResponse;
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) return undefined;
  const text = parts.map((part) => part?.text ?? "").join("");
  return text.length > 0 ? text : undefined;
}

function extractGeminiUsage(data: unknown): GenerateResult["usage"] {
  const usage = (data as GeminiGenerateContentResponse)?.usageMetadata;
  if (!usage) return undefined;
  return {
    promptTokens: usage.promptTokenCount,
    completionTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
  };
}