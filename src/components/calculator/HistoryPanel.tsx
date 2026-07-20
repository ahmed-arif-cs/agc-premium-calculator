"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  History as HistoryIcon,
  Loader2,
  Search,
  Sheet,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatExpressionForDisplay } from "@/lib/calculator";
import {
  exportHistoryCsv,
  exportHistoryDocx,
  exportHistoryJson,
  exportHistoryPdf,
  exportHistoryTxt,
  exportHistoryXlsx,
} from "@/lib/exportHistory";
import { useToast } from "@/hooks/use-toast";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import type { HistoryItem, ImportableHistoryItem } from "@/hooks/useHistory";

interface HistoryPanelProps {
  open: boolean;
  items: HistoryItem[];
  onClose: () => void;
  onReuse: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onLabel: (id: string, label: string) => void;
  onImport: (items: ImportableHistoryItem[]) => number;
  /**
   * Optional History Cloud Sync status (see `src/hooks/useHistorySync.ts`).
   * Omitted entirely (or `"disabled"`/`"idle"`) renders nothing, so this
   * stays backward compatible with any caller that doesn't pass it.
   */
  syncStatus?: "disabled" | "idle" | "restoring" | "syncing" | "synced" | "error";
  /**
   * Optional Favorites integration (Task 18, see `src/hooks/useFavorites.ts`).
   * Both must be provided together to enable the star toggle on each row;
   * omitted entirely, the row renders exactly as it did before this task.
   */
  isFavorite?: (item: HistoryItem) => boolean;
  onToggleFavorite?: (item: HistoryItem) => void;
}

/** Small badge describing the current cloud-sync state; hidden when there's nothing worth saying. */
function SyncBadge({ status }: { status: HistoryPanelProps["syncStatus"] }) {
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
      className={cn("calc-history-sync", `calc-history-sync--${status}`)}
      title={config.label}
      aria-label={config.label}
    >
      <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} />
    </span>
  );
}

/** One row from an exported history JSON file, loosely typed pre-validation. */
interface RawImportRow {
  expression?: unknown;
  result?: unknown;
  label?: unknown;
  timestamp?: unknown;
}

/**
 * Validate + coerce a single row from an imported JSON file into an
 * `ImportableHistoryItem`. Returns null (rather than throwing) for anything
 * malformed so the caller can skip it and keep going.
 */
function normalizeImportRow(raw: unknown): ImportableHistoryItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as RawImportRow;

  const expression = typeof row.expression === "string" ? row.expression.trim() : "";
  const result = typeof row.result === "string" ? row.result.trim() : "";
  if (!expression || !result) return null;

  const label = typeof row.label === "string" ? row.label.slice(0, 80) : "";

  let timestamp: number;
  if (typeof row.timestamp === "number" && Number.isFinite(row.timestamp)) {
    timestamp = row.timestamp;
  } else if (typeof row.timestamp === "string") {
    const parsed = Date.parse(row.timestamp);
    timestamp = Number.isFinite(parsed) ? parsed : Date.now();
  } else {
    timestamp = Date.now();
  }

  return { expression, result, label, timestamp };
}

/** Parse + validate a whole exported-history JSON payload. */
function parseImportPayload(text: string): ImportableHistoryItem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (typeof data !== "object" || data === null || !Array.isArray((data as { items?: unknown }).items)) {
    throw new Error("This file doesn't look like a history export — expected an \"items\" array.");
  }
  const items = ((data as { items: unknown[] }).items)
    .map(normalizeImportRow)
    .filter((item): item is ImportableHistoryItem => item !== null);
  if (items.length === 0) {
    throw new Error("No valid history entries were found in that file.");
  }
  return items;
}

