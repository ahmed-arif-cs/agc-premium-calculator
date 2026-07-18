import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAIService, isAIConfigured, AIProviderError } from "@/lib/ai";
import type { ChatImageAttachment } from "@/lib/ai";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rateLimit";

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGE_BASE64_LENGTH = 6_000_000;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const IMAGE_DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;

function parseImages(rawImages: unknown): { images?: ChatImageAttachment[]; error?: string } {
  if (rawImages === undefined || rawImages === null) return { images: undefined };
  if (!Array.isArray(rawImages)) return { error: "images must be an array of data URLs." };
  if (rawImages.length > MAX_IMAGES_PER_MESSAGE) {
    return { error: `You can attach at most ${MAX_IMAGES_PER_MESSAGE} images per message.` };
  }

  const images: ChatImageAttachment[] = [];
  for (const entry of rawImages) {
    if (typeof entry !== "string") {
      return { error: "Each image must be a data URL string." };
    }
    if (entry.length > MAX_IMAGE_BASE64_LENGTH) {
      return { error: "One of the attached images is too large. Please attach a smaller photo." };
    }
    const match = IMAGE_DATA_URL_PATTERN.exec(entry);
    if (!match) {
      return { error: "One of the attached images is not a valid image data URL." };
    }
    const [, mimeType, data] = match;
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
      return { error: `Unsupported image type: ${mimeType}. Use JPEG, PNG, WebP, or HEIC.` };
    }
    images.push({ mimeType: mimeType.toLowerCase(), data });
  }

  return { images: images.length > 0 ? images : undefined };
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `ai-chat:${getClientIp(request)}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.ok) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds ?? 60);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "invalid_request" },
      { status: 400 }
    );
  }

  const { conversationId, message, images: rawImages } = (body ?? {}) as {
    conversationId?: unknown;
    message?: unknown;
    images?: unknown;
  };

  if (typeof conversationId !== "string" || conversationId.trim().length === 0) {
    return NextResponse.json(
      { error: "conversationId is required.", code: "invalid_request" },
      { status: 400 }
    );
  }
  if (typeof message !== "string") {
    return NextResponse.json(
      { error: "message is required.", code: "invalid_request" },
      { status: 400 }
    );
  }
  if (message.length > 8000) {
    return NextResponse.json(
      { error: "message is too long.", code: "invalid_request" },
      { status: 400 }
    );
  }

  const { images, error: imageError } = parseImages(rawImages);
  if (imageError) {
    return NextResponse.json({ error: imageError, code: "invalid_request" }, { status: 400 });
  }
  if (message.trim().length === 0 && (!images || images.length === 0)) {
    return NextResponse.json(
      { error: "message is required.", code: "invalid_request" },
      { status: 400 }
    );
  }

  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error:
          "No AI provider is configured yet. Set AI_PROVIDER plus the matching " +
          "vendor API key in your environment — see src/lib/ai/README.md.",
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  try {
    const service = getAIService();
    const result = await service.sendMessage({
      conversationId,
      input: message,
      templateId: "general-assistant",
      maxHistoryMessages: 20,
      images,
    });

    return NextResponse.json({
      reply: result.message.content,
      provider: service.getProviderName(),
      conversationId,
    });
  } catch (error) {
    if (error instanceof AIProviderError) {
      const status = statusForErrorCode(error.code);
      console.error(`[api/ai/chat] ${error.code}: ${error.message}`, error.cause);
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error("[api/ai/chat] unexpected error", error);
    return NextResponse.json(
      { error: "Something went wrong talking to the AI provider.", code: "unknown" },
      { status: 500 }
    );
  }
}

function statusForErrorCode(code: AIProviderError["code"]): number {
  switch (code) {
    case "not_configured":
      return 503;
    case "not_implemented":
      return 501;
    case "invalid_request":
      return 400;
    case "authentication_failed":
      return 401;
    case "rate_limited":
      return 429;
    case "network_error":
    case "provider_error":
      return 502;
    default:
      return 500;
  }
}