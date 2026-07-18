"use client";

import { Delete, RotateCcw } from "lucide-react";
import { useClickSound } from "@/hooks/useSettings";
import { useProgrammerCalculator } from "@/hooks/useProgrammerCalculator";
import type { BitWidth, NumBase } from "@/lib/programmerCalculator";

const BASES: NumBase[] = ["BIN", "OCT", "DEC", "HEX"];
const WIDTHS: BitWidth[] = [8, 16, 32, 64];
const HEX_DIGITS = ["A", "B", "C", "D", "E", "F"];
const DIGIT_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["0", "00", "."],
];

const BITWISE_OPS = [
  { op: "AND", label: "AND" },
  { op: "OR", label: "OR" },
  { op: "XOR", label: "XOR" },
  { op: "NAND", label: "NAND" },
  { op: "NOR", label: "NOR" },
  { op: "LSH", label: "<<" },
  { op: "RSH", label: ">>" },
  { op: "URSH", label: ">>>" },
] as const;

const ARITH_OPS = [
  { op: "+", label: "+" },
  { op: "-", label: "−" },
  { op: "*", label: "×" },
  { op: "/", label: "÷" },
  { op: "%", label: "mod" },
] as const;

function isDigitAllowed(digit: string, base: NumBase): boolean {
  if (base === "BIN") return digit === "0" || digit === "1";
  if (base === "OCT") return /^[0-7]$/.test(digit);
  if (base === "DEC") return /^[0-9]$/.test(digit);
  return /^[0-9A-F]$/.test(digit);
}

export function ProgrammerCalculator() {
  const clickSound = useClickSound();
  const calc = useProgrammerCalculator();

  const groupedBits = calc.binaryString.match(/.{1,4}/g) ?? [];

  return (
    <div className="calc-glass programmer-calc">
      {/* Base tabs */}
      <div className="programmer-base-row" role="tablist" aria-label="Number base">
        {BASES.map((b) => (
          <button
            key={b}
            type="button"
            role="tab"
            aria-selected={calc.base === b}
            className={`calc-util-btn programmer-base-tab${calc.base === b ? " programmer-base-tab--active" : ""}`}
            onClick={() => {
              clickSound();
              calc.setBase(b);
            }}
          >
            {b}
          </button>
        ))}
        <div className="programmer-width-group" role="tablist" aria-label="Bit width">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={calc.bitWidth === w}
              className={`calc-util-btn programmer-width-tab${calc.bitWidth === w ? " programmer-width-tab--active" : ""}`}
              onClick={() => {
                clickSound();
                calc.setBitWidth(w);
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-base readout */}
      <div className="programmer-readout">
        {BASES.map((b) => (
          <div
            key={b}
            className={`programmer-readout-row${calc.base === b ? " programmer-readout-row--active" : ""}`}
          >
            <span className="programmer-readout-label">{b}</span>
            <span className="programmer-readout-value">{calc.displayAllBases[b]}</span>
          </div>
        ))}
      </div>

      {calc.error ? <p className="programmer-error">{calc.error}</p> : null}

      {/* Bit grid — click a bit to flip it */}
      <div className="programmer-bit-grid" aria-label="Bit toggles">
        {groupedBits.map((group, groupIdx) => (
          <div key={groupIdx} className="programmer-bit-nibble">
            {group.split("").map((bit, bitIdx) => {
              const stringIndex = groupIdx * 4 + bitIdx;
              const bitIndex = calc.bitWidth - 1 - stringIndex;
              return (
                <button
                  key={bitIndex}
                  type="button"
                  className={`programmer-bit${bit === "1" ? " programmer-bit--on" : ""}`}
                  aria-label={`Bit ${bitIndex}`}
                  onClick={() => {
                    clickSound();
                    calc.toggleBit(bitIndex);
                  }}
                >
                  {bit}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bitwise operator row */}
      <div className="programmer-op-row">
        {BITWISE_OPS.map(({ op, label }) => (
          <button
            key={op}
            type="button"
            className={`calc-btn calc-btn--function programmer-op-btn${calc.pendingOp === op ? " programmer-op-btn--pending" : ""}`}
            onClick={() => {
              clickSound();
              calc.setPendingOp(op);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="calc-btn calc-btn--function programmer-op-btn"
          onClick={() => {
            clickSound();
            calc.applyUnaryNot();
          }}
        >
          NOT
        </button>
      </div>

      {/* Hex digits (only meaningful in HEX base) */}
      <div className="programmer-hex-row">
        {HEX_DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={!isDigitAllowed(d, calc.base)}
            className="calc-btn programmer-hex-btn"
            onClick={() => {
              clickSound();
              calc.inputDigit(d);
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Digit pad + arithmetic + controls */}
      <div className="programmer-pad">
        <div className="programmer-pad-digits">
          {DIGIT_ROWS.flat().map((d) => {
            if (d === ".") {
              return (
                <button
                  key="negate"
                  type="button"
                  disabled={calc.base !== "DEC"}
                  className="calc-btn programmer-pad-btn"
                  onClick={() => {
                    clickSound();
                    calc.negate();
                  }}
                >
                  +/−
                </button>
              );
            }
            if (d === "00") {
              return (
                <button
                  key="00"
                  type="button"
                  className="calc-btn programmer-pad-btn"
                  onClick={() => {
                    clickSound();
                    calc.inputDigit("0");
                    calc.inputDigit("0");
                  }}
                >
                  00
                </button>
              );
            }
            return (
              <button
                key={d}
                type="button"
                disabled={!isDigitAllowed(d, calc.base)}
                className="calc-btn programmer-pad-btn"
                onClick={() => {
                  clickSound();
                  calc.inputDigit(d);
                }}
              >
                {d}
              </button>
            );
          })}
        </div>

        <div className="programmer-pad-controls">
          <button
            type="button"
            className="calc-btn calc-btn--function programmer-pad-btn"
            aria-label="All clear"
            onClick={() => {
              clickSound();
              calc.allClear();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            AC
          </button>
          <button
            type="button"
            className="calc-btn calc-btn--function programmer-pad-btn"
            aria-label="Backspace"
            onClick={() => {
              clickSound();
              calc.backspace();
            }}
          >
            <Delete className="h-4 w-4" />
          </button>
          {ARITH_OPS.map(({ op, label }) => (
            <button
              key={op}
              type="button"
              className={`calc-btn calc-btn--operator programmer-pad-btn${calc.pendingOp === op ? " programmer-op-btn--pending" : ""}`}
              onClick={() => {
                clickSound();
                calc.setPendingOp(op);
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="calc-btn calc-btn--equals programmer-pad-btn programmer-equals"
            onClick={() => {
              clickSound();
              calc.equals();
            }}
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
}
