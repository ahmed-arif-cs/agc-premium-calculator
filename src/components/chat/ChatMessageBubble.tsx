"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Check, Copy, Pencil, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { ChatUIMessage } from "./types";

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function renderMessageContent(content: string) {
  const imageRegex = /!\[([^\]]*)\]\((\/ahmed\/[^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = imageRegex.exec(content)) !== null) {
    const [fullMatch, alt, src] = match;
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        parts.push(
          <p key={`text-${key++}`} className="chat-bubble-text">
            {text}
          </p>
        );
      }
    }
    parts.push(
      <img key={`img-${key++}`} src={src} alt={alt || "Ahmed"} className="chat-bubble-image" />
    );
    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      parts.push(
        <p key={`text-${key++}`} className="chat-bubble-text">
          {text}
        </p>
      );
    }
  }

  return parts;
}

interface ChatMessageBubbleProps {
  message: ChatUIMessage;
  /** Called with (messageId, newText) when the user saves an edit to their own message. */
  onEdit?: (id: string, newText: string) => void;
  /**
   * Inline theme override from useChatTheme() (Task 31 — AI Chat theme
   * system). `undefined` means "no override" — the existing
   * `.chat-bubble--user` / `.chat-bubble--assistant` CSS in globals.css
   * (which already tracks the app-wide accent theme) keeps applying
   * exactly as before.
   */
  userBubbleStyle?: CSSProperties;
  aiBubbleStyle?: CSSProperties;
}

export function ChatMessageBubble({
  message,
  onEdit,
  userBubbleStyle,
  aiBubbleStyle,
}: ChatMessageBubbleProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast({
        title: "Copy failed",
        description: "Clipboard is not available in this browser.",
        className: "calc-toast",
      });
      return;
    }

    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        toast({
          title: "Message copied",
          description:
            message.content.length > 100 ? `${message.content.slice(0, 100)}…` : message.content,
          className: "calc-toast",
        });
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Clipboard permission was denied.",
          className: "calc-toast",
        });
      });
  };

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy message"
      title="Copy message"
      className={cn("chat-copy-btn", copied && "chat-copy-btn--copied")}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );

  if (message.role === "system") {
    return (
      <div className="chat-row chat-row--system">
        <p className="chat-system-notice">{message.content}</p>
        {copyButton}
      </div>
    );
  }

  const isUser = message.role === "user";
  const textParts = renderMessageContent(message.content);
  const hasAttachedImages = isUser && (message.images?.length ?? 0) > 0;

  const startEdit = () => {
    setEditValue(message.content);
    setIsEditing(true);
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed.length === 0) return;
    onEdit?.(message.id, trimmed);
    setIsEditing(false);
  };

  return (
    <div className={cn("chat-row", isUser ? "chat-row--user" : "chat-row--assistant")}>
      {!isUser && (
        <div className="chat-avatar chat-avatar--assistant chat-avatar--logo" aria-hidden>
          <Image src="/agc-mark.png" alt="" width={28} height={28} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="chat-bubble-col">
        <div
          className={cn("chat-bubble", isUser ? "chat-bubble--user" : "chat-bubble--assistant")}
          style={isUser ? userBubbleStyle : aiBubbleStyle}
        >
          {isUser && isEditing ? (
            <div className="chat-edit-row">
              <textarea
                className="chat-edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
                autoFocus
                aria-label="Edit your message"
              />
              <div className="chat-edit-actions">
                <button type="button" className="chat-edit-cancel" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="chat-edit-save"
                  onClick={saveEdit}
                  disabled={editValue.trim().length === 0}
                >
                  Save & resend
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasAttachedImages && (
                <div className="chat-bubble-attachments">
                  {message.images!.map((image, index) => (
                    <img
                      key={index}
                      src={image.previewUrl}
                      alt="Attached photo"
                      className="chat-bubble-image chat-bubble-image--attachment"
                    />
                  ))}
                </div>
              )}
              {textParts.length > 0
                ? textParts
                : !hasAttachedImages && <p className="chat-bubble-text">{message.content}</p>}
            </>
          )}
        </div>
        {!isEditing && (
          <div className={cn("chat-meta-row", isUser && "chat-meta-row--user")}>
            <span className={cn("chat-timestamp", isUser && "chat-timestamp--user")}>
              {formatTime(message.createdAt)}
            </span>
            {isUser ? (
              <>
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label="Edit message"
                  title="Edit message"
                  className="chat-copy-btn"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {copyButton}
              </>
            ) : (
              copyButton
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="chat-avatar chat-avatar--user" aria-hidden>
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
