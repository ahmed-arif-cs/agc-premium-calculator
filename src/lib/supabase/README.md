# Supabase integration

This directory holds the project's Supabase client plumbing, plus (as of
**Task 11**, extended to a second provider in **Task 12**) real Google and
GitHub sign-in flows built on top of it. The app is still guest-first by
design: every calculator/converter/history/settings feature works fully
with zero account, and that never changes — signing in with Google or
GitHub is a purely additive, opt-in layer alongside Task 8's local,
guest-first foundation (`src/lib/auth/`, `src/contexts/auth-context.ts`,
`src/components/auth/`).

## Why this stays separate from Task 8's local auth foundation

Task 8 built a local-first, `localStorage`-backed guest/session
architecture with no real backend. This directory adds the *other*
half — a real Supabase project's client plumbing and (since Task 11,
joined by GitHub in Task 12) actual OAuth flows — without replacing any
of that. The two layers are bridged in exactly one place:
`src/components/auth/SessionProvider.tsx` adopts a verified Supabase
session into Task 8's local `authStore` via `setSession()`, so every
existing `useAuth()`/`useUser()` consumer works unchanged regardless of
which provider the session came from.

## Setup

1. Create a project at [supabase.com](https://supabase.com) (or use an
   existing one).
2. Copy `.env.example` to `.env` and fill in the three values from your
   project's **Project Settings → API** page:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose this to the browser)
3. Leaving all three blank is also supported — every helper in this
   directory degrades to "not configured" (see `isSupabaseConfigured()`)
   rather than crashing the app, and the "Sign in with Google"/"Sign in
   with GitHub" buttons show a friendly error instead of doing nothing.
