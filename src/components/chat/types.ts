export type ChatUIRole = "user" | "assistant" | "system";

export interface ChatUIImage {
  mimeType: string;
  data: string;
  previewUrl: string;
}

export interface ChatUIMessage {
  id: string;
  role: ChatUIRole;
  content: string;
  createdAt: number;
  images?: ChatUIImage[];
}