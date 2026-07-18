"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { ChatUIImage, ChatUIMessage } from "./types";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg_${Date.now()}_${idCounter}`;
}

const HISTORY_STORAGE_KEY = "agc-ai-chat-history-v1";
const CONVERSATION_ID_STORAGE_KEY = "agc-ai-chat-conversation-id-v1";

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

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const conversationIdRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const restored = parsed.filter(isStoredMessage);
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

  useEffect(() => {
    if (!historyLoaded || typeof window === "undefined") return;
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(messages));
      } else {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    } catch {
      // Storage may be unavailable or full — fail silently.
    }
  }, [messages, historyLoaded]);

  const handleSend = useCallback((text: string, images?: ChatUIImage[]) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: text, createdAt: Date.now(), images },
    ]);
    setIsLoading(true);

    const conversationId = conversationIdRef.current || generateConversationId();
    conversationIdRef.current = conversationId;

    (async () => {
      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message: text,
            images: images?.map((img) => img.previewUrl),
          }),
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
            <div className="chat-header-icon chat-header-icon--logo" aria-hidden>
              <Image src="/agc-mark.png" alt="" width={32} height={32} className="h-full w-full object-cover" />
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