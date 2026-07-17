"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  computePreview,
  evaluateExpression,
  formatExpressionForDisplay,
  formatResult,
  genId,
  lastNumberSegment,
  type AngleMode,
  type OperatorSymbol,
} from "@/lib/calculator";
import { useToast } from "@/hooks/use-toast";
import { useMemory } from "@/hooks/useMemory";

export type CalculatorMode = "standard" | "scientific" | "converter";

export interface EvaluationRecord {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

export interface UseCalculatorReturn {
  // Phase 1 surface
  expression: string;
  displayExpression: string;
  result: string;
  preview: string;
  error: string | null;
  isEvaluated: boolean;
  copied: boolean;

  // Phase 2 surface
  mode: CalculatorMode;
  angleMode: AngleMode;
  memory: number;
  hasMemory: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lastEvaluation: EvaluationRecord | null;

  // Phase 1 actions
  inputDigit: (digit: string) => void;
  inputDecimal: () => void;
  inputOperator: (operator: OperatorSymbol) => void;
  inputPercent: () => void;
  backspace: () => void;
  clear: () => void;
  allClear: () => void;
  evaluate: () => void;
  copyResult: () => void;

  // Phase 2 actions
  setMode: (mode: CalculatorMode) => void;
  toggleAngleMode: () => void;
  inputFunction: (name: string) => void;
  inputConstant: (symbol: "π" | "e") => void;
  inputParen: (open: boolean) => void;
  inputPower: () => void;
  inputFactorial: () => void;
  memoryAdd: () => void;
  memorySubtract: () => void;
  memoryRecall: () => void;
  memoryClear: () => void;
  undo: () => void;
  redo: () => void;
  loadResult: (expression: string, result: string) => void;
}

interface CoreState {
  expression: string;
  committedResult: string;
  isEvaluated: boolean;
  error: string | null;
}

interface ReducerState {
  present: CoreState;
  undo: CoreState[];
  redo: CoreState[];
}

type ReducerAction =
  | { type: "COMPUTE"; fn: (prev: CoreState) => CoreState }
  | { type: "UNDO" }
  | { type: "REDO" };

const INITIAL_CORE: CoreState = {
  expression: "",
  committedResult: "0",
  isEvaluated: false,
  error: null,
};

const INITIAL_REDUCER: ReducerState = {
  present: INITIAL_CORE,
  undo: [],
  redo: [],
};

const MAX_UNDO = 50;
const ARITH_OPERATORS: readonly string[] = ["+", "-", "*", "/"];
const FUNCTION_NAMES: readonly string[] = ["sin", "cos", "tan", "sqrt", "log", "ln"];

/** True if `expr` ends with a value token that requires implicit `*` before a new value. */
function endsWithValue(expr: string): boolean {
  return expr.length > 0 && /[0-9.)πe%!]$/.test(expr);
}

function reducer(state: ReducerState, action: ReducerAction): ReducerState {
  switch (action.type) {
    case "COMPUTE": {
      const next = action.fn(state.present);
      return {
        present: next,
        undo: [...state.undo, state.present].slice(-MAX_UNDO),
        redo: [],
      };
    }
    case "UNDO": {
      if (state.undo.length === 0) return state;
      const previous = state.undo[state.undo.length - 1];
      return {
        present: previous,
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, state.present].slice(-MAX_UNDO),
      };
    }
    case "REDO": {
      if (state.redo.length === 0) return state;
      const next = state.redo[state.redo.length - 1];
      return {
        present: next,
        undo: [...state.undo, state.present].slice(-MAX_UNDO),
        redo: state.redo.slice(0, -1),
      };
    }
    default:
      return state;
  }
}

