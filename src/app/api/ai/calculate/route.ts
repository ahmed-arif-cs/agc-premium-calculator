import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAIService, isAIConfigured, AIProviderError } from "@/lib/ai";
import {
  CalculatorError,
  evaluateExpression,
  formatExpressionForDisplay,
  formatResult,
  type AngleMode,
} from "@/lib/calculator";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rateLimit";

// Task 33 (production security audit): same rationale as
// src/app/api/ai/chat/route.ts — unauthenticated, calls a paid external
// AI vendor once configured.
const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * POST /api/ai/calculate
 *
 * The connection point between the AI Calculator UI
 * (`src/components/calculator/AICalculatorPanel.tsx`) and the same
 * server-only AI Service Layer (`src/lib/ai/`) `src/app/api/ai/chat/route.ts`
 * already uses — same shared `getAIService()`, same provider-agnostic
 * `AIProviderError` handling, same "never touch the calculation logic"
 * rule Task 29's chat route already followed.
 *
 * The AI is asked for three things only: a machine-parsable `expression`
 * (in this project's own internal expression grammar — see
 * `src/lib/calculator.ts`'s own doc comment), a plain-language
 * `explanation` of the formula/concept involved, and an ordered `steps`
 * walkthrough. It is deliberately never trusted for the arithmetic
 * itself — this route always re-computes the actual number by calling
 * the exact same, completely unchanged `evaluateExpression`/
 * `formatResult` this app's keypad and Smart Bar (`src/lib/nlp.ts`)
 * already use, so "Natural Language Calculations" here can never
 * silently disagree with the rest of the calculator.
 *
 * Request body: `{ query: string; angleMode?: "deg" | "rad" }`
 * Response body (success, 200):
 *   `{ expression: string; displayExpression: string; result: string;
 *      explanation: string; steps: string[]; provider: string }`
 * Response body (failure, 4xx/5xx): `{ error: string; code: AIErrorCode }`
 */

const CALCULATOR_TEMPLATE_ID = "ai-calculator-assistant";

/** Registers the calculator-specific prompt template on the shared `PromptManager`, once. */
function ensureTemplateRegistered(): void {
  const promptManager = getAIService().getPromptManager();
  if (promptManager.get(CALCULATOR_TEMPLATE_ID)) return;

  promptManager.register({
    id: CALCULATOR_TEMPLATE_ID,
    description:
      "AI Calculator (Task 30) — turns a natural-language math request into this app's own expression grammar plus a plain-language explanation and step-by-step walkthrough. Never the source of truth for the final number.",
    systemPrompt: [
      "You are the AI Calculator assistant embedded in the AGC Premium Calculator.",
      "You do NOT replace this app's own calculation engine — you only translate the person's natural-language request and explain the method. A separate, deterministic engine always computes the real final answer from the \"expression\" you return, so you must never assert a specific final numeric answer with confidence anywhere in your reply.",
      "",
      "Respond with STRICT JSON ONLY. No markdown code fences, no prose before or after, no trailing commas. Match exactly this shape:",
      '{"expression": string, "explanation": string, "steps": string[]}',
      "",
      "Rules for \"expression\":",
      "- A single expression in this exact grammar: decimal numbers; operators + - * / ^; parentheses ( ); functions written as sin(x) cos(x) tan(x) sqrt(x) log(x) ln(x) (log is base-10, ln is natural log); postfix % meaning \"divide by 100\" (e.g. 20% is 20/100); postfix ! meaning factorial; and the constants pi and e.",
      "- ASCII only, no spaces, no thousands separators, no words, no units.",
      "- The app's current angle mode is \"{{angleMode}}\" (\"deg\" or \"rad\") — assume that mode for sin/cos/tan; do not convert it yourself.",
      "- If the request is not a calculation at all, return \"0\" for \"expression\" and explain in \"explanation\" that you can only help with calculations, with an empty \"steps\" array.",
      "",
      "\"explanation\": one short, plain-language paragraph (1-3 sentences) naming which formula or operation applies and why — written for someone who has never seen it before.",
      "",
      "\"steps\": an ordered array of short plain-language strings walking through the method used to reach the answer conceptually. Describe the reasoning, not a specific final number.",
    ].join("\n"),
  });
}

interface CalculatorAIResponse {
  expression: string;
  explanation: string;
  steps: string[];
}

/** Strips an optional ```json fence a model may add despite being told not to. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseCalculatorResponse(raw: string): CalculatorAIResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new AIProviderError(
      "The AI response could not be understood as a calculation.",
      "provider_error",
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new AIProviderError(
      "The AI response could not be understood as a calculation.",
      "provider_error",
    );
  }

  const { expression, explanation, steps } = parsed as Record<string, unknown>;

  if (typeof expression !== "string" || expression.trim().length === 0) {
    throw new AIProviderError(
      "The AI response did not include a usable expression.",
      "provider_error",
    );
  }
  if (typeof explanation !== "string") {
    throw new AIProviderError(
      "The AI response did not include an explanation.",
      "provider_error",
    );
  }
  if (!Array.isArray(steps) || !steps.every((s) => typeof s === "string")) {
    throw new AIProviderError(
      "The AI response did not include a usable step-by-step breakdown.",
      "provider_error",
    );
  }

  return { expression: expression.trim(), explanation, steps };
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `ai-calculate:${getClientIp(request)}`,
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
      { status: 400 },
    );
  }

  const { query, angleMode } = (body ?? {}) as { query?: unknown; angleMode?: unknown };

  if (typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { error: "query is required.", code: "invalid_request" },
      { status: 400 },
    );
  }
  if (query.length > 500) {
    return NextResponse.json(
      { error: "query is too long.", code: "invalid_request" },
      { status: 400 },
    );
  }
  const resolvedAngleMode: AngleMode = angleMode === "rad" ? "rad" : "deg";

  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error:
          "No AI provider is configured yet. Set AI_PROVIDER plus the matching " +
          "vendor API key in your environment — see src/lib/ai/README.md.",
        code: "not_configured",
      },
      { status: 503 },
    );
  }

  // A fresh, one-shot conversation per request — the AI Calculator asks a
  // single question and gets a single structured answer, so there is no
  // multi-turn history to keep around afterward (unlike AI Chat's
  // persisted `conversationId`).
  const conversationId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ai-calc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  try {
    ensureTemplateRegistered();
    const service = getAIService();

    const result = await service.sendMessage({
      conversationId,
      input: query,
      templateId: CALCULATOR_TEMPLATE_ID,
      variables: { angleMode: resolvedAngleMode },
    });

    const parsed = parseCalculatorResponse(result.message.content);

    let value: number;
    try {
      value = evaluateExpression(parsed.expression, resolvedAngleMode);
    } catch (calcError) {
      const message =
        calcError instanceof CalculatorError
          ? calcError.message
          : "that expression";
      return NextResponse.json(
        {
          error: `The AI understood your question as "${formatExpressionForDisplay(parsed.expression)}", but this calculator couldn't evaluate it (${message}). Try rephrasing your question.`,
          code: "provider_error",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      expression: parsed.expression,
      displayExpression: formatExpressionForDisplay(parsed.expression),
      result: formatResult(value),
      explanation: parsed.explanation,
      steps: parsed.steps,
      provider: service.getProviderName(),
    });
  } catch (error) {
    if (error instanceof AIProviderError) {
      const status = statusForErrorCode(error.code);
      // Never include `error.cause` (which may hold a raw provider
      // response body) in the JSON sent to the browser — only this
      // route's own server-side logs see that detail.
      console.error(`[api/ai/calculate] ${error.code}: ${error.message}`, error.cause);
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error("[api/ai/calculate] unexpected error", error);
    return NextResponse.json(
      { error: "Something went wrong asking the AI to work that out.", code: "unknown" },
      { status: 500 },
    );
  } finally {
    // One-shot request — don't let the conversation store grow unbounded
    // with entries nothing will ever revisit.
    getAIService().getConversationManager().delete(conversationId);
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
