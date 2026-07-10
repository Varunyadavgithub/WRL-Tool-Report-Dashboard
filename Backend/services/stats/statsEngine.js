import { mean, standardDeviation, sampleCorrelation, linearRegression } from "simple-statistics";

// Pure math only — no DB access, no knowledge of "production"/"quality".
// Any future metric domain can reuse these functions unchanged.

export const MIN_SAMPLE_CORRELATION = 5;
export const MIN_SAMPLE_TREND = 4;
export const MIN_SAMPLE_OUTLIER = 5;

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Inner-join two day-keyed Point[] series ({date, value}) on `date`.
 * Any granularity mismatch between domains (e.g. per-shift vs per-day) must
 * already be resolved before points reach here — this only aligns by date.
 */
export const alignSeries = (seriesA, seriesB) => {
  const mapB = new Map(seriesB.map((p) => [p.date, p.value]));
  const dates = [];
  const a = [];
  const b = [];
  for (const p of seriesA) {
    if (mapB.has(p.date)) {
      dates.push(p.date);
      a.push(p.value);
      b.push(mapB.get(p.date));
    }
  }
  return { dates, a, b, droppedA: seriesA.length - dates.length, droppedB: seriesB.length - dates.length };
};

const strengthLabel = (r) => {
  const abs = Math.abs(r);
  if (abs >= 0.7) return "strong";
  if (abs >= 0.4) return "moderate";
  if (abs >= 0.2) return "weak";
  return "negligible";
};

/** Pearson correlation between two equal-length aligned value arrays. */
export const correlate = (a, b) => {
  if (a.length < MIN_SAMPLE_CORRELATION) {
    return { insufficientData: true, n: a.length, minRequired: MIN_SAMPLE_CORRELATION };
  }
  const r = sampleCorrelation(a, b);
  return {
    insufficientData: false,
    n: a.length,
    r: round(r, 3),
    strength: strengthLabel(r),
    direction: r >= 0 ? "positive" : "negative",
  };
};

/** Linear trend over a day-keyed Point[] series. */
export const trend = (points) => {
  if (points.length < MIN_SAMPLE_TREND) {
    return { insufficientData: true, n: points.length, minRequired: MIN_SAMPLE_TREND };
  }
  const t0 = new Date(points[0].date).getTime();
  const data = points.map((p) => [(new Date(p.date).getTime() - t0) / 86400000, p.value]);
  const { m, b } = linearRegression(data);
  const first = m * data[0][0] + b;
  const last = m * data[data.length - 1][0] + b;
  const pctChange = first === 0 ? null : round(((last - first) / Math.abs(first)) * 100, 1);
  const direction =
    pctChange === null
      ? m > 0 ? "up" : m < 0 ? "down" : "flat"
      : Math.abs(pctChange) < 3 ? "flat" : pctChange > 0 ? "up" : "down";
  return { insufficientData: false, n: points.length, direction, pctChangeOverRange: pctChange, slopePerDay: round(m, 4) };
};

/** Flags points whose z-score against the range's own mean/stdev exceeds threshold. */
export const zScoreOutliers = (points, threshold = 2) => {
  if (points.length < MIN_SAMPLE_OUTLIER) {
    return { insufficientData: true, n: points.length, minRequired: MIN_SAMPLE_OUTLIER, outliers: [] };
  }
  const values = points.map((p) => p.value);
  const mu = mean(values);
  const sigma = standardDeviation(values);
  if (sigma === 0) return { insufficientData: false, mean: round(mu), stdev: 0, outliers: [] };
  const outliers = points
    .map((p) => ({ date: p.date, value: p.value, zScore: round((p.value - mu) / sigma) }))
    .filter((p) => Math.abs(p.zScore) >= threshold);
  return { insufficientData: false, mean: round(mu), stdev: round(sigma), outliers };
};
