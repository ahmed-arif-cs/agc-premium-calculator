"use client";

/**
 * Cloud Backup — shared "last backup time" store.
 *
 * Tasks 15/16/17/18 each built an independent cloud-sync layer (history,
 * calculator memory, theme/settings, favorites) but none of them recorded
 * *when* a sync last actually succeeded — `status` (`"synced"` etc.) was
 * always transient, in-memory-only React state that reset to `"idle"` on
 * every reload. This task needs a real "Last Backup Time" the person can
 * come back and look at, so this file adds one small, additive piece of
 * persistence every sync hook already has the exact right moment to call
 * into: `recordBackupSuccess(feature)`, invoked immediately after each
 * hook's own `pushXToCloud(...)` call resolves `ok: true`.
 *
 * Same `useSyncExternalStore` + `localStorage` + cross-tab `storage`-event
 * conventions `useHistory.ts`/`useMemory.ts`/`useSettings.ts`/
 * `useFavorites.ts` already use elsewhere in this project — nothing new
 * invented here, just applied to a new, small piece of state.
 *
 * `recordBackupSuccess()` also marks the broader "Last Sync" timestamp
 * (`syncActivity.ts`, Sync Status task) — every successful backup push is,
 * by definition, a successful sync — without duplicating a second call at
 * every one of this function's eight existing call sites.
 */

import { useSyncExternalStore } from "react";
import { recordSyncActivity } from "./syncActivity";

export type BackupFeature = "history" | "memory" | "settings" | "favorites";

export interface BackupTimestamps {
  /** Epoch ms of the last successful `calculator_history` cloud push, or null. */
  history: number | null;
  /** Epoch ms of the last successful `calculator_memory` cloud push, or null. */
  memory: number | null;
  /** Epoch ms of the last successful `user_settings` cloud push, or null. */
  settings: number | null;
  /** Epoch ms of the last successful `favorites` cloud push, or null. */
  favorites: number | null;
}

const STORAGE_KEY = "ahmed-calc:backup-times:v1";
const EVENT = "ahmed-calc:backup-times-change";

const DEFAULTS: BackupTimestamps = {
  history: null,
  memory: null,
  settings: null,
  favorites: null,
};

/**
 * SSR-safe cache of the value read from localStorage, refreshed whenever the
 * store mutates (via a custom event) or another tab writes to storage —
 * identical pattern to `useHistory.ts`/`useMemory.ts`/`useSettings.ts`.
 */
let cache: BackupTimestamps | null = null;
const listeners = new Set<() => void>();

function isValidEntry(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidTimestamps(value: unknown): value is BackupTimestamps {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isValidEntry(v.history) &&
    isValidEntry(v.memory) &&
    isValidEntry(v.settings) &&
    isValidEntry(v.favorites)
  );
}

function readFromStorage(): BackupTimestamps {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    return isValidTimestamps(parsed) ? { ...DEFAULTS, ...parsed } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function refreshCache(): void {
  cache = readFromStorage();
}

function getSnapshot(): BackupTimestamps {
  if (cache === null) refreshCache();
  return cache as BackupTimestamps;
}

function getServerSnapshot(): BackupTimestamps {
  return DEFAULTS;
}

function writeToStorage(next: BackupTimestamps): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be full/unavailable — fail silently, same as every other
    // localStorage-backed store in this project.
  }
}

function emitChange(next: BackupTimestamps): void {
  cache = next;
  writeToStorage(next);
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
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
 * Called by each of the four cloud-sync orchestration hooks
 * (`useHistorySync`/`useMemorySync`/`useSettingsSync`/`useFavoritesSync`)
 * immediately after their own push-to-cloud call resolves successfully.
 * Never called on a guest, a disabled/unconfigured project, or a failed
 * push — only on a real, confirmed backup.
 */
export function recordBackupSuccess(feature: BackupFeature): void {
  const current = getSnapshot();
  emitChange({ ...current, [feature]: Date.now() });
  recordSyncActivity();
}

/**
 * Read-only subscription to all four features' last-backup timestamps.
 * Used by `useCloudBackup.ts` to compute an overall "Last Backup Time".
 */
export function useBackupTimestamps(): BackupTimestamps {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The most recent of the four timestamps, or null if none have ever synced. */
export function latestBackupTime(timestamps: BackupTimestamps): number | null {
  const values = [timestamps.history, timestamps.memory, timestamps.settings, timestamps.favorites].filter(
    (v): v is number => v !== null,
  );
  return values.length ? Math.max(...values) : null;
}
