import { describe, it, expect } from "bun:test";
import { parseNaturalInput, looksLikeEquation } from "@/lib/nlp";

describe("nlp", () => {
  it("computes 'X% of Y'", () => {
    expect(parseNaturalInput("25% of 400").result).toBe("100");
  });

  it("computes 'X% off Y'", () => {
    expect(parseNaturalInput("10% off 50").result).toBe("45");
  });

  it("handles word operators (plus)", () => {
    expect(parseNaturalInput("12 plus 8").result).toBe("20");
  });

  it("handles 'sqrt of X'", () => {
    expect(parseNaturalInput("sqrt of 16").result).toBe("4");
  });

  it("returns the cleaned expression alongside the result", () => {
    const parsed = parseNaturalInput("12 plus 8");
    expect(parsed.expression).toBe("12+8");
    expect(parsed.result).toBe("20");
  });

  it("detects equations via looksLikeEquation", () => {
    expect(looksLikeEquation("2x + 5 = 11")).toBe(true);
    expect(looksLikeEquation("2 + 2 = 4")).toBe(false);
    expect(looksLikeEquation("sin(x) = 1")).toBe(true);
  });
});
