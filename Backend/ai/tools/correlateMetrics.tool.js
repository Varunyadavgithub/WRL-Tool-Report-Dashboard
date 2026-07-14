import { getDailySeries } from "../../services/metrics/registry.js";
import { alignSeries, correlate } from "../../services/stats/statsEngine.js";

export const definition = {
  type: "function",
  function: {
    name: "correlateMetrics",
    description:
      "Compute the statistical correlation between two daily metrics over a date range (e.g. downtime vs FPQI, OEE vs rejects). Only overlapping days count. Use for 'did X affect Y' / 'is X related to Y' questions — this returns a real correlation coefficient, not a guess. A correlation does not prove causation — say so if the result suggests one.",
    parameters: {
      type: "object",
      properties: {
        metricA: { type: "string", description: "First metric key, e.g. 'production.downtimeMins'." },
        metricB: { type: "string", description: "Second metric key, e.g. 'quality.fpqi'." },
        start: { type: "string", description: "Start date, YYYY-MM-DD." },
        end: { type: "string", description: "End date, YYYY-MM-DD." },
        shiftName: { type: "string", description: "Optional — applies only to production.* metrics." },
        model: { type: "string", description: "Optional — applies only to quality.* metrics." },
        templateId: { type: "number", description: "Optional — applies only to audit.* metrics." },
      },
      required: ["metricA", "metricB", "start", "end"],
    },
  },
};

export const execute = async ({ metricA, metricB, start, end, shiftName, model, templateId } = {}) => {
  if (!metricA || !metricB || !start || !end) return { error: "metricA, metricB, start and end are required." };

  const [a, b] = await Promise.all([
    getDailySeries(metricA, start, end, { shiftName, model, templateId }),
    getDailySeries(metricB, start, end, { shiftName, model, templateId }),
  ]);
  if (a.error) return a;
  if (b.error) return b;

  const aligned = alignSeries(a.points, b.points);
  if (!aligned.dates.length) return { metricA, metricB, note: "No overlapping days between the two series in this range." };

  return {
    metricA,
    metricB,
    start,
    end,
    overlappingDays: aligned.dates.length,
    droppedDaysOnlyInA: aligned.droppedA,
    droppedDaysOnlyInB: aligned.droppedB,
    ...correlate(aligned.a, aligned.b),
  };
};
