import "server-only";

/**
 * AI Service environment variable access.
 *
 * FOUNDATION LAYER ONLY (Task 25) — no route, server action, or UI reads
 * from this yet. This module exists so that every future piece of the AI
 * architecture (`aiService.ts`, `providers/`) reads its configuration from
 * exactly one place, with one consistent "not configured" story, instead
 * of each file reaching into `process.env` directly — the same pattern
 * `src/lib/supabase/env.ts` already established for this project's cloud
 * sync foundation.
 *
 * Nothing in this file throws at import/build time, and no API key is
 * hardcoded, checked in, or given a default value anywhere in this
 * project — every value below is read from the environment only, and
 * every one of them is left blank in `.env`/`.env.example` on purpose
 * (see those files' own comments). The app must keep working with zero
 * AI provider configured at all, exactly like the existing Supabase
 * foundation stays optional.
 *
 * `import "server-only"` guards this file the same way
 * `src/lib/supabase/auth.ts` does — an AI API key must never be bundled
 * into client JavaScript, so nothing here is safe to import from a
 * `"use client"` file (there is no client-side AI code in this task's
 * scope in the first place — see the project README's Task 25 note).
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function required(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env ` +
        `and fill in your AI provider's values (see src/lib/ai/README.md). No key is ` +
        `checked into this project — it must be supplied via the environment.`
    );
  }
  return value;
}

/**
 * Which provider the AI Service Layer should resolve to (e.g. `"openai"`,
 * `"anthropic"`). Defaults to `"none"` — the safe, always-available value
 * that resolves to `providers/noopProvider.ts` — so an unset/blank
 * environment never crashes anything that merely checks which provider
 * is configured.
 */
export function getAIProvider(): string {
  return (readEnv("AI_PROVIDER") ?? "none").toLowerCase();
}

/**
 * The model identifier to request from the configured provider (e.g.
 * `"gpt-4o-mini"`, `"claude-sonnet-4-6"`). Optional — a provider
 * implementation may fall back to its own default when this is unset.
 */
export function getAIModel(): string | undefined {
  return readEnv("AI_MODEL");
}

/**
 * Secret API key for the configured provider. Server-only — bypasses
 * nothing on its own, but must never reach the browser. Throws if unset;
 * callers that need to degrade gracefully should check
 * `isAIConfigured()` first instead of calling this speculatively.
 */
export function getAIApiKey(): string {
  return required("AI_API_KEY");
}

/**
 * Optional custom API base URL, for a self-hosted or proxied endpoint
 * (e.g. an Azure OpenAI deployment, or a local model gateway). Most
 * providers can ignore this and use their own default endpoint.
 */
export function getAIBaseUrl(): string | undefined {
  return readEnv("AI_BASE_URL");
}

/**
 * True once a real provider (anything other than `"none"`) is named
 * *and* an API key is present. Lets callers — chiefly
 * `providers/index.ts`'s provider factory and `aiService.ts` — check
 * availability without triggering the thrown error `getAIApiKey()`
 * raises when unset, mirroring `isSupabaseConfigured()`'s role for the
 * cloud sync foundation.
 */
export function isAIConfigured(): boolean {
  return getAIProvider() !== "none" && Boolean(readEnv("AI_API_KEY"));
}

/**
 * Per-vendor configuration shape (Task 26). Each of the three named
 * providers below (`providers/openaiProvider.ts`,
 * `providers/claudeProvider.ts`, `providers/geminiProvider.ts`) reads its
 * own dedicated environment variables — instead of sharing the single
 * generic `AI_MODEL`/`AI_API_KEY`/`AI_BASE_URL` trio above — so that,
 * later, more than one vendor's credentials can be present in the same
 * environment at once (e.g. to compare providers, or fail over) without
 * one vendor's key overwriting another's. `AI_PROVIDER` still decides
 * which one `providers/index.ts` actually resolves to.
 */
export interface ProviderEnvConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/** True once both `apiKey` and `model` are present — the minimum a provider needs to consider itself "configured". */
export function isProviderConfigComplete(config: ProviderEnvConfig): boolean {
  return Boolean(config.apiKey) && Boolean(config.model);
}

/**
 * OpenAI configuration — `OPENAI_API_KEY` (required for use),
 * `OPENAI_MODEL` (defaults to `"gpt-4o-mini"` when unset), and an
 * optional `OPENAI_BASE_URL` for a proxied/self-hosted-compatible
 * endpoint (e.g. Azure OpenAI). No key is hardcoded or defaulted — all
 * three are left blank in `.env`/`.env.example`.
 */
export function getOpenAIConfig(): ProviderEnvConfig {
  return {
    apiKey: readEnv("OPENAI_API_KEY"),
    model: readEnv("OPENAI_MODEL") ?? "gpt-4o-mini",
    baseUrl: readEnv("OPENAI_BASE_URL"),
  };
}

/**
 * Claude (Anthropic) configuration — `ANTHROPIC_API_KEY` (required for
 * use), `ANTHROPIC_MODEL` (defaults to `"claude-sonnet-4-6"` when
 * unset), and an optional `ANTHROPIC_BASE_URL`. Named `getClaudeConfig`
 * (matching this task's own "Claude" naming) even though the underlying
 * env vars use Anthropic's own `ANTHROPIC_*` convention, so a person
 * reading `.env.example` recognizes the names Anthropic's own docs use.
 */
export function getClaudeConfig(): ProviderEnvConfig {
  return {
    apiKey: readEnv("ANTHROPIC_API_KEY"),
    model: readEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6",
    baseUrl: readEnv("ANTHROPIC_BASE_URL"),
  };
}

/**
 * Gemini (Google) configuration — `GEMINI_API_KEY` (required for use),
 * `GEMINI_MODEL` (defaults to `"gemini-flash-latest"` when unset), and an
 * optional `GEMINI_BASE_URL`.
 */
export function getGeminiConfig(): ProviderEnvConfig {
  return {
    apiKey: readEnv("GEMINI_API_KEY"),
    model: readEnv("GEMINI_MODEL") ?? "gemini-flash-latest",
    baseUrl: readEnv("GEMINI_BASE_URL"),
  };
}

/** True once `OPENAI_API_KEY` is present. Never throws. */
export function isOpenAIConfigured(): boolean {
  return isProviderConfigComplete(getOpenAIConfig());
}

/** True once `ANTHROPIC_API_KEY` is present. Never throws. */
export function isClaudeConfigured(): boolean {
  return isProviderConfigComplete(getClaudeConfig());
}

/** True once `GEMINI_API_KEY` is present. Never throws. */
export function isGeminiConfigured(): boolean {
  return isProviderConfigComplete(getGeminiConfig());
}
