"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Small fixed banner that appears when the browser goes offline
 * (navigator.onLine === false) and disappears automatically once
 * connectivity returns. Purely a UI signal — does not affect the
 * existing offlineRates.ts data-fallback logic in the currency
 * converter, which keeps working independently either way.
 */
export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-indicator" role="status" aria-live="polite">
      <WifiOff className="h-3.5 w-3.5" />
      <span>You&apos;re offline — some features may be limited</span>
    </div>
  );
}