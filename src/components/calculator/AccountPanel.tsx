"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Chrome, Cloud, CloudOff, Github, Loader2, LogOut, ShieldCheck, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClickSound } from "@/hooks/useSettings";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useCloudBackup } from "@/hooks/useCloudBackup";

interface AccountPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-out account panel: Google/GitHub sign-in / sign-out, with loading
 * and error states. Reuses the same `.calc-settings-*` shell as
 * `SettingsPanel`/`AboutPanel` so it looks and behaves like a native part
 * of the app rather than a bolted-on login screen. Both providers share
 * one `.calc-google-btn` button style and the same `auth.isSigningIn`/
 * `auth.error` state from `useAuth()` — no per-provider UI branching.
 *
 * Guest mode needs nothing from here to keep working — this panel is
 * purely an opt-in on top of it (see `src/lib/auth/`, `src/components/auth/SessionProvider.tsx`).
 *
 * Also links out to the full `/profile` page (`src/components/profile/ProfileView.tsx`)
 * for avatar/name editing, account information, and account settings — this
 * panel itself stays a quick sign-in/sign-out surface, not a duplicate of it.
 */
const BACKUP_STATUS_LABEL: Record<string, string> = {
  restoring: "Restoring your backup…",
  syncing: "Backing up…",
  synced: "Backed up",
  error: "Backup paused — will retry",
  idle: "Backup enabled",
};

export function AccountPanel({ open, onClose }: AccountPanelProps) {
  const auth = useAuth();
  const clickSound = useClickSound();
  const backup = useCloudBackup();
  useEscapeToClose(open, onClose);

  const initials = (auth.user?.name ?? auth.user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <div
        className={cn("calc-settings-backdrop", open && "calc-settings-backdrop--open")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn("calc-settings-panel", open && "calc-settings-panel--open")}
        role="dialog"
        aria-modal={open}
        aria-label="Account"
        aria-hidden={!open}
      >
        <header className="calc-settings-header">
          <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
            ACCOUNT
          </h2>
          <button
            type="button"
            className="calc-settings-close"
            onClick={onClose}
            aria-label="Close account panel"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="calc-settings-body">
          {auth.error ? (
            <div className="calc-auth-error" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{auth.error}</span>
              <button
                type="button"
                className="calc-auth-error-dismiss"
                onClick={auth.clearError}
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {auth.isInitializing ? (
            <div className="calc-auth-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking your session…</span>
            </div>
          ) : auth.isAuthenticated && auth.user ? (
            <div className="calc-settings-section">
              <h3>Signed in</h3>
              <div className="calc-account-card">
                {auth.user.avatarUrl ? (
                  <Image
                    src={auth.user.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="calc-account-avatar-img"
                  />
                ) : (
                  <div className="calc-account-avatar-fallback" aria-hidden>
                    {initials}
                  </div>
                )}
                <div className="min-w-0 leading-tight">
                  <p className="calc-account-name">{auth.user.name || "Account"}</p>
                  <p className="calc-account-email">{auth.user.email}</p>
                </div>
              </div>

              <Link href="/profile" className="calc-account-profile-link" onClick={clickSound}>
                <User className="h-3.5 w-3.5" />
                View full profile
              </Link>

              {backup.configured ? (
                <Link href="/profile" className="calc-account-profile-link" onClick={clickSound}>
                  {backup.status === "error" ? (
                    <CloudOff className="h-3.5 w-3.5" />
                  ) : backup.status === "restoring" || backup.status === "syncing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Cloud className="h-3.5 w-3.5" />
                  )}
                  {BACKUP_STATUS_LABEL[backup.status] ?? "Cloud backup"}
                </Link>
              ) : null}

              <button
                type="button"
                className="calc-account-signout"
                onClick={() => {
                  clickSound();
                  void auth.signOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>

              <p className="calc-account-hint">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Your calculator data stays on this device either way — signing out just returns
                you to Guest Mode.
              </p>
            </div>
          ) : (
            <div className="calc-settings-section">
              <h3>Sign in</h3>
              <p className="calc-account-hint calc-account-hint--top">
                Optional — the calculator already works fully in Guest Mode with no account.
                Sign in with Google or GitHub to link this device to your account.
              </p>
              <div className="calc-oauth-btn-group">
                <button
                  type="button"
                  className="calc-google-btn"
                  disabled={auth.isSigningIn}
                  onClick={() => {
                    clickSound();
                    void auth.signInWithGoogle();
                  }}
                >
                  {auth.signingInProvider === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Chrome className="h-4 w-4" />
                  )}
                  {auth.signingInProvider === "google"
                    ? "Redirecting to Google…"
                    : "Sign in with Google"}
                </button>

                <button
                  type="button"
                  className="calc-google-btn"
                  disabled={auth.isSigningIn}
                  onClick={() => {
                    clickSound();
                    void auth.signInWithGithub();
                  }}
                >
                  {auth.signingInProvider === "github" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Github className="h-4 w-4" />
                  )}
                  {auth.signingInProvider === "github"
                    ? "Redirecting to GitHub…"
                    : "Sign in with GitHub"}
                </button>
              </div>

              <div className="calc-toggle-row">
                <span>Guest ID</span>
                <span className="calc-account-guest-id">{auth.guestId}</span>
              </div>

              <Link href="/profile" className="calc-account-profile-link" onClick={clickSound}>
                <User className="h-3.5 w-3.5" />
                View full profile
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
