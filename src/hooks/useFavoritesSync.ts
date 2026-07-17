"use client";

/**
 * Favorites Cloud Sync — orchestration hook.
 *
 * Wires `useFavorites.ts`'s local, localStorage-backed store to
 * `src/lib/supabase/favoritesSync.ts`'s Supabase read/write layer, entirely
 * additively: nothing about `useFavorites()`'s existing API changed, and any
 * component that only reads/writes favorites through it (FavoritesPanel,
 * HistoryPanel's star toggle, …) behaves exactly as it did before this hook
 * existed. Identical shape and behavior to `useHistorySync.ts` (Task 15) —
 * see that file's comment for the fuller rationale, condensed here.
 *
 * Behavior:
 * - **Guest Mode is untouched.** This hook is a no-op whenever
 *   `!auth.isAuthenticated` (including while `status === "initializing"`)
 *   or Supabase isn't configured — guest favorites stay exactly what they
 *   always were, localStorage-only, synced across tabs but never the cloud.
 * - **Restore after login** (once per signed-in session/user id): fetches
 *   this user's cloud favorites and merges them into the local store via
 *   `useFavorites().mergeCloudItems()`, which preserves each item's id so a
 *   subsequent push upserts in place. This also naturally carries forward
 *   any favorite that was starred locally *before* signing in (e.g. as a
 *   guest) — merge, don't replace — and the merged, deduped result is then
 *   pushed straight back to the cloud so a second device sees it too.
 * - **Automatic sync while signed in**: any change to the local favorites
 *   (star/un-star/edit-label/clear) is mirrored to the cloud on a short
 *   debounce, via `pushFavoritesToCloud()`'s full-mirror upsert+delete.
 * - **Never blocks or throws.** A network failure, an unconfigured
 *   Supabase project, or an RLS/auth error just leaves `status` as
 *   `"error"` — the calculator and its local favorites keep working exactly
 *   as before; the next successful change/reconnect retries automatically.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { useFavorites } from "./useFavorites";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchCloudFavorites, pushFavoritesToCloud } from "@/lib/supabase/favoritesSync";
import { recordBackupSuccess } from "@/lib/backup/backupTimestamps";

export type FavoritesSyncStatus =
  /** No Supabase project configured — cloud sync isn't available at all. */
  | "disabled"
  /** Guest Mode, or signed in but nothing has triggered a sync yet. */
  | "idle"
  /** Fetching + merging cloud favorites right after sign-in. */
  | "restoring"
  /** Pushing a local change up to the cloud. */
  | "syncing"
  /** Local and cloud favorites are known to match as of the last sync. */
  | "synced"
  /** The most recent restore/push attempt failed (network, RLS, etc). */
  | "error";

interface UseFavoritesSyncReturn {
  status: FavoritesSyncStatus;
}

const PUSH_DEBOUNCE_MS = 800;

/* ---------------------------------------------------------------------
 * Shared, read-only status store — lets `useFavoritesSyncStatus()` (below,
 * used by the new Cloud Backup UI in Task 19) expose this hook's status to
 * any number of consumers without mounting a second, duplicate copy of the
 * restore/push effects. Same pattern `useSettingsSync.ts` established.
 * ------------------------------------------------------------------- */
let sharedStatus: FavoritesSyncStatus = isSupabaseConfigured() ? "idle" : "disabled";
const statusListeners = new Set<() => void>();

function setSharedStatus(next: FavoritesSyncStatus): void {
  sharedStatus = next;
  statusListeners.forEach((listener) => listener());
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function getStatusSnapshot(): FavoritesSyncStatus {
  return sharedStatus;
}

function getStatusServerSnapshot(): FavoritesSyncStatus {
  return isSupabaseConfigured() ? "idle" : "disabled";
}

/**
 * Read-only subscription to the single `useFavoritesSync()` instance's
 * status (mounted once in `SettingsApplier.tsx` as of Task 22). Safe to call from any number
 * of components — never starts a new restore/push cycle itself.
 */
export function useFavoritesSyncStatus(): FavoritesSyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getStatusServerSnapshot);
}

export function useFavoritesSync(): UseFavoritesSyncReturn {
  const auth = useAuth();
  const { items, mergeCloudItems } = useFavorites();
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<FavoritesSyncStatus>(configured ? "idle" : "disabled");

  const applyStatus = useCallback((next: FavoritesSyncStatus) => {
    setStatus(next);
    setSharedStatus(next);
  }, []);

  // Tracks the user id this hook has already restored cloud favorites for,
  // so a re-render (e.g. a new favorite being starred) doesn't re-trigger a
  // full restore — only an actual sign-in (a new/changed user id) does.
  const restoredForUserRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = auth.isAuthenticated ? (auth.user?.id ?? null) : null;

  // Restore-on-login: fetch cloud favorites once per signed-in user id,
  // merge them into the local store (preserving ids), then push the merged
  // result back up so a local-only, pre-login favorite is uploaded too.
  useEffect(() => {
    if (!userId || !configured) return;
    if (restoredForUserRef.current === userId) return;

    let cancelled = false;

    async function restore(uid: string): Promise<void> {
      applyStatus("restoring");
      const supabase = createClient();
      const result = await fetchCloudFavorites(supabase, uid);
      if (cancelled) return;

      if (!result.ok) {
        applyStatus("error");
        return;
      }

      const merged = mergeCloudItems(result.items);
      // Mark restored before the follow-up push so the debounced push
      // effect below (which waits on this same ref) doesn't skip it.
      restoredForUserRef.current = uid;
      const pushResult = await pushFavoritesToCloud(supabase, uid, merged);
      if (cancelled) return;
      applyStatus(pushResult.ok ? "synced" : "error");
      if (pushResult.ok) recordBackupSuccess("favorites");
    }

    void restore(userId);
    return () => {
      cancelled = true;
    };
  }, [userId, configured, mergeCloudItems, applyStatus]);

  // Ongoing sync: any local favorites change, while signed in, is mirrored
  // to the cloud on a short debounce (so rapid edits — e.g. typing a label
  // — don't fire a network call per keystroke).
  useEffect(() => {
    if (!userId || !configured) return;
    // Wait for the initial restore to finish first, so this doesn't race
    // it with a push of the pre-merge (possibly stale/incomplete) list.
    if (restoredForUserRef.current !== userId) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyStatus("syncing");
      const supabase = createClient();
      void pushFavoritesToCloud(supabase, userId, items).then((result) => {
        applyStatus(result.ok ? "synced" : "error");
        if (result.ok) recordBackupSuccess("favorites");
      });
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, configured, items, applyStatus]);

  // Sign-out (or never having signed in): reset the "already restored" flag
  // so a future sign-in restores again. This is a ref reset only — no
  // setState here, so the guest/disabled status below is derived instead
  // (avoids a synchronous setState-in-effect render cascade).
  useEffect(() => {
    if (userId) return;
    restoredForUserRef.current = null;
  }, [userId]);

  // Guests (and an unconfigured Supabase project) always report a fixed,
  // derived status rather than whatever `status` last held from a previous
  // signed-in session — e.g. signing out shouldn't leave a stale "synced"
  // badge showing.
  const effectiveStatus: FavoritesSyncStatus = !userId
    ? configured
      ? "idle"
      : "disabled"
    : status;

  // Keep the shared, read-only store (for `useFavoritesSyncStatus()`
  // subscribers, e.g. the Cloud Backup panel) in step with the derived
  // guest/disabled status too, not just the restore/push effects' explicit
  // transitions above.
  useEffect(() => {
    setSharedStatus(effectiveStatus);
  }, [effectiveStatus]);

  return { status: effectiveStatus };
}
