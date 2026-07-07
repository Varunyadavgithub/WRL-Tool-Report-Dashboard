import { getShiftReportsInRange, sumTotals } from "./_shared.js";

const round1 = (n) => Math.round(n * 10) / 10;

const deltaPct = (a, b) => (a === 0 ? null : round1(((b - a) / a) * 100));

export const definition = {
  type: "function",
  function: {
    name: "compareProductionRanges",
    description:
      "Compare aggregate production between two date ranges (e.g. this week vs last week). Returns totals for each range and the percentage change. Use this for 'compare X vs Y' questions instead of calling getProductionSummary multiple times.",
    parameters: {
      type: "object",
      properties: {
        rangeA: {
          type: "object",
          description: "The more recent / primary range, e.g. this week.",
          properties: { start: { type: "string" }, end: { type: "string" } },
          required: ["start", "end"],
        },
        rangeB: {
          type: "object",
          description: "The comparison range, e.g. last week.",
          properties: { start: { type: "string" }, end: { type: "string" } },
          required: ["start", "end"],
        },
        shiftName: { type: "string", description: "Optional — restrict the comparison to one shift." },
      },
      required: ["rangeA", "rangeB"],
    },
  },
};

export const execute = async ({ rangeA, rangeB, shiftName } = {}) => {
  if (!rangeA?.start || !rangeA?.end || !rangeB?.start || !rangeB?.end) {
    return { error: "Both rangeA and rangeB need start and end dates." };
  }

  const [reportsA, reportsB] = await Promise.all([
    getShiftReportsInRange(rangeA.start, rangeA.end, shiftName),
    getShiftReportsInRange(rangeB.start, rangeB.end, shiftName),
  ]);

  const totalsA = sumTotals(reportsA);
  const totalsB = sumTotals(reportsB);
  const avgOee = (t) => (t.count ? round1(t.oeeSum / t.count) : null);

  return {
    rangeA: { ...rangeA, actualQty: totalsA.actualQty, accepted: totalsA.accepted, rejected: totalsA.rejected, avgOee: avgOee(totalsA), shiftDaysWithData: totalsA.count },
    rangeB: { ...rangeB, actualQty: totalsB.actualQty, accepted: totalsB.accepted, rejected: totalsB.rejected, avgOee: avgOee(totalsB), shiftDaysWithData: totalsB.count },
    deltaPct: {
      actualQty: deltaPct(totalsB.actualQty, totalsA.actualQty),
      accepted: deltaPct(totalsB.accepted, totalsA.accepted),
      oee: deltaPct(avgOee(totalsB) || 0, avgOee(totalsA) || 0),
    },
  };
};
