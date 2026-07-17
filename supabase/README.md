# Database schema (Task 10, completed in Task 13)

SQL migrations for this project's Supabase Postgres schema. **Schema-only
foundation**, matching the pattern set by Task 8 (local auth foundation)
and Task 9 (Supabase client foundation): the tables, relationships, and
Row Level Security policies below exist and are ready to apply to a real
Supabase project, but **no application code queries them yet**. The
calculator's actual data — history, settings, and the M+/M- memory
register — still lives entirely in `localStorage` / component state via
`src/hooks/useHistory.ts` / `useSettings.ts` / `useCalculator.ts`, and the
app is fully usable with zero Supabase project configured, exactly as
before.

Task 10 introduced `profiles`, `calculator_history`, and `user_settings`.
Task 13 completed the schema with two more tables — `calculator_memory`
and `favorites` — following the exact same schema-only, RLS-first
conventions (auto-provisioning triggers, `on delete cascade`, owner-scoped
policies restricted to the `authenticated` role). Local data has
deliberately **not** been migrated to any of these tables yet, per this
task's instructions — that remains a distinct, future "sync" feature.

## Tables

### `profiles`
One row per Supabase auth user (1:1 with `auth.users`, same primary key,
`on delete cascade`). Holds the public profile fields Task 9's
`mapSupabaseUser()` already maps a Supabase `User` onto (`email`,
`full_name`, `avatar_url`), plus `guest_id` — Task 8's stable anonymous
`localStorage` id (`guest_<uuid>`) — so a future "merge my local data into
my account" flow can trace a new signup back to the guest record it came
from. **Auto-provisioned**: an `after insert on auth.users` trigger
(`handle_new_auth_user`) creates the matching profile row automatically,
so no application code ever has to remember to do it (including on a
future OAuth signup, which never touches app code at all).

### `calculator_history`
Cloud counterpart to `useHistory.ts`'s `HistoryItem`. Many rows per user
(`user_id references auth.users`, `on delete cascade`). Column names —
`expression`, `result`, `label`, `occurred_at` — deliberately mirror that
hook's shape so a future sync feature can map one-to-one without
translating field names. Indexed on `(user_id, occurred_at desc)` for the
"this user's history, newest first" query a history panel would need.

### `user_settings`
Cloud counterpart to `useSettings.ts`'s `Settings`. One row per user
(`user_id` is itself the primary key — simpler than a surrogate id for a
strict 1:1). `theme`/`font_size` are constrained with `check` clauses to
the exact same value sets as the `ThemeId`/`FontSize` TypeScript unions,
so an invalid value can't reach the database even from a future API route
that doesn't go through the client's type checking. Also
auto-provisioned, with a default row created on signup
(`handle_new_auth_user_settings`).

### `calculator_memory`
Cloud counterpart to the calculator's single-slot M+/M-/MR/MC memory
register (`useCalculator.ts`'s in-memory `memory` state, which today
resets on every reload and is never persisted anywhere). One row per user
(1:1, `user_id` is the primary key — same pattern as `user_settings`).
`value` is `numeric` (not `float8`) so a large or precise accumulated
value round-trips exactly. Also auto-provisioned with a zeroed default
row on signup (`handle_new_auth_user_memory`).

### `favorites`
Forward-looking, cloud-only schema for a "star a calculation or
conversion" feature that doesn't exist in the UI yet — there's no local
counterpart to mirror. Many rows per user. A `kind` column
(`'calculation' | 'conversion'`) discriminates between a starred
expression/result pair (mirrors `calculator_history`'s shape) and a
starred unit/currency conversion pair (`conversion_category` +
`from_unit`/`to_unit`, covering `src/lib/converters.ts`'s
`length`/`weight`/`temperature` categories plus a `'currency'` case for
currency-code pairs sourced from `src/lib/currencyData.ts`). A `check`
constraint (`favorites_kind_shape`) enforces that each row only populates
the columns its `kind` actually uses, so the two shapes can never be
mixed or left half-filled.

## Relationships

```
auth.users (Supabase-managed)
   │ 1:1 (cascade)   │ 1:many (cascade)     │ 1:1 (cascade)   │ 1:1 (cascade)     │ 1:many (cascade)
   ▼                  ▼                      ▼                 ▼                   ▼
profiles      calculator_history      user_settings    calculator_memory      favorites
  id (PK)       user_id (FK)            user_id (PK,FK)  user_id (PK, FK)      user_id (FK)
  guest_id      expression/result/label theme/font_size  value (numeric)       kind, expression/result
                                        /sound_enabled                         or category/from/to unit
```

Every foreign key cascades on delete: removing an `auth.users` row (the
only supported account-deletion path — via Supabase's admin API,
service-role only) cleanly removes that user's profile, history,
settings, memory value, and favorites, with no orphaned rows and no
application code needed.

## Row Level Security

RLS is enabled on all five tables. Every policy is scoped to `auth.uid()`
matching the row's owner (`id` for `profiles`, `user_id` for the other
four) and restricted to the `authenticated` role — an unauthenticated
(anon-key, signed-out) request can read or write none of these tables,
matching this app's guest-first design where anonymous usage never
touches Supabase at all.

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `profiles` | own row | own row | own row | — (cascades from `auth.users` instead) |
| `calculator_history` | own rows | own rows | own rows | own rows |
| `user_settings` | own row | own row | own row | — (one row per user is guaranteed by the signup trigger) |
| `calculator_memory` | own row | own row | own row | — (one row per user is guaranteed by the signup trigger) |
| `favorites` | own rows | own rows | own rows | own rows |

