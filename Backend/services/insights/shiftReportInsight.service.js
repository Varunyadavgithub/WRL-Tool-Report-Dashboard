import { mapDbRecord, aggregateRecords } from "../../utils/productionLogic.js";
import { MAX_RANGE_DAYS } from "../../ai/tools/_shared.js";
import { getDailySeries } from "../metrics/registry.js";
import { trend, zScoreOutliers } from "../stats/statsEngine.js";

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const fmtYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Ports Frontend/src/pages/PartProcess/ProductionReport.jsx's todSecs — parses
// "HH:MM[:SS]" (optionally prefixed with a date/"T") into seconds-of-day.
const todSecs = (t) => {
  if (!t) return null;
  const s = String(t);
  const tp = s.includes("T") ? s.split("T")[1] : s.length > 10 && s.includes(" ") ? s.split(" ")[1] : s;
  const [h, m, sec] = tp.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 3600 + m * 60 + (sec || 0);
};

/**
 * Fetches PartProcessEvents/MaterialConfigs/PartProcessQualityLog for the
 * calendar-day superset of [startMs, endMs), then narrows to the EXACT
 * requested datetime window using each record's absolute timestamp — this
 * mirrors ProductionReport.jsx's fetchData()/aggregateRecords() precisely, so
 * the insight panel's numbers match what the report table shows for the same
 * query. Whole-calendar-day + shift-name matching (the getShiftReportsInRange
 * pipeline the 3 pre-existing AI tools use) is a coarser granularity that
 * silently over/under-counts whenever the requested window doesn't align to
 * midnight — this function exists specifically to avoid that for the panel's
 * headline KPI numbers.
 */
