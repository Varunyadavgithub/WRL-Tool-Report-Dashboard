/**
 * Server-side port of ProductionReport.jsx's own bespoke `exportExcel` (NOT
 * the shared exportSectionsToExcel used by Quality/Downtime/Hourly) — same
 * column set as buildColumns(materials), same group-band + column-label
 * two-tier header, same zebra body, same TOTAL/AVG footer row. This is what
 * "Export Excel" on the Production Report page produces, ported so the
 * shift-end email attachment matches it exactly instead of a different
 * server-only layout.
 */
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");

const loadLogoBase64 = () => {
  try {
    return fs.readFileSync(LOGO_PATH).toString("base64");
  } catch {
    return null;
  }
};

// Mirrors GROUP_META in ProductionReport.jsx — light band bg / dark band text,
// one contiguous colour per group of columns.
const GROUP_META = {
  info:    { label: "Part Info",             bg: "FFF1F5F9", text: "FF475569" },
  qty:     { label: "Production Qty",        bg: "FFEFF6FF", text: "FF1D4ED8" },
  weight:  { label: "Material Weight (kg)",  bg: "FFFFFBEB", text: "FFB45309" },
  time:    { label: "Time (min)",            bg: "FFF5F3FF", text: "FF6D28D9" },
  ct:      { label: "Cycle Time (s)",        bg: "FFECFEFF", text: "FF0E7490" },
  quality: { label: "Quality Log",           bg: "FFECFDF5", text: "FF047857" },
  oee:     { label: "OEE (A x P x Q)",       bg: "FFFFFBEB", text: "FFB45309" },
};

// Field-for-field match of buildColumns(materials) in ProductionReport.jsx —
// `value` is the server-side equivalent of that config's `csv(r)`.
const PRODUCTION_COLUMNS = [
  { key: "srNo", label: "Sr.", group: "info", align: "left", value: (r) => r.srNo },
  { key: "date", label: "Date", group: "info", align: "left", value: (r) => r.date },
  { key: "startedAt", label: "Started", group: "info", align: "left", value: (r) => r.startedAt || "" },
  { key: "completedAt", label: "Completed", group: "info", align: "left", value: (r) => r.completedAt || "" },
  { key: "sapCode", label: "SAP Code", group: "info", align: "left", value: (r) => r.sapCode },
  { key: "itemDescription", label: "Item Description", group: "info", align: "left", value: (r) => r.itemDescription },
  { key: "sheetSapCode", label: "Sheet SAP Code", group: "info", align: "left", value: (r) => r.sheetSapCode || "" },
  { key: "sheetDescription", label: "Sheet Description", group: "info", align: "left", value: (r) => r.sheetDescription || "" },
  { key: "planQty", label: "Plan Qty", group: "qty", align: "center", value: (r) => r.planQty },
  { key: "componentQty", label: "Components Produced", group: "qty", align: "center", value: (r) => r.componentQty },
  { key: "actualQty", label: "Sheet Qty", group: "qty", align: "center", value: (r) => r.actualQty },
  { key: "sheetWeightKg", label: "Sheet Wt Used (kg)", group: "weight", align: "center", value: (r) => r.sheetWeightKg },
  { key: "scrapWeightKg", label: "Scrap Wt (kg)", group: "weight", align: "center", value: (r) => r.scrapWeightKg },
  { key: "reqTimeMins", label: "Required Time", group: "time", align: "center", value: (r) => r.reqTimeMins },
  { key: "actualTimeMins", label: "Actual Time", group: "time", align: "center", value: (r) => r.actualTimeMins },
  { key: "totalDowntimeMins", label: "Downtime", group: "time", align: "center", value: (r) => r.totalDowntimeMins },
  { key: "definedCycleTime", label: "Standard CT", group: "ct", align: "center", value: (r) => r.definedCycleTime },
  { key: "sheetCycleTime", label: "Sheet CT", group: "ct", align: "center", value: (r) => r.sheetCycleTime },
  { key: "componentCycleTime", label: "Actual CT", group: "ct", align: "center", value: (r) => r.componentCycleTime ?? "" },
  { key: "accepted", label: "Accepted", group: "quality", align: "center", value: (r) => r.accepted },
  { key: "rejected", label: "Rejected", group: "quality", align: "center", value: (r) => r.rejected },
  { key: "availability", label: "A (%)", group: "oee", align: "center", value: (r) => r.availability },
  { key: "performance", label: "P (%)", group: "oee", align: "center", value: (r) => r.performance },
  { key: "quality", label: "Q (%)", group: "oee", align: "center", value: (r) => r.quality },
  { key: "oee", label: "OEE (%)", group: "oee", align: "center", value: (r) => r.oee },
];

const AGG_SUM = new Set(["planQty", "componentQty", "actualQty", "sheetWeightKg", "scrapWeightKg", "reqTimeMins", "actualTimeMins", "totalDowntimeMins", "accepted", "rejected"]);
const AGG_AVG = new Set(["availability", "performance", "quality", "oee"]);

