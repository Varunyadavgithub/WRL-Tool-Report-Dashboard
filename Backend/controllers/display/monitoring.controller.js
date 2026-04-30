import ExcelJS from "exceljs";
import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// --- Pool helper --------------------------------------------------------------
const withPool = async (callback) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
};

const safeInt = (val, fallback = null) => {
  if (val === undefined || val === null || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const safeBool = (val, fallback = true) => {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val === "boolean") return val;
  return String(val).trim().toUpperCase() !== "FALSE";
};

// ── column & group metadata (mirrors the React COLUMNS / GROUP_CONFIG) ────────
const GROUPS = [
  {
    label: "General",
    hex: "6366F1",
    fields: ["DashboardName", "LineName", "LineCode", "WorkingTimeMin"],
  },
  {
    label: "Display 1",
    hex: "0EA5E9",
    fields: [
      "StationCode1",
      "StationName1",
      "LineTaktTime1",
      "LineMonthlyProduction1",
      "LineTarget1",
    ],
  },
  {
    label: "Display 2",
    hex: "F59E0B",
    fields: [
      "StationCode2",
      "StationName2",
      "LineTaktTime2",
      "LineMonthlyProduction2",
    ],
  },
  {
    label: "Quality",
    hex: "8B5CF6",
    fields: ["QualityProcessCode", "QualityLineName"],
  },
  { label: "Loss", hex: "EF4444", fields: ["SectionName"] },
  {
    label: "Visibility",
    hex: "10B981",
    fields: [
      "ShowDisplay1",
      "ShowDisplay2",
      "ShowHourly",
      "ShowQuality",
      "ShowLoss",
    ],
  },
];

const BOOL_FIELDS = new Set([
  "ShowDisplay1",
  "ShowDisplay2",
  "ShowHourly",
  "ShowQuality",
  "ShowLoss",
]);
const NUM_FIELDS = new Set([
  "WorkingTimeMin",
  "LineTaktTime1",
  "LineMonthlyProduction1",
  "LineTarget1",
  "LineTaktTime2",
  "LineMonthlyProduction2",
]);

const ALL_COLS = ["Id", ...GROUPS.flatMap((g) => g.fields)];

const COL_LABELS = {
  Id: "ID",
  DashboardName: "Dashboard Name",
  LineName: "Line Name",
  LineCode: "Line Code",
  WorkingTimeMin: "Working Time (min)",
  StationCode1: "Station Code 1",
  StationName1: "Station Name 1",
  LineTaktTime1: "Takt Time 1 (s)",
  LineMonthlyProduction1: "Monthly Prod 1",
  LineTarget1: "Target UPH",
  StationCode2: "Station Code 2",
  StationName2: "Station Name 2",
  LineTaktTime2: "Takt Time 2 (s)",
  LineMonthlyProduction2: "Monthly Prod 2",
  QualityProcessCode: "Quality Process Code",
  QualityLineName: "Quality Line Name",
  SectionName: "Section Name",
  ShowDisplay1: "Show Display 1",
  ShowDisplay2: "Show Display 2",
  ShowHourly: "Show Hourly",
  ShowQuality: "Show Quality",
  ShowLoss: "Show Loss",
};

const COL_WIDTHS = {
  Id: 7,
  DashboardName: 28,
  LineName: 18,
  LineCode: 12,
  WorkingTimeMin: 14,
  StationCode1: 14,
  StationName1: 18,
  LineTaktTime1: 12,
  LineMonthlyProduction1: 16,
  LineTarget1: 11,
  StationCode2: 14,
  StationName2: 18,
  LineTaktTime2: 12,
  LineMonthlyProduction2: 16,
  QualityProcessCode: 26,
  QualityLineName: 18,
  SectionName: 26,
  ShowDisplay1: 13,
  ShowDisplay2: 13,
  ShowHourly: 11,
  ShowQuality: 11,
  ShowLoss: 10,
};

// ── build field → group colour lookup ────────────────────────────────────────
const fieldHex = {};
for (const g of GROUPS) for (const f of g.fields) fieldHex[f] = g.hex;

// ── style helpers ─────────────────────────────────────────────────────────────
const hexFill = (argb) => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

const borderThin = {
  top: { style: "thin", color: { argb: "D1D5DB" } },
  left: { style: "thin", color: { argb: "D1D5DB" } },
  bottom: { style: "thin", color: { argb: "D1D5DB" } },
  right: { style: "thin", color: { argb: "D1D5DB" } },
};

function applyHeaderCell(cell, value, bgArgb, size = 9, bold = true) {
  cell.value = value;
  cell.font = { name: "Arial", bold, size, color: { argb: "FFFFFF" } };
  cell.fill = hexFill(bgArgb);
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = borderThin;
}

function applyDataCell(cell, value, col) {
  cell.value = value;
  cell.font = { name: "Arial", size: 9, color: { argb: "111827" } };
  cell.border = borderThin;
  cell.alignment = {
    horizontal: NUM_FIELDS.has(col) || col === "Id" ? "center" : "left",
    vertical: "middle",
  };
  if (BOOL_FIELDS.has(col)) {
    cell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: { argb: value ? "10B981" : "6B7280" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  EXPORT
// ═════════════════════════════════════════════════════════════════════════════
export const exportDashboardConfigs = tryCatch(async (req, res) => {
  const rows = await withPool(async (pool) => {
    const result = await pool
      .request()
      .query(
        "SELECT * FROM dbo.DashboardConfig WHERE IsActive = 1 ORDER BY CreatedAt DESC",
      );
    return result.recordset;
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard Manager";
  wb.created = new Date();

  const ws = wb.addWorksheet("DashboardConfigs", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
  });

  // ── Row 1: Title ────────────────────────────────────────────────────────────
  ws.getRow(1).height = 28;
  const titleCell = ws.getCell("A1");
  titleCell.value = "Dashboard Configuration — Export / Import Template";
  titleCell.font = {
    name: "Arial",
    bold: true,
    size: 13,
    color: { argb: "FFFFFF" },
  };
  titleCell.fill = hexFill("1E293B");
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(1, 1, 1, ALL_COLS.length);

  // ── Row 2: Group headers ────────────────────────────────────────────────────
  ws.getRow(2).height = 22;
  // Id header
  applyHeaderCell(ws.getCell(2, 1), "ID", "334155");

  let colOffset = 2;
  for (const grp of GROUPS) {
    applyHeaderCell(ws.getCell(2, colOffset), grp.label.toUpperCase(), grp.hex);
    if (grp.fields.length > 1) {
      ws.mergeCells(2, colOffset, 2, colOffset + grp.fields.length - 1);
    }
    colOffset += grp.fields.length;
  }

  // ── Row 3: Column headers ───────────────────────────────────────────────────
  ws.getRow(3).height = 20;
  for (let ci = 0; ci < ALL_COLS.length; ci++) {
    const col = ALL_COLS[ci];
    const hex = col === "Id" ? "475569" : (fieldHex[col] ?? "475569") + "CC";
    applyHeaderCell(ws.getCell(3, ci + 1), COL_LABELS[col] ?? col, hex, 8);
  }

  // ── Row 4: Hint row ─────────────────────────────────────────────────────────
  ws.getRow(4).height = 15;
  for (let ci = 0; ci < ALL_COLS.length; ci++) {
    const col = ALL_COLS[ci];
    const cell = ws.getCell(4, ci + 1);
    cell.value =
      col === "Id"
        ? "Leave blank to create new"
        : BOOL_FIELDS.has(col)
          ? "TRUE / FALSE"
          : NUM_FIELDS.has(col)
            ? "Number"
            : col === "QualityProcessCode"
              ? "Comma-separated"
              : "Text";
    cell.font = {
      name: "Arial",
      italic: true,
      size: 7,
      color: { argb: "6B7280" },
    };
    cell.fill = hexFill("F8FAFC");
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderThin;
  }

  // ── Column widths ───────────────────────────────────────────────────────────
  for (let ci = 0; ci < ALL_COLS.length; ci++) {
    ws.getColumn(ci + 1).width = COL_WIDTHS[ALL_COLS[ci]] ?? 14;
  }

  // ── Data rows (start at row 5) ──────────────────────────────────────────────
  for (const row of rows) {
    const exRow = ws.addRow([]);
    exRow.height = 16;
    for (let ci = 0; ci < ALL_COLS.length; ci++) {
      const col = ALL_COLS[ci];
      const dbKey = col; // DB columns match exactly
      let value = row[dbKey] ?? null;
      // Normalise booleans from SQL bit (0/1)
      if (BOOL_FIELDS.has(col))
        value = value !== 0 && value !== false && value !== null;
      applyDataCell(exRow.getCell(ci + 1), value, col);
    }
  }

  // ── Alternating row shading ─────────────────────────────────────────────────
  const dataStartRow = 5;
  for (let ri = dataStartRow; ri <= dataStartRow + rows.length - 1; ri++) {
    if (ri % 2 === 0) {
      const r = ws.getRow(ri);
      for (let ci = 1; ci <= ALL_COLS.length; ci++) {
        const cell = r.getCell(ci);
        if (!cell.fill || cell.fill.type !== "pattern") continue;
        // Light stripe — only override cells that haven't been coloured already
        if (!BOOL_FIELDS.has(ALL_COLS[ci - 1])) {
          cell.fill = hexFill("F1F5F9");
        }
      }
    }
  }

  // ── Dropdown validation for boolean columns ─────────────────────────────────
  for (let ci = 0; ci < ALL_COLS.length; ci++) {
    if (BOOL_FIELDS.has(ALL_COLS[ci])) {
      ws.getColumn(ci + 1).eachCell({ includeEmpty: false }, (cell, rowNum) => {
        if (rowNum >= 5) {
          cell.dataValidation = {
            type: "list",
            allowBlank: false,
            formulae: ['"TRUE,FALSE"'],
            showDropDown: false,
          };
        }
      });
    }
  }

  // ── Instructions sheet ──────────────────────────────────────────────────────
  const ins = wb.addWorksheet("Instructions");
  ins.views = [{ showGridLines: false }];
  ins.getColumn(1).width = 4;
  ins.getColumn(2).width = 30;
  ins.getColumn(3).width = 65;

  const addInsRow = (label, desc, labelColor = "6366F1") => {
    const r = ins.addRow(["", label, desc]);
    r.getCell(2).font = {
      name: "Arial",
      bold: true,
      size: 9,
      color: { argb: labelColor },
    };
    r.getCell(3).font = { name: "Arial", size: 9, color: { argb: "374151" } };
    r.height = 14;
  };

  const insTitle = ins.addRow(["", "HOW TO USE THIS IMPORT FILE"]);
  insTitle.getCell(2).font = {
    name: "Arial",
    bold: true,
    size: 12,
    color: { argb: "FFFFFF" },
  };
  insTitle.getCell(2).fill = hexFill("1E293B");
  insTitle.height = 24;
  ins.mergeCells(insTitle.number, 2, insTitle.number, 3);

  ins.addRow([]);
  addInsRow(
    "1.",
    "Do NOT modify rows 1–4 (title/group/column/hint rows).",
    "EF4444",
  );
  addInsRow("2.", "To EDIT an existing config: keep the Id value intact.");
  addInsRow("3.", "To ADD a new config: leave the Id cell blank.");
  addInsRow(
    "4.",
    "Visibility columns must be exactly TRUE or FALSE (use the dropdown).",
  );
  addInsRow(
    "5.",
    "Numeric columns must contain numbers only — no units or text.",
  );
  addInsRow(
    "6.",
    "QualityProcessCode accepts comma-separated codes, e.g. 12210,12206.",
  );
  addInsRow(
    "7.",
    "Save as .xlsx and upload using the Import button in the UI.",
  );
  ins.addRow([]);

  const fldTitle = ins.addRow(["", "FIELD REFERENCE"]);
  fldTitle.getCell(2).font = {
    name: "Arial",
    bold: true,
    size: 11,
    color: { argb: "FFFFFF" },
  };
  fldTitle.getCell(2).fill = hexFill("334155");
  fldTitle.height = 20;
  ins.mergeCells(fldTitle.number, 2, fldTitle.number, 3);

  const fieldDocs = [
    ["DashboardName", "Required. Unique name for this dashboard."],
    ["LineName", "Production line name (e.g. FREEZER)."],
    [
      "LineCode",
      "Line code used to filter ProcessActivity.Remark. Comma-separated for multiple.",
    ],
    [
      "WorkingTimeMin",
      "Shift working time in minutes (e.g. 720 for 12 h shift).",
    ],
    [
      "StationCode1",
      "Required. Primary station code for the FG Packing / Display 1 page.",
    ],
    ["StationName1", "Friendly name for Station 1."],
    ["LineTaktTime1", "Takt time in seconds for Station 1 (e.g. 40)."],
    [
      "LineMonthlyProduction1",
      "Monthly production plan quantity for Station 1.",
    ],
    ["LineTarget1", "UPH (Units Per Hour) target."],
    [
      "StationCode2",
      "Secondary station code for FG Loading / Display 2. Optional.",
    ],
    ["StationName2", "Friendly name for Station 2."],
    ["LineTaktTime2", "Takt time in seconds for Station 2."],
    ["LineMonthlyProduction2", "Monthly production plan for Station 2."],
    ["QualityProcessCode", "Comma-separated quality inspection process codes."],
    ["QualityLineName", "Line name used in the Quality module."],
    ["SectionName", "EMGMaster.Location value for Loss Analysis."],
    [
      "ShowDisplay1",
      "TRUE = display the Production Display 1 (FG Packing) page.",
    ],
    [
      "ShowDisplay2",
      "TRUE = display the Production Display 2 (FG Loading) page.",
    ],
    ["ShowHourly", "TRUE = display the Hourly Production page."],
    ["ShowQuality", "TRUE = display the Quality page."],
    ["ShowLoss", "TRUE = display the Loss Analysis page."],
  ];
  for (const [field, desc] of fieldDocs) addInsRow(field, desc);

  // ── Stream response ─────────────────────────────────────────────────────────
  const filename = `dashboard_configs_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await wb.xlsx.write(res);
  res.end();
});

// ═════════════════════════════════════════════════════════════════════════════
//  IMPORT
// ═════════════════════════════════════════════════════════════════════════════
export const importDashboardConfigs = tryCatch(async (req, res) => {
  if (!req.file)
    throw new AppError("No file uploaded. Send a .xlsx file as 'file'.", 400);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);

  const ws = wb.getWorksheet("DashboardConfigs");
  if (!ws)
    throw new AppError(
      "Worksheet 'DashboardConfigs' not found in the uploaded file.",
      400,
    );

  // ── Locate the header row (look for "DashboardName" / "ID" in any of rows 1-5)
  let headerRowNum = null;
  let colMap = {}; // fieldName → 1-based column index

  for (let r = 1; r <= 5; r++) {
    const row = ws.getRow(r);
    const found = {};
    row.eachCell({ includeEmpty: false }, (cell, colNum) => {
      const v = String(cell.value ?? "").trim();
      // Match by label OR by raw field name
      for (const col of ALL_COLS) {
        if (
          v.toLowerCase() === COL_LABELS[col].toLowerCase() ||
          v.toLowerCase() === col.toLowerCase()
        ) {
          found[col] = colNum;
        }
      }
    });
    if (found.DashboardName) {
      headerRowNum = r;
      colMap = found;
      break;
    }
  }

  if (!headerRowNum) {
    throw new AppError(
      "Could not locate the column header row. Ensure you are using the exported template and that row 3 contains column headers.",
      400,
    );
  }

  // ── Parse data rows ──────────────────────────────────────────────────────────
  const records = [];
  const errors = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum <= headerRowNum) return; // skip header rows
    if (rowNum === headerRowNum + 1) {
      // Check if this is the hint row (non-numeric Id like "Leave blank…")
      const idVal = row.getCell(colMap.Id ?? 1).value;
      if (typeof idVal === "string" && isNaN(Number(idVal))) return;
    }

    const get = (field) => {
      const ci = colMap[field];
      if (!ci) return undefined;
      const v = row.getCell(ci).value;
      // ExcelJS may return objects for rich-text or formula cells
      if (v && typeof v === "object" && "result" in v) return v.result;
      if (v && typeof v === "object" && "text" in v) return v.text;
      return v;
    };

    const dashboardName = String(get("DashboardName") ?? "").trim();
    const stationCode1 = String(get("StationCode1") ?? "").trim();

    // Skip completely empty rows
    if (!dashboardName && !stationCode1) return;

    if (!dashboardName) {
      errors.push({ row: rowNum, issue: "DashboardName is required." });
      return;
    }
    if (!stationCode1) {
      errors.push({ row: rowNum, issue: "StationCode1 is required." });
      return;
    }

    const idRaw = get("Id");
    const id =
      idRaw !== null && idRaw !== undefined && idRaw !== ""
        ? Number(idRaw)
        : null;

    records.push({
      id: Number.isInteger(id) && id > 0 ? id : null,
      dashboardName,
      lineName: String(get("LineName") ?? "").trim(),
      lineCode: String(get("LineCode") ?? "").trim(),
      workingTimeMin: safeInt(get("WorkingTimeMin"), 720),
      stationCode1,
      stationName1: String(get("StationName1") ?? "").trim(),
      lineTaktTime1: safeInt(get("LineTaktTime1"), 40),
      lineMonthlyProduction1: safeInt(get("LineMonthlyProduction1"), 0),
      lineTarget1: safeInt(get("LineTarget1"), 0),
      stationCode2: String(get("StationCode2") ?? "").trim() || null,
      stationName2: String(get("StationName2") ?? "").trim() || null,
      lineTaktTime2: safeInt(get("LineTaktTime2")),
      lineMonthlyProduction2: safeInt(get("LineMonthlyProduction2")),
      qualityProcessCode:
        String(get("QualityProcessCode") ?? "").trim() || null,
      qualityLineName: String(get("QualityLineName") ?? "").trim() || null,
      sectionName: String(get("SectionName") ?? "").trim() || null,
      showDisplay1: safeBool(get("ShowDisplay1")),
      showDisplay2: safeBool(get("ShowDisplay2")),
      showHourly: safeBool(get("ShowHourly")),
      showQuality: safeBool(get("ShowQuality")),
      showLoss: safeBool(get("ShowLoss")),
    });
  });

  if (records.length === 0) {
    throw new AppError(
      `No valid data rows found. ${errors.length ? `Row errors: ${errors.map((e) => `row ${e.row}: ${e.issue}`).join("; ")}.` : "The sheet appears to be empty."}`,
      400,
    );
  }

  // ── Upsert to DB ─────────────────────────────────────────────────────────────
  const results = {
    created: 0,
    updated: 0,
    skipped: errors.length,
    rowErrors: errors,
  };

  await withPool(async (pool) => {
    for (const rec of records) {
      if (rec.id) {
        // UPDATE existing
        const check = await pool
          .request()
          .input("Id", sql.Int, rec.id)
          .query(
            "SELECT Id FROM dbo.DashboardConfig WHERE Id = @Id AND IsActive = 1",
          );

        if (check.recordset.length === 0) {
          results.rowErrors.push({
            id: rec.id,
            issue: `Id ${rec.id} not found — skipped.`,
          });
          results.skipped++;
          continue;
        }

        await pool
          .request()
          .input("Id", sql.Int, rec.id)
          .input("DashboardName", sql.NVarChar(120), rec.dashboardName)
          .input("LineName", sql.NVarChar(100), rec.lineName)
          .input("LineCode", sql.NVarChar(50), rec.lineCode)
          .input("StationCode1", sql.NVarChar(50), rec.stationCode1)
          .input("StationName1", sql.NVarChar(100), rec.stationName1)
          .input("LineTaktTime1", sql.Int, rec.lineTaktTime1)
          .input("LineMonthlyProduction1", sql.Int, rec.lineMonthlyProduction1)
          .input("LineTarget1", sql.Int, rec.lineTarget1)
          .input("StationCode2", sql.NVarChar(50), rec.stationCode2)
          .input("StationName2", sql.NVarChar(100), rec.stationName2)
          .input("LineTaktTime2", sql.Int, rec.lineTaktTime2)
          .input("LineMonthlyProduction2", sql.Int, rec.lineMonthlyProduction2)
          .input(
            "QualityProcessCode",
            sql.NVarChar(500),
            rec.qualityProcessCode,
          )
          .input("QualityLineName", sql.NVarChar(100), rec.qualityLineName)
          .input("SectionName", sql.NVarChar(200), rec.sectionName)
          .input("WorkingTimeMin", sql.Int, rec.workingTimeMin)
          .input("ShowDisplay1", sql.Bit, rec.showDisplay1)
          .input("ShowDisplay2", sql.Bit, rec.showDisplay2)
          .input("ShowHourly", sql.Bit, rec.showHourly)
          .input("ShowQuality", sql.Bit, rec.showQuality)
          .input("ShowLoss", sql.Bit, rec.showLoss).query(`
            UPDATE dbo.DashboardConfig
            SET DashboardName=@DashboardName, LineName=@LineName, LineCode=@LineCode,
                StationCode1=@StationCode1, StationName1=@StationName1,
                LineTaktTime1=@LineTaktTime1, LineMonthlyProduction1=@LineMonthlyProduction1,
                LineTarget1=@LineTarget1, StationCode2=@StationCode2, StationName2=@StationName2,
                LineTaktTime2=@LineTaktTime2, LineMonthlyProduction2=@LineMonthlyProduction2,
                QualityProcessCode=@QualityProcessCode, QualityLineName=@QualityLineName,
                SectionName=@SectionName, WorkingTimeMin=@WorkingTimeMin,
                ShowDisplay1=@ShowDisplay1, ShowDisplay2=@ShowDisplay2,
                ShowHourly=@ShowHourly, ShowQuality=@ShowQuality, ShowLoss=@ShowLoss,
                UpdatedAt=GETDATE()
            WHERE Id=@Id AND IsActive=1
          `);
        results.updated++;
      } else {
        // INSERT new
        await pool
          .request()
          .input("DashboardName", sql.NVarChar(120), rec.dashboardName)
          .input("LineName", sql.NVarChar(100), rec.lineName)
          .input("LineCode", sql.NVarChar(50), rec.lineCode)
          .input("StationCode1", sql.NVarChar(50), rec.stationCode1)
          .input("StationName1", sql.NVarChar(100), rec.stationName1)
          .input("LineTaktTime1", sql.Int, rec.lineTaktTime1)
          .input("LineMonthlyProduction1", sql.Int, rec.lineMonthlyProduction1)
          .input("LineTarget1", sql.Int, rec.lineTarget1)
          .input("StationCode2", sql.NVarChar(50), rec.stationCode2)
          .input("StationName2", sql.NVarChar(100), rec.stationName2)
          .input("LineTaktTime2", sql.Int, rec.lineTaktTime2)
          .input("LineMonthlyProduction2", sql.Int, rec.lineMonthlyProduction2)
          .input(
            "QualityProcessCode",
            sql.NVarChar(500),
            rec.qualityProcessCode,
          )
          .input("QualityLineName", sql.NVarChar(100), rec.qualityLineName)
          .input("SectionName", sql.NVarChar(200), rec.sectionName)
          .input("WorkingTimeMin", sql.Int, rec.workingTimeMin)
          .input("ShowDisplay1", sql.Bit, rec.showDisplay1)
          .input("ShowDisplay2", sql.Bit, rec.showDisplay2)
          .input("ShowHourly", sql.Bit, rec.showHourly)
          .input("ShowQuality", sql.Bit, rec.showQuality)
          .input("ShowLoss", sql.Bit, rec.showLoss).query(`
            INSERT INTO dbo.DashboardConfig (
              DashboardName,LineName,LineCode,StationCode1,StationName1,
              LineTaktTime1,LineMonthlyProduction1,LineTarget1,StationCode2,StationName2,
              LineTaktTime2,LineMonthlyProduction2,QualityProcessCode,QualityLineName,
              SectionName,WorkingTimeMin,IsActive,CreatedAt,UpdatedAt,
              ShowDisplay1,ShowDisplay2,ShowHourly,ShowQuality,ShowLoss
            ) VALUES (
              @DashboardName,@LineName,@LineCode,@StationCode1,@StationName1,
              @LineTaktTime1,@LineMonthlyProduction1,@LineTarget1,@StationCode2,@StationName2,
              @LineTaktTime2,@LineMonthlyProduction2,@QualityProcessCode,@QualityLineName,
              @SectionName,@WorkingTimeMin,1,GETDATE(),GETDATE(),
              @ShowDisplay1,@ShowDisplay2,@ShowHourly,@ShowQuality,@ShowLoss
            )
          `);
        results.created++;
      }
    }
  });

  res.status(200).json({
    success: true,
    message: `Import complete. ${results.created} created, ${results.updated} updated, ${results.skipped} skipped.`,
    results,
  });
});

// --- Shift boundary resolver --------------------------------------------------
const resolveShiftBounds = (shiftDate, shift) => {
  const base = new Date(shiftDate);
  if (shift === "A") {
    const start = new Date(base);
    start.setHours(8, 0, 0, 0);
    const end = new Date(base);
    end.setHours(20, 0, 0, 0);
    return { shiftStart: start, shiftEnd: end };
  }
  // Shift B: 20:00 on shiftDate ? 08:00 next day
  const start = new Date(base);
  start.setHours(20, 0, 0, 0);
  const end = new Date(base);
  end.setDate(base.getDate() + 1);
  end.setHours(8, 0, 0, 0);
  return { shiftStart: start, shiftEnd: end };
};

// --- Shared param validator ---------------------------------------------------
const validateShiftParams = (req) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate)
    throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift))
    throw new AppError("Invalid shift. Must be A or B.", 400);
  return { shiftDate, shift };
};

// --- configId validator -------------------------------------------------------
const validateConfigId = (req) => {
  const configId = req.query.configId || req.params.id;

  if (!configId) throw new AppError("Missing configId.", 400);

  const id = Number(configId);

  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("Invalid config id.", 400);

  return id;
};

// --- Config fetcher -----------------------------------------------------------
const getConfig = async (pool, configId) => {
  const result = await pool
    .request()
    .input("Id", sql.Int, configId)
    .query("SELECT * FROM dbo.DashboardConfig WHERE Id = @Id AND IsActive = 1");
  return result.recordset[0] || null;
};

// --- Month boundaries helper --------------------------------------------------
const resolveMonthBounds = (shiftStart) => {
  const monthStart = new Date(
    shiftStart.getFullYear(),
    shiftStart.getMonth(),
    1,
    8,
    0,
    0,
  );
  const monthEnd = new Date(
    shiftStart.getFullYear(),
    shiftStart.getMonth() + 1,
    1,
    8,
    0,
    0,
  );
  return { monthStart, monthEnd };
};

// --- Shared FG query builder --------------------------------------------------
// FIX #7: Removed unused shiftActualAlias parameter — it was accepted but never
//         interpolated into the query template, making it dead code.
const buildFGQuery = () => `
  WITH ShiftActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode1)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  @shiftEnd
),
MonthlyActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode1)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @monthStart
      AND ActivityOn  <  @monthEnd
),
HourlyProduction AS (
    SELECT 
        DATEPART(HOUR, ActivityOn) AS Hr,
        COUNT(PSNo) AS HourlyQty
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode1)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  CASE 
                            WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                            ELSE GETDATE() 
                         END
    GROUP BY DATEPART(HOUR, ActivityOn)
),
AvgUPH AS (
    SELECT 
        AVG(CAST(HourlyQty AS FLOAT)) AS AvgUPH
    FROM HourlyProduction
)

SELECT
    dc.LineMonthlyProduction1 AS MonthlyPlanQty,
    dc.WorkingTimeMin,
    dc.LineTaktTime1          AS TactTimeSec,
    -- Actual Working Minutes
ROUND(
    DATEDIFF(
        MINUTE,
        @shiftStart,
        CASE 
            WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
            ELSE GETDATE() 
        END
    ) * 0.92, 0
) AS ActualWorkingMin,

    -- Actual Takt Time
    CAST(
        DATEDIFF(
            SECOND,
            @shiftStart,
            CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                ELSE GETDATE() 
            END
        ) * 1.0
        / NULLIF(sa.ActualFG, 0)
    AS DECIMAL(10,2)) AS ActualTaktTimeSec,

    -- Shift Target
    CAST(
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
    AS INT) AS ShiftOutputTarget,

    dc.LineTarget1 AS UPHTarget,

    sa.ActualFG AS ActualQty,

    -- Loss Time
    CAST(
      (
        (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        - sa.ActualFG
      ) * dc.LineTaktTime1 / 60.0
    AS INT) AS LossTime,

    -- Loss Units
    CAST(
      (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
      - sa.ActualFG
    AS INT) AS LossUnits,

    -- Balance
    CAST(dc.LineMonthlyProduction1 * 1.0
      / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
    AS INT) - sa.ActualFG AS BalanceQty,

    -- Prorated Target
    CAST(
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
    AS INT) AS ProratedTarget,

    -- Performance
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS PerformancePct,

    -- Efficiency
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS EfficiencyTillNow,

    -- Actual UPH
    CAST(
      sa.ActualFG * 60.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
    AS DECIMAL(6,2)) AS ActualUPH,

    CAST(au.AvgUPH AS DECIMAL(10,2)) AS ActualUPH_Avg,

    sa.ActualFG AS GaugeValue,
    ma.ActualFG AS MonthlyAchieved,

    dc.LineMonthlyProduction1 - ma.ActualFG AS MonthlyRemaining,

    -- Asking Rate
    CAST(
      (dc.LineMonthlyProduction1 - ma.ActualFG) * 1.0
      / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1, 0)
    AS INT) AS AskingRate,

    DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1 AS RemainingDays,

    -- Time %
    DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
      AS ConsumedTimePct

FROM dbo.DashboardConfig dc
CROSS JOIN ShiftActual   sa
CROSS JOIN MonthlyActual ma
CROSS JOIN AvgUPH au
WHERE dc.Id = @configId;
`;

// --- Shared FG request binder -------------------------------------------------
// FIX #1: Added @currentTime binding — buildFGQuery uses it in 3 places but it
//         was never bound here, causing a SQL runtime "must declare scalar variable" error.
// FIX #2: istStart/istEnd already converted by caller; monthStart/monthEnd still need conversion.
// FIX #3: stationCode1 is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
// FIX #4: lineCode is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
const bindFGRequest = (
  req,
  { configId, lineCode, istStart, istEnd, stationCode1, monthStart, monthEnd },
) => {
  // Cap currentTime at shiftEnd so that viewing a past shift (e.g. yesterday)
  // doesn't compute ActualWorkingMin / UPH from shiftStart all the way to *now*.
  // Without this cap, April 25 Shift A opened on April 26 gives
  //   DATEDIFF(MINUTE, Apr25-08:00, Apr26-09:20) = 1520 instead of 720.
  const now = new Date();
  const cappedCurrentTime = now > istEnd ? istEnd : now;

  return req
    .input("configId", sql.Int, configId)
    .input("lineCode", sql.NVarChar(50), String(lineCode))
    .input("shiftStart", sql.DateTime, istStart)
    .input("shiftEnd", sql.DateTime, istEnd)
    .input("currentTime", sql.DateTime, cappedCurrentTime) // FIX: capped at shiftEnd
    .input("monthStart", sql.DateTime, convertToIST(monthStart))
    .input("monthEnd", sql.DateTime, convertToIST(monthEnd))
    .input("stationCode1", sql.NVarChar(50), String(stationCode1));
};

// --- Loading query builder ----------------------------------------------------
// FIX #7: Removed unused shiftActualAlias parameter.
const buildLoadingQuery = () => `
   WITH ShiftActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode2)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  @shiftEnd
),
MonthlyActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode2)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @monthStart
      AND ActivityOn  <  @monthEnd
),
HourlyProduction AS (
    SELECT 
        DATEPART(HOUR, ActivityOn) AS Hr,
        COUNT(PSNo) AS HourlyQty
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode2)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  CASE 
                            WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                            ELSE GETDATE() 
                         END
    GROUP BY DATEPART(HOUR, ActivityOn)
),
AvgUPH AS (
    SELECT 
        AVG(CAST(HourlyQty AS FLOAT)) AS AvgUPH
    FROM HourlyProduction
)

