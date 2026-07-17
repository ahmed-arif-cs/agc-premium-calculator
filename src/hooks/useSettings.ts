"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type ThemeId = "navy-gold" | "light" | "navy-emerald" | "charcoal-rosegold";
export type FontSize = "sm" | "md" | "lg";

export interface Settings {
  theme: ThemeId;
  fontSize: FontSize;
  soundEnabled: boolean;
}

interface UseSettingsReturn extends Settings {
  setTheme: (theme: ThemeId) => void;
  setFontSize: (size: FontSize) => void;
  toggleSound: () => void;
  setSound: (enabled: boolean) => void;
  /**
   * Replace the full settings object in one shot. Used by
   * `useSettingsSync.ts` to apply a value restored from the cloud after
   * sign-in — a full overwrite, unlike `setTheme`/`setFontSize`/`setSound`,
   * which each touch a single field. Additive: every existing caller that
   * only used the per-field setters is unaffected.
   */
  setSettings: (next: Settings) => void;
}

const STORAGE_KEY = "ahmed-calc:settings:v1";
const EVENT = "ahmed-calc:settings-change";

const DEFAULTS: Settings = {
  theme: "navy-gold",
  fontSize: "md",
  soundEnabled: false,
};

let cache: Settings | null = null;

function readFromStorage(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const p = parsed as Partial<Settings>;
    return {
      theme:
        p.theme === "light" ||
        p.theme === "navy-emerald" ||
        p.theme === "charcoal-rosegold" ||
        p.theme === "navy-gold"
          ? p.theme
          : DEFAULTS.theme,
      fontSize:
        p.fontSize === "sm" || p.fontSize === "lg" || p.fontSize === "md"
          ? p.fontSize
          : DEFAULTS.fontSize,
      soundEnabled:
        typeof p.soundEnabled === "boolean" ? p.soundEnabled : DEFAULTS.soundEnabled,
    };
  } catch {
    return DEFAULTS;
  }
}

function refreshCache(): void {
  cache = readFromStorage();
}

function getSnapshot(): Settings {
  if (cache === null) refreshCache();
  return cache as Settings;
}

function getServerSnapshot(): Settings {
  return DEFAULTS;
}

const listeners = new Set<() => void>();

function emitChange(next: Settings): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
    window.dispatchEvent(new Event(EVENT));
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener(EVENT, listener);
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENT, listener);
      window.removeEventListener("storage", onStorage);
    }
  };
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) {
    refreshCache();
    listeners.forEach((l) => l());
  }
}

export function useSettings(): UseSettingsReturn {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((theme: ThemeId) => {
    emitChange({ ...getSnapshot(), theme });
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => {
    emitChange({ ...getSnapshot(), fontSize });
  }, []);

  const setSound = useCallback((enabled: boolean) => {
    emitChange({ ...getSnapshot(), soundEnabled: enabled });
  }, []);

  const toggleSound = useCallback(() => {
    emitChange({ ...getSnapshot(), soundEnabled: !getSnapshot().soundEnabled });
  }, []);

  const setSettings = useCallback((next: Settings) => {
    emitChange(next);
  }, []);

  return {
    ...settings,
    setTheme,
    setFontSize,
    toggleSound,
    setSound,
    setSettings,
  };
}

/**
 * Apply the active theme + font scale to <html> so the CSS variables resolve.
 * Mount once near the root.
 */
export function useApplySettings(): void {
  const { theme, fontSize } = useSettings();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.fs = fontSize;
  }, [fontSize]);
}

/* ---------------- Click sound (Web Audio API) ---------------- */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/** A soft, premium "thock" — two layered sine taps with a fast decay. */
export function playClick(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  const now = ctx.currentTime;

  const makeTone = (freq: number, start: number, dur: number, gain: number): void => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, now + start);
    g.gain.linearRampToValueAtTime(gain, now + start + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(lp).connect(g).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };

  makeTone(320, 0, 0.09, 0.07);
  makeTone(640, 0.006, 0.05, 0.035);
}

/**
 * Returns a stable `click()` function that plays the sound only when the
 * user has enabled it. Use in any button handler.
 */
export function useClickSound(): () => void {
  const enabledRef = useRef<boolean>(false);
  const settings = useSettings();
  useEffect(() => {
    enabledRef.current = settings.soundEnabled;
  }, [settings.soundEnabled]);

  return useCallback(() => {
    if (enabledRef.current) playClick();
  }, []);
}
