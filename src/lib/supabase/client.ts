"use client";

/**
 * Supabase client for Client Components / the browser.
 *
 * FOUNDATION LAYER ONLY — nothing calls this yet (no login UI exists,
 * per this task's scope). It's the browser-side half of the standard
 * `@supabase/ssr` cookie-based auth pattern for Next.js App Router, ready
 * for a future login/signup flow to import instead of inventing its own
 * `createBrowserClient` call site.
 *
 * Cached as a module-level singleton (matches `@supabase/ssr`'s own
 * recommendation) so repeated calls from different components reuse the
 * same underlying client rather than creating a new one per render.
 */

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Returns the shared browser Supabase client, creating it on first call.
 * Throws if `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * aren't set (see `src/lib/supabase/env.ts`) — check
 * `isSupabaseConfigured()` first if the caller needs to degrade
 * gracefully instead.
 *
 * Typed against `./database.types` (Task 10's schema) so `.from("...")`
 * calls get compile-time table/column checking once a future feature
 * actually starts querying `profiles`/`calculator_history`/`user_settings`.
 */
export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return client;
}
