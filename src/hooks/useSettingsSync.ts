"use client";

/**
 * Settings Cloud Sync (Theme + Calculator Settings + User Preferences) —
 * orchestration hook.
 *
 * Wires `useSettings.ts`'s local, localStorage-backed preferences store
 * (theme, font size, click-sound) to `src/lib/supabase/settingsSync.ts`'s
 * Supabase read/write layer, entirely additively: nothing about
 * `useSettings()`'s existing API changed (only a new `setSettings` full
 * overwrite was added, alongside the existing per-field setters), so any
 * component that only reads/writes settings through it (`SettingsPanel`,
 * `SettingsApplier`'s theme/font-scale application, `useClickSound`, …)
 * behaves exactly as it did before this hook existed.
 *
 * Behavior (deliberately mirrors `useHistorySync.ts`/`useMemorySync.ts`'s
 * conventions):
 * - **Guest Mode is untouched.** This hook is a no-op whenever
 *   `!auth.isAuthenticated` (including while `status === "initializing"`)
 *   or Supabase isn't configured — guest settings stay exactly what they
 *   always were, localStorage-only via `useSettings.ts`, synced across tabs
 *   but never the cloud.
 * - **Restore after login** (once per signed-in session/user id): fetches
 *   this user's cloud settings row. Task 10's `user_settings` table has no
 *   "has this user ever actually customized this" sentinel column the way
 *   Task 16 added `has_value` for memory — its auto-provisioning trigger
 *   gives every new row the exact same defaults `useSettings.ts` already
 *   uses locally, so a persisted-but-never-touched cloud row is
 *   indistinguishable from one nobody has written to. Rather than add a
 *   column purely to disambiguate that (Task 10's own schema comment says
 *   this table was already built to map one-to-one onto `Settings`, with no
 *   such flag planned), this hook uses the same practical rule Task 16's
 *   `hasMemory` check embodies: **if the cloud settings differ from the
 *   local `DEFAULTS`, they represent a real prior customization (this
 *   account, another device/session) and win; otherwise the local value —
 *   which may itself already be a guest customization made before signing
 *   in — wins instead.** Either way the resolved settings are written back
 *   to `useSettings()` and pushed to the cloud, so a second device signing
 *   into the same account sees them too, and a guest's pre-login theme
 *   choice is never silently dropped just because the cloud row happens to
 *   still be at its freshly-provisioned defaults.
 * - **Automatic ongoing sync**: a second effect watches the local
 *   `{ theme, fontSize, soundEnabled }` and, whenever authenticated, pushes
 *   it to the cloud on an 800ms debounce (so quickly clicking through
 *   theme swatches doesn't fire a network request per click). Guarded to
 *   only start once the initial restore has finished, so it can't race a
 *   push of a stale, pre-resolve value.
 * - **Never blocks or throws.** A network failure, an unconfigured
 *   Supabase project, or an RLS/auth error just leaves `status` as
 *   `"error"` — the app and its local settings keep working exactly as
 *   before; the next successful change/reconnect retries automatically.
 *
 * Meant to be mounted **once**, near the root — in `SettingsApplier.tsx`
 * (already mounted once in `layout.tsx`, inside `SessionProvider`, on
 * every page). Theme/settings are applied app-wide (the whole reason
 * `SettingsApplier` exists), and sign-in is also reachable from `/profile`
 * (`ProfileView.tsx`'s own Google/GitHub buttons) without ever mounting
 * `Calculator`, so restore-after-login needs to work regardless of which
 * page the person is on when they sign in — as of Task 22,
 * `useHistorySync`/`useMemorySync`/`useFavoritesSync` are mounted here
 * too, for exactly this same reason (they used to live in
 * `Calculator.tsx`; see `SettingsApplier.tsx`'s doc comment).
 * A separate read-only `useSettingsSyncStatus()` hook is exported below
 * for optional UI (e.g. `SettingsPanel`'s badge) to subscribe to that same
 * status without mounting a second, duplicate set of sync effects.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { useSettings, type Settings } from "./useSettings";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchCloudSettings, pushSettingsToCloud } from "@/lib/supabase/settingsSync";
import { recordBackupSuccess } from "@/lib/backup/backupTimestamps";

export type SettingsSyncStatus =
  /** No Supabase project configured — cloud sync isn't available at all. */
  | "disabled"
  /** Guest Mode, or signed in but nothing has triggered a sync yet. */
  | "idle"
  /** Fetching + resolving cloud settings right after sign-in. */
  | "restoring"
  /** Pushing a local change up to the cloud. */
  | "syncing"
  /** Local and cloud settings are known to match as of the last sync. */
  | "synced"
  /** The most recent restore/push attempt failed (network, RLS, etc). */
  | "error";

interface UseSettingsSyncReturn {
  status: SettingsSyncStatus;
}

const PUSH_DEBOUNCE_MS = 800;

const DEFAULT_SETTINGS: Settings = {
  theme: "navy-gold",
  fontSize: "md",
  soundEnabled: false,
};

function settingsEqual(a: Settings, b: Settings): boolean {
  return a.theme === b.theme && a.fontSize === b.fontSize && a.soundEnabled === b.soundEnabled;
}

/* ---------------------------------------------------------------------
 * Shared, read-only status store — lets `useSettingsSyncStatus()` (below)
 * expose the single orchestration hook's status to any number of UI
 * consumers (e.g. `SettingsPanel`'s badge) without each one mounting its
 * own duplicate restore/push effects. Same `useSyncExternalStore` shape
 * `useSettings.ts`/`useHistory.ts`/`useMemory.ts` already use elsewhere in
 * this project.
 * ------------------------------------------------------------------- */
