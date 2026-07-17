-- ============================================================================
-- Migration: profiles
-- Task 10 (Database schema foundation)
--
-- One row per Supabase auth user, extending `auth.users` (which Supabase
-- manages and does not allow adding arbitrary columns to) with the public
-- profile fields this app actually needs. This mirrors the shape Task 9's
-- `mapSupabaseUser()` (src/lib/supabase/auth.ts) already maps onto, and
-- carries `guest_id` so a future "merge my local history into my account"
-- flow can look up which anonymous localStorage guest record (Task 8's
-- `ahmed-calc:auth:v1`) a newly-signed-up user came from.
--
-- Schema-only: nothing in the app queries this table yet (no login flow
-- exists — see src/lib/auth/README.md and src/lib/supabase/README.md).
-- ============================================================================

create table if not exists public.profiles (
  -- Same id as the auth user; enforces the 1:1 relationship and means a
  -- profile row can never outlive (or be created without) its auth user.
  id uuid primary key references auth.users (id) on delete cascade,

  email text not null,
  full_name text,
  avatar_url text,

  -- Task 8's stable anonymous localStorage id (`guest_<uuid>`), captured at
  -- signup time so a future migration flow can find and merge that guest's
  -- locally-stored history/settings into this account. Unique but nullable:
  -- most signups will carry one, but it's not required to create a profile.
  guest_id text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_not_blank check (btrim(email) <> '')
);

comment on table public.profiles is
  'Public profile data for each Supabase auth user (1:1 with auth.users). Schema-only foundation — no login flow reads/writes this yet.';
comment on column public.profiles.guest_id is
  'Task 8 localStorage guestId this account was created from, if any — lets a future flow merge pre-signup local data.';

create index if not exists profiles_guest_id_idx on public.profiles (guest_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- --- Auto-provisioning -------------------------------------------------
-- Creates a profiles row automatically whenever a new Supabase auth user is
-- created, so the app never has to remember to do this itself (and can't
-- forget to on a future OAuth signup, which never touches app code at all).
-- Reads `guest_id`/`full_name`/`avatar_url` out of the optional metadata a
-- future sign-up call may pass (`options.data`), defaulting to null when
-- absent — never blocks user creation if they're missing.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, guest_id)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'guest_id'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Auto-creates a public.profiles row for every new auth.users row. security definer is required because auth.users triggers run before the new user has any RLS-visible role.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- --- Row Level Security --------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Deliberately no delete policy: a signed-in user deleting their own
-- profile row without also deleting their auth.users row would orphan
-- `calculator_history`/`user_settings` foreign keys in a confusing way.
-- Account deletion, when it ships, should go through Supabase's own admin
-- `auth.users` delete (service-role only), which cascades via the FK above.
