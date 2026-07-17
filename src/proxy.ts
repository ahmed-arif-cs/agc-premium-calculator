import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/auth/routes";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Edge-level route protection (Next.js 16's `proxy.ts` convention — the
 * renamed successor to `middleware.ts`; same request-interception model).
 *
 * `PROTECTED_ROUTE_PREFIXES` (src/lib/auth/routes.ts) is empty today — the
 * calculator itself is fully public/guest-usable, so this proxy is a
 * no-op in production right now (confirmed via the `matcher` below, which
 * only runs for routes that don't exist yet). It exists so that the
 * moment a real account-only route is added, it starts redirecting
 * unauthenticated requests to `/` automatically instead of that route
 * needing to reinvent its own auth check. There is no `/login` page to
 * redirect to yet — that arrives with the future login UI — so this
 * redirects home with a `?auth=required` marker a future banner/toast
 * can read.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("auth", "required");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

/**
 * Matcher is intentionally scoped to the (currently nonexistent)
 * account-only route prefixes rather than `/:path*`, so this middleware
 * costs nothing on every request to the real, public calculator route.
 * Add new prefixes here in lockstep with `PROTECTED_ROUTE_PREFIXES`.
 */
export const config = {
  matcher: ["/account/:path*", "/sync/:path*"],
};
