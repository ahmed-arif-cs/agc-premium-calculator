"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 4000;

/** The Chat Input — an auto-growing textarea with Enter-to-send / Shift+Enter-for-newline, disabled while a reply is loading. */
export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat-input-row">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value.slice(0, MAX_LENGTH));
          resize();
        }}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Waiting for a reply…" : "Message the assistant…"}
        rows={1}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        aria-label="Chat message"
        className="chat-textarea"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-label="Send message"
        title="Send (Enter)"
        className={cn("chat-send-btn", !disabled && value.trim().length > 0 && "chat-send-btn--active")}
      >
        <SendHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}