No policy grants access to another user's row under any circumstance —
there's no "shared" or "public" data in this schema. The `service_role`
key (`SUPABASE_SERVICE_ROLE_KEY`, server-only, from Task 9's `env.ts`)
bypasses RLS entirely, as Supabase always allows; nothing in the app uses
the service-role client today.

## Applying the migrations

These are plain, ordered SQL files under `supabase/migrations/`, written
for the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
# Link once to your project (find <project-ref> in Project Settings → General)
npx supabase link --project-ref <project-ref>

# Apply every migration in this folder, in filename order
npx supabase db push
```

Or run each `.sql` file directly against your project's Postgres
connection (e.g. via the Supabase Dashboard's SQL Editor) in filename
order — they're plain, idempotent-where-practical SQL (`create table if
not exists`, `create or replace function`, `drop policy/trigger if
exists` before each `create`), so re-running the set is safe.

| File | Adds |
|---|---|
| `20260715120000_helpers.sql` | `pgcrypto` extension, shared `set_updated_at()` trigger function |
| `20260715120100_profiles.sql` | `profiles` table, its indexes, its auto-provisioning trigger, its RLS policies |
| `20260715120200_calculator_history.sql` | `calculator_history` table, its index, its RLS policies |
| `20260715120300_user_settings.sql` | `user_settings` table, its auto-provisioning trigger, its RLS policies |
| `20260715120400_calculator_memory.sql` | `calculator_memory` table, its auto-provisioning trigger, its RLS policies |
| `20260715120500_favorites.sql` | `favorites` table, its indexes, its RLS policies |

## Regenerating TypeScript types

`src/lib/supabase/database.types.ts` is hand-written to match these
migrations exactly (this sandbox has no live/linked Supabase project to
generate from). Once a real project is linked and these migrations are
applied to it, regenerate the real thing with:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

`src/lib/supabase/client.ts` and `server.ts` already pass this file's
`Database` type as the generic to `createBrowserClient`/`createServerClient`
(updated in this task), so a regeneration is a drop-in replacement — no
other file needs to change.

## Multi-device Sync (Task 24)

By Task 22, every table above already had a full read/write layer
(`src/lib/supabase/{historySync,memorySync,settingsSync,favoritesSync}.ts`)
and an orchestration hook (`use{History,Memory,Settings,Favorites}Sync`,
all mounted once in `src/components/SettingsApplier.tsx`) that pushes local
changes to the cloud on a short debounce and restores cloud data once per
signed-in session. That covers "my data follows me when I sign in
somewhere new" — it does not cover two devices *already* signed in at the
same time, since neither one is told about the other's push until it
restores again (i.e. next sign-in).

Task 24 adds `src/hooks/useMultiDeviceSync.ts`, mounted alongside the four
hooks above, to close that gap: while signed in, it periodically (and on
tab-focus/visibility/reconnect) re-fetches all four tables and reconciles
them into local state — no schema change was needed, since the two
single-row tables (`user_settings`, `calculator_memory`) already had the
`updated_at` column (with its `set_updated_at()` trigger) this needed.

**Conflict resolution rules:**
- `calculator_history` / `favorites` (lists) — reconciled via each store's
  existing id-preserving `mergeCloudItems()` union merge. This can only
  ever *add* an item neither side already had; it never overwrites or
  drops a local edit, so a periodic check can't destructively clobber
  anything, regardless of how many devices are editing concurrently.
- `user_settings` / `calculator_memory` (single row per user) —
  **last-write-wins by the row's own `updated_at`**, which is a
  Postgres-trigger-maintained, server-clock timestamp rather than a
  client clock (client clocks can drift or be wrong across devices, which
  would make "which edit is newest" ambiguous or exploitable). Whenever a
  fetch returns a row whose `updated_at` is newer than the last one this
  device has seen, that row's value is applied locally — but only if it
  actually differs from what's already local, so an unrelated device's
  read-only fetch is never reported as a "sync" that changed nothing.

Guest Mode and authentication are both untouched by this: the new hook's
every effect starts with `if (!userId || !configured) return;` (identical
guard to the four existing sync hooks), so it never runs at all for a
guest, and it only ever *reads* `useAuth()`'s existing contract — no file
under `src/lib/auth/`, `src/contexts/auth-context.ts`, or
`src/components/auth/` was touched.

## What this task (and Task 13) deliberately did NOT do

- Did not apply these migrations to any live Supabase project (this
  sandbox has no Supabase project to link).
- Did not migrate any existing local data into `calculator_history`,
  `user_settings`, or `calculator_memory` — per Task 13's explicit
  instruction, local data stays local for now. `useHistory.ts`,
  `useSettings.ts`'s `localStorage` persistence, and `useCalculator.ts`'s
  in-memory `memory` state are all completely unchanged and remain the
  only things the app reads from today.
- Did not wire any application code to actually query any of the five
  tables (`profiles`/`calculator_history`/`user_settings`/
  `calculator_memory`/`favorites`).
- Did not build any "starred/favorite" UI anywhere in the app —
  `favorites` is a forward-looking table with no feature behind it yet.
- Did not touch Task 8's local auth foundation (`src/lib/auth/`,
  `src/contexts/auth-context.ts`, `src/components/auth/`,
  `src/proxy.ts`) or Task 9's Supabase client/env/auth-utility files
  (`client.ts`/`server.ts` already had the `Database` generic wired in
  Task 10 and needed no further change for the two new tables).
- Did not add any login/signup UI beyond the existing Google/GitHub OAuth
  flows from Tasks 11–12 (still out of scope for this schema-only task).
- Did not touch the pre-existing, unrelated Prisma `User`/`Post` scaffold
  (`prisma/schema.prisma`, `src/lib/db.ts`, SQLite `DATABASE_URL`) — that
  remains a separate, unused leftover from the base template; this
  schema is Postgres, lives in Supabase, and is reached exclusively
  through `src/lib/supabase/`.
