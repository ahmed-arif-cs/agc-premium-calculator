"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Camera, ImagePlus, Mic, SendHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { ChatUIImage } from "./types";

interface ChatInputProps {
  onSend: (text: string, images?: ChatUIImage[]) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 4000;
const MAX_IMAGES = 4;
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

function compressImageFile(file: File): Promise<ChatUIImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the selected image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("This browser can't process images."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const commaIndex = previewUrl.indexOf(",");
        const data = previewUrl.slice(commaIndex + 1);

        resolve({ mimeType: "image/jpeg", data, previewUrl });
      };
      img.src = typeof reader.result === "string" ? reader.result : "";
    };
    reader.readAsDataURL(file);
  });
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<ChatUIImage[]>([]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const atImageLimit = images.length >= MAX_IMAGES;

  // Voice input — fills the textarea with the recognized speech instead of
  // auto-sending, so the person can review/edit before hitting send.
  const voice = useVoiceInput((finalText) => {
    setValue((prev) => (prev ? `${prev} ${finalText}` : finalText));
  });

  const handleMic = () => {
    if (voice.listening) {
      voice.stop();
    } else {
      voice.start();
    }
  };

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = () => {
    const trimmed = value.trim();
    if (disabled || (!trimmed && images.length === 0)) return;
    onSend(trimmed, images.length > 0 ? images : undefined);
    setValue("");
    setImages([]);
    setAttachError(null);
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setAttachError(`You can attach up to ${MAX_IMAGES} images per message.`);
      return;
    }

    const nonImageFiles = files.filter((f) => !f.type.startsWith("image/"));
    const imageFiles = files.filter((f) => f.type.startsWith("image/")).slice(0, room);

    if (nonImageFiles.length > 0) {
      setAttachError("Only image files can be attached.");
    } else {
      setAttachError(null);
    }
    if (imageFiles.length === 0) return;

    setIsProcessingImage(true);
    try {
      const compressed = await Promise.all(imageFiles.map(compressImageFile));
      setImages((prev) => [...prev, ...compressed]);
    } catch {
      setAttachError("One of the selected images couldn't be processed. Try a different photo.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setAttachError(null);
  };

  return (
    <div className="chat-input-area">
      {(images.length > 0 || attachError || voice.error) && (
        <div className="chat-attach-row">
          {images.map((image, index) => (
            <div key={index} className="chat-attach-thumb-wrap">
              <img src={image.previewUrl} alt="Attached" className="chat-attach-thumb" />
              <button
                type="button"
                className="chat-attach-remove"
                onClick={() => removeImage(index)}
                aria-label="Remove attached image"
                title="Remove"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {attachError && <p className="chat-attach-error">{attachError}</p>}
          {attachError && <p className="chat-attach-error">{attachError}</p>}
{voice.error && <p className="chat-attach-error">{voice.error}</p>}
        </div>
      )}

      <div className="chat-input-row">
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="chat-hidden-file-input"
          onChange={handleFilesSelected}
          disabled={disabled}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="chat-hidden-file-input"
          onChange={handleFilesSelected}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled || atImageLimit || isProcessingImage}
          aria-label="Attach image"
          title="Attach image"
          className="chat-attach-btn"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled || atImageLimit || isProcessingImage}
          aria-label="Take a photo (scan)"
          title="Take a photo (scan)"
          className="chat-attach-btn"
        >
          <Camera className="h-4 w-4" />
        </button>
        {voice.supported ? (
          <button
            type="button"
            onClick={handleMic}
            disabled={disabled}
            aria-label={voice.listening ? "Stop listening" : "Start voice input"}
            title="Voice input"
            className={cn("calc-mic", voice.listening && "calc-mic--listening")}
          >
            <Mic className="h-4 w-4" />
          </button>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value.slice(0, MAX_LENGTH));
            resize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Waiting for a reply…"
              : voice.listening
                ? "Listening… speak now"
                : images.length > 0
                  ? "Add a caption (optional)…"
                  : "Message the assistant…"
          }
          rows={1}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          aria-label="Chat message"
          className="chat-textarea"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || (value.trim().length === 0 && images.length === 0)}
          aria-label="Send message"
          title="Send (Enter)"
          className={cn(
            "chat-send-btn",
            !disabled && (value.trim().length > 0 || images.length > 0) && "chat-send-btn--active"
          )}
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}