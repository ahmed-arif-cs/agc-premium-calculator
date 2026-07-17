"use client";

/**
 * Multi-device Sync — cross-device reconciliation hook (Task 24).
 *
 * Tasks 15-18 already gave every subsystem (history, calculator memory,
 * theme/settings, favorites) an automatic, debounced *push* on every local
 * change, plus a *restore* that runs once per signed-in session (Task 22
 * guarantees it fires from every page). That covers "my data follows me
 * when I sign in somewhere new." It does **not** cover the case this task
 * is actually about: two devices signed into the *same* account, both
 * already open, at the same time. Device A's push never reaches Device B
 * on its own — B only ever re-fetches once, at its own next sign-in. So a
 * value changed on A stays invisible on B until B reloads or signs out and
 * back in. This hook closes that gap with a lightweight, periodic
 * reconciliation pass, without touching how any of the four subsystems
 * push or restore.
 *
 * **How data is kept in sync across devices:**
 * - While signed in (and only then), this hook fetches all four cloud
 *   tables on an interval (every {@link POLL_INTERVAL_MS}), plus
 *   immediately whenever the tab becomes visible again, regains focus, or
 *   the browser comes back online — the moments a person is most likely
 *   to actually be looking at a second device's changes.
 * - The very first check is delayed by a full interval, specifically so it
 *   never races Task 15-18's own restore-on-login effects (which run
 *   immediately on sign-in, in the same `SettingsApplier.tsx` mount) — by
 *   the time this hook's first check runs, every subsystem has already
 *   resolved its initial local/cloud state.
 *
 * **How conflicts are handled safely:**
 * - **History and Favorites** (lists): reconciled via each store's
 *   existing `mergeCloudItems()` — the same id-preserving, dedupe-by-
 *   content union already used for restore-after-login. This can only
 *   ever *add* items neither side already had; it never drops or
 *   overwrites a local edit, so there's no way for a periodic check to
 *   destructively clobber anything. If the merge actually added something
 *   new, the merged (superset) list is pushed back so a third device
 *   converges too.
 * - **Calculator Memory and Theme/Settings** (single-row values): resolved
 *   by **last-write-wins using the cloud row's `updated_at`** — a
 *   Postgres-trigger-maintained, server-clock timestamp (see
 *   `20260715120300_user_settings.sql` / `20260715120400_calculator_memory.sql`),
 *   not a client clock, which can drift or be wrong across devices. Each
 *   time a fetch returns a row whose `updated_at` is newer than the last
 *   one this device has seen, that row's value is applied locally (only
 *   if it actually differs — never a no-op `setState`/push). Because
 *   `updated_at` is assigned by the database itself at write time, the
 *   "which change is newest" question always has one unambiguous, safe
 *   answer regardless of how many devices are pushing concurrently.
 * - A failed fetch for any one subsystem never blocks or skips the other
 *   three, and never surfaces an error to the person — it's silently
 *   retried on the next tick, exactly like every other sync hook's own
 *   self-healing behavior.
 *
 * **Guest Mode is untouched**: this hook's very first check in every
 * effect is `if (!userId || !configured) return;` — for a guest (or an
 * unconfigured Supabase project) it never starts a timer, registers a
 * listener, or makes a single network call. Guest data stays exactly what
 * it always was: localStorage-only.
 *
 * **Authentication is untouched**: this hook only ever *reads*
 * `useAuth()`'s existing `isAuthenticated`/`user.id` — nothing here calls
 * any sign-in/sign-out/session method, and no file under `src/lib/auth/`,
 * `src/contexts/auth-context.ts`, or `src/components/auth/` was touched to
 * add it.
 *
 * Meant to be mounted **once**, alongside the other four sync hooks, in
 * `SettingsApplier.tsx` (the single, app-wide mount point Task 22
 * established) — never inside `Calculator.tsx` or any other
 * page-specific component, which would start a second, duplicate timer.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { useHistory, type HistoryItem } from "./useHistory";
import { useMemory, type MemoryState } from "./useMemory";
import { useSettings, type Settings } from "./useSettings";
import { useFavorites, type FavoriteItem } from "./useFavorites";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchCloudHistory, pushHistoryToCloud } from "@/lib/supabase/historySync";
import { fetchCloudMemory } from "@/lib/supabase/memorySync";
import { fetchCloudSettings } from "@/lib/supabase/settingsSync";
import { fetchCloudFavorites, pushFavoritesToCloud } from "@/lib/supabase/favoritesSync";
import { recordSyncActivity } from "@/lib/backup/syncActivity";

export type MultiDeviceSyncStatus = "disabled" | "idle" | "checking" | "synced" | "error";

interface UseMultiDeviceSyncReturn {
  status: MultiDeviceSyncStatus;
}

/** How often to reconcile with the cloud while a signed-in session is open. */
const POLL_INTERVAL_MS = 20000;
/** Never re-check more often than this even if several triggers (focus + online + visibility) fire back to back. */
const MIN_RECHECK_GAP_MS = 4000;

