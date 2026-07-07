import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Reuses the exact aggregate query from Backend/controllers/dispatch/performanceReport.controller.js's
// getDispatchCategorySummary — total units dispatched per model, for a date range.
// Lives on pool2 (WWMS) — a remote server that's sometimes offline in dev; if
// the pool never connected, tell the user rather than hanging or crashing.
export const definition = {
  type: "function",
  function: {
    name: "getDispatchSummary",
    description: "Get total dispatched unit counts per model for a date range. Use for 'dispatch data' questions.",
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
  if (!global.pool2) return { error: "The dispatch (WWMS) database isn't connected right now — can't answer this." };

  const istStart = convertToIST(expandToDayBounds(startDate, false));
  const istEnd = convertToIST(expandToDayBounds(endDate, true));

  const result = await global.pool2.request()
    .input("startDate", sql.DateTime, istStart)
    .input("endDate", sql.DateTime, istEnd)
    .query(`
      WITH ProductionDetails AS (
        SELECT ModelName FROM DispatchMaster WHERE AddedOn >= @startDate AND AddedOn <= @endDate
      )
      SELECT ModelName, COUNT(*) AS unitCount
      FROM ProductionDetails
      GROUP BY ModelName
      ORDER BY unitCount DESC
    `);

  const rows = result.recordset;
  if (!rows.length) return { startDate, endDate, note: "No dispatch records found in this range." };

  return {
    startDate,
    endDate,
    totalUnits: rows.reduce((s, r) => s + r.unitCount, 0),
    byModel: rows.slice(0, 15),
  };
};
