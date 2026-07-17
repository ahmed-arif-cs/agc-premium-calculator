import { describe, it, expect } from "bun:test";
import { evaluateExpression, formatResult, CalculatorError } from "@/lib/calculator";

describe("calculator engine", () => {
  it("adds two numbers", () => {
    expect(evaluateExpression("2+3")).toBe(5);
  });

  it("subtracts two numbers", () => {
    expect(evaluateExpression("10-4")).toBe(6);
  });

  it("multiplies two numbers", () => {
    expect(evaluateExpression("6*7")).toBe(42);
  });

  it("divides two numbers", () => {
    expect(evaluateExpression("20/4")).toBe(5);
  });

  it("respects operator precedence", () => {
    expect(evaluateExpression("2+3*4")).toBe(14);
  });

  it("respects parentheses", () => {
    expect(evaluateExpression("(2+3)*4")).toBe(20);
  });

  it("computes powers", () => {
    expect(evaluateExpression("2^3")).toBe(8);
  });

  it("computes factorials", () => {
    expect(evaluateExpression("5!")).toBe(120);
  });

  it("computes percentages", () => {
    expect(evaluateExpression("50%")).toBe(0.5);
  });

  it("throws CalculatorError on divide by zero", () => {
    expect(() => evaluateExpression("5/0")).toThrow(CalculatorError);
  });

  it("computes sqrt", () => {
    expect(evaluateExpression("sqrt(16)")).toBe(4);
  });

  it("supports the π constant", () => {
    expect(evaluateExpression("π")).toBeGreaterThan(3);
  });

  it("handles floating-point decimals correctly", () => {
    expect(evaluateExpression("0.1+0.2")).toBeCloseTo(0.3);
  });

  it("formats results cleanly", () => {
    expect(formatResult(0.1 + 0.2)).toBe("0.3");
  });
});
