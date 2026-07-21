/**
 * Server-side port of Frontend/src/utils/reportExport.js's exportSectionsToExcel
 * — byte-for-byte the same layout algorithm (single sheet, logo, merged
 * title/subtitle, sections stacked vertically with a heading row above each
 * table), so the Quality/Downtime/Hourly email attachments are the exact
 * same workbook a subscriber would get clicking "Export Excel" on those
 * report pages. Chart ("image") blocks are skipped — the frontend version
 * embeds a captured chart.js canvas via `dataUrl`, which doesn't exist
 * server-side, and the numbers behind every chart already live in the table
 * right next to it.
 *
 *   block = { type: "table", heading, columns: [{ label, align, value(row) }], rows }
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

export const buildSectionsExcel = async ({ title, subtitle, blocks }) => {
  const logo = loadLogoBase64();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  const tableBlocks = (blocks || []).filter((b) => b.type === "table");
  const maxCols = Math.max(4, ...tableBlocks.map((b) => b.columns.length));
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

  tableBlocks.forEach((block) => {
    if (!block.rows?.length) return;

    sheet.mergeCells(row, 1, row, maxCols);
    const headCell = sheet.getCell(row, 1);
    headCell.value = block.heading;
    headCell.font = { bold: true, size: 12, color: { argb: "FF1E293B" } };
    row++;

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

  return workbook.xlsx.writeBuffer();
};
