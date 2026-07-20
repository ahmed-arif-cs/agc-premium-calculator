"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UseInstallPromptReturn {
  /** True when the browser fired `beforeinstallprompt` (Chrome/Edge on Android & desktop) — `promptInstall()` shows the native install dialog. */
  canInstall: boolean;
  /** True on iOS (Safari/Chrome/etc), where no native prompt exists at all — show manual "Add to Home Screen" steps instead. */
  canShowIOSInstructions: boolean;
  installed: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
  dismissed: boolean;
}

const DISMISS_KEY = "ahmed-calc:install-dismissed";

function detectIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIPadOS13Plus =
    ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document;
  return /iPad|iPhone|iPod/.test(ua) || isIPadOS13Plus;
}

/**
 * Captures the `beforeinstallprompt` event so we can show a custom
 * "Add to Home Screen" banner on Chrome/Edge (Android + desktop). iOS
 * never fires that event — `isIOS`/`canShowIOSInstructions` let callers
 * fall back to manual step-by-step instructions there instead. Also
 * tracks whether the app is already installed (via the `appinstalled`
 * event / display-mode: standalone).
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState<boolean>(detectIOS);
  const [installed, setInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return !!standalone;
  });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  return {
    canInstall: !!deferred && !installed && !dismissed,
    canShowIOSInstructions: isIOS && !installed && !dismissed,
    installed,
    isIOS,
    promptInstall,
    dismiss,
    dismissed,
  };
}