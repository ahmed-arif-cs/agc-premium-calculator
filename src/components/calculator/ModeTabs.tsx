"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { CalculatorMode } from "@/hooks/useCalculator";

interface ModeTabDef {
  id: CalculatorMode;
  label: string;
}

const TABS: ModeTabDef[] = [
  { id: "standard", label: "Standard" },
  { id: "scientific", label: "Scientific" },
  { id: "converter", label: "Converter" },
  { id: "programmer", label: "Programmer" },
];

interface ModeTabsProps {
  mode: CalculatorMode;
  onChange: (mode: CalculatorMode) => void;
}

function ModeTabsImpl({ mode, onChange }: ModeTabsProps) {
  const activeIndex = TABS.findIndex((t) => t.id === mode);

  return (
    <div
      className="calc-tabs"
      data-active={activeIndex < 0 ? 0 : activeIndex}
      role="tablist"
      aria-label="Calculator mode"
    >
      <span className="calc-tabs-indicator" aria-hidden />
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={mode === tab.id}
          aria-label={`${tab.label} mode`}
          className={cn("calc-tab", mode === tab.id && "calc-tab--active")}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// `mode`/`onChange` (a stable `useState` setter) only change when the user
// actually switches tabs, but the parent `Calculator` re-renders on every
// keystroke — memoizing avoids re-rendering this subtree (and re-running
// its `TABS.findIndex` + `.map`) on every one of those unrelated updates.
export const ModeTabs = memo(ModeTabsImpl);
