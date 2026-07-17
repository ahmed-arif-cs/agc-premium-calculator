-- ============================================================================
-- Migration: favorites_sync
-- Task 18 (Favorites Cloud Sync)
--
-- Task 13 created `favorites` as a schema-only, forward-looking table with
-- no local counterpart — nothing in the app read or wrote to it. This task
-- builds that missing local feature (`src/hooks/useFavorites.ts`, a starred
-- calculation shelf backed by `localStorage`, wired up from the History
-- panel's new star toggle) and layers cloud sync on top, following the
-- exact same convention Task 15 used for `calculator_history`: add one
-- column linking a cloud row back to the client's own locally-generated id,
-- so the sync layer can `upsert` idempotently instead of duplicating rows on
-- every re-sync.
--
-- Purely additive — the existing table, its check constraints, indexes, and
-- RLS policies from Task 13 are untouched. `local_id` is nullable so any row
-- written by something other than the sync layer (there is none today)
-- still satisfies the schema.
-- ============================================================================

alter table public.favorites
  add column if not exists local_id text;

comment on column public.favorites.local_id is
  'The client-generated FavoriteItem.id (see src/hooks/useFavorites.ts, genId()) this row mirrors. Lets the Favorites Cloud Sync layer (src/lib/supabase/favoritesSync.ts) upsert idempotently instead of duplicating rows on every re-sync. Null for any row not written by that sync path.';

-- One cloud row per (user, local item) — the key the sync layer's `upsert`
-- targets via `onConflict: "user_id,local_id"`. Postgres treats NULLs as
-- distinct for uniqueness purposes, so this never blocks a hypothetical
-- future row that has no local_id.
create unique index if not exists favorites_user_id_local_id_key
  on public.favorites (user_id, local_id);
