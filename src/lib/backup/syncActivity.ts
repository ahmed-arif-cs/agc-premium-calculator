"use client";

/**
 * Sync Status — shared "last sync activity" store.
 *
 * `backupTimestamps.ts` (Task 19) already records *when each of the four
 * subsystems last successfully pushed* to the cloud ("Last Backup Time" —
 * a per-feature, push-only concept). This task ("Sync Status") asks for a
 * broader, single "Last Sync" figure: the last time *any* sync activity —
 * a push (backup) **or** a pull (restore) — actually completed
 * successfully, whichever is more recent. Those two are the same moment
 * most of the time (a push usually follows right after), but they
 * genuinely diverge for Task 21's manual "Restore backup" action, which
 * only ever *fetches* from the cloud and never pushes — so it updates
 * "Last Sync" without updating any of the four "Last Backup" timestamps.
 *
 * Same `useSyncExternalStore` + `localStorage` + cross-tab `storage`-event
 * conventions every other store in this project already uses (`useHistory`
 * /`useMemory`/`useSettings`/`useFavorites`/`backupTimestamps`) — nothing
 * new invented here, just applied to one more small piece of state.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ahmed-calc:last-sync:v1";
const EVENT = "ahmed-calc:last-sync-change";

let cache: number | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function refreshCache(): void {
  cache = readFromStorage();
}

function getSnapshot(): number | null {
  if (cache === null) refreshCache();
  return cache;
}

function getServerSnapshot(): number | null {
  return null;
}

function writeToStorage(next: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Storage may be full/unavailable — fail silently, same as every other
    // localStorage-backed store in this project.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener(EVENT, listener);
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENT, listener);
      window.removeEventListener("storage", onStorage);
    }
  };
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) {
    refreshCache();
    listeners.forEach((listener) => listener());
  }
}

/**
 * Marks "right now" as the last successful sync activity. Called from
 * `recordBackupSuccess()` (so every successful push already counts as a
 * sync) and from `useCloudBackup()`'s `restoreBackup()` once every
 * subsystem's fetch has succeeded (a pull-only action that
 * `recordBackupSuccess()` never sees). Never called on a guest, an
 * unconfigured project, or a failed attempt.
 */
export function recordSyncActivity(): void {
  const next = Date.now();
  cache = next;
  writeToStorage(next);
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

/** Read-only subscription to the single "Last Sync" timestamp, or null if nothing has ever synced. */
export function useLastSyncAt(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
