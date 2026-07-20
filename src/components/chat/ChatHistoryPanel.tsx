"use client";

import { Clock, MessageSquarePlus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useClickSound } from "@/hooks/useSettings";
import type { ChatConversation } from "@/hooks/useChatConversations";

interface ChatHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Chat history / conversations panel — reuses the same
 * .calc-settings-panel shell as ChatThemePanel, listing every saved
 * conversation so the user can switch between them, start a new one,
 * or delete ones they no longer need.
 */
export function ChatHistoryPanel({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ChatHistoryPanelProps) {
  useEscapeToClose(open, onClose);
  const clickSound = useClickSound();

  const handleClose = () => {
    clickSound();
    onClose();
  };

  const handleNew = () => {
    clickSound();
    onNew();
    onClose();
  };

  const handleSelect = (id: string) => {
    clickSound();
    onSelect(id);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    clickSound();
    onDelete(id);
  };

  return (
    <>
      <div
        className={cn("calc-settings-backdrop", open && "calc-settings-backdrop--open")}
        onClick={handleClose}
        aria-hidden
      />
      <aside
        className={cn("calc-settings-panel calc-chat-theme-panel", open && "calc-settings-panel--open")}
        role="dialog"
        aria-modal={open}
        aria-label="Chat history"
        aria-hidden={!open}
      >
        <header className="calc-settings-header">
          <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
            CHAT HISTORY
          </h2>
          <button
            type="button"
            className="calc-settings-close"
            onClick={handleClose}
            aria-label="Close chat history"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="calc-settings-body">
          <button type="button" className="calc-seg-btn calc-seg-btn--active" style={{ width: "100%", justifyContent: "center", gap: "0.4rem" }} onClick={handleNew}>
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </button>

          {conversations.length === 0 ? (
            <p className="t-muted calc-aic-provider">No saved conversations yet — start chatting and it'll show up here.</p>
          ) : (
            <div className="calc-settings-section">
              <h3>Saved conversations</h3>
              <div className="calc-swatches" style={{ flexDirection: "column" }}>
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    className={cn("calc-swatch", activeId === conv.id && "calc-swatch--active")}
                    style={{ width: "100%", justifyContent: "flex-start" }}
                    onClick={() => handleSelect(conv.id)}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="calc-swatch-label" style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conv.title}
                    </span>
                    <span className="t-muted" style={{ fontSize: "0.7rem", flexShrink: 0 }}>
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="calc-util-btn"
                      style={{ marginLeft: "0.4rem", flexShrink: 0 }}
                      onClick={(e) => handleDelete(e, conv.id)}
                      aria-label="Delete conversation"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}