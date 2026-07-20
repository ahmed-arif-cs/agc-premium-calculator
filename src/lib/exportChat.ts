"use client";

import type { ChatUIMessage } from "@/components/chat/types";

const BRAND = {
  app: "AGC Premium Calculator",
  company: "Ahmed Group of Companies",
  tagline: "Building Digital Excellence",
} as const;

const BRAND_HEX = {
  navy: "0A0E17",
  navyDeep: "060912",
  gold: "D4AF37",
  goldBright: "F0D378",
  text: "E8EAF0",
  textMuted: "6B7488",
} as const;

/** RGB palette for jsPDF draw calls — mirrors the app's --c-* theme tokens. */
const PDF_THEME = {
  bg: [10, 14, 23] as const,
  bgDeep: [6, 9, 18] as const,
  cardA: [22, 30, 46] as const,
  cardB: [15, 20, 32] as const,
  cardBorder: [212, 175, 55] as const,
  accent: [212, 175, 55] as const,
  accentSoft: [232, 199, 102] as const,
  accentBright: [240, 211, 120] as const,
  text: [232, 234, 240] as const,
  text2: [154, 163, 184] as const,
  textMuted: [107, 116, 136] as const,
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
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function rows(messages: ChatUIMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "user" ? "You" : "AGC AI",
      content: m.content,
      timestamp: new Date(m.createdAt).toISOString(),
    }));
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

