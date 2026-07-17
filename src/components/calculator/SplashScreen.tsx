"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Premium AGC boot splash — shown once on initial mount over the app shell,
 * then animates out to reveal the calculator underneath.
 *
 * Sequence: mark scales/fades in with an expanding gold glow ring →
 * brief settled hold → whole overlay fades + the mark lifts slightly →
 * component unmounts (removed from the DOM, not just hidden).
 *
 * Respects `prefers-reduced-motion` by shortening the hold and skipping
 * the ring/shimmer motion in favor of a plain fade.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "done">("in");

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const holdDelay = reduced ? 350 : 900;
    const outDelay = reduced ? 250 : 550;

    const t1 = window.setTimeout(() => setPhase("hold"), holdDelay);
    const t2 = window.setTimeout(() => setPhase("out"), holdDelay + 50);
    const t3 = window.setTimeout(() => setPhase("done"), holdDelay + 50 + outDelay);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`calc-splash${phase === "out" ? " calc-splash-out" : ""}`}
      role="status"
      aria-label="Loading AGC Premium Calculator"
      aria-live="polite"
    >
      <div className="calc-splash-glow" aria-hidden />
      <div className="calc-splash-mark-wrap">
        <span className="calc-splash-ring" aria-hidden />
        <span className="calc-splash-ring calc-splash-ring-2" aria-hidden />
        <div className="calc-splash-mark">
          <Image
            src="/agc-mark.png"
            alt=""
            width={96}
            height={96}
            priority
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <p className="calc-splash-word">
        <span>AGC</span>
      </p>
      <p className="calc-splash-tag">Building Digital Excellence</p>
      <span className="calc-splash-shimmer" aria-hidden />
    </div>
  );
}
