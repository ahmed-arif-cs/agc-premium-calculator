"use client";

/**
 * Client-side OAuth triggers (Google, GitHub).
 *
 * Both providers kick off the exact same Supabase redirect-based OAuth
 * flow (`signInWithOAuth`), which navigates the browser away to the
 * provider and back to `src/app/auth/callback/route.ts` — this module
 * never receives the signed-in user directly. `SessionProvider`
 * (`src/components/auth/SessionProvider.tsx`) is the single caller for
 * each: it wraps the call in loading/error state and, on return,
 * reconciles the resulting Supabase session into the app's local
 * `authStore` via `supabase.auth.onAuthStateChange()`.
 *
 * `startOAuthSignIn()` below is the one shared implementation — adding a
 * new provider is just a thin wrapper around it (see `signInWithGoogle()`/
 * `signInWithGithub()`), never a second copy of the redirect logic.
 */

import type { Provider } from "@supabase/supabase-js";
import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

export interface OAuthSignInResult {
  ok: boolean;
  /** Human-readable message, set only when `ok` is `false`. */
  error?: string;
}

/**
 * Starts a Supabase redirect-based OAuth flow for `provider`.
 *
 * Resolves with `{ ok: false, error }` for any error that can be detected
 * *before* the redirect (no Supabase project configured, or Supabase
 * rejects the request outright, e.g. the provider isn't enabled on this
 * project). If the redirect itself succeeds, the browser navigates away
 * before this promise would otherwise resolve `{ ok: true }` — the real
 * outcome then surfaces back through `/auth/callback` and the
 * `onAuthStateChange` listener once the browser returns.
 *
 * Shared by every provider-specific sign-in function below so the actual
 * redirect/error-handling logic exists exactly once.
 */
async function startOAuthSignIn(
  provider: Provider,
  providerLabel: string,
  queryParams?: Record<string, string>
): Promise<OAuthSignInResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: `${providerLabel} sign-in isn't set up for this app yet (no Supabase project configured). You can keep using Guest Mode.`,
    };
  }

  try {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(queryParams ? { queryParams } : {}),
      },
    });

    if (error) {
      return {
        ok: false,
        error: error.message || `${providerLabel} sign-in failed. Please try again.`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : `${providerLabel} sign-in failed. Please try again.`,
    };
  }
}

/** Starts the "Sign in with Google" redirect flow. See `startOAuthSignIn()`. */
export async function signInWithGoogle(): Promise<OAuthSignInResult> {
  return startOAuthSignIn("google", "Google", {
    access_type: "offline",
    prompt: "consent",
  });
}

/** Starts the "Sign in with GitHub" redirect flow. See `startOAuthSignIn()`. */
export async function signInWithGithub(): Promise<OAuthSignInResult> {
  return startOAuthSignIn("github", "GitHub");
}
