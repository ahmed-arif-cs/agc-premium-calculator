# Contributing to AGC Premium Calculator

Thanks for your interest in contributing! This document explains how to set up the project, the conventions we follow, and how to submit changes.

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies:
   ```bash
   bun install
   # (or: npm install)
   ```
3. Copy the environment template (optional — the app runs fully in Guest Mode with no configuration):
   ```bash
   cp .env.example .env
   ```
4. Start the dev server:
   ```bash
   bun run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000).

See [README.md](README.md) for a full feature overview and project structure.

## Development Workflow

- Create a branch off `main` using a descriptive name, e.g. `fix/history-export-decimal`, `feat/converter-crypto`.
- Keep pull requests focused — one logical change per PR. Avoid mixing unrelated refactors with feature work or bug fixes.
- Preserve existing behavior unless the PR's explicit purpose is to change it. In particular, please don't casually touch:
  - Calculator logic (`src/lib/calculator.ts`, `src/lib/nlp.ts`, `src/lib/algebra.ts`)
  - AGC branding (logos, icons, PDF/export templates, favicon)
  - Authentication flows (Guest Mode, Google Login, GitHub Login)
  - Row Level Security policies in `supabase/migrations/`

  If a change genuinely requires touching one of these, explain why in the PR description.

## Before Submitting a Pull Request

Run the available checks locally:

```bash
bun run lint       # ESLint
bun test           # Unit tests (bun:test)
bun run build       # Production build
```

If a check can't run in your environment (e.g. no network access), say so explicitly in your PR description rather than skipping it silently.

## Commit Messages

Use clear, imperative-mood commit messages, e.g. `Fix currency rounding for JPY`, `Add unit tests for algebra solver`. Reference related issues where relevant (`Fixes #123`).

## Code Style

- TypeScript, strict mode. Avoid introducing `any` where a real type is available.
- Match the existing formatting and file organization — this project does not currently use Prettier, so please follow the surrounding code's style. `.editorconfig` covers indentation/line-ending basics.
- Keep components presentational where possible; put logic in hooks (`src/hooks/`) or pure library functions (`src/lib/`) as the rest of the codebase does.
- New environment variables must be documented with a comment in `.env.example` and, if user-facing, in `README.md`.

## Reporting Bugs

Please open an issue with:
- A clear description of the problem and expected behavior
- Steps to reproduce
- Your browser/OS and whether you're using Guest Mode or a signed-in account
- Screenshots, if it's a visual/UI issue

## Reporting Security Issues

**Do not open a public issue for security vulnerabilities.** See [SECURITY.md](SECURITY.md) for how to report them responsibly.

## Suggesting Features

Feature suggestions are welcome via an issue. Please describe the use case, not just the implementation — it helps us evaluate the trade-offs, especially around Guest Mode compatibility and bundle size.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
