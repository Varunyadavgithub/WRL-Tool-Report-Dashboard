// One-time import: load Material Master data from an Excel file into MaterialConfigs.
// Usage: node scripts/importMaterials.js "<path-to-xlsx>"
import xlsx from "xlsx";
import sql, { connectToDB, dbConfig3 } from "../config/db.config.js";
import { runMigrations } from "../config/migrations.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/importMaterials.js <path-to-xlsx>");
  process.exit(1);
}

const numOrNull = (v) => (v === "" || v === null || v === undefined || Number.isNaN(+v) ? null : +v);
const strOrNull = (v) => (v === "" || v === null || v === undefined ? null : String(v).trim());

// Mirrors defaultNoOfSheet() in MaterialConfig.jsx
const defaultNoOfSheet = (thickness) => {
  const t = parseFloat(thickness);
  if (!(t > 0)) return 1;
  if (t <= 0.25) return 3;
  if (t <= 0.5) return 2;
  return 1;
};

const COLUMN_MAP = {
  "SAP Code": "sapCode",
  "Description": "partName",
  "Category": "category",
  "Length": "length",
  "Width": "width",
  "THK": "thickness",
  "Weight": "weight",
  "Component Weight": "componentWeight",
  "Scrap Weight": "scrapWeight",
  "No of Sheet": "noOfSheet",
  "No of Component per Sheet": "actualComponentsPerSheet",
  "Loading/Unloading Time": "pncLoadingUnloading",
  "Defined Component Cycle Time (Secs)": "definedComponentCycleTime",
  "Drawing No.": "drawingNumber",
  "Rev.": "drawingRevision",
};

const NUM_FIELDS = [
  "length", "width", "thickness", "weight", "componentWeight", "scrapWeight",
  "actualComponentsPerSheet", "pncLoadingUnloading", "noOfSheet", "definedComponentCycleTime",
];

const wb = xlsx.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(ws, { defval: "" });

const bySap = new Map();
for (const raw of rawRows) {
  const row = {};
  for (const [col, field] of Object.entries(COLUMN_MAP)) {
    row[field] = raw[col] !== undefined ? String(raw[col]).trim() : "";
  }
  NUM_FIELDS.forEach((f) => { row[f] = row[f] ? (parseFloat(row[f]) || 0) : 0; });
  if (!row.noOfSheet) row.noOfSheet = defaultNoOfSheet(row.thickness);
  if (!row.sapCode || !row.partName) continue;
  bySap.set(row.sapCode, row); // last row wins for duplicate SAP codes
}

const rows = Array.from(bySap.values());
console.log(`Parsed ${rawRows.length} sheet rows -> ${rows.length} unique materials.`);

const pool = await connectToDB(dbConfig3);
await runMigrations(pool);

let inserted = 0, updated = 0;
for (const m of rows) {
  const request = pool.request()
    .input("sapCode", sql.NVarChar(50), m.sapCode)
    .input("partName", sql.NVarChar(300), strOrNull(m.partName))
    .input("category", sql.NVarChar(100), strOrNull(m.category))
    .input("length", sql.Decimal(12, 3), numOrNull(m.length))
    .input("width", sql.Decimal(12, 3), numOrNull(m.width))
    .input("thickness", sql.Decimal(12, 3), numOrNull(m.thickness))
    .input("weight", sql.Decimal(12, 3), numOrNull(m.weight))
    .input("componentWeight", sql.Decimal(12, 3), numOrNull(m.componentWeight))
    .input("scrapWeight", sql.Decimal(12, 3), numOrNull(m.scrapWeight))
    .input("noOfSheet", sql.Decimal(12, 3), numOrNull(m.noOfSheet))
    .input("actualComponentsPerSheet", sql.Decimal(12, 3), numOrNull(m.actualComponentsPerSheet))
    .input("pncLoadingUnloading", sql.Decimal(12, 3), numOrNull(m.pncLoadingUnloading))
    .input("definedComponentCycleTime", sql.Decimal(12, 3), numOrNull(m.definedComponentCycleTime))
    .input("drawingNumber", sql.NVarChar(100), strOrNull(m.drawingNumber))
    .input("drawingRevision", sql.NVarChar(50), strOrNull(m.drawingRevision))
    .input("status", sql.Bit, true);

  const result = await request.query(`
    MERGE MaterialConfigs AS target
    USING (SELECT @sapCode AS SapCode) AS src
    ON target.SapCode = src.SapCode
    WHEN MATCHED THEN UPDATE SET
      PartName = @partName, Category = @category,
      Length = @length, Width = @width, Thickness = @thickness, Weight = @weight,
      ComponentWeight = @componentWeight, ScrapWeight = @scrapWeight,
      NoOfSheet = @noOfSheet, ActualComponentsPerSheet = @actualComponentsPerSheet,
      PncLoadingUnloading = @pncLoadingUnloading, DefinedComponentCycleTime = @definedComponentCycleTime,
      DrawingNumber = @drawingNumber, DrawingRevision = @drawingRevision, Status = @status,
      UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN INSERT (
      SapCode, PartName, Category, Length, Width, Thickness, Weight,
      ComponentWeight, ScrapWeight, NoOfSheet, ActualComponentsPerSheet,
      PncLoadingUnloading, DefinedComponentCycleTime, DrawingNumber, DrawingRevision, Status
    ) VALUES (
      @sapCode, @partName, @category, @length, @width, @thickness, @weight,
      @componentWeight, @scrapWeight, @noOfSheet, @actualComponentsPerSheet,
      @pncLoadingUnloading, @definedComponentCycleTime, @drawingNumber, @drawingRevision, @status
    )
    OUTPUT $action AS action;
  `);

  const action = result.recordset?.[0]?.action;
  if (action === "INSERT") inserted++;
  else if (action === "UPDATE") updated++;
}

console.log(`Done. Inserted: ${inserted}, Updated: ${updated}.`);
process.exit(0);