/* ---------------------------------------------------------------------
 * Shared, read-only status + "last checked" stores — same
 * `useSyncExternalStore` shape every other sync hook in this project
 * already uses, so an optional UI indicator can subscribe without
 * mounting a second, duplicate copy of this hook's timers/effects.
 * ------------------------------------------------------------------- */
let sharedStatus: MultiDeviceSyncStatus = isSupabaseConfigured() ? "idle" : "disabled";
const statusListeners = new Set<() => void>();

function setSharedStatus(next: MultiDeviceSyncStatus): void {
  sharedStatus = next;
  statusListeners.forEach((listener) => listener());
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function getStatusSnapshot(): MultiDeviceSyncStatus {
  return sharedStatus;
}

function getStatusServerSnapshot(): MultiDeviceSyncStatus {
  return isSupabaseConfigured() ? "idle" : "disabled";
}

/** Read-only subscription to the single `useMultiDeviceSync()` instance's status. */
export function useMultiDeviceSyncStatus(): MultiDeviceSyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getStatusServerSnapshot);
}

let sharedLastCheckedAt: number | null = null;
const lastCheckedListeners = new Set<() => void>();

function setSharedLastCheckedAt(ms: number): void {
  sharedLastCheckedAt = ms;
  lastCheckedListeners.forEach((listener) => listener());
}

function subscribeLastChecked(listener: () => void): () => void {
  lastCheckedListeners.add(listener);
  return () => lastCheckedListeners.delete(listener);
}

function getLastCheckedSnapshot(): number | null {
  return sharedLastCheckedAt;
}

function getLastCheckedServerSnapshot(): number | null {
  return null;
}

/** Read-only: when this device last finished checking the cloud for changes from other devices, or `null` if it never has this session. */
export function useLastCrossDeviceCheckAt(): number | null {
  return useSyncExternalStore(subscribeLastChecked, getLastCheckedSnapshot, getLastCheckedServerSnapshot);
}

/** Snapshot of everything a reconciliation pass needs to read/write, refreshed every render via a ref so the interval callback below never closes over stale local state without re-creating the timer on every keystroke. */
interface LiveRefs {
  history: { items: HistoryItem[]; mergeCloudItems: (incoming: HistoryItem[]) => HistoryItem[] };
  favorites: { items: FavoriteItem[]; mergeCloudItems: (incoming: FavoriteItem[]) => FavoriteItem[] };
  memory: MemoryState & { setMemory: (next: MemoryState) => void };
  settings: Settings & { setSettings: (next: Settings) => void };
}

