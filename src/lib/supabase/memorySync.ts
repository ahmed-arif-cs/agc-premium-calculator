/**
 * Calculator Memory Cloud Sync — Supabase read/write layer.
 *
 * Cloud counterpart to `src/hooks/useMemory.ts`'s localStorage store,
 * targeting Task 13/16's `public.calculator_memory` table (see
 * `supabase/migrations/20260715120400_calculator_memory.sql` and
 * `.../20260716100000_calculator_memory_sync.sql` for the `has_value`
 * column this file reads/writes).
 *
 * Design (deliberately mirrors `historySync.ts`'s conventions):
 * - One row per user (`user_id` is the table's primary key, auto-provisioned
 *   at signup — see the Task 13 migration), so this is always a single
 *   `select`/`upsert` on that one row, never a list operation.
 * - `value` is a Postgres `numeric`, which `supabase-js` always serializes
 *   as a `string` — converted to/from `number` at this file's boundary so
 *   nothing above it (`useMemorySync.ts`, `useMemory.ts`) has to think
 *   about that.
 * - Nothing here ever throws. Every function returns a `{ ok: true, ... }`
 *   / `{ ok: false, error }` result, since a sync failure (offline, RLS
 *   misconfiguration, an unconfigured Supabase project) must never break
 *   the calculator or its local-first memory register — it should just
 *   mean the next successful sync catches up.
 * - Guest users never reach this file at all: `useMemorySync.ts` only calls
 *   it once `useAuth().isAuthenticated` is true, so Guest Mode's memory
 *   stays exactly what it always was — localStorage-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { MemoryState } from "@/hooks/useMemory";

type TypedSupabaseClient = SupabaseClient<Database>;
type CalculatorMemoryRow = Database["public"]["Tables"]["calculator_memory"]["Row"];

export type MemorySyncResult = { ok: true } | { ok: false; error: string };

export type MemoryFetchResult =
  | {
      ok: true;
      state: MemoryState;
      /**
       * Task 24 (Multi-device Sync) — the cloud row's `updated_at`
       * (server-clock, bumped by a `before update` trigger on every write —
       * see `20260715120400_calculator_memory.sql`), as an ISO string, or
       * `null` if no row exists yet. Additive: every existing caller that
       * only reads `.state` is unaffected. `useMultiDeviceSync.ts` uses
       * this as a trustworthy, server-issued version marker to detect a
       * change pushed from *another* device without relying on client
       * clocks, which can drift or be wrong.
       */
      updatedAt: string | null;
    }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown memory sync error.";
}

function rowToMemoryState(row: CalculatorMemoryRow): MemoryState {
  return {
    value: Number.parseFloat(row.value) || 0,
    hasMemory: row.has_value,
  };
}

/**
 * Fetches this user's cloud memory row. Auto-provisioning at signup (Task
 * 13's trigger) means a row should always exist, but this still tolerates a
 * missing row (e.g. an account created before that trigger existed) by
 * falling back to the empty/unset state instead of erroring.
 */
export async function fetchCloudMemory(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<MemoryFetchResult> {
  try {
    const { data, error } = await supabase
      .from("calculator_memory")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, state: { value: 0, hasMemory: false }, updatedAt: null };
    return { ok: true, state: rowToMemoryState(data), updatedAt: data.updated_at };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * Upserts this user's memory row with `state`, keyed on the table's
 * `user_id` primary key. Idempotent and safe to call repeatedly/frequently —
 * it always converges on exactly what's passed in.
 */
export async function pushMemoryToCloud(
  supabase: TypedSupabaseClient,
  userId: string,
  state: MemoryState,
): Promise<MemorySyncResult> {
  try {
    const { error } = await supabase.from("calculator_memory").upsert(
      {
        user_id: userId,
        value: String(state.value),
        has_value: state.hasMemory,
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