let sharedStatus: SettingsSyncStatus = isSupabaseConfigured() ? "idle" : "disabled";
const statusListeners = new Set<() => void>();

function setSharedStatus(next: SettingsSyncStatus): void {
  sharedStatus = next;
  statusListeners.forEach((listener) => listener());
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function getStatusSnapshot(): SettingsSyncStatus {
  return sharedStatus;
}

function getStatusServerSnapshot(): SettingsSyncStatus {
  return isSupabaseConfigured() ? "idle" : "disabled";
}

/**
 * Read-only subscription to the single `useSettingsSync()` instance's
 * status (mounted once in `SettingsApplier.tsx`). Safe to call from any
 * number of components — never starts a new restore/push cycle itself.
 */
export function useSettingsSyncStatus(): SettingsSyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getStatusServerSnapshot);
}

/**
 * The actual orchestration hook — mount exactly once (in
 * `SettingsApplier.tsx`). See the file-level doc comment above for full
 * behavior.
 */
export function useSettingsSync(): UseSettingsSyncReturn {
  const auth = useAuth();
  const { theme, fontSize, soundEnabled, setSettings } = useSettings();
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<SettingsSyncStatus>(configured ? "idle" : "disabled");

  // Tracks the user id this hook has already restored cloud settings for,
  // so a re-render (e.g. a settings change) doesn't re-trigger a full
  // restore — only an actual sign-in (a new/changed user id) does.
  const restoredForUserRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the latest local settings for the restore effect to read
  // without depending on `theme`/`fontSize`/`soundEnabled` directly (which
  // would re-run restore on every settings change instead of only on
  // sign-in).
  const localRef = useRef<Settings>({ theme, fontSize, soundEnabled });
  useEffect(() => {
    localRef.current = { theme, fontSize, soundEnabled };
  }, [theme, fontSize, soundEnabled]);

  const applyStatus = useCallback((next: SettingsSyncStatus) => {
    setStatus(next);
    setSharedStatus(next);
  }, []);

  const userId = auth.isAuthenticated ? (auth.user?.id ?? null) : null;

  // Restore-on-login: fetch this user's cloud settings once per signed-in
  // user id, resolve them against whatever's local (cloud wins if it
  // already differs from the shared defaults — i.e. represents a real
  // prior customization; otherwise the local/guest value wins), write the
  // result into the local store, then push it back up so a second device —
  // or the cloud itself, the first time — ends up with the same resolved
  // settings.
  useEffect(() => {
    if (!userId || !configured) return;
    if (restoredForUserRef.current === userId) return;

    let cancelled = false;

    async function restore(uid: string): Promise<void> {
      applyStatus("restoring");
      const supabase = createClient();
      const result = await fetchCloudSettings(supabase, uid);
      if (cancelled) return;

      if (!result.ok) {
        applyStatus("error");
        return;
      }

      const cloud = result.settings;
      const resolved =
        cloud && !settingsEqual(cloud, DEFAULT_SETTINGS) ? cloud : localRef.current;

      // Mark restored before the follow-up push so the debounced push
      // effect below (which waits on this same ref) doesn't skip it.
      restoredForUserRef.current = uid;
      setSettings(resolved);
      const pushResult = await pushSettingsToCloud(supabase, uid, resolved);
      if (cancelled) return;
      applyStatus(pushResult.ok ? "synced" : "error");
      if (pushResult.ok) recordBackupSuccess("settings");
    }

    void restore(userId);
    return () => {
      cancelled = true;
    };
  }, [userId, configured, setSettings, applyStatus]);

  // Ongoing sync: any local settings change, while signed in, is mirrored
  // to the cloud on a short debounce (so quickly clicking through theme
  // swatches or font sizes doesn't fire a network call per click).
  useEffect(() => {
    if (!userId || !configured) return;
    // Wait for the initial restore to finish first, so this doesn't race
    // it with a push of the pre-resolve (possibly stale) local value.
    if (restoredForUserRef.current !== userId) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyStatus("syncing");
      const supabase = createClient();
      void pushSettingsToCloud(supabase, userId, { theme, fontSize, soundEnabled }).then(
        (result) => {
          applyStatus(result.ok ? "synced" : "error");
          if (result.ok) recordBackupSuccess("settings");
        },
      );
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, configured, theme, fontSize, soundEnabled, applyStatus]);

  // Sign-out (or never having signed in): reset the "already restored" flag
  // so a future sign-in restores again. This is a ref reset only — no
  // setState here, so the guest/disabled status below is derived instead
  // (avoids a synchronous setState-in-effect render cascade, same as
  // useHistorySync.ts/useMemorySync.ts).
  useEffect(() => {
    if (userId) return;
    restoredForUserRef.current = null;
  }, [userId]);

  // Guests (and an unconfigured Supabase project) always report a fixed,
  // derived status rather than whatever `status` last held from a previous
  // signed-in session — e.g. signing out shouldn't leave a stale "synced"
  // badge showing.
  const effectiveStatus: SettingsSyncStatus = !userId
    ? configured
      ? "idle"
      : "disabled"
    : status;

  // Keep the shared, read-only store (for `useSettingsSyncStatus()`
  // subscribers) in step with the derived guest/disabled status too, not
  // just the restore/push effects' explicit transitions above.
  useEffect(() => {
    setSharedStatus(effectiveStatus);
  }, [effectiveStatus]);

  return { status: effectiveStatus };
}