// Matches the Production Report page's default hiddenCols state — those
// columns start collapsed on load, so the "export the visible columns" rule
// excludes them by default here too, same as the page's own export would
// produce for a subscriber who never touched the column-visibility menu.
const DEFAULT_HIDDEN_KEYS = new Set([
  "actualQty", "sheetCycleTime", "sheetSapCode", "sheetDescription", "sheetWeightKg", "scrapWeightKg",
]);
export const VISIBLE_PRODUCTION_COLUMNS = PRODUCTION_COLUMNS.filter((c) => !DEFAULT_HIDDEN_KEYS.has(c.key));

// Collapse the column list into header-band segments [{group, count}], same
// as groupSpans() in ProductionReport.jsx.
const groupSpans = (columns) => {
  const segs = [];
  columns.forEach((c) => {
    const last = segs[segs.length - 1];
    if (last && last.group === c.group) last.count += 1;
    else segs.push({ group: c.group, count: 1 });
  });
  return segs;
};

// Exported so the shift-end email body's inline table (which shares this
// same visible column set) can render an identical TOTAL/AVG row without
// duplicating the sum/average rules.
export const computeProductionTotals = (rows) => {
  const out = {};
  VISIBLE_PRODUCTION_COLUMNS.forEach((c) => {
    if (AGG_SUM.has(c.key)) out[c.key] = rows.reduce((s, r) => s + (Number(c.value(r)) || 0), 0);
    else if (AGG_AVG.has(c.key)) out[c.key] = rows.length ? rows.reduce((s, r) => s + (Number(c.value(r)) || 0), 0) / rows.length : 0;
  });
  return out;
};
export const isProductionSumColumn = (key) => AGG_SUM.has(key);
export const isProductionAvgColumn = (key) => AGG_AVG.has(key);

export const buildProductionReportExcel = async ({ title, subtitle, rows }) => {
  const logo = loadLogoBase64();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Production Report");

  const cols = VISIBLE_PRODUCTION_COLUMNS;
  const segs = groupSpans(cols);
  const thinGray = { style: "thin", color: { argb: "FFCBD5E1" } };

  cols.forEach((c, i) => { sheet.getColumn(i + 1).width = c.key === "itemDescription" || c.key === "sheetDescription" ? 30 : 14; });

  let row = 1;
  if (logo) {
    const imgId = workbook.addImage({ base64: logo, extension: "png" });
    sheet.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 40 } });
    row = 3;
  }

  sheet.mergeCells(row, 1, row, cols.length);
  const titleCell = sheet.getCell(row, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
  titleCell.alignment = { horizontal: "center" };
  row++;

  if (subtitle) {
    sheet.mergeCells(row, 1, row, cols.length);
    const subCell = sheet.getCell(row, 1);
    subCell.value = subtitle;
    subCell.font = { size: 10, color: { argb: "FF64748B" } };
    subCell.alignment = { horizontal: "center" };
    row++;
  }
  row++;

  // Group band row — one merged, coloured cell per contiguous group.
  const groupRow = sheet.getRow(row);
  let colIdx = 1;
  segs.forEach((seg) => {
    const meta = GROUP_META[seg.group] || GROUP_META.info;
    if (seg.count > 1) sheet.mergeCells(row, colIdx, row, colIdx + seg.count - 1);
    const cell = groupRow.getCell(colIdx);
    cell.value = meta.label;
    cell.font = { bold: true, size: 10, color: { argb: meta.text } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: meta.bg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    for (let i = 0; i < seg.count; i++) {
      groupRow.getCell(colIdx + i).border = { top: thinGray, bottom: thinGray, left: thinGray, right: thinGray };
    }
    colIdx += seg.count;
  });
  row++;

  // Column label row.
  const labelRow = sheet.getRow(row);
  cols.forEach((c, i) => {
    const cell = labelRow.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    cell.alignment = { horizontal: c.align === "center" ? "center" : "left", vertical: "middle", wrapText: true };
    cell.border = { top: thinGray, bottom: thinGray, left: thinGray, right: thinGray };
  });
  row++;

  rows.forEach((r, idx) => {
    const dataRow = sheet.getRow(row);
    cols.forEach((c, i) => {
      const cell = dataRow.getCell(i + 1);
      const v = c.value(r);
      cell.value = v == null ? "" : v;
      cell.alignment = { horizontal: c.align === "center" ? "center" : "left" };
      cell.border = { top: thinGray, bottom: thinGray, left: thinGray, right: thinGray };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
    row++;
  });

  // TOTAL / AVG footer row.
  const totals = computeProductionTotals(rows);
  const footRow = sheet.getRow(row);
  cols.forEach((c, i) => {
    const cell = footRow.getCell(i + 1);
    if (i === 0) cell.value = "TOTAL / AVG";
    else if (AGG_SUM.has(c.key)) cell.value = Math.round(totals[c.key]);
    else if (AGG_AVG.has(c.key)) cell.value = `${totals[c.key].toFixed(1)}%`;
    cell.font = { bold: true, color: { argb: "FF1E293B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.alignment = { horizontal: c.align === "center" ? "center" : "left" };
    cell.border = { top: thinGray, bottom: thinGray, left: thinGray, right: thinGray };
  });

  sheet.autoFilter = { from: { row: row - rows.length - 1, column: 1 }, to: { row: row - rows.length - 1, column: cols.length } };

  return workbook.xlsx.writeBuffer();
};
