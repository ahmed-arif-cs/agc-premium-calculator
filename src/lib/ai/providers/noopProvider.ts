import "server-only";

import type { AIProvider } from "../providerInterface";
import type { GenerateRequest, GenerateResult } from "../types";
import { AIProviderError } from "../types";

/**
 * The default provider, used whenever no real provider is configured
 * (`AI_PROVIDER` unset/`"none"`, or `isAIConfigured()` is false).
 *
 * This is the AI-architecture equivalent of the calculator app's
 * guest-first philosophy elsewhere in this project: rather than the
 * provider factory (`providers/index.ts`) returning `undefined`/`null`
 * and pushing a null-check onto every caller, it always returns a real
 * `AIProvider` — this one — so `AIService` can be constructed and wired
 * up freely, and only fails, with a clear and specific error, at the
 * moment something actually tries to generate a reply with no provider
 * configured. No network call is ever made by this provider; it exists
 * purely to make "not configured" an explicit, typed outcome instead of
 * a crash or a silent no-op.
 */
export class NoopProvider implements AIProvider {
  readonly name = "none";

  async generate(_request: GenerateRequest): Promise<GenerateResult> {
    throw new AIProviderError(
      "No AI provider is configured. Set AI_PROVIDER (and the matching API key) " +
        "in your environment — see src/lib/ai/README.md.",
      "not_configured"
    );
  }
}
