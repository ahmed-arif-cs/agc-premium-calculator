/**
 * Server-side session helpers.
 *
 * No real backend auth exists yet — no login/signup endpoints, per this
 * task's scope. `getServerSession()` therefore always resolves to a
 * signed-out result today. It's already wired into
 * `src/app/api/auth/session/route.ts` and `src/middleware.ts` so plugging
 * in real verification later (e.g. reading + verifying a signed JWT,
 * looking up a session row in the database) is a one-function change
 * rather than a re-plumb of the request path.
 */

export const SESSION_COOKIE_NAME = "agc_session";

export interface ServerSessionResult {
  userId: string | null;
}

/**
 * Reads/verifies the session cookie on the server.
 *
 * Placeholder implementation: no cookie is ever issued yet (there is no
 * login flow), so this always returns a signed-out result regardless of
 * input. Deliberately does not decode or trust `cookieValue` yet — that
 * decode/verify step is the integration point for real auth.
 */
export async function getServerSession(
  cookieValue: string | undefined
): Promise<ServerSessionResult> {
  if (!cookieValue) return { userId: null };
  // Future: verify a signed JWT / look up a session row here, e.g.
  //   const claims = await verifySessionToken(cookieValue);
  //   return { userId: claims?.sub ?? null };
  return { userId: null };
}