export function useCalculator(): UseCalculatorReturn {
  const [reducerState, dispatch] = useReducer(reducer, INITIAL_REDUCER);
  const present = reducerState.present;

  const [mode, setMode] = useState<CalculatorMode>("standard");
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");
  // Backed by localStorage (Guest Mode) and, when signed in, mirrored to
  // Supabase by `useMemorySync.ts` — see `useMemory.ts`. This hook's own
  // public surface (`memory`, `hasMemory`, `memoryAdd`/`Subtract`/`Recall`/
  // `Clear`) is unchanged; only where the value lives changed.
  const memoryStore = useMemory();
  const { value: memory, hasMemory, add: memoryStoreAdd, subtract: memoryStoreSubtract, clear: memoryStoreClear } =
    memoryStore;
  const [copied, setCopied] = useState<boolean>(false);
  const [lastEvaluation, setLastEvaluation] =
    useState<EvaluationRecord | null>(null);

  // Refs mirror the latest state for synchronous reads inside event-driven
  // callbacks. They are only ever written inside effects (never during render).
  const presentRef = useRef<CoreState>(present);
  const angleModeRef = useRef<AngleMode>(angleMode);
  const memoryRef = useRef<number>(memory);
  const hasMemoryRef = useRef<boolean>(hasMemory);
  const modeRef = useRef<CalculatorMode>(mode);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    presentRef.current = present;
  }, [present]);
  useEffect(() => {
    angleModeRef.current = angleMode;
  }, [angleMode]);
  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);
  useEffect(() => {
    hasMemoryRef.current = hasMemory;
  }, [hasMemory]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ---- Pure state transitions (used by COMPUTE actions) ----

  const inputDigit = useCallback(
    (digit: string) => {
      if (!/^[0-9]$/.test(digit)) return;
      dispatch({
        type: "COMPUTE",
        fn: (s) => {
          if (s.error || s.isEvaluated) {
            return {
              expression: digit,
              committedResult: "0",
              isEvaluated: false,
              error: null,
            };
          }
          const expr = s.expression;
          let updated: string;
          if (/[)πe%!]$/.test(expr)) {
            updated = `${expr}*${digit}`;
          } else {
            const seg = lastNumberSegment(expr);
            if (seg === "0" || seg === "-0") {
              updated = expr.slice(0, -1) + digit;
            } else {
              updated = expr + digit;
            }
          }
          return { ...s, expression: updated };
        },
      });
    },
    [],
  );

  const inputDecimal = useCallback(() => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (s.error || s.isEvaluated) {
          return {
            expression: "0.",
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        const expr = s.expression;
        let updated: string;
        if (/[)πe%!]$/.test(expr)) {
          updated = `${expr}*0.`;
        } else {
          const seg = lastNumberSegment(expr);
          if (seg.includes(".")) return s;
          if (seg === "" || seg === "-") updated = `${expr}0.`;
          else updated = `${expr}.`;
        }
        return { ...s, expression: updated };
      },
    });
  }, []);

  const inputOperator = useCallback((operator: OperatorSymbol) => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (s.error) {
          return {
            expression: operator === "-" ? "-" : "",
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        if (s.isEvaluated) {
          return {
            expression: `${s.committedResult}${operator}`,
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        const expr = s.expression;
        if (expr === "") {
          return operator === "-"
            ? { ...s, expression: "-" }
            : s;
        }
        const lastChar = expr[expr.length - 1];
        if (ARITH_OPERATORS.includes(lastChar) || lastChar === "^") {
          if (operator === "-" && (lastChar === "*" || lastChar === "/")) {
            return { ...s, expression: `${expr}-` };
          }
          let trimmed = expr;
          while (
            trimmed.length > 0 &&
            (ARITH_OPERATORS.includes(trimmed[trimmed.length - 1]) ||
              trimmed[trimmed.length - 1] === "^")
          ) {
            trimmed = trimmed.slice(0, -1);
          }
          if (trimmed === "" && operator !== "-") return s;
          return { ...s, expression: `${trimmed}${operator}` };
        }
        return { ...s, expression: `${expr}${operator}` };
      },
    });
  }, []);

  const inputPercent = useCallback(() => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (s.error) return s;
        if (s.isEvaluated) {
          return {
            expression: `${s.committedResult}%`,
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        const expr = s.expression;
        if (!expr) return s;
        const lastChar = expr[expr.length - 1];
        if (
          ARITH_OPERATORS.includes(lastChar) ||
          lastChar === "^" ||
          lastChar === "(" ||
          lastChar === "%" ||
          lastChar === "."
        ) {
          return s;
        }
        return { ...s, expression: `${expr}%` };
      },
    });
  }, []);

  const inputFunction = useCallback((name: string) => {
    if (!FUNCTION_NAMES.includes(name)) return;
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        let expr: string;
        if (s.error || s.isEvaluated) {
          expr = `${name}(`;
        } else if (endsWithValue(s.expression)) {
          expr = `${s.expression}*${name}(`;
        } else {
          expr = `${s.expression}${name}(`;
        }
        return {
          expression: expr,
          committedResult: "0",
          isEvaluated: false,
          error: null,
        };
      },
    });
  }, []);

  const inputConstant = useCallback((symbol: "π" | "e") => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        let expr: string;
        if (s.error || s.isEvaluated) {
          expr = symbol;
        } else if (endsWithValue(s.expression)) {
          expr = `${s.expression}*${symbol}`;
        } else {
          expr = `${s.expression}${symbol}`;
        }
        return {
          expression: expr,
          committedResult: "0",
          isEvaluated: false,
          error: null,
        };
      },
    });
  }, []);

  const inputParen = useCallback((open: boolean) => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (open) {
          let expr: string;
          if (s.error || s.isEvaluated) {
            expr = "(";
          } else if (endsWithValue(s.expression)) {
            expr = `${s.expression}*(`;
          } else {
            expr = `${s.expression}(`;
          }
          return {
            expression: expr,
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        // close
        if (s.error || s.isEvaluated) return s;
        const expr = s.expression;
        const opens = (expr.match(/\(/g) ?? []).length;
        const closes = (expr.match(/\)/g) ?? []).length;
        if (opens <= closes) return s;
        const lastChar = expr[expr.length - 1];
        if (
          ARITH_OPERATORS.includes(lastChar) ||
          lastChar === "^" ||
          lastChar === "("
        ) {
          return s;
        }
        return { ...s, expression: `${expr})` };
      },
    });
  }, []);

  const inputPower = useCallback(() => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (s.error) return s;
        let expr: string;
        if (s.isEvaluated) {
          expr = `${s.committedResult}^`;
        } else if (!endsWithValue(s.expression)) {
          return s;
        } else {
          expr = `${s.expression}^`;
        }
        return {
          expression: expr,
          committedResult: "0",
          isEvaluated: false,
          error: null,
        };
      },
    });
  }, []);

  const inputFactorial = useCallback(() => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (s.error) return s;
        let expr: string;
        if (s.isEvaluated) {
          expr = `${s.committedResult}!`;
        } else if (!endsWithValue(s.expression)) {
          return s;
        } else {
          expr = `${s.expression}!`;
        }
        return {
          expression: expr,
          committedResult: "0",
          isEvaluated: false,
          error: null,
        };
      },
    });
  }, []);

  const backspace = useCallback(() => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (s.error) {
          return {
            expression: "",
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        if (s.isEvaluated) {
          return {
            expression: s.committedResult,
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        const expr = s.expression;
        if (!expr) return s;
        const funcMatch = expr.match(/(sin|cos|tan|sqrt|log|ln)\($/);
        if (funcMatch) {
          return { ...s, expression: expr.slice(0, -funcMatch[0].length) };
        }
        return { ...s, expression: expr.slice(0, -1) };
      },
    });
  }, []);

  const clear = useCallback(() => {
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        if (s.error || s.isEvaluated) {
          return {
            expression: "",
            committedResult: "0",
            isEvaluated: false,
            error: null,
          };
        }
        const withoutPercent = s.expression.replace(/%+$/, "");
        const cleared = withoutPercent.replace(
          /(-?\d*\.?\d*(?:[eE][-+]?\d+)?)$/,
          "",
        );
        return { ...s, expression: cleared };
      },
    });
  }, []);

  const allClear = useCallback(() => {
    dispatch({
      type: "COMPUTE",
      fn: () => INITIAL_CORE,
    });
  }, []);

  const loadResult = useCallback((expression: string, result: string) => {
    dispatch({
      type: "COMPUTE",
      fn: () => ({
        expression,
        committedResult: result,
        isEvaluated: true,
        error: null,
      }),
    });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const evaluate = useCallback(() => {
    const s = presentRef.current;
    if (s.error || !s.expression) return;
    const lastChar = s.expression[s.expression.length - 1];
    if (
      ARITH_OPERATORS.includes(lastChar) ||
      lastChar === "^" ||
      lastChar === "("
    ) {
      return;
    }
    try {
      const value = evaluateExpression(s.expression, angleModeRef.current);
      const formatted = formatResult(value);
      const next: CoreState = {
        expression: s.expression,
        committedResult: formatted,
        isEvaluated: true,
        error: null,
      };
      dispatch({ type: "COMPUTE", fn: () => next });
      setLastEvaluation({
        id: genId(),
        expression: s.expression,
        result: formatted,
        timestamp: Date.now(),
      });
    } catch (err) {
      const next: CoreState = {
        ...s,
        committedResult: "0",
        isEvaluated: false,
        error: err instanceof Error ? err.message : "Invalid expression",
      };
      dispatch({ type: "COMPUTE", fn: () => next });
    }
  }, []);

  const currentValue = useCallback((): number => {
    const s = presentRef.current;
    if (s.error) return 0;
    if (s.isEvaluated) return Number.parseFloat(s.committedResult) || 0;
    const p = computePreview(s.expression, angleModeRef.current);
    if (p !== null) return Number.parseFloat(p) || 0;
    const seg = lastNumberSegment(s.expression);
    return Number.parseFloat(seg) || 0;
  }, []);

  const memoryAdd = useCallback(() => {
    const value = currentValue();
    memoryStoreAdd(value);
  }, [currentValue, memoryStoreAdd]);

  const memorySubtract = useCallback(() => {
    const value = currentValue();
    memoryStoreSubtract(value);
  }, [currentValue, memoryStoreSubtract]);

  const memoryRecall = useCallback(() => {
    if (!hasMemoryRef.current) return;
    const memStr = formatResult(memoryRef.current);
    dispatch({
      type: "COMPUTE",
      fn: (s) => {
        let expr: string;
        if (s.error || s.isEvaluated) {
          expr = memStr;
        } else if (s.expression === "") {
          expr = memStr;
        } else if (endsWithValue(s.expression)) {
          expr = `${s.expression}*${memStr}`;
        } else {
          expr = `${s.expression}${memStr}`;
        }
        return {
          expression: expr,
          committedResult: "0",
          isEvaluated: false,
          error: null,
        };
      },
    });
  }, []);

  const memoryClear = useCallback(() => {
    memoryStoreClear();
  }, [memoryStoreClear]);

  const toggleAngleMode = useCallback(() => {
    setAngleMode((m) => (m === "deg" ? "rad" : "deg"));
  }, []);

  const copyResult = useCallback(() => {
    const s = presentRef.current;
    const text = s.isEvaluated
      ? s.committedResult
      : computePreview(s.expression, angleModeRef.current) ||
        lastNumberSegment(s.expression) ||
        "0";

    if (!text) return;

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast({
        title: "Copy failed",
        description: "Clipboard is not available in this browser.",
        className: "calc-toast",
      });
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        toast({
          title: "Copied to clipboard",
          description: text,
          className: "calc-toast",
        });
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Clipboard permission was denied.",
          className: "calc-toast",
        });
      });
  }, [toast]);

  // Full keyboard support. All action callbacks are stable (they only depend
  // on `dispatch` / refs), so this listener registers once.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { key } = event;

      if (event.metaKey || event.ctrlKey) {
        if (key === "z" || key === "Z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        } else if (key === "y" || key === "Y") {
          event.preventDefault();
          redo();
        }
        return;
      }
      if (event.altKey) return;

      // While a slide-out panel (History/Settings/About) is open, let it own
      // the keyboard — otherwise Escape would both close the panel *and*
      // clear the calculator's current expression underneath it.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (target && target.tagName === "BUTTON" && (key === "Enter" || key === " ")) {
        return;
      }

      // In converter mode the calculator keypad is hidden; let the converter
      // own its own inputs rather than mutating a hidden expression.
      if (modeRef.current === "converter") {
        return;
      }

      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        inputDigit(key);
      } else if (key === ".") {
        event.preventDefault();
        inputDecimal();
      } else if (key === "+") {
        event.preventDefault();
        inputOperator("+");
      } else if (key === "-" || key === "_") {
        event.preventDefault();
        inputOperator("-");
      } else if (key === "*") {
        event.preventDefault();
        inputOperator("*");
      } else if (key === "/") {
        event.preventDefault();
        inputOperator("/");
      } else if (key === "%") {
        event.preventDefault();
        inputPercent();
      } else if (key === "(") {
        event.preventDefault();
        inputParen(true);
      } else if (key === ")") {
        event.preventDefault();
        inputParen(false);
      } else if (key === "^") {
        event.preventDefault();
        inputPower();
      } else if (key === "!") {
        event.preventDefault();
        inputFactorial();
      } else if (key === "Enter" || key === "=") {
        event.preventDefault();
        evaluate();
      } else if (key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (key === "Escape") {
        event.preventDefault();
        allClear();
      } else if (key === "c" || key === "C") {
        event.preventDefault();
        clear();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    inputDigit,
    inputDecimal,
    inputOperator,
    inputPercent,
    inputParen,
    inputPower,
    inputFactorial,
    evaluate,
    backspace,
    clear,
    allClear,
    undo,
    redo,
  ]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const preview = useMemo<string>(() => {
    if (present.error || present.isEvaluated) return "";
    return computePreview(present.expression, angleMode) ?? "";
  }, [present.expression, present.error, present.isEvaluated, angleMode]);

  const displayExpression = useMemo<string>(
    () => formatExpressionForDisplay(present.expression),
    [present.expression],
  );

  const result = useMemo<string>(() => {
    if (present.error) return "0";
    if (present.isEvaluated) return present.committedResult;
    return preview || lastNumberSegment(present.expression) || "0";
  }, [
    present.error,
    present.isEvaluated,
    present.committedResult,
    preview,
    present.expression,
  ]);

  return {
    expression: present.expression,
    displayExpression,
    result,
    preview,
    error: present.error,
    isEvaluated: present.isEvaluated,
    copied,
    mode,
    angleMode,
    memory,
    hasMemory,
    canUndo: reducerState.undo.length > 0,
    canRedo: reducerState.redo.length > 0,
    lastEvaluation,
    inputDigit,
    inputDecimal,
    inputOperator,
    inputPercent,
    backspace,
    clear,
    allClear,
    evaluate,
    copyResult,
    setMode,
    toggleAngleMode,
    inputFunction,
    inputConstant,
    inputParen,
    inputPower,
    inputFactorial,
    memoryAdd,
    memorySubtract,
    memoryRecall,
    memoryClear,
    undo,
    redo,
    loadResult,
  };
}
