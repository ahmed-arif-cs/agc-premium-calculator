/**
 * Supabase environment variable access.
 *
 * FOUNDATION LAYER ONLY — no login/signup flow reads from this yet (see
 * `src/lib/supabase/README.md`). This module exists so that both the
 * browser client (`client.ts`) and the server client (`server.ts`) read
 * their configuration from exactly one place, with one consistent error
 * message if a project isn't configured, instead of each file reaching
 * into `process.env` directly.
 *
 * Nothing in this file throws at import/build time — the app (and its
 * existing guest-first auth foundation from Task 8) must keep working
 * with zero Supabase project configured. Errors only surface if/when
 * something actually tries to create a Supabase client without the
 * required variables set, which today is nothing (no login UI exists).
 *
 * NOTE: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
 * read via *literal* `process.env.NEXT_PUBLIC_...` access (not a helper
 * that does `process.env[name]`) because Next.js only inlines
 * `NEXT_PUBLIC_` variables into the browser bundle when the property
 * name is static at build time. Dynamic bracket access always evaluates
 * to `undefined` in client code, regardless of what's set in Vercel.
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env ` +
        `and fill in your Supabase project's values (see src/lib/supabase/README.md).`
    );
  }
  return value;
}

/** Project URL, e.g. `https://xyzcompany.supabase.co`. Safe to expose to the browser. */
export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Public "anon" key. Safe to expose to the browser (Row Level Security enforces access). */
export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Secret "service role" key. Server-only — bypasses Row Level Security.
 * Never import this from a "use client" file or send it to the browser.
 * Not read by anything yet (no server-side admin operations exist today);
 * provided so a future privileged server action doesn't need to invent
 * its own env accessor.
 */
export function getSupabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", readEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

/**
 * True once a Supabase project's public URL + anon key are both present.
 * Lets callers check availability without triggering the thrown error
 * `getSupabaseUrl()`/`getSupabaseAnonKey()` raise when unset — useful for
 * a future "is cloud sync available" style check that must never crash
 * the guest-first calculator experience.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}