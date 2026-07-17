"use client";

import { AlertTriangle, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseCalculatorReturn } from "@/hooks/useCalculator";

interface DisplayProps {
  calc: UseCalculatorReturn;
}

function resultBaseRem(value: string): number {
  const len = value.length;
  if (len <= 8) return 3.75;
  if (len <= 12) return 3;
  if (len <= 16) return 2.25;
  return 1.75;
}

export function Display({ calc }: DisplayProps) {
  const { displayExpression, result, error, isEvaluated, copyResult, copied, mode, angleMode } = calc;

  const expressionLabel = displayExpression
    ? isEvaluated
      ? `${displayExpression} =`
      : displayExpression
    : "0";

  return (
    <div className="mb-4 select-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-h-[1.5rem] items-center gap-2">
          {mode === "scientific" ? (
            <span
              className="u-chip rounded-md px-1.5 py-0.5 font-display text-[10px] font-medium tracking-wider"
              title="Angle mode"
            >
              {angleMode.toUpperCase()}
            </span>
          ) : null}
        </div>
        <div
          className="t-secondary min-h-[1.5rem] flex-1 break-words text-right font-display text-sm sm:text-base"
          aria-live="polite"
        >
          {expressionLabel}
        </div>
        <button
          type="button"
          onClick={copyResult}
          aria-label="Copy result to clipboard"
          className={cn(
            "shrink-0 rounded-lg border p-1.5 transition-colors duration-200",
            copied
              ? "border-[color:rgba(var(--c-accent-rgb),0.6)] bg-[color:rgba(var(--c-accent-rgb),0.15)] t-accent"
              : "border-[color:rgba(var(--c-surface-rgb),0.1)] bg-[color:rgba(var(--c-surface-rgb),0.05)] t-muted hover:t-accent hover:border-[color:rgba(var(--c-accent-rgb),0.4)]",
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <div
        className="calc-result mt-1 break-all text-right font-display font-semibold"
        style={{
          fontSize: `calc(${resultBaseRem(result)}rem * var(--fs, 1))`,
          lineHeight: 1.1,
          filter: "drop-shadow(0 0 18px rgba(var(--c-accent-rgb),0.25))",
        }}
        aria-live="polite"
      >
        {result}
      </div>

      <div className="mt-2 min-h-[1.25rem] text-right">
        {error ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-300/90">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
