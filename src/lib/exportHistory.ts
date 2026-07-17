"use client";

import { formatExpressionForDisplay } from "@/lib/calculator";
import type { HistoryItem } from "@/hooks/useHistory";
import type { Paragraph as DocxParagraph, Table as DocxTable, TableRow as DocxTableRow } from "docx";

/** Shared brand metadata stamped onto every exported file format. */
const BRAND = {
  app: "AGC Premium Calculator",
  company: "Ahmed Group of Companies",
  tagline: "Building Digital Excellence",
} as const;

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function historyRows(items: HistoryItem[]): { expression: string; result: string; label: string; timestamp: string }[] {
  return items.map((item) => ({
    expression: formatExpressionForDisplay(item.expression) || item.result,
    result: item.result,
    label: item.label,
    timestamp: new Date(item.timestamp).toISOString(),
  }));
}

export function exportHistoryCsv(items: HistoryItem[]): void {
  // Company metadata block, rendered as plain comment-style rows ahead of
  // the real header/data so the file is recognizably AGC-branded even when
  // opened as raw text — spreadsheet apps happily ignore the short-row
  // padding and the header row is unambiguous once reached.
  const metaLines: string[][] = [
    [BRAND.app],
    [`${BRAND.company} — ${BRAND.tagline}`],
    [`Exported: ${new Date().toLocaleString()}`],
    [`Total Records: ${items.length}`],
    [],
  ];
  const header = ["Expression", "Result", "Label", "Timestamp"];
  const rows = historyRows(items).map((r) => [r.expression, r.result, r.label, r.timestamp]);
  const csv = [...metaLines, header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  download("agc-calculator-history.csv", blob);
}

/** Plain-text export — one calculation per block, human-readable. */
export function exportHistoryTxt(items: HistoryItem[]): void {
  const lines: string[] = [
    `${BRAND.app.toUpperCase()} — Calculation History`,
    `${BRAND.company} · ${BRAND.tagline}`,
    `Exported ${new Date().toLocaleString()}`,
    `Total Records: ${items.length}`,
    "=".repeat(48),
    "",
  ];
  if (items.length === 0) {
    lines.push("No calculations recorded.");
  } else {
    historyRows(items).forEach((r, idx) => {
      if (r.label) lines.push(`[${r.label}]`);
      lines.push(`${idx + 1}. ${r.expression} = ${r.result}`);
      lines.push(`   ${r.timestamp}`);
      lines.push("");
    });
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
  download("agc-calculator-history.txt", blob);
}

/** Raw JSON export — full fidelity, useful for re-importing or backups. */
export function exportHistoryJson(items: HistoryItem[]): void {
  const payload = {
    app: BRAND.app,
    company: BRAND.company,
    tagline: BRAND.tagline,
    exportedAt: new Date().toISOString(),
    count: items.length,
    items: historyRows(items),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  download("agc-calculator-history.json", blob);
}

/** Hex colors (no `#`) shared by the Excel + Word brand treatments. */
const BRAND_HEX = {
  navy: "0A0E17",
  navyDeep: "060912",
  gold: "D4AF37",
  goldBright: "F0D378",
  text: "E8EAF0",
  textMuted: "6B7488",
} as const;

/**
 * Excel (.xlsx) export via ExcelJS (dynamically imported — never loaded on
 * page load). Rewritten from the previous plain SheetJS table into a fully
 * branded report: the real AGC mark in the top-left corner, a gold title on
 * a navy band, a company/tagline subtitle, and a navy-filled, gold-text
 * table header row above the data.
 */
export async function exportHistoryXlsx(items: HistoryItem[]): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const markDataUrl = await loadImageDataUrl("/agc-mark.png");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.company;
  workbook.title = `${BRAND.app} — Calculation History`;

  const sheet = workbook.addWorksheet("Calculation History", {
    views: [{ state: "frozen", ySplit: 7 }],
  });
  sheet.columns = [
    { key: "expression", width: 40 },
    { key: "result", width: 20 },
    { key: "label", width: 26 },
    { key: "timestamp", width: 24 },
  ];

  // Rows 1-4: navy brand band (title + company + tagline + export meta),
  // spanning all four columns so it reads as a single banner.
  for (let r = 1; r <= 4; r += 1) {
    const row = sheet.getRow(r);
    row.height = r === 1 ? 26 : 18;
    for (let c = 1; c <= 4; c += 1) {
      row.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${BRAND_HEX.navyDeep}` },
      };
    }
  }
  sheet.mergeCells(1, 1, 1, 4);
  sheet.mergeCells(2, 1, 2, 4);
  sheet.mergeCells(3, 1, 3, 4);

  const titleCell = sheet.getCell(1, 1);
  titleCell.value = BRAND.app.toUpperCase();
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: `FF${BRAND_HEX.goldBright}` } };
  titleCell.alignment = { vertical: "middle", indent: markDataUrl ? 3 : 1 };

  const companyCell = sheet.getCell(2, 1);
  companyCell.value = `${BRAND.company} — ${BRAND.tagline}`;
  companyCell.font = { name: "Calibri", size: 10.5, color: { argb: `FF${BRAND_HEX.text}` } };
  companyCell.alignment = { vertical: "middle", indent: markDataUrl ? 3 : 1 };

  const metaCell = sheet.getCell(3, 1);
  metaCell.value = `Calculation History Report · Exported ${new Date().toLocaleString()} · ${items.length} record${items.length === 1 ? "" : "s"}`;
  metaCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: `FF${BRAND_HEX.textMuted}` } };
  metaCell.alignment = { vertical: "middle", indent: markDataUrl ? 3 : 1 };

  if (markDataUrl) {
    const match = /^data:image\/(png|jpeg|jpg);base64,(.*)$/.exec(markDataUrl);
    if (match) {
      const imageId = workbook.addImage({
        base64: markDataUrl,
        extension: match[1] === "png" ? "png" : "jpeg",
      });
      sheet.addImage(imageId, {
        tl: { col: 0.08, row: 0.08 },
        ext: { width: 56, height: 56 },
      });
    }
  }

  // Row 5: spacer. Row 6: table header — navy fill, gold bold text.
  sheet.getRow(5).height = 6;
  const headerRow = sheet.getRow(6);
  const headers = ["Expression", "Result", "Label", "Timestamp"];
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: `FF${BRAND_HEX.gold}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_HEX.navy}` } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: `FF${BRAND_HEX.gold}` } } };
  });
  headerRow.height = 20;

  const rows = historyRows(items);
  if (rows.length === 0) {
    const emptyRow = sheet.addRow(["No calculations recorded.", "", "", ""]);
    emptyRow.getCell(1).font = { italic: true, color: { argb: `FF${BRAND_HEX.textMuted}` } };
  } else {
    rows.forEach((r, idx) => {
      const row = sheet.addRow([r.expression, r.result, r.label, r.timestamp]);
      if (idx % 2 === 1) {
        for (let c = 1; c <= 4; c += 1) {
          row.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF4F1E8" },
          };
        }
      }
      row.getCell(2).font = { bold: true };
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  download("agc-calculator-history.xlsx", blob);
}

/**
 * Theme palette — translated from the `--c-*` custom properties in
 * `globals.css` (dark/default theme) into jsPDF RGB tuples, so the report
 * matches the app's navy/gold glassmorphism identity instead of a generic
 * gray table.
 */
const PDF_THEME = {
  bg: [10, 14, 23] as const, // --c-bg
  bgDeep: [6, 9, 18] as const, // --c-bg-deep
  cardA: [22, 30, 46] as const, // --c-card-1 (rgba base)
  cardB: [15, 20, 32] as const, // between --c-card-1 / --c-card-2, for row banding
  cardBorder: [212, 175, 55] as const, // --c-card-border (gold, alpha dropped)
  accent: [212, 175, 55] as const, // --c-accent
  accentSoft: [232, 199, 102] as const, // --c-accent-soft
  accentBright: [240, 211, 120] as const, // --c-accent-bright
  resultGold: [244, 221, 146] as const, // --c-result-1
  text: [232, 234, 240] as const, // --c-text
  text2: [154, 163, 184] as const, // --c-text-2
  textMuted: [107, 116, 136] as const, // --c-text-muted
} as const;

/**
 * Fetches a public asset and resolves it to a base64 data URL so it can be
 * embedded in the PDF via `doc.addImage()`. Used for the real AGC medallion
 * (`public/agc-mark.png` / `public/agc-logo.png`) rather than the flat vector
 * glyph. Resolves to `null` on any failure (offline, blocked fetch, decode
 * error) so every caller can fall back to the existing vector `drawLogoMark`
 * — the report must never fail to generate just because an image couldn't
 * be loaded.
 */
async function loadImageArrayBuffer(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function loadImageDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Draws the small rounded, navy-square logo mark inspired by `public/logo.svg`
 * (a rounded square containing a diagonal "bolt" glyph), re-colored gold-on-navy
 * to match the report theme. Drawn as vector shapes (no rasterized image) so it
 * stays crisp at any zoom level. Used as a fallback whenever the real raster
 * AGC medallion (`loadImageDataUrl`) couldn't be loaded.
 */
function drawLogoMark(doc: import("jspdf").jsPDF, x: number, y: number, size: number): void {
  const s = size / 30; // logo.svg viewBox is 0 0 30 30
  const pt = (px: number, py: number): [number, number] => [x + px * s, y + py * s];

  doc.setFillColor(...PDF_THEME.bgDeep);
  doc.setDrawColor(...PDF_THEME.accent);
  doc.setLineWidth(Math.max(0.6, s * 0.6));
  doc.roundedRect(x, y, size, size, size * 0.13, size * 0.13, "FD");

  doc.setFillColor(...PDF_THEME.accent);
  const [x0, y0] = pt(24.3, 7.1);
  const [x1, y1] = pt(13.14, 22.91);
  const [x2, y2] = pt(5.7, 22.91);
  const [x3, y3] = pt(16.86, 7.1);
  doc.triangle(x0, y0, x1, y1, x2, y2, "F");
  doc.triangle(x0, y0, x2, y2, x3, y3, "F");
}

interface PdfLayout {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  headerHeight: number;
  footerHeight: number;
  exprColX: number;
  exprColW: number;
  resultColX: number;
  resultColW: number;
  dateColX: number;
  dateColW: number;
}

/**
 * Branded header (AGC logo mark + title + export date) — repeated
 * identically on every page. Uses the real raster AGC medallion
 * (`logoDataUrl`, loaded once from `public/agc-mark.png`) when available,
 * drawing it inside the same gold-ringed rounded-square frame the vector
 * mark used, so the header keeps its exact prior proportions either way;
 * falls back to the vector `drawLogoMark` if the image couldn't be loaded.
 */
function drawBrandHeader(
  doc: import("jspdf").jsPDF,
  layout: PdfLayout,
  logoDataUrl: string | null,
): number {
  const { pageWidth, margin } = layout;
  const headerH = layout.headerHeight;

  doc.setFillColor(...PDF_THEME.bgDeep);
  doc.rect(0, 0, pageWidth, headerH, "F");

  const logoSize = 30;
  const logoY = (headerH - logoSize) / 2 - 4;

  if (logoDataUrl) {
    doc.setFillColor(...PDF_THEME.bgDeep);
    doc.setDrawColor(...PDF_THEME.accent);
    doc.setLineWidth(0.9);
    doc.roundedRect(margin, logoY, logoSize, logoSize, logoSize * 0.13, logoSize * 0.13, "FD");
    const pad = 2;
    doc.addImage(
      logoDataUrl,
      "PNG",
      margin + pad,
      logoY + pad,
      logoSize - pad * 2,
      logoSize - pad * 2,
    );
  } else {
    drawLogoMark(doc, margin, logoY, logoSize);
  }

  const textX = margin + logoSize + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...PDF_THEME.accentBright);
  doc.text("AGC PREMIUM CALCULATOR", textX, logoY + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_THEME.text2);
  doc.text("Calculation History Report", textX, logoY + 26);

  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.text2);
  doc.text(`Exported ${new Date().toLocaleString()}`, pageWidth - margin, logoY + 13, {
    align: "right",
  });

  // Subtle gold divider beneath the header.
  doc.setDrawColor(...PDF_THEME.accent);
  doc.setLineWidth(1.2);
  doc.line(0, headerH, pageWidth, headerH);
  doc.setDrawColor(...PDF_THEME.cardBorder);
  doc.setLineWidth(0.5);
  doc.line(0, headerH + 3, pageWidth, headerH + 3);

  return headerH + 3;
}

/** Summary stat strip (total / date range / generated) — first page only. */
function drawSummary(
  doc: import("jspdf").jsPDF,
  layout: PdfLayout,
  startY: number,
  stats: { total: number; dateRange: string; generatedAt: string },
): number {
  const { margin, contentWidth } = layout;
  const boxH = 46;
  const gap = 12;
  const boxW = (contentWidth - gap * 2) / 3;
  const y = startY + 14;

  const cells: { label: string; value: string }[] = [
    { label: "TOTAL CALCULATIONS", value: String(stats.total) },
    { label: "DATE RANGE", value: stats.dateRange },
    { label: "GENERATED", value: stats.generatedAt },
  ];

  cells.forEach((cell, idx) => {
    const x = margin + idx * (boxW + gap);
    doc.setFillColor(...PDF_THEME.cardA);
    doc.setDrawColor(...PDF_THEME.cardBorder);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, boxW, boxH, 5, 5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_THEME.text2);
    doc.text(cell.label, x + 10, y + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...PDF_THEME.accentBright);
    const valueLines = doc.splitTextToSize(cell.value, boxW - 20);
    doc.text(valueLines, x + 10, y + 30);
  });

  return y + boxH + 20;
}

/** Table column header row — repeated at the top of the table on every page. */
function drawTableHeader(doc: import("jspdf").jsPDF, layout: PdfLayout, y: number): number {
  const { margin, pageWidth, exprColX, resultColX, dateColX } = layout;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.accent);
  doc.text("EXPRESSION", exprColX, y);
  doc.text("RESULT", resultColX, y);
  doc.text("DATE & TIME", dateColX, y, { align: "right" });

  const dividerY = y + 6;
  doc.setDrawColor(...PDF_THEME.accent);
  doc.setLineWidth(0.8);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  return dividerY + 14;
}

/**
 * Premium background embellishment — drawn on top of the flat navy page
 * fill, underneath everything else. Adds a soft top-to-bottom shading band
 * (simulated with stacked translucent-look rects between `bg`/`bgDeep`,
 * since jsPDF has no native gradient fill) and a thin double gold frame
 * inset from the page edge, matching the app's own bordered-glass-card
 * language instead of a plain solid color.
 */
function drawPremiumBackdrop(doc: import("jspdf").jsPDF, layout: PdfLayout): void {
  const { pageWidth, pageHeight } = layout;

  // Soft vertical shading: a handful of stacked bands interpolating from
  // bgDeep (top) to bg (mid) and back to bgDeep (bottom), approximating a
  // subtle vignette without a real gradient API.
  const bands = 10;
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  for (let i = 0; i < bands; i += 1) {
    const t = i / (bands - 1);
    // 0 -> 1 -> 0 triangle wave so the middle of the page is lightest.
    const wave = 1 - Math.abs(t - 0.5) * 2;
    const r = lerp(PDF_THEME.bgDeep[0], PDF_THEME.bg[0], wave);
    const g = lerp(PDF_THEME.bgDeep[1], PDF_THEME.bg[1], wave);
    const b = lerp(PDF_THEME.bgDeep[2], PDF_THEME.bg[2], wave);
    doc.setFillColor(r, g, b);
    const bandH = pageHeight / bands;
    doc.rect(0, i * bandH, pageWidth, bandH + 1, "F");
  }

  // Thin outer + inner gold frame, echoing the app's gold-bordered cards.
  const outerInset = 14;
  const innerInset = 17.5;
  doc.setDrawColor(...PDF_THEME.cardBorder);
  doc.setLineWidth(0.8);
  doc.rect(outerInset, outerInset, pageWidth - outerInset * 2, pageHeight - outerInset * 2, "S");
  doc.setLineWidth(0.35);
  doc.rect(innerInset, innerInset, pageWidth - innerInset * 2, pageHeight - innerInset * 2, "S");

  // Small gold corner accents (diamond ticks) at each of the frame's four
  // corners, echoing the medallion's own "· BUILDING DIGITAL EXCELLENCE ·"
  // diamond motif.
  const d = 3.2;
  const corners: [number, number][] = [
    [outerInset, outerInset],
    [pageWidth - outerInset, outerInset],
    [outerInset, pageHeight - outerInset],
    [pageWidth - outerInset, pageHeight - outerInset],
  ];
  doc.setFillColor(...PDF_THEME.accent);
  corners.forEach(([cx, cy]) => {
    doc.triangle(cx - d, cy, cx, cy - d, cx + d, cy, "F");
    doc.triangle(cx - d, cy, cx, cy + d, cx + d, cy, "F");
  });
}

/**
 * Faint, centered AGC watermark — the real medallion image at very low
 * opacity when it loaded, with a large faint "AGC" wordmark layered under
 * it either way (works even if the image failed to load, and reinforces
 * the brand for anyone skimming a printed page). Drawn after the table
 * background bands but the function is called before row/column content on
 * each page, so it always sits behind the text and never reduces legibility.
 */
function drawWatermark(
  doc: import("jspdf").jsPDF,
  layout: PdfLayout,
  logoDataUrl: string | null,
): void {
  const { pageWidth, pageHeight } = layout;
  const cx = pageWidth / 2;
  const cy = pageHeight / 2;

  const applyFaintOpacity = (): boolean => {
    try {
      const gState = new (doc as unknown as { GState: new (p: { opacity: number }) => unknown }).GState({
        opacity: 0.05,
      });
      (doc as unknown as { setGState: (g: unknown) => void }).setGState(gState);
      return true;
    } catch {
      return false;
    }
  };
  const resetOpacity = (): void => {
    try {
      const gState = new (doc as unknown as { GState: new (p: { opacity: number }) => unknown }).GState({
        opacity: 1,
      });
      (doc as unknown as { setGState: (g: unknown) => void }).setGState(gState);
    } catch {
      /* opacity plugin unavailable — nothing to reset */
    }
  };

  const supportsOpacity = applyFaintOpacity();

  // Only draw the raster medallion when it can actually be faded — without
  // opacity support it would render at full strength and overpower the
  // table, so in that case we rely solely on the low-contrast text fallback
  // below instead of risking a loud, illegible page.
  if (logoDataUrl && supportsOpacity) {
    const size = Math.min(pageWidth, pageHeight) * 0.55;
    doc.addImage(logoDataUrl, "PNG", cx - size / 2, cy - size / 2, size, size);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(120);
  if (!supportsOpacity) {
    // No opacity support: fall back to the darkest theme tone so the mark
    // stays faint against the navy background purely via low contrast.
    doc.setTextColor(...PDF_THEME.cardB);
  } else {
    doc.setTextColor(...PDF_THEME.accent);
  }
  doc.text("AGC", cx, cy + 34, { align: "center", angle: 32 });

  if (supportsOpacity) resetOpacity();
}

function formatDateRange(items: HistoryItem[]): string {
  if (items.length === 0) return "—";
  const timestamps = items.map((i) => i.timestamp);
  const min = new Date(Math.min(...timestamps));
  const max = new Date(Math.max(...timestamps));
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const a = fmt(min);
  const b = fmt(max);
  return a === b ? a : `${a} – ${b}`;
}

/**
 * Build a professional, on-brand PDF report: a branded header (logo mark,
 * title, export date), a summary stat strip, and a themed navy/gold table
 * with alternating row bands, safe text wrapping, automatic pagination
 * (repeating the header/column labels on every page), and "Page X of Y"
 * footers.
 *
 * jspdf is imported dynamically so the (large) library is only loaded when
 * the user actually exports — never on page load.
 */
export async function exportHistoryPdf(items: HistoryItem[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  // Load the real AGC assets once, up front, in parallel — the small mark
  // (crisp at header/footer icon size) and the larger hero logo (used for
  // the big, faint page watermark). Either can resolve to `null` (offline,
  // blocked fetch) without failing the export; every draw call below has a
  // vector/text fallback.
  const [markDataUrl, logoDataUrl] = await Promise.all([
    loadImageDataUrl("/agc-mark.png"),
    loadImageDataUrl("/agc-logo.png"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 78;
  const footerHeight = 50;

  const exprColW = contentWidth * 0.52;
  const resultColW = contentWidth * 0.2;
  const layout: PdfLayout = {
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    headerHeight,
    footerHeight,
    exprColX: margin,
    exprColW,
    resultColX: margin + exprColW,
    resultColW,
    dateColX: pageWidth - margin,
    dateColW: contentWidth - exprColW - resultColW,
  };

  const rows = historyRows(items);

  // Full branded page background — navy fill + subtle shading/frame (matches
  // --c-bg) — plus a faint centered AGC watermark, both repeated identically
  // on every page.
  const paintPageBackground = () => {
    doc.setFillColor(...PDF_THEME.bg);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    drawPremiumBackdrop(doc, layout);
    drawWatermark(doc, layout, logoDataUrl);
  };

  const startNewPage = (): number => {
    paintPageBackground();
    let cursorY = drawBrandHeader(doc, layout, markDataUrl);
    cursorY = drawTableHeader(doc, layout, cursorY + 22);
    return cursorY;
  };

  paintPageBackground();
  let y = drawBrandHeader(doc, layout, markDataUrl);
  y = drawSummary(doc, layout, y, {
    total: items.length,
    dateRange: formatDateRange(items),
    generatedAt: new Date().toLocaleString(),
  });
  y = drawTableHeader(doc, layout, y);

  const lineHeight = 12;
  const rowPadding = 8;
  const labelLineHeight = 11;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (rows.length === 0) {
    doc.setTextColor(...PDF_THEME.textMuted);
    doc.text("No calculations recorded.", layout.exprColX, y + 4);
  }

  rows.forEach((row, idx) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const exprLines: string[] = doc.splitTextToSize(row.expression, layout.exprColW - 10);
    const resultLines: string[] = doc.splitTextToSize(`= ${row.result}`, layout.resultColW - 10);
    const dateLines: string[] = doc.splitTextToSize(row.timestamp, layout.dateColW - 10);
    const bodyLineCount = Math.max(exprLines.length, resultLines.length, dateLines.length, 1);
    const labelHeight = row.label ? labelLineHeight + 2 : 0;
    const rowHeight = rowPadding * 2 + labelHeight + bodyLineCount * lineHeight;

    // Page break BEFORE drawing, so no row is ever split across pages.
    if (y + rowHeight > pageHeight - footerHeight) {
      doc.addPage();
      y = startNewPage();
    }

    // Alternating navy row bands.
    const rowFill = idx % 2 === 0 ? PDF_THEME.cardA : PDF_THEME.cardB;
    doc.setFillColor(rowFill[0], rowFill[1], rowFill[2]);
    doc.rect(margin, y - rowPadding, contentWidth, rowHeight, "F");

    let textY = y + 2;
    if (row.label) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_THEME.accentSoft);
      doc.text(row.label, layout.exprColX, textY);
      textY += labelHeight;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_THEME.text);
    doc.text(exprLines, layout.exprColX, textY + 7);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.resultGold);
    doc.text(resultLines, layout.resultColX, textY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_THEME.textMuted);
    doc.text(dateLines, layout.dateColX, textY + 7, { align: "right" });

    y += rowHeight;
  });

  // Second pass: footers with brand icon, tagline, and "Page X of Y" (the
  // total page count is only known once every page has been added), drawn
  // identically on every page.
  const totalPages = doc.getNumberOfPages();
  const footerIconSize = 12;
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_THEME.cardBorder);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - footerHeight + 8, pageWidth - margin, pageHeight - footerHeight + 8);

    const footerTextY = pageHeight - footerHeight + 20;
    let brandX = margin;

    if (markDataUrl) {
      doc.addImage(
        markDataUrl,
        "PNG",
        margin,
        footerTextY - footerIconSize + 3,
        footerIconSize,
        footerIconSize,
      );
      brandX = margin + footerIconSize + 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.textMuted);
    doc.text("AGC Premium Calculator", brandX, footerTextY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.text2);
    doc.text(
      "Ahmed Group of Companies · Building Digital Excellence",
      brandX,
      footerTextY + 9,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.textMuted);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, footerTextY, {
      align: "right",
    });
  }

  doc.save("agc-calculator-history.pdf");
}

/**
 * Word (.docx) export via the `docx` library (dynamically imported — never
 * loaded on page load). Produces a branded report: the real AGC mark +
 * title in a running header on every page, a navy/gold title block and
 * summary line in the body, a navy-header/gold-text table of calculations,
 * and a running footer with the company tagline and a "Page X of Y" field.
 */
export async function exportHistoryDocx(items: HistoryItem[]): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    Header,
    Footer,
    PageNumber,
    BorderStyle,
    VerticalAlign,
  } = await import("docx");

  const markBuffer = await loadImageArrayBuffer("/agc-mark.png");
  const rows = historyRows(items);

  const NAVY = BRAND_HEX.navy;
  const GOLD = BRAND_HEX.gold;
  const GOLD_BRIGHT = BRAND_HEX.goldBright;
  const TEXT_MUTED = "555555";

  const headerChildren: DocxParagraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        ...(markBuffer
          ? [
              new ImageRun({
                type: "png",
                data: markBuffer,
                transformation: { width: 26, height: 26 },
              }),
              new TextRun({ text: "   " }),
            ]
          : []),
        new TextRun({ text: BRAND.app, bold: true, size: 22, color: NAVY }),
        new TextRun({ text: "  •  Calculation History Report", size: 18, color: TEXT_MUTED }),
      ],
    }),
  ];

  const footerChildren: DocxParagraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
      children: [
        new TextRun({
          text: `${BRAND.company} · ${BRAND.tagline}  —  Page `,
          size: 16,
          color: TEXT_MUTED,
        }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: TEXT_MUTED }),
        new TextRun({ text: " of ", size: 16, color: TEXT_MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: TEXT_MUTED }),
      ],
    }),
  ];

  const headerCellText = (label: string) =>
    new TableCell({
      shading: { fill: NAVY },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: label, bold: true, color: GOLD, size: 19 })],
        }),
      ],
    });

  const dataCell = (text: string, opts?: { bold?: boolean; color?: string; shade?: string }) =>
    new TableCell({
      shading: opts?.shade ? { fill: opts.shade } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text || "—",
              bold: opts?.bold,
              color: opts?.color ?? "1A1A1A",
              size: 18,
            }),
          ],
        }),
      ],
    });

  const tableRows: DocxTableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCellText("Expression"),
        headerCellText("Result"),
        headerCellText("Label"),
        headerCellText("Date & Time"),
      ],
    }),
  ];

  if (rows.length === 0) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "No calculations recorded.", italics: true, color: TEXT_MUTED }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  } else {
    rows.forEach((r, idx) => {
      const shade = idx % 2 === 1 ? "F4F1E8" : undefined;
      tableRows.push(
        new TableRow({
          children: [
            dataCell(r.expression, { shade }),
            dataCell(r.result, { bold: true, color: "8A6D1D", shade }),
            dataCell(r.label, { shade }),
            dataCell(r.timestamp, { color: "6B7488", shade }),
          ],
        }),
      );
    });
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });

  const docChildren: (DocxParagraph | DocxTable)[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: BRAND.app.toUpperCase(), bold: true, size: 40, color: GOLD_BRIGHT })],
      shading: { fill: BRAND_HEX.navyDeep },
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `${BRAND.company} — ${BRAND.tagline}`, size: 20, color: "3A3A3A" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "Calculation History Report", bold: true, size: 22, color: "1A1A1A" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Exported ${new Date().toLocaleString()} · ${items.length} record${items.length === 1 ? "" : "s"}`,
          size: 18,
          color: TEXT_MUTED,
        }),
      ],
    }),
    table,
  ];

  const document = new Document({
    creator: BRAND.company,
    title: `${BRAND.app} — Calculation History`,
    sections: [
      {
        headers: { default: new Header({ children: headerChildren }) },
        footers: { default: new Footer({ children: footerChildren }) },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  download("agc-calculator-history.docx", blob);
}
