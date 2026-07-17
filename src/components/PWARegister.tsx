"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for offline support. Runs only in production
 * (service workers in dev interfere with Turbopack HMR and asset caching).
 * Errors are swallowed so they never break the UI.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {
          // Registration failure is non-fatal.
        });
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
