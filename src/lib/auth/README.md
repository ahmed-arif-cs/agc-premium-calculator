# Authentication foundation

# Authentication foundation

This directory (plus `src/contexts/auth-context.ts`,
`src/components/auth/SessionProvider.tsx`, `src/components/auth/ProtectedRoute.tsx`,
`src/hooks/useAuth.ts`/`useUser.ts`, `src/proxy.ts`, and
`src/app/api/auth/session/route.ts`) is the local, guest-first
**foundation** for a real account system that Task 8 built. **Task 11**
built the first real login method on top of it — Google sign-in via
Supabase (`src/lib/supabase/oauth.ts`, `src/app/auth/callback/route.ts`,
`src/components/calculator/AccountPanel.tsx`) — and **Task 12** added a
second provider, GitHub, on the exact same architecture (same callback
route, same `AuthContextValue` shape, same `AccountPanel` UI pattern) —
without changing any of this foundation's shape or default behavior:
`status` still starts (and stays, unless/until a sign-in succeeds) at
`"guest"`.

## Why guest-first

The calculator is fully-featured with zero account today (calculation
modes, memory, history with import/export in six formats, settings,
currency/unit conversion, PWA install). Authentication must never block
or degrade that. So the architecture is **guest-first**:

- On first load, a stable anonymous `guestId` is minted once and persisted
  forever in `localStorage` (`ahmed-calc:auth:v1`) — it survives sign-out,
  so guest-created data has a consistent owner id to key off of if/when
  cloud sync ships.
- `status` is `"guest"` by default and only becomes `"authenticated"` once
  a real session is adopted via `setSession()` — as of Task 11 (Google)
  and Task 12 (GitHub), that happens automatically after a successful
  sign-in with either provider (see `SessionProvider`'s Supabase
  `onAuthStateChange`/`getSession()` wiring, which is identical for both).
- Every network call this layer makes (`/api/auth/session`, and now the
  Supabase session checks) is best-effort and non-blocking; failures
  silently fall back to the local guest record, and any user-facing
  failure is surfaced through `useAuth().error` instead of breaking
  anything.

## Pieces and how they fit together

| Piece | File | Role |
|---|---|---|
| Types | `src/lib/auth/types.ts` | `AuthStatus`, `AuthUser`, `AuthSession`, `AuthContextValue` — the whole contract. Task 11 added `signInWithGoogle`, `isSigningIn`, `error`, `clearError`. Task 12 added `signInWithGithub` and `signingInProvider`. |
| Local store | `src/lib/auth/authStore.ts` | `localStorage`-backed record (`guestId` + `session`), `useSyncExternalStore`-compatible, same pattern as `useSettings.ts`/`useHistory.ts`. Unchanged by Task 11 or 12 — `SessionProvider` still writes to it via `setAuthSession()`, now from a Google or GitHub session instead of nothing. |
| Server session stub | `src/lib/auth/session.ts` | `getServerSession()` — still always signed-out; unrelated to Google/GitHub sign-in, both of which are tracked entirely via Supabase's own session cookies instead (see `src/lib/supabase/`). Kept as-is; a future server-rendered/protected route can wire it to `getSupabaseServerUser()`. |
| Route registry | `src/lib/auth/routes.ts` | Single list of account-only route prefixes (still empty — no route is account-gated). |
| Edge proxy | `src/proxy.ts` | Redirects unauthenticated requests away from protected route prefixes. Still a no-op (empty registry, scoped `matcher`) — unaffected by Task 11 or 12. |
| Session API | `src/app/api/auth/session/route.ts` | `GET` reconciliation endpoint `SessionProvider` calls on mount. Unchanged by Task 11 or 12 (still always reports the `agc_session` cookie as absent) — Google/GitHub session state is checked separately via the Supabase browser client. |
| Context definition | `src/contexts/auth-context.ts` | Bare `createContext<AuthContextValue \| undefined>()`. |
| Provider | `src/components/auth/SessionProvider.tsx` | The state machine, mounted once in `src/app/layout.tsx`. Task 11 added Google sign-in/out, Supabase session restore, `onAuthStateChange` live sync, and error handling; Task 12 added `signInWithGithub` reusing the same state and code paths — see `src/lib/supabase/README.md`'s "Google Login (Task 11) + GitHub Login (Task 12)" section for the full breakdown. |
| Hooks | `src/hooks/useAuth.ts`, `src/hooks/useUser.ts` | Consumer-facing API — signature grew (new fields), no breaking changes for existing callers. |
| Route gate | `src/components/auth/ProtectedRoute.tsx` | Client-side conditional render for account-only *sections* of a page. Still unused by any feature. |
| **Account UI** | `src/components/calculator/AccountPanel.tsx` | **(Task 11, extended Task 12)** The actual "Sign in with Google" / "Sign in with GitHub" / signed-in account / sign-out UI, opened from a new topbar button in `src/components/calculator/Calculator.tsx`. Both provider buttons reuse the same `.calc-google-btn` style. |

## What Google Login (Task 11) + GitHub Login (Task 12) deliberately did NOT do

- No password/email/magic-link sign-up — Google and GitHub only.
- No password hashing, JWT signing, or custom OAuth wiring — Supabase's
  own `@supabase/ssr` + `signInWithOAuth`/`exchangeCodeForSession` handle
  all of that; this app only maps the result onto `AuthUser`/`AuthSession`.
- No duplicated sign-in logic — Task 12 reused Task 11's `startOAuthSignIn()`
  helper, callback route, `AuthContextValue` shape, and `AccountPanel` UI
  shell rather than building a second, parallel implementation for GitHub.
- No use of the pre-existing, unrelated Prisma `User` table
  (`prisma/schema.prisma`) — still untouched scaffold from the base template.
- No change to any existing `localStorage` key or its data (history,
  settings, install-dismissed) — the `ahmed-calc:auth:v1` key's *shape*
  is unchanged; it now sometimes actually holds a non-null `session`.
- No account-gated route or feature — `PROTECTED_ROUTE_PREFIXES` is still
  empty, so `src/proxy.ts` and `<ProtectedRoute>` remain no-ops. Signing
  in with Google or GitHub today only changes what `AccountPanel` shows;
  it doesn't unlock or restrict anything else in the calculator.
