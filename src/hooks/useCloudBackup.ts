"use client";

/**
 * Cloud Backup — aggregation hook for the Profile page's new "Cloud Backup"
 * section (Task 19).
 *
 * Tasks 15/16/17/18 each built a fully independent, automatic cloud-sync
 * layer for one slice of app state (history, calculator memory,
 * theme/settings, favorites) — each with its own debounced push, its own
 * restore-after-login effect, and its own transient `status`. Nothing in
 * the app ever presented those four as a single, professional "your data
 * is backed up" picture. This hook is purely a read/aggregate layer on top
 * of what already exists — it does **not** duplicate any restore/push
 * effect (each of the four `use*Sync()` orchestration hooks is still
 * mounted exactly once — `useHistorySync`/`useMemorySync`/
 * `useFavoritesSync`/`useSettingsSync` are all mounted together in
 * `SettingsApplier.tsx` as of Task 22, which moved the first three there
 * from `Calculator.tsx` so all four restore automatically after sign-in
 * regardless of which page mounts first — see that file's doc comment).
 * It only *reads* their status via the four read-only `use*SyncStatus()`
 * selectors (three of which were new, additive exports Task 19 added
 * alongside each hook; `useSettingsSyncStatus` already existed from Task
 * 17) and the shared `useBackupTimestamps()` store those same hooks now
 * record into on every successful push.
 *
 * Automatic Backup: implicit and always-on for a signed-in user with a
 * configured Supabase project — there's no separate toggle, because every
 * one of the four sync hooks already pushes changes automatically on its
 * own short debounce. This hook's `automaticBackupEnabled` flag simply
 * reports whether that's actually true right now (signed in + configured),
 * so the UI can say so plainly instead of implying a setting that doesn't
 * exist.
 *
 * Backup Status: an overall status derived from the four individual ones —
 * `"restoring"`/`"syncing"` if any subsystem is actively working,
 * `"error"` if any failed and none are actively working, `"synced"` only
 * once all four report synced, otherwise `"idle"`.
 *
 * Last Backup Time: the most recent of the four recorded timestamps (or
 * null if nothing has ever synced yet).
 *
 * Sync Status task additions (on top of all of the above, unchanged):
 * `lastSyncAt` (the broader "any push or pull succeeded" timestamp, from
 * `syncActivity.ts`) and `progress` (how many of the four subsystems are
 * currently `"synced"`, out of four, plus an `active` flag while any of
 * them is mid-restore/mid-push) — both read-only derivations for the new
 * "Sync Status" UI (`SyncStatusSection.tsx`) to show alongside the
 * existing Cloud Backup section, without duplicating any restore/push
 * effect here either.
 */

import { useCallback, useState } from "react";
import { useAuth } from "./useAuth";
import { useHistory } from "./useHistory";
import { useHistorySyncStatus } from "./useHistorySync";
import { useMemory } from "./useMemory";
import { useMemorySyncStatus } from "./useMemorySync";
import { useSettings } from "./useSettings";
import { useSettingsSyncStatus } from "./useSettingsSync";
import { useFavorites } from "./useFavorites";
import { useFavoritesSyncStatus } from "./useFavoritesSync";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { pushHistoryToCloud, fetchCloudHistory } from "@/lib/supabase/historySync";
import { pushMemoryToCloud, fetchCloudMemory } from "@/lib/supabase/memorySync";
import { pushSettingsToCloud, fetchCloudSettings } from "@/lib/supabase/settingsSync";
import { pushFavoritesToCloud, fetchCloudFavorites } from "@/lib/supabase/favoritesSync";
import { useBackupTimestamps, latestBackupTime, type BackupFeature } from "@/lib/backup/backupTimestamps";
import { recordSyncActivity, useLastSyncAt } from "@/lib/backup/syncActivity";

export type CloudBackupStatus = "disabled" | "guest" | "restoring" | "syncing" | "synced" | "idle" | "error";

export interface CloudBackupFeatureInfo {
  key: BackupFeature;
  label: string;
  status: "disabled" | "idle" | "restoring" | "syncing" | "synced" | "error";
  lastBackupAt: number | null;
}

/**
 * Sync Progress (Sync Status task): how many of the four subsystems
 * currently report `"synced"`, out of the four total — a simple,
 * always-accurate fraction rather than a simulated/animated percentage,
 * since there's no meaningful sub-step progress within a single
 * subsystem's push/fetch to show. `active` is true whenever any subsystem
 * is currently `"restoring"`/`"syncing"`, so the UI can show a moving
 * (indeterminate-feeling) bar instead of a static one while work is
 * actually happening.
 */
export interface CloudSyncProgress {
  completed: number;
  total: number;
  percent: number;
  active: boolean;
}

