"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  Chrome,
  Copy,
  Github,
  Loader2,
  LogOut,
  Pencil,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSettings, useClickSound, type FontSize, type ThemeId } from "@/hooks/useSettings";
import { readAndResizeImage } from "@/lib/avatar";
import type { AuthProviderKind } from "@/lib/auth/types";
import { CloudBackupSection } from "./CloudBackupSection";
import { SyncStatusSection } from "./SyncStatusSection";

const THEMES: { id: ThemeId; label: string; bg: string; accent: string }[] = [
  { id: "navy-gold", label: "Navy / Gold", bg: "#0a0e17", accent: "#d4af37" },
  { id: "light", label: "Light", bg: "#f3f4f8", accent: "#b8932b" },
  { id: "navy-emerald", label: "Navy / Emerald", bg: "#07151a", accent: "#10b981" },
  { id: "charcoal-rosegold", label: "Charcoal / Rose Gold", bg: "#1a1518", accent: "#d6a08e" },
  { id: "ocean-sapphire", label: "Ocean / Sapphire", bg: "#071019", accent: "#3b82f6" },
  { id: "royal-amethyst", label: "Royal / Amethyst", bg: "#140b1c", accent: "#a855f7" },
  { id: "crimson-ember", label: "Crimson / Ember", bg: "#170a0a", accent: "#ef4444" },
  { id: "forest-jade", label: "Forest / Jade", bg: "#0c150e", accent: "#22c55e" },
  { id: "sunset-copper", label: "Sunset / Copper", bg: "#170f08", accent: "#d97706" },
  { id: "midnight-silver", label: "Midnight / Silver", bg: "#0e1013", accent: "#94a3b8" },
  { id: "rose-bloom", label: "Rose / Bloom", bg: "#170a12", accent: "#ec4899" },
  { id: "golden-bronze", label: "Golden / Bronze", bg: "#160f09", accent: "#c08552" },
  { id: "arctic-frost", label: "Arctic / Frost", bg: "#071620", accent: "#38bdf8" },
  { id: "volcanic-obsidian", label: "Volcanic / Obsidian", bg: "#140b08", accent: "#f97316" },
];

const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: "sm", label: "A−" },
  { id: "md", label: "A" },
  { id: "lg", label: "A+" },
];

const PROVIDER_LABEL: Record<AuthProviderKind, string> = {
  google: "Google",
  github: "GitHub",
  apple: "Apple",
  password: "Email & password",
};

function formatJoinDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/**
 * The Profile page (`/profile`): avatar, name, email, an inline "Edit
 * profile" form, an Account Information summary, and Account Settings
 * (theme / font size / sound, plus sign in/out) — all reusing this app's
 * existing `calc-*` glass/panel/section primitives so it reads as a
 * native part of the AGC calculator rather than a bolted-on screen.
 *
 * Works identically for a signed-in user (Google/GitHub) and Guest Mode;
 * nothing here is gated behind sign-in. Name/avatar edits are stored
 * locally only via `useProfile.ts` — no Supabase write path exists yet
 * (see that hook's doc comment).
 */
