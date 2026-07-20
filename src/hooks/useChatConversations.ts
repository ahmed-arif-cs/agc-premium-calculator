"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ChatUIMessage } from "@/components/chat/types";

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatUIMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "agc-ai-chat-conversations-v1";
const ACTIVE_KEY = "agc-ai-chat-active-id-v1";
// Legacy single-conversation keys — migrated once on first load, then unused.
const LEGACY_HISTORY_KEY = "agc-ai-chat-history-v1";
const LEGACY_CONVERSATION_ID_KEY = "agc-ai-chat-conversation-id-v1";

const MAX_CONVERSATIONS = 100;
const EVENT = "agc-ai-chat-conversations-change";
const EMPTY: ChatConversation[] = [];

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isValidMessage(value: unknown): value is ChatUIMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<ChatUIMessage>;
  return (
    typeof m.id === "string" &&
    typeof m.content === "string" &&
    typeof m.createdAt === "number" &&
    (m.role === "user" || m.role === "assistant" || m.role === "system")
  );
}

function isValidConversation(value: unknown): value is ChatConversation {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<ChatConversation>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    Array.isArray(c.messages) &&
    c.messages.every(isValidMessage) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number"
  );
}

function deriveTitle(messages: ChatUIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim().length > 0);
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

let cache: ChatConversation[] | null = null;
let activeIdCache: string | null = null;
const listeners = new Set<() => void>();

function readConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isValidConversation);
    }
  } catch {
    /* fall through to migration/empty */
  }

  // One-time migration from the old single-conversation storage, so
  // whatever conversation was already saved doesn't get lost.
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_HISTORY_KEY);
    if (legacyRaw) {
      const parsedMessages: unknown = JSON.parse(legacyRaw);
      if (Array.isArray(parsedMessages)) {
        const messages = parsedMessages.filter(isValidMessage);
        if (messages.length > 0) {
          const legacyId = window.localStorage.getItem(LEGACY_CONVERSATION_ID_KEY) || genId();
          const now = Date.now();
          const migrated: ChatConversation[] = [
            { id: legacyId, title: deriveTitle(messages), messages, createdAt: now, updatedAt: now },
          ];
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          window.localStorage.setItem(ACTIVE_KEY, legacyId);
          window.localStorage.removeItem(LEGACY_HISTORY_KEY);
          window.localStorage.removeItem(LEGACY_CONVERSATION_ID_KEY);
          return migrated;
        }
      }
    }
  } catch {
    /* ignore — start empty */
  }

  return [];
}

function readActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function refreshCache(): void {
  cache = readConversations();
  activeIdCache = readActiveId();
}

function getSnapshot(): ChatConversation[] {
  if (cache === null) refreshCache();
  return cache as ChatConversation[];
}
function getServerSnapshot(): ChatConversation[] {
  return EMPTY;
}
function getActiveIdSnapshot(): string | null {
  if (cache === null) refreshCache();
  return activeIdCache;
}
function getActiveIdServerSnapshot(): string | null {
  return null;
}

function emitChange(): void {
  refreshCache();
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
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
  if (event.key === STORAGE_KEY || event.key === ACTIVE_KEY) {
    refreshCache();
    listeners.forEach((l) => l());
  }
}

function writeConversations(list: ChatConversation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage full/unavailable — fail silently */
  }
}
function writeActiveId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export interface UseChatConversationsReturn {
  conversations: ChatConversation[];
  activeId: string | null;
  activeMessages: ChatUIMessage[];
  setActiveId: (id: string) => void;
  newConversation: () => string;
  updateActiveMessages: (messages: ChatUIMessage[]) => void;
  removeConversation: (id: string) => void;
  clearAll: () => void;
}

export function useChatConversations(): UseChatConversationsReturn {
  const conversations = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const activeId = useSyncExternalStore(subscribe, getActiveIdSnapshot, getActiveIdServerSnapshot);

  const conversationsRef = useRef<ChatConversation[]>(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const setActiveId = useCallback((id: string) => {
    writeActiveId(id);
    emitChange();
  }, []);

  const newConversation = useCallback((): string => {
    const id = genId();
    const now = Date.now();
    const conv: ChatConversation = { id, title: "New chat", messages: [], createdAt: now, updatedAt: now };
    const next = [conv, ...conversationsRef.current].slice(0, MAX_CONVERSATIONS);
    writeConversations(next);
    writeActiveId(id);
    emitChange();
    return id;
  }, []);

  const updateActiveMessages = useCallback((messages: ChatUIMessage[]) => {
    const currentActiveId = readActiveId();
    const existing = conversationsRef.current;

    if (!currentActiveId) {
      if (messages.length === 0) return;
      const id = genId();
      const now = Date.now();
      const conv: ChatConversation = { id, title: deriveTitle(messages), messages, createdAt: now, updatedAt: now };
      writeConversations([conv, ...existing].slice(0, MAX_CONVERSATIONS));
      writeActiveId(id);
      emitChange();
      return;
    }

    const found = existing.find((c) => c.id === currentActiveId);
    if (!found) {
      if (messages.length === 0) return;
      const now = Date.now();
      const conv: ChatConversation = { id: currentActiveId, title: deriveTitle(messages), messages, createdAt: now, updatedAt: now };
      writeConversations([conv, ...existing].slice(0, MAX_CONVERSATIONS));
      emitChange();
      return;
    }

    const next = existing.map((c) =>
      c.id === currentActiveId
        ? { ...c, messages, title: deriveTitle(messages), updatedAt: Date.now() }
        : c,
    );
    writeConversations(next);
    emitChange();
  }, []);

  const removeConversation = useCallback((id: string) => {
    const next = conversationsRef.current.filter((c) => c.id !== id);
    writeConversations(next);
    if (readActiveId() === id) {
      writeActiveId(next.length > 0 ? next[0].id : null);
    }
    emitChange();
  }, []);

  const clearAll = useCallback(() => {
    writeConversations([]);
    writeActiveId(null);
    emitChange();
  }, []);

  const active = conversations.find((c) => c.id === activeId);
  const activeMessages = active ? active.messages : [];

  return {
    conversations,
    activeId,
    activeMessages,
    setActiveId,
    newConversation,
    updateActiveMessages,
    removeConversation,
    clearAll,
  };
}