4. **To enable Google sign-in specifically:** in the Supabase dashboard,
   go to **Authentication → Providers → Google**, enable it, and fill in
   a Google Cloud OAuth Client ID/Secret (see Supabase's own
   [Google provider guide](https://supabase.com/docs/guides/auth/social-login/auth-google)).
5. **To enable GitHub sign-in specifically (Task 12):** in the Supabase
   dashboard, go to **Authentication → Providers → GitHub**, enable it,
   and fill in a GitHub OAuth App's Client ID/Secret (created under
   GitHub **Settings → Developer settings → OAuth Apps**; see Supabase's
   own [GitHub provider guide](https://supabase.com/docs/guides/auth/social-login/auth-github)).
6. Under **Authentication → URL Configuration**, add
   `<your-app-origin>/auth/callback` (e.g. `http://localhost:3000/auth/callback`
   in development, plus your production origin) to **Redirect URLs** —
   this project's callback route (`src/app/auth/callback/route.ts`) is
   already built to receive Supabase's redirect there, and is shared by
   both providers (no per-provider callback route needed).

## Pieces

| Piece | File | Role |
|---|---|---|
| Environment variables | `env.ts` | The one place `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are read, with one consistent error message and an `isSupabaseConfigured()` check that never throws. |
| Browser client | `client.ts` | `createClient()` — a `"use client"` singleton for Client Components, via `@supabase/ssr`'s `createBrowserClient`. Used by `oauth.ts` and `SessionProvider` for the sign-in/session-restore flow. |
| Server client | `server.ts` | `createClient()` — an async, request-scoped client for Server Components/Route Handlers/Server Actions, via `@supabase/ssr`'s `createServerClient` bound to `next/headers`'s (async, Next 16) `cookies()`. Guarded with `import "server-only"`. Used by `src/app/auth/callback/route.ts` to exchange the OAuth code and write the resulting session cookies. |
| User mapping | `mapUser.ts` | `mapSupabaseUser()`/`mapProvider()` — maps a Supabase `User` onto this project's `AuthUser` shape (`src/lib/auth/types.ts`). Deliberately **not** `server-only` (unlike `auth.ts`) so both the client-side sign-in flow and server code can share one implementation. |
| Shared server auth utilities | `auth.ts` | Re-exports `mapSupabaseUser`/`isSupabaseConfigured`, plus `getSupabaseServerUser()` (reads the current request's Supabase-verified user via `supabase.auth.getUser()`). Read-only, side-effect-free; a building block for a future server-rendered/protected route. |
| **OAuth triggers** | `oauth.ts` | **(Task 11, extended Task 12)** One shared `startOAuthSignIn(provider, label, queryParams?)` implementation, plus two thin wrappers: `signInWithGoogle()` and `signInWithGithub()` — both `"use client"`, both call `supabase.auth.signInWithOAuth({ provider })`, which redirects the browser to the provider and back to `/auth/callback`. Both return `{ ok, error }` for any *pre-redirect* failure (not configured, provider rejected, network error); the real outcome after a successful redirect surfaces via `onAuthStateChange` once the browser returns. Adding a third provider means adding one more thin wrapper here, not a new copy of the flow. |
| **OAuth callback route** | `../../app/auth/callback/route.ts` | **(Task 11, shared by Task 12)** One Route Handler every provider redirects back to — Google and GitHub alike, since `exchangeCodeForSession` doesn't need to know which provider issued the code. Exchanges the `code` query param for a session, which is what actually lets `server.ts`'s cookie adapter write the Supabase session cookies (Server Components can only read cookies — a Route Handler can write them). Redirects to `/?auth=success` or `/?auth_error=<message>`, never renders anything itself. |
| Database types | `database.types.ts` | Hand-written `Database` type matching `supabase/migrations/` (Task 10's `profiles`/`calculator_history`/`user_settings`, extended in Task 13 with `calculator_memory`/`favorites`). Passed as the generic to `createBrowserClient`/`createServerClient` in `client.ts`/`server.ts` for compile-time `.from("...")` checking. Regenerate for real with `npx supabase gen types typescript --linked` once a project is linked. |

## Google Login (Task 11) + GitHub Login (Task 12)

`src/components/auth/SessionProvider.tsx` is where the whole flow is
wired together, for both providers identically:

- **Sign in** — `useAuth().signInWithGoogle()`/`signInWithGithub()` call
  `oauth.ts`'s `signInWithGoogle()`/`signInWithGithub()` (both thin
  wrappers around the same `startOAuthSignIn()`), tracked via the shared
  `useAuth().isSigningIn` flag plus `useAuth().signingInProvider`
  (`"google" | "github" | null`) so a multi-provider UI like
  `AccountPanel` can show the right button as loading.
- **Sign out** — `useAuth().signOut()` calls `supabase.auth.signOut()`
  (best-effort) and always clears the local session, returning the app to
  guest mode — the same code path regardless of which provider signed the
  user in. The guest id itself is untouched, matching Task 8's design.
- **Session restore** — on mount, `SessionProvider` checks
  `supabase.auth.getSession()` (the browser client's own cookie-backed
  session) and adopts it into the local `authStore` if present — so a
  returning signed-in user (Google or GitHub) is recognized without doing
  anything. This never blocks the calculator from rendering in guest mode
  first.
- **Live sync** — `supabase.auth.onAuthStateChange()` keeps the local
  session in sync for the app's whole lifetime (sign-in completing,
  sign-out in another tab, a token refresh) — provider-agnostic.
- **Loading state** — `useAuth().isInitializing` (the same field Task 8
  already exposed) covers session restore; `useAuth().isSigningIn` +
  `signingInProvider` cover a redirect being kicked off.
- **Error handling** — `useAuth().error` (+ `clearError()`) surfaces both
  pre-redirect failures and anything the provider/Supabase reported back
  to `/auth/callback` (e.g. the user cancelled the consent screen), read
  once via a one-shot `auth_error` query param and then stripped from the URL.
- **UI** — `src/components/calculator/AccountPanel.tsx`, opened from a
  new account button in the calculator's topbar
  (`src/components/calculator/Calculator.tsx`). Both providers render
  through the exact same `.calc-google-btn` button style, wrapped in a
  `.calc-oauth-btn-group` layout container.
- **Provider mapping** — `mapUser.ts`'s `mapProvider()` already had a
  `"github"` case reserved since Task 9/11 (`AuthProviderKind` includes
  `"github"`), so `mapSupabaseUser()` needed zero changes to correctly tag
  a GitHub-signed-in user's `AuthUser.provider`.

Nothing about Task 8's `getServerSession()`/`agc_session` cookie stub
changed — Google/GitHub sign-in is handled entirely through Supabase's
own session cookies (via `@supabase/ssr`), not that placeholder. It
remains available for a future server-rendered/protected route to plug
real verification into (e.g. by calling `getSupabaseServerUser()` from
`auth.ts`), exactly as before.

## Database schema (Task 10, completed in Task 13)

A full Postgres schema — `profiles`, `calculator_history`, `user_settings`,
`calculator_memory`, and `favorites` — their relationships, and Row Level
Security — exists as SQL migrations under
[`supabase/migrations/`](../../../supabase/migrations) at the project
root, with a walkthrough in [`supabase/README.md`](../../../supabase/README.md).
Task 10 shipped the first three tables; Task 13 completed the set with
`calculator_memory` (cloud counterpart to the M+/M-/MR/MC memory
register) and `favorites` (forward-looking schema for a starred
calculation/conversion feature that doesn't exist in the UI yet).
**This remains schema-only**: no app code queries any of these tables
yet, and per Task 13's explicit instruction no local data has been
migrated into them — `useHistory.ts`, `useSettings.ts`, and
`useCalculator.ts`'s in-memory `memory` state remain the sole source of
truth for calculator data, exactly as before. A signed-in user's
`profiles`, `user_settings`, and `calculator_memory` rows are all
auto-provisioned by the schema's own triggers the moment Supabase creates
their `auth.users` row (i.e. on their very first Google or GitHub
sign-in) — this project's application code doesn't need to (and doesn't)
do anything extra for that to happen. See that README for the full
table-by-table breakdown and what a future sync feature would need to
build on top of it.

## What Google/GitHub Login deliberately does NOT do (Tasks 11–12)

- No password/email sign-up form, magic-link, or any other provider —
  Google and GitHub only, per these tasks' scope.
- No per-provider duplication — `oauth.ts`'s `startOAuthSignIn()`, the
  `/auth/callback` route, `mapUser.ts`'s mapping, and `AccountPanel`'s
  button styling are each one shared implementation used by both
  providers, not two parallel copies.
- No querying/writing `profiles`/`calculator_history`/`user_settings`/
  `calculator_memory`/`favorites` (Tasks 10 and 13's schema) from
  application code — a signed-in user's calculator history/settings/
  memory still live in `localStorage`/component state only, exactly as
  before. A future "sync to your account" feature is what would start
  reading/writing those tables.
- No changes to `PROTECTED_ROUTE_PREFIXES` (`src/lib/auth/routes.ts`) —
  the calculator remains a single fully-public route; nothing is
  account-gated.
- No changes to `src/lib/auth/session.ts`'s `getServerSession()` stub or
  the `agc_session` cookie — both providers' sessions are tracked entirely
  via Supabase's own cookies instead.

