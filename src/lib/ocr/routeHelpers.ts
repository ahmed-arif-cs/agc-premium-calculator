import "server-only";

import { NextResponse } from "next/server";
import { OCRProviderError } from "./types";

/**
 * Shared error-to-HTTP-response mapping for every `src/app/api/ocr/*`
 * route. Kept here, not inside any one `route.ts`, because a Next.js
 * route file may only export recognized route handlers (`GET`/`POST`/
 * etc.) and a small set of route-segment config values — any other
 * export is invalid there, so this project's three OCR routes each
 * import this helper instead of re-exporting it from one another.
 */
export function handleOCRRouteError(error: unknown, routeLabel: string): NextResponse {
  if (error instanceof OCRProviderError) {
    const status = statusForOCRErrorCode(error.code);
    // Never include `error.cause` (which may hold a raw provider
    // response) in the JSON sent to the browser — only this route's own
    // server-side logs see that detail.
    console.error(`[api/ocr/${routeLabel}] ${error.code}: ${error.message}`, error.cause);
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  console.error(`[api/ocr/${routeLabel}] unexpected error`, error);
  return NextResponse.json(
    { error: "Something went wrong reading that image.", code: "unknown" },
    { status: 500 }
  );
}

export function statusForOCRErrorCode(code: OCRProviderError["code"]): number {
  switch (code) {
    case "not_configured":
      return 503;
    case "not_implemented":
      return 501;
    case "invalid_request":
    case "image_too_large":
    case "unsupported_image_type":
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
