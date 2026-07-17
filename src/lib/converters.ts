/**
 * Unit converter logic for the AGC Premium Calculator.
 *
 * Pure TypeScript — no React, no DOM. Length and weight use linear factors
 * to a base unit (meters / grams); temperature is handled with explicit
 * C/F/K formulas because the conversions are affine (not linear).
 */
import { CalculatorError, formatResult } from "@/lib/calculator";

export type ConverterCategory = "length" | "weight" | "temperature";

export interface Unit {
  id: string;
  label: string;
  symbol: string;
}

export interface CategoryDef {
  id: ConverterCategory;
  label: string;
  units: Unit[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "length",
    label: "Length",
    units: [
      { id: "millimeter", label: "Millimeter", symbol: "mm" },
      { id: "centimeter", label: "Centimeter", symbol: "cm" },
      { id: "meter", label: "Meter", symbol: "m" },
      { id: "kilometer", label: "Kilometer", symbol: "km" },
      { id: "inch", label: "Inch", symbol: "in" },
      { id: "foot", label: "Foot", symbol: "ft" },
      { id: "yard", label: "Yard", symbol: "yd" },
      { id: "mile", label: "Mile", symbol: "mi" },
    ],
  },
  {
    id: "weight",
    label: "Weight",
    units: [
      { id: "milligram", label: "Milligram", symbol: "mg" },
      { id: "gram", label: "Gram", symbol: "g" },
      { id: "kilogram", label: "Kilogram", symbol: "kg" },
      { id: "metric_ton", label: "Metric ton", symbol: "t" },
      { id: "ounce", label: "Ounce", symbol: "oz" },
      { id: "pound", label: "Pound", symbol: "lb" },
    ],
  },
  {
    id: "temperature",
    label: "Temperature",
    units: [
      { id: "celsius", label: "Celsius", symbol: "°C" },
      { id: "fahrenheit", label: "Fahrenheit", symbol: "°F" },
      { id: "kelvin", label: "Kelvin", symbol: "K" },
    ],
  },
];

/** Factor to the base unit (meters) for each length unit id. */
const LENGTH_FACTORS: Record<string, number> = {
  millimeter: 0.001,
  centimeter: 0.01,
  meter: 1,
  kilometer: 1000,
  inch: 0.0254,
  foot: 0.3048,
  yard: 0.9144,
  mile: 1609.344,
};

/** Factor to the base unit (grams) for each weight unit id. */
const WEIGHT_FACTORS: Record<string, number> = {
  milligram: 0.001,
  gram: 1,
  kilogram: 1000,
  metric_ton: 1_000_000,
  ounce: 28.349523125,
  pound: 453.59237,
};

/** Convert a temperature value to Kelvin. */
function tempToKelvin(fromId: string, value: number): number {
  switch (fromId) {
    case "celsius":
      return value + 273.15;
    case "fahrenheit":
      return ((value - 32) * 5) / 9 + 273.15;
    case "kelvin":
      return value;
    default:
      throw new CalculatorError("Unknown temperature unit");
  }
}

/** Convert a Kelvin value to the target temperature unit. */
function tempFromKelvin(toId: string, kelvin: number): number {
  switch (toId) {
    case "celsius":
      return kelvin - 273.15;
    case "fahrenheit":
      return ((kelvin - 273.15) * 9) / 5 + 32;
    case "kelvin":
      return kelvin;
    default:
      throw new CalculatorError("Unknown temperature unit");
  }
}

/**
 * Convert `value` from one unit to another within a category.
 * Throws CalculatorError on invalid ids or non-finite values.
 */
export function convertUnit(
  category: ConverterCategory,
  fromId: string,
  toId: string,
  value: number,
): number {
  if (!Number.isFinite(value)) {
    throw new CalculatorError("Value is not finite");
  }

  if (category === "temperature") {
    const kelvin = tempToKelvin(fromId, value);
    return tempFromKelvin(toId, kelvin);
  }

  const factors = category === "length" ? LENGTH_FACTORS : WEIGHT_FACTORS;
  const fromFactor = factors[fromId];
  const toFactor = factors[toId];
  if (fromFactor === undefined || toFactor === undefined) {
    throw new CalculatorError("Unknown unit id");
  }

  const base = value * fromFactor;
  return base / toFactor;
}

/**
 * Currencies conventionally shown with 0 decimal places (JPY/KRW-style) —
 * i.e. their smallest common denomination doesn't fit naturally into 2dp.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", "KRW", "VND", "IDR", "CLP", "ISK", "HUF", "TWD", "PYG", "UGX",
  "RWF", "GNF", "BIF", "DJF", "VUV", "XAF", "XOF", "XPF", "KMF", "MGA",
  "LAK", "MMK", "SLL",
]);

/** Add locale-aware thousand separators to an already-cleaned numeric string. */
function addThousandSeparators(numericText: string): string {
  const [intPart, fracPart] = numericText.split(".");
  const withSeparators = Number(intPart).toLocaleString("en-US");
  return fracPart !== undefined ? `${withSeparators}.${fracPart}` : withSeparators;
}

/**
 * Format a converted value for display, reusing the engine's `formatResult`
 * for float-artifact cleanup (e.g. 12.000000004 -> 12) and adding
 * locale-aware thousand separators.
 *
 * Pass a 3-letter `currencyCode` (e.g. "PKR") to additionally cap decimal
 * places sensibly for that currency — 0dp for JPY/KRW-style currencies,
 * 2dp for most others — instead of the generic significant-digit rounding
 * used for plain unit conversions.
 */
export function formatConverted(value: number, currencyCode?: string): string {
  if (!Number.isFinite(value)) {
    throw new CalculatorError("Value is not finite");
  }
  if (value === 0) return "0";

  if (currencyCode) {
    const abs = Math.abs(value);
    // Extremely large/small magnitudes still fall back to exponential form,
    // same threshold as formatResult, rather than a misleading fixed count.
    if (abs >= 1e16 || abs < 1e-9) {
      return formatResult(value);
    }
    const decimals = ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase()) ? 0 : 2;
    // Round through toPrecision first to avoid float noise (e.g. 12.000000004)
    // before fixing the currency's decimal places.
    const cleaned = Number(value.toPrecision(12));
    return cleaned.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const text = formatResult(value);
  if (/e/i.test(text)) return text; // leave exponential notation untouched
  return addThousandSeparators(text);
}
