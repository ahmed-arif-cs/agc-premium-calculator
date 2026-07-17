-- ============================================================================
-- Migration: helpers
-- Task 10 (Database schema foundation) — shared extensions + trigger function
-- used by every table added in this migration set. No app tables yet.
-- ============================================================================

-- gen_random_uuid() — used as the default id generator for calculator_history.
-- Enabled defensively; Supabase projects ship with pgcrypto available by
-- default, but this keeps the migration self-contained and re-runnable on a
-- bare Postgres instance.
create extension if not exists pgcrypto;

-- Generic "bump updated_at to now() on any UPDATE" trigger function, shared
-- by profiles and user_settings below instead of duplicating the same
-- five-line function per table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared BEFORE UPDATE trigger function: sets updated_at = now() on every row update. Used by profiles and user_settings.';
