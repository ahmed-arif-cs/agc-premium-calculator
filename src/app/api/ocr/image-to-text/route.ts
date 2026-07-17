import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOCRService, isOCRConfigured, parseImageDataUrl } from "@/lib/ocr";
import { handleOCRRouteError } from "@/lib/ocr/routeHelpers";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rateLimit";

// Task 33 (production security audit): unauthenticated route that, once
// a provider is configured, decodes/uploads image payloads — a lower
// per-minute cap than the text-only AI routes, since each call carries a
// larger request body and (once configured) real image-processing cost.
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * POST /api/ocr/image-to-text
 *
 * The connection point for the **Image to Text** OCR feature — the
 * plainest of the three modes this architecture supports: recognize
 * whatever text appears in a photo and return it verbatim, with no
 * further structuring.
 *
 * No OCR provider is connected in this task's scope (see
 * `src/lib/ocr/README.md`) — this route always resolves to
 * `NoopOCRProvider` and returns `503`/`not_configured` today. It exists,
 * fully wired end to end, so that connecting a real provider later is
 * purely a `src/lib/ocr/providers/<vendor>Provider.ts` file plus one
 * environment variable — this route itself would not need to change.
 *
 * Request body: `{ image: string }` — a `data:image/...;base64,...` URL.
 * Response body (success, 200): `{ text: string; confidence?: number; provider: string }`
 * Response body (failure, 4xx/5xx): `{ error: string; code: OCRErrorCode }`
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `ocr-image-to-text:${getClientIp(request)}`,
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

  const { image } = (body ?? {}) as { image?: unknown };

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
    const result = await service.recognizeText(parsedImage);

    return NextResponse.json({
      text: result.text,
      confidence: result.confidence,
      provider: result.provider,
    });
  } catch (error) {
    return handleOCRRouteError(error, "image-to-text");
  }
}
