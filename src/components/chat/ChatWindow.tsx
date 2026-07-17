"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, ChevronLeft, Trash2 } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { ChatUIMessage } from "./types";

let idCounter = 0;
/** Monotonic id, unique within a single page session — plenty for local-only chat state. */
function nextId(): string {
  idCounter += 1;
  return `msg_${Date.now()}_${idCounter}`;
}

/** localStorage key for the Conversation History feature (this browser only). */
const HISTORY_STORAGE_KEY = "agc-ai-chat-history-v1";
/** localStorage key for this browser's stable conversation id — kept alongside the transcript so a reload continues the same server-side conversation context instead of starting a fresh one. */
const CONVERSATION_ID_STORAGE_KEY = "agc-ai-chat-conversation-id-v1";

/** A simple, dependency-free unique id for this browser's conversation. */
function generateConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isStoredMessage(value: unknown): value is ChatUIMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<ChatUIMessage>;
  return (
    typeof m.id === "string" &&
    typeof m.content === "string" &&
    typeof m.createdAt === "number" &&
    (m.role === "user" || m.role === "assistant" || m.role === "system")
  );
}

/**
 * The Chat Window — top-level container. Composes the Message List and
 * Chat Input, and owns the conversation's local state.
 *
 * Connected to the server-only AI Service Layer via `POST /api/ai/chat`
 * (`src/app/api/ai/chat/route.ts`) — the only client-server seam this
 * component uses. No API key, provider name, or `src/lib/ai/*` import
 * lives in this file or anywhere else in `src/components/chat/`; the
 * route resolves whichever provider `AI_PROVIDER` selects server-side.
 * If no provider is configured, the route replies with a typed
 * `not_configured` error, shown here as a clearly-labeled system notice
 * rather than a fabricated assistant reply — the calculator itself never
 * depends on this working.
 *
 * Conversation History: the transcript (and this browser's stable
 * conversation id, so a reload continues the same server-side context)
 * is persisted to `localStorage` (client-only). Clear Chat wipes both
 * the in-memory state and the saved history/id.
 */
export function ChatWindow() {
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const conversationIdRef = useRef<string>("");

  // Restore any previously saved conversation (and its stable id) from
  // this browser on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const restored = parsed.filter(isStoredMessage);
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage, deliberately deferred until after mount to avoid an SSR/client hydration mismatch (localStorage doesn't exist on the server).
          if (restored.length > 0) setMessages(restored);
        }
      }
    } catch {
      // Corrupt or inaccessible storage — start with an empty conversation.
    } finally {
      setHistoryLoaded(true);
    }

    try {
      const storedId = window.localStorage.getItem(CONVERSATION_ID_STORAGE_KEY);
      conversationIdRef.current = storedId && storedId.length > 0 ? storedId : generateConversationId();
      window.localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, conversationIdRef.current);
    } catch {
      conversationIdRef.current = generateConversationId();
    }
  }, []);

  // Persist the conversation on every change, once the restore above has
  // run (so we never clobber saved history with the empty initial state).
  useEffect(() => {
    if (!historyLoaded || typeof window === "undefined") return;
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(messages));
      } else {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    } catch {
      // Storage may be unavailable (private browsing, quota) — fail silently.
    }
  }, [messages, historyLoaded]);

  const handleSend = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: text, createdAt: Date.now() }]);
    setIsLoading(true);

    const conversationId = conversationIdRef.current || generateConversationId();
    conversationIdRef.current = conversationId;

    (async () => {
      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message: text }),
        });

        const data: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const errorMessage =
            data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "The AI assistant couldn't reply just now.";
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: "system", content: errorMessage, createdAt: Date.now() },
          ]);
          return;
        }

        const reply =
          data && typeof data === "object" && "reply" in data && typeof (data as { reply: unknown }).reply === "string"
            ? (data as { reply: string }).reply
            : undefined;

        if (!reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "system",
              content: "The AI assistant sent back an unexpected response.",
              createdAt: Date.now(),
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: reply, createdAt: Date.now() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "system",
            content: "Couldn't reach the AI assistant — check your connection and try again.",
            createdAt: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleClear = useCallback(() => {
    setIsLoading(false);
    setMessages([]);
    conversationIdRef.current = generateConversationId();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, conversationIdRef.current);
      } catch {
        // Storage may be unavailable — the in-memory id above still works for this session.
      }
    }
  }, []);

  return (
    <div className="chat-shell">
      <Link href="/" className="profile-back-link chat-back-link">
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to calculator
      </Link>

      <div className="calc-glass chat-card">
        <div className="chat-header">
          <div className="chat-header-title">
            <div className="chat-header-icon" aria-hidden>
              <Bot className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="t-text chat-header-name">AI Assistant</p>
              <p className="t-muted chat-header-sub">AI-powered — replies from your configured provider</p>
            </div>
          </div>
          <button
            type="button"
            className="calc-util-btn"
            onClick={handleClear}
            disabled={messages.length === 0}
            aria-label="Clear chat and saved history"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="u-divider" />

        <MessageList messages={messages} isLoading={isLoading} />

        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
