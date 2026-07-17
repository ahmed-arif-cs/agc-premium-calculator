"use client";

import { CloudOff, Loader2, RefreshCcw, RotateCw, ShieldCheck, TriangleAlert, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCloudBackup, type CloudBackupStatus } from "@/hooks/useCloudBackup";
import { useLastCrossDeviceCheckAt, useMultiDeviceSyncStatus } from "@/hooks/useMultiDeviceSync";

/**
 * Sync Status section — Last Sync / Last Backup / Current Sync State /
 * Sync Progress, on the Profile page's Account settings area, right above
 * the existing Cloud Backup section.
 *
 * This is a read-only, professional status display — no new sync/backup
 * logic lives here at all. Every figure it shows is read straight from
 * `useCloudBackup()` (Task 19's aggregation hook, extended for this task
 * with `lastSyncAt`/`progress`), which itself only ever *reads* the four
 * existing cloud-sync orchestration hooks (`useHistorySync`/
 * `useMemorySync`/`useSettingsSync`/`useFavoritesSync`, all mounted once
 * in `SettingsApplier.tsx` since Task 22) — mounting this component starts
 * no new restore/push cycle and duplicates no network call.
 *
 * - **Current Sync State**: the same overall `CloudBackupStatus` the Cloud
 *   Backup section's summary row already derives, shown here as a compact
 *   state pill (idle / syncing / restoring / synced / error / guest /
 *   unavailable) rather than a full sentence — a quick, scannable status
 *   at a glance.
 * - **Sync Progress**: how many of the four subsystems (history,
 *   calculator memory, theme/settings, favorites) currently report
 *   `"synced"`, shown as a fraction and an AGC gold progress bar. The bar
 *   animates (a moving shimmer) while `progress.active` is true — i.e.
 *   while any subsystem is actually mid-restore or mid-push — rather than
 *   faking sub-step progress within a single push/fetch that has none.
 * - **Last Sync**: the broader of the two timestamps this task asks for —
 *   the most recent successful sync activity of *any* kind, a backup push
 *   **or** a manual restore pull (`useCloudBackup().lastSyncAt`, from the
 *   new `syncActivity.ts` store).
 * - **Last Backup**: the most recent successful backup *push* specifically
 *   (`useCloudBackup().lastBackupAt`, unchanged from Task 19) — kept as
 *   its own row since it's a narrower, still-meaningful figure ("when did
 *   my data last actually get saved to the cloud") distinct from "Last
 *   Sync" the moment a person uses Task 21's restore-only action.
 *
 * Guest Mode / an unconfigured Supabase project get the same honest,
 * non-empty-looking treatment `CloudBackupSection.tsx` already
 * established, rather than a blank or broken-looking card.
 */

const STATE_COPY: Record<CloudBackupStatus, { label: string; icon: typeof ShieldCheck }> = {
  disabled: { label: "Unavailable", icon: CloudOff },
  guest: { label: "Local only", icon: UserX },
  restoring: { label: "Restoring", icon: Loader2 },
  syncing: { label: "Syncing", icon: Loader2 },
  synced: { label: "Synced", icon: ShieldCheck },
  error: { label: "Sync error", icon: TriangleAlert },
  idle: { label: "Idle", icon: RefreshCcw },
};

/** Formats a timestamp as a short, human "time ago" string — a self-contained formatter, same convention `CloudBackupSection.tsx`'s own `formatBackupTime()` already uses. */
function formatTimeAgo(ms: number | null): string {
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

export function SyncStatusSection() {
  const backup = useCloudBackup();
  const multiDeviceStatus = useMultiDeviceSyncStatus();
  const lastCrossDeviceCheckAt = useLastCrossDeviceCheckAt();

  const { label: stateLabel, icon: StateIcon } = STATE_COPY[backup.status];
  const isSpinning = backup.status === "restoring" || backup.status === "syncing";
  const showLive = backup.configured && backup.status !== "guest";
  const isCheckingOtherDevices = multiDeviceStatus === "checking";

  return (
    <section className="calc-settings-section profile-section" aria-labelledby="profile-sync-heading">
      <h2 id="profile-sync-heading">Sync status</h2>

      <div className="profile-sync-grid">
        <div className="profile-sync-tile">
          <p className="profile-sync-tile-label">Current sync state</p>
          <span className={cn("profile-sync-state-pill", `profile-sync-state-pill--${backup.status}`)}>
            <StateIcon className={cn("h-3.5 w-3.5", isSpinning && "animate-spin")} aria-hidden />
            {stateLabel}
          </span>
        </div>

        <div className="profile-sync-tile">
          <p className="profile-sync-tile-label">Last sync</p>
          <p className="profile-sync-tile-value">{showLive ? formatTimeAgo(backup.lastSyncAt) : "—"}</p>
        </div>

        <div className="profile-sync-tile">
          <p className="profile-sync-tile-label">Last backup</p>
          <p className="profile-sync-tile-value">{showLive ? formatTimeAgo(backup.lastBackupAt) : "—"}</p>
        </div>
      </div>

      <div className="profile-sync-progress-block">
        <div className="profile-sync-progress-head">
          <p className="profile-sync-tile-label">
            <RotateCw className="h-3 w-3" aria-hidden style={{ display: "inline", marginRight: 5, verticalAlign: -1 }} />
            Sync progress
          </p>
          <span className="profile-sync-progress-fraction">
            {showLive ? `${backup.progress.completed} of ${backup.progress.total} synced` : "0 of 4 synced"}
          </span>
        </div>
        <div
          className="profile-sync-progress-track"
          role="progressbar"
          aria-valuenow={showLive ? backup.progress.percent : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Sync progress across all subsystems"
        >
          <div
            className={cn("profile-sync-progress-fill", showLive && backup.progress.active && "profile-sync-progress-fill--active")}
            style={{ width: `${showLive ? backup.progress.percent : 0}%` }}
          />
        </div>
      </div>

      {showLive ? (
        <p className="profile-sync-live-note">
          <RefreshCcw
            className={cn("h-3 w-3", isCheckingOtherDevices && "animate-spin")}
            aria-hidden
            style={{ display: "inline", marginRight: 5, verticalAlign: -1 }}
          />
          {isCheckingOtherDevices
            ? "Checking your other devices for changes…"
            : lastCrossDeviceCheckAt !== null
              ? `Watching for changes on your other devices · last checked ${formatTimeAgo(lastCrossDeviceCheckAt)}`
              : "Watching for changes on your other devices — first check runs shortly."}
        </p>
      ) : null}

      {!showLive ? (
        <p className="profile-sync-guest-note">
          {backup.configured
            ? "Sign in with Google or GitHub to sync your calculator data across devices."
            : "No cloud project is configured for this app — sync status isn't available."}
        </p>
      ) : null}
    </section>
  );
}
