"use client";

import { Delete as BackspaceIcon } from "lucide-react";
import { CalculatorButton } from "./CalculatorButton";
import type { UseCalculatorReturn } from "@/hooks/useCalculator";

interface KeypadProps {
  calc: UseCalculatorReturn;
}

export function Keypad({ calc }: KeypadProps) {
  const {
    inputDigit,
    inputDecimal,
    inputOperator,
    inputPercent,
    backspace,
    clear,
    allClear,
    evaluate,
  } = calc;

  return (
    <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
      <CalculatorButton variant="function" label="AC" ariaLabel="All clear" onClick={allClear} />
      <CalculatorButton variant="function" label="C" ariaLabel="Clear entry" onClick={clear} />
      <CalculatorButton
        variant="function"
        label={<BackspaceIcon className="h-5 w-5" />}
        ariaLabel="Backspace"
        onClick={backspace}
      />
      <CalculatorButton
        variant="operator"
        label="÷"
        ariaLabel="Divide"
        onClick={() => inputOperator("/")}
      />

      <CalculatorButton label="7" ariaLabel="Digit 7" onClick={() => inputDigit("7")} />
      <CalculatorButton label="8" ariaLabel="Digit 8" onClick={() => inputDigit("8")} />
      <CalculatorButton label="9" ariaLabel="Digit 9" onClick={() => inputDigit("9")} />
      <CalculatorButton
        variant="operator"
        label="×"
        ariaLabel="Multiply"
        onClick={() => inputOperator("*")}
      />

      <CalculatorButton label="4" ariaLabel="Digit 4" onClick={() => inputDigit("4")} />
      <CalculatorButton label="5" ariaLabel="Digit 5" onClick={() => inputDigit("5")} />
      <CalculatorButton label="6" ariaLabel="Digit 6" onClick={() => inputDigit("6")} />
      <CalculatorButton
        variant="operator"
        label="−"
        ariaLabel="Subtract"
        onClick={() => inputOperator("-")}
      />

      <CalculatorButton label="1" ariaLabel="Digit 1" onClick={() => inputDigit("1")} />
      <CalculatorButton label="2" ariaLabel="Digit 2" onClick={() => inputDigit("2")} />
      <CalculatorButton label="3" ariaLabel="Digit 3" onClick={() => inputDigit("3")} />
      <CalculatorButton
        variant="operator"
        label="+"
        ariaLabel="Add"
        onClick={() => inputOperator("+")}
      />

      <CalculatorButton variant="function" label="%" ariaLabel="Percent" onClick={inputPercent} />
      <CalculatorButton label="0" ariaLabel="Digit 0" onClick={() => inputDigit("0")} />
      <CalculatorButton label="." ariaLabel="Decimal point" onClick={inputDecimal} />
      <CalculatorButton variant="equals" label="=" ariaLabel="Equals" onClick={evaluate} />
    </div>
  );
}
