-- ============================================================================
-- Migration: calculator_history_sync
-- Task 15 (History Cloud Sync)
--
-- Task 10 created `calculator_history` as a schema-only cloud counterpart to
-- `src/hooks/useHistory.ts` — nothing wrote to it yet. This migration adds the
-- one column that feature actually needs: a stable link back to the client's
-- own `HistoryItem.id` (generated locally via `genId()`), so the sync layer
-- can `upsert` idempotently instead of re-inserting a duplicate row every
-- time the same local item is synced again (e.g. a debounced re-sync, a
-- second tab, or a page reload).
--
-- Purely additive — the existing table, its indexes, and its RLS policies
-- from Task 10 are untouched. `local_id` is nullable so any row written by
-- something other than the sync layer (there is none today) still satisfies
-- the schema.
-- ============================================================================

alter table public.calculator_history
  add column if not exists local_id text;

comment on column public.calculator_history.local_id is
  'The client-generated HistoryItem.id (see src/hooks/useHistory.ts, genId()) this row mirrors. Lets the History Cloud Sync layer (src/lib/supabase/historySync.ts) upsert idempotently instead of duplicating rows on every re-sync. Null for any row not written by that sync path.';

-- One cloud row per (user, local item) — the key the sync layer's `upsert`
-- targets via `onConflict: "user_id,local_id"`. Postgres treats NULLs as
-- distinct for uniqueness purposes, so this never blocks a hypothetical
-- future row that has no local_id.
create unique index if not exists calculator_history_user_id_local_id_key
  on public.calculator_history (user_id, local_id);
