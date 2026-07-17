import { Bot } from "lucide-react";

/**
 * The chat's Loading State — an animated "typing" bubble shown while a
 * (simulated) reply is pending. Purely presentational; `ChatWindow`
 * decides when it is visible.
 */
export function LoadingIndicator() {
  return (
    <div className="chat-row chat-row--assistant" role="status" aria-label="Assistant is typing">
      <div className="chat-avatar chat-avatar--assistant" aria-hidden>
        <Bot className="h-4 w-4" />
      </div>
      <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
    </div>
  );
}
