import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";
import { MAX_RANGE_DAYS } from "../../ai/tools/_shared.js";

// Daily-grouped variant of the FPA query in Backend/ai/tools/getFpaSummary.tool.js.
// Reuses the same table/columns (FPAReport: Date, Model, Category, FGSRNo) and
// the same 9/6/1 FPQI weights, but groups by day instead of by model, and
// drops the ProcessActivity/MaterialBarcode/Material join — that join only
// computes getFpaSummary's per-model sampling-eligibility gate (FPA > 0),
// which isn't needed for a day-level trend/correlation signal.
const FIELD_COLUMN = { critical: "critical", major: "major", minor: "minor", inspectedFG: "sampleInspected" };

const dayCount = (start, end) => Math.round((new Date(end) - new Date(start)) / 86400000) + 1;

/**
 * Daily {date, value, sampleSize} series for one FPA field ("fpqi",
 * "critical", "major", "minor", "inspectedFG"), optionally scoped to one model.
 */
export const getDailySeries = async (field, start, end, { model } = {}) => {
  if (dayCount(start, end) > MAX_RANGE_DAYS) {
    throw new Error(`Date range too wide (${dayCount(start, end)} days). Please ask for ${MAX_RANGE_DAYS} days or fewer at a time.`);
  }

  const istStart = convertToIST(`${start} 00:00:00`);
  const istEnd = convertToIST(`${end} 23:59:59`);

  const result = await global.pool1.request()
    .input("startDate", sql.DateTime, istStart)
    .input("endDate", sql.DateTime, istEnd)
    .input("model", sql.NVarChar, model || null)
    .query(`
      SELECT
        CAST(Date AS DATE) AS reportDate,
        SUM(CASE WHEN Category = 'critical' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN Category = 'major' THEN 1 ELSE 0 END) AS major,
        SUM(CASE WHEN Category = 'minor' THEN 1 ELSE 0 END) AS minor,
        COUNT(DISTINCT FGSRNo) AS sampleInspected
      FROM FPAReport
      WHERE Date BETWEEN @startDate AND @endDate
        AND (@model IS NULL OR Model = @model)
      GROUP BY CAST(Date AS DATE)
      ORDER BY reportDate
    `);

  return result.recordset
    .map((r) => {
      const value = field === "fpqi"
        ? (r.sampleInspected > 0 ? Math.round(((r.critical * 9 + r.major * 6 + r.minor * 1) / r.sampleInspected) * 1000) / 1000 : null)
        : r[FIELD_COLUMN[field]];
      return { date: r.reportDate.toISOString().slice(0, 10), value, sampleSize: r.sampleInspected };
    })
    .filter((p) => p.value !== null);
};