SELECT
    dc.LineMonthlyProduction1 AS MonthlyPlanQty,
    dc.WorkingTimeMin,
    dc.LineTaktTime1          AS TactTimeSec,
    -- Actual Working Minutes
  ROUND(
      DATEDIFF(
          MINUTE,
          @shiftStart,
          CASE 
              WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
              ELSE GETDATE() 
          END
      ) * 0.92, 0
  ) AS ActualWorkingMin,

    -- Actual Takt Time
    CAST(
        DATEDIFF(
            SECOND,
            @shiftStart,
            CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                ELSE GETDATE() 
            END
        ) * 1.0
        / NULLIF(sa.ActualFG, 0)
    AS DECIMAL(10,2)) AS ActualTaktTimeSec,

    -- Shift Target
    CAST(
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
    AS INT) AS ShiftOutputTarget,

    dc.LineTarget1 AS UPHTarget,

    sa.ActualFG AS ActualQty,

    -- Loss Time
    CAST(
      (
        (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        - sa.ActualFG
      ) * dc.LineTaktTime1 / 60.0
    AS INT) AS LossTime,

    -- Loss Units
    CAST(
      (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
      - sa.ActualFG
    AS INT) AS LossUnits,

    -- Balance
    CAST(dc.LineMonthlyProduction1 * 1.0
      / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
    AS INT) - sa.ActualFG AS BalanceQty,

    -- Prorated Target
    CAST(
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
    AS INT) AS ProratedTarget,

    -- Performance
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS PerformancePct,

    -- Efficiency
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS EfficiencyTillNow,

    -- Actual UPH
    CAST(
      sa.ActualFG * 60.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
    AS DECIMAL(6,2)) AS ActualUPH,

    CAST(au.AvgUPH AS DECIMAL(10,2)) AS ActualUPH_Avg,

    sa.ActualFG AS GaugeValue,
    ma.ActualFG AS MonthlyAchieved,

    dc.LineMonthlyProduction1 - ma.ActualFG AS MonthlyRemaining,

    -- Asking Rate
    CAST(
      (dc.LineMonthlyProduction1 - ma.ActualFG) * 1.0
      / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1, 0)
    AS INT) AS AskingRate,

    DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1 AS RemainingDays,

    -- Time %
    DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
      AS ConsumedTimePct

FROM dbo.DashboardConfig dc
CROSS JOIN ShiftActual   sa
CROSS JOIN MonthlyActual ma
CROSS JOIN AvgUPH au
WHERE dc.Id = @configId;
`;

// --- Loading request binder ---------------------------------------------------
// FIX #5: stationCode2 is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
// FIX #6: lineCode is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
const bindLoadingRequest = (
  req,
  { configId, lineCode, istStart, istEnd, stationCode2, monthStart, monthEnd },
) =>
  req
    .input("configId", sql.Int, configId)
    .input("lineCode", sql.NVarChar(50), String(lineCode)) // FIX #6
    .input("shiftStart", sql.DateTime, istStart)
    .input("shiftEnd", sql.DateTime, istEnd)
    .input("monthStart", sql.DateTime, convertToIST(monthStart))
    .input("monthEnd", sql.DateTime, convertToIST(monthEnd))
    .input("stationCode2", sql.NVarChar(50), String(stationCode2)); // FIX #5

// -------------------------------------------------------------------------------
//  DASHBOARD CONFIG CRUD
// -------------------------------------------------------------------------------

// GET /dashboard/configs — list all active configs
export const getAllDashboardConfigs = tryCatch(async (req, res) => {
  const data = await withPool(async (pool) => {
    const result = await pool.request().query(`
      SELECT * FROM dbo.DashboardConfig
      WHERE IsActive = 1
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  });
  res.status(200).json({ success: true, data });
});