export function ProfileView() {
  const auth = useAuth();
  const profile = useProfile();
  const settings = useSettings();
  const clickSound = useClickSound();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [avatarDraft, setAvatarDraft] = useState<string | null | undefined>(undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputId = useId();

  const isGuest = !auth.isAuthenticated || !auth.user;
  const providerLabel = auth.user ? PROVIDER_LABEL[auth.user.provider] : "Guest";

  const displayName = profile.displayName ?? auth.user?.name ?? (isGuest ? "Guest User" : "Account");
  const email = auth.user?.email || null;
  const avatarSrc = profile.avatarDataUrl ?? auth.user?.avatarUrl ?? null;
  const initials = (displayName || email || "?").trim().charAt(0).toUpperCase() || "?";
  const accountId = auth.user?.id ?? auth.guestId;

  const startEditing = useCallback(() => {
    setNameDraft(profile.displayName ?? auth.user?.name ?? "");
    setAvatarDraft(undefined);
    setAvatarError(null);
    setEditing(true);
  }, [profile.displayName, auth.user?.name]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setAvatarError(null);
  }, []);

  const saveProfile = useCallback(() => {
    profile.setDisplayName(nameDraft);
    if (avatarDraft !== undefined) profile.setAvatarDataUrl(avatarDraft);
    setEditing(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2600);
  }, [profile, nameDraft, avatarDraft]);

  const handleAvatarFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError("That image is too large (max 8MB).");
      return;
    }
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const dataUrl = await readAndResizeImage(file, 256);
      setAvatarDraft(dataUrl);
    } catch {
      setAvatarError("Couldn't read that image. Please try another file.");
    } finally {
      setAvatarBusy(false);
    }
  }, []);

  const copyAccountId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard permission/unavailable — non-critical, silently ignore.
    }
  }, [accountId]);

  const previewAvatar = editing ? (avatarDraft === undefined ? avatarSrc : avatarDraft) : avatarSrc;
  const previewInitials = editing
    ? (nameDraft || email || "?").trim().charAt(0).toUpperCase() || initials
    : initials;

  return (
    <div className="profile-shell">
      <Link href="/" className="profile-back-link">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to calculator
      </Link>

      <div className="calc-glass profile-card" data-fs={settings.fontSize}>
        {/* Avatar / Name / Email header */}
        <div className="profile-header">
          <div className="profile-avatar-wrap">
            {previewAvatar ? (
              <Image
                src={previewAvatar}
                alt=""
                width={88}
                height={88}
                unoptimized
                className="profile-avatar-img"
              />
            ) : (
              <div className="profile-avatar-fallback" aria-hidden>
                {previewInitials}
              </div>
            )}
            {editing ? (
              <button
                type="button"
                className="profile-avatar-edit-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change avatar photo"
                disabled={avatarBusy}
              >
                {avatarBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                void handleAvatarFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div className="profile-heading">
            <h1 className="profile-name">{displayName}</h1>
            {email ? (
              <p className="profile-email">{email}</p>
            ) : (
              <p className="profile-email profile-email--muted">
                Guest Mode — no email on this device
              </p>
            )}
            <span className={cn("profile-badge", isGuest ? "profile-badge--guest" : "profile-badge--live")}>
              {isGuest ? <User className="h-3 w-3" aria-hidden /> : <BadgeCheck className="h-3 w-3" aria-hidden />}
              {providerLabel}
            </span>
          </div>
        </div>

        {savedFlash ? (
          <div className="profile-flash" role="status">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Profile updated
          </div>
        ) : null}

        {/* Edit Profile */}
        <section className="calc-settings-section profile-section" aria-labelledby="profile-edit-heading">
          <div className="profile-section-head">
            <h2 id="profile-edit-heading">Edit profile</h2>
            {!editing ? (
              <button
                type="button"
                className="profile-edit-toggle"
                onClick={() => {
                  clickSound();
                  startEditing();
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </button>
            ) : null}
          </div>

          {editing ? (
            <form
              className="profile-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                clickSound();
                saveProfile();
              }}
            >
              <label htmlFor={nameInputId} className="profile-field-label">
                Display name
              </label>
              <input
                id={nameInputId}
                type="text"
                className="profile-name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={isGuest ? "Guest User" : auth.user?.email || "Your name"}
                maxLength={60}
                autoComplete="name"
              />

              {avatarError ? (
                <p className="profile-avatar-error" role="alert">
                  {avatarError}
                </p>
              ) : null}

              <div className="profile-edit-actions">
                {avatarDraft ? (
                  <button
                    type="button"
                    className="profile-link-btn"
                    onClick={() => {
                      clickSound();
                      setAvatarDraft(null);
                    }}
                  >
                    Remove photo
                  </button>
                ) : (
                  <span />
                )}
                <div className="profile-edit-actions-right">
                  <button
                    type="button"
                    className="profile-cancel-btn"
                    onClick={() => {
                      clickSound();
                      cancelEditing();
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="profile-save-btn">
                    Save changes
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <p className="t-muted profile-hint">
              Set a display name and photo for this device. Stored locally — it never changes your
              Google/GitHub account.
            </p>
          )}
        </section>

        {/* Account Information */}
        <section className="calc-settings-section profile-section" aria-labelledby="profile-info-heading">
          <h2 id="profile-info-heading">Account information</h2>
          <dl className="profile-info-grid">
            <div className="profile-info-item">
              <dt>Status</dt>
              <dd>{isGuest ? "Guest (not signed in)" : "Signed in"}</dd>
            </div>
            <div className="profile-info-item">
              <dt>Signed in with</dt>
              <dd>{providerLabel}</dd>
            </div>
            <div className="profile-info-item profile-info-item--wide">
              <dt>{isGuest ? "Guest ID" : "Account ID"}</dt>
              <dd className="profile-info-id">
                <span>{accountId}</span>
                <button
                  type="button"
                  className="profile-copy-btn"
                  onClick={() => {
                    clickSound();
                    void copyAccountId();
                  }}
                  aria-label="Copy account ID"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </dd>
            </div>
            <div className="profile-info-item">
              <dt>{isGuest ? "Guest since" : "Member since"}</dt>
              <dd>{isGuest ? "This device" : formatJoinDate(auth.user?.createdAt ?? null)}</dd>
            </div>
          </dl>

          {auth.error ? (
            <div className="calc-auth-error" role="alert">
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

          {isGuest ? (
            <div className="calc-oauth-btn-group profile-oauth-group">
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
                {auth.signingInProvider === "google" ? "Redirecting to Google…" : "Sign in with Google"}
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
                {auth.signingInProvider === "github" ? "Redirecting to GitHub…" : "Sign in with GitHub"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="calc-account-signout profile-signout"
              onClick={() => {
                clickSound();
                void auth.signOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}
        </section>

        {/* Sync Status */}
        <SyncStatusSection />

        {/* Cloud Backup */}
        <CloudBackupSection />

        {/* Account Settings */}
        <section className="calc-settings-section profile-section" aria-labelledby="profile-settings-heading">
          <h2 id="profile-settings-heading">Account settings</h2>

          <div className="profile-subsection">
            <p className="profile-subsection-label">Theme</p>
            <div className="calc-swatches">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`${t.label} theme`}
                  aria-pressed={settings.theme === t.id}
                  className={cn("calc-swatch", settings.theme === t.id && "calc-swatch--active")}
                  onClick={() => {
                    clickSound();
                    settings.setTheme(t.id);
                  }}
                >
                  <span
                    className="calc-swatch-dot"
                    style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                  />
                  <span className="calc-swatch-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="profile-subsection">
            <p className="profile-subsection-label">Font size</p>
            <div className="calc-seg">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`Font size: ${f.id === "sm" ? "small" : f.id === "md" ? "medium" : "large"}`}
                  aria-pressed={settings.fontSize === f.id}
                  className={cn("calc-seg-btn", settings.fontSize === f.id && "calc-seg-btn--active")}
                  onClick={() => {
                    clickSound();
                    settings.setFontSize(f.id);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="calc-toggle-row profile-subsection">
            <span>Button click sound</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.soundEnabled}
              aria-label="Toggle click sound"
              className={cn("calc-switch", settings.soundEnabled && "calc-switch--on")}
              onClick={() => {
                if (!settings.soundEnabled) clickSound();
                settings.toggleSound();
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
