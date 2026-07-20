"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useClickSound } from "@/hooks/useSettings";
import { CHAT_THEME_OPTIONS, getSwatchPreviewStyle, type ChatThemeCategory } from "@/lib/chatThemes";
import type { UseChatThemeReturn } from "@/hooks/useChatTheme";

interface ChatThemePanelProps {
  open: boolean;
  onClose: () => void;
  chatTheme: UseChatThemeReturn;
}

const CATEGORIES: { id: ChatThemeCategory; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "single", label: "Single colors" },
  { id: "double", label: "Double colors" },
  { id: "triple", label: "Triple colors" },
];

/**
 * Chat theme picker (Task 31) — reuses the exact same
 * .calc-settings-panel / .calc-seg / .calc-swatch shell already used by
 * SettingsPanel's app-wide theme picker, so this feels native rather
 * than bolted on. Two independent targets — "Your Chat" and
 * "AGC Assistant" — each get their own Default / Single / Double /
 * Triple color picks, applied instantly and saved per-device.
 */
export function ChatThemePanel({ open, onClose, chatTheme }: ChatThemePanelProps) {
  useEscapeToClose(open, onClose);
  const clickSound = useClickSound();
  const [target, setTarget] = useState<"user" | "ai">("user");

  const activeId = target === "user" ? chatTheme.userThemeId : chatTheme.aiThemeId;
  const applyTheme = target === "user" ? chatTheme.setUserTheme : chatTheme.setAiTheme;

  const handleClose = () => {
    clickSound();
    onClose();
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
        aria-label="Chat theme"
        aria-hidden={!open}
      >
        <header className="calc-settings-header">
          <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
            CHAT THEME
          </h2>
          <button
            type="button"
            className="calc-settings-close"
            onClick={handleClose}
            aria-label="Close chat theme"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="calc-settings-body">
          <div className="calc-seg" role="tablist" aria-label="Choose which chat to theme">
            <button
              type="button"
              role="tab"
              aria-selected={target === "user"}
              className={cn("calc-seg-btn", target === "user" && "calc-seg-btn--active")}
              onClick={() => {
                clickSound();
                setTarget("user");
              }}
            >
              Your Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={target === "ai"}
              className={cn("calc-seg-btn", target === "ai" && "calc-seg-btn--active")}
              onClick={() => {
                clickSound();
                setTarget("ai");
              }}
            >
              AGC Assistant
            </button>
          </div>

          {CATEGORIES.map((cat) => {
            const options = CHAT_THEME_OPTIONS.filter((o) => o.category === cat.id);
            if (options.length === 0) return null;
            return (
              <div className="calc-settings-section" key={cat.id}>
                <h3>{cat.label}</h3>
                <div className="calc-swatches">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={cn("calc-swatch", activeId === opt.id && "calc-swatch--active")}
                      onClick={() => {
                        clickSound();
                        applyTheme(opt.id);
                      }}
                    >
                      <span className="calc-swatch-dot" style={getSwatchPreviewStyle(opt)} aria-hidden />
                      <span className="calc-swatch-label">{opt.label}</span>
                      {activeId === opt.id ? (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ marginLeft: "auto" }} />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <p className="t-muted calc-aic-provider">
            Your chat bubble and the AGC Assistant&apos;s reply bubble can each have their own
            color — pick a look for both, independently.
          </p>
        </div>
      </aside>
    </>
  );
}