"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";

interface IOSInstallStepsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * iOS never fires `beforeinstallprompt` — Safari/Chrome/etc on iPhone/iPad
 * can only install a PWA through the manual Share -> "Add to Home Screen"
 * flow. This spells that out step by step. Shown from both
 * `InstallBanner.tsx` (auto banner) and the hamburger menu's "Install App"
 * item (`Calculator.tsx`), so it's reachable any time, not just while the
 * banner happens to be visible.
 */
export function IOSInstallSteps({ open, onClose }: IOSInstallStepsProps) {
  if (!open) return null;

  return (
    <div
      className="calc-settings-backdrop calc-settings-backdrop--open"
      onClick={onClose}
      aria-hidden
    >
      <div
        className="calc-ios-install-card"
        role="dialog"
        aria-label="Install on iOS"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="calc-settings-header">
          <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
            INSTALL ON IPHONE / IPAD
          </h2>
          <button type="button" className="calc-settings-close" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="calc-ios-steps">
          <li>
            <Share className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
            </span>
          </li>
          <li>
            <SquarePlus className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li>
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Tap <strong>Add</strong> — AGC Premium Calculator now opens like any other app, even offline.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}