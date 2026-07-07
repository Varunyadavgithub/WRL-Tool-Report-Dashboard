import { getShiftReportsInRange } from "./_shared.js";

export const definition = {
  type: "function",
  function: {
    name: "getDowntimeAnalysis",
    description:
      "Get downtime minutes broken down by REASON (not by machine — this data isn't tracked per-machine) across a date range. Use for 'why did productivity drop' or 'what's causing the most downtime' questions. If asked specifically which machine/line has the highest downtime, call this tool for the reason breakdown but tell the user machine-level downtime isn't tracked yet — don't imply this data is machine-specific.",
    parameters: {
      type: "object",
      properties: {
        start: { type: "string", description: "Start date, YYYY-MM-DD." },
        end: { type: "string", description: "End date, YYYY-MM-DD." },
        shiftName: { type: "string", description: "Optional — restrict to one shift." },
      },
      required: ["start", "end"],
    },
  },
};

export const execute = async ({ start, end, shiftName } = {}) => {
  if (!start || !end) return { error: "start and end dates are required." };

  const reports = await getShiftReportsInRange(start, end, shiftName);
  if (!reports.length) return { start, end, note: "No production data recorded in this range." };

  const byReason = {};
  for (const { report } of reports) {
    for (const { reason, mins } of report.downtimeBreakdown) {
      byReason[reason] = (byReason[reason] || 0) + mins;
    }
  }

  const breakdown = Object.entries(byReason)
    .map(([reason, totalMins]) => ({ reason, totalMins }))
    .sort((a, b) => b.totalMins - a.totalMins);

  return {
    start,
    end,
    totalDowntimeMins: breakdown.reduce((sum, r) => sum + r.totalMins, 0),
    breakdown: breakdown.slice(0, 10),
  };
};
