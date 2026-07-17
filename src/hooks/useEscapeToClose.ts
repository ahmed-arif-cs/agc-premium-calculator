"use client";

import { useEffect } from "react";

/**
 * Closes an open panel/dialog when the user presses Escape.
 * Shared by the slide-out Settings/History/About panels so each one
 * behaves like a proper dialog for keyboard users.
 */
export function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
}
