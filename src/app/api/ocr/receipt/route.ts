import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOCRService, isOCRConfigured, parseImageDataUrl } from "@/lib/ocr";
import { handleOCRRouteError } from "@/lib/ocr/routeHelpers";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rateLimit";

// Task 33 (production security audit): same rationale as
// src/app/api/ocr/image-to-text/route.ts.
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * POST /api/ocr/receipt
 *
 * The connection point for the **Receipt Reading** OCR feature.
 * Recognizes a receipt photo, then structures the raw text into
 * `merchant`/`date`/`items`/`subtotal`/`tax`/`total` via
 * `src/lib/ocr/receiptParser.ts` — pure, provider-agnostic string
 * parsing kept separate from recognition itself, so a future OCR
 * provider only ever needs to produce text.
 *
 * No OCR provider is connected in this task's scope (see
 * `src/lib/ocr/README.md`) — this route always resolves to
 * `NoopOCRProvider` and returns `503`/`not_configured` today. It exists,
 * fully wired end to end, so that connecting a real provider later is
 * purely a `src/lib/ocr/providers/<vendor>Provider.ts` file plus one
 * environment variable — neither this route nor `receiptParser.ts` would
 * need to change.
 *
 * Request body: `{ image: string }` — a `data:image/...;base64,...` URL.
 * Response body (success, 200):
 *   `{ merchant?: string; date?: string; items: { description: string; amount: number }[];
 *      subtotal?: number; tax?: number; total?: number; currency?: string;
 *      rawText: string; confidence?: number; provider: string }`
 * Response body (failure, 4xx/5xx): `{ error: string; code: OCRErrorCode }`
 */
export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `ocr-receipt:${getClientIp(request)}`,
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
    const result = await service.recognizeReceipt(parsedImage);

    return NextResponse.json(result);
  } catch (error) {
    return handleOCRRouteError(error, "receipt");
  }
}
