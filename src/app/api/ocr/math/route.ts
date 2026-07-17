import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOCRService, isOCRConfigured, parseImageDataUrl } from "@/lib/ocr";
import { handleOCRRouteError } from "@/lib/ocr/routeHelpers";
import {
  CalculatorError,
  evaluateExpression,
  formatExpressionForDisplay,
  formatResult,
  type AngleMode,
} from "@/lib/calculator";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rateLimit";

// Task 33 (production security audit): same rationale as
// src/app/api/ocr/image-to-text/route.ts.
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * POST /api/ocr/math
 *
 * The connection point for the **Math Image Recognition** OCR feature.
 * Recognizes a photo of a handwritten/printed math problem, extracts a
 * candidate expression in this app's own grammar via
 * `src/lib/ocr/mathParser.ts`, then — the same "recognizer proposes, the
 * deterministic engine computes" rule `src/app/api/ai/calculate/route.ts`
 * already established for the AI Calculator — always computes the
 * actual number itself by calling this project's own, completely
 * unchanged `evaluateExpression`/`formatResult`
 * (`src/lib/calculator.ts`). The recognized image is never trusted for
 * the arithmetic itself, only for identifying which expression to
 * evaluate.
 *
 * No OCR provider is connected in this task's scope (see
 * `src/lib/ocr/README.md`) — this route always resolves to
 * `NoopOCRProvider` and returns `503`/`not_configured` today. It exists,
 * fully wired end to end, so that connecting a real provider later is
 * purely a `src/lib/ocr/providers/<vendor>Provider.ts` file plus one
 * environment variable — neither this route nor `mathParser.ts` nor
 * `src/lib/calculator.ts` would need to change.
 *
 * Request body: `{ image: string; angleMode?: "deg" | "rad" }` — `image`
 * is a `data:image/...;base64,...` URL.
 * Response body (success, 200):
 *   `{ expression: string; displayExpression: string; result: string;
 *      rawText: string; confidence?: number; provider: string }`
 * Response body (failure, 4xx/5xx): `{ error: string; code: OCRErrorCode }`
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `ocr-math:${getClientIp(request)}`,
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

  const { image, angleMode } = (body ?? {}) as { image?: unknown; angleMode?: unknown };
  const resolvedAngleMode: AngleMode = angleMode === "rad" ? "rad" : "deg";

  try {
    const parsedImage = parseImageDataUrl(image);

    if (!isOCRConfigured()) {
      return NextResponse.json(
        {
          error:
            "No OCR provider is configured yet. This project ships the OCR " +
            "architecture only — see src/lib/ocr/README.md for how a real " +
            "provider would be connected.",
          code: "not_configured",
        },
        { status: 503 }
      );
    }

    const service = getOCRService();
    const recognized = await service.recognizeMath(parsedImage);

    if (!recognized.expression) {
      return NextResponse.json(
        {
          error: "Couldn't find a math expression in that image. Try a clearer, closer photo.",
          code: "provider_error",
        },
        { status: 502 }
      );
    }

    let value: number;
    try {
      value = evaluateExpression(recognized.expression, resolvedAngleMode);
    } catch (calcError) {
      const message = calcError instanceof CalculatorError ? calcError.message : "that expression";
      return NextResponse.json(
        {
          error: `The image was read as "${formatExpressionForDisplay(recognized.expression)}", but this calculator couldn't evaluate it (${message}). Try a clearer photo.`,
          code: "provider_error",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      expression: recognized.expression,
      displayExpression: formatExpressionForDisplay(recognized.expression),
      result: formatResult(value),
      rawText: recognized.rawText,
      confidence: recognized.confidence,
      provider: recognized.provider,
    });
  } catch (error) {
    return handleOCRRouteError(error, "math");
  }
}
