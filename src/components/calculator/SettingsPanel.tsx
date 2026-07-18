"use client";

import Image from "next/image";
import { Cloud, CloudOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSettings,
  useClickSound,
  type FontSize,
  type ThemeId,
} from "@/hooks/useSettings";
import { useSettingsSyncStatus, type SettingsSyncStatus } from "@/hooks/useSettingsSync";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Small badge describing the current Settings Cloud Sync state; hidden
 * when there's nothing worth saying. Reads the single `useSettingsSync()`
 * instance (mounted once in `SettingsApplier.tsx`) via the read-only
 * `useSettingsSyncStatus()` hook, so opening this panel never starts a
 * second restore/push cycle. Mirrors `MemoryBar.tsx`/`HistoryPanel.tsx`'s
 * `SyncBadge` exactly.
 */
function SyncBadge({ status }: { status: SettingsSyncStatus }) {
  if (status === "disabled" || status === "idle") return null;

  const config = {
    restoring: { icon: Loader2, label: "Restoring settings from cloud…", spin: true },
    syncing: { icon: Loader2, label: "Syncing settings…", spin: true },
    synced: { icon: Cloud, label: "Settings synced to your account", spin: false },
    error: { icon: CloudOff, label: "Settings sync paused — will retry", spin: false },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn("calc-settings-sync", `calc-settings-sync--${status}`)}
      title={config.label}
      aria-label={config.label}
    >
      <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} />
    </span>
  );
}

const THEMES: { id: ThemeId; label: string; bg: string; accent: string }[] = [
  { id: "navy-gold", label: "Navy / Gold", bg: "#0a0e17", accent: "#d4af37" },
  { id: "light", label: "Light", bg: "#f3f4f8", accent: "#b8932b" },
  { id: "navy-emerald", label: "Navy / Emerald", bg: "#07151a", accent: "#10b981" },
  { id: "charcoal-rosegold", label: "Charcoal / Rose Gold", bg: "#1a1518", accent: "#d6a08e" },
  { id: "ocean-sapphire", label: "Ocean / Sapphire", bg: "#071019", accent: "#3b82f6" },
  { id: "royal-amethyst", label: "Royal / Amethyst", bg: "#140b1c", accent: "#a855f7" },
  { id: "crimson-ember", label: "Crimson / Ember", bg: "#170a0a", accent: "#ef4444" },
  { id: "forest-jade", label: "Forest / Jade", bg: "#0c150e", accent: "#22c55e" },
  { id: "sunset-copper", label: "Sunset / Copper", bg: "#170f08", accent: "#d97706" },
  { id: "midnight-silver", label: "Midnight / Silver", bg: "#0e1013", accent: "#94a3b8" },
  { id: "rose-bloom", label: "Rose / Bloom", bg: "#170a12", accent: "#ec4899" },
  { id: "golden-bronze", label: "Golden / Bronze", bg: "#160f09", accent: "#c08552" },
  { id: "arctic-frost", label: "Arctic / Frost", bg: "#071620", accent: "#38bdf8" },
  { id: "volcanic-obsidian", label: "Volcanic / Obsidian", bg: "#140b08", accent: "#f97316" },
];

const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: "sm", label: "A−" },
  { id: "md", label: "A" },
  { id: "lg", label: "A+" },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const settings = useSettings();
  const clickSound = useClickSound();
  const syncStatus = useSettingsSyncStatus();
  useEscapeToClose(open, onClose);

  return (
    <>
      <div
        className={cn("calc-settings-backdrop", open && "calc-settings-backdrop--open")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn("calc-settings-panel", open && "calc-settings-panel--open")}
        role="dialog"
        aria-modal={open}
        aria-label="Settings"
        aria-hidden={!open}
      >
        <header className="calc-settings-header">
          <div className="flex items-center gap-2">
            <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
              SETTINGS
            </h2>
            <SyncBadge status={syncStatus} />
          </div>
          <button
            type="button"
            className="calc-settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="calc-settings-body">
          <div className="calc-settings-section">
            <h3>Theme</h3>
            <div className="calc-swatches">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`${t.label} theme`}
                  aria-pressed={settings.theme === t.id}
                  className={cn(
                    "calc-swatch",
                    settings.theme === t.id && "calc-swatch--active",
                  )}
                  onClick={() => {
                    clickSound();
                    settings.setTheme(t.id);
                  }}
                >
                  <span
                    className="calc-swatch-dot"
                    style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                  />
                  <span className="calc-swatch-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="calc-settings-section">
            <h3>Font size</h3>
            <div className="calc-seg">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`Font size: ${f.id === "sm" ? "small" : f.id === "md" ? "medium" : "large"}`}
                  aria-pressed={settings.fontSize === f.id}
                  className={cn(
                    "calc-seg-btn",
                    settings.fontSize === f.id && "calc-seg-btn--active",
                  )}
                  onClick={() => {
                    clickSound();
                    settings.setFontSize(f.id);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="calc-settings-section">
            <h3>Sound</h3>
            <div className="calc-toggle-row">
              <span>Button click sound</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.soundEnabled}
                aria-label="Toggle click sound"
                className={cn("calc-switch", settings.soundEnabled && "calc-switch--on")}
                onClick={() => {
                  if (!settings.soundEnabled) clickSound();
                  settings.toggleSound();
                }}
              />
            </div>
          </div>

          <div className="calc-settings-brand">
            <div className="calc-settings-brand-mark">
              <Image
                src="/agc-mark.png"
                alt="AGC — Ahmed Group of Companies logo"
                width={28}
                height={28}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="leading-tight">
              <p className="calc-settings-brand-name">AGC Premium Calculator</p>
              <p className="calc-settings-brand-tag">Ahmed Group of Companies</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
