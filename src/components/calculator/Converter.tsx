"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  convertUnit,
  formatConverted,
  type ConverterCategory,
} from "@/lib/converters";
import { CalculatorError } from "@/lib/calculator";
import { CurrencySelect } from "./CurrencySelect";

type SubMode = "currency" | "unit";

interface CurrencyRates {
  base: string;
  date: string;
  rates: Record<string, number>;
  source?: "primary" | "fallback" | "offline";
}

export function Converter() {
  const [subMode, setSubMode] = useState<SubMode>("currency");

  return (
    <div className="calc-converter">
      <div className="calc-cat" role="tablist" aria-label="Converter mode">
        <button
          type="button"
          role="tab"
          aria-selected={subMode === "currency"}
          aria-label="Currency converter"
          className={cn("calc-cat-btn", subMode === "currency" && "calc-cat-btn--active")}
          onClick={() => setSubMode("currency")}
        >
          Currency
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subMode === "unit"}
          aria-label="Unit converter"
          className={cn("calc-cat-btn", subMode === "unit" && "calc-cat-btn--active")}
          onClick={() => setSubMode("unit")}
        >
          Units
        </button>
      </div>

      {subMode === "currency" ? <CurrencyConverter /> : <UnitConverter />}
    </div>
  );
}

function CurrencyConverter() {
  const [rates, setRates] = useState<CurrencyRates | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("1");
  const [from, setFrom] = useState<string>("USD");
  const [to, setTo] = useState<string>("PKR");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/currency")
      .then((res) => res.json())
      .then((data: CurrencyRates | { error: string }) => {
        if (cancelled) return;
        if ("error" in data) {
          setLoadError("Rates unavailable");
          return;
        }
        setRates(data);
        const codes = Object.keys(data.rates);
        if (!codes.includes(to) && to !== "USD") setTo(codes.includes("PKR") ? "PKR" : codes[0] ?? "EUR");
        if (!codes.includes(from) && from !== "USD") setFrom("USD");
      })
      .catch(() => {
        if (!cancelled) setLoadError("Rates unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currencyCodes = useMemo<string[]>(() => {
    if (!rates) return ["USD"];
    return ["USD", ...Object.keys(rates.rates)].sort();
  }, [rates]);

  const result = useMemo<string>(() => {
    if (!rates) return "";
    const amt = Number.parseFloat(amount);
    if (!Number.isFinite(amt)) return "";
    const allRates: Record<string, number> = { USD: 1, ...rates.rates };
    const fromRate = allRates[from];
    const toRate = allRates[to];
    if (!fromRate || !toRate) return "";
    const value = (amt / fromRate) * toRate;
    if (!Number.isFinite(value)) return "";
    return formatConverted(value, to);
  }, [rates, amount, from, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  if (loadError) {
    return <div className="calc-conv-loading">{loadError}. Please try again later.</div>;
  }

  return (
    <>
      <div>
        <label className="t-muted mb-1 block text-[11px] uppercase tracking-wider">From</label>
        <div className="calc-conv-row">
          <input
            className="calc-amount"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount to convert"
          />
          <button type="button" className="calc-swap" onClick={swap} aria-label="Swap currencies">
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <CurrencySelect
            codes={currencyCodes}
            value={from}
            onChange={setFrom}
            label="Source currency"
            disabled={!rates}
          />
        </div>
      </div>

      <div>
        <label className="t-muted mb-1 block text-[11px] uppercase tracking-wider">To</label>
        <CurrencySelect
          codes={currencyCodes}
          value={to}
          onChange={setTo}
          label="Target currency"
          disabled={!rates}
        />
      </div>

      <div className="calc-conv-result">
        <div className="calc-conv-value">{result || "—"}</div>
        <div className="calc-conv-meta">
          {rates
            ? rates.source === "offline"
              ? `${amount || "0"} ${from} = ${result || "—"} ${to} · offline estimate`
              : `${amount || "0"} ${from} = ${result || "—"} ${to} · rates ${rates.date}`
            : "Fetching live rates…"}
        </div>
        {rates?.source === "offline" && (
          <div className="calc-offline-badge" title="Live rates are unavailable — showing baked-in approximate rates that may be outdated.">
            <WifiOff className="h-3 w-3" />
            Offline / approximate rates
          </div>
        )}
      </div>
    </>
  );
}

function UnitConverter() {
  const [category, setCategory] = useState<ConverterCategory>("length");
  const [value, setValue] = useState<string>("1");
  const [from, setFrom] = useState<string>("m");
  const [to, setTo] = useState<string>("cm");

  const catDef = useMemo(
    () => CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0],
    [category],
  );

  const selectCategory = (next: ConverterCategory) => {
    setCategory(next);
    const def = CATEGORIES.find((c) => c.id === next) ?? CATEGORIES[0];
    setFrom(def.units[0].id);
    setTo(def.units[1].id);
  };

  const result = useMemo<string>(() => {
    const v = Number.parseFloat(value);
    if (!Number.isFinite(v)) return "";
    try {
      return formatConverted(convertUnit(category, from, to, v));
    } catch (err) {
      if (err instanceof CalculatorError) return "";
      return "";
    }
  }, [value, from, to, category]);

  const swap = () => {
    setFrom(to);
    setTo(from);
    // `result` is a locale-formatted display string (may contain thousand
    // separators) — strip them back out so it re-parses correctly as a number.
    if (result) setValue(result.replace(/,/g, ""));
  };

  const fromUnit = catDef.units.find((u) => u.id === from);
  const toUnit = catDef.units.find((u) => u.id === to);

  return (
    <>
      <div className="calc-cat" role="tablist" aria-label="Unit category">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            aria-label={`${c.label} units`}
            className={cn("calc-cat-btn", category === c.id && "calc-cat-btn--active")}
            onClick={() => selectCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="calc-conv-row">
        <input
          className="calc-amount"
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Value to convert"
        />
        <button type="button" className="calc-swap" onClick={swap} aria-label="Swap units">
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <select
          className="calc-select"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Target unit"
        >
          {catDef.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label} ({u.symbol})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="t-muted mb-1 block text-[11px] uppercase tracking-wider">From</label>
        <select
          className="calc-select"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Source unit"
        >
          {catDef.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label} ({u.symbol})
            </option>
          ))}
        </select>
      </div>

      <div className="calc-conv-result">
        <div className="calc-conv-value">{result || "—"}</div>
        <div className="calc-conv-meta">
          {value || "0"} {fromUnit?.symbol} = {result || "—"} {toUnit?.symbol}
        </div>
      </div>
    </>
  );
}
