"use client";

/**
 * Favorites — local, localStorage-backed store.
 *
 * Task 13 created a cloud-only `favorites` table with no local counterpart —
 * nothing in the app read or wrote to it. This hook is the missing local
 * feature: a starred-calculation shelf, following the exact same
 * `useSyncExternalStore` + localStorage conventions `useHistory.ts` already
 * established (same event-based cross-tab sync, same SSR-safe snapshot
 * caching), so it behaves identically for Guest Mode.
 *
 * Scope for this task: only `kind: "calculation"` is wired up in the UI
 * (starring a history item via `HistoryPanel.tsx`'s new star toggle). The
 * `FavoriteItem` shape and cloud sync layer (`useFavoritesSync.ts`,
 * `src/lib/supabase/favoritesSync.ts`) fully support the `"conversion"` kind
 * too, matching Task 13's `favorites` table shape column-for-column — this
 * hook and its cloud counterpart are ready for a future "star a
 * conversion" feature in the Converter panel without needing another schema
 * or storage-format change, but this task deliberately doesn't add that UI
 * (out of scope; the Converter panel is untouched).
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { genId } from "@/lib/calculator";

export type FavoriteKind = "calculation" | "conversion";
export type FavoriteConversionCategory = "length" | "weight" | "temperature" | "currency";

export interface FavoriteItem {
  id: string;
  kind: FavoriteKind;
  /** Set when `kind === "calculation"`; null for a conversion favorite. */
  expression: string | null;
  /** Set when `kind === "calculation"`; null for a conversion favorite. */
  result: string | null;
  /** Set when `kind === "conversion"`; null for a calculation favorite. */
  conversionCategory: FavoriteConversionCategory | null;
  /** Set when `kind === "conversion"`; null for a calculation favorite. */
  fromUnit: string | null;
  /** Set when `kind === "conversion"`; null for a calculation favorite. */
  toUnit: string | null;
  label: string;
  timestamp: number;
}

const STORAGE_KEY = "ahmed-calc:favorites:v1";
const MAX_ITEMS = 200;
const EVENT = "ahmed-calc:favorites-change";
const EMPTY_ITEMS: FavoriteItem[] = [];

interface UseFavoritesReturn {
  items: FavoriteItem[];
  /** True if a calculation with this exact expression + result is already starred. */
  isFavoriteCalculation: (expression: string, result: string) => boolean;
  /** Stars the calculation if it isn't already favorited, otherwise un-stars it. */
  toggleCalculation: (expression: string, result: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  updateLabel: (id: string, label: string) => void;
  /**
   * Merge full `FavoriteItem`s restored from the cloud (see
   * `src/hooks/useFavoritesSync.ts`) into the local store, **preserving
   * their existing `id`s** so a subsequent sync upserts in place instead of
   * duplicating the row. Dedupes by id first, then by the same
   * kind+expression+result/fromUnit+toUnit+timestamp key, sorts newest-first,
   * and caps at `MAX_ITEMS`. Returns the resulting full, merged list so the
   * caller can push it straight back to the cloud without a second read.
   */
  mergeCloudItems: (incoming: FavoriteItem[]) => FavoriteItem[];
  /**
   * Replaces the entire local favorites list with `items` (Task 21's
   * "Restore Backup" — the cloud's last-known list wins outright, unlike
   * `mergeCloudItems`, which folds cloud items into whatever's local).
   * Still sorts newest-first and caps at `MAX_ITEMS`, same as every other
   * write path here. Used only by an explicit, user-initiated restore.
   */
  replaceAll: (items: FavoriteItem[]) => void;
}

/**
 * SSR-safe cache of the items read from localStorage, mirrored via a custom
 * event so every `useFavorites()` instance (and cross-tab `storage` events)
 * stays in sync — identical pattern to `useHistory.ts`.
 */
let cache: FavoriteItem[] | null = null;
const listeners = new Set<() => void>();

function isValidItem(value: unknown): value is FavoriteItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as FavoriteItem;
  return (
    typeof v.id === "string" &&
    (v.kind === "calculation" || v.kind === "conversion") &&
    (v.expression === null || typeof v.expression === "string") &&
    (v.result === null || typeof v.result === "string") &&
    (v.conversionCategory === null || typeof v.conversionCategory === "string") &&
    (v.fromUnit === null || typeof v.fromUnit === "string") &&
    (v.toUnit === null || typeof v.toUnit === "string") &&
    typeof v.label === "string" &&
    typeof v.timestamp === "number"
  );
}

