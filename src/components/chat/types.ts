/**
 * AI Chat interface — UI-only types.
 *
 * These are deliberately **local to the UI layer** and separate from
 * `src/lib/ai/types.ts`'s `ChatMessage`/`ChatRole` (Task 25). This task's
 * scope is the chat interface only — Chat Window, Message List, Chat
 * Input, Loading State, mobile layout — with no connection to the AI
 * Service Layer / providers yet, so the UI intentionally does not import
 * from `src/lib/ai/`. A future task can swap this local state for real
 * calls into `getAIService()` without needing to change these component
 * shapes much, since the fields below already mirror that layer's own
 * vocabulary (`role`, `content`).
 */

/** Who a given message is displayed as. `"system"` is used only for local, in-UI notices (e.g. "not connected yet") — never sent anywhere. */
export type ChatUIRole = "user" | "assistant" | "system";

export interface ChatUIMessage {
  id: string;
  role: ChatUIRole;
  content: string;
  /** `Date.now()` timestamp, used for display + list keys. */
  createdAt: number;
}
