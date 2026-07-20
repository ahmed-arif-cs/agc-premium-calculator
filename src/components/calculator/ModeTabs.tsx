"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
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

interface IndicatorRect {
  left: number;
  width: number;
}

function ModeTabsImpl({ mode, onChange }: ModeTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [rect, setRect] = useState<IndicatorRect | null>(null);

  const activeIndex = TABS.findIndex((t) => t.id === mode);

  // Measures the *actual* rendered position/width of the active tab button
  // (via getBoundingClientRect) instead of assuming all tabs are equal
  // width. This is what makes the gold indicator align perfectly with
  // every tab regardless of label length ("Standard" vs "Programmer"),
  // and stays correct even if tabs are ever added/removed/relabeled.
  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const activeButton = tabRefs.current[activeIndex < 0 ? 0 : activeIndex];
      if (!container || !activeButton) return;
      const containerBox = container.getBoundingClientRect();
      const buttonBox = activeButton.getBoundingClientRect();
      // 2px inset each side keeps the glow from ever touching the
      // neighboring tab, no matter how wide each label naturally is.
      setRect({
        left: buttonBox.left - containerBox.left + 2,
        width: buttonBox.width - 4,
      });
    };

    measure();

    const container = containerRef.current;
    const resizeObserver = new ResizeObserver(measure);
    if (container) resizeObserver.observe(container);
    window.addEventListener("resize", measure);
    document.fonts?.ready?.then(measure).catch(() => {});

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex]);

  return (
    <div
      className="calc-tabs"
      ref={containerRef}
      data-active={activeIndex < 0 ? 0 : activeIndex}
      role="tablist"
      aria-label="Calculator mode"
    >
      <span
        className="calc-tabs-indicator"
        aria-hidden
        style={
          rect
            ? { left: `${rect.left}px`, width: `${rect.width}px`, opacity: 1 }
            : { opacity: 0 }
        }
      />
      {TABS.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => {
            tabRefs.current[i] = el;
          }}
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
// its measurement effect) on every one of those unrelated updates.
export const ModeTabs = memo(ModeTabsImpl);