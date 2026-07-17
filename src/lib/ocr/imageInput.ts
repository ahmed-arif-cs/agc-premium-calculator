import "server-only";

import type { OCRImageInput } from "./types";
import { OCRProviderError } from "./types";

/**
 * The image MIME types this architecture accepts. Deliberately narrow —
 * the common formats a phone camera or a screenshot produces — rather
 * than accepting anything a browser's `<input type="file">` might hand
 * over.
 */
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Ceiling on the base64 payload's own character length (roughly 3/4 of
 * this in raw bytes) — generous enough for a full-resolution phone photo
 * of a receipt or a worked math problem, small enough to keep a single
 * request from tying up a server process. Mirrors the same
 * length-ceiling-over-a-data-URL approach `src/hooks/useProfile.ts`
 * already uses for avatar images (`MAX_AVATAR_LENGTH`), scaled up for a
 * full document photo rather than a small avatar crop.
 */
export const MAX_IMAGE_BASE64_LENGTH = 8_000_000; // ~6 MB of decoded image bytes

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Parses and validates a `data:image/...;base64,...` URL — the same
 * shape `src/hooks/useProfile.ts` already uses client-side for avatars
 * — into the provider-agnostic `OCRImageInput` shape every
 * `OCRProvider.recognize()` call expects.
 *
 * Throws a typed `OCRProviderError` (`invalid_request` /
 * `unsupported_image_type` / `image_too_large`) rather than a generic
 * error, so every `src/app/api/ocr/*` route can map failures to an HTTP
 * status the exact same way it already maps a thrown error from
 * `OCRService`/`OCRProvider` — image validation is not a special case
 * callers need to handle differently.
 */
export function parseImageDataUrl(value: unknown): OCRImageInput {
  if (typeof value !== "string" || value.length === 0) {
    throw new OCRProviderError("image is required.", "invalid_request");
  }

  if (value.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new OCRProviderError(
      "Image is too large. Try a smaller photo or a tighter crop.",
      "image_too_large"
    );
  }

  const match = value.match(DATA_URL_PATTERN);
  if (!match) {
    throw new OCRProviderError(
      "image must be a data URL, e.g. \"data:image/png;base64,...\".",
      "invalid_request"
    );
  }

  const [, mimeType, data] = match;
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new OCRProviderError(
      `Unsupported image type "${mimeType}". Use PNG, JPEG, or WEBP.`,
      "unsupported_image_type"
    );
  }

  return { data, mimeType: mimeType.toLowerCase() };
}