// GET /dashboard/configs/:id
export const getDashboardConfigById = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("Invalid config id.", 400);

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query(
        "SELECT * FROM dbo.DashboardConfig WHERE Id = @Id AND IsActive = 1",
      );
    return result.recordset[0] || null;
  });
  if (!data) throw new AppError("Dashboard config not found.", 404);
  res.status(200).json({ success: true, data });
});

// PUT /dashboard/configs/:id — create
export const createDashboardConfig = tryCatch(async (req, res) => {
  const {
    dashboardName,
    lineName,
    lineCode,
    stationCode1,
    stationName1,
    lineTaktTime1,
    lineMonthlyProduction1,
    lineTarget1,
    stationCode2,
    stationName2,
    lineTaktTime2,
    lineMonthlyProduction2,
    qualityProcessCode,
    qualityLineName,
    sectionName,
    workingTimeMin,
    showDisplay1,
    showDisplay2,
    showHourly,
    showQuality,
    showLoss,
  } = req.body;

  // --- Validation -----------------------------------------------
  if (!dashboardName?.trim())
    throw new AppError("Dashboard name is required.", 400);
  if (!stationCode1?.trim())
    throw new AppError("Station Code 1 is required.", 400);

  // Helper: safely parse int, returns fallback if value is not a valid number
  const safeInt = (val, fallback = null) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };

  // Validate optional int fields — reject if provided but not numeric
  const optionalIntFields = {
    lineTaktTime2,
    lineMonthlyProduction2,
    workingTimeMin,
  };

  for (const [fieldName, value] of Object.entries(optionalIntFields)) {
    if (value !== undefined && value !== null && value !== "") {
      if (!Number.isFinite(Number(value))) {
        throw new AppError(
          `${fieldName} must be a valid number, received: "${value}".`,
          400,
        );
      }
    }
  }

  // --- DB Insert ------------------------------------------------
  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("DashboardName", sql.NVarChar(120), dashboardName.trim())
      .input("LineName", sql.NVarChar(100), lineName?.trim() || "")
      .input("LineCode", sql.NVarChar(50), lineCode?.trim() || "")
      .input("StationCode1", sql.NVarChar(50), stationCode1.trim())
      .input("StationName1", sql.NVarChar(100), stationName1?.trim() || "")
      .input("LineTaktTime1", sql.Int, safeInt(lineTaktTime1, 40))
      .input(
        "LineMonthlyProduction1",
        sql.Int,
        safeInt(lineMonthlyProduction1, 0),
      )
      .input("LineTarget1", sql.Int, safeInt(lineTarget1, 0))
      .input("StationCode2", sql.NVarChar(50), stationCode2?.trim() || null)
      .input("StationName2", sql.NVarChar(100), stationName2?.trim() || null)
      .input("LineTaktTime2", sql.Int, safeInt(lineTaktTime2))
      .input("LineMonthlyProduction2", sql.Int, safeInt(lineMonthlyProduction2))
      .input(
        "QualityProcessCode",
        sql.NVarChar(500),
        qualityProcessCode?.trim() || null,
      )
      .input(
        "QualityLineName",
        sql.NVarChar(100),
        qualityLineName?.trim() || null,
      )
      .input("SectionName", sql.NVarChar(200), sectionName?.trim() || null)
      .input("ShowDisplay1", sql.Bit, showDisplay1 ?? true)
      .input("ShowDisplay2", sql.Bit, showDisplay2 ?? true)
      .input("ShowHourly", sql.Bit, showHourly ?? true)
      .input("ShowQuality", sql.Bit, showQuality ?? true)
      .input("ShowLoss", sql.Bit, showLoss ?? true)
      .input("WorkingTimeMin", sql.Int, safeInt(workingTimeMin, 600)).query(`
        DECLARE @tmp TABLE (
          Id                    INT,
          DashboardName         NVARCHAR(120),
          LineName              NVARCHAR(100),
          LineCode              NVARCHAR(50),
          WorkingTimeMin        INT,
          StationCode1          NVARCHAR(50),
          StationName1          NVARCHAR(100),
          LineTaktTime1         INT,
          LineMonthlyProduction1 INT,
          LineTarget1           INT,
          StationCode2          NVARCHAR(50),
          StationName2          NVARCHAR(100),
          LineTaktTime2         INT,
          LineMonthlyProduction2 INT,
          QualityProcessCode    NVARCHAR(500),
          QualityLineName       NVARCHAR(100),
          SectionName           NVARCHAR(200),
          IsActive              BIT,
          CreatedAt             DATETIME,
          UpdatedAt             DATETIME,
          CreatedBy             NVARCHAR(100),
          UpdatedBy             NVARCHAR(100),
          ShowDisplay1 BIT,
          ShowDisplay2 BIT,
          ShowHourly   BIT,
          ShowQuality  BIT,
          ShowLoss     BIT
        );

        INSERT INTO dbo.DashboardConfig (
          DashboardName, LineName, LineCode,
          StationCode1, StationName1, LineTaktTime1, LineMonthlyProduction1, LineTarget1,
          StationCode2, StationName2, LineTaktTime2, LineMonthlyProduction2,
          QualityProcessCode, QualityLineName, SectionName, WorkingTimeMin,
          IsActive, CreatedAt, UpdatedAt,ShowDisplay1, ShowDisplay2, ShowHourly, ShowQuality, ShowLoss
        )
        OUTPUT INSERTED.* INTO @tmp
        VALUES (
          @DashboardName, @LineName, @LineCode,
          @StationCode1, @StationName1, @LineTaktTime1, @LineMonthlyProduction1, @LineTarget1,
          @StationCode2, @StationName2, @LineTaktTime2, @LineMonthlyProduction2,
          @QualityProcessCode, @QualityLineName, @SectionName, @WorkingTimeMin,
          1, GETDATE(), GETDATE(),@ShowDisplay1, @ShowDisplay2, @ShowHourly, @ShowQuality, @ShowLoss
        );

        SELECT * FROM @tmp;
      `);

    return result.recordset[0];
  });

  res.status(201).json({
    success: true,
    message: "Dashboard config created.",
    data,
  });
});

