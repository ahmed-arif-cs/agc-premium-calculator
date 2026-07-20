"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, Download, FileJson, FileSpreadsheet, FileText, FileType, History, Palette, Sheet, Trash2 } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ChatThemePanel } from "./ChatThemePanel";
import { useChatTheme } from "@/hooks/useChatTheme";
import { useChatConversations } from "@/hooks/useChatConversations";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { exportChatCsv, exportChatDocx, exportChatJson, exportChatPdf, exportChatTxt, exportChatXlsx } from "@/lib/exportChat";
import { cn } from "@/lib/utils";
import type { ChatUIImage, ChatUIMessage } from "./types";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg_${Date.now()}_${idCounter}`;
}

export function ChatWindow() {
  const conversations = useChatConversations();
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const chatTheme = useChatTheme();
  const conversationIdRef = useRef<string>("");
  const exportRef = useRef<HTMLDivElement>(null);

  // Whenever the active conversation changes (switch / new / first load),
  // load its messages into local state and remember its id for saving.
  useEffect(() => {
    conversationIdRef.current = conversations.activeId ?? "";
    setMessages(conversations.activeMessages);
  }, [conversations.activeId]);

  // Any change to the active conversation's messages is written straight
  // back to the conversations store (which persists to localStorage).
  useEffect(() => {
    if (messages.length === 0) return;
    conversations.updateActiveMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [exportOpen]);

  const flashExport = (format: string) => {
    setExportFlash(format);
    window.setTimeout(() => setExportFlash(null), 1100);
  };

  const handleSend = useCallback((text: string, images?: ChatUIImage[]) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: text, createdAt: Date.now(), images },
    ]);
    setIsLoading(true);

    const conversationId = conversationIdRef.current || conversations.newConversation();
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

  // Editing a user message: drop everything from that message onward, then
  // resend the edited text as a fresh message (so the AI reply regenerates).
  const handleEditMessage = useCallback((id: string, newText: string) => {
    if (!newText) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx === -1) return prev;
      return prev.slice(0, idx);
    });
    handleSend(newText);
  }, [handleSend]);

  const handleClear = useCallback(() => {
    setIsLoading(false);
    setMessages([]);
    conversationIdRef.current = conversations.newConversation();
  }, [conversations]);

  return (
    <div className="chat-shell">
      <div className="calc-bg-glow" aria-hidden />
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
              <p className="t-muted chat-header-sub">AI-powered by AGC(Ahmed Group of Companies) Premium AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn("calc-util-btn", historyOpen && "calc-util-btn--active")}
              onClick={() => setHistoryOpen(true)}
              aria-label="Chat history"
              title="Chat history (saved conversations)"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn("calc-util-btn", themeOpen && "calc-util-btn--active")}
              onClick={() => setThemeOpen(true)}
              aria-label="Chat theme"
              title="Chat theme (your chat + AGC Assistant colors)"
            >
              <Palette className="h-4 w-4" />
            </button>
            {messages.length > 0 && (
              <div className="calc-export-menu" ref={exportRef}>
                <button
                  type="button"
                  className={cn("calc-export-btn", exportFlash && "calc-flash-success")}
                  onClick={() => setExportOpen((v) => !v)}
                  aria-expanded={exportOpen}
                  aria-haspopup="menu"
                  aria-label="Export chat"
                  title="Export chat"
                >
                  {exportFlash ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  Export
                  <ChevronDown className={cn("h-3 w-3", exportOpen && "calc-csel-chev--open")} />
                </button>
                {exportOpen && (
                  <div className="calc-export-dropdown" role="menu">
                    <button type="button" role="menuitem" className="calc-export-item" onClick={() => { exportChatPdf(messages).then(() => flashExport("pdf")); setExportOpen(false); }}>
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </button>
                    <button type="button" role="menuitem" className="calc-export-item" onClick={() => { exportChatXlsx(messages).then(() => flashExport("xlsx")); setExportOpen(false); }}>
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                    </button>
                    <button type="button" role="menuitem" className="calc-export-item" onClick={() => { exportChatDocx(messages).then(() => flashExport("docx")); setExportOpen(false); }}>
                      <FileType className="h-3.5 w-3.5" /> Word (.docx)
                    </button>
                    <button type="button" role="menuitem" className="calc-export-item" onClick={() => { exportChatCsv(messages); flashExport("csv"); setExportOpen(false); }}>
                      <Sheet className="h-3.5 w-3.5" /> CSV
                    </button>
                    <button type="button" role="menuitem" className="calc-export-item" onClick={() => { exportChatJson(messages); flashExport("json"); setExportOpen(false); }}>
                      <FileJson className="h-3.5 w-3.5" /> JSON
                    </button>
                    <button type="button" role="menuitem" className="calc-export-item" onClick={() => { exportChatTxt(messages); flashExport("txt"); setExportOpen(false); }}>
                      <FileText className="h-3.5 w-3.5" /> Text (.txt)
                    </button>
                  </div>
                )}
              </div>
            )}
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
        </div>

        <div className="u-divider" />

        <MessageList
          messages={messages}
          isLoading={isLoading}
          onEdit={handleEditMessage}
          userBubbleStyle={chatTheme.userBubbleStyle}
          aiBubbleStyle={chatTheme.aiBubbleStyle}
        />

        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>

      <ChatThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} chatTheme={chatTheme} />
        <ChatHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={conversations.conversations}
        activeId={conversations.activeId}
        onSelect={(id) => conversations.setActiveId(id)}
        onNew={() => {
          conversationIdRef.current = conversations.newConversation();
          setMessages([]);
        }}
        onDelete={(id) => conversations.removeConversation(id)}
      />
    </div>
  );
}