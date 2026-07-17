# AGC Premium Calculator

By **AGC — Ahmed Group of Companies** · *Building Digital Excellence*

A production-ready, glassmorphism-styled calculator web app built with **Next.js**, **TypeScript**, and **Tailwind CSS**. It includes Standard, Scientific, and Converter modes, a full theme system, smart natural-language input, history export, optional cloud sync/authentication, an AI Chat/AI Calculator feature, and full PWA support — all sharing a premium dark-navy + gold aesthetic (with switchable themes).

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![PWA](https://img.shields.io/badge/PWA-installable-22c55e) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Calculator
- **Three modes** — Standard, Scientific, and Converter (sliding gold tab indicator)
- **Basic operations** — +, −, ×, ÷ with operator precedence (shunting-yard evaluator, no `eval`)
- **Scientific** — sin/cos/tan (DEG/RAD toggle), √, xʸ (power, right-associative), log, ln, x! (factorial), parentheses, constants π & e
- **Memory** — M+, M−, MR, MC with a gold indicator (visible in all modes)
- **History** — slide-out glass panel; click to reuse, add notes, delete items, clear all; persisted locally and, when signed in, synced to the cloud
- **Favorites** — save frequently used calculations, synced to the cloud when signed in
- **Undo/Redo** — buttons + Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (up to 50 steps)
- **Live expression preview**, inline error handling (divide-by-zero etc.), copy-to-clipboard with toast
- **Full keyboard support** — digits, operators, `(` `)` `^` `!` `%`, Enter/=, Backspace, Esc=AC, c=clear

### Converter
- **Currency** — live exchange rates with a server-side cache and an offline/static fallback table
- **Units** — Length, Weight, Temperature (with correct °C/°F/K formulas), ~25 units total
- Swap button, live result, themed dropdowns

### Theme System
- **4 themes** — Navy/Gold (default), Light, Navy/Emerald, Charcoal/Rose Gold
- Theme switcher via a settings (gear) icon → slide-out settings panel
- **Adjustable font size** (A− / A / A+) for accessibility
- **Optional button click sound** — a soft, premium "thock" synthesized via the Web Audio API (no audio files), toggled in settings

### Smart Features
- **Natural language input** — type `25% of 400` → 100, `10% off 50` → 45, `12 plus 8` → 20, `sqrt of 16` → 4
- **Algebra solver** — solve linear & quadratic single-variable equations: `2x + 5 = 11` → x = 3, `x^2 - 9 = 0` → x = 3, −3
- **Voice input** — mic button using the Web Speech API (where supported)
- Toggle via the ✨ (sparkle) icon in the topbar

### Account & Cloud Sync (optional, Supabase-backed)
- **Guest Mode** — the app is fully functional with no account, storing everything locally
- **Google Login** and **GitHub Login** — via Supabase OAuth
- When signed in, History, Favorites, Calculator Memory, and Settings are synced to the cloud (Supabase, protected by Row Level Security scoped to `auth.uid()`), with an "online" reconnect resync and a Profile page showing sync/backup status
- All of this is optional — every credential in `.env.example` may be left blank and the app runs entirely in guest mode

### AI Chat & AI Calculator (optional, provider-backed)
- A `/chat` page and an AI Calculator panel that can call a configured AI provider (OpenAI, Claude, or Gemini) for conversational and natural-language calculation help
- Ships with a safe no-op provider by default — with no API key configured, the UI shows a clear "not configured" message instead of failing silently
- Server-side only: provider API keys are never sent to the browser, and requests are rate-limited per client

### OCR (architecture-only foundation)
- API routes exist for Image-to-Text, Receipt Reading, and Math Image Recognition (`/api/ocr/*`), each already validating and rate-limiting input
- No OCR vendor is wired up by default; these routes return a clear "not configured" response until a provider is registered

### Export
- **CSV**, **Excel**, **Word**, and **PDF** export of calculation history from the history panel
- PDF is styled with the AGC Premium Calculator navy/gold brand identity, all export libraries are dynamically imported so they never slow down initial page load

### PWA
- Installable — `manifest.json`, service worker, custom navy/gold app icon set, and Apple splash screens
- Works offline after first load (cache-first for static assets, network-first with an app-shell fallback for navigations; API routes always go to the network)
- "Add to Home Screen" banner with a custom install prompt

## Tech Stack

| Layer         | Choice                                       |
| ------------- | --------------------------------------------- |
| Framework     | Next.js (App Router)                          |
| Language      | TypeScript (strict)                           |
| Styling       | Tailwind CSS 4 + themeable CSS variables      |
| UI primitives | shadcn/ui (Radix)                             |
| Icons         | lucide-react                                  |
| Auth & DB     | Supabase (OAuth + Postgres with RLS), optional|
| AI providers  | OpenAI / Anthropic (Claude) / Gemini, optional|
| Fonts         | Geist (sans/mono) + Space Grotesk (display)   |
| Exports       | jspdf, exceljs, docx — all dynamically imported|
| Tests         | bun:test                                      |

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js 20+
- No account or API key is required to run the app — every optional integration below degrades gracefully when left unconfigured

### Install & run

```bash
# install dependencies
bun install
# (or: npm install)

# copy the environment template and fill in only what you need (optional)
cp .env.example .env

# start the dev server (http://localhost:3000)
bun run dev
# (or: npm run dev)

# lint
bun run lint

# run unit tests
bun test

# production build
bun run build && bun run start
```

### Optional: enabling cloud sync / login

The app runs fully in Guest Mode with `.env` left blank. To enable Google/GitHub login and cloud sync:
1. Create a [Supabase](https://supabase.com) project and apply the SQL migrations in `supabase/migrations/` (in filename order).
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env` (both are safe to expose to the browser — access is enforced by Row Level Security, not secrecy). Configure the Google/GitHub OAuth providers in your Supabase project's Auth settings.
3. `SUPABASE_SERVICE_ROLE_KEY` is server-only and not required for normal operation — leave it blank unless you need it for a future admin operation.

### Optional: enabling AI Chat / AI Calculator

Set `AI_PROVIDER` to `openai`, `claude`, or `gemini` in `.env`, then fill in that provider's own `*_API_KEY` (and optionally `*_MODEL`/`*_BASE_URL`). See the comments in `.env.example` for the full list of variables. Leaving `AI_PROVIDER` blank keeps the safe no-op provider active.

See `.env.example` for the complete, documented list of every environment variable this project reads.

## Keyboard Shortcuts

| Key               | Action              |
| ----------------- | ------------------- |
| `0` – `9`         | Digits               |
| `+` `-` `*` `/`   | Operators            |
| `.`               | Decimal point        |
| `%`               | Percent              |
| `(` `)`           | Parentheses          |
| `^`               | Power (xʸ)           |
| `!`               | Factorial (x!)       |
| `Enter` / `=`     | Equals               |
| `Backspace`       | Delete last input    |
| `Escape`          | All Clear (AC)       |
| `c`               | Clear entry (C)      |
| `Ctrl/Cmd+Z`      | Undo                 |
| `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` | Redo |

## Project Structure

```
src/
├─ app/
│  ├─ globals.css              # Themeable navy/gold CSS variables + 4 themes + all component styles
│  ├─ layout.tsx               # Fonts, metadata, manifest, PWA registration, settings applier
│  ├─ page.tsx                 # Page shell: header, calculator, sticky footer
│  ├─ chat/page.tsx            # AI Chat page
│  ├─ profile/page.tsx         # Account / sync / backup status page
│  ├─ auth/callback/route.ts   # Supabase OAuth callback (server-side code exchange)
│  └─ api/
│     ├─ currency/route.ts     # Live FX rates with server-side cache + offline fallback
│     ├─ auth/session/route.ts # Session placeholder endpoint
│     ├─ ai/chat/route.ts      # AI Chat backend (provider-agnostic, rate-limited)
│     ├─ ai/calculate/route.ts # AI Calculator backend (provider-agnostic, rate-limited)
│     └─ ocr/*                 # Image-to-Text / Receipt / Math OCR endpoints (rate-limited)
├─ components/
│  ├─ SettingsApplier.tsx      # Syncs theme + font-scale onto <html>
│  ├─ PWARegister.tsx          # Registers service worker (production)
│  ├─ auth/                    # SessionProvider, ProtectedRoute
│  ├─ chat/                    # AI Chat UI
│  ├─ profile/                 # Cloud backup / sync status UI
│  └─ calculator/
│     ├─ Calculator.tsx        # Orchestrates tabs, display, memory, keypads, panels
│     ├─ CalculatorButton.tsx  # Button with gold glow ripple + click sound
│     ├─ Display.tsx           # Expression preview, result, copy, error, angle chip
│     ├─ Keypad.tsx            # Standard 4×5 button grid
│     ├─ ScientificKeypad.tsx  # Scientific functions grid
│     ├─ Converter.tsx         # Currency + unit converter
│     ├─ ModeTabs.tsx          # Standard/Scientific/Converter tabs (sliding indicator)
│     ├─ MemoryBar.tsx         # M+/M−/MR/MC + indicator
│     ├─ HistoryPanel.tsx      # Slide-out history with notes, reuse, delete, export
│     ├─ FavoritesPanel.tsx    # Saved calculations
│     ├─ SettingsPanel.tsx     # Theme switcher, font size, sound toggle
│     ├─ AccountPanel.tsx      # Guest/Google/GitHub sign-in UI
│     ├─ AICalculatorPanel.tsx # AI-assisted calculation panel
│     ├─ AboutPanel.tsx        # About / branding panel
│     ├─ SmartBar.tsx          # NL input + algebra solver + voice input
│     └─ InstallBanner.tsx     # PWA install prompt
├─ hooks/                      # useCalculator, useHistory(+Sync), useFavorites(+Sync),
│                               # useMemory(+Sync), useSettings(+Sync), useAuth, useMultiDeviceSync,
│                               # useInstallPrompt, useVoiceInput, useProfile, useCloudBackup, ...
└─ lib/
   ├─ calculator.ts            # Pure engine: tokenize, evaluate (shunting-yard + functions/parens/power/factorial)
   ├─ converters.ts            # Unit conversion (length/weight/temperature)
   ├─ nlp.ts                   # Natural-language math parser
   ├─ algebra.ts               # Linear & quadratic equation solver
   ├─ exportHistory.ts         # CSV/Excel/Word/PDF export (all dynamically imported)
   ├─ rateLimit.ts             # Per-IP rate limiting for unauthenticated API routes
   ├─ auth/, supabase/         # Session store, Supabase client/server helpers, OAuth
   ├─ ai/                      # Provider-agnostic AI service + OpenAI/Claude/Gemini providers
   ├─ ocr/                     # Provider-agnostic OCR service (no-op by default)
   └─ __tests__/               # Unit tests (calculator, converters, nlp, algebra)

public/
├─ manifest.json               # PWA manifest
├─ sw.js                       # Service worker (offline cache, network-first APIs)
├─ icon-*.png                  # App icon set (72px–512px, incl. maskable variants)
├─ apple-touch-icon*.png       # iOS home-screen icons
└─ splash-*.png                # Apple splash screens for multiple device sizes

supabase/
└─ migrations/                 # SQL migrations for Supabase (profiles, history, favorites,
                                # memory, settings, RLS policies, sync tables) — apply in order
```

## Design Notes

- **Theme system** — every color is a semantic CSS variable (`--c-bg`, `--c-accent`, `--c-text`, etc.). Switching `data-theme` on `<html>` re-skins the entire app instantly. The four themes share the same glassmorphism structure.
- **Logic is decoupled from UI** — `useCalculator` (useReducer) and `useHistory`/`useSettings`/`useFavorites` (useSyncExternalStore, with optional Supabase-backed sync hooks) own all state; components are presentational. The pure engine in `lib/calculator.ts` has no React dependencies and is fully unit-tested.
- **Smart input** routes through `looksLikeEquation()` → if the text contains `=` and a variable, the algebra solver runs; otherwise the NL parser translates phrases to expressions and evaluates them.
- **Guest-first architecture** — every cloud-backed feature (auth, sync, AI, OCR) is additive and optional; the calculator, converter, history, and export features work fully offline with zero configuration.
- **Security by default** — RLS-scoped Supabase access, server-only secret handling, per-IP rate limiting on unauthenticated AI/OCR routes, and baseline HTTP security headers are documented further in [SECURITY.md](SECURITY.md).
- **Service worker** is registered only in production and only network-first-passes-through API routes and RSC data fetches, so live data (currency rates, session state) is never frozen behind a stale cache.

## Deployment

The project deploys cleanly to **Vercel** (or any Next.js-compatible host) with zero required configuration — every optional integration (Supabase, AI providers, OCR) may be left unset and the app still runs in full guest mode. See `.env.example` for the complete list of optional environment variables.

### Deploying to Vercel

1. Import the repository into Vercel — the Next.js framework preset is auto-detected, no `vercel.json` is needed, and `npm run build` (`next build`) is verified to succeed with zero configuration.
2. In **Project Settings → Environment Variables**, add only the variables for the optional features you want enabled in that environment (Production/Preview/Development). Leaving all of them unset is fully supported — the app runs in guest mode with AI Chat/AI Calculator/OCR showing a clear "not configured" state instead of erroring.
   - **Supabase (Google/GitHub login + cloud sync)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both safe to expose — access is enforced by Row Level Security). `SUPABASE_SERVICE_ROLE_KEY` is optional and server-only; leave it unset unless a future feature needs it.
   - **AI Chat / AI Calculator**: `AI_PROVIDER` (`openai` | `claude` | `gemini`) plus that provider's own `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` (and optional `*_MODEL` / `*_BASE_URL`).
   - **OCR**: architecture-only today — `OCR_*` variables have no effect on any real vendor since none is integrated yet.
3. If Supabase is enabled, two production-specific settings are easy to miss and will silently break OAuth login if skipped:
   - In the Supabase dashboard, **Authentication → URL Configuration**, add your production domain (e.g. `https://your-app.vercel.app`) to both **Site URL** and **Redirect URLs** — the OAuth flow redirects to `<site>/auth/callback`, and Supabase rejects redirects to domains that aren't allow-listed.
   - In each OAuth provider's own console (Google Cloud Console / GitHub OAuth App settings), make sure the authorized callback URL matches your Supabase project's callback (`https://<project-ref>.supabase.co/auth/v1/callback`) — this is a one-time setup step per provider, unrelated to Vercel's own domain.
4. Redeploy after adding/changing environment variables — Vercel only picks up new values on the next build, not on existing deployments.

### Verified production build

A full `npm install` + `npm run build` (Next.js 16, Turbopack) has been run against this exact codebase and completes with **zero errors**: all static routes (`/`, `/chat`, `/profile`) prerender successfully and every API route (`/api/ai/*`, `/api/ocr/*`, `/api/currency`, `/api/auth/session`, `/auth/callback`) is correctly recognized as dynamic/server-rendered. `npx tsc --noEmit` and `npx eslint .` both report zero errors (the only `tsc` findings are pre-existing `bun:test` type-declaration lookups in `src/lib/__tests__/*.test.ts`, which run under Bun's own test runner, not the Next.js build, and are unaffected by this).

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — release history
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — supported versions and how to report a vulnerability
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community expectations
- [worklog.md](worklog.md) — detailed, task-by-task engineering history of this project

## License

Released under the [MIT License](LICENSE).
