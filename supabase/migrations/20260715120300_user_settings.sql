-- ============================================================================
-- Migration: user_settings
-- Task 10 (Database schema foundation)
--
-- Cloud counterpart to the local `src/hooks/useSettings.ts` preferences
-- (localStorage key `ahmed-calc:settings:v1`). Columns and allowed values
-- mirror that hook's `Settings`/`ThemeId`/`FontSize` types exactly, so a
-- future sync feature can map one-to-one without translation.
--
-- Schema-only: nothing in the app reads/writes this table yet. The
-- localStorage-backed settings remain the sole source of truth today.
-- ============================================================================

create table if not exists public.user_settings (
  -- One settings row per user (1:1), keyed directly on the auth user id —
  -- same pattern as profiles, and simpler than a surrogate id since a user
  -- can only ever have exactly one settings row.
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Mirrors useSettings.ts's `ThemeId` union exactly.
  theme text not null default 'navy-gold'
    check (theme in ('navy-gold', 'light', 'navy-emerald', 'charcoal-rosegold')),

  -- Mirrors useSettings.ts's `FontSize` union exactly.
  font_size text not null default 'md'
    check (font_size in ('sm', 'md', 'lg')),

  sound_enabled boolean not null default false,

  updated_at timestamptz not null default now()
);

comment on table public.user_settings is
  'Cloud-synced calculator preferences, one row per user. Mirrors the local useSettings.ts localStorage model (theme/fontSize/soundEnabled). Schema-only — no app code writes to this table yet.';

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row
  execute function public.set_updated_at();

-- Give every new auth user a default settings row for free, same rationale
-- as profiles' auto-provisioning trigger: a future sync flow can always
-- assume exactly one settings row exists per user instead of having to
-- upsert-or-create defensively.
create or replace function public.handle_new_auth_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_auth_user_settings() is
  'Auto-creates a default public.user_settings row for every new auth.users row.';

drop trigger if exists on_auth_user_created_settings on auth.users;
create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user_settings();

-- --- Row Level Security --------------------------------------------------
alter table public.user_settings enable row level security;

drop policy if exists "user_settings: select own" on public.user_settings;
create policy "user_settings: select own"
  on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_settings: insert own" on public.user_settings;
create policy "user_settings: insert own"
  on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_settings: update own" on public.user_settings;
create policy "user_settings: update own"
  on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deliberately no delete policy: every authenticated user should always
-- have exactly one settings row (the auto-provisioning trigger guarantees
-- this at signup); removing it would just mean the next read has to fall
-- back to client-side defaults for no real benefit. Cascades away
-- automatically on account deletion via the FK above.
