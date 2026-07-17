import { NextResponse } from "next/server";
import { OFFLINE_RATES, OFFLINE_RATES_DATE_LABEL } from "@/lib/offlineRates";

/**
 * GET /api/currency
 * Returns exchange rates (base USD) with a 1-hour in-memory cache.
 * Response shape: { base: "USD", date: "2026-07-14", rates: { PKR: 278.4, ... }, source: "primary" }
 *
 * Primary source: open.er-api.com (free, no key, ~160 currencies incl. PKR/INR/BDT/LKR).
 * Fallback source: frankfurter.app (ECB-based, no key, ~30 currencies) in case the
 * primary is ever unreachable, so the converter still works with a smaller list.
 * Offline fallback: a small static table baked into the code (`offlineRates.ts`),
 * used only when *both* live sources fail, so the converter never fully breaks
 * even with zero internet. `source: "offline"` tells the UI to show a clear
 * "offline / approximate rates" badge instead of presenting these as live.
 */

export type RatesSource = "primary" | "fallback" | "offline";

interface RatesResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
  source: RatesSource;
}

interface OpenErApiResponse {
  result: string;
  base_code: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour — for live (primary/fallback) rates
const OFFLINE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes — retry live sources again soon
let cached: { data: RatesResponse; expires: number } | null = null;

async function fetchPrimary(): Promise<RatesResponse> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`open.er-api.com error: ${res.status}`);
  const data: OpenErApiResponse = await res.json();
  if (data.result !== "success" || !data.rates) throw new Error("open.er-api.com bad payload");
  const { USD: _usd, ...rates } = data.rates;
  return {
    base: "USD",
    date: data.time_last_update_utc ?? new Date().toUTCString(),
    rates,
    source: "primary",
  };
}

async function fetchFallback(): Promise<RatesResponse> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`frankfurter error: ${res.status}`);
  const data: FrankfurterResponse = await res.json();
  return { base: data.base, date: data.date, rates: data.rates, source: "fallback" };
}

/**
 * Fully offline last resort: a small static rate table baked into the app.
 * Unlike the two network fetches above, this can never fail — it's what
 * keeps the converter working with zero internet access.
 */
function offlineFallback(): RatesResponse {
  return {
    base: "USD",
    date: OFFLINE_RATES_DATE_LABEL,
    rates: OFFLINE_RATES,
    source: "offline",
  };
}

export async function GET(): Promise<NextResponse<RatesResponse>> {
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  let data: RatesResponse;
  try {
    data = await fetchPrimary();
  } catch {
    try {
      data = await fetchFallback();
    } catch {
      // Both live sources are unreachable — fall back to the baked-in
      // offline table so the converter still works, just clearly labeled.
      data = offlineFallback();
    }
  }

  cached = {
    data,
    expires: Date.now() + (data.source === "offline" ? OFFLINE_CACHE_TTL : CACHE_TTL),
  };
  return NextResponse.json(data, {
    headers: {
      "Cache-Control":
        data.source === "offline" ? "public, max-age=300" : "public, max-age=3600",
    },
  });
}