// PUT /dashboard/configs/:id — update
export const updateDashboardConfig = tryCatch(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid config id.", 400);
  }

  const {
    dashboardName,
    lineName,
    lineCode,
    stationCode1,
    stationName1,
    lineTaktTime1,
    lineMonthlyProduction1,
    lineTarget1,
    stationCode2,
    stationName2,
    lineTaktTime2,
    lineMonthlyProduction2,
    qualityProcessCode,
    qualityLineName,
    sectionName,
    workingTimeMin,
    showDisplay1,
    showDisplay2,
    showHourly,
    showQuality,
    showLoss,
  } = req.body;

  // ? Safe validations
  if (!dashboardName || !dashboardName.trim()) {
    throw new AppError("Dashboard name is required.", 400);
  }

  if (!String(stationCode1 || "").trim()) {
    throw new AppError("Station Code 1 is required.", 400);
  }

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .input("DashboardName", sql.NVarChar(120), dashboardName.trim())
      .input("LineName", sql.NVarChar(100), lineName?.trim() || "")
      .input("LineCode", sql.NVarChar(50), lineCode?.trim() || "")
      .input("StationCode1", sql.NVarChar(50), String(stationCode1).trim())
      .input("StationName1", sql.NVarChar(100), stationName1?.trim() || "")
      .input("LineTaktTime1", sql.Int, Number(lineTaktTime1) || 40)
      .input(
        "LineMonthlyProduction1",
        sql.Int,
        Number(lineMonthlyProduction1) || 0,
      )
      .input("LineTarget1", sql.Int, Number(lineTarget1) || 0)
      .input("StationCode2", sql.NVarChar(50), stationCode2?.trim() || null)
      .input("StationName2", sql.NVarChar(100), stationName2?.trim() || null)
      .input("LineTaktTime2", sql.Int, Number(lineTaktTime2) || null)
      .input(
        "LineMonthlyProduction2",
        sql.Int,
        Number(lineMonthlyProduction2) || null,
      )
      .input(
        "QualityProcessCode",
        sql.NVarChar(500),
        qualityProcessCode?.trim() || null,
      )
      .input(
        "QualityLineName",
        sql.NVarChar(100),
        qualityLineName?.trim() || null,
      )
      .input("SectionName", sql.NVarChar(200), sectionName?.trim() || null)
      .input("ShowDisplay1", sql.Bit, showDisplay1 ?? true)
      .input("ShowDisplay2", sql.Bit, showDisplay2 ?? true)
      .input("ShowHourly", sql.Bit, showHourly ?? true)
      .input("ShowQuality", sql.Bit, showQuality ?? true)
      .input("ShowLoss", sql.Bit, showLoss ?? true)
      .input("WorkingTimeMin", sql.Int, Number(workingTimeMin) || 720).query(`
        DECLARE @tmp TABLE (
          Id INT,
          DashboardName NVARCHAR(120),
          LineName NVARCHAR(100),
          LineCode NVARCHAR(50),
          WorkingTimeMin INT,
          StationCode1 NVARCHAR(50),
          StationName1 NVARCHAR(100),
          LineTaktTime1 INT,
          LineMonthlyProduction1 INT,
          LineTarget1 INT,
          StationCode2 NVARCHAR(50),
          StationName2 NVARCHAR(100),
          LineTaktTime2 INT,
          LineMonthlyProduction2 INT,
          QualityProcessCode NVARCHAR(500),
          QualityLineName NVARCHAR(100),
          SectionName NVARCHAR(200),
          IsActive BIT,
          CreatedAt DATETIME,
          UpdatedAt DATETIME,
          ShowDisplay1 BIT,
          ShowDisplay2 BIT,
          ShowHourly   BIT,
          ShowQuality  BIT,
          ShowLoss     BIT
        );

        UPDATE dbo.DashboardConfig
        SET
          DashboardName          = @DashboardName,
          LineName               = @LineName,
          LineCode               = @LineCode,
          StationCode1           = @StationCode1,
          StationName1           = @StationName1,
          LineTaktTime1          = @LineTaktTime1,
          LineMonthlyProduction1 = @LineMonthlyProduction1,
          LineTarget1            = @LineTarget1,
          StationCode2           = @StationCode2,
          StationName2           = @StationName2,
          LineTaktTime2          = @LineTaktTime2,
          LineMonthlyProduction2 = @LineMonthlyProduction2,
          QualityProcessCode     = @QualityProcessCode,
          QualityLineName        = @QualityLineName,
          SectionName            = @SectionName,
          WorkingTimeMin         = @WorkingTimeMin,
          UpdatedAt              = GETDATE(),
          ShowDisplay1 = @ShowDisplay1,
          ShowDisplay2 = @ShowDisplay2,
          ShowHourly   = @ShowHourly,
          ShowQuality  = @ShowQuality,
          ShowLoss     = @ShowLoss
        OUTPUT 
          INSERTED.Id,
          INSERTED.DashboardName,
          INSERTED.LineName,
          INSERTED.LineCode,
          INSERTED.WorkingTimeMin,
          INSERTED.StationCode1,
          INSERTED.StationName1,
          INSERTED.LineTaktTime1,
          INSERTED.LineMonthlyProduction1,
          INSERTED.LineTarget1,
          INSERTED.StationCode2,
          INSERTED.StationName2,
          INSERTED.LineTaktTime2,
          INSERTED.LineMonthlyProduction2,
          INSERTED.QualityProcessCode,
          INSERTED.QualityLineName,
          INSERTED.SectionName,
          INSERTED.IsActive,
          INSERTED.CreatedAt,
          INSERTED.UpdatedAt,
          INSERTED.ShowDisplay1,
          INSERTED.ShowDisplay2,
          INSERTED.ShowHourly,
          INSERTED.ShowQuality,
          INSERTED.ShowLoss
        INTO @tmp
        WHERE Id = @Id AND IsActive = 1;

        SELECT * FROM @tmp;
      `);

    return result.recordset[0] || null;
  });

  if (!data) {
    throw new AppError("Dashboard config not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Dashboard config updated successfully.",
    data,
  });
});

