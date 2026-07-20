"use client";

import { useCallback, useEffect, useState } from "react";
import { findChatThemeOption, getChatBubbleStyle } from "@/lib/chatThemes";

const USER_THEME_KEY = "agc-chat-user-theme-v1";
const AI_THEME_KEY = "agc-chat-ai-theme-v1";

/**
 * Persists the AI Chat page's two independent bubble themes
 * ("Your Chat" and "AGC Assistant") to localStorage, per-device,
 * exactly like every other per-device preference in this app
 * (font size, click sound, etc.) — no Supabase sync, no server
 * round-trip, just an instant local switch.
 */
export function useChatTheme() {
  const [userThemeId, setUserThemeId] = useState<string>("default");
  const [aiThemeId, setAiThemeId] = useState<string>("default");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setUserThemeId(window.localStorage.getItem(USER_THEME_KEY) ?? "default");
      setAiThemeId(window.localStorage.getItem(AI_THEME_KEY) ?? "default");
    } catch {
      // Storage unavailable — stay on the safe "default" (current gold) look.
    } finally {
      setLoaded(true);
    }
  }, []);

  const setUserTheme = useCallback((id: string) => {
    setUserThemeId(id);
    try {
      window.localStorage.setItem(USER_THEME_KEY, id);
    } catch {
      // Non-critical — selection still applies for this session.
    }
  }, []);

  const setAiTheme = useCallback((id: string) => {
    setAiThemeId(id);
    try {
      window.localStorage.setItem(AI_THEME_KEY, id);
    } catch {
      // Non-critical — selection still applies for this session.
    }
  }, []);

  const userOption = findChatThemeOption(userThemeId);
  const aiOption = findChatThemeOption(aiThemeId);

  return {
    loaded,
    userThemeId,
    aiThemeId,
    userOption,
    aiOption,
    setUserTheme,
    setAiTheme,
    userBubbleStyle: getChatBubbleStyle(userOption),
    aiBubbleStyle: getChatBubbleStyle(aiOption),
  };
}

export type UseChatThemeReturn = ReturnType<typeof useChatTheme>;