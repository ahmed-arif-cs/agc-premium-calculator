"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { AuthContext } from "@/contexts/auth-context";
import {
  getAuthServerSnapshot,
  getAuthSnapshot,
  setAuthSession,
  subscribeAuth,
} from "@/lib/auth/authStore";
import type { AuthContextValue, AuthSession, AuthStatus } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapSupabaseUser } from "@/lib/supabase/mapUser";
import {
  signInWithGithub as startGithubSignIn,
  signInWithGoogle as startGoogleSignIn,
} from "@/lib/supabase/oauth";

interface SessionProviderProps {
  children: ReactNode;
}

/** Maps a Supabase browser session onto this project's local `AuthSession` shape. */
function toAuthSession(supabaseSession: SupabaseSession): AuthSession {
  return {
    user: mapSupabaseUser(supabaseSession.user),
    token: supabaseSession.access_token,
    expiresAt: supabaseSession.expires_at
      ? new Date(supabaseSession.expires_at * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Reads a one-shot `auth_error`/`auth` query param left by
 * `src/app/auth/callback/route.ts`, surfaces it, and strips it from the
 * URL so a page refresh doesn't re-trigger it.
 */
function consumeAuthRedirectParams(): { error: string | null } {
  if (typeof window === "undefined") return { error: null };
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");
  const hasAuthMarker = params.has("auth") || authError !== null;
  if (!hasAuthMarker) return { error: null };

  params.delete("auth_error");
  params.delete("auth");
  const rest = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`
  );
  return { error: authError };
}

/**
 * Root auth/session provider.
 *
 * Mount once near the app root (see `src/app/layout.tsx`), alongside the
 * existing `SettingsApplier`/`PWARegister`. Responsibilities:
 *
 * 1. Reads the local, `localStorage`-backed auth record (guest id + any
 *    cached account session) via `useSyncExternalStore`, so it's SSR-safe
 *    and stays in sync across tabs — the same pattern `useSettings.ts`
 *    and `useHistory.ts` already established in this project.
 * 2. **Session restore**: once mounted, checks the Supabase browser
 *    client's own cookie-backed session (`supabase.auth.getSession()`)
 *    and, if one exists (e.g. the user signed in with Google on a
 *    previous visit, or just landed back from `/auth/callback`), adopts
 *    it into the local `authStore` via `setSession()`. This never blocks
 *    rendering: the calculator is fully usable in guest mode the instant
 *    the page paints, online or offline, before this check resolves.
 * 3. Subscribes to `supabase.auth.onAuthStateChange()` for the lifetime of
 *    the app, so a sign-in/sign-out in another tab (or the redirect back
 *    from Google) is reflected here immediately without a manual refresh.
 * 4. **Sign in**: `signInWithGoogle()`/`signInWithGithub()` each kick off
 *    Supabase's redirect-based OAuth flow for their provider
 *    (`src/lib/supabase/oauth.ts`'s shared `startOAuthSignIn()`), tracked
 *    via the same `isSigningIn` flag, with any pre-redirect failure
 *    surfaced through the same `error`.
 * 5. **Sign out**: `signOut()` calls Supabase's `auth.signOut()` (best
 *    effort) and always clears the local session, returning the app to
 *    guest mode — the guest id itself is untouched. Works identically
 *    regardless of which provider signed the user in.
 * 6. **Error handling**: `error` surfaces both pre-redirect sign-in
 *    failures and anything Google/GitHub/Supabase reported back to
 *    `/auth/callback` (e.g. the user cancelled the provider's consent
 *    screen), read once via a one-shot `auth_error` query param.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const record = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signingInProvider, setSigningInProvider] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // 1. Local session ping (Task 8 baseline) + 2. Supabase session restore.
  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      const { error: redirectError } = consumeAuthRedirectParams();
      if (redirectError && !cancelled) setError(redirectError);

      try {
        await fetch("/api/auth/session", { cache: "no-store" });
        // This project's own `agc_session` cookie is never issued today —
        // Google sign-in is handled entirely by Supabase's own cookies
        // below. This call exists purely as the local-backend
        // reconciliation point Task 8 established.
      } catch {
        // Offline/unreachable: fall back to the local guest/session
        // record already loaded above. The app must never be blocked by
        // this — guest mode is fully self-contained.
      }

      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const {
            data: { session: supabaseSession },
          } = await supabase.auth.getSession();
          if (!cancelled && supabaseSession) {
            setAuthSession(toAuthSession(supabaseSession));
          }
        } catch {
          // Network/config failure: the local guest/session record
          // (already loaded synchronously above) remains authoritative.
        }
      }

      if (!cancelled) setIsInitializing(false);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // 3. Live sync: Google sign-in completing, sign-out in another tab, or a
  // Supabase-side token refresh — all flow through this one listener.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, supabaseSession) => {
      if (event === "SIGNED_OUT") {
        setAuthSession(null);
        return;
      }
      if (supabaseSession) {
        setAuthSession(toAuthSession(supabaseSession));
        setError(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { cache: "no-store" });
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const {
          data: { session: supabaseSession },
        } = await supabase.auth.getSession();
        setAuthSession(supabaseSession ? toAuthSession(supabaseSession) : null);
      }
    } catch {
      // Best-effort; the local record remains the source of truth.
    }
  }, []);

  const setSession = useCallback((session: AuthSession) => {
    setAuthSession(session);
  }, []);

  // 4. Sign in (Google). GitHub below shares the exact same
  // isSigningIn/error state and pattern — see `signInWithGithub`.
  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setIsSigningIn(true);
    setSigningInProvider("google");
    const result = await startGoogleSignIn();
    if (!result.ok) {
      setError(result.error ?? "Google sign-in failed. Please try again.");
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
    // On success the browser is already navigating to Google — there is
    // nothing further to do here, and this component may unmount before
    // that navigation completes.
  }, []);

  // 4b. Sign in (GitHub) — same shape as `signInWithGoogle`, just a
  // different provider trigger (`startOAuthSignIn()` in oauth.ts is the
  // one shared implementation both call).
  const signInWithGithub = useCallback(async () => {
    setError(null);
    setIsSigningIn(true);
    setSigningInProvider("github");
    const result = await startGithubSignIn();
    if (!result.ok) {
      setError(result.error ?? "GitHub sign-in failed. Please try again.");
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
    // On success the browser is already navigating to GitHub — there is
    // nothing further to do here, and this component may unmount before
    // that navigation completes.
  }, []);

  // 5. Sign out.
  const signOut = useCallback(async () => {
    setError(null);
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // Best-effort — still fall through to clear the local session below
        // so the UI never gets stuck "signed in" if Supabase is unreachable.
      }
    }
    setAuthSession(null);
  }, []);

  const status: AuthStatus = isInitializing
    ? "initializing"
    : record.session
      ? "authenticated"
      : "guest";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: record.session?.user ?? null,
      session: record.session,
      guestId: record.guestId,
      isGuest: status === "guest",
      isAuthenticated: status === "authenticated",
      isInitializing,
      isSigningIn,
      signingInProvider,
      error,
      clearError,
      refreshSession,
      setSession,
      signInWithGoogle,
      signInWithGithub,
      signOut,
    }),
    [
      status,
      record,
      isInitializing,
      isSigningIn,
      signingInProvider,
      error,
      clearError,
      refreshSession,
      setSession,
      signInWithGoogle,
      signInWithGithub,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
