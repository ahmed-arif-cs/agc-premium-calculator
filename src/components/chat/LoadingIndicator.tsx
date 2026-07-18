import Image from "next/image";

/**
 * The chat's Loading State — an animated "typing" bubble shown while a
 * (simulated) reply is pending. Purely presentational; `ChatWindow`
 * decides when it is visible.
 */
export function LoadingIndicator() {
  return (
    <div className="chat-row chat-row--assistant" role="status" aria-label="Assistant is typing">
      <div className="chat-avatar chat-avatar--assistant chat-avatar--logo" aria-hidden>
        <Image src="/agc-mark.png" alt="" width={28} height={28} className="h-full w-full object-cover" />
      </div>
      <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
    </div>
  );
}
