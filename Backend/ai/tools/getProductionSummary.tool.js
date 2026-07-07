import { buildShiftReport } from "../../services/shiftReport.service.js";
import { getShiftsForDate } from "./_shared.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

// Trims a per-model OEE row down to what a chat answer actually needs —
// keeps tool output small so a CPU-bound model isn't re-reading huge JSON.
const summarizeRow = (r) => ({
  sapCode: r.sapCode,
  itemDescription: r.itemDescription,
  planQty: r.planQty,
  componentQty: r.componentQty,
  accepted: r.accepted,
  rejected: r.rejected,
  oee: r.oee,
});

export const definition = {
  type: "function",
  function: {
    name: "getProductionSummary",
    description:
      "Get production/OEE summary for a given production date, optionally scoped to one shift. Returns per-model output, totals (accepted/rejected/OEE/availability/performance/quality), and downtime breakdown by reason. Use this for questions like 'show today's production' or 'how did Line X do yesterday'.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Production date in YYYY-MM-DD format. Defaults to today if omitted." },
        shiftName: { type: "string", description: "Exact shift name (e.g. 'Shift A'). Omit to get all shifts for the date." },
      },
    },
  },
};

export const execute = async ({ date, shiftName } = {}) => {
  const dateStr = date || todayStr();
  const shifts = await getShiftsForDate(shiftName);
  if (!shifts.length) {
    return { date: dateStr, error: shiftName ? `No shift named "${shiftName}" found.` : "No active shifts configured." };
  }

  const results = await Promise.all(
    shifts.map(async (shift) => {
      const report = await buildShiftReport(global.pool3, shift, dateStr);
      return { shiftName: shift.shiftName, report };
    }),
  );

  const shiftsWithData = results.filter((r) => r.report);
  if (!shiftsWithData.length) {
    return { date: dateStr, shifts: [], note: "No production data recorded for this date." };
  }

  return {
    date: dateStr,
    shifts: shiftsWithData.map(({ shiftName, report }) => ({
      shiftName,
      totals: report.totals,
      downtimeBreakdown: report.downtimeBreakdown.slice(0, 8),
      modelCount: report.rows.length,
      topModels: [...report.rows]
        .sort((a, b) => b.componentQty - a.componentQty)
        .slice(0, 10)
        .map(summarizeRow),
    })),
  };
};
