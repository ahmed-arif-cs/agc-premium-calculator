/**
 * History Cloud Sync — Supabase read/write layer.
 *
 * Cloud counterpart to `src/hooks/useHistory.ts`'s localStorage store,
 * targeting Task 10/15's `public.calculator_history` table (see
 * `supabase/migrations/20260715120200_calculator_history.sql` and
 * `.../20260716090000_calculator_history_sync.sql` for the `local_id`
 * column this file's upsert relies on).
 *
 * Design:
 * - Every `HistoryItem.id` (see `useHistory.ts`, `genId()`) is written to
 *   the cloud row's `local_id` column. Pushing always `upsert`s on
 *   `(user_id, local_id)`, so re-syncing the same local item in place never
 *   creates a duplicate cloud row.
 * - `pushHistoryToCloud` treats the given list as the **full, current**
 *   local history and mirrors it exactly: it upserts every item, then
 *   deletes any cloud row (for this user) whose `local_id` isn't in that
 *   list. That single operation covers add, edit (label), remove, and
 *   clear-all without needing a separate code path for each.
 * - Nothing here ever throws. Every function returns a `{ ok: true, ... }`
 *   / `{ ok: false, error }` result, since a sync failure (offline, RLS
 *   misconfiguration, an unconfigured Supabase project) must never break
 *   the calculator or its local-first history — it should just mean the
 *   next successful sync catches up.
 * - Guest users never reach this file at all: `useHistorySync.ts` only
 *   calls it once `useAuth().isAuthenticated` is true, so Guest Mode's
 *   history stays exactly what it always was — localStorage-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { HistoryItem } from "@/hooks/useHistory";

type TypedSupabaseClient = SupabaseClient<Database>;
type CalculatorHistoryRow = Database["public"]["Tables"]["calculator_history"]["Row"];

export type HistorySyncResult =
  | { ok: true }
  | { ok: false; error: string };

export type HistoryFetchResult =
  | { ok: true; items: HistoryItem[] }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown history sync error.";
}

function rowToHistoryItem(row: CalculatorHistoryRow): HistoryItem {
  return {
    // Prefer the client-generated id (keeps future pushes upserting in
    // place); fall back to the cloud row's own id for any legacy/foreign
    // row that predates the `local_id` column.
    id: row.local_id ?? row.id,
    expression: row.expression,
    result: row.result,
    label: row.label,
    timestamp: new Date(row.occurred_at).getTime(),
  };
}

/**
 * Fetches this user's cloud history, newest first, capped at the same
 * `MAX_ITEMS` (100) `useHistory.ts` enforces locally.
 */
export async function fetchCloudHistory(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<HistoryFetchResult> {
  try {
    const { data, error } = await supabase
      .from("calculator_history")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (error) return { ok: false, error: error.message };
    return { ok: true, items: (data ?? []).map(rowToHistoryItem) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * Mirrors `items` (the full, current local history) onto the cloud:
 * upserts every item keyed on `(user_id, local_id)`, then deletes any
 * cloud row for this user whose `local_id` isn't present in `items`. Safe
 * to call repeatedly/frequently — it's idempotent and always converges on
 * exactly what's passed in.
 */
export async function pushHistoryToCloud(
  supabase: TypedSupabaseClient,
  userId: string,
  items: HistoryItem[],
): Promise<HistorySyncResult> {
  try {
    if (items.length > 0) {
      const rows = items.map((item) => ({
        user_id: userId,
        local_id: item.id,
        expression: item.expression,
        result: item.result,
        label: item.label,
        occurred_at: new Date(item.timestamp).toISOString(),
      }));
      const { error: upsertError } = await supabase
        .from("calculator_history")
        .upsert(rows, { onConflict: "user_id,local_id" });
      if (upsertError) return { ok: false, error: upsertError.message };
    }

    // Remove any cloud-only row (deleted/cleared locally) that this sync
    // layer previously wrote. Rows with a null local_id (none exist today,
    // but the column is nullable for forward-compatibility) are left alone
    // since they were never written by this path.
    let deleteQuery = supabase
      .from("calculator_history")
      .delete()
      .eq("user_id", userId)
      .not("local_id", "is", null);

    if (items.length > 0) {
      const idList = items.map((item) => `"${item.id.replace(/"/g, '\\"')}"`).join(",");
      deleteQuery = deleteQuery.not("local_id", "in", `(${idList})`);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) return { ok: false, error: deleteError.message };

    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
