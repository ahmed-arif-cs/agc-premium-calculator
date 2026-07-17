"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Cloud, CloudOff, Loader2, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatExpressionForDisplay } from "@/lib/calculator";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import type { FavoriteItem } from "@/hooks/useFavorites";

interface FavoritesPanelProps {
  open: boolean;
  items: FavoriteItem[];
  onClose: () => void;
  /** Loads a starred calculation back into the calculator, same as history's "reuse". */
  onReuse: (expression: string, result: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onLabel: (id: string, label: string) => void;
  /**
   * Optional Favorites Cloud Sync status (see
   * `src/hooks/useFavoritesSync.ts`). Omitted entirely (or
   * `"disabled"`/`"idle"`) renders nothing, so this stays backward
   * compatible with any caller that doesn't pass it.
   */
  syncStatus?: "disabled" | "idle" | "restoring" | "syncing" | "synced" | "error";
}

/** Small badge describing the current cloud-sync state; hidden when there's nothing worth saying. Same shape as HistoryPanel's/MemoryBar's/SettingsPanel's <SyncBadge>. */
function SyncBadge({ status }: { status: FavoritesPanelProps["syncStatus"] }) {
  if (!status || status === "disabled" || status === "idle") return null;

  const config = {
    restoring: { icon: Loader2, label: "Restoring from cloud…", spin: true },
    syncing: { icon: Loader2, label: "Syncing…", spin: true },
    synced: { icon: Cloud, label: "Synced to your account", spin: false },
    error: { icon: CloudOff, label: "Sync paused — will retry", spin: false },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn("calc-fav-sync", `calc-fav-sync--${status}`)}
      title={config.label}
      aria-label={config.label}
    >
      <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} />
    </span>
  );
}

export function FavoritesPanel({
  open,
  items,
  onClose,
  onReuse,
  onRemove,
  onClear,
  onLabel,
  syncStatus,
}: FavoritesPanelProps) {
  useEscapeToClose(open, onClose);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const handleClear = () => {
    if (items.length === 0) return;
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    onClear();
    setConfirmClear(false);
  };

  const handleNoteKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      (event.target as HTMLInputElement).blur();
    }
  };

  return (
    <>
      <div
        className={cn("calc-history-backdrop", open && "calc-history-backdrop--open")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn("calc-history-panel", open && "calc-history-panel--open")}
        role="dialog"
        aria-modal={open}
        aria-label="Favorite calculations"
        aria-hidden={!open}
      >
        <header className="calc-history-header">
          <div className="flex items-center gap-2">
            <Star className="t-accent h-4 w-4" />
            <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
              FAVORITES
            </h2>
            {items.length > 0 && (
              <span className="calc-history-count">{items.length}</span>
            )}
            <SyncBadge status={syncStatus} />
          </div>
          <button
            type="button"
            className="calc-history-close"
            onClick={onClose}
            aria-label="Close favorites"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {items.length > 0 && (
          <div className="calc-history-actions">
            <button
              type="button"
              className={cn(
                "calc-history-clear",
                confirmClear && "calc-history-clear--confirm",
              )}
              onClick={handleClear}
              aria-label={confirmClear ? "Tap again to confirm clearing all favorites" : "Clear all favorites"}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmClear ? "Tap again to clear" : "Clear all"}
            </button>
          </div>
        )}

        {items.length > 0 ? (
          <ul className="calc-history-list">
            {items.map((item) => {
              const isCalculation = item.kind === "calculation" && item.expression && item.result;
              const primaryLine = isCalculation
                ? formatExpressionForDisplay(item.expression as string) || (item.result as string)
                : `${item.conversionCategory ?? ""} ${item.fromUnit ?? ""} → ${item.toUnit ?? ""}`.trim();

              return (
                <li key={item.id} className="calc-history-item">
                  <button
                    type="button"
                    className="calc-history-del"
                    onClick={() => onRemove(item.id)}
                    aria-label="Remove favorite"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div
                    className="calc-history-body"
                    onClick={() => {
                      if (isCalculation) onReuse(item.expression as string, item.result as string);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && isCalculation) {
                        e.preventDefault();
                        onReuse(item.expression as string, item.result as string);
                      }
                    }}
                    role={isCalculation ? "button" : undefined}
                    tabIndex={isCalculation ? 0 : undefined}
                    aria-label={
                      isCalculation
                        ? `Reuse favorite calculation: ${primaryLine} equals ${item.result}`
                        : undefined
                    }
                    title={isCalculation ? "Reuse this result" : undefined}
                  >
                    <input
                      className="calc-history-note"
                      defaultValue={item.label}
                      placeholder="Add a note…"
                      maxLength={80}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => onLabel(item.id, e.target.value.trim())}
                      onKeyDown={handleNoteKey}
                      aria-label="Note for this favorite"
                    />
                    <div className="calc-history-expr">{primaryLine}</div>
                    {isCalculation && (
                      <div className="calc-history-result">= {item.result}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="calc-history-empty">
            <Star className="t-muted mx-auto mb-3 h-8 w-8" />
            <p className="t-secondary text-sm">No favorites yet.</p>
            <p className="t-muted mt-1 text-xs">
              Star a calculation from History to pin it here for quick reuse.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
