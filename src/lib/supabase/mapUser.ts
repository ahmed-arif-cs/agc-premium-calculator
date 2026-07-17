/**
 * Supabase `User` → this project's `AuthUser` mapping.
 *
 * Pulled out of `auth.ts` (which is `import "server-only"`-guarded) into
 * its own, plain module so both server code (`auth.ts`,
 * `getSupabaseServerUser()`) and client code (`SessionProvider`, which
 * needs to map the browser-side `supabase.auth.getSession()`/
 * `onAuthStateChange()` payloads) can share one mapping implementation
 * instead of two copies drifting apart.
 */

import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { AuthProviderKind, AuthUser } from "@/lib/auth/types";

/** Maps a Supabase OAuth/identity provider string onto this project's narrower `AuthProviderKind`. */
export function mapProvider(supabaseProvider: string | undefined): AuthProviderKind {
  switch (supabaseProvider) {
    case "google":
      return "google";
    case "apple":
      return "apple";
    case "github":
      return "github";
    default:
      return "password";
  }
}

/**
 * Maps a Supabase `User` onto this project's existing `AuthUser` shape
 * (`src/lib/auth/types.ts`), so both the server-side foundation
 * (`getSupabaseServerUser()`) and the client-side session restore/sign-in
 * flow in `SessionProvider` produce an identically-shaped user regardless
 * of which side of the app read it.
 */
export function mapSupabaseUser(supabaseUser: SupabaseUser): AuthUser {
  const name =
    (typeof supabaseUser.user_metadata?.full_name === "string" &&
      supabaseUser.user_metadata.full_name) ||
    (typeof supabaseUser.user_metadata?.name === "string" && supabaseUser.user_metadata.name) ||
    null;

  const avatarUrl =
    (typeof supabaseUser.user_metadata?.avatar_url === "string" &&
      supabaseUser.user_metadata.avatar_url) ||
    (typeof supabaseUser.user_metadata?.picture === "string" &&
      supabaseUser.user_metadata.picture) ||
    null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? "",
    name,
    avatarUrl,
    provider: mapProvider(supabaseUser.app_metadata?.provider),
    createdAt: supabaseUser.created_at,
  };
}
