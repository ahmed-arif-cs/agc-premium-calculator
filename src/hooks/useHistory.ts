"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { genId } from "@/lib/calculator";

export interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  label: string;
  timestamp: number;
}

const STORAGE_KEY = "ahmed-calc:history:v1";
const MAX_ITEMS = 100;
const EVENT = "ahmed-calc:history-change";
const EMPTY_ITEMS: HistoryItem[] = [];

/** Shape of a single item accepted by `addMany` (e.g. from an imported JSON file). */
export interface ImportableHistoryItem {
  expression: string;
  result: string;
  label: string;
  timestamp: number;
}

interface UseHistoryReturn {
  items: HistoryItem[];
  add: (expression: string, result: string) => void;
  addMany: (incoming: ImportableHistoryItem[]) => number;
  remove: (id: string) => void;
  clear: () => void;
  updateLabel: (id: string, label: string) => void;
  /**
   * Merge full `HistoryItem`s restored from the cloud (see
   * `src/hooks/useHistorySync.ts`) into the local store, **preserving their
   * existing `id`s** (unlike `addMany`, which mints fresh ids for imported
   * rows). Preserving the id keeps it aligned with the cloud row's
   * `local_id`, so a subsequent sync upserts in place instead of
   * duplicating the row. Dedupes by id first, then by the same
   * expression+result+timestamp key `addMany` uses, sorts newest-first, and
   * caps at `MAX_ITEMS`. Returns the resulting full, merged list so the
   * caller can push it straight back to the cloud without a second read.
   */
  mergeCloudItems: (incoming: HistoryItem[]) => HistoryItem[];
  /**
   * Replaces the entire local history with `items` (Task 21's "Restore
   * Backup" — the cloud's last-known list wins outright, unlike
   * `mergeCloudItems`, which folds cloud items into whatever's local).
   * Still sorts newest-first and caps at `MAX_ITEMS`, same as every other
   * write path here. Used only by an explicit, user-initiated restore.
   */
  replaceAll: (items: HistoryItem[]) => void;
}

/**
 * SSR-safe cache of the items read from localStorage. Because `useSyncExternalStore`
 * needs a synchronous `getSnapshot`, we keep an in-memory mirror that is refreshed
 * whenever the store mutates (via a custom event) or another tab writes to storage.
 */
let cache: HistoryItem[] | null = null;
const listeners = new Set<() => void>();

function isValidItem(value: unknown): value is HistoryItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HistoryItem).id === "string" &&
    typeof (value as HistoryItem).expression === "string" &&
    typeof (value as HistoryItem).result === "string" &&
    typeof (value as HistoryItem).label === "string" &&
    typeof (value as HistoryItem).timestamp === "number"
  );
}

function readFromStorage(): HistoryItem[] {
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

function getSnapshot(): HistoryItem[] {
  if (cache === null) refreshCache();
  return cache as HistoryItem[];
}

function getServerSnapshot(): HistoryItem[] {
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

function writeToStorage(items: HistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage may be full or unavailable — fail silently.
  }
}

export function useHistory(): UseHistoryReturn {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep an up-to-date local copy so mutation helpers can build the next list
  // without re-reading localStorage on every render.
  const itemsRef = useRef<HistoryItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const add = useCallback((expression: string, result: string) => {
    if (!expression || !result) return;
    const item: HistoryItem = {
      id: genId(),
      expression,
      result,
      label: "",
      timestamp: Date.now(),
    };
    const next = [item, ...itemsRef.current].slice(0, MAX_ITEMS);
    writeToStorage(next);
    emitChange();
  }, []);

  /**
   * Merge externally-sourced items (e.g. from an imported export file) into the
   * store. Duplicates — same expression + result + timestamp as an existing or
   * already-queued item — are skipped. The merged list is sorted newest-first
   * and capped at MAX_ITEMS, so the oldest entries are the ones dropped first.
   * Returns how many items actually ended up persisted (post dedupe + cap).
   */
  const addMany = useCallback((incoming: ImportableHistoryItem[]): number => {
    if (incoming.length === 0) return 0;
    const existing = itemsRef.current;
    const seen = new Set(
      existing.map((item) => `${item.expression}\u0000${item.result}\u0000${item.timestamp}`),
    );
    const toAdd: HistoryItem[] = [];
    for (const raw of incoming) {
      const key = `${raw.expression}\u0000${raw.result}\u0000${raw.timestamp}`;
      if (seen.has(key)) continue;
      seen.add(key);
      toAdd.push({
        id: genId(),
        expression: raw.expression,
        result: raw.result,
        label: raw.label.slice(0, 80),
        timestamp: raw.timestamp,
      });
    }
    if (toAdd.length === 0) return 0;

    const merged = [...toAdd, ...existing]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_ITEMS);

    const addedIds = new Set(toAdd.map((item) => item.id));
    const actuallyAdded = merged.reduce((n, item) => (addedIds.has(item.id) ? n + 1 : n), 0);

    writeToStorage(merged);
    emitChange();
    return actuallyAdded;
  }, []);

  const mergeCloudItems = useCallback((incoming: HistoryItem[]): HistoryItem[] => {
    const existing = itemsRef.current;
    if (incoming.length === 0) return existing;

    const existingIds = new Set(existing.map((item) => item.id));
    const seenKeys = new Set(
      existing.map((item) => `${item.expression}\u0000${item.result}\u0000${item.timestamp}`),
    );
    const toAdd: HistoryItem[] = [];
    for (const item of incoming) {
      if (existingIds.has(item.id)) continue;
      const key = `${item.expression}\u0000${item.result}\u0000${item.timestamp}`;
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

  const replaceAll = useCallback((incoming: HistoryItem[]) => {
    const next = [...incoming].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ITEMS);
    writeToStorage(next);
    emitChange();
  }, []);

  return {
    items,
    add,
    addMany,
    remove,
    clear,
    updateLabel,
    mergeCloudItems,
    replaceAll,
  };
}
