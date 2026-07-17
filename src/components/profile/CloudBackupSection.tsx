"use client";

import { useEffect, useState } from "react";
import { Check, Cloud, CloudOff, Download, History, Loader2, RefreshCw, Settings2, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClickSound } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { useCloudBackup, type CloudBackupFeatureInfo, type CloudBackupStatus } from "@/hooks/useCloudBackup";
import type { BackupFeature } from "@/lib/backup/backupTimestamps";

const FEATURE_LABELS: Record<BackupFeature, string> = {
  history: "Calculation history",
  memory: "Calculator memory",
  settings: "Theme & settings",
  favorites: "Favorites",
};

const FEATURE_ICONS: Record<BackupFeature, typeof History> = {
  history: History,
  memory: Zap,
  settings: Settings2,
  favorites: Star,
};

const ROW_STATUS_LABEL: Record<CloudBackupFeatureInfo["status"], string> = {
  disabled: "Not available",
  idle: "Waiting",
  restoring: "Restoring…",
  syncing: "Backing up…",
  synced: "Backed up",
  error: "Paused",
};

/** Formats a backup timestamp as a short, human "Last Backup Time" string. */
function formatBackupTime(ms: number | null): string {
  if (ms === null) return "Never";
  const diffSeconds = Math.round((Date.now() - ms) / 1000);
  if (diffSeconds < 5) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const date = new Date(ms);
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function summaryCopy(status: CloudBackupStatus): { title: string; sub: string } {
  switch (status) {
    case "disabled":
      return { title: "Cloud Backup unavailable", sub: "No cloud project is configured for this app." };
    case "guest":
      return {
        title: "Automatic Backup is off",
        sub: "Sign in with Google or GitHub to back up your data to the cloud.",
      };
    case "restoring":
      return { title: "Restoring your backup…", sub: "Fetching your data from the cloud." };
    case "syncing":
      return { title: "Backing up now…", sub: "Your latest changes are being saved to the cloud." };
    case "synced":
      return { title: "All backed up", sub: "Your data is safely stored in the cloud." };
    case "error":
      return { title: "Backup paused", sub: "A recent backup attempt failed — it will retry automatically." };
    case "idle":
    default:
      return { title: "Automatic Backup is on", sub: "Your data will back up as soon as something changes." };
  }
}

/**
 * Cloud Backup — Automatic Backup / Backup Status / Last Backup Time
 * (Task 19), plus explicit manual "Back up now" (Task 20) and
 * "Restore backup" (Task 21) actions.
 *
 * A read-only, professional summary of the four independent cloud-sync
 * features already built by Tasks 15-18 (history, calculator memory,
 * theme/settings, favorites), plus a manual "Back up now" action for
 * signed-in users who want to force an immediate push instead of waiting
 * for the usual short debounce, and a "Restore backup" action that pulls
 * the latest cloud backup down and replaces local state with it (unlike
 * the automatic restore-after-login effects each `use*Sync()` hook already
 * runs once per sign-in, which merge cloud data into local instead of
 * replacing it). Guest Mode sees an honest explanation of why nothing is
 * backed up yet rather than an empty/broken-looking panel — consistent
 * with how `AccountPanel.tsx`/other sections in this app treat Guest Mode
 * as a fully first-class, non-degraded state; the Restore backup button
 * (like Back up now) simply isn't rendered for guests, since there's no
 * cloud backup to restore.
 */
export function CloudBackupSection() {
  const backup = useCloudBackup();
  const clickSound = useClickSound();
  const { toast } = useToast();
  const [justBackedUp, setJustBackedUp] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const handleBackupNow = async () => {
    clickSound();
    const result = await backup.backupNow();
    if (result.ok) {
      setJustBackedUp(true);
      toast({
        title: "Backup successful",
        description: "Your calculator data was saved to the cloud.",
        className: "calc-toast",
      });
    } else {
      setJustBackedUp(false);
      const failedNames = result.failedFeatures.map((f) => FEATURE_LABELS[f]).join(", ");
      toast({
        title: "Backup failed",
        description: failedNames ? `Couldn't back up: ${failedNames}. ${result.error}` : result.error,
        variant: "destructive",
        className: "calc-toast",
      });
    }
  };

  /**
   * Restoring overwrites local history/favorites/memory/settings with the
   * latest cloud backup, so — mirroring `HistoryPanel.tsx`'s existing
   * "tap again to confirm" pattern for its own destructive "Clear all"
   * button, rather than introducing a new modal-dialog convention this app
   * doesn't otherwise use — the first click only arms a brief confirm
   * state; the actual restore only fires on a second click within 3s.
   */
  const handleRestoreBackup = async () => {
    clickSound();
    if (!confirmRestore) {
      setConfirmRestore(true);
      window.setTimeout(() => setConfirmRestore(false), 3000);
      return;
    }
    setConfirmRestore(false);
    const result = await backup.restoreBackup();
    if (result.ok) {
      toast({
        title: "Restore successful",
        description: "Your latest cloud backup was restored to this device.",
        className: "calc-toast",
      });
    } else {
      const failedNames = result.failedFeatures.map((f) => FEATURE_LABELS[f]).join(", ");
      toast({
        title: "Restore failed",
        description: failedNames ? `Couldn't restore: ${failedNames}. ${result.error}` : result.error,
        variant: "destructive",
        className: "calc-toast",
      });
    }
  };

  useEffect(() => {
    if (backup.status === "synced" && justBackedUp) {
      const t = window.setTimeout(() => setJustBackedUp(false), 2600);
      return () => window.clearTimeout(t);
    }
  }, [backup.status, justBackedUp]);

  const { title, sub } = summaryCopy(backup.status);
  const isBusy = backup.status === "restoring" || backup.status === "syncing" || backup.isBackingUpNow || backup.isRestoringNow;
  const isErrorSummary = backup.status === "error";

  const showDetails = backup.configured && backup.status !== "guest";

  return (
    <section className="calc-settings-section profile-section" aria-labelledby="profile-backup-heading">
      <h2 id="profile-backup-heading">Cloud backup</h2>

      <div className="profile-backup-summary">
        <span
          className={cn("profile-backup-summary-icon", isErrorSummary && "profile-backup-summary-icon--error")}
          aria-hidden
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isErrorSummary ? (
            <CloudOff className="h-4 w-4" />
          ) : (
            <Cloud className="h-4 w-4" />
          )}
        </span>
        <div className="profile-backup-summary-text">
          <p className="profile-backup-summary-title">{title}</p>
          <p className="profile-backup-summary-sub">{sub}</p>
        </div>
        {backup.automaticBackupEnabled ? (
          <div className="profile-backup-actions">
            <button
              type="button"
              className="profile-save-btn profile-backup-now-btn"
              disabled={isBusy}
              onClick={() => {
                void handleBackupNow();
              }}
            >
              {backup.isBackingUpNow ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : justBackedUp && backup.status === "synced" ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              Back up now
            </button>
            <button
              type="button"
              className={cn(
                "profile-cancel-btn profile-backup-restore-btn",
                confirmRestore && "profile-backup-restore-btn--confirm",
              )}
              disabled={isBusy}
              onClick={() => {
                void handleRestoreBackup();
              }}
              aria-label={confirmRestore ? "Tap again to confirm restoring the latest backup" : "Restore backup"}
            >
              {backup.isRestoringNow ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden />
              )}
              {confirmRestore ? "Tap again to restore" : "Restore backup"}
            </button>
          </div>
        ) : null}
      </div>

      <p
        className={cn(
          "profile-backup-auto-note",
          backup.automaticBackupEnabled && "profile-backup-auto-note--on",
        )}
      >
        <Zap className="h-3.5 w-3.5" aria-hidden />
        {backup.automaticBackupEnabled
          ? "Automatic Backup is enabled — every change is saved to the cloud automatically."
          : "Automatic Backup turns on the moment you sign in."}
      </p>

      {showDetails ? (
        <>
          <p className="profile-subsection-label">Last backup time: {formatBackupTime(backup.lastBackupAt)}</p>
          <div className="profile-backup-list">
            {backup.features.map((feature) => {
              const Icon = FEATURE_ICONS[feature.key];
              return (
                <div className="profile-backup-row" key={feature.key}>
                  <span
                    className={cn("profile-backup-row-icon", `profile-backup-row-icon--${feature.status}`)}
                    aria-hidden
                  >
                    {feature.status === "restoring" || feature.status === "syncing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="profile-backup-row-text">
                    <p className="profile-backup-row-label">{feature.label}</p>
                    <p className="profile-backup-row-time">{formatBackupTime(feature.lastBackupAt)}</p>
                  </div>
                  <span
                    className={cn("profile-backup-row-status", `profile-backup-row-status--${feature.status}`)}
                  >
                    {ROW_STATUS_LABEL[feature.status]}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="profile-backup-guest-note">
          Sign in with Google or GitHub above to automatically back up your calculation history,
          calculator memory, theme/settings, and favorites — and restore them on any device.
        </p>
      )}
    </section>
  );
}
