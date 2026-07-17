-- ============================================================================
-- Migration: favorites
-- Task 13 (Complete the Supabase database)
--
-- Cloud-only table with no local counterpart yet — the app currently has
-- no "star/pin a calculation or conversion" feature anywhere in
-- `src/components/calculator/*`. This is forward-looking schema for that
-- feature once it's built, following the same "schema-only foundation"
-- pattern Task 10 established for `calculator_history`/`user_settings`.
--
-- Deliberately generic enough to cover the two plausible kinds of
-- "favorite" this app could grow without needing a second table:
--   - a starred calculator expression/result (like a pinned history item)
--   - a starred currency or unit conversion pair (e.g. "USD → PKR",
--     "km → mi") for a quick-access shortcut in the Converter panel
-- `kind` discriminates which columns are populated; `check` constraints
-- below enforce that each kind only sets the columns it actually needs.
--
-- Schema-only: nothing in the app reads/writes this table yet.
-- ============================================================================

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),

  -- Owning user. Cascades on account deletion; there is no "guest" row in
  -- this table — anonymous favorites would need to stay local-only until
  -- a user signs in, matching this app's guest-first design (same
  -- rationale as calculator_history).
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Discriminates which of the two favorite "shapes" a row represents.
  kind text not null check (kind in ('calculation', 'conversion')),

  -- --- kind = 'calculation' -----------------------------------------
  -- Mirrors calculator_history's expression/result/label shape, so a
  -- future "star this history item" action can copy a row across
  -- one-to-one without translating field names.
  expression text,
  result text,

  -- --- kind = 'conversion' -------------------------------------------
  -- Mirrors src/lib/converters.ts's ConverterCategory union
  -- ('length' | 'weight' | 'temperature') plus a distinct 'currency'
  -- value for currency-pair favorites (currency codes aren't part of
  -- that union — they're free-form ISO codes sourced from
  -- src/lib/currencyData.ts instead of a fixed CategoryDef).
  conversion_category text
    check (conversion_category in ('length', 'weight', 'temperature', 'currency')),
  -- Unit id (e.g. 'km', 'mi') or currency code (e.g. 'USD', 'PKR')
  -- depending on conversion_category.
  from_unit text,
  to_unit text,

  -- Shared, optional across both kinds: a short user-given nickname for
  -- the favorite (e.g. "Rent split", "Freelance rate"), capped the same
  -- 80 characters as calculator_history.label for consistency.
  label text not null default '' check (char_length(label) <= 80),

  created_at timestamptz not null default now(),

  -- A 'calculation' row must carry a non-blank expression + result and
  -- no conversion columns; a 'conversion' row must carry a category +
  -- both unit/currency codes and no calculation columns. Keeps the two
  -- shapes from ever being mixed or left half-populated.
  constraint favorites_kind_shape check (
    (
      kind = 'calculation'
      and btrim(expression) is not null and btrim(expression) <> ''
      and btrim(result) is not null and btrim(result) <> ''
      and conversion_category is null and from_unit is null and to_unit is null
    )
    or (
      kind = 'conversion'
      and conversion_category is not null
      and btrim(from_unit) is not null and btrim(from_unit) <> ''
      and btrim(to_unit) is not null and btrim(to_unit) <> ''
      and expression is null and result is null
    )
  )
);

comment on table public.favorites is
  'User-starred calculations or unit/currency conversion pairs. Cloud-only forward-looking schema — no starring/favoriting UI exists in the app yet. Schema-only, per this task''s instructions.';
comment on column public.favorites.kind is
  '''calculation'' (starred expression/result, like a pinned history item) or ''conversion'' (starred unit/currency pair for quick access).';

-- The access pattern a future "Favorites" panel would need: "this user's
-- favorites, newest first", optionally filtered by kind.
create index if not exists favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc);
create index if not exists favorites_user_id_kind_idx
  on public.favorites (user_id, kind);

-- --- Row Level Security --------------------------------------------------
alter table public.favorites enable row level security;

drop policy if exists "favorites: select own" on public.favorites;
create policy "favorites: select own"
  on public.favorites for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "favorites: insert own" on public.favorites;
create policy "favorites: insert own"
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "favorites: update own" on public.favorites;
create policy "favorites: update own"
  on public.favorites for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "favorites: delete own" on public.favorites;
create policy "favorites: delete own"
  on public.favorites for delete
  to authenticated
  using (auth.uid() = user_id);
