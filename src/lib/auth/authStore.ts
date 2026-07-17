"use client";

/**
 * Local-first auth store.
 *
 * Mirrors the `useSyncExternalStore` pattern already established by
 * `useSettings.ts` and `useHistory.ts` in this project: SSR-safe, stays in
 * sync across tabs via the `storage` event, and never suspends rendering
 * while it settles. `SessionProvider` (src/components/auth/SessionProvider.tsx)
 * is the only consumer expected — everything else should go through
 * `useAuth()`.
 */

import type { AuthRecord, AuthSession } from "./types";

const STORAGE_KEY = "ahmed-calc:auth:v1";
const EVENT = "ahmed-calc:auth-change";

function genGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest_${crypto.randomUUID()}`;
  }
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function defaults(): AuthRecord {
  return { guestId: genGuestId(), session: null };
}

function isValidSession(value: unknown): value is AuthSession {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<AuthSession>;
  return (
    typeof s.token === "string" &&
    typeof s.expiresAt === "string" &&
    typeof s.user === "object" &&
    s.user !== null
  );
}

let cache: AuthRecord | null = null;

function readFromStorage(): AuthRecord {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = defaults();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return defaults();
    const p = parsed as Partial<AuthRecord>;
    if (typeof p.guestId !== "string" || !p.guestId) {
      const fresh = defaults();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return {
      guestId: p.guestId,
      session: isValidSession(p.session) ? p.session : null,
    };
  } catch {
    return defaults();
  }
}

function refreshCache(): void {
  cache = readFromStorage();
}

/** `useSyncExternalStore` getSnapshot. */
export function getAuthSnapshot(): AuthRecord {
  if (cache === null) refreshCache();
  return cache as AuthRecord;
}

/**
 * `useSyncExternalStore` getServerSnapshot. The server render always
 * starts guest-only with a placeholder id; the real `guestId`/`session`
 * are reconciled on the client after mount — same SSR strategy already
 * used by `useSettings.ts`/`useHistory.ts` in this project.
 */
export function getAuthServerSnapshot(): AuthRecord {
  return { guestId: "guest_ssr", session: null };
}

const listeners = new Set<() => void>();

function persist(next: AuthRecord): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      // Task 33 (production security audit): never persist the raw
      // bearer/session token to localStorage. Nothing in this app reads
      // `session.token` — the Supabase browser client manages its own,
      // cookie-backed session for every actual authenticated request
      // (see `src/lib/supabase/client.ts`/`server.ts`) — so writing the
      // JWT to disk-backed storage adds real exposure (readable by any
      // future XSS, or by anything with local disk access) for zero
      // functional benefit. The in-memory `cache` above still holds the
      // full session (including `token`) for this tab/page-load; only
      // the copy written to storage is redacted.
      const forStorage: AuthRecord = {
        ...next,
        session: next.session ? { ...next.session, token: "" } : null,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(forStorage));
    } catch {
      // Ignore quota/private-mode errors, mirrors useSettings.ts.
    }
    window.dispatchEvent(new Event(EVENT));
  }
  listeners.forEach((l) => l());
}

/** Adopts (or clears, via `null`) an account session. Guest id is untouched. */
export function setAuthSession(session: AuthSession | null): void {
  persist({ ...getAuthSnapshot(), session });
}

export function subscribeAuth(listener: () => void): () => void {
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