// DELETE /dashboard/configs/:id — soft delete
export const deleteDashboardConfig = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("Invalid config id.", 400);

  await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query(
        "UPDATE dbo.DashboardConfig SET IsActive = 0 OUTPUT INSERTED.Id WHERE Id = @Id",
      );
    if (result.recordset.length === 0)
      throw new AppError("Dashboard config not found.", 404);
  });
  res.status(200).json({ success: true, message: "Dashboard config deleted." });
});

// -------------------------------------------------------------------------------
//  DASHBOARD DATA ENDPOINTS
// -------------------------------------------------------------------------------

// --- GET /dashboard/fg-packing -----------------------------------------------
export const getFGPackingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  // FIX #2: Call .toISOString() before passing to convertToIST — every other
  //         handler in this file does this; packing/loading were the odd ones out.
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);
  const { monthStart, monthEnd } = resolveMonthBounds(shiftStart);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const lineCode = config.LineCode;

    const r = await bindFGRequest(pool.request(), {
      configId,
      lineCode,
      istStart,
      istEnd,
      stationCode1,
      monthStart,
      monthEnd,
    }).query(buildFGQuery());

    return r.recordset[0] || null;
  });

  if (!data)
    throw new AppError("No data found for the given shift and date.", 404);
  res
    .status(200)
    .json({ success: true, message: "FG Packing data retrieved.", data });
});

