import "server-only";

import { NextResponse } from "next/server";

/**
 * Minimal in-memory, per-IP rate limiter for the app's server-only API
 * routes (`/api/ai/*`, `/api/ocr/*`) — Task 33 (production security
 * audit).
 *
 * These routes are reachable without any authentication (Guest Mode can
 * use AI Chat/AI Calculator/OCR exactly like a signed-in user — see
 * `src/lib/auth/routes.ts`, which has no protected prefixes today), and
 * each one either calls a paid, external vendor API (OpenAI/Claude/
 * Gemini) once configured, or does non-trivial server-side work (JSON
 * parsing, base64 image validation, expression evaluation). Without any
 * throttle, a single client could hammer these endpoints — running up a
 * real bill on a configured AI/OCR provider, or just tying up server
 * resources — which is exactly the kind of abuse-surface a production
 * security audit should close, even though nothing was previously
 * broken or insecure about the request/response handling itself.
 *
 * Deliberately simple: a fixed-window counter keyed by client IP, held
 * in a module-level `Map` for this server process's lifetime. This is
 * not a distributed rate limiter (a multi-instance deployment would
 * need a shared store, e.g. Redis) — but it costs nothing to add, needs
 * no new dependency or environment variable, and meaningfully raises
 * the bar against casual single-client abuse without touching any
 * existing route's request/response contract. `checkRateLimit()` never
 * throws; callers decide what to do with the result.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

// Periodically forget expired windows so `buckets` can't grow without
// bound across a long-running server process (e.g. thousands of distinct
// IPs over days). Runs lazily on access rather than its own timer, so it
// never keeps the process alive on its own (relevant for serverless).
function pruneIfNeeded(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, state] of buckets) {
    if (state.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Resolves the best-effort client IP for a `NextRequest`, preferring the
 * common reverse-proxy headers this project's own `Caddyfile` sets
 * (`X-Forwarded-For`/`X-Real-IP`) before falling back to a constant
 * bucket — never throws, never blocks the request path itself.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry, set only when `ok` is `false`. */
  retryAfterSeconds?: number;
}

/**
 * Fixed-window check: allows up to `limit` calls per `windowMs` for a
 * given key (e.g. `"ai-chat:203.0.113.4"`, i.e. route name + client IP,
 * so each route gets its own independent budget). Call once per
 * incoming request before doing any real work.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneIfNeeded(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true };
}

/**
 * Standard `429 Too Many Requests` JSON response shared by every rate
 * limited route — same `{ error, code }` shape every other error path in
 * `/api/ai/*` and `/api/ocr/*` already uses, so callers on the client
 * don't need a special case for this failure mode.
 */
export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait a moment and try again.",
      code: "rate_limited",
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
