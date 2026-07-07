import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Reuses the exact aggregate query from Backend/controllers/quality/lptReport.controller.js's
// getLptModelSummary — LPT (Leak Proof Test) sampling requirement/coverage per model.
export const definition = {
  type: "function",
  function: {
    name: "getLptSummary",
    description:
      "Get LPT (Leak Proof Test) sampling coverage per model for a date range: required sample size, samples inspected, pending samples, and coverage percentage. Use for 'LPT data' or 'leak test' questions.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date/time, e.g. '2026-07-05 00:00' or '2026-07-05'." },
        endDate: { type: "string", description: "End date/time, e.g. '2026-07-05 23:59' or '2026-07-05'." },
      },
      required: ["startDate", "endDate"],
    },
  },
};

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const expandToDayBounds = (dateStr, isEnd) =>
  BARE_DATE.test(dateStr?.trim()) ? `${dateStr.trim()} ${isEnd ? "23:59:59" : "00:00:00"}` : dateStr;

export const execute = async ({ startDate, endDate } = {}) => {
  if (!startDate || !endDate) return { error: "startDate and endDate are required." };

  const istStart = convertToIST(expandToDayBounds(startDate, false));
  const istEnd = convertToIST(expandToDayBounds(endDate, true));

  const result = await global.pool1.request()
    .input("startDate", sql.DateTime, istStart)
    .input("endDate", sql.DateTime, istEnd)
    .query(`
      WITH FPA_COMPUTED AS (
        SELECT c.Name AS ModelName, cnt.ModelCount,
          CASE WHEN cnt.ModelCount <= 10 THEN 0 ELSE CEILING((cnt.ModelCount - 10) / 10.0) END AS LPT
        FROM (
          SELECT b.Material, COUNT(*) AS ModelCount
          FROM ProcessActivity a
          INNER JOIN MaterialBarcode b ON a.PSNo = b.DocNo
          WHERE a.StationCode IN (1220014) AND a.ActivityType = 5
            AND a.ActivityOn BETWEEN @startDate AND @endDate AND b.Type NOT IN (0, 200)
          GROUP BY b.Material
        ) AS cnt
        INNER JOIN Material c ON cnt.Material = c.MatCode
      ),
      SAMPLE_INSPECTED AS (
        SELECT ModelName, COUNT(DISTINCT AssemblyNo) AS SampleInspected
        FROM LPTReport WHERE DateTime BETWEEN @startDate AND @endDate GROUP BY ModelName
      )
      SELECT
        f.ModelName, f.ModelCount, f.LPT AS requiredSamples,
        ISNULL(s.SampleInspected, 0) AS sampleInspected,
        (f.LPT - ISNULL(s.SampleInspected, 0)) AS pendingSamples,
        CAST((ISNULL(s.SampleInspected, 0) * 100.0) / NULLIF(f.LPT, 0) AS DECIMAL(5,2)) AS coveragePct
      FROM FPA_COMPUTED f
      LEFT JOIN SAMPLE_INSPECTED s ON f.ModelName = s.ModelName
      WHERE f.LPT > 0
      ORDER BY f.ModelCount DESC
    `);

  const rows = result.recordset;
  if (!rows.length) return { startDate, endDate, note: "No LPT-eligible production found in this range." };

  return { startDate, endDate, byModel: rows.slice(0, 15) };
};