const fetchPreciseWindowRows = async (startMs, endMs, shiftName) => {
  const shiftsRes = await global.pool3.request().query(`SELECT StartTime FROM ShiftConfigs WHERE Status = 1`);
  const dayStartSec = shiftsRes.recordset.length
    ? Math.min(...shiftsRes.recordset.map((s) => todSecs(s.StartTime) ?? 0))
    : 0;

  const prodDayOf = (ms) => {
    const d = new Date(ms);
    const tod = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    const base = new Date(d);
    base.setHours(0, 0, 0, 0);
    if (tod < dayStartSec) base.setDate(base.getDate() - 1);
    return base;
  };

  const dates = [];
  const cur = prodDayOf(startMs);
  const last = prodDayOf(endMs - 1000);
  while (cur <= last) {
    dates.push(fmtYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  if (dates.length > MAX_RANGE_DAYS) {
    throw new Error(`Date range too wide (${dates.length} days). Please ask for ${MAX_RANGE_DAYS} days or fewer at a time.`);
  }

  const dateStart = dates[0];
  const dateEnd = dates[dates.length - 1];

  const [eventsRes, materialsRes, qLogRes] = await Promise.all([
    global.pool3.request()
      .input("startDate", dateStart)
      .input("endDate", dateEnd)
      .query(`
        SELECT EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality
        FROM PartProcessEvents WHERE EventDate BETWEEN @startDate AND @endDate
      `),
    global.pool3.request().query(`
      SELECT Id AS id, SapCode AS sapCode, PartName AS partName, NoOfSheet AS noOfSheet,
             ActualComponentsPerSheet AS actualComponentsPerSheet, PncLoadingUnloading AS pncLoadingUnloading,
             DefinedComponentCycleTime AS definedComponentCycleTime, Status AS status
      FROM MaterialConfigs WHERE Status = 1
    `),
    global.pool3.request()
      .input("startDate", dateStart)
      .input("endDate", dateEnd)
      .query(`
        SELECT PartName, Model, InspectedQty, RejectedQty
        FROM PartProcessQualityLog WHERE EventDate BETWEEN @startDate AND @endDate
      `),
  ]);

  const mapped = eventsRes.recordset.map((r) => {
    const base = mapDbRecord(r);
    // mssql returns DATE columns as JS Date objects (UTC-midnight), not
    // strings — String(r.EventDate).slice(0,10) would slice a human-readable
    // toString() output ("Wed Apr 22 2026...") into garbage, not an ISO date.
    const ed = r.EventDate instanceof Date ? r.EventDate : new Date(r.EventDate);
    const dateStr = `${ed.getUTCFullYear()}-${String(ed.getUTCMonth() + 1).padStart(2, "0")}-${String(ed.getUTCDate()).padStart(2, "0")}`;
    const midnight = new Date(dateStr + "T00:00:00").getTime();
    const tod = todSecs(base.startTime);
    const absMs = tod === null ? null : midnight + (tod < dayStartSec ? 86400000 : 0) + tod * 1000;
    return { ...base, _absMs: absMs };
  });

  const filtered = mapped.filter(
    (r) => r._absMs !== null && r._absMs >= startMs && r._absMs < endMs && (!shiftName || r.shift === shiftName),
  );

  // Same PartProcessQualityLog merge shiftReport.service.js's buildShiftReport
  // uses (MAX inspected, SUM rejected, keyed by part name) — accepted/rejected
  // here are in component units, overriding aggregateRecords' own sheet-based
  // `rejects` field.
  const qualityByPartName = {};
  for (const e of qLogRes.recordset) {
    const key = e.PartName || e.Model || "";
    if (!key) continue;
    if (!qualityByPartName[key]) qualityByPartName[key] = { inspected: 0, rejected: 0 };
    qualityByPartName[key].inspected = Math.max(qualityByPartName[key].inspected, e.InspectedQty ?? 0);
    qualityByPartName[key].rejected += e.RejectedQty ?? 0;
  }

  const rows = aggregateRecords(filtered, materialsRes.recordset, dateStart);
  return rows.map((r) => {
    const rejected = qualityByPartName[r.itemDescription]?.rejected ?? r.rejects ?? 0;
    const accepted = Math.max(0, r.componentQty - rejected);
    return { ...r, accepted, rejected };
  });
};

/**
 * Pure aggregation — no LLM call. Every number here is pre-rounded and
 * pre-aggregated; this is the ONLY source of truth for numbers shown in the
 * insight panel. The LLM (see Backend/ai/insights/shiftReportInsight.js)
 * only narrates this payload, never recomputes it.
 *
 * @param start "YYYY-MM-DD HH:MM" (or any Date-parseable string) — full
 *   datetime, not date-only. @param end same. @param shiftName optional.
 */
export const buildShiftInsightPayload = async (start, end, shiftName) => {
  const startMs = new Date(String(start).replace(" ", "T")).getTime();
  const endMs = new Date(String(end).replace(" ", "T")).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    throw new Error("Invalid date range.");
  }

  const rows = await fetchPreciseWindowRows(startMs, endMs, shiftName);
  if (!rows.length) return { start, end, shiftName: shiftName || "All shifts", hasData: false };

  const componentQty = rows.reduce((s, r) => s + r.componentQty, 0);
  const accepted = rows.reduce((s, r) => s + r.accepted, 0);
  const rejected = rows.reduce((s, r) => s + r.rejected, 0);
  const lossMins = rows.reduce((s, r) => s + r.lossMins, 0);
  const avgOee = round(rows.reduce((s, r) => s + r.oee, 0) / rows.length);

  // Trend/outlier signals still come from the day-level metric registry
  // (production.* keys, built on the shift-report pipeline) — a coarser,
  // directional signal, not the headline number being cross-checked against
  // the report table, so date-only granularity here is an acceptable,
  // deliberate simplification rather than a silent mismatch.
  const dateOnlyStart = String(start).slice(0, 10);
  const dateOnlyEnd = String(end).slice(0, 10);
  const [oeeSeries, outputSeries, rejectSeries, downtimeSeries] = await Promise.all([
    getDailySeries("production.oee", dateOnlyStart, dateOnlyEnd, { shiftName }),
    getDailySeries("production.actualQty", dateOnlyStart, dateOnlyEnd, { shiftName }),
    getDailySeries("production.rejectedQty", dateOnlyStart, dateOnlyEnd, { shiftName }),
    getDailySeries("production.downtimeMins", dateOnlyStart, dateOnlyEnd, { shiftName }),
  ]);

  const dtLogRes = await global.pool3.request()
    .input("startDate", dateOnlyStart)
    .input("endDate", dateOnlyEnd)
    .input("shiftName", shiftName || null)
    .query(`
      SELECT ReasonName, Duration, IsChangeover FROM PartProcessDowntimeLog
      WHERE EventDate BETWEEN @startDate AND @endDate AND (@shiftName IS NULL OR ShiftName = @shiftName)
    `);
  const byReason = {};
  for (const e of dtLogRes.recordset) {
    if (e.IsChangeover) continue;
    const [h, m, s] = String(e.Duration || "00:00:00").split(":").map(Number);
    const mins = Math.round(((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) / 60);
    const reason = e.ReasonName || "Unassigned";
    byReason[reason] = (byReason[reason] || 0) + mins;
  }
  const topDowntimeReasons = Object.entries(byReason)
    .map(([reason, mins]) => ({ reason, mins }))
    .sort((a, b) => b.mins - a.mins)
    .slice(0, 5);

  return {
    start,
    end,
    shiftName: shiftName || "All shifts",
    hasData: true,
    kpis: {
      avgOee,
      componentQty,
      accepted,
      rejected,
      rejectRatePct: componentQty > 0 ? round((rejected / componentQty) * 100) : 0,
      lossMins,
      modelCount: rows.length,
    },
    oeeTrend: trend(oeeSeries.points),
    outputTrend: trend(outputSeries.points),
    rejectOutliers: zScoreOutliers(rejectSeries.points),
    downtimeOutliers: zScoreOutliers(downtimeSeries.points),
    topDowntimeReasons,
  };
};
