"use client";

/**
 * Calculator memory (M+/M-/MR/MC) register — localStorage-backed store.
 *
 * Before this task the M+/M-/MR/MC register lived only in `useCalculator.ts`'s
 * React state (`useState`): it reset to 0/empty on every page reload and was
 * never persisted anywhere, not even `localStorage` (unlike history/settings,
 * which have used `localStorage` since Tasks 2/6). This file gives it the
 * same `useSyncExternalStore` + `localStorage` treatment `useHistory.ts`/
 * `useSettings.ts` already use, so:
 *
 * - **Guest Mode** now keeps the memory value across reloads and in sync
 *   across tabs, purely via `localStorage` — no network involved, exactly
 *   like history/settings already work for guests.
 * - **Signed-in users** get the same local store, but `useMemorySync.ts`
 *   additionally mirrors it to/from Supabase's `calculator_memory` table
 *   (restore on login, debounced push on change) — see that file.
 *
 * `useCalculator.ts` now reads/writes memory through this store instead of
 * its own `useState`, so its public API (`memory`, `hasMemory`, `memoryAdd`,
 * `memorySubtract`, `memoryRecall`, `memoryClear`) is completely unchanged —
 * every existing consumer (`MemoryBar.tsx`, keyboard shortcuts, etc.) keeps
 * working exactly as before.
 */

import { useCallback, useSyncExternalStore } from "react";

export interface MemoryState {
  value: number;
  hasMemory: boolean;
}

const STORAGE_KEY = "ahmed-calc:memory:v1";
const EVENT = "ahmed-calc:memory-change";

const DEFAULTS: MemoryState = { value: 0, hasMemory: false };

/**
 * SSR-safe cache of the value read from localStorage, refreshed whenever the
 * store mutates (via a custom event) or another tab writes to storage —
 * same pattern as `useHistory.ts`/`useSettings.ts`.
 */
let cache: MemoryState | null = null;
const listeners = new Set<() => void>();

function isValidState(value: unknown): value is MemoryState {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MemoryState).value === "number" &&
    Number.isFinite((value as MemoryState).value) &&
    typeof (value as MemoryState).hasMemory === "boolean"
  );
}

function readFromStorage(): MemoryState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed) ? parsed : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function refreshCache(): void {
  cache = readFromStorage();
}

function getSnapshot(): MemoryState {
  if (cache === null) refreshCache();
  return cache as MemoryState;
}

function getServerSnapshot(): MemoryState {
  return DEFAULTS;
}

function writeToStorage(next: MemoryState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be full or unavailable — fail silently, same as
    // useHistory.ts/useSettings.ts.
  }
}

function emitChange(next: MemoryState): void {
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

export interface UseMemoryReturn extends MemoryState {
  /** M+ — adds `amount` to the stored value and marks memory as set. */
  add: (amount: number) => void;
  /** M− — subtracts `amount` from the stored value and marks memory as set. */
  subtract: (amount: number) => void;
  /** MC — resets to the empty (0, unset) state. */
  clear: () => void;
  /**
   * Replace the full memory state in one shot. Used by `useMemorySync.ts`
   * to apply a value restored from the cloud after sign-in — a full
   * overwrite, unlike `add`/`subtract`, which are relative register ops.
   */
  setMemory: (next: MemoryState) => void;
}

export function useMemory(): UseMemoryReturn {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((amount: number) => {
    const current = getSnapshot();
    emitChange({ value: current.value + amount, hasMemory: true });
  }, []);

  const subtract = useCallback((amount: number) => {
    const current = getSnapshot();
    emitChange({ value: current.value - amount, hasMemory: true });
  }, []);

  const clear = useCallback(() => {
    emitChange(DEFAULTS);
  }, []);

  const setMemory = useCallback((next: MemoryState) => {
    emitChange(next);
  }, []);

  return { ...state, add, subtract, clear, setMemory };
}