export function HistoryPanel({
  open,
  items,
  onClose,
  onReuse,
  onRemove,
  onClear,
  onLabel,
  onImport,
  syncStatus,
  isFavorite,
  onToggleFavorite,
}: HistoryPanelProps) {
  const { toast } = useToast();
  useEscapeToClose(open, onClose);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [importFlash, setImportFlash] = useState<boolean>(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportFlashTimer = useRef<number | undefined>(undefined);
  const importFlashTimer = useRef<number | undefined>(undefined);

  /** Briefly flash a success checkmark on an export format (self-clearing). */
  const flashExport = (format: string) => {
    window.clearTimeout(exportFlashTimer.current);
    setExportFlash(format);
    exportFlashTimer.current = window.setTimeout(() => setExportFlash(null), 1100);
  };

  /** Briefly flash a success checkmark on the Import button (self-clearing). */
  const flashImport = () => {
    window.clearTimeout(importFlashTimer.current);
    setImportFlash(true);
    importFlashTimer.current = window.setTimeout(() => setImportFlash(false), 1100);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(exportFlashTimer.current);
      window.clearTimeout(importFlashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [exportOpen]);

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

  const handleImportClick = () => {
    setExportOpen(false);
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so selecting the same file again still fires onChange.
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseImportPayload(text);
      const added = onImport(parsed);
      setImportError(null);
      if (added > 0) flashImport();
      toast({
        title: added > 0 ? "History imported" : "Nothing new to import",
        description:
          added > 0
            ? `${added} item${added === 1 ? "" : "s"} added to your history.`
            : "Every entry in that file was already in your history.",
        className: "calc-toast",
      });
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Couldn't read that file — please try again.",
      );
    }
  };
  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          item.expression.toLowerCase().includes(q) ||
          item.result.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q)
        );
      })
    : items;

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
        aria-label="Calculation history"
        aria-hidden={!open}
      >
        <header className="calc-history-header">
          <div className="flex items-center gap-2">
            <HistoryIcon className="t-accent h-4 w-4" />
            <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
              HISTORY
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
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
          </header>

        {items.length > 0 && (
          <div className="calc-history-search">
            <Search className="h-3.5 w-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history…"
              aria-label="Search calculation history"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="calc-history-search-clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="calc-history-actions">
          <button
            type="button"
            className={cn("calc-export-btn", importFlash && "calc-flash-success")}
            onClick={handleImportClick}
            aria-label="Import history from a JSON file"
            title="Import history from a JSON file"
          >
            {importFlash ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              void handleImportFile(e);
            }}
            aria-label="Import history JSON file"
          />
          {items.length > 0 && (
            <>
            <div className="calc-export-menu" ref={exportRef}>
              <button
                type="button"
                className={cn("calc-export-btn", exportFlash && "calc-flash-success")}
                onClick={() => setExportOpen((v) => !v)}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                aria-label="Download history"
                title="Download history"
              >
                {exportFlash ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download
                <ChevronDown className={cn("h-3 w-3", exportOpen && "calc-csel-chev--open")} />
              </button>
              {exportOpen && (
                  <div className="calc-export-dropdown" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="calc-export-item"
                      onClick={() => {
                        exportHistoryCsv(items);
                        setExportOpen(false);
                        flashExport("csv");
                      }}
                    >
                      <Sheet className="h-3.5 w-3.5" /> CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="calc-export-item"
                      onClick={() => {
                        exportHistoryXlsx(items)
                          .then(() => flashExport("xlsx"))
                          .catch(() => {
                            /* ignore export errors */
                          });
                        setExportOpen(false);
                      }}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="calc-export-item"
                      onClick={() => {
                        exportHistoryDocx(items)
                          .then(() => flashExport("docx"))
                          .catch(() => {
                            /* ignore export errors */
                          });
                        setExportOpen(false);
                      }}
                    >
                      <FileType className="h-3.5 w-3.5" /> Word (.docx)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="calc-export-item"
                      onClick={() => {
                        exportHistoryJson(items);
                        setExportOpen(false);
                        flashExport("json");
                      }}
                    >
                      <FileJson className="h-3.5 w-3.5" /> JSON
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="calc-export-item"
                      onClick={() => {
                        exportHistoryTxt(items);
                        setExportOpen(false);
                        flashExport("txt");
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" /> Text (.txt)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="calc-export-item"
                      onClick={() => {
                        exportHistoryPdf(items)
                          .then(() => flashExport("pdf"))
                          .catch(() => {
                            /* ignore export errors */
                          });
                        setExportOpen(false);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={cn(
                  "calc-history-clear",
                  confirmClear && "calc-history-clear--confirm",
                )}
                onClick={handleClear}
                aria-label={confirmClear ? "Tap again to confirm clearing all history" : "Clear all history"}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmClear ? "Tap again to clear" : "Clear all"}
              </button>
            </>
          )}
        </div>

        {importError && (
          <div className="mb-2 flex items-start gap-1.5 text-xs text-rose-300/90">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 translate-y-[1px]" />
            <span>{importError}</span>
          </div>
        )}

        {filteredItems.length > 0 ? (
          <ul className="calc-history-list">
            {filteredItems.map((item) => (
                <li key={item.id} className="calc-history-item">
                  {isFavorite && onToggleFavorite && (
                    <button
                      type="button"
                      className={cn(
                        "calc-history-fav",
                        isFavorite(item) && "calc-history-fav--active",
                      )}
                      onClick={() => onToggleFavorite(item)}
                      aria-pressed={isFavorite(item)}
                      aria-label={isFavorite(item) ? "Remove from favorites" : "Add to favorites"}
                      title={isFavorite(item) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={cn("h-3.5 w-3.5", isFavorite(item) && "fill-current")} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="calc-history-del"
                    onClick={() => onRemove(item.id)}
                    aria-label="Delete history item"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div
                    className={cn(
                      "calc-history-body",
                      isFavorite && onToggleFavorite && "calc-history-body--with-fav",
                    )}
                    onClick={() => onReuse(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onReuse(item);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Reuse calculation: ${formatExpressionForDisplay(item.expression) || item.result} equals ${item.result}`}
                    title="Reuse this result"
                  >
                    <input
                      className="calc-history-note"
                      defaultValue={item.label}
                      placeholder="Add a note…"
                      maxLength={80}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => onLabel(item.id, e.target.value.trim())}
                      onKeyDown={handleNoteKey}
                      aria-label="Note for this calculation"
                    />
                    <div className="calc-history-expr">
                      {formatExpressionForDisplay(item.expression) || item.result}
                    </div>
                    <div className="calc-history-result">= {item.result}</div>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <div className="calc-history-empty">
            <HistoryIcon className="t-muted mx-auto mb-3 h-8 w-8" />
            <p className="t-secondary text-sm">
              {searchQuery ? "No matching calculations." : "No calculations yet."}
            </p>
            <p className="t-muted mt-1 text-xs">
              {searchQuery
                ? "Try a different search term."
                : "Results you compute will appear here for quick reuse."}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
