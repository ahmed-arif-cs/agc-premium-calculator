import type { Metadata } from "next";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const metadata: Metadata = {
  title: "AI Chat — AGC Premium Calculator",
  description:
    "A preview of the AGC Premium Calculator's AI chat interface — chat window, message list, and input. Not yet connected to an AI provider.",
};

export default function ChatPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="calc-bg-glow" aria-hidden />
      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-10">
        <ChatWindow />
      </main>
    </div>
  );
}
