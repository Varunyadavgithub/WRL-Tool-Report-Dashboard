import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";
import { MAX_RANGE_DAYS } from "../../ai/tools/_shared.js";

// Daily-grouped variant of the dispatch query in
// Backend/ai/tools/getDispatchSummary.tool.js — same DispatchMaster table
// (pool2/WWMS), same AddedOn/ModelName columns, grouped by day instead of model.
// WWMS is a remote server that's sometimes offline (see getDispatchSummary) —
// throw a plain-language error rather than let a disconnected pool hang.
const dayCount = (start, end) => Math.round((new Date(end) - new Date(start)) / 86400000) + 1;

/** Daily {date, value, sampleSize} series for dispatched unit count, optionally scoped to one model. */
export const getDailySeries = async (field, start, end, { model } = {}) => {
  if (!global.pool2) {
    throw new Error("The dispatch (WWMS) database isn't connected right now — can't answer this.");
  }
  if (dayCount(start, end) > MAX_RANGE_DAYS) {
    throw new Error(`Date range too wide (${dayCount(start, end)} days). Please ask for ${MAX_RANGE_DAYS} days or fewer at a time.`);
  }

  const istStart = convertToIST(`${start} 00:00:00`);
  const istEnd = convertToIST(`${end} 23:59:59`);

  const result = await global.pool2.request()
    .input("startDate", sql.DateTime, istStart)
    .input("endDate", sql.DateTime, istEnd)
    .input("model", sql.NVarChar, model || null)
    .query(`
      SELECT CAST(AddedOn AS DATE) AS reportDate, COUNT(*) AS unitCount
      FROM DispatchMaster
      WHERE AddedOn BETWEEN @startDate AND @endDate
        AND (@model IS NULL OR ModelName = @model)
      GROUP BY CAST(AddedOn AS DATE)
      ORDER BY reportDate
    `);

  return result.recordset.map((r) => ({
    date: r.reportDate.toISOString().slice(0, 10),
    value: r.unitCount,
    sampleSize: r.unitCount,
  }));
};
