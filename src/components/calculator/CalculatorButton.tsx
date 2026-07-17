"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useClickSound } from "@/hooks/useSettings";

export type ButtonVariant = "number" | "operator" | "function" | "equals";

interface CalculatorButtonProps {
  label: ReactNode;
  variant?: ButtonVariant;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function CalculatorButton({
  label,
  variant = "number",
  onClick,
  ariaLabel,
  className,
}: CalculatorButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);
  const clickSound = useClickSound();

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = (idRef.current += 1);
    setRipples((prev) => [...prev, { id, x, y }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, 600);
  };

  const handleClick = () => {
    clickSound();
    onClick();
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={cn(
        "calc-btn min-h-[58px] sm:min-h-[70px]",
        variant === "function" && "calc-btn--function",
        variant === "operator" && "calc-btn--operator",
        variant === "equals" && "calc-btn--equals",
        className,
      )}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="calc-ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      ))}
      <span className="relative z-10">{label}</span>
    </button>
  );
}
