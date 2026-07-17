import { describe, it, expect } from "bun:test";
import { convertUnit } from "@/lib/converters";

describe("converters", () => {
  describe("length", () => {
    it("converts millimeters to meters", () => {
      expect(convertUnit("length", "millimeter", "meter", 1000)).toBe(1);
    });

    it("converts meters to centimeters", () => {
      expect(convertUnit("length", "meter", "centimeter", 1)).toBe(100);
    });

    it("converts miles to meters", () => {
      expect(convertUnit("length", "mile", "meter", 1)).toBeCloseTo(1609.344);
    });

    it("converts inches to centimeters", () => {
      expect(convertUnit("length", "inch", "centimeter", 1)).toBe(2.54);
    });
  });

  describe("weight", () => {
    it("converts grams to kilograms", () => {
      expect(convertUnit("weight", "gram", "kilogram", 1000)).toBe(1);
    });

    it("converts kilograms to milligrams", () => {
      expect(convertUnit("weight", "kilogram", "milligram", 1)).toBe(1_000_000);
    });

    it("converts pounds to kilograms", () => {
      expect(convertUnit("weight", "pound", "kilogram", 1)).toBeCloseTo(0.453592);
    });
  });

  describe("temperature", () => {
    it("converts 0°C to 32°F (freezing point of water)", () => {
      expect(convertUnit("temperature", "celsius", "fahrenheit", 0)).toBe(32);
    });

    it("converts 100°C to 212°F (boiling point of water)", () => {
      expect(convertUnit("temperature", "celsius", "fahrenheit", 100)).toBe(212);
    });

    it("converts 0°C to 273.15 K", () => {
      expect(convertUnit("temperature", "celsius", "kelvin", 0)).toBeCloseTo(273.15);
    });

    it("converts 25°C to 77°F (room temperature)", () => {
      expect(convertUnit("temperature", "celsius", "fahrenheit", 25)).toBe(77);
    });
  });
});
