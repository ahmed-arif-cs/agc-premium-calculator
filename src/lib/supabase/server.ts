import "server-only";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * FOUNDATION LAYER ONLY — nothing calls this yet (no login UI exists, per
 * this task's scope). This is the server-side half of the standard
 * `@supabase/ssr` cookie-based auth pattern for Next.js App Router: it
 * reads/writes Supabase's auth cookies through `next/headers`'s
 * `cookies()` (async in this project's installed Next.js version, 16.x),
 * so a future login flow gets session persistence for free instead of
 * reinventing cookie plumbing.
 *
 * `import "server-only"` guards against this ever being pulled into a
 * client bundle by mistake (it would otherwise be an easy way to leak the
 * service-role-adjacent server config into the browser).
 *
 * A fresh client is created per call rather than cached as a module-level
 * singleton — this mirrors Supabase's own guidance for the server case,
 * since a cached client would otherwise capture one request's cookies and
 * incorrectly reuse them for a later, different request.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";
import type { Database } from "./database.types";

/**
 * Creates a request-scoped Supabase client bound to the current Server
 * Component / Route Handler / Server Action's cookies.
 * Throws if `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * aren't set (see `src/lib/supabase/env.ts`) — check
 * `isSupabaseConfigured()` first if the caller needs to degrade
 * gracefully instead.
 *
 * Typed against `./database.types` (Task 10's schema) so `.from("...")`
 * calls get compile-time table/column checking once a future feature
 * actually starts querying `profiles`/`calculator_history`/`user_settings`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` was called from a Server Component, where cookies
          // can only be read, not written. Safe to ignore here as long
          // as a future Route Handler / Server Action (or middleware) is
          // what actually performs sign-in/sign-out and writes the
          // session cookie — that pattern isn't wired in yet since this
          // task deliberately stops short of implementing login.
        }
      },
    },
  });
}
