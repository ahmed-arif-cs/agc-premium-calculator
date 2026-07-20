"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

interface AboutPanelProps {
  open: boolean;
  onClose: () => void;
}

const FEATURES = [
  "Standard & scientific modes with full memory (M+ / M− / MR / MC)",
  "Currency & unit converters with offline-safe live rates",
  "Smart input — natural language, equations & voice",
  "History with undo/redo, notes, and import / export (CSV, Excel, JSON, TXT, PDF)",
  "Installable, offline-ready PWA",
];

export function AboutPanel({ open, onClose }: AboutPanelProps) {
  useEscapeToClose(open, onClose);

  return (
    <>
      <div
        className={cn("calc-settings-backdrop", open && "calc-settings-backdrop--open")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn("calc-settings-panel calc-about-panel", open && "calc-settings-panel--open")}
        role="dialog"
        aria-modal={open}
        aria-label="About"
        aria-hidden={!open}
      >
        <header className="calc-settings-header">
          <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
            ABOUT
          </h2>
          <button
            type="button"
            className="calc-settings-close"
            onClick={onClose}
            aria-label="Close about"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="calc-settings-body calc-about-body">
          <div className="calc-about-hero">
            <div className="calc-about-mark">
              <Image
                src="/agc-mark.png"
                alt="AGC — Ahmed Group of Companies logo"
                width={72}
                height={72}
                className="h-full w-full object-cover"
              />
            </div>
            <h3 className="calc-about-title font-display">AGC Premium Calculator</h3>
            <p className="calc-about-company">Ahmed Group of Companies</p>
            <p className="calc-about-tagline">Building Digital Excellence</p>
          </div>

          <div className="calc-settings-section">
            <h3>What&apos;s inside</h3>
            <ul className="calc-about-list">
              {FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          <div className="calc-settings-section">
            <h3>Details</h3>
            <div className="calc-about-meta">
              <div className="calc-about-meta-row">
                <span>Version</span>
                <span>1.0.0</span>
              </div>
              <div className="calc-about-meta-row">
                <span>Made by</span>
                <span>AGC — Ahmed Group of Companies</span>
              </div>
            </div>
          </div>

          <p className="calc-about-footer">
            © {new Date().getFullYear()} Ahmed Group of Companies. All rights reserved.
          </p>
        </div>
      </aside>
    </>
  );
}
