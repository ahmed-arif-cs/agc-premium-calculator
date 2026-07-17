-- ============================================================================
-- Migration: calculator_memory_sync
-- Task 16 (Calculator Memory Cloud Sync)
--
-- Task 13 created `calculator_memory` as a schema-only cloud counterpart to
-- `src/hooks/useCalculator.ts`'s single-slot M+/M-/MR/MC register — nothing
-- wrote to it yet, and it only stored the accumulated `value`. That's not
-- quite enough to mirror the local state exactly: the app distinguishes
-- "memory holds 0 because the user pressed M+ then M-" (`hasMemory: true`,
-- MR/MC enabled) from "memory was never touched" (`hasMemory: false`, MR/MC
-- disabled) — see `MemoryBar.tsx`. This migration adds the one column that
-- distinction needs.
--
-- Purely additive — the existing table, its default/auto-provisioning
-- trigger, and its RLS policies from Task 13 are untouched. `has_value`
-- defaults to `false` so every existing (currently all-default) row keeps
-- meaning exactly what it already meant: no memory value set.
-- ============================================================================

alter table public.calculator_memory
  add column if not exists has_value boolean not null default false;

comment on column public.calculator_memory.has_value is
  'Mirrors useCalculator.ts''s `hasMemory` boolean exactly: true once M+/M- has been pressed at least once since the last MC, independent of whether `value` happens to be 0. Lets MR/MC be enabled/disabled correctly after a cloud restore.';
