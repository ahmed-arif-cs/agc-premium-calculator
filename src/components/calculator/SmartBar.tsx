"use client";

import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useClickSound } from "@/hooks/useSettings";
import { parseNaturalInput, looksLikeEquation } from "@/lib/nlp";
import { solveEquation } from "@/lib/algebra";
import type { UseCalculatorReturn } from "@/hooks/useCalculator";

interface SmartBarProps {
  calc: UseCalculatorReturn;
}

export function SmartBar({ calc }: SmartBarProps) {
  const [text, setText] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const clickSound = useClickSound();

  const run = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    clickSound();
    try {
      if (looksLikeEquation(trimmed)) {
        const sol = solveEquation(trimmed);
        setFeedback(sol.display);
        calc.loadResult(trimmed, sol.display);
        return;
      }
      const parsed = parseNaturalInput(trimmed, calc.angleMode);
      setFeedback(`= ${parsed.result}`);
      calc.loadResult(parsed.expression, parsed.result);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not understand that");
    }
  };

  // Voice recognition fills the field with the final transcript AND
  // immediately computes it — the user shouldn't have to press Go/Enter
  // again after speaking.
  const voice = useVoiceInput((finalText) => {
    setText(finalText);
    run(finalText);
  });

  const handleMic = () => {
    clickSound();
    if (voice.listening) {
      voice.stop();
    } else {
      setFeedback("");
      voice.start();
    }
  };

  // voice.error takes priority when present (mic permission, no speech, etc.);
  // otherwise fall back to the last computed result/error from run().
  const displayFeedback = voice.error ?? feedback;

  return (
    <div>
      <div className="calc-smart">
        <input
          className="calc-smart-input"
          placeholder={voice.listening ? "Listening… speak now" : 'Try "25% of 400" or "2x + 5 = 11"'}
          value={voice.listening ? voice.transcript : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run(text);
            }
          }}
          readOnly={voice.listening}
          aria-label="Natural language or equation input"
        />
        {voice.supported ? (
          <button
            type="button"
            className={cn("calc-mic", voice.listening && "calc-mic--listening")}
            onClick={handleMic}
            aria-label={voice.listening ? "Stop listening" : "Start voice input"}
            title="Voice input"
          >
            <Mic className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          className="calc-smart-go"
          onClick={() => run(text)}
          aria-label="Compute"
          title="Compute"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </div>
      {displayFeedback ? <div className="calc-smart-result">{displayFeedback}</div> : null}
    </div>
  );
}
