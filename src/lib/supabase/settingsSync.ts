/**
 * Settings Cloud Sync — Supabase read/write layer.
 *
 * Cloud counterpart to `src/hooks/useSettings.ts`'s localStorage store
 * (theme, font size, click-sound preference), targeting Task 10's
 * `public.user_settings` table (see
 * `supabase/migrations/20260715120300_user_settings.sql`). That migration's
 * own comment already predicted this file: its columns (`theme`,
 * `font_size`, `sound_enabled`) were deliberately built to mirror
 * `useSettings.ts`'s `Settings`/`ThemeId`/`FontSize` types one-to-one, so no
 * schema change was needed for this task — unlike Task 15/16, which each
 * had to add a small additive column first.
 *
 * Design (deliberately mirrors `historySync.ts`/`memorySync.ts`'s
 * conventions):
 * - One row per user (`user_id` is the table's primary key, auto-provisioned
 *   at signup by Task 10's own trigger), so this is always a single
 *   `select`/`upsert` on that one row, never a list operation.
 * - Nothing here ever throws. Every function returns a `{ ok: true, ... }`
 *   / `{ ok: false, error }` result, since a sync failure (offline, RLS
 *   misconfiguration, an unconfigured Supabase project) must never break
 *   the calculator's theme/settings or its local-first preferences store —
 *   it should just mean the next successful sync catches up.
 * - Guest users never reach this file at all: `useSettingsSync.ts` only
 *   calls it once `useAuth().isAuthenticated` is true, so Guest Mode's
 *   settings stay exactly what they always were — localStorage-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Settings } from "@/hooks/useSettings";

type TypedSupabaseClient = SupabaseClient<Database>;
type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

export type SettingsSyncResult = { ok: true } | { ok: false; error: string };

export type SettingsFetchResult =
  | {
      ok: true;
      settings: Settings;
      /**
       * Task 24 (Multi-device Sync) — the cloud row's `updated_at`
       * (server-clock, bumped by a `before update` trigger on every write —
       * see `20260715120300_user_settings.sql`), as an ISO string. Additive:
       * every existing caller that only reads `.settings` is unaffected.
       * `useMultiDeviceSync.ts` uses this as a trustworthy, server-issued
       * version marker to detect a change pushed from *another* device
       * without relying on client clocks, which can drift or be wrong.
       */
      updatedAt: string;
    }
  | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown settings sync error.";
}

function rowToSettings(row: UserSettingsRow): Settings {
  return {
    theme: row.theme,
    fontSize: row.font_size,
    soundEnabled: row.sound_enabled,
  };
}

/**
 * Fetches this user's cloud settings row. Auto-provisioning at signup
 * (Task 10's trigger) means a row should always exist, but this still
 * tolerates a missing row (e.g. an account created before that trigger
 * existed) by falling back to `null`, letting the caller decide the default.
 */
export async function fetchCloudSettings(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<SettingsFetchResult | { ok: true; settings: null; updatedAt: null }> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, settings: null, updatedAt: null };
    return { ok: true, settings: rowToSettings(data), updatedAt: data.updated_at };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * Upserts this user's settings row with `settings`, keyed on the table's
 * `user_id` primary key. Idempotent and safe to call repeatedly/frequently —
 * it always converges on exactly what's passed in.
 */
export async function pushSettingsToCloud(
  supabase: TypedSupabaseClient,
  userId: string,
  settings: Settings,
): Promise<SettingsSyncResult> {
  try {
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        theme: settings.theme,
        font_size: settings.fontSize,
        sound_enabled: settings.soundEnabled,
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
