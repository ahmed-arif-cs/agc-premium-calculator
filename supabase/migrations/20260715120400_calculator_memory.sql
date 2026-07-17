-- ============================================================================
-- Migration: calculator_memory
-- Task 13 (Complete the Supabase database)
--
-- Cloud counterpart to the calculator's single-slot M+/M-/MR/MC memory
-- register, currently held only in-memory (`src/hooks/useCalculator.ts`'s
-- `memory` state — it resets on every page reload and is never persisted,
-- even to localStorage). One row per user (1:1), holding the last-known
-- memory value so a future sync feature could restore it across devices
-- and reloads, exactly the way `user_settings`/`profiles` already work.
--
-- Schema-only: nothing in the app reads/writes this table yet. The
-- in-memory `memory` state in `useCalculator.ts` remains the sole source
-- of truth today, and it keeps resetting on reload exactly as before.
-- ============================================================================

create table if not exists public.calculator_memory (
  -- One memory row per user (1:1), keyed directly on the auth user id —
  -- same pattern as `user_settings`, since a user only ever has exactly
  -- one memory register (M+/M-/MR/MC all operate on a single slot today).
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Stored as numeric (arbitrary precision) rather than float8/double
  -- precision so a large or high-precision result round-trips exactly —
  -- calculator_history.result is stored as text for the same reason
  -- (formatted display string), but this column is a real accumulator
  -- value (M+ / M- add/subtract into it), so it needs to stay numeric.
  value numeric not null default 0,

  updated_at timestamptz not null default now()
);

comment on table public.calculator_memory is
  'Cloud-synced single-slot calculator memory register (M+/M-/MR/MC), one row per user. Mirrors useCalculator.ts''s in-memory `memory` state. Schema-only — no app code writes to this table yet.';
comment on column public.calculator_memory.value is
  'Current accumulated memory value (result of M+ / M- operations). Mirrors useCalculator.ts''s `memory` number state exactly.';

drop trigger if exists set_calculator_memory_updated_at on public.calculator_memory;
create trigger set_calculator_memory_updated_at
  before update on public.calculator_memory
  for each row
  execute function public.set_updated_at();

-- Give every new auth user a default (zeroed) memory row for free, same
-- rationale as profiles/user_settings' auto-provisioning triggers: a
-- future sync flow can always assume exactly one memory row exists per
-- user instead of having to upsert-or-create defensively.
create or replace function public.handle_new_auth_user_memory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.calculator_memory (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_auth_user_memory() is
  'Auto-creates a default (zeroed) public.calculator_memory row for every new auth.users row.';

drop trigger if exists on_auth_user_created_memory on auth.users;
create trigger on_auth_user_created_memory
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user_memory();

-- --- Row Level Security --------------------------------------------------
alter table public.calculator_memory enable row level security;

drop policy if exists "calculator_memory: select own" on public.calculator_memory;
create policy "calculator_memory: select own"
  on public.calculator_memory for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "calculator_memory: insert own" on public.calculator_memory;
create policy "calculator_memory: insert own"
  on public.calculator_memory for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "calculator_memory: update own" on public.calculator_memory;
create policy "calculator_memory: update own"
  on public.calculator_memory for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deliberately no delete policy — same rationale as user_settings: every
-- authenticated user should always have exactly one memory row (the
-- auto-provisioning trigger guarantees this at signup); it cascades away
-- automatically on account deletion via the FK above.
