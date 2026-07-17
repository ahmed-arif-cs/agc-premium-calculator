import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, getServerSession } from "@/lib/auth/session";

/**
 * Session-check endpoint.
 *
 * `SessionProvider` calls this once on mount to reconcile the client's
 * locally-cached auth state with the server. There is no sign-in endpoint
 * yet (login screens are explicitly out of scope for this task), so this
 * always reports a signed-out server session today. The client already
 * falls back to its local guest identity regardless (see `authStore.ts`),
 * so the calculator is never blocked waiting on this request — it exists
 * purely as the reconciliation point a future login flow's
 * server-verified session will use.
 */
export async function GET(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const result = await getServerSession(cookieValue);

  return NextResponse.json({
    authenticated: result.userId !== null,
    userId: result.userId,
  });
}
