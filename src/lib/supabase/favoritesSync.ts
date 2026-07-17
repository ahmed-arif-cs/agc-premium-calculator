/**
 * Favorites Cloud Sync — Supabase read/write layer.
 *
 * Cloud counterpart to `src/hooks/useFavorites.ts`'s localStorage store,
 * targeting Task 13/18's `public.favorites` table (see
 * `supabase/migrations/20260715120500_favorites.sql` and
 * `.../20260716120000_favorites_sync.sql` for the `local_id` column this
 * file's upsert relies on).
 *
 * Design (identical shape to `historySync.ts`):
 * - Every `FavoriteItem.id` (see `useFavorites.ts`, `genId()`) is written to
 *   the cloud row's `local_id` column. Pushing always `upsert`s on
 *   `(user_id, local_id)`, so re-syncing the same local item in place never
 *   creates a duplicate cloud row.
 * - `pushFavoritesToCloud` treats the given list as the **full, current**
 *   local favorites and mirrors it exactly: it upserts every item, then
 *   deletes any cloud row (for this user) whose `local_id` isn't in that
 *   list. That single operation covers star, un-star, edit-label, and
 *   clear-all without needing a separate code path for each.
 * - Nothing here ever throws. Every function returns a `{ ok: true, ... }`
 *   / `{ ok: false, error }` result, since a sync failure (offline, RLS
 *   misconfiguration, an unconfigured Supabase project) must never break
 *   the calculator or its local-first favorites — it should just mean the
 *   next successful sync catches up.
 * - Guest users never reach this file at all: `useFavoritesSync.ts` only
 *   calls it once `useAuth().isAuthenticated` is true, so Guest Mode's
 *   favorites stay exactly what they are — localStorage-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { FavoriteItem } from "@/hooks/useFavorites";

type TypedSupabaseClient = SupabaseClient<Database>;
type FavoriteRow = Database["public"]["Tables"]["favorites"]["Row"];

export type FavoritesSyncResult =
  | { ok: true }
  | { ok: false; error: string };

export type FavoritesFetchResult =
  | { ok: true; items: FavoriteItem[] }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown favorites sync error.";
}

function rowToFavoriteItem(row: FavoriteRow): FavoriteItem {
  return {
    // Prefer the client-generated id (keeps future pushes upserting in
    // place); fall back to the cloud row's own id for any legacy/foreign
    // row that predates the `local_id` column.
    id: row.local_id ?? row.id,
    kind: row.kind,
    expression: row.expression,
    result: row.result,
    conversionCategory: row.conversion_category,
    fromUnit: row.from_unit,
    toUnit: row.to_unit,
    label: row.label,
    timestamp: new Date(row.created_at).getTime(),
  };
}

/**
 * Fetches this user's cloud favorites, newest first, capped at the same
 * `MAX_ITEMS` (200) `useFavorites.ts` enforces locally.
 */
export async function fetchCloudFavorites(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<FavoritesFetchResult> {
  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return { ok: false, error: error.message };
    return { ok: true, items: (data ?? []).map(rowToFavoriteItem) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * Mirrors `items` (the full, current local favorites) onto the cloud:
 * upserts every item keyed on `(user_id, local_id)`, then deletes any
 * cloud row for this user whose `local_id` isn't present in `items`. Safe
 * to call repeatedly/frequently — it's idempotent and always converges on
 * exactly what's passed in.
 */
export async function pushFavoritesToCloud(
  supabase: TypedSupabaseClient,
  userId: string,
  items: FavoriteItem[],
): Promise<FavoritesSyncResult> {
  try {
    if (items.length > 0) {
      const rows = items.map((item) => ({
        user_id: userId,
        local_id: item.id,
        kind: item.kind,
        expression: item.expression,
        result: item.result,
        conversion_category: item.conversionCategory,
        from_unit: item.fromUnit,
        to_unit: item.toUnit,
        label: item.label,
        created_at: new Date(item.timestamp).toISOString(),
      }));
      const { error: upsertError } = await supabase
        .from("favorites")
        .upsert(rows, { onConflict: "user_id,local_id" });
      if (upsertError) return { ok: false, error: upsertError.message };
    }

    // Remove any cloud-only row (un-starred/cleared locally) that this sync
    // layer previously wrote. Rows with a null local_id (none exist today,
    // but the column is nullable for forward-compatibility) are left alone
    // since they were never written by this path.
    let deleteQuery = supabase
      .from("favorites")
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
