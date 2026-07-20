"use client";

import { useEffect, useRef, useState, type CSSProperties, type UIEvent } from "react";
import { ArrowDown } from "lucide-react";
import { AGCAssistantMark } from "./AGCAssistantMark";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { LoadingIndicator } from "./LoadingIndicator";
import type { ChatUIMessage } from "./types";

interface MessageListProps {
  messages: ChatUIMessage[];
  isLoading: boolean;
  onEdit?: (id: string, newText: string) => void;
  /** Chat theme (Task 31) — inline style overrides from useChatTheme(). */
  userBubbleStyle?: CSSProperties;
  aiBubbleStyle?: CSSProperties;
}

const STICK_THRESHOLD_PX = 64;

export function MessageList({
  messages,
  isLoading,
  onEdit,
  userBubbleStyle,
  aiBubbleStyle,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    if (!stickToBottom) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isLoading, stickToBottom]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceFromBottom <= STICK_THRESHOLD_PX);
  };

  const scrollToBottom = () => {
    setStickToBottom(true);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="chat-messages-wrap">
      <div
        ref={containerRef}
        className="chat-messages"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        onScroll={handleScroll}
      >
        {isEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-icon" aria-hidden>
              <AGCAssistantMark className="h-8 w-8" />
            </div>
            <p className="chat-empty-title">Start a conversation</p>
            <p className="chat-empty-sub">
              Type a message below to see the chat interface in action.
            </p>
          </div>
        ) : (
          <div className="chat-messages-inner">
            {messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                onEdit={onEdit}
                userBubbleStyle={userBubbleStyle}
                aiBubbleStyle={aiBubbleStyle}
              />
            ))}
            {isLoading && <LoadingIndicator />}
          </div>
        )}
        <div ref={endRef} aria-hidden />
      </div>

      {!isEmpty && !stickToBottom && (
        <button
          type="button"
          className="chat-scroll-btn"
          onClick={scrollToBottom}
          aria-label="Scroll to latest messages"
          title="Scroll to latest messages"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          New messages
        </button>
      )}
    </div>
  );
}