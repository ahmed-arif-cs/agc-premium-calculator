"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Check, Copy, UserRound } from "lucide-react";
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
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
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
          title: "Response copied",
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
      aria-label="Copy response"
      title="Copy response"
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

  return (
    <div className={cn("chat-row", isUser ? "chat-row--user" : "chat-row--assistant")}>
      {!isUser && (
        <div className="chat-avatar chat-avatar--assistant chat-avatar--logo" aria-hidden>
          <Image src="/agc-mark.png" alt="" width={28} height={28} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="chat-bubble-col">
        <div className={cn("chat-bubble", isUser ? "chat-bubble--user" : "chat-bubble--assistant")}>
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
        </div>
        <div className={cn("chat-meta-row", isUser && "chat-meta-row--user")}>
          <span className={cn("chat-timestamp", isUser && "chat-timestamp--user")}>
            {formatTime(message.createdAt)}
          </span>
          {!isUser && copyButton}
        </div>
      </div>
      {isUser && (
        <div className="chat-avatar chat-avatar--user" aria-hidden>
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}