// --- GET /dashboard/fg-loading -----------------------------------------------
export const getFGLoadingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  // FIX #2: Same  fix as getFGPackingData above.
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);
  const { monthStart, monthEnd } = resolveMonthBounds(shiftStart);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode2 = config.StationCode2;
    const lineCode = config.LineCode;

    const r = await bindLoadingRequest(pool.request(), {
      configId,
      lineCode,
      istStart,
      istEnd,
      stationCode2,
      monthStart,
      monthEnd,
    }).query(buildLoadingQuery());

    return r.recordset[0] || null;
  });

  if (!data)
    throw new AppError("No data found for the given shift and date.", 404);
  res
    .status(200)
    .json({ success: true, message: "FG Loading data retrieved.", data });
});

// --- GET /dashboard/hourly ----------------------------------------------------
export const getHourlyProductionData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const lineCode = config.LineCode;

    const hoursQuery = `
            WITH HourlySummary AS (
              SELECT
                DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
                CAST(
                  CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
                  CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
                AS DATETIME) AS HourTime,
                COUNT(*) AS Loading_Count
              FROM MaterialBarcode mb
              JOIN ProcessActivity b  ON b.PSNo        = mb.DocNo
              JOIN WorkCenter      c  ON b.StationCode = c.StationCode
              WHERE mb.PrintStatus = 1
                AND mb.Status     <> 99
                AND mb.Type NOT IN (200)
                AND c.StationCode  = @stationCode1
                AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
                AND b.ActivityType = 5
                AND b.ActivityOn BETWEEN @shiftStart AND @shiftEnd
              GROUP BY
                DATEPART(HOUR, b.ActivityOn),
                CAST(
                  CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
                  CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
                AS DATETIME)
            ),
            Config AS (
              SELECT LineTarget1,LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
            ),
            HourlyTarget AS (
              SELECT
                c.LineTarget1 AS HourTarget
              FROM Config c
            )
      SELECT
        ROW_NUMBER() OVER (ORDER BY hs.HourTime) AS HourNo,
        hs.TIMEHOUR,

        CAST(t.AdjustedTarget AS INT) AS Target,
        hs.Loading_Count AS Actual,

        -- Hour Loss
        CAST(
          CASE 
            WHEN t.AdjustedTarget > hs.Loading_Count
            THEN t.AdjustedTarget - hs.Loading_Count
            ELSE 0
          END AS INT
        ) AS HourLoss,

        -- Cumulative Loss
        CAST(
          SUM(
            CASE 
              WHEN t.AdjustedTarget > hs.Loading_Count
              THEN t.AdjustedTarget - hs.Loading_Count
              ELSE 0
            END
          ) OVER (ORDER BY hs.HourTime ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        AS INT) AS CumulativeLoss,

        -- Achievement %
        CAST(
          hs.Loading_Count * 100.0 /
          NULLIF(t.AdjustedTarget, 0)
        AS DECIMAL(5,1)) AS AchievementPct

      FROM HourlySummary hs
      CROSS JOIN HourlyTarget ht

      CROSS APPLY (
        SELECT 
          CASE 
            WHEN hs.TIMEHOUR = 12 
              THEN ROUND(ht.HourTarget / 2.0, 0)
            ELSE ht.HourTarget
          END AS AdjustedTarget
      ) t

      ORDER BY hs.HourTime;
    `;

    const summaryQuery = `
      WITH Config AS (
        SELECT
          WorkingTimeMin,
          LineMonthlyProduction1,
          LineTaktTime1
        FROM dbo.DashboardConfig
        WHERE Id = @configId AND IsActive = 1
      ),
      ShiftActual AS (
        SELECT COUNT(*) AS TotalAchieved
        FROM MaterialBarcode mb
        JOIN ProcessActivity b ON b.PSNo        = mb.DocNo
        JOIN WorkCenter      c ON b.StationCode = c.StationCode
        WHERE mb.PrintStatus = 1
          AND mb.Status     <> 99
          AND mb.Type NOT IN (200)
          AND c.StationCode  = @stationCode1
          AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
          AND b.ActivityType = 5
          AND b.ActivityOn BETWEEN @shiftStart AND @shiftEnd
      )
      SELECT
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT) AS ShiftPlan,

        sa.TotalAchieved,

        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT) - sa.TotalAchieved AS Remaining,

        CAST(
          ROUND(
            DATEDIFF(MINUTE, @shiftStart,
              CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd
                WHEN GETDATE() < @shiftStart THEN @shiftStart
                ELSE GETDATE()
              END
            ) * 100.0
            / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
          , 2)
        AS DECIMAL(5,2)) AS ConsumedTimePct

      FROM Config cfg
      CROSS JOIN ShiftActual sa;
    `;

    const [hoursResult, summaryResult] = await Promise.all([
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), String(stationCode1))
        .input("lineCode", sql.NVarChar(50), String(lineCode))
        .query(hoursQuery),
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), String(stationCode1))
        .input("lineCode", sql.NVarChar(50), String(lineCode))
        .query(summaryQuery),
    ]);

    const hours = hoursResult.recordset.map((row, idx) => ({
      HourNo: idx + 1,
      TIMEHOUR: row.TIMEHOUR,
      TimeLabel: `H${idx + 1}`,
      Target: row.Target,
      Actual: row.Actual,
      HourLoss: row.HourLoss,
      CumulativeLoss: row.CumulativeLoss,
      AchievementPct: row.AchievementPct,
    }));

    return { hours, summary: summaryResult.recordset[0] || {} };
  });

  res.status(200).json({
    success: true,
    message: "Hourly production data retrieved.",
    data,
  });
});

