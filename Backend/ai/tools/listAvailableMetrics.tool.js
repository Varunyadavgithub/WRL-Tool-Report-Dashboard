import { listMetrics } from "../../services/metrics/registry.js";

export const definition = {
  type: "function",
  function: {
    name: "listAvailableMetrics",
    description:
      "List every metric key available for getMetricTimeSeries/correlateMetrics, with its domain, label and unit. Call this first if you don't already know the exact metric key (e.g. 'production.oee', 'quality.fpqi').",
    parameters: { type: "object", properties: {} },
  },
};

export const execute = async () => ({ metrics: listMetrics() });