export interface UseCloudBackupReturn {
  /** Whether a Supabase project is configured at all (independent of sign-in). */
  configured: boolean;
  /** True only when signed in + configured — the state in which every one of the four sync hooks is actively pushing changes automatically. */
  automaticBackupEnabled: boolean;
  /** Overall status across all four subsystems (history, memory, settings, favorites). */
  status: CloudBackupStatus;
  /** The most recent successful backup (push) across all four subsystems, or null if none yet. */
  lastBackupAt: number | null;
  /**
   * The most recent successful sync activity of *any* kind — a backup
   * push or a manual restore pull, whichever happened most recently — or
   * null if nothing has ever synced. Broader than `lastBackupAt`: a
   * manual "Restore backup" only fetches from the cloud, so it updates
   * this without updating any per-feature backup timestamp.
   */
  lastSyncAt: number | null;
  /** How many of the four subsystems are currently synced, out of four — for a "Sync Progress" indicator. */
  progress: CloudSyncProgress;
  /** Per-subsystem breakdown, for a detailed status list. */
  features: CloudBackupFeatureInfo[];
  /** True while a manual "Back up now" push is in flight. */
  isBackingUpNow: boolean;
  /**
   * Manually pushes the current local state of all four subsystems to the
   * cloud right now (signed-in users only; a no-op for guests, returning
   * `{ ok: false, error: "not-signed-in" }`). Resolves once every push has
   * settled, with an explicit success/failure outcome the caller can show
   * to the person (e.g. a toast) — unlike the four automatic sync hooks,
   * which are fire-and-forget and self-heal on the next debounced push.
   */
  backupNow: () => Promise<ManualBackupResult>;
  /**
   * Manually fetches the latest cloud backup of all four subsystems and
   * restores them into local state right now (signed-in users only; a
   * no-op for guests, returning `{ ok: false, error: "not-signed-in",
   * failedFeatures: [] }`). Unlike the automatic restore-after-login
   * effects each `use*Sync()` hook already runs once per sign-in (which
   * *merge* cloud data into whatever's local), this replaces local
   * history/favorites outright with the cloud's lists and overwrites local
   * memory/settings with the cloud's values — the cloud backup is treated
   * as the source of truth for this explicit action. Resolves once every
   * fetch has settled, with an explicit success/failure outcome the caller
   * can show to the person (e.g. a toast).
   */
  restoreBackup: () => Promise<ManualRestoreResult>;
  /** True while a manual "Restore Backup" pull is in flight. */
  isRestoringNow: boolean;
}

export type ManualBackupResult =
  | { ok: true }
  | { ok: false; error: string; failedFeatures: BackupFeature[] };

export type ManualRestoreResult =
  | { ok: true }
  | { ok: false; error: string; failedFeatures: BackupFeature[] };

const FEATURE_LABELS: Record<BackupFeature, string> = {
  history: "Calculation history",
  memory: "Calculator memory",
  settings: "Theme & settings",
  favorites: "Favorites",
};

function overallOf(
  statuses: Array<"disabled" | "idle" | "restoring" | "syncing" | "synced" | "error">,
): CloudBackupStatus {
  if (statuses.some((s) => s === "restoring")) return "restoring";
  if (statuses.some((s) => s === "syncing")) return "syncing";
  if (statuses.some((s) => s === "error")) return "error";
  if (statuses.every((s) => s === "synced")) return "synced";
  return "idle";
}

