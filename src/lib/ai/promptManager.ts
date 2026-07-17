import "server-only";

import type { ChatMessage } from "./types";

/**
 * A named, reusable prompt template.
 *
 * `systemPrompt` may reference `{{variableName}}` placeholders, filled in
 * by `render()` at build time — e.g. a future "explain this calculation"
 * feature could register a template whose system prompt includes
 * `{{expression}}`/`{{result}}` placeholders rather than string-building
 * a system prompt inline at every call site.
 */
export interface PromptTemplate {
  id: string;
  /** Human-readable description, shown only in logs/diagnostics — never sent to a provider. */
  description?: string;
  /** The system prompt text, with `{{variableName}}` placeholders. */
  systemPrompt: string;
}

/** Thrown when `PromptManager` is asked for a template id it doesn't have. */
export class PromptTemplateNotFoundError extends Error {
  constructor(readonly templateId: string) {
    super(`No prompt template registered with id "${templateId}".`);
    this.name = "PromptTemplateNotFoundError";
  }
}

/**
 * Owns this project's library of prompt templates and turns
 * (template + variables + conversation history) into the ordered
 * `ChatMessage[]` a provider actually receives.
 *
 * Deliberately framework-agnostic and provider-agnostic: it knows
 * nothing about `AIProvider` or any vendor's message format, only about
 * this project's own `ChatMessage` shape (`./types.ts`) — `AIService` is
 * the one place that wires a `PromptManager` together with a
 * `ConversationManager` and an `AIProvider`.
 */
export class PromptManager {
  private readonly templates = new Map<string, PromptTemplate>();

  /** Registers a template, keyed by its own `id`. Overwrites any existing template with the same id. */
  register(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /** Returns a registered template, or `undefined` if `templateId` isn't registered. */
  get(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /** All currently registered template ids, for diagnostics/tests. */
  listTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Fills a template's `{{variableName}}` placeholders. Any placeholder
   * with no matching key in `variables` is left as-is (rather than
   * silently becoming an empty string), so a missing variable is easy to
   * spot in a rendered prompt instead of disappearing without a trace.
   */
  render(template: PromptTemplate, variables: Record<string, string> = {}): string {
    return template.systemPrompt.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
    );
  }

  /**
   * Builds the full, ordered message list a provider should receive for
   * one turn: the rendered template's system prompt, followed by the
   * conversation's existing history, unchanged and in order.
   *
   * The system message is synthesized fresh on every call (a stable id
   * derived from the template id, so re-rendering the same template
   * doesn't create a new id every turn) rather than being stored inside
   * `ConversationManager` — the system prompt is a property of *how* a
   * conversation is being used this turn, not persisted conversation
   * state, so a caller can freely change templates/variables between
   * turns of the same conversation without mutating its history.
   *
   * Throws `PromptTemplateNotFoundError` if `templateId` isn't
   * registered — callers that want a softer fallback should check
   * `get(templateId)` themselves first.
   */
  buildMessages(
    templateId: string,
    variables: Record<string, string>,
    history: ChatMessage[]
  ): ChatMessage[] {
    const template = this.templates.get(templateId);
    if (!template) throw new PromptTemplateNotFoundError(templateId);

    const systemMessage: ChatMessage = {
      id: `system:${template.id}`,
      role: "system",
      content: this.render(template, variables),
      createdAt: new Date(0).toISOString(),
    };

    return [systemMessage, ...history];
  }
}

/**
 * A ready-to-use `PromptManager` with this project's starting template(s)
 * already registered, so a future caller doesn't need to hand-register
 * the same baseline template at every call site. Additional templates
 * can still be registered on this same instance, or a caller can
 * construct its own `new PromptManager()` for full isolation (e.g. in a
 * test).
 */
export function createDefaultPromptManager(): PromptManager {
  const manager = new PromptManager();

  manager.register({
    id: "general-assistant",
    description:
      "A neutral, general-purpose assistant persona — the starting-point template for this app's future AI features, with no calculator-specific behavior baked in yet.",
    systemPrompt:
      "You are a helpful, concise assistant. Answer clearly and stay on topic.",
  });

  return manager;
}
