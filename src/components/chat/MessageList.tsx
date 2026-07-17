"use client";

import { useEffect, useRef, useState, type UIEvent } from "react";
import { ArrowDown, Sparkles } from "lucide-react";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { LoadingIndicator } from "./LoadingIndicator";
import type { ChatUIMessage } from "./types";

interface MessageListProps {
  messages: ChatUIMessage[];
  isLoading: boolean;
}

/** How close to the bottom (px) counts as "still at the bottom" for auto-scroll purposes. */
const STICK_THRESHOLD_PX = 64;

/**
 * The Message List — scrollable transcript with an empty state before the
 * first message.
 *
 * Auto Scroll: follows the newest message/typing indicator automatically,
 * but only while the person is already at (or near) the bottom — if
 * they've scrolled up to reread earlier messages, new messages no longer
 * yank the view down. A small "New messages" pill appears instead so they
 * can jump back down on their own terms.
 */
export function MessageList({ messages, isLoading }: MessageListProps) {
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
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="chat-empty-title">Start a conversation</p>
            <p className="chat-empty-sub">
              Type a message below to see the chat interface in action.
            </p>
          </div>
        ) : (
          <div className="chat-messages-inner">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
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
