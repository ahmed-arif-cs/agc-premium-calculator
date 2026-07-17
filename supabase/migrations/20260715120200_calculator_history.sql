-- ============================================================================
-- Migration: calculator_history
-- Task 10 (Database schema foundation)
--
-- Cloud counterpart to the local, per-browser history already implemented
-- in `src/hooks/useHistory.ts` (localStorage key `ahmed-calc:history:v1`).
-- Column names/types intentionally mirror that hook's `HistoryItem` shape
-- (expression, result, label, timestamp) so a future sync feature can map
-- one-to-one between the local record and this row without translation.
--
-- Schema-only: nothing in the app reads/writes this table yet. The
-- localStorage-backed history remains the sole source of truth today.
-- ============================================================================

create table if not exists public.calculator_history (
  id uuid primary key default gen_random_uuid(),

  -- Owning user. Cascades on account deletion; there is no "guest" row in
  -- this table — anonymous history stays local-only (localStorage) until a
  -- user actually signs in, matching this app's guest-first design.
  user_id uuid not null references auth.users (id) on delete cascade,

  expression text not null,
  result text not null,
  -- Matches useHistory.ts's `label.slice(0, 80)` cap on the client; enforced
  -- again here since a future sync path may write directly from an API
  -- route rather than through that client-side helper.
  label text not null default '' check (char_length(label) <= 80),

  -- Mirrors `HistoryItem.timestamp` (client epoch-ms "when calculated"),
  -- stored as a real timestamptz so it sorts/queries naturally in SQL.
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint calculator_history_expression_not_blank check (btrim(expression) <> ''),
  constraint calculator_history_result_not_blank check (btrim(result) <> '')
);

comment on table public.calculator_history is
  'Cloud-synced calculation history, one row per calculation. Mirrors the local useHistory.ts localStorage model. Schema-only — no app code writes to this table yet.';

-- The two access patterns a future sync/history-panel feature will need:
-- "this user's history, newest first" (list/paginate) and per-row lookup
-- (already covered by the primary key).
create index if not exists calculator_history_user_id_occurred_at_idx
  on public.calculator_history (user_id, occurred_at desc);

-- --- Row Level Security --------------------------------------------------
alter table public.calculator_history enable row level security;

drop policy if exists "calculator_history: select own" on public.calculator_history;
create policy "calculator_history: select own"
  on public.calculator_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "calculator_history: insert own" on public.calculator_history;
create policy "calculator_history: insert own"
  on public.calculator_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "calculator_history: update own" on public.calculator_history;
create policy "calculator_history: update own"
  on public.calculator_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "calculator_history: delete own" on public.calculator_history;
create policy "calculator_history: delete own"
  on public.calculator_history for delete
  to authenticated
  using (auth.uid() = user_id);
