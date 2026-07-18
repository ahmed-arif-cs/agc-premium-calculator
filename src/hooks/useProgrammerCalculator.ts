"use client";

import { useCallback, useMemo, useState } from "react";
import {
  applyArithmetic,
  applyBitwiseBinary,
  applyNot,
  convertBitWidth,
  formatInBase,
  isValidForBase,
  parseInBase,
  toBinaryString,
  toggleBit as toggleBitAt,
  wrapToBitWidth,
  type ArithmeticOp,
  type BitWidth,
  type BitwiseBinaryOp,
  type NumBase,
} from "@/lib/programmerCalculator";

type PendingOp = BitwiseBinaryOp | ArithmeticOp;

export interface UseProgrammerCalculatorReturn {
  base: NumBase;
  bitWidth: BitWidth;
  buffer: string;
  value: bigint;
  pendingOp: PendingOp | null;
  error: string | null;
  binaryString: string;
  displayAllBases: Record<NumBase, string>;
  setBase: (base: NumBase) => void;
  setBitWidth: (width: BitWidth) => void;
  inputDigit: (digit: string) => void;
  backspace: () => void;
  allClear: () => void;
  toggleBit: (index: number) => void;
  negate: () => void;
  setPendingOp: (op: PendingOp) => void;
  applyUnaryNot: () => void;
  equals: () => void;
}

export function useProgrammerCalculator(): UseProgrammerCalculatorReturn {
  const [base, setBaseState] = useState<NumBase>("DEC");
  const [bitWidth, setBitWidthState] = useState<BitWidth>(32);
  const [buffer, setBuffer] = useState<string>("0");
  const [value, setValue] = useState<bigint>(0n);
  const [pendingOp, setPendingOpState] = useState<PendingOp | null>(null);
  const [pendingValue, setPendingValue] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freshEntry, setFreshEntry] = useState<boolean>(true);

  const commitBuffer = useCallback(
    (text: string, forBase: NumBase, width: BitWidth): bigint => {
      try {
        const parsed = parseInBase(text, forBase, width);
        setError(null);
        return parsed;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid value");
        return 0n;
      }
    },
    [],
  );

  const setBase = useCallback(
    (next: NumBase) => {
      const current = commitBuffer(buffer, base, bitWidth);
      setValue(current);
      setBaseState(next);
      setBuffer(formatInBase(current, next, bitWidth));
      setFreshEntry(true);
    },
    [buffer, base, bitWidth, commitBuffer],
  );

  const setBitWidth = useCallback(
    (next: BitWidth) => {
      const current = commitBuffer(buffer, base, bitWidth);
      const converted = convertBitWidth(current, bitWidth, next);
      setBitWidthState(next);
      setValue(converted);
      setBuffer(formatInBase(converted, base, next));
      setFreshEntry(true);
    },
    [buffer, base, bitWidth, commitBuffer],
  );

  const inputDigit = useCallback(
    (digit: string) => {
      setError(null);
      setBuffer((prev) => {
        const base10 = freshEntry ? "" : prev === "0" ? "" : prev;
        const next = base10 + digit;
        if (!isValidForBase(digit === "-" ? "" : digit, base) && digit !== "-") return prev;
        return next === "" ? "0" : next;
      });
      setFreshEntry(false);
    },
    [base, freshEntry],
  );

  const backspace = useCallback(() => {
    setBuffer((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    setFreshEntry(false);
    setError(null);
  }, []);

  const allClear = useCallback(() => {
    setBuffer("0");
    setValue(0n);
    setPendingOpState(null);
    setPendingValue(null);
    setError(null);
    setFreshEntry(true);
  }, []);

  const toggleBit = useCallback(
    (index: number) => {
      const current = commitBuffer(buffer, base, bitWidth);
      const toggled = toggleBitAt(current, index, bitWidth);
      setValue(toggled);
      setBuffer(formatInBase(toggled, base, bitWidth));
      setFreshEntry(true);
    },
    [buffer, base, bitWidth, commitBuffer],
  );

  const negate = useCallback(() => {
    if (base !== "DEC") return;
    setBuffer((prev) => (prev.startsWith("-") ? prev.slice(1) : prev === "0" ? "0" : `-${prev}`));
    setFreshEntry(false);
  }, [base]);

  const setPendingOp = useCallback(
    (op: PendingOp) => {
      const current = commitBuffer(buffer, base, bitWidth);
      setValue(current);
      setPendingValue(current);
      setPendingOpState(op);
      setFreshEntry(true);
    },
    [buffer, base, bitWidth, commitBuffer],
  );

  const applyUnaryNot = useCallback(() => {
    const current = commitBuffer(buffer, base, bitWidth);
    const result = applyNot(current, bitWidth);
    setValue(result);
    setBuffer(formatInBase(result, base, bitWidth));
    setFreshEntry(true);
  }, [buffer, base, bitWidth, commitBuffer]);

  const equals = useCallback(() => {
    if (pendingOp === null || pendingValue === null) return;
    const current = commitBuffer(buffer, base, bitWidth);
    try {
      const isArithmetic = ["+", "-", "*", "/", "%"].includes(pendingOp);
      const result = isArithmetic
        ? applyArithmetic(pendingValue, current, pendingOp as ArithmeticOp, bitWidth)
        : applyBitwiseBinary(pendingValue, current, pendingOp as BitwiseBinaryOp, bitWidth);
      setValue(result);
      setBuffer(formatInBase(result, base, bitWidth));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
    setPendingOpState(null);
    setPendingValue(null);
    setFreshEntry(true);
  }, [buffer, base, bitWidth, pendingOp, pendingValue, commitBuffer]);

  const liveValue = useMemo(
    () => (error ? value : commitBuffer(buffer, base, bitWidth)),
    [buffer, base, bitWidth, error, value, commitBuffer],
  );

  const binaryString = useMemo(() => toBinaryString(liveValue, bitWidth), [liveValue, bitWidth]);

  const displayAllBases = useMemo<Record<NumBase, string>>(
    () => ({
      BIN: formatInBase(liveValue, "BIN", bitWidth),
      OCT: formatInBase(liveValue, "OCT", bitWidth),
      DEC: formatInBase(liveValue, "DEC", bitWidth),
      HEX: formatInBase(liveValue, "HEX", bitWidth),
    }),
    [liveValue, bitWidth],
  );

  return {
    base,
    bitWidth,
    buffer,
    value: liveValue,
    pendingOp,
    error,
    binaryString,
    displayAllBases,
    setBase,
    setBitWidth,
    inputDigit,
    backspace,
    allClear,
    toggleBit,
    negate,
    setPendingOp,
    applyUnaryNot,
    equals,
  };
}