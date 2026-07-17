import "server-only";

/**
 * Shared Supabase auth utilities.
 *
 * `mapSupabaseUser()` (implementation now in `./mapUser`, re-exported here)
 * maps a Supabase session onto this project's existing `AuthUser`/
 * `AuthSession` shape (`src/lib/auth/types.ts`), and `getSupabaseServerUser()`
 * reads it server-side. **Task 11 (Google Login)** wired the client-side
 * half of this into `SessionProvider` — see `src/lib/supabase/oauth.ts`
 * (`signInWithGoogle()`) and `src/app/auth/callback/route.ts` (the shared
 * OAuth redirect handler). **Task 12 (GitHub Login)** added
 * `signInWithGithub()` on the exact same architecture — same callback
 * route, same `mapSupabaseUser()`/`mapProvider()`, same `AuthContextValue`
 * shape — so this file needed no changes beyond this comment. This file's
 * `getSupabaseServerUser()` itself remains
 * read-only/side-effect-free and isn't called by the client flow (which
 * uses the browser client's `getSession()`/`onAuthStateChange()` directly
 * for session restore) — it's kept as the server-side building block a
 * future server-rendered/protected route can call.
 */

import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";
import { mapSupabaseUser } from "./mapUser";
import type { AuthUser } from "@/lib/auth/types";

export { isSupabaseConfigured };
// Re-exported for backwards compatibility — existing/future server code that
// imports `mapSupabaseUser` from `auth.ts` keeps working unchanged. The
// actual implementation lives in `mapUser.ts` (no `server-only` guard) so
// the client-side sign-in/session-restore flow in `SessionProvider` can use
// the exact same mapping logic.
export { mapSupabaseUser };

/**
 * Reads the current request's Supabase-verified user, if any.
 *
 * Returns `null` (never throws) when no Supabase project is configured
 * (`isSupabaseConfigured()` is false) or when there is no signed-in user —
 * this must stay non-blocking and safe to call speculatively, matching
 * the rest of this project's guest-first auth foundation, where the
 * calculator is always fully usable regardless of account state.
 *
 * Uses `supabase.auth.getUser()` rather than `getSession()`, since
 * `getUser()` revalidates the session against Supabase's servers instead
 * of trusting a potentially-stale local cookie — the recommended check
 * for any server-side code path a future login flow protects.
 */
export async function getSupabaseServerUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return mapSupabaseUser(user);
  } catch {
    // Network/config failure: never let this block a request. Callers
    // should treat `null` the same as "not signed in via Supabase".
    return null;
  }
}
