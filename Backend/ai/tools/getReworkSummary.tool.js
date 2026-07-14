import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Reuses the exact aggregate query + shared SQL fragments from
// Backend/controllers/quality/rework.controller.js's getReworkSummaryExport —
// NOTE this domain uniquely uses startTime/endTime (not startDate/endDate),
// matching the underlying controller's own param convention.
const CATEGORY_REVERSE_MAP = {
  Freezer: ["COOLER", "ICE LINED REFRIGERATOR", "COOLER AND FREEZER", "CHEST COOLER", "MEDICAL", "EUTECTIC", "ILR", "VACCINE FREEZER", "DUAL", "FREEZER"],
  "Choc Cooler": ["Choc Cooler"],
  FOW: ["FOW MODELS", "EUTECTIC FOW FREEZER"],
  SUS: ["2 GLASS DOOR UNDERCOUNTER REFRIGERATOR", "1 DOOR UNDERCOUNTER REFRIGERATOR", "2 DOOR UNDERCOUNTER REFRIGERATOR", "3 DOOR UNDERCOUNTER REFRIGERATOR"],
  SWC: ["STORAGE WATER COOLER"],
  "VISI COOLER": ["VISI COOLER"],
};

const expandCategories = (categoriesStr) => {
  if (!categoriesStr) return null;
  const dbNames = categoriesStr.split(",").map((c) => c.trim()).filter(Boolean)
    .flatMap((g) => CATEGORY_REVERSE_MAP[g] ?? []);
  return dbNames.length ? dbNames.join("|") : null;
};

const CLOSED_CASE = `
  CASE
    WHEN LOWER(ISNULL(Rework_Status, '')) LIKE '%close%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%done%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%complet%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%resolv%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%finish%'
    THEN 1 ELSE 0
  END
`;

export const definition = {
  type: "function",
  function: {
    name: "getReworkSummary",
    description:
      "Get rework case counts per model/category for a date range: total cases, closed, open, and close rate. Use for 'rework data' questions.",
    parameters: {
      type: "object",
      properties: {
        startTime: { type: "string", description: "Start date/time, e.g. '2026-07-05 00:00' or '2026-07-05'." },
        endTime: { type: "string", description: "End date/time, e.g. '2026-07-05 23:59' or '2026-07-05'." },
        categories: {
          type: "string",
          description: `Optional comma-separated category group(s) to filter to: ${Object.keys(CATEGORY_REVERSE_MAP).join(", ")}.`,
        },
      },
      required: ["startTime", "endTime"],
    },
  },
};

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const expandToDayBounds = (dateStr, isEnd) =>
  BARE_DATE.test(dateStr?.trim()) ? `${dateStr.trim()} ${isEnd ? "23:59:59" : "00:00:00"}` : dateStr;

export const execute = async ({ startTime, endTime, categories } = {}) => {
  if (!startTime || !endTime) return { error: "startTime and endTime are required." };

  const istStart = convertToIST(expandToDayBounds(startTime, false));
  const istEnd = convertToIST(expandToDayBounds(endTime, true));
  const dbCategories = expandCategories(categories);

  const result = await global.pool1.request()
    .input("startTime", sql.DateTime, istStart)
    .input("endTime", sql.DateTime, istEnd)
    .input("dbCategories", sql.VarChar, dbCategories)
    .query(`
      WITH ReworkBase AS (
        SELECT m.Alias AS Model_Name, mc.Name AS Category, s.Status AS Rework_Status
        FROM InspectionTrans it
        INNER JOIN InspectionHeader ih ON it.InspectionLotNo = ih.InspectionLotNo
        INNER JOIN Material m ON ih.Material = m.MatCode
        LEFT JOIN MaterialCategory mc ON m.Category = mc.CategoryCode
        INNER JOIN ProcessRouting pr ON ih.DocNo = pr.PSNo AND pr.ProcessCode = ih.Process
        LEFT JOIN Status s ON ih.Status = s.ID
        WHERE it.NextAction = 1 AND it.InspectedOn BETWEEN @startTime AND @endTime
      )
      SELECT
        Model_Name, Category, COUNT(*) AS total,
        SUM(${CLOSED_CASE}) AS closed,
        COUNT(*) - SUM(${CLOSED_CASE}) AS open,
        CAST(ROUND(SUM(${CLOSED_CASE}) * 100.0 / NULLIF(COUNT(*), 0), 2) AS DECIMAL(10,2)) AS closeRatePct
      FROM ReworkBase
      WHERE (@dbCategories IS NULL OR Category IN (SELECT value FROM STRING_SPLIT(@dbCategories, '|')))
      GROUP BY Model_Name, Category
      ORDER BY total DESC
    `);

  const rows = result.recordset;
  if (!rows.length) return { startTime, endTime, note: "No rework cases found in this range." };

  return {
    startTime,
    endTime,
    totalCases: rows.reduce((s, r) => s + r.total, 0),
    totalClosed: rows.reduce((s, r) => s + r.closed, 0),
    totalOpen: rows.reduce((s, r) => s + r.open, 0),
    byModel: rows.slice(0, 15),
  };
};