// --- GET /dashboard/quality ---------------------------------------------------
export const getQualityData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const LineCode = config.LineCode;
    const qualityProcessCode = config.QualityProcessCode;

    const summaryQuery = `
      WITH ReworkBase AS (
        SELECT it.ID, s.Status AS Rework_Status
        FROM InspectionTrans it
        INNER JOIN InspectionHeader ih ON it.InspectionLotNo = ih.InspectionLotNo
        LEFT  JOIN Status           s  ON ih.Status          = s.ID
        WHERE it.NextAction = 1
          AND it.InspectedOn BETWEEN @shiftStart AND @shiftEnd
      ),
      ShiftActual AS (
        SELECT COUNT(PSNo) AS TotalAchieved
        FROM ProcessActivity
        WHERE StationCode  in (@stationCode1)
          AND ActivityType = 5
          AND Remark IN (SELECT value FROM STRING_SPLIT(@LineCode, ','))
          AND ActivityOn  >= @shiftStart
          AND ActivityOn  <  @shiftEnd
      ),
      Config AS (
        SELECT LineTaktTime1, WorkingTimeMin, LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
      )
      SELECT
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT)                                                                        AS [Plan],
        sa.TotalAchieved,
        sa.TotalAchieved - (SELECT COUNT(*) FROM ReworkBase)                          AS OkUnit,
        (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Active')              AS DefectUnit,
        (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Closed')              AS ReworkDone,
        CAST(
          (sa.TotalAchieved - (SELECT COUNT(*) FROM ReworkBase)) * 100.0
          / NULLIF(sa.TotalAchieved, 0)
        AS DECIMAL(5,1))                                                               AS OkPct,
        CAST(
          (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Active') * 100.0
          / NULLIF(sa.TotalAchieved, 0)
        AS DECIMAL(5,1))                                                               AS DefectPct,
        CAST(
          ROUND(
            DATEDIFF(MINUTE, @shiftStart,
              CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd
                WHEN GETDATE() < @shiftStart THEN @shiftStart
                ELSE GETDATE()
              END
            ) * 100.0
            / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
          , 2)
        AS DECIMAL(5,2)) AS ConsumedTimePct
      FROM Config cfg CROSS JOIN ShiftActual sa;
    `;

    const defectsQuery = `
      WITH ReworkBase AS (
          SELECT dc.Name AS DefectName
          FROM InspectionTrans it
          INNER JOIN InspectionHeader ih
              ON it.InspectionLotNo = ih.InspectionLotNo
          LEFT JOIN InspectionDefect idf
              ON it.ID = idf.ID
          LEFT JOIN DefectCodeMaster dc
              ON idf.Defect = dc.Code
          WHERE it.NextAction = 1
            AND ih.Process IN (SELECT value FROM STRING_SPLIT(@qualityProcessCode, ','))
            AND it.InspectedOn BETWEEN @shiftStart AND @shiftEnd
      )

      SELECT DefectName, COUNT(*) AS DefectCount
      FROM ReworkBase
      WHERE DefectName IS NOT NULL
      GROUP BY DefectName
      ORDER BY DefectCount DESC;
    `;

    const [summary, defects] = await Promise.all([
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), stationCode1)
        .input("LineCode", sql.NVarChar(50), LineCode)
        .query(summaryQuery),
      pool
        .request()
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("qualityProcessCode", sql.NVarChar(50), qualityProcessCode)
        .query(defectsQuery),
    ]);

    return { summary: summary.recordset[0] || {}, defects: defects.recordset };
  });

  res
    .status(200)
    .json({ success: true, message: "Quality data retrieved.", data });
});

