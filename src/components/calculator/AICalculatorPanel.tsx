"use client";

import { useState } from "react";
import { AlertTriangle, Sparkle, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useClickSound } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import type { UseCalculatorReturn } from "@/hooks/useCalculator";

interface AICalculatorPanelProps {
  open: boolean;
  onClose: () => void;
  calc: UseCalculatorReturn;
}

interface AICalculatorResult {
  expression: string;
  displayExpression: string;
  result: string;
  explanation: string;
  steps: string[];
  provider: string;
}

const EXAMPLES = [
  "What's 18% of a $240 dinner bill?",
  "Square root of 225 plus 7 squared",
  "If I save $150 a month for a year, how much is that?",
];

/**
 * The AI Calculator — a natural-language front end for the calculator
 * that sits entirely on top of the existing engine rather than
 * replacing it.
 *
 * Talks only to `POST /api/ai/calculate`
 * (`src/app/api/ai/calculate/route.ts`), which itself always
 * re-computes the actual number via this project's own, completely
 * unchanged `evaluateExpression`/`formatResult`
 * (`src/lib/calculator.ts`) — the AI is only ever used to turn a
 * natural-language question into that expression and to write the
 * plain-language explanation and step-by-step walkthrough alongside it.
 * "Insert into calculator" hands the result to `calc.loadResult(...)`,
 * the exact same call the Smart Bar (`SmartBar.tsx`) already uses for
 * its own rule-based natural-language input.
 */
export function AICalculatorPanel({ open, onClose, calc }: AICalculatorPanelProps) {
  useEscapeToClose(open, onClose);
  const clickSound = useClickSound();
  const { toast } = useToast();

  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<AICalculatorResult | null>(null);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    clickSound();
    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("/api/ai/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, angleMode: calc.angleMode }),
      });

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : "The AI Calculator couldn't work that out just now.";
        setError(message);
        return;
      }

      const result = body as Partial<AICalculatorResult>;
      if (
        typeof result.expression !== "string" ||
        typeof result.result !== "string" ||
        typeof result.explanation !== "string" ||
        !Array.isArray(result.steps)
      ) {
        setError("The AI Calculator sent back an unexpected response.");
        return;
      }

      setData({
        expression: result.expression,
        displayExpression: result.displayExpression ?? result.expression,
        result: result.result,
        explanation: result.explanation,
        steps: result.steps.filter((s): s is string => typeof s === "string"),
        provider: result.provider ?? "ai",
      });
    } catch {
      setError("Couldn't reach the AI Calculator — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (!data) return;
    clickSound();
    calc.loadResult(data.expression, data.result);
    toast({
      title: "Inserted into calculator",
      description: `${data.displayExpression} = ${data.result}`,
      className: "calc-toast",
    });
    onClose();
  };

  const handleClose = () => {
    clickSound();
    onClose();
  };

  return (
    <>
      <div
        className={cn("calc-settings-backdrop", open && "calc-settings-backdrop--open")}
        onClick={handleClose}
        aria-hidden
      />
      <aside
        className={cn("calc-settings-panel calc-aic-panel", open && "calc-settings-panel--open")}
        role="dialog"
        aria-modal={open}
        aria-label="AI Calculator"
        aria-hidden={!open}
      >
        <header className="calc-settings-header">
          <h2 className="t-text font-display text-sm font-semibold tracking-[0.18em]">
            AI CALCULATOR
          </h2>
          <button
            type="button"
            className="calc-settings-close"
            onClick={handleClose}
            aria-label="Close AI Calculator"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="calc-settings-body calc-aic-body">
          <p className="t-muted calc-aic-intro">
            Ask a question in plain English — the AI turns it into an expression and this
            calculator&apos;s own engine computes the real answer, with an explanation and
            step-by-step walkthrough alongside it.
          </p>

          <form
            className="calc-aic-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(query);
            }}
          >
            <textarea
              className="calc-aic-input"
              placeholder={'Try "18% of a $240 dinner bill" or "square root of 225 plus 7 squared"'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(query);
                }
              }}
              rows={2}
              aria-label="Ask the AI Calculator"
            />
            <button
              type="submit"
              className="calc-aic-ask"
              disabled={loading || query.trim().length === 0}
              aria-label="Ask AI"
            >
              <Wand2 className="h-4 w-4" />
              {loading ? "Thinking…" : "Ask AI"}
            </button>
          </form>

          {!data && !error && !loading ? (
            <div className="calc-aic-examples">
              <h3>Try asking</h3>
              <div className="calc-aic-chips">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="calc-aic-chip"
                    onClick={() => {
                      setQuery(example);
                      ask(example);
                    }}
                  >
                    <Sparkle className="h-3 w-3" />
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="calc-aic-loading" role="status" aria-label="Working it out">
              <span className="calc-aic-dot" />
              <span className="calc-aic-dot" />
              <span className="calc-aic-dot" />
            </div>
          ) : null}

          {error ? (
            <div className="calc-aic-error">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {data ? (
            <div className="calc-aic-result">
              <div className="calc-aic-result-expr">{data.displayExpression} =</div>
              <div className="calc-aic-result-value">{data.result}</div>

              <button type="button" className="calc-aic-insert" onClick={handleInsert}>
                Insert into calculator
              </button>

              <div className="calc-settings-section calc-aic-section">
                <h3>Formula explanation</h3>
                <p className="calc-aic-explanation">{data.explanation}</p>
              </div>

              {data.steps.length > 0 ? (
                <div className="calc-settings-section calc-aic-section">
                  <h3>Step-by-step solution</h3>
                  <ol className="calc-aic-steps">
                    {data.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <p className="calc-aic-provider">Powered by AGC Premium AI.</p>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
