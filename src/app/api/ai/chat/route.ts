import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAIService, isAIConfigured, AIProviderError } from "@/lib/ai";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rateLimit";

// Task 33 (production security audit): this route is reachable without
// authentication (Guest Mode included) and, once configured, calls a
// paid external AI vendor per request — cap abuse from a single client
// at a generous but finite rate rather than leaving it unbounded.
const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * POST /api/ai/chat
 *
 * The one connection point between the AI Chat UI (`src/components/chat/`)
 * and the server-only AI Service Layer (`src/lib/ai/`) — this is the
 * seam Task 25's `aiService.ts` doc comment always pointed at ("a
 * future server action, API route, or background job").
 *
 * Request body: `{ conversationId: string; message: string }`
 * Response body (success, 200): `{ reply: string; provider: string; conversationId: string }`
 * Response body (failure, 4xx/5xx): `{ error: string; code: AIErrorCode }`
 *
 * Provider switching is entirely a matter of environment configuration —
 * this route never names a vendor. It always calls the single shared
 * `getAIService()`, which resolves whichever provider `AI_PROVIDER`
 * selects (`"openai"` | `"claude"` | `"gemini"`, or `"none"`) via
 * `providers/index.ts`'s registry. No API key is read, logged, or
 * returned by this route — every provider reads its own key straight
 * from `process.env` inside `src/lib/ai/`, server-side only.
 */
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

  const { conversationId, message } = (body ?? {}) as {
    conversationId?: unknown;
    message?: unknown;
  };

  if (typeof conversationId !== "string" || conversationId.trim().length === 0) {
    return NextResponse.json(
      { error: "conversationId is required.", code: "invalid_request" },
      { status: 400 }
    );
  }
  if (typeof message !== "string" || message.trim().length === 0) {
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
    });

    return NextResponse.json({
      reply: result.message.content,
      provider: service.getProviderName(),
      conversationId,
    });
  } catch (error) {
    if (error instanceof AIProviderError) {
      const status = statusForErrorCode(error.code);
      // Deliberately never include `error.cause` (which may hold a raw
      // provider response body) in the JSON sent to the browser — only
      // this route's own server-side logs see that detail.
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
