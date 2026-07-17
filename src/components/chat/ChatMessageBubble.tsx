"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Copy, UserRound } from "lucide-react";
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

interface ChatMessageBubbleProps {
  message: ChatUIMessage;
}

/**
 * Renders one message row — user (right-aligned, gold), assistant
 * (left-aligned, glass), or a centered system notice.
 *
 * Copy Response: every non-user message (assistant reply or system
 * notice) gets a small copy button, mirroring the calculator's own
 * copy-to-clipboard pattern (icon swap to a checkmark + a themed toast).
 * User messages don't get one — there's nothing to "copy back" from
 * something the person just typed themselves.
 */
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

  return (
    <div className={cn("chat-row", isUser ? "chat-row--user" : "chat-row--assistant")}>
      {!isUser && (
        <div className="chat-avatar chat-avatar--assistant" aria-hidden>
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className="chat-bubble-col">
        <div className={cn("chat-bubble", isUser ? "chat-bubble--user" : "chat-bubble--assistant")}>
          <p className="chat-bubble-text">{message.content}</p>
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
