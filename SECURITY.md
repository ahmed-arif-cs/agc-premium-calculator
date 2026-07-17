# Security Policy

## Supported Versions

This project is actively developed on the `main` branch. Only the latest commit/release on `main` receives security fixes; older snapshots are not separately maintained.

| Version         | Supported          |
| --------------- | ------------------- |
| `main` (latest) | :white_check_mark: |
| Older snapshots | :x:                 |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please report them privately:

- Preferred: open a [GitHub Security Advisory](../../security/advisories/new) for this repository (if enabled), which lets us discuss and fix the issue before it's public.
- Otherwise: contact a project maintainer directly and mark the report as security-sensitive.

Please include as much of the following as you can:
- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof-of-concept
- The affected file(s)/route(s)/component(s), if known
- Whether the issue affects Guest Mode, an authenticated (Google/GitHub) session, or both

We aim to acknowledge reports promptly and will keep you updated as we investigate and remediate. Please give us a reasonable amount of time to address the issue before any public disclosure.

## Security Design Notes

This project handles several categories of sensitive data and access; the notes below summarize the current design so reports can be scoped accurately.

- **Authentication** — Sign-in is handled entirely by Supabase OAuth (Google, GitHub); this project never handles passwords directly. Guest Mode stores data only in the browser (`localStorage`) and never touches the network for auth.
- **Database access** — Every Supabase table used by the app has Row Level Security enabled, scoped to `auth.uid()`, so access control is enforced at the database layer rather than trusted client-side.
- **Secrets** — Server-only credentials (Supabase service role key, AI/OCR provider API keys) are read only from `server-only`-guarded modules and are never sent to the browser. Only `NEXT_PUBLIC_`-prefixed values (which Supabase itself documents as safe to expose, since RLS — not secrecy — enforces access) are exposed client-side. Never commit real values to `.env`; use `.env.example` as a template only.
- **Rate limiting** — Unauthenticated API routes that can trigger paid third-party AI/OCR calls apply a per-client rate limit.
- **HTTP headers** — Baseline security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are set on every response.
- **Dependencies** — Please report any vulnerable dependency via the private channel above rather than a public issue, so a fix can be prepared first. You're also welcome to open a non-security issue for outdated-but-not-vulnerable dependencies.

## Scope

This policy covers the application code in this repository. It does not cover the security of third-party services this project can optionally integrate with (Supabase, OpenAI, Anthropic, Google Gemini, etc.) — please report issues with those services directly to their respective vendors.
