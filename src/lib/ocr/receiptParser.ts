/**
 * Receipt Reading — turns a provider's raw recognized text (whatever
 * `OCRProvider.recognize({ mode: "receipt" })` returns, currently always
 * a thrown `not_configured` from `NoopOCRProvider`, since no vendor is
 * connected — see `README.md`) into structured receipt fields.
 *
 * Deliberately kept as pure, provider-agnostic, network-free string
 * parsing — the same "structuring is a separate layer from recognition"
 * split `src/app/api/ai/calculate/route.ts` already uses (the AI names
 * an expression, `evaluateExpression` — not the AI — computes the real
 * number). Here, a future OCR provider only ever needs to produce text;
 * this file is the one place that turns receipt-shaped text into
 * `merchant`/`date`/`items`/`subtotal`/`tax`/`total`, so a provider swap
 * never requires touching this parsing logic, and this parsing logic can
 * be exercised/tested with plain strings, no image or network involved.
 *
 * The heuristics below are intentionally conservative: every field is
 * optional, and a line that doesn't clearly match a pattern is simply
 * left out rather than guessed at — a receipt reader that fabricates a
 * total is worse than one that reports it couldn't find one.
 */

export interface ReceiptLineItem {
  description: string;
  amount: number;
}

export interface ReceiptParseResult {
  merchant?: string;
  date?: string;
  items: ReceiptLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  /** Currency symbol/code spotted near amounts, e.g. `"$"`, `"USD"`. Best-effort. */
  currency?: string;
}

const CURRENCY_SYMBOLS = ["$", "€", "£", "₹", "₨", "¥"];

/** Matches a trailing money amount at the end of a line, e.g. "Coffee 4.50" or "Total: $12.99". */
const TRAILING_AMOUNT_PATTERN = /([$€£₹₨¥]?)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2}))\s*$/;

const TOTAL_LINE_PATTERN = /^\s*(grand\s*total|total\s*due|total|amount\s*due)\b/i;
const SUBTOTAL_LINE_PATTERN = /^\s*sub[\s-]?total\b/i;
const TAX_LINE_PATTERN = /^\s*(tax|vat|gst|hst)\b/i;
const DATE_PATTERN =
  /\b(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}|\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i;

/** Parses a locale-ish amount string ("1,234.56" or "1.234,56" or "12.99") into a number. Returns `undefined` if unparsable. */
function parseAmount(raw: string): number | undefined {
  let normalized = raw.trim();
  // "1.234,56" (comma as decimal separator) -> "1234.56"
  if (/\d,\d{2}$/.test(normalized) && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function detectCurrency(text: string): string | undefined {
  for (const symbol of CURRENCY_SYMBOLS) {
    if (text.includes(symbol)) return symbol;
  }
  const codeMatch = text.match(/\b(USD|EUR|GBP|PKR|INR|CAD|AUD|JPY)\b/);
  return codeMatch?.[1];
}

/**
 * Parses raw OCR text (as recognized from a receipt photo) into
 * structured fields. Never throws — worst case, every field is left
 * `undefined`/empty and the caller still has the original `rawText` to
 * fall back on (see `ocrService.ts`'s `RecognizeReceiptResult`).
 */
export function parseReceiptText(rawText: string): ReceiptParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result: ReceiptParseResult = { items: [] };
  result.currency = detectCurrency(rawText);

  const dateMatch = rawText.match(DATE_PATTERN);
  if (dateMatch) result.date = dateMatch[0];

  // The merchant name is conventionally the first non-empty line that
  // isn't itself a date/amount — most receipts print the store name at
  // the very top, before any address or transaction details.
  for (const line of lines) {
    if (DATE_PATTERN.test(line) || TRAILING_AMOUNT_PATTERN.test(line)) continue;
    result.merchant = line;
    break;
  }

  for (const line of lines) {
    const amountMatch = line.match(TRAILING_AMOUNT_PATTERN);
    if (!amountMatch) continue;

    const amount = parseAmount(amountMatch[2]);
    if (amount === undefined) continue;

    if (TOTAL_LINE_PATTERN.test(line)) {
      result.total = amount;
    } else if (SUBTOTAL_LINE_PATTERN.test(line)) {
      result.subtotal = amount;
    } else if (TAX_LINE_PATTERN.test(line)) {
      result.tax = amount;
    } else {
      const description = line.slice(0, amountMatch.index).trim().replace(/[.\-\s]+$/, "");
      if (description.length > 0) {
        result.items.push({ description, amount });
      }
    }
  }

  return result;
}
