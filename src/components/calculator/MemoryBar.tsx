"use client";

import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatResult } from "@/lib/calculator";
import type { UseCalculatorReturn } from "@/hooks/useCalculator";

type MemorySyncStatus = "disabled" | "idle" | "restoring" | "syncing" | "synced" | "error";

interface MemoryBarProps {
  calc: UseCalculatorReturn;
  /**
   * Cloud sync status from `useMemorySync()` (mounted site-wide in
   * `SettingsApplier.tsx` as of Task 22; `Calculator.tsx` just passes its
   * read-only `useMemorySyncStatus()` value through as this prop). Optional
   * and backward compatible: omitting it, or passing "disabled"/"idle",
   * renders nothing — so any other/future caller of this component that
   * doesn't pass it is unaffected. Mirrors `HistoryPanel.tsx`'s
   * `syncStatus` prop.
   */
  syncStatus?: MemorySyncStatus;
}

/** Small badge describing the current memory cloud-sync state; hidden when there's nothing worth saying. */
function SyncBadge({ status }: { status: MemorySyncStatus | undefined }) {
  if (!status || status === "disabled" || status === "idle") return null;

  const config = {
    restoring: { icon: Loader2, label: "Restoring memory from cloud…", spin: true },
    syncing: { icon: Loader2, label: "Syncing memory…", spin: true },
    synced: { icon: Cloud, label: "Memory synced to your account", spin: false },
    error: { icon: CloudOff, label: "Memory sync paused — will retry", spin: false },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn("calc-mem-sync", `calc-mem-sync--${status}`)}
      title={config.label}
      aria-label={config.label}
    >
      <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} />
    </span>
  );
}

export function MemoryBar({ calc, syncStatus }: MemoryBarProps) {
  const { hasMemory, memory } = calc;
  const memLabel = hasMemory ? formatResult(memory) : "0";

  return (
    <div className="calc-mem" role="group" aria-label="Memory functions">
      <div
        className={cn("calc-mem-indicator", hasMemory && "calc-mem-indicator--active")}
        title={hasMemory ? `Memory: ${memLabel}` : "No value in memory"}
      >
        <span className="calc-mem-dot">M</span>
      </div>
      <SyncBadge status={syncStatus} />
      <button
        type="button"
        className="calc-mem-btn"
        onClick={calc.memoryClear}
        disabled={!hasMemory}
        aria-label="Memory clear"
        title="Memory clear"
      >
        MC
      </button>
      <button
        type="button"
        className="calc-mem-btn"
        onClick={calc.memoryRecall}
        disabled={!hasMemory}
        aria-label="Memory recall"
        title="Memory recall"
      >
        MR
      </button>
      <button
        type="button"
        className="calc-mem-btn"
        onClick={calc.memoryAdd}
        aria-label="Memory add"
        title="Memory add"
      >
        M+
      </button>
      <button
        type="button"
        className="calc-mem-btn"
        onClick={calc.memorySubtract}
        aria-label="Memory subtract"
        title="Memory subtract"
      >
        M−
      </button>
    </div>
  );
}