async function loadImageArrayBuffer(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export function exportChatCsv(messages: ChatUIMessage[]): void {
  const meta: string[][] = [
    [BRAND.app],
    [`${BRAND.company} — ${BRAND.tagline}`],
    [`Exported: ${new Date().toLocaleString()}`],
    [],
  ];
  const header = ["Sender", "Message", "Timestamp"];
  const body = rows(messages).map((r) => [r.role, r.content, r.timestamp]);
  const csv = [...meta, header, ...body].map((row) => row.map(csvEscape).join(",")).join("\n");
  download("agc-chat-conversation.csv", new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}

export function exportChatTxt(messages: ChatUIMessage[]): void {
  const lines: string[] = [
    `${BRAND.app.toUpperCase()} — Chat Conversation`,
    `${BRAND.company} · ${BRAND.tagline}`,
    `Exported ${new Date().toLocaleString()}`,
    "=".repeat(48),
    "",
  ];
  rows(messages).forEach((r) => {
    lines.push(`${r.role} (${r.timestamp}):`);
    lines.push(r.content);
    lines.push("");
  });
  download("agc-chat-conversation.txt", new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" }));
}

export function exportChatJson(messages: ChatUIMessage[]): void {
  const payload = {
    app: BRAND.app,
    company: BRAND.company,
    exportedAt: new Date().toISOString(),
    messages: rows(messages),
  };
  download("agc-chat-conversation.json", new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" }));
}

export async function exportChatXlsx(messages: ChatUIMessage[]): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const markDataUrl = await loadImageDataUrl("/agc-mark.png");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.company;
  const sheet = workbook.addWorksheet("Chat Conversation");
  sheet.columns = [
    { key: "role", width: 14 },
    { key: "content", width: 70 },
    { key: "timestamp", width: 24 },
  ];

  for (let r = 1; r <= 3; r += 1) {
    const row = sheet.getRow(r);
    row.height = r === 1 ? 26 : 18;
    for (let c = 1; c <= 3; c += 1) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_HEX.navyDeep}` } };
    }
  }
  sheet.mergeCells(1, 1, 1, 3);
  sheet.mergeCells(2, 1, 2, 3);
  sheet.getCell(1, 1).value = BRAND.app.toUpperCase();
  sheet.getCell(1, 1).font = { size: 16, bold: true, color: { argb: `FF${BRAND_HEX.goldBright}` } };
  sheet.getCell(1, 1).alignment = { vertical: "middle", indent: markDataUrl ? 3 : 1 };
  sheet.getCell(2, 1).value = `${BRAND.company} — ${BRAND.tagline} · Exported ${new Date().toLocaleString()}`;
  sheet.getCell(2, 1).font = { size: 10, color: { argb: `FF${BRAND_HEX.text}` } };
  sheet.getCell(2, 1).alignment = { vertical: "middle", indent: markDataUrl ? 3 : 1 };

  if (markDataUrl) {
    const match = /^data:image\/(png|jpeg|jpg);base64,(.*)$/.exec(markDataUrl);
    if (match) {
      const imageId = workbook.addImage({ base64: markDataUrl, extension: match[1] === "png" ? "png" : "jpeg" });
      sheet.addImage(imageId, { tl: { col: 0.08, row: 0.08 }, ext: { width: 44, height: 44 } });
    }
  }

  const headerRow = sheet.getRow(4);
  ["Sender", "Message", "Timestamp"].forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: `FF${BRAND_HEX.gold}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_HEX.navy}` } };
  });

  rows(messages).forEach((r, idx) => {
    const row = sheet.addRow([r.role, r.content, r.timestamp]);
    if (idx % 2 === 1) {
      for (let c = 1; c <= 3; c += 1) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F1E8" } };
      }
    }
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  download("agc-chat-conversation.xlsx", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

/**
 * Vector fallback logo (rounded gold-on-navy square with a "bolt" glyph),
 * used only if the real raster mark (`/agc-mark.png`) fails to load.
 */
function drawLogoMark(doc: import("jspdf").jsPDF, x: number, y: number, size: number): void {
  const s = size / 30;
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

interface ChatPdfLayout {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  headerHeight: number;
  footerHeight: number;
}

/** Double gold frame + corner accents + soft vignette bands — page border. */
function drawPremiumBackdrop(doc: import("jspdf").jsPDF, layout: ChatPdfLayout): void {
  const { pageWidth, pageHeight } = layout;

  const bands = 10;
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  for (let i = 0; i < bands; i += 1) {
    const t = i / (bands - 1);
    const wave = 1 - Math.abs(t - 0.5) * 2;
    const r = lerp(PDF_THEME.bgDeep[0], PDF_THEME.bg[0], wave);
    const g = lerp(PDF_THEME.bgDeep[1], PDF_THEME.bg[1], wave);
    const b = lerp(PDF_THEME.bgDeep[2], PDF_THEME.bg[2], wave);
    doc.setFillColor(r, g, b);
    const bandH = pageHeight / bands;
    doc.rect(0, i * bandH, pageWidth, bandH + 1, "F");
  }

  const outerInset = 14;
  const innerInset = 17.5;
  doc.setDrawColor(...PDF_THEME.cardBorder);
  doc.setLineWidth(0.8);
  doc.rect(outerInset, outerInset, pageWidth - outerInset * 2, pageHeight - outerInset * 2, "S");
  doc.setLineWidth(0.35);
  doc.rect(innerInset, innerInset, pageWidth - innerInset * 2, pageHeight - innerInset * 2, "S");

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

/** Faint centered watermark — real logo image (if loaded) + "AGC" wordmark. */
function drawWatermark(doc: import("jspdf").jsPDF, layout: ChatPdfLayout, logoDataUrl: string | null): void {
  const { pageWidth, pageHeight } = layout;
  const cx = pageWidth / 2;
  const cy = pageHeight / 2;

  const applyFaintOpacity = (): boolean => {
    try {
      const gState = new (doc as unknown as { GState: new (p: { opacity: number }) => unknown }).GState({ opacity: 0.05 });
      (doc as unknown as { setGState: (g: unknown) => void }).setGState(gState);
      return true;
    } catch {
      return false;
    }
  };
  const resetOpacity = (): void => {
    try {
      const gState = new (doc as unknown as { GState: new (p: { opacity: number }) => unknown }).GState({ opacity: 1 });
      (doc as unknown as { setGState: (g: unknown) => void }).setGState(gState);
    } catch {
      /* opacity plugin unavailable */
    }
  };

  const supportsOpacity = applyFaintOpacity();

  if (logoDataUrl && supportsOpacity) {
    const size = Math.min(pageWidth, pageHeight) * 0.55;
    doc.addImage(logoDataUrl, "PNG", cx - size / 2, cy - size / 2, size, size);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(120);
  if (!supportsOpacity) {
    doc.setTextColor(...PDF_THEME.cardB);
  } else {
    doc.setTextColor(...PDF_THEME.accent);
  }
  doc.text("AGC", cx, cy + 34, { align: "center", angle: 32 });

  if (supportsOpacity) resetOpacity();
}

/** Branded header — real logo in a rounded gold frame, title, export date. */
function drawChatHeader(doc: import("jspdf").jsPDF, layout: ChatPdfLayout, markDataUrl: string | null): number {
  const { pageWidth, margin } = layout;
  const headerH = layout.headerHeight;

  doc.setFillColor(...PDF_THEME.bgDeep);
  doc.rect(0, 0, pageWidth, headerH, "F");

  const logoSize = 30;
  const logoY = (headerH - logoSize) / 2 - 4;

  if (markDataUrl) {
    doc.setFillColor(...PDF_THEME.bgDeep);
    doc.setDrawColor(...PDF_THEME.accent);
    doc.setLineWidth(0.9);
    doc.roundedRect(margin, logoY, logoSize, logoSize, logoSize * 0.13, logoSize * 0.13, "FD");
    const pad = 2;
    doc.addImage(markDataUrl, "PNG", margin + pad, logoY + pad, logoSize - pad * 2, logoSize - pad * 2);
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
  doc.text("AI Chat Conversation Export", textX, logoY + 26);

  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.text2);
  doc.text(`Exported ${new Date().toLocaleString()}`, pageWidth - margin, logoY + 13, { align: "right" });

  doc.setDrawColor(...PDF_THEME.accent);
  doc.setLineWidth(1.2);
  doc.line(0, headerH, pageWidth, headerH);
  doc.setDrawColor(...PDF_THEME.cardBorder);
  doc.setLineWidth(0.5);
  doc.line(0, headerH + 3, pageWidth, headerH + 3);

  return headerH + 3;
}

export async function exportChatPdf(messages: ChatUIMessage[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const [markDataUrl, logoDataUrl] = await Promise.all([
    loadImageDataUrl("/agc-mark.png"),
    loadImageDataUrl("/agc-logo.png"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 70;
  const footerHeight = 50;

  const layout: ChatPdfLayout = { pageWidth, pageHeight, margin, contentWidth, headerHeight, footerHeight };

  const paintPageBackground = () => {
    doc.setFillColor(...PDF_THEME.bg);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    drawPremiumBackdrop(doc, layout);
    drawWatermark(doc, layout, logoDataUrl);
  };

  const startNewPage = (): number => {
    paintPageBackground();
    return drawChatHeader(doc, layout, markDataUrl) + 27;
  };

  paintPageBackground();
  let y = drawChatHeader(doc, layout, markDataUrl) + 27;

  const data = rows(messages);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  data.forEach((m) => {
    const isUser = m.role === "You";
    const label = `${m.role} — ${m.timestamp}`;
    const contentLines: string[] = doc.splitTextToSize(m.content, contentWidth - 20);
    const blockH = 16 + contentLines.length * 13 + 14;

    if (y + blockH > pageHeight - footerHeight) {
      doc.addPage();
      y = startNewPage();
    }

    doc.setFillColor(isUser ? 26 : 18, isUser ? 34 : 24, isUser ? 50 : 38);
    doc.roundedRect(margin, y - 12, contentWidth, blockH, 6, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_THEME.accent);
    doc.text(label, margin + 10, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_THEME.text);
    doc.text(contentLines, margin + 10, y + 16);

    y += blockH + 10;
  });

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
      doc.addImage(markDataUrl, "PNG", margin, footerTextY - footerIconSize + 3, footerIconSize, footerIconSize);
      brandX = margin + footerIconSize + 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.textMuted);
    doc.text("AGC Premium Calculator", brandX, footerTextY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.text2);
    doc.text("Ahmed Group of Companies · Building Digital Excellence", brandX, footerTextY + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.textMuted);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, footerTextY, { align: "right" });
  }

  doc.save("agc-chat-conversation.pdf");
}

export async function exportChatDocx(messages: ChatUIMessage[]): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, PageNumber, BorderStyle, AlignmentType,
  } = await import("docx");

  const markBuffer = await loadImageArrayBuffer("/agc-mark.png");
  const GOLD = "D4AF37";
  const NAVY = "0A0E17";
  const MUTED = "555555";

  const headerChildren = [
    new Paragraph({
      children: [
        ...(markBuffer ? [new ImageRun({ type: "png", data: markBuffer, transformation: { width: 24, height: 24 } }), new TextRun({ text: "   " })] : []),
        new TextRun({ text: BRAND.app, bold: true, size: 22, color: NAVY }),
        new TextRun({ text: "  •  AI Chat Export", size: 18, color: MUTED }),
      ],
    }),
  ];

  const footerChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
      children: [
        new TextRun({ text: `${BRAND.company} · ${BRAND.tagline}  —  Page `, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
        new TextRun({ text: " of ", size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
      ],
    }),
  ];

  const bodyChildren = [
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: "AI CHAT CONVERSATION", bold: true, size: 32, color: GOLD })],
    }),
    new Paragraph({
      spacing: { after: 260 },
      children: [new TextRun({ text: `Exported ${new Date().toLocaleString()}`, size: 18, color: MUTED })],
    }),
    ...rows(messages).flatMap((r) => [
      new Paragraph({
        spacing: { before: 160 },
        children: [new TextRun({ text: `${r.role} — ${r.timestamp}`, bold: true, size: 18, color: r.role === "You" ? "1A1A1A" : "8A6D1D" })],
      }),
      new Paragraph({
        children: [new TextRun({ text: r.content, size: 20 })],
      }),
    ]),
  ];

  const document = new Document({
    creator: BRAND.company,
    sections: [{ headers: { default: new Header({ children: headerChildren }) }, footers: { default: new Footer({ children: footerChildren }) }, children: bodyChildren }],
  });

  const blob = await Packer.toBlob(document);
  download("agc-chat-conversation.docx", blob);
}