// --- GET /dashboard/loss ------------------------------------------------------
export const getLossData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const LineName = config.LineName;
    const lineCode = config.LineCode;
    const sectionName = config.SectionName;
    if (!sectionName)
      throw new AppError(
        "SectionName is not configured for this dashboard. Please update the configuration.",
        400,
      );

    const stationsQuery = `
      WITH EMG AS (
        SELECT
          T.RefID,
          M.PLCLocation                             AS StationName,
          T.EmgOn, T.EmgOff,
          DATEDIFF(SECOND, T.EmgOn, T.EmgOff)      AS TotalSeconds
        FROM EMGTrans T
        INNER JOIN EMGMaster M
          ON T.PLCCode = M.PLCCode AND T.MEMBit = M.MEMBit AND M.Active = 1
        WHERE T.EmgOff IS NOT NULL
          AND T.EmgOn >= @shiftStart AND T.EmgOn < @shiftEnd
          AND M.LineName = @LineName
          AND M.Location = @sectionName
      ),
      BREAKS AS (
        SELECT
          CAST(CAST(@shiftStart AS DATE) AS DATETIME) + CAST(StartTime AS DATETIME) AS BreakStart,
          CAST(CAST(@shiftStart AS DATE) AS DATETIME) + CAST(EndTime   AS DATETIME) AS BreakEnd
        FROM ShiftBreaks
      ),
      CALC AS (
        SELECT
          E.RefID, E.StationName, E.TotalSeconds,
          ISNULL(SUM(
            CASE WHEN B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
                 THEN DATEDIFF(SECOND,
                       CASE WHEN E.EmgOn  > B.BreakStart THEN E.EmgOn  ELSE B.BreakStart END,
                       CASE WHEN E.EmgOff < B.BreakEnd   THEN E.EmgOff ELSE B.BreakEnd   END)
                 ELSE 0 END
          ), 0) AS BreakSeconds
        FROM EMG E CROSS JOIN BREAKS B
        GROUP BY E.RefID, E.StationName, E.TotalSeconds
      ),
      FINAL AS (
        SELECT StationName, (TotalSeconds - BreakSeconds) AS NetSeconds FROM CALC
      )
      SELECT
        StationName,
        CONVERT(VARCHAR, DATEADD(SECOND, SUM(NetSeconds), 0), 108) AS TotalStopTimeHMS,
        CAST(SUM(NetSeconds) / 60.0 AS DECIMAL(8,1))               AS TotalStopTime,
        SUM(NetSeconds)                                             AS TotalSeconds,
        COUNT(*)                                                    AS TotalStopCount
      FROM FINAL
      WHERE NetSeconds > 0
      GROUP BY StationName
      ORDER BY SUM(NetSeconds) DESC;
    `;

    const summaryQuery = `
      WITH Config AS (
        SELECT LineTaktTime1, WorkingTimeMin, LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
      ),
      ShiftActual AS (
        SELECT COUNT(PSNo) AS Achieved
        FROM ProcessActivity
        WHERE StationCode  in (@stationCode1)
          AND ActivityType = 5
          AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
          AND ActivityOn  >= @shiftStart
          AND ActivityOn  <  @shiftEnd
      )
      SELECT
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT)                                                               AS [Plan],
        sa.Achieved,
        CAST(cfg.LineMonthlyProduction1 * 1.0
          / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
        AS INT) - sa.Achieved                                                  AS Remaining,
        CAST(
          ROUND(
            DATEDIFF(MINUTE, @shiftStart,
              CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd
                WHEN GETDATE() < @shiftStart THEN @shiftStart
                ELSE GETDATE()
              END
            ) * 100.0
            / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
          , 2)
        AS DECIMAL(5,2)) AS ConsumedTimePct
      FROM Config cfg CROSS JOIN ShiftActual sa;
    `;

    const [stations, summary] = await Promise.all([
      pool
        .request()
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("sectionName", sql.NVarChar(200), sectionName)
        .input("LineName", sql.NVarChar(50), LineName)
        .query(stationsQuery),
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), stationCode1)
        .input("LineCode", sql.NVarChar(50), lineCode) // FIX #8
        .query(summaryQuery),
    ]);

    return {
      stations: stations.recordset,
      summary: summary.recordset[0] || {},
    };
  });

  res
    .status(200)
    .json({ success: true, message: "Loss data retrieved.", data });
});
