/**
 * Shared authentication types for the AGC Premium Calculator.
 *
 * The app is still guest-first: every calculator/converter/history/
 * settings feature works fully with zero account required, and that
 * never changes regardless of sign-in state. **Task 11** added real
 * Google sign-in on top of Task 8's guest-mode foundation (see
 * `src/components/auth/SessionProvider.tsx`, `src/lib/supabase/oauth.ts`,
 * `src/app/auth/callback/route.ts`) without altering any of these core
 * shapes — only `AuthContextValue` gained a few fields
 * (`signInWithGoogle`, `isSigningIn`, `error`, `clearError`). **Task 12**
 * added GitHub sign-in as a second provider on the same architecture —
 * `signInWithGithub` reuses the exact same `isSigningIn`/`error` state,
 * callback route, and session-restore/live-sync logic as Google; only one
 * new field was added.
 */

export type AuthStatus =
  /** Session is being hydrated (first paint, before the localStorage +
   *  server check resolves). Never blocks the calculator from rendering. */
  | "initializing"
  /** No account signed in. The default, fully-usable state — every
   *  feature works under a local, anonymous guest identity. */
  | "guest"
  /** A real account session is active. Not reachable yet — reserved for
   *  the future login flow. */
  | "authenticated"
  /** A previously-known session existed but is no longer valid. Reserved
   *  for future use (e.g. an expired token that shouldn't silently
   *  fall back to guest, such as after an explicit security sign-out). */
  | "unauthenticated";

export type AuthProviderKind = "password" | "google" | "apple" | "github";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: AuthProviderKind;
  /** ISO timestamp. */
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  /** ISO timestamp; the session must be treated as invalid at/after this time. */
  expiresAt: string;
  /** Opaque bearer/session token. Never logged, never rendered in the UI. */
  token: string;
}

/**
 * The persisted, local-first auth record — what actually lives in
 * `localStorage` today (see `authStore.ts`). `session` stays `null` until
 * a real login exists.
 */
export interface AuthRecord {
  /**
   * Stable anonymous identifier, minted once per browser/device and kept
   * forever (it survives sign-out). Gives guest-created data (calculation
   * history, settings) a consistent owner id to key off of if/when cloud
   * sync ships, without requiring a migration of today's data.
   */
  guestId: string;
  session: AuthSession | null;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
  guestId: string;
  isGuest: boolean;
  isAuthenticated: boolean;
  /** True while the initial session hydration (localStorage + server ping) is in flight. */
  isInitializing: boolean;
  /** True while a Google/GitHub sign-in redirect is being kicked off (from the moment the
   *  button is pressed until either the browser navigates away, or an error is returned). */
  isSigningIn: boolean;
  /** Which provider `isSigningIn` refers to, so a multi-provider UI (e.g. `AccountPanel`) can
   *  show the right button as loading instead of all of them. `null` whenever `isSigningIn` is
   *  `false`. */
  signingInProvider: "google" | "github" | null;
  /** Most recent sign-in/sign-out error, if any (e.g. Google not configured, user denied
   *  access, network failure). Cleared automatically on the next sign-in attempt. */
  error: string | null;
  /** Dismisses the current `error` without retrying anything. */
  clearError: () => void;
  /** Re-runs server-side session validation (e.g. after a tab regains focus). */
  refreshSession: () => Promise<void>;
  /**
   * Adopts a server-verified session. Called by `SessionProvider` itself
   * once Google sign-in completes (via Supabase's `onAuthStateChange`) —
   * also available for any future login method to reuse directly.
   */
  setSession: (session: AuthSession) => void;
  /**
   * Starts the "Sign in with Google" redirect flow (`src/lib/supabase/oauth.ts`).
   * Resolves once either an error is known or the browser has begun
   * navigating away — never throws. Guest mode remains fully usable
   * regardless of the outcome.
   */
  signInWithGoogle: () => Promise<void>;
  /**
   * Starts the "Sign in with GitHub" redirect flow (`src/lib/supabase/oauth.ts`).
   * Same shape and behavior as `signInWithGoogle` — shares `isSigningIn`/
   * `error` and the same `startOAuthSignIn()` implementation underneath.
   */
  signInWithGithub: () => Promise<void>;
  /** Ends the account session (Google/GitHub + local) and returns the app to guest mode. Never blocks usage. */
  signOut: () => Promise<void>;
}
