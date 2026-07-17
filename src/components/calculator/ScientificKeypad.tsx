"use client";

import { CalculatorButton } from "./CalculatorButton";
import type { UseCalculatorReturn } from "@/hooks/useCalculator";

interface ScientificKeypadProps {
  calc: UseCalculatorReturn;
}

export function ScientificKeypad({ calc }: ScientificKeypadProps) {
  const { angleMode, toggleAngleMode } = calc;

  return (
    <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
      <CalculatorButton
        variant="function"
        className="col-span-2 !text-base"
        label={angleMode === "deg" ? "DEG" : "RAD"}
        ariaLabel={`Angle mode ${angleMode}, click to toggle`}
        onClick={toggleAngleMode}
      />
      <CalculatorButton variant="function" label="sin" ariaLabel="sine" onClick={() => calc.inputFunction("sin")} />
      <CalculatorButton variant="function" label="cos" ariaLabel="cosine" onClick={() => calc.inputFunction("cos")} />

      <CalculatorButton variant="function" label="tan" ariaLabel="tangent" onClick={() => calc.inputFunction("tan")} />
      <CalculatorButton variant="function" label="√" ariaLabel="square root" onClick={() => calc.inputFunction("sqrt")} />
      <CalculatorButton variant="function" label="xʸ" ariaLabel="power" onClick={calc.inputPower} />
      <CalculatorButton variant="function" label="log" ariaLabel="log base 10" onClick={() => calc.inputFunction("log")} />

      <CalculatorButton variant="function" label="ln" ariaLabel="natural log" onClick={() => calc.inputFunction("ln")} />
      <CalculatorButton variant="function" label="x!" ariaLabel="factorial" onClick={calc.inputFactorial} />
      <CalculatorButton variant="function" label="(" ariaLabel="open parenthesis" onClick={() => calc.inputParen(true)} />
      <CalculatorButton variant="function" label=")" ariaLabel="close parenthesis" onClick={() => calc.inputParen(false)} />

      <CalculatorButton variant="function" className="col-span-2" label="π" ariaLabel="pi" onClick={() => calc.inputConstant("π")} />
      <CalculatorButton variant="function" className="col-span-2" label="e" ariaLabel="euler's number" onClick={() => calc.inputConstant("e")} />
    </div>
  );
}