function readFromStorage(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

function refreshCache(): void {
  cache = readFromStorage();
}

function getSnapshot(): FavoriteItem[] {
  if (cache === null) refreshCache();
  return cache as FavoriteItem[];
}

function getServerSnapshot(): FavoriteItem[] {
  return EMPTY_ITEMS;
}

function emitChange(): void {
  refreshCache();
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

function writeToStorage(items: FavoriteItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage may be full or unavailable — fail silently.
  }
}

/** Dedup key used both for local dedup and for matching a cloud item back to a local one. */
function itemKey(item: FavoriteItem): string {
  return [
    item.kind,
    item.expression ?? "",
    item.result ?? "",
    item.conversionCategory ?? "",
    item.fromUnit ?? "",
    item.toUnit ?? "",
    item.timestamp,
  ].join("\u0000");
}

export function useFavorites(): UseFavoritesReturn {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const itemsRef = useRef<FavoriteItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const isFavoriteCalculation = useCallback(
    (expression: string, result: string): boolean => {
      return itemsRef.current.some(
        (item) => item.kind === "calculation" && item.expression === expression && item.result === result,
      );
    },
    [],
  );

  const toggleCalculation = useCallback((expression: string, result: string) => {
    if (!expression || !result) return;
    const existing = itemsRef.current.find(
      (item) => item.kind === "calculation" && item.expression === expression && item.result === result,
    );
    if (existing) {
      const next = itemsRef.current.filter((item) => item.id !== existing.id);
      writeToStorage(next);
      emitChange();
      return;
    }
    const item: FavoriteItem = {
      id: genId(),
      kind: "calculation",
      expression,
      result,
      conversionCategory: null,
      fromUnit: null,
      toUnit: null,
      label: "",
      timestamp: Date.now(),
    };
    const next = [item, ...itemsRef.current].slice(0, MAX_ITEMS);
    writeToStorage(next);
    emitChange();
  }, []);

  const mergeCloudItems = useCallback((incoming: FavoriteItem[]): FavoriteItem[] => {
    const existing = itemsRef.current;
    if (incoming.length === 0) return existing;

    const existingIds = new Set(existing.map((item) => item.id));
    const seenKeys = new Set(existing.map(itemKey));
    const toAdd: FavoriteItem[] = [];
    for (const item of incoming) {
      if (existingIds.has(item.id)) continue;
      const key = itemKey(item);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      existingIds.add(item.id);
      toAdd.push(item);
    }
    if (toAdd.length === 0) return existing;

    const merged = [...toAdd, ...existing]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_ITEMS);

    writeToStorage(merged);
    emitChange();
    return merged;
  }, []);

  const remove = useCallback((id: string) => {
    const next = itemsRef.current.filter((item) => item.id !== id);
    writeToStorage(next);
    emitChange();
  }, []);

  const clear = useCallback(() => {
    writeToStorage([]);
    emitChange();
  }, []);

  const updateLabel = useCallback((id: string, label: string) => {
    const next = itemsRef.current.map((item) =>
      item.id === id ? { ...item, label: label.slice(0, 80) } : item,
    );
    writeToStorage(next);
    emitChange();
  }, []);

  const replaceAll = useCallback((incoming: FavoriteItem[]) => {
    const next = [...incoming].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ITEMS);
    writeToStorage(next);
    emitChange();
  }, []);

  return {
    items,
    isFavoriteCalculation,
    toggleCalculation,
    remove,
    clear,
    updateLabel,
    mergeCloudItems,
    replaceAll,
  };
}
