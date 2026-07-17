"use client";

/**
 * Calculator Memory Cloud Sync — orchestration hook.
 *
 * Wires `useMemory.ts`'s local, localStorage-backed register to
 * `src/lib/supabase/memorySync.ts`'s Supabase read/write layer, entirely
 * additively: nothing about `useMemory()`'s (or, by extension,
 * `useCalculator()`'s) existing API changed, and any component that only
 * reads/writes memory through them (MemoryBar, the keyboard M+/M-/MR/MC
 * shortcuts, …) behaves exactly as it did before this hook existed.
 *
 * Behavior (deliberately mirrors `useHistorySync.ts`'s conventions):
 * - **Guest Mode is untouched.** This hook is a no-op whenever
 *   `!auth.isAuthenticated` (including while `status === "initializing"`)
 *   or Supabase isn't configured — guest memory stays exactly what it
 *   always was, localStorage-only via `useMemory.ts`, synced across tabs
 *   but never the cloud.
 * - **Restore after login** (once per signed-in session/user id): fetches
 *   this user's cloud memory row. If the cloud already holds a value
 *   (`hasMemory: true` — i.e. this account synced a value from another
 *   session/device before), that cloud value wins and overwrites whatever
 *   is local, since it represents the account's last-known memory. If the
 *   cloud is still at its freshly-provisioned default (`hasMemory: false`)
 *   but a local/guest value already exists, the local value wins instead —
 *   so a value built up in Guest Mode before signing in for the first time
 *   is never silently dropped. Either way the resolved value is written
 *   back to `useMemory()` and pushed to the cloud, so a second device
 *   signing into the same account sees it too.
 * - **Automatic ongoing sync**: a second effect watches the local memory
 *   state and, whenever authenticated, pushes it to the cloud on an 800ms
 *   debounce (so a rapid string of M+ presses doesn't fire a network
 *   request per press). Guarded to only start once the initial restore has
 *   finished, so it can't race a push of a stale, pre-restore value.
 * - **Never blocks or throws.** A network failure, an unconfigured
 *   Supabase project, or an RLS/auth error just leaves `status` as
 *   `"error"` — the calculator and its local memory keep working exactly
 *   as before; the next successful change/reconnect retries automatically.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { useMemory } from "./useMemory";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchCloudMemory, pushMemoryToCloud } from "@/lib/supabase/memorySync";
import { recordBackupSuccess } from "@/lib/backup/backupTimestamps";

export type MemorySyncStatus =
  /** No Supabase project configured — cloud sync isn't available at all. */
  | "disabled"
  /** Guest Mode, or signed in but nothing has triggered a sync yet. */
  | "idle"
  /** Fetching + resolving cloud memory right after sign-in. */
  | "restoring"
  /** Pushing a local change up to the cloud. */
  | "syncing"
  /** Local and cloud memory are known to match as of the last sync. */
  | "synced"
  /** The most recent restore/push attempt failed (network, RLS, etc). */
  | "error";

interface UseMemorySyncReturn {
  status: MemorySyncStatus;
}

const PUSH_DEBOUNCE_MS = 800;

/* ---------------------------------------------------------------------
 * Shared, read-only status store — lets `useMemorySyncStatus()` (below,
 * used by the new Cloud Backup UI in Task 19) expose this hook's status to
 * any number of consumers without mounting a second, duplicate copy of the
 * restore/push effects. Same pattern `useSettingsSync.ts` established.
 * ------------------------------------------------------------------- */
let sharedStatus: MemorySyncStatus = isSupabaseConfigured() ? "idle" : "disabled";
const statusListeners = new Set<() => void>();

function setSharedStatus(next: MemorySyncStatus): void {
  sharedStatus = next;
  statusListeners.forEach((listener) => listener());
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function getStatusSnapshot(): MemorySyncStatus {
  return sharedStatus;
}

function getStatusServerSnapshot(): MemorySyncStatus {
  return isSupabaseConfigured() ? "idle" : "disabled";
}

/**
 * Read-only subscription to the single `useMemorySync()` instance's status
 * (mounted once in `SettingsApplier.tsx` as of Task 22). Safe to call from any number of
 * components — never starts a new restore/push cycle itself.
 */
export function useMemorySyncStatus(): MemorySyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getStatusServerSnapshot);
}

