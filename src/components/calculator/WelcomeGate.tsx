"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Chrome, Github, Loader2, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClickSound } from "@/hooks/useSettings";

const WELCOME_SEEN_KEY = "agc-welcome-seen-v1";

/**
 * First-launch gate — shown once per device, after the boot splash,
 * before the calculator itself. Lets a first-time visitor choose
 * Google / GitHub sign-in or Guest Mode up front, instead of only
 * discovering the option later via the account button. Guest Mode
 * remains the default and fully-usable path — picking it (or dismissing
 * via sign-in) just marks this device as "seen" in localStorage so the
 * gate never appears again.
 */
export function WelcomeGate() {
  const auth = useAuth();
  const clickSound = useClickSound();
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(WELCOME_SEEN_KEY) === "1";
    } catch {
      seen = true;
    }
    if (seen) {
      setChecked(true);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 300 : 1500;
    const t = window.setTimeout(() => setVisible(true), delay);
    setChecked(true);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
    } catch {
      // Storage unavailable — the gate may reappear next visit, non-critical.
    }
    setPhase("out");
    window.setTimeout(() => setVisible(false), 350);
  };

  const handleGuest = () => {
    clickSound();
    dismiss();
  };

  const handleGoogle = () => {
    clickSound();
    dismiss();
    void auth.signInWithGoogle();
  };

  const handleGithub = () => {
    clickSound();
    dismiss();
    void auth.signInWithGithub();
  };

  if (!checked || !visible) return null;

  return (
    <div
      className={`calc-welcome-gate${phase === "out" ? " calc-welcome-gate--out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to AGC Premium Calculator"
    >
      <div className="calc-bg-glow" aria-hidden />
      <div className="calc-glass calc-welcome-card">
        <div className="calc-welcome-mark" aria-hidden>
          <Image
            src="/agc-mark.png"
            alt=""
            width={96}
            height={96}
            priority
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="calc-welcome-title">
          Welcome <span className="t-accent">Back</span>
        </h1>
        <p className="t-muted calc-welcome-sub">
          Sign in to continue to AGC Premium Calculator
        </p>

        {auth.error ? <p className="calc-welcome-error">{auth.error}</p> : null}

        <button
          type="button"
          className="calc-google-btn calc-welcome-oauth-btn"
          disabled={auth.isSigningIn}
          onClick={handleGoogle}
        >
          {auth.signingInProvider === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Chrome className="h-4 w-4" />
          )}
          {auth.signingInProvider === "google" ? "Redirecting to Google…" : "Sign in with Google"}
        </button>

        <button
          type="button"
          className="calc-google-btn calc-welcome-oauth-btn"
          disabled={auth.isSigningIn}
          onClick={handleGithub}
        >
          {auth.signingInProvider === "github" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Github className="h-4 w-4" />
          )}
          {auth.signingInProvider === "github" ? "Redirecting to GitHub…" : "Sign in with GitHub"}
        </button>

        <div className="calc-welcome-divider" aria-hidden>
          <span>OR</span>
        </div>

        <button
          type="button"
          className="calc-welcome-guest-btn"
          disabled={auth.isSigningIn}
          onClick={handleGuest}
        >
          <User className="h-4 w-4" />
          <span className="calc-welcome-guest-text">
            <span className="calc-welcome-guest-title">Continue as Guest</span>
            <span className="calc-welcome-guest-sub">No account required</span>
          </span>
        </button>

        <p className="calc-welcome-footnote">
          <ShieldCheck className="h-3.5 w-3.5" />
          Your data is encrypted and secure
        </p>
      </div>
    </div>
  );
}