import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Reuses the exact aggregate query from Backend/controllers/quality/gasCharging.controller.js's
// getModelWiseStats — pass/fail rate and average gas weight per model.
export const definition = {
  type: "function",
  function: {
    name: "getGasChargingSummary",
    description:
      "Get gas charging pass/fail stats per model for a date range, optionally filtered to one machine. Use for 'gas charging data' questions.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date/time, e.g. '2026-07-05 00:00' or '2026-07-05'." },
        endDate: { type: "string", description: "End date/time, e.g. '2026-07-05 23:59' or '2026-07-05'." },
        machine: { type: "string", description: "Optional machine name to filter to a single gas-charging machine." },
      },
      required: ["startDate", "endDate"],
    },
  },
};

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const expandToDayBounds = (dateStr, isEnd) =>
  BARE_DATE.test(dateStr?.trim()) ? `${dateStr.trim()} ${isEnd ? "23:59:59" : "00:00:00"}` : dateStr;

export const execute = async ({ startDate, endDate, machine } = {}) => {
  if (!startDate || !endDate) return { error: "startDate and endDate are required." };

  const istStart = convertToIST(expandToDayBounds(startDate, false));
  const istEnd = convertToIST(expandToDayBounds(endDate, true));

  const request = global.pool1.request()
    .input("startDate", sql.DateTime, istStart)
    .input("endDate", sql.DateTime, istEnd);
  if (machine) request.input("machine", sql.VarChar, machine);

  const result = await request.query(`
    SELECT
      MODEL, MODELNAME,
      COUNT(*) as totalTests,
      SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN PERFORMANCE = 'FAIL' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate,
      AVG(TRY_CAST(REPLACE(REPLACE(REPLACE(ACTUAL_GAS_WEIGHT, ' g', ''), 'g', ''), ' ', '') AS DECIMAL(10,2))) as avgGasWeight
    FROM GasChargeDtls
    WHERE (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )
    ${machine ? "AND MACHINE = @machine" : ""}
    GROUP BY MODEL, MODELNAME
    ORDER BY totalTests DESC
  `);

  const rows = result.recordset;
  if (!rows.length) return { startDate, endDate, note: "No gas charging records found in this range." };

  return {
    startDate,
    endDate,
    totalTests: rows.reduce((s, r) => s + r.totalTests, 0),
    totalPass: rows.reduce((s, r) => s + r.passCount, 0),
    totalFail: rows.reduce((s, r) => s + r.failCount, 0),
    byModel: rows.slice(0, 15),
  };
};