export function useMultiDeviceSync(): UseMultiDeviceSyncReturn {
  const auth = useAuth();
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<MultiDeviceSyncStatus>(configured ? "idle" : "disabled");

  const history = useHistory();
  const favorites = useFavorites();
  const memory = useMemory();
  const settings = useSettings();

  const liveRef = useRef<LiveRefs>({
    history: { items: history.items, mergeCloudItems: history.mergeCloudItems },
    favorites: { items: favorites.items, mergeCloudItems: favorites.mergeCloudItems },
    memory: { value: memory.value, hasMemory: memory.hasMemory, setMemory: memory.setMemory },
    settings: {
      theme: settings.theme,
      fontSize: settings.fontSize,
      soundEnabled: settings.soundEnabled,
      setSettings: settings.setSettings,
    },
  });
  useEffect(() => {
    liveRef.current = {
      history: { items: history.items, mergeCloudItems: history.mergeCloudItems },
      favorites: { items: favorites.items, mergeCloudItems: favorites.mergeCloudItems },
      memory: { value: memory.value, hasMemory: memory.hasMemory, setMemory: memory.setMemory },
      settings: {
        theme: settings.theme,
        fontSize: settings.fontSize,
        soundEnabled: settings.soundEnabled,
        setSettings: settings.setSettings,
      },
    };
  });

  // Server-clock `updated_at` of the most recent memory/settings row this
  // device has actually seen — the last-write-wins version marker. `null`
  // until the first successful check this session (deliberately *not*
  // seeded from anywhere else, so the first check after sign-in always
  // reads the cloud's current row once, but only *applies* it if it
  // genuinely differs from local — see the `differs` guards below).
  const memoryUpdatedAtRef = useRef<string | null>(null);
  const settingsUpdatedAtRef = useRef<string | null>(null);
  const lastRunAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  const applyStatus = useCallback((next: MultiDeviceSyncStatus) => {
    setStatus(next);
    setSharedStatus(next);
  }, []);

  const userId = auth.isAuthenticated ? (auth.user?.id ?? null) : null;

  const runCheck = useCallback(
    async (uid: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      applyStatus("checking");

      const supabase = createClient();
      let hadError = false;
      const live = liveRef.current;

      // --- History: safe union merge, never destructive. ---
      const historyResult = await fetchCloudHistory(supabase, uid);
      if (historyResult.ok) {
        const before = live.history.items.length;
        const merged = live.history.mergeCloudItems(historyResult.items);
        if (merged.length !== before) {
          void pushHistoryToCloud(supabase, uid, merged);
        }
      } else {
        hadError = true;
      }

      // --- Favorites: same union-merge pattern. ---
      const favoritesResult = await fetchCloudFavorites(supabase, uid);
      if (favoritesResult.ok) {
        const before = live.favorites.items.length;
        const merged = live.favorites.mergeCloudItems(favoritesResult.items);
        if (merged.length !== before) {
          void pushFavoritesToCloud(supabase, uid, merged);
        }
      } else {
        hadError = true;
      }

      // --- Calculator Memory: last-write-wins by server `updated_at`. ---
      const memoryResult = await fetchCloudMemory(supabase, uid);
      if (memoryResult.ok) {
        const cloudUpdatedAt = memoryResult.updatedAt;
        if (cloudUpdatedAt !== null && cloudUpdatedAt !== memoryUpdatedAtRef.current) {
          const local = live.memory;
          const differs =
            local.value !== memoryResult.state.value || local.hasMemory !== memoryResult.state.hasMemory;
          if (differs) local.setMemory(memoryResult.state);
          memoryUpdatedAtRef.current = cloudUpdatedAt;
        }
      } else {
        hadError = true;
      }

      // --- Theme/Settings: same last-write-wins-by-server-clock pattern. ---
      const settingsResult = await fetchCloudSettings(supabase, uid);
      if (settingsResult.ok) {
        const cloudUpdatedAt = settingsResult.updatedAt;
        if (settingsResult.settings && cloudUpdatedAt && cloudUpdatedAt !== settingsUpdatedAtRef.current) {
          const local = live.settings;
          const cloudSettings = settingsResult.settings;
          const differs =
            local.theme !== cloudSettings.theme ||
            local.fontSize !== cloudSettings.fontSize ||
            local.soundEnabled !== cloudSettings.soundEnabled;
          if (differs) local.setSettings(cloudSettings);
          settingsUpdatedAtRef.current = cloudUpdatedAt;
        }
      } else {
        hadError = true;
      }

      lastRunAtRef.current = Date.now();
      setSharedLastCheckedAt(lastRunAtRef.current);
      inFlightRef.current = false;
      if (hadError) {
        applyStatus("error");
      } else {
        applyStatus("synced");
        recordSyncActivity();
      }
    },
    [applyStatus],
  );

  // The actual polling loop: an interval while signed in, plus immediate
  // checks on the moments a person is most likely to have just switched
  // back from (or reconnected) another device. The very first tick is
  // delayed by a full `POLL_INTERVAL_MS` so it never races Tasks 15-18's
  // own restore-on-login effects (mounted alongside this hook, in the same
  // `SettingsApplier.tsx`), which already resolve the initial local/cloud
  // state the instant sign-in completes.
  useEffect(() => {
    if (!userId || !configured) return;

    const maybeRun = (): void => {
      if (Date.now() - lastRunAtRef.current < MIN_RECHECK_GAP_MS) return;
      void runCheck(userId);
    };

    const interval = setInterval(() => {
      // Skip a scheduled background tick while the tab isn't visible —
      // there's no one here to see a change land, and it just saves a
      // network round trip; the very next focus/visibility event (or the
      // next tick once it's visible again) still runs a real check.
      if (typeof document !== "undefined" && document.hidden) return;
      maybeRun();
    }, POLL_INTERVAL_MS);

    const onVisible = (): void => {
      if (typeof document !== "undefined" && !document.hidden) maybeRun();
    };
    const onFocus = (): void => maybeRun();
    const onOnline = (): void => maybeRun();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      window.addEventListener("online", onOnline);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("online", onOnline);
      }
    };
  }, [userId, configured, runCheck]);

  // Sign-out (or never having signed in): reset the version markers so a
  // future sign-in's checks start fresh rather than comparing against a
  // previous account's timestamps. Ref-only — no `setState` here, so the
  // guest/disabled status below is derived instead (avoids a synchronous
  // setState-in-effect render cascade, same convention every other sync
  // hook in this project already follows).
  useEffect(() => {
    if (userId) return;
    memoryUpdatedAtRef.current = null;
    settingsUpdatedAtRef.current = null;
    lastRunAtRef.current = 0;
  }, [userId]);

  // Guests (and an unconfigured Supabase project) always report a fixed,
  // derived status rather than whatever `status` last held from a
  // previous signed-in session.
  const effectiveStatus: MultiDeviceSyncStatus = !userId ? (configured ? "idle" : "disabled") : status;

  useEffect(() => {
    setSharedStatus(effectiveStatus);
  }, [effectiveStatus]);

  return { status: effectiveStatus };
}
