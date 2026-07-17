"use client";

import { useCallback, useSyncExternalStore } from "react";

/** What actually lives in `localStorage` for this store. */
export interface ProfileOverrides {
  /**
   * A user-chosen display name for this device. Overrides the name a
   * Google/GitHub sign-in provides (or, in Guest Mode, is the only name
   * there is). `null` means "use the provider's name" / "no nickname set".
   */
  displayName: string | null;
  /**
   * A small, client-resized `data:` URL the person uploaded from the
   * Profile page. Overrides the OAuth provider's avatar when set.
   */
  avatarDataUrl: string | null;
}

interface UseProfileReturn extends ProfileOverrides {
  setDisplayName: (name: string | null) => void;
  setAvatarDataUrl: (dataUrl: string | null) => void;
  reset: () => void;
}

const STORAGE_KEY = "ahmed-calc:profile:v1";
const EVENT = "ahmed-calc:profile-change";
const MAX_AVATAR_LENGTH = 400_000; // ~400KB of base64, generous ceiling for a 256px JPEG

const DEFAULTS: ProfileOverrides = {
  displayName: null,
  avatarDataUrl: null,
};

let cache: ProfileOverrides | null = null;

function readFromStorage(): ProfileOverrides {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const p = parsed as Partial<ProfileOverrides>;
    return {
      displayName:
        typeof p.displayName === "string" && p.displayName.trim() ? p.displayName.trim() : null,
      avatarDataUrl:
        typeof p.avatarDataUrl === "string" &&
        p.avatarDataUrl.startsWith("data:image/") &&
        p.avatarDataUrl.length <= MAX_AVATAR_LENGTH
          ? p.avatarDataUrl
          : null,
    };
  } catch {
    return DEFAULTS;
  }
}

function refreshCache(): void {
  cache = readFromStorage();
}

function getSnapshot(): ProfileOverrides {
  if (cache === null) refreshCache();
  return cache as ProfileOverrides;
}

function getServerSnapshot(): ProfileOverrides {
  return DEFAULTS;
}

const listeners = new Set<() => void>();

function emitChange(next: ProfileOverrides): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota/private-mode errors, mirrors useSettings.ts/authStore.ts.
    }
    window.dispatchEvent(new Event(EVENT));
  }
  listeners.forEach((l) => l());
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
    listeners.forEach((l) => l());
  }
}

/**
 * Local-first profile overrides for the Profile page (`/profile`): a
 * display name and/or avatar photo the person sets on this device,
 * layered on top of whatever a Google/GitHub sign-in already provided —
 * or, in Guest Mode, the only identity there is.
 *
 * Mirrors the exact `useSyncExternalStore` + `localStorage` pattern
 * `useSettings.ts`, `useHistory.ts`, and `src/lib/auth/authStore.ts`
 * already established in this project (SSR-safe, cross-tab sync via the
 * `storage` event), under its own `ahmed-calc:profile:v1` key.
 *
 * Deliberately local-only: this does not write to Supabase's `profiles`
 * table (see `supabase/migrations/20260715120100_profiles.sql`) or any
 * other backend — consistent with every prior task's explicit choice to
 * keep the calculator's data local-first regardless of sign-in state.
 */
export function useProfile(): UseProfileReturn {
  const overrides = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setDisplayName = useCallback((name: string | null) => {
    const trimmed = name?.trim() || null;
    emitChange({ ...getSnapshot(), displayName: trimmed });
  }, []);

  const setAvatarDataUrl = useCallback((dataUrl: string | null) => {
    emitChange({ ...getSnapshot(), avatarDataUrl: dataUrl });
  }, []);

  const reset = useCallback(() => {
    emitChange(DEFAULTS);
  }, []);

  return { ...overrides, setDisplayName, setAvatarDataUrl, reset };
}
