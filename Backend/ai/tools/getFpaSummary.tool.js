import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Reuses the exact aggregate query from Backend/controllers/quality/fpaHistory.controller.js's
// getFpaHistory — per-model FPA (Finish Product Audit) sampling requirement,
// inspected count, defect severity breakdown, and FPQI (weighted defect index).
export const definition = {
  type: "function",
  function: {
    name: "getFpaSummary",
    description:
      "Get FPA (Finish Product Audit) quality stats per model for a date range: production count, required sample size, inspected count, critical/major/minor defect counts, and FPQI (weighted defect quality index — lower is better). Use for 'FPA data', 'defect rate', or 'quality audit' questions.",
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
      WITH DUMDATA AS (
        SELECT a.PSNo, c.Name, b.Material, a.StationCode, a.ActivityOn, b.Type
        FROM ProcessActivity a
        INNER JOIN MaterialBarcode b ON a.PSNo = b.DocNo
        INNER JOIN Material c ON b.Material = c.MatCode
        WHERE a.StationCode IN (1220010, 1230017)
          AND a.ActivityType = 5
          AND a.ActivityOn BETWEEN @startDate AND @endDate
          AND b.Type NOT IN (0, 200)
      ),
      FPA_DATA AS (
        SELECT Name AS ModelName, COUNT(Name) AS ModelCount,
          CASE WHEN COUNT(Name) < 10 THEN 0 ELSE ((COUNT(Name) - 1) / 100) + 1 END AS FPA
        FROM DUMDATA GROUP BY Name
      ),
      INSPECTED_DATA AS (
        SELECT Model, COUNT(DISTINCT FGSRNo) AS SampleInspected
        FROM FPAReport WHERE Date BETWEEN @startDate AND @endDate GROUP BY Model
      ),
      DEFECT_SUMMARY AS (
        SELECT Model,
          SUM(CASE WHEN Category = 'critical' THEN 1 ELSE 0 END) AS Critical,
          SUM(CASE WHEN Category = 'major' THEN 1 ELSE 0 END) AS Major,
          SUM(CASE WHEN Category = 'minor' THEN 1 ELSE 0 END) AS Minor,
          COUNT(DISTINCT FGSRNo) AS InspectedFG
        FROM FPAReport WHERE Date BETWEEN @startDate AND @endDate GROUP BY Model
      )
      SELECT
        f.ModelName, f.ModelCount, f.FPA,
        ISNULL(i.SampleInspected, 0) AS sampleInspected,
        ISNULL(d.Critical, 0) AS critical,
        ISNULL(d.Major, 0) AS major,
        ISNULL(d.Minor, 0) AS minor,
        CAST((ISNULL(d.Critical,0)*9.0 + ISNULL(d.Major,0)*6.0 + ISNULL(d.Minor,0)*1.0)
          / NULLIF(ISNULL(d.InspectedFG,0),0) AS DECIMAL(10,3)) AS fpqi
      FROM FPA_DATA f
      LEFT JOIN INSPECTED_DATA i ON f.ModelName = i.Model
      LEFT JOIN DEFECT_SUMMARY d ON f.ModelName = d.Model
      WHERE f.FPA > 0
      ORDER BY f.ModelCount DESC, f.ModelName ASC
    `);

  const rows = result.recordset;
  if (!rows.length) return { startDate, endDate, note: "No FPA-eligible production found in this range." };

  return {
    startDate,
    endDate,
    totals: {
      totalCritical: rows.reduce((s, r) => s + r.critical, 0),
      totalMajor: rows.reduce((s, r) => s + r.major, 0),
      totalMinor: rows.reduce((s, r) => s + r.minor, 0),
      totalSampleInspected: rows.reduce((s, r) => s + r.sampleInspected, 0),
    },
    byModel: rows.slice(0, 15),
  };
};
