import * as production from "./productionMetrics.js";
import * as quality from "./qualityMetrics.js";
import * as dispatch from "./dispatchMetrics.js";
import * as audit from "./auditMetrics.js";

// Central catalog: namespaced metric key -> domain adapter. Naming convention
// is "<domain>.<field>", with the field name traceable back to the source
// object (shiftReport.service.js's `totals.oee`, getFpaSummary's `fpqi`).
// Add new domains here as they're wired up — this is the one place that
// needs to change for the AI tools/stats engine to see a new metric.
const REGISTRY = {
  "production.oee": { domain: "production", label: "OEE (avg of shift OEE, unweighted)", unit: "%", fetch: (s, e, p) => production.getDailySeries("oee", s, e, p) },
  "production.availability": { domain: "production", label: "Availability (avg across shifts)", unit: "%", fetch: (s, e, p) => production.getDailySeries("availability", s, e, p) },
  "production.performance": { domain: "production", label: "Performance (avg across shifts)", unit: "%", fetch: (s, e, p) => production.getDailySeries("performance", s, e, p) },
  "production.quality": { domain: "production", label: "Quality % (avg across shifts, Part Process pipeline)", unit: "%", fetch: (s, e, p) => production.getDailySeries("quality", s, e, p) },
  "production.actualQty": { domain: "production", label: "Actual output (sum across shifts)", unit: "units", fetch: (s, e, p) => production.getDailySeries("actualQty", s, e, p) },
  "production.acceptedQty": { domain: "production", label: "Accepted qty (sum across shifts)", unit: "units", fetch: (s, e, p) => production.getDailySeries("accepted", s, e, p) },
  "production.rejectedQty": { domain: "production", label: "Rejected qty (sum across shifts)", unit: "units", fetch: (s, e, p) => production.getDailySeries("rejected", s, e, p) },
  "production.lossMins": { domain: "production", label: "Production loss minutes (sum)", unit: "min", fetch: (s, e, p) => production.getDailySeries("lossMins", s, e, p) },
  "production.downtimeMins": { domain: "production", label: "Downtime minutes, excl. changeover (sum)", unit: "min", fetch: (s, e, p) => production.getDailySeries("downtimeMins", s, e, p) },

  "quality.fpqi": { domain: "quality", label: "FPQI weighted defect index (lower is better)", unit: "index", fetch: (s, e, p) => quality.getDailySeries("fpqi", s, e, p) },
  "quality.criticalDefects": { domain: "quality", label: "Critical FPA defects", unit: "count", fetch: (s, e, p) => quality.getDailySeries("critical", s, e, p) },
  "quality.majorDefects": { domain: "quality", label: "Major FPA defects", unit: "count", fetch: (s, e, p) => quality.getDailySeries("major", s, e, p) },
  "quality.minorDefects": { domain: "quality", label: "Minor FPA defects", unit: "count", fetch: (s, e, p) => quality.getDailySeries("minor", s, e, p) },
  "quality.sampleInspected": { domain: "quality", label: "FPA units inspected", unit: "count", fetch: (s, e, p) => quality.getDailySeries("inspectedFG", s, e, p) },

  "dispatch.dispatchedQty": { domain: "dispatch", label: "Dispatched units (sum per day, WWMS — may be offline)", unit: "units", fetch: (s, e, p) => dispatch.getDailySeries("dispatchedQty", s, e, p) },

  "audit.totalAudits": { domain: "audit", label: "Audits created per day", unit: "count", fetch: (s, e, p) => audit.getDailySeries("totalAudits", s, e, p) },
  "audit.approvedCount": { domain: "audit", label: "Approved audits per day", unit: "count", fetch: (s, e, p) => audit.getDailySeries("approvedCount", s, e, p) },
  "audit.rejectedCount": { domain: "audit", label: "Rejected audits per day", unit: "count", fetch: (s, e, p) => audit.getDailySeries("rejectedCount", s, e, p) },
  "audit.approvalRate": { domain: "audit", label: "Audit approval rate (approved / total, workflow status only — not a findings score)", unit: "%", fetch: (s, e, p) => audit.getDailySeries("approvalRate", s, e, p) },
};

export const listMetrics = () =>
  Object.entries(REGISTRY).map(([key, m]) => ({ key, domain: m.domain, label: m.label, unit: m.unit }));

export const getMetric = (key) => REGISTRY[key] || null;

/**
 * @returns {label, unit, points: {date, value, sampleSize}[]} or {error} if the key is unknown.
 */
export const getDailySeries = async (key, start, end, params = {}) => {
  const metric = getMetric(key);
  if (!metric) return { error: `Unknown metric "${key}". Call listAvailableMetrics for valid keys.` };
  const points = await metric.fetch(start, end, params);
  return { key, label: metric.label, unit: metric.unit, points };
};
