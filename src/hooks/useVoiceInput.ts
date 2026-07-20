"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in lib.dom by default).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface UseVoiceInputReturn {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  setTranscript: (t: string) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone permission denied. Allow mic access in your browser settings.",
  "service-not-allowed": "Microphone permission denied. Allow mic access in your browser settings.",
  "no-speech": "Didn't catch that — try speaking again.",
  "audio-capture": "No microphone found on this device.",
  network: "Voice recognition needs an internet connection.",
};

export function useVoiceInput(onFinal?: (text: string) => void): UseVoiceInputReturn {
  const [supported] = useState<boolean>(() => getCtor() !== null);
  const [listening, setListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<((text: string) => void) | undefined>(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    if (recogRef.current) {
      recogRef.current.stop();
      recogRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser.");
      return;
    }
    if (recogRef.current) {
      recogRef.current.stop();
      recogRef.current = null;
    }
    const recog = new Ctor();
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.continuous = false;
    recog.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };
    recog.onerror = (event) => {
      const reason = event?.error;
       console.error("Voice input error (raw):", event.error);
      setError(
        (reason && ERROR_MESSAGES[reason]) ?? "Voice input failed. Please try again.",
      );
      setListening(false);
      recogRef.current = null;
    };
    recog.onend = () => {
      setListening(false);
      recogRef.current = null;
      // Deliver the final transcript to the caller.
      setTranscript((current) => {
        if (current && onFinalRef.current) onFinalRef.current(current);
        return current;
      });
    };
    recogRef.current = recog;
    setError(null);
    setTranscript("");
    setListening(true);
    try {
      recog.start();
    } catch {
      setError("Couldn't start the microphone. Please try again.");
      setListening(false);
      recogRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recogRef.current) recogRef.current.stop();
    };
  }, []);

  return { supported, listening, transcript, error, start, stop, setTranscript };
}
