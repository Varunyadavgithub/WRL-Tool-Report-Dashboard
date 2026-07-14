import { getShiftReportsInRange } from "../../ai/tools/_shared.js";

// Percentage fields (oee/availability/performance/quality) are already
// per-shift averages-across-models (see shiftReport.service.js). Rolling
// several shift occurrences up into one daily point uses the same
// convention the source data already uses: a plain (unweighted) mean, not a
// componentQty-weighted average. Count/duration fields are summed instead.
const MEAN_FIELDS = new Set(["oee", "availability", "performance", "quality"]);

const downtimeMinsForReport = (report) => report.downtimeBreakdown.reduce((sum, d) => sum + d.mins, 0);

const fieldValue = (report, field) => (field === "downtimeMins" ? downtimeMinsForReport(report) : report.totals[field]);

/**
 * Daily {date, value, sampleSize} series for one production/OEE field,
 * built by rolling up shift reports from the existing getShiftReportsInRange
 * pipeline (Backend/ai/tools/_shared.js) — inherits its MAX_RANGE_DAYS cap
 * and pool3 concurrency limit, no new SQL against PartProcessEvents.
 */
export const getDailySeries = async (field, start, end, { shiftName } = {}) => {
  const rows = await getShiftReportsInRange(start, end, shiftName);
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(fieldValue(r.report, field));
  }
  return [...byDate.entries()]
    .map(([date, values]) => {
      const raw = MEAN_FIELDS.has(field)
        ? values.reduce((a, b) => a + b, 0) / values.length
        : values.reduce((a, b) => a + b, 0);
      return { date, value: Math.round(raw * 10) / 10, sampleSize: values.length };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};
