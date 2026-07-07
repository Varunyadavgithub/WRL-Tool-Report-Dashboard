/**
 * Threshold checks against a buildShiftReport() result (Backend/services/
 * shiftReport.service.js) — reuses data already computed for the shift-end
 * email rather than re-querying anything. Thresholds are read from the
 * existing generic AppSettings key-value table so they're adjustable without
 * a code change, falling back to sane defaults when unset.
 */
const DEFAULTS = {
  "alert.oeeThreshold": 60,
  "alert.downtimeThresholdMins": 60,
  "alert.rejectRateThresholdPct": 5,
};

const getThreshold = async (pool3, key) => {
  const result = await pool3.request()
    .input("key", key)
    .query(`SELECT Value FROM AppSettings WHERE SettingKey = @key`);
  const raw = result.recordset[0]?.Value;
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULTS[key];
};

/**
 * @param pool3  mssql pool (global.pool3 — where AppSettings lives)
 * @param report buildShiftReport() result: { shiftName, date, totals, downtimeBreakdown }
 * @returns Array<{ type, metricValue, thresholdValue }> — empty if nothing breached
 */
export const evaluateShiftAlerts = async (pool3, report) => {
  const [oeeThreshold, downtimeThreshold, rejectRateThreshold] = await Promise.all([
    getThreshold(pool3, "alert.oeeThreshold"),
    getThreshold(pool3, "alert.downtimeThresholdMins"),
    getThreshold(pool3, "alert.rejectRateThresholdPct"),
  ]);

  const breaches = [];
  const { oee, lossMins, accepted, rejected } = report.totals;

  if (oee < oeeThreshold) {
    breaches.push({ type: "LowOEE", metricValue: oee, thresholdValue: oeeThreshold });
  }

  if (lossMins > downtimeThreshold) {
    breaches.push({ type: "HighDowntime", metricValue: lossMins, thresholdValue: downtimeThreshold });
  }

  const totalInspected = accepted + rejected;
  if (totalInspected > 0) {
    const rejectRatePct = Math.round((rejected / totalInspected) * 1000) / 10;
    if (rejectRatePct > rejectRateThreshold) {
      breaches.push({ type: "HighRejectRate", metricValue: rejectRatePct, thresholdValue: rejectRateThreshold });
    }
  }

  return breaches;
};
