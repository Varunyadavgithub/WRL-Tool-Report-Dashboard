import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { getWrlLogoBase64 } from "./reportLogo.js";

// Shared Excel (HTML-table-as-.xls) / PDF (jsPDF + autoTable) export helpers
// for the simpler Part Process report pages (Quality, Downtime, Hourly).
// Each `columns` entry is `{ label, align, value(row) }`.

const downloadBlob = (content, mime, filename) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export const exportRowsToExcel = async ({ rows, columns, title, subtitle, filename }) => {
  const logo = await getWrlLogoBase64();
  const span = columns.length;
  const th = (c) => `<th style="background:#1e3a8a;color:#ffffff;font-weight:bold;border:1px solid #1e293b;padding:6px;text-align:${c.align === "center" ? "center" : "left"}">${c.label}</th>`;
  const td = (c, v) => {
    const num = v !== "" && v != null && !isNaN(parseFloat(v)) && isFinite(v);
    return `<td style="border:1px solid #cbd5e1;padding:4px;text-align:${num ? "right" : "left"}">${v ?? ""}</td>`;
  };
  const head = `<tr>${columns.map(th).join("")}</tr>`;
  const body = rows.map((r, i) =>
    `<tr style="background:${i % 2 ? "#f1f5f9" : "#ffffff"}">${columns.map((c) => td(c, c.value(r))).join("")}</tr>`).join("");
  const logoCell = logo ? `<td style="width:90px;padding:6px"><img src="${logo}" width="80" height="40" /></td>` : "";
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <style>table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11px}</style></head>
    <body>
      <table><tr>${logoCell}<td colspan="${span}" style="font-size:15px;font-weight:bold;padding:8px;text-align:center">${title}</td></tr>
      ${subtitle ? `<tr><td colspan="${span + (logo ? 1 : 0)}" style="font-size:10px;color:#475569;padding:0 8px 8px;text-align:center">${subtitle}</td></tr>` : ""}</table>
      <table border="1">${head}${body}</table>
    </body></html>`;
  downloadBlob(html, "application/vnd.ms-excel", filename);
};

export const exportRowsToPDF = async ({ rows, columns, title, subtitle, filename, orientation = "landscape" }) => {
  const logo = await getWrlLogoBase64();
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const marginX = 24;
  const titleX = logo ? marginX + 56 : marginX;

  if (logo) doc.addImage(logo, "PNG", marginX, 14, 44, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, titleX, 28);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(subtitle, titleX, 42);
    doc.setTextColor(0);
  }

  const head = [columns.map((c) => ({ content: c.label, styles: { halign: c.align === "center" ? "center" : "left" } }))];
  const body = rows.map((r) => columns.map((c) => { const v = c.value(r); return v == null ? "" : String(v); }));
  const columnStyles = {};
  columns.forEach((c, i) => { columnStyles[i] = { halign: c.align === "center" ? "center" : "left" }; });

  autoTable(doc, {
    head, body,
    startY: 52,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak", lineColor: [203, 213, 225], lineWidth: 0.4 },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", lineColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    didDrawPage: () => {
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(str, doc.internal.pageSize.getWidth() - marginX, doc.internal.pageSize.getHeight() - 12, { align: "right" });
      doc.setTextColor(0);
    },
  });

  doc.save(filename);
};

// ─────────────────────────────────────────────────────────────────────────────
// Multi-section export — a full report made of several ordered blocks, each
// either a data table or a chart image (captured via Chart.js `.toBase64Image()`
// through a ref). Used by pages with multiple tables + charts (Quality,
// Downtime, Hourly) so the export mirrors everything visible on screen.
//
//   block = { type: "table", heading, columns, rows }
//         | { type: "image", heading, dataUrl, width, height }
// ─────────────────────────────────────────────────────────────────────────────

// Excel does not render `data:` URI images inside the legacy HTML-as-.xls
// trick (it tries to resolve them as linked external files and shows a
// broken-image placeholder), so multi-section exports build a real .xlsx
// via ExcelJS instead, which embeds chart images natively.
const ROW_PX = 20; // approx default Excel row height in pixels, used to size image placeholders

export const exportSectionsToExcel = async ({ title, subtitle, blocks, filename }) => {
  const logo = await getWrlLogoBase64();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  const maxCols = Math.max(4, ...blocks.filter((b) => b.type === "table").map((b) => b.columns.length));
  for (let i = 1; i <= maxCols; i++) sheet.getColumn(i).width = 18;

  let row = 1;
  if (logo) {
    const imgId = workbook.addImage({ base64: logo, extension: "png" });
    sheet.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 40 } });
    row = 3;
  }

  sheet.mergeCells(row, 1, row, maxCols);
  const titleCell = sheet.getCell(row, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
  titleCell.alignment = { horizontal: "center" };
  row++;

  if (subtitle) {
    sheet.mergeCells(row, 1, row, maxCols);
    const subCell = sheet.getCell(row, 1);
    subCell.value = subtitle;
    subCell.font = { size: 10, color: { argb: "FF64748B" } };
    subCell.alignment = { horizontal: "center" };
    row++;
  }
  row++;

  const thinGray = { style: "thin", color: { argb: "FFCBD5E1" } };

  blocks.forEach((block) => {
    sheet.mergeCells(row, 1, row, maxCols);
    const headCell = sheet.getCell(row, 1);
    headCell.value = block.heading;
    headCell.font = { bold: true, size: 12, color: { argb: "FF1E293B" } };
    row++;

    if (block.type === "image") {
      if (!block.dataUrl) return;
      const imgId = workbook.addImage({ base64: block.dataUrl, extension: "png" });
      const w = block.width || 480;
      const h = block.height || 240;
      sheet.addImage(imgId, { tl: { col: 0, row: row - 1 }, ext: { width: w, height: h } });
      row += Math.ceil(h / ROW_PX) + 2;
      return;
    }

    const headerRow = sheet.getRow(row);
    block.columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      cell.alignment = { horizontal: c.align === "center" ? "center" : "left" };
      cell.border = { top: thinGray, left: thinGray, bottom: thinGray, right: thinGray };
    });
    row++;

    block.rows.forEach((r, idx) => {
      const dataRow = sheet.getRow(row);
      block.columns.forEach((c, i) => {
        const cell = dataRow.getCell(i + 1);
        cell.value = c.value(r) ?? "";
        cell.alignment = { horizontal: c.align === "center" ? "center" : "left" };
        cell.border = { top: thinGray, left: thinGray, bottom: thinGray, right: thinGray };
        if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      });
      row++;
    });
    row++;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/\.xls$/i, ".xlsx");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export const exportMultiSectionPDF = async ({ title, subtitle, blocks, filename, orientation = "landscape" }) => {
  const logo = await getWrlLogoBase64();
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const marginX = 24;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const titleX = logo ? marginX + 56 : marginX;

  if (logo) doc.addImage(logo, "PNG", marginX, 14, 44, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, titleX, 28);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(subtitle, titleX, 42);
    doc.setTextColor(0);
  }

  const addFooter = () => {
    const str = `Page ${doc.internal.getNumberOfPages()}`;
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(str, pageW - marginX, pageH - 12, { align: "right" });
    doc.setTextColor(0);
  };

  let y = 56;
  blocks.forEach((block) => {
    if (block.type === "image") {
      if (!block.dataUrl) return;
      const w = block.width || 460;
      const h = block.height || 220;
      if (y + 24 + h > pageH - 30) { addFooter(); doc.addPage(); y = 30; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30);
      doc.text(block.heading, marginX, y + 12);
      doc.addImage(block.dataUrl, "PNG", marginX, y + 18, w, h);
      y += 18 + h + 24;
      return;
    }

    if (y + 60 > pageH - 30) { addFooter(); doc.addPage(); y = 30; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30);
    doc.text(block.heading, marginX, y + 10);

    const head = [block.columns.map((c) => ({ content: c.label, styles: { halign: c.align === "center" ? "center" : "left" } }))];
    const body = block.rows.map((r) => block.columns.map((c) => { const v = c.value(r); return v == null ? "" : String(v); }));
    const columnStyles = {};
    block.columns.forEach((c, i) => { columnStyles[i] = { halign: c.align === "center" ? "center" : "left" }; });

    autoTable(doc, {
      head, body,
      startY: y + 16,
      margin: { left: marginX, right: marginX },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak", lineColor: [203, 213, 225], lineWidth: 0.4 },
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", lineColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      didDrawPage: addFooter,
    });
    y = doc.lastAutoTable.finalY + 24;
  });

  addFooter();
  doc.save(filename);
};
