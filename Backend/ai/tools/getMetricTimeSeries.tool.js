import { getDailySeries } from "../../services/metrics/registry.js";
import { trend, zScoreOutliers } from "../../services/stats/statsEngine.js";

export const definition = {
  type: "function",
  function: {
    name: "getMetricTimeSeries",
    description:
      "Get a daily time series for ONE metric (call listAvailableMetrics for valid keys) plus its computed trend direction and any statistical outlier days. Use for 'how has OEE trended' or 'any spikes in rejects last month' questions — trend/outliers here are real computed statistics, not a guess.",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", description: "Metric key, e.g. 'production.oee' or 'quality.fpqi'." },
        start: { type: "string", description: "Start date, YYYY-MM-DD." },
        end: { type: "string", description: "End date, YYYY-MM-DD." },
        shiftName: { type: "string", description: "Optional — applies only to production.* metrics." },
        model: { type: "string", description: "Optional — applies only to quality.* metrics." },
        templateId: { type: "number", description: "Optional — applies only to audit.* metrics." },
      },
      required: ["metric", "start", "end"],
    },
  },
};

export const execute = async ({ metric, start, end, shiftName, model, templateId } = {}) => {
  if (!metric || !start || !end) return { error: "metric, start and end are required." };

  const series = await getDailySeries(metric, start, end, { shiftName, model, templateId });
  if (series.error) return series;
  if (!series.points.length) return { metric, note: "No data points found in this range." };

  return {
    metric,
    label: series.label,
    unit: series.unit,
    start,
    end,
    points: series.points,
    trend: trend(series.points),
    outliers: zScoreOutliers(series.points),
  };
};
