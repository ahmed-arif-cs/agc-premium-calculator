# Changelog

All notable changes to this project are documented in this file. For the full, detailed, task-by-task engineering log (including verification steps and rationale), see [worklog.md](worklog.md).

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- About panel: corrected a stale `0.2.0` version display to `1.0.0`, matching `package.json` (missed during the 1.0.0 release in the prior task).

### Added
- About panel: hover animations on the logo mark, feature list, and detail rows; a scoped close-button rotate animation.

## [1.0.0] — Final Production Readiness Review

### Added
- Open-source project files: `README.md` overhaul, `CHANGELOG.md`, `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.editorconfig`, `.gitattributes`.
- README: a concrete Vercel deployment checklist (per-feature environment variables, Supabase OAuth redirect-URL production gotcha, verified build results).

### Fixed
- Removed a stale `bun.lock` that had drifted out of sync with `package.json` (missing `@supabase/ssr`, `@supabase/supabase-js`, `docx`, `exceljs`, `server-only`) — a real risk if a deployment platform auto-detected it and installed from it instead of the verified, in-sync `package-lock.json`.
- Removed one genuinely unused `eslint-disable-next-line react-hooks/set-state-in-effect` comment in `ChatWindow.tsx`, confirmed unused via a live `eslint` run now possible in this session.

### Verified
- A full `npm install` + `npm run build` (Next.js 16, Turbopack) against this codebase completes with zero errors; `npx tsc --noEmit` and `npx eslint .` both report zero errors.
- **Final review (this release):** independently re-ran `npm install`, `npx tsc --noEmit`, `npx eslint .`, and `npm run build` from a clean install in a fresh sandbox. Results: zero real type errors (only the four pre-existing, build-irrelevant `bun:test` type declarations in `src/lib/__tests__/*`, which are never part of the Next.js build); zero ESLint errors or warnings; `npm run build` fails only on the sandbox's own network restriction blocking `fonts.googleapis.com` (`x-deny-reason: host_not_allowed`) — confirmed sandbox-only, not a code defect, by re-running the build in a scratch copy with the Google Fonts fetch stubbed out, which then compiled cleanly across all 14 routes with zero errors. No unused imports, debug logs, or dead code were found that were safe to remove beyond what prior phases already addressed. No source files required changes; this release formalizes the project's production-ready status established across Phases 1–9.

## Phase 9 — PWA, Security & Performance Hardening

- **PWA review**: fixed a service worker bug where API routes (`/api/currency`, `/api/auth/session`) and RSC data fetches could be permanently cached alongside static assets; added a cache-control header for `sw.js` itself so fixes reach installed users promptly.
- **Performance pass**: converted non-first-paint calculator panels to `next/dynamic` code-split imports, memoized low-churn components (`ModeTabs`, `InstallBanner`), and enabled `display: swap` for all custom fonts.
- **Security audit**: stopped persisting the live Supabase bearer token to `localStorage`, added per-IP rate limiting to unauthenticated AI/OCR API routes, and added baseline HTTP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Full project audit**: removed dead imports/unused parameters, resolved a `react-hooks/set-state-in-effect` false positive with explanatory comments, and confirmed no memory leaks, hydration issues, or accessibility gaps.

## Phase 8 — AI & OCR

- Added a provider-agnostic AI service layer with pluggable OpenAI, Claude, and Gemini providers (safe no-op default when unconfigured).
- Added a full AI Chat interface (`/chat`) with conversation history, copy, clear, auto-scroll, and typing indicator, then connected it to the live provider architecture behind environment variables.
- Added an AI Calculator panel supporting natural-language calculations, formula explanation, and step-by-step solutions, layered on top of (never replacing) the existing calculation engine.
- Added an OCR architecture (Image to Text, Receipt Reading, Math Image Recognition) with a safe no-op provider, ready for a future vendor integration.

## Phase 7 — Accounts & Cloud Sync

- Added Supabase integration, an authentication architecture, and Guest Mode.
- Added a production database schema (`profiles`, `calculator_history`, `calculator_memory`, `favorites`, `user_settings`) with Row Level Security.
- Implemented Google Login and GitHub Login (OAuth via Supabase), and a Profile page.
- Implemented cloud sync for History, Calculator Memory, Settings, and Favorites, plus Manual Backup, Restore, restore-after-reinstall, sync status, and multi-device sync with conflict handling — all fully optional and compatible with Guest Mode.

## Phase 6 — Full AGC Branding & Production Readiness

- Replaced application branding end-to-end: navbar/logo, favicon, PWA icons, manifest, iOS launch splash screens, and a boot animation.
- Branded all six export formats (PDF, Excel, DOCX, CSV, TXT, JSON) with the AGC logo, colors, headers, and footers.
- Completed a full production-readiness review across desktop and mobile breakpoints (375/768/1024/1440px): accessibility, responsiveness, performance, PWA, and dark theme consistency.

## Phase 2–5 — Core Calculator, Converter, Export & Polish

- Built the core calculator (Standard mode, keyboard support, live expression preview, copy-to-clipboard).
- Added Scientific mode, memory functions (M+/M−/MR/MC), history panel, and undo/redo.
- Added the natural-language parser, algebra solver, and unit/currency converters, with a fully offline currency fallback.
- Added history import/export (CSV, PDF, and other formats) and redesigned the PDF export into a professional, branded report with pagination.
- General accessibility, responsiveness, and micro-interaction polish pass.

## Phase 1 — Initial Release

- Initial premium calculator web app: Next.js, TypeScript, and Tailwind CSS with a dark-navy + gold glassmorphism theme.
