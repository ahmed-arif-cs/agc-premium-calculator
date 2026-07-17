"use client";

import { useApplySettings } from "@/hooks/useSettings";
import { useSettingsSync } from "@/hooks/useSettingsSync";
import { useHistorySync } from "@/hooks/useHistorySync";
import { useMemorySync } from "@/hooks/useMemorySync";
import { useFavoritesSync } from "@/hooks/useFavoritesSync";
import { useMultiDeviceSync } from "@/hooks/useMultiDeviceSync";

/**
 * Mounts once near the root and syncs the active theme + font-scale
 * onto <html> as data attributes, which drive the CSS variable themes.
 *
 * Also mounts every one of the app's four Cloud Sync orchestration hooks —
 * `useSettingsSync()` (Theme/Settings, Task 17), and, as of Task 22,
 * `useHistorySync()` (Task 15), `useMemorySync()` (Task 16), and
 * `useFavoritesSync()` (Task 18) too. Each hook is still the exact same
 * single-purpose, additive layer it always was — this component just owns
 * *where* they're mounted, not what they do. For a signed-in user this
 * means every one of the four subsystems restores from Supabase right
 * after sign-in (merging into whatever's local — on a genuinely fresh
 * install/new device that's an empty local store, so the merge result is
 * simply "everything from the cloud") and pushes back up on every local
 * change, entirely automatically; Guest Mode is a complete no-op for all
 * four and keeps using localStorage exactly as before.
 *
 * Why all four are mounted **here** instead of in `Calculator.tsx` (where
 * `useHistorySync`/`useMemorySync`/`useFavoritesSync` used to be mounted,
 * Tasks 15/16/18) rather than the other way around: this component sits
 * inside `<SessionProvider>` in `layout.tsx`, rendered on **every** page,
 * not just `/`. `useSettingsSync.ts`'s own doc comment already flagged the
 * gap this closes — sign-in is reachable from `/profile`
 * (`ProfileView.tsx`'s own Google/GitHub buttons) without ever mounting
 * `Calculator`, and every OAuth callback redirects back to `/` today, but a
 * person restoring onto a **new device or after a reinstall** shouldn't
 * have their history/memory/favorites depend on which page happens to
 * mount first, or survive only because of today's specific redirect
 * target. Mounting all four here, alongside settings, means "log in →
 * everything restores" is guaranteed regardless of page/navigation, and as
 * a side benefit the four `restoredForUserRef`s now live in a component
 * that persists across client-side route changes (unlike `Calculator.tsx`,
 * which unmounts/remounts on navigation) — so each hook's restore-on-login
 * effect genuinely runs once per signed-in session, not once per visit to
 * `/`.
 *
 * None of the four hooks' own return values are needed here (this
 * component still returns `null`); `Calculator.tsx`, `MemoryBar.tsx`,
 * `HistoryPanel.tsx`, `FavoritesPanel.tsx`, and `SettingsPanel.tsx` all
 * read the same live status via each hook's paired, read-only
 * `use*SyncStatus()` selector instead — safe to call from any number of
 * components without mounting a second, duplicate copy of the restore/push
 * effects, exactly as those selectors were already designed for.
 *
 * **Task 24 (Multi-device Sync)** adds one more hook here, `useMultiDeviceSync()`:
 * the four hooks above only push on a *local* change and restore once at
 * sign-in, so two devices already signed in at the same time never see
 * each other's edits without a reload. `useMultiDeviceSync()` periodically
 * (and on tab-focus/visibility/reconnect) re-checks the cloud and
 * reconciles it into local state — a safe, id-preserving union merge for
 * history/favorites, and a last-write-wins resolution (by the cloud row's
 * own server-clock `updated_at`) for calculator memory/settings — see that
 * hook's own file-level doc comment for the full rationale. It is a
 * read/reconcile layer on top of the existing four hooks, not a
 * replacement for any of their restore/push logic, and — like all four —
 * is a complete no-op for Guest Mode.
 */
export function SettingsApplier() {
  useApplySettings();
  useSettingsSync();
  useHistorySync();
  useMemorySync();
  useFavoritesSync();
  useMultiDeviceSync();
  return null;
}
