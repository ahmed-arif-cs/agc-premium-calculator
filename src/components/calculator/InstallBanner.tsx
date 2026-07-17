"use client";

import { memo } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

function InstallBannerImpl() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div
      className="calc-install calc-install--show"
      role="dialog"
      aria-label="Install AGC Premium Calculator"
    >
      <div className="calc-install-mark" aria-hidden>
        <Image
          src="/agc-mark.png"
          alt=""
          width={26}
          height={26}
          className="h-full w-full object-cover"
        />
      </div>
      <span className="calc-install-text">Install AGC Premium Calculator for offline use</span>
      <button
        type="button"
        className="calc-install-btn"
        onClick={promptInstall}
        aria-label="Install AGC Premium Calculator"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Install
      </button>
      <button
        type="button"
        className="calc-install-dismiss"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
      >
        Not now
      </button>
    </div>
  );
}

// No props — memoizing means Calculator's frequent re-renders (every
// keystroke) never re-render this subtree; it only re-renders when its own
// `useInstallPrompt` state actually changes.
export const InstallBanner = memo(InstallBannerImpl);
