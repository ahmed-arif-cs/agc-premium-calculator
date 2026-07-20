import type { CSSProperties } from "react";

/**
 * AI Chat theme system (Task 31) — independent color theming for the
 * user's own chat bubbles and the AGC Assistant's reply bubbles.
 *
 * This is deliberately separate from the app-wide `data-theme` system in
 * `globals.css` (:root / [data-theme="..."], selected via Settings /
 * Themes). That system re-themes the *entire app*. This one only affects
 * `.chat-bubble--user` / `.chat-bubble--assistant` inside the AI Chat
 * page, and the user can set each side independently.
 *
 * "Default (Gold)" is category "default" and carries no `colors` — it
 * intentionally does nothing here, so the existing CSS in globals.css
 * (`.chat-bubble--user` / `.chat-bubble--assistant`, which already track
 * whatever the app-wide theme is) keeps rendering exactly as it does
 * today. Every other option supplies 1, 2, or 3 hex colors and gets a
 * generated inline style, applied only when that side has explicitly
 * chosen something other than Default.
 */

export type ChatThemeCategory = "default" | "single" | "double" | "triple";

export interface ChatThemeOption {
  id: string;
  label: string;
  category: ChatThemeCategory;
  /** 0 colors = default (no override). 1 = single. 2 = double. 3 = triple. */
  colors: string[];
}

export const CHAT_THEME_OPTIONS: ChatThemeOption[] = [
  { id: "default", label: "Default (Gold)", category: "default", colors: [] },

  // Single colors
  { id: "single-gold", label: "Gold", category: "single", colors: ["#d4af37"] },
  { id: "single-emerald", label: "Emerald", category: "single", colors: ["#10b981"] },
  { id: "single-sapphire", label: "Sapphire", category: "single", colors: ["#3b82f6"] },
  { id: "single-amethyst", label: "Amethyst", category: "single", colors: ["#a855f7"] },
  { id: "single-ruby", label: "Ruby", category: "single", colors: ["#ef4444"] },
  { id: "single-rosegold", label: "Rose Gold", category: "single", colors: ["#d6a08e"] },
  { id: "single-copper", label: "Copper", category: "single", colors: ["#d97706"] },
  { id: "single-silver", label: "Silver", category: "single", colors: ["#94a3b8"] },

  // Double (2-color gradient)
  { id: "double-gold-emerald", label: "Gold · Emerald", category: "double", colors: ["#d4af37", "#10b981"] },
  { id: "double-sapphire-amethyst", label: "Sapphire · Amethyst", category: "double", colors: ["#3b82f6", "#a855f7"] },
  { id: "double-ruby-copper", label: "Ruby · Copper", category: "double", colors: ["#ef4444", "#d97706"] },
  { id: "double-emerald-sapphire", label: "Emerald · Sapphire", category: "double", colors: ["#10b981", "#3b82f6"] },
  { id: "double-rosegold-gold", label: "Rose Gold · Gold", category: "double", colors: ["#d6a08e", "#d4af37"] },
  { id: "double-silver-sapphire", label: "Silver · Sapphire", category: "double", colors: ["#94a3b8", "#3b82f6"] },
  { id: "double-amethyst-rose", label: "Amethyst · Rose", category: "double", colors: ["#a855f7", "#ec4899"] },
  { id: "double-copper-ruby", label: "Copper · Ruby", category: "double", colors: ["#d97706", "#ef4444"] },

  // Triple (3-color gradient)
  { id: "triple-gold-emerald-sapphire", label: "Gold · Emerald · Sapphire", category: "triple", colors: ["#d4af37", "#10b981", "#3b82f6"] },
  { id: "triple-ruby-amethyst-sapphire", label: "Ruby · Amethyst · Sapphire", category: "triple", colors: ["#ef4444", "#a855f7", "#3b82f6"] },
  { id: "triple-copper-gold-rosegold", label: "Copper · Gold · Rose Gold", category: "triple", colors: ["#d97706", "#d4af37", "#d6a08e"] },
  { id: "triple-emerald-sapphire-amethyst", label: "Emerald · Sapphire · Amethyst", category: "triple", colors: ["#10b981", "#3b82f6", "#a855f7"] },
  { id: "triple-silver-sapphire-amethyst", label: "Silver · Sapphire · Amethyst", category: "triple", colors: ["#94a3b8", "#3b82f6", "#a855f7"] },
  { id: "triple-ruby-copper-gold", label: "Ruby · Copper · Gold", category: "triple", colors: ["#ef4444", "#d97706", "#d4af37"] },
];

export function findChatThemeOption(id: string | null | undefined): ChatThemeOption {
  return CHAT_THEME_OPTIONS.find((o) => o.id === id) ?? CHAT_THEME_OPTIONS[0];
}

function hexToRgbTriplet(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function brighten(rgb: [number, number, number], amount: number): string {
  const [r, g, b] = rgb.map((c) => Math.max(0, Math.min(255, c + amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Builds the inline style for a chat bubble from a chosen theme option.
 * Returns `undefined` for the "default" category so the existing
 * globals.css rules (which already track the app-wide accent theme)
 * keep applying untouched — no inline style is rendered at all.
 */
export function getChatBubbleStyle(option: ChatThemeOption): CSSProperties | undefined {
  if (option.category === "default" || option.colors.length === 0) return undefined;

  const rgbs = option.colors.map(hexToRgbTriplet);
  const bgStops =
    rgbs.length === 1
      ? [`rgba(${rgbs[0].join(",")}, 0.24)`, `rgba(${rgbs[0].join(",")}, 0.10)`]
      : rgbs.map((rgb) => `rgba(${rgb.join(",")}, 0.22)`);

  return {
    background: `linear-gradient(150deg, ${bgStops.join(", ")})`,
    border: `1px solid rgba(${rgbs[0].join(",")}, 0.4)`,
    color: brighten(rgbs[rgbs.length - 1], 40),
  };
}

/** Preview swatch style shown inside the theme picker itself. */
export function getSwatchPreviewStyle(option: ChatThemeOption): CSSProperties {
  if (option.category === "default" || option.colors.length === 0) {
    return { background: "linear-gradient(135deg, #d4af37, #f0d378)" };
  }
  if (option.colors.length === 1) {
    return { background: option.colors[0] };
  }
  return { background: `linear-gradient(135deg, ${option.colors.join(", ")})` };
}