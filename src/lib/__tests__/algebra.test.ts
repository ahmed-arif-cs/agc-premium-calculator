import { describe, it, expect } from "bun:test";
import { solveEquation } from "@/lib/algebra";
import { CalculatorError } from "@/lib/calculator";

describe("algebra", () => {
  it("solves '2x + 5 = 11' → x = 3", () => {
    expect(solveEquation("2x + 5 = 11").value).toBe(3);
  });

  it("solves 'x - 7 = 0' → x = 7", () => {
    expect(solveEquation("x - 7 = 0").value).toBe(7);
  });

  it("solves '3x = 15' → x = 5", () => {
    expect(solveEquation("3x = 15").value).toBe(5);
  });

  it("solves 'x^2 - 9 = 0' → roots include 3", () => {
    const sol = solveEquation("x^2 - 9 = 0");
    expect(sol.display).toContain("3");
  });

  it("throws 'No solution' for '2x + 1 = 2x + 5'", () => {
    expect(() => solveEquation("2x + 1 = 2x + 5")).toThrow(CalculatorError);
  });
});