export function useMemorySync(): UseMemorySyncReturn {
  const auth = useAuth();
  const { value, hasMemory, setMemory } = useMemory();
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<MemorySyncStatus>(configured ? "idle" : "disabled");

  const applyStatus = useCallback((next: MemorySyncStatus) => {
    setStatus(next);
    setSharedStatus(next);
  }, []);

  // Tracks the user id this hook has already restored cloud memory for, so
  // a re-render (e.g. the memory value changing) doesn't re-trigger a full
  // restore — only an actual sign-in (a new/changed user id) does.
  const restoredForUserRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the latest local state for the restore effect to read without
  // depending on `value`/`hasMemory` directly (which would re-run restore
  // on every memory change instead of only on sign-in).
  const localRef = useRef<{ value: number; hasMemory: boolean }>({ value, hasMemory });
  useEffect(() => {
    localRef.current = { value, hasMemory };
  }, [value, hasMemory]);

  const userId = auth.isAuthenticated ? (auth.user?.id ?? null) : null;

  // Restore-on-login: fetch this user's cloud memory once per signed-in
  // user id, resolve it against whatever's local (cloud wins if it already
  // holds a value; otherwise the local/guest value wins), write the result
  // into the local store, then push it back up so a second device — or the
  // cloud itself, the first time — ends up with the same resolved value.
  useEffect(() => {
    if (!userId || !configured) return;
    if (restoredForUserRef.current === userId) return;

    let cancelled = false;

    async function restore(uid: string): Promise<void> {
      applyStatus("restoring");
      const supabase = createClient();
      const result = await fetchCloudMemory(supabase, uid);
      if (cancelled) return;

      if (!result.ok) {
        applyStatus("error");
        return;
      }

      const resolved = result.state.hasMemory ? result.state : localRef.current;

      // Mark restored before the follow-up push so the debounced push
      // effect below (which waits on this same ref) doesn't skip it.
      restoredForUserRef.current = uid;
      setMemory(resolved);
      const pushResult = await pushMemoryToCloud(supabase, uid, resolved);
      if (cancelled) return;
      applyStatus(pushResult.ok ? "synced" : "error");
      if (pushResult.ok) recordBackupSuccess("memory");
    }

    void restore(userId);
    return () => {
      cancelled = true;
    };
  }, [userId, configured, setMemory, applyStatus]);

  // Ongoing sync: any local memory change, while signed in, is mirrored to
  // the cloud on a short debounce (so a rapid string of M+ presses doesn't
  // fire a network call per press).
  useEffect(() => {
    if (!userId || !configured) return;
    // Wait for the initial restore to finish first, so this doesn't race
    // it with a push of the pre-resolve (possibly stale) local value.
    if (restoredForUserRef.current !== userId) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyStatus("syncing");
      const supabase = createClient();
      void pushMemoryToCloud(supabase, userId, { value, hasMemory }).then((result) => {
        applyStatus(result.ok ? "synced" : "error");
        if (result.ok) recordBackupSuccess("memory");
      });
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, configured, value, hasMemory, applyStatus]);

  // Sign-out (or never having signed in): reset the "already restored" flag
  // so a future sign-in restores again. This is a ref reset only — no
  // setState here, so the guest/disabled status below is derived instead
  // (avoids a synchronous setState-in-effect render cascade, same as
  // useHistorySync.ts).
  useEffect(() => {
    if (userId) return;
    restoredForUserRef.current = null;
  }, [userId]);

  // Guests (and an unconfigured Supabase project) always report a fixed,
  // derived status rather than whatever `status` last held from a previous
  // signed-in session — e.g. signing out shouldn't leave a stale "synced"
  // badge showing.
  const effectiveStatus: MemorySyncStatus = !userId
    ? configured
      ? "idle"
      : "disabled"
    : status;

  // Keep the shared, read-only store (for `useMemorySyncStatus()`
  // subscribers, e.g. the Cloud Backup panel) in step with the derived
  // guest/disabled status too, not just the restore/push effects' explicit
  // transitions above.
  useEffect(() => {
    setSharedStatus(effectiveStatus);
  }, [effectiveStatus]);

  return { status: effectiveStatus };
}