export function useCloudBackup(): UseCloudBackupReturn {
  const auth = useAuth();
  const configured = isSupabaseConfigured();
  const isSignedIn = auth.isAuthenticated && !!auth.user;

  const history = useHistory();
  const memory = useMemory();
  const settings = useSettings();
  const favorites = useFavorites();

  const historyStatus = useHistorySyncStatus();
  const memoryStatus = useMemorySyncStatus();
  const settingsStatus = useSettingsSyncStatus();
  const favoritesStatus = useFavoritesSyncStatus();

  const timestamps = useBackupTimestamps();
  const lastSyncAt = useLastSyncAt();
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isRestoringNow, setIsRestoringNow] = useState(false);

  const features: CloudBackupFeatureInfo[] = [
    { key: "history", label: FEATURE_LABELS.history, status: historyStatus, lastBackupAt: timestamps.history },
    { key: "memory", label: FEATURE_LABELS.memory, status: memoryStatus, lastBackupAt: timestamps.memory },
    { key: "settings", label: FEATURE_LABELS.settings, status: settingsStatus, lastBackupAt: timestamps.settings },
    {
      key: "favorites",
      label: FEATURE_LABELS.favorites,
      status: favoritesStatus,
      lastBackupAt: timestamps.favorites,
    },
  ];

  const status: CloudBackupStatus = !configured
    ? "disabled"
    : !isSignedIn
      ? "guest"
      : overallOf(features.map((f) => f.status));

  const progress: CloudSyncProgress = (() => {
    const total = features.length;
    if (!configured || !isSignedIn) return { completed: 0, total, percent: 0, active: false };
    const completed = features.filter((f) => f.status === "synced").length;
    const active = features.some((f) => f.status === "restoring" || f.status === "syncing");
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0, active };
  })();

  const backupNow = useCallback(async (): Promise<ManualBackupResult> => {
    if (!configured || !isSignedIn || !auth.user) {
      return { ok: false, error: "You need to sign in before you can back up.", failedFeatures: [] };
    }
    setIsBackingUpNow(true);
    try {
      const supabase = createClient();
      const uid = auth.user.id;
      const [historyResult, memoryResult, settingsResult, favoritesResult] = await Promise.all([
        pushHistoryToCloud(supabase, uid, history.items),
        pushMemoryToCloud(supabase, uid, { value: memory.value, hasMemory: memory.hasMemory }),
        pushSettingsToCloud(supabase, uid, {
          theme: settings.theme,
          fontSize: settings.fontSize,
          soundEnabled: settings.soundEnabled,
        }),
        pushFavoritesToCloud(supabase, uid, favorites.items),
      ]);
      // Unlike the four automatic sync hooks (which are fire-and-forget and
      // self-heal on the next debounced push), a manual "Back up now" click
      // is an explicit action the person is waiting on — so its result is
      // checked here and reported back honestly, feature by feature,
      // instead of silently trusting the background hooks to catch up
      // later. The automatic hooks are untouched and still own ongoing
      // retry/reconciliation; this is purely about giving *this* click an
      // accurate yes/no answer.
      const results: Array<{ feature: BackupFeature; result: { ok: boolean; error?: string } }> = [
        { feature: "history", result: historyResult },
        { feature: "memory", result: memoryResult },
        { feature: "settings", result: settingsResult },
        { feature: "favorites", result: favoritesResult },
      ];
      const failed = results.filter((r) => !r.result.ok);
      if (failed.length > 0) {
        const firstError = failed[0].result.error ?? "Backup failed.";
        return {
          ok: false,
          error: firstError,
          failedFeatures: failed.map((f) => f.feature),
        };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Backup failed — please try again.";
      return { ok: false, error: message, failedFeatures: [] };
    } finally {
      setIsBackingUpNow(false);
    }
  }, [configured, isSignedIn, auth.user, history.items, memory.value, memory.hasMemory, settings.theme, settings.fontSize, settings.soundEnabled, favorites.items]);

  const restoreBackup = useCallback(async (): Promise<ManualRestoreResult> => {
    if (!configured || !isSignedIn || !auth.user) {
      return { ok: false, error: "You need to sign in before you can restore a backup.", failedFeatures: [] };
    }
    setIsRestoringNow(true);
    try {
      const supabase = createClient();
      const uid = auth.user.id;
      const [historyResult, memoryResult, settingsResult, favoritesResult] = await Promise.all([
        fetchCloudHistory(supabase, uid),
        fetchCloudMemory(supabase, uid),
        fetchCloudSettings(supabase, uid),
        fetchCloudFavorites(supabase, uid),
      ]);
      // Each fetch is checked independently, exactly like `backupNow`
      // above — a failure in one subsystem's fetch must not silently
      // skip restoring the others, and must be reported back accurately
      // rather than assumed to have succeeded.
      const results: Array<{ feature: BackupFeature; result: { ok: boolean; error?: string } }> = [
        { feature: "history", result: historyResult },
        { feature: "memory", result: memoryResult },
        { feature: "settings", result: settingsResult },
        { feature: "favorites", result: favoritesResult },
      ];
      const failed = results.filter((r) => !r.result.ok);
      if (failed.length > 0) {
        const firstError = failed[0].result.error ?? "Restore failed.";
        return {
          ok: false,
          error: firstError,
          failedFeatures: failed.map((f) => f.feature),
        };
      }

      // Every fetch succeeded — apply the cloud's data as the new local
      // state. History/favorites are replaced outright (not merged) since
      // this is an explicit "restore the backup" action, not the
      // automatic post-login merge each `use*Sync()` hook already
      // performs on its own. Memory/settings are single-row values, so
      // `setMemory`/`setSettings` already are a full overwrite.
      if (historyResult.ok) history.replaceAll(historyResult.items);
      if (memoryResult.ok) memory.setMemory(memoryResult.state);
      if (settingsResult.ok && settingsResult.settings) settings.setSettings(settingsResult.settings);
      if (favoritesResult.ok) favorites.replaceAll(favoritesResult.items);

      // A restore is a real, successful sync activity — but a pull-only
      // one, so it never calls `recordBackupSuccess()` (that's reserved
      // for pushes). Mark "Last Sync" directly here instead.
      recordSyncActivity();

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Restore failed — please try again.";
      return { ok: false, error: message, failedFeatures: [] };
    } finally {
      setIsRestoringNow(false);
    }
  }, [configured, isSignedIn, auth.user, history.replaceAll, memory.setMemory, settings.setSettings, favorites.replaceAll]);

  return {
    configured,
    automaticBackupEnabled: configured && isSignedIn,
    status,
    lastBackupAt: latestBackupTime(timestamps),
    lastSyncAt,
    progress,
    features,
    isBackingUpNow,
    backupNow,
    restoreBackup,
    isRestoringNow,
  };
}
