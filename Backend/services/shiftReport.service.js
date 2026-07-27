/**
 * Builds the per-model production/OEE breakdown for one shift occurrence,
 * used by the shift-end email report cron. Mirrors ProductionReport.jsx's
 * aggregation, plus merges in PartProcessQualityLog (Accepted/Rejected) the
 * same way Frontend/src/pages/PartProcess/ProductionReport.jsx does.
 */
import { aggregateRecords, mapDbRecord, enrichRecords, detectChangeovers, parseDurSecs, computeOEE } from "../utils/productionLogic.js";

// "HH:MM" -> minutes since midnight, wrapping for an overnight shift
// (endTime <= startTime means it crosses midnight, e.g. Shift 2 20:00-08:00).
const shiftDurationMins = (shift) => {
  const toMins = (hhmm) => {
    const [h, m] = String(hhmm || "0:0").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const s = toMins(shift.startTime);
  let e = toMins(shift.endTime);
  if (e <= s) e += 1440;
  return e - s;
};

const MATERIAL_SELECT = `
  SELECT
    Id AS id, SapCode AS sapCode, PartName AS partName,
    NoOfSheet AS noOfSheet, ActualComponentsPerSheet AS actualComponentsPerSheet,
    PncLoadingUnloading AS pncLoadingUnloading, DefinedComponentCycleTime AS definedComponentCycleTime,
    SheetSapCode AS sheetSapCode, SheetDescription AS sheetDescription,
    Weight AS weight, ScrapWeight AS scrapWeight,
    Status AS status
  FROM MaterialConfigs WHERE Status = 1`;

// ── Quality log aggregated by part name (MAX inspected, SUM rejected) ───────
const buildQualityByPartName = (qLogRows) => {
  const map = {};
  qLogRows.forEach((e) => {
    const key = e.PartName || e.Model || "";
    if (!key) return;
    if (!map[key]) map[key] = { inspected: 0, rejected: 0 };
    map[key].inspected = Math.max(map[key].inspected, e.InspectedQty ?? 0);
    map[key].rejected  += e.RejectedQty ?? 0;
  });
  return map;
};

/**
 * @param pool         mssql connection pool (global.pool3)
 * @param shift        { id, shiftName, startTime, endTime }
 * @param dateStr      "YYYY-MM-DD" — the production day this shift occurrence belongs to
 * @returns { shiftName, date, rows, totals, downtimeBreakdown } or null if no production data
 */
export const buildShiftReport = async (pool, shift, dateStr) => {
  const [eventsRes, materialsRes, qLogRes, dtLogRes, plansRes, shiftsRes] = await Promise.all([
    pool.request()
      .input("date", dateStr)
      .input("shiftName", shift.shiftName)
      .query(`
        SELECT EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality
        FROM PartProcessEvents
        WHERE EventDate = @date AND ShiftName = @shiftName AND Status = 1
        ORDER BY StartTime ASC
      `),
    pool.request().query(MATERIAL_SELECT),
    pool.request()
      .input("date", dateStr)
      .input("shiftName", shift.shiftName)
      .query(`
        SELECT PartName, Model, InspectedQty, RejectedQty
        FROM PartProcessQualityLog
        WHERE EventDate = @date AND ShiftName = @shiftName
      `),
    pool.request()
      .input("date", dateStr)
      .input("shiftName", shift.shiftName)
      .query(`
        SELECT ReasonName, Category, Duration, IsChangeover
        FROM PartProcessDowntimeLog
        WHERE EventDate = @date AND ShiftName = @shiftName
      `),
    pool.request()
      .input("date", dateStr)
      .query(`
        SELECT SapCode AS sapCode, PartName AS partName, TargetQty AS targetQty, Shift AS shift, Status AS status
        FROM ProductionPlans
        WHERE PlanDate = @date AND Status = 1
      `),
    pool.request().query(`SELECT ShiftName FROM ShiftConfigs WHERE Status = 1`),
  ]);

  const records   = eventsRes.recordset.map(mapDbRecord);
  const materials = materialsRes.recordset;
  if (!records.length) return null;

  const plans = plansRes.recordset;
  const realShiftNames = shiftsRes.recordset.map((s) => s.ShiftName);
  const rows = aggregateRecords(records, materials, dateStr, plans, shift.shiftName, realShiftNames);
  if (!rows.length) return null;

  const qualityByPartName = buildQualityByPartName(qLogRes.recordset);

  const enrichedRows = rows.map((r) => {
    const qLog = qualityByPartName[r.itemDescription];
    const rejected = qLog?.rejected ?? 0;
    const accepted  = Math.max(0, r.componentQty - rejected);
    const material = materials.find((m) => m.sapCode === r.sapCode);
    const totalDowntimeMins = Math.max(0, (r.lossMins || 0) - (r.coOverrunMins || 0));
    return {
      ...r,
      startedAt: r.startedAt || "",
      completedAt: r.completedAt || "",
      sheetSapCode: material?.sheetSapCode || "",
      sheetDescription: material?.sheetDescription || "",
      sheetWeightKg: Math.round((Number(material?.weight) || 0) * (r.actualQty || 0) * 100) / 100,
      scrapWeightKg: Math.round((Number(material?.scrapWeight) || 0) * (r.actualQty || 0) * 100) / 100,
      totalDowntimeMins,
      accepted,
      rejected,
    };
  });

  const totals = enrichedRows.reduce((acc, r) => {
    acc.planQty      += r.planQty;
    acc.actualQty     += r.actualQty;
    acc.componentQty += r.componentQty;
    acc.accepted      += r.accepted;
    acc.rejected      += r.rejected;
    acc.rejects       += r.rejects;
    acc.lossMins      += r.lossMins;
    // Rows with zero actual components — ghost rows ("planned, not yet
    // produced") and any row whose only activity was a downtime event
    // attributed to a model that never actually ran — have no real OEE.
    // Including them would drag the average down as if they were
    // badly-performing production instead of simply not having started.
    if (r.componentQty > 0) {
      acc.oeeSum += r.oee;
      acc.aSum   += r.availability;
      acc.pSum   += r.performance;
      acc.qSum   += r.quality;
      acc.producedCount += 1;
    }
    return acc;
  }, { planQty: 0, actualQty: 0, componentQty: 0, accepted: 0, rejected: 0, rejects: 0, lossMins: 0, oeeSum: 0, aSum: 0, pSum: 0, qSum: 0, producedCount: 0 });

  const n = totals.producedCount || 1;
  totals.oee         = Math.round((totals.oeeSum / n) * 10) / 10;
  totals.availability = Math.round((totals.aSum / n) * 10) / 10;
  totals.performance  = Math.round((totals.pSum / n) * 10) / 10;
  totals.quality      = Math.round((totals.qSum / n) * 10) / 10;

  // ---- Shift-wide runtime/downtime/idle + changeover counts ----
  // Computed from the FULL shift record set, not the per-model row groups
  // aggregateRecords uses — a changeover is fundamentally a transition
  // between DIFFERENT models, so detecting it needs the full chronological
  // sequence, not a single-SAP-code subset (which never sees more than one
  // model and so can never register a transition).
  const shiftEnriched = enrichRecords(records);
  totals.runMins  = Math.round(shiftEnriched.filter((r) => r.state === "Production").reduce((s, r) => s + parseDurSecs(r.duration), 0) / 60);
  totals.downMins = Math.round(shiftEnriched.filter((r) => r.effectiveState === "Downtime").reduce((s, r) => s + parseDurSecs(r.duration), 0) / 60);
  totals.idleMins = Math.round(shiftEnriched.filter((r) => r.effectiveState === "Idle").reduce((s, r) => s + parseDurSecs(r.duration), 0) / 60);

  // "Planned changeovers" = number of distinct models/parts planned for
  // this shift (i.e. every row that resolved to a real Planning Config
  // entry, produced or not — see planQtyFromConfig in aggregateRecords).
  // "Actual changeovers" = real model-to-model transitions detected across
  // the whole shift.
  totals.plannedChangeovers = enrichedRows.filter((r) => r.planQtyFromConfig).length;
  totals.actualChangeovers  = detectChangeovers(records).length;

  // ---- Machine OEE — one shift-wide A/P/Q/OEE figure (computeOEE), not an
  // average of the per-model row percentages above. Averaging per-model
  // OEE% treats every part equally regardless of volume, which can be
  // pulled around by a handful of low-volume rows; this instead weighs
  // Availability/Performance/Quality by real shift-wide time and quantity.
  const machine = computeOEE({
    prodRecords: records.filter((r) => r.state === "Production"),
    downRecords: records.filter((r) => r.state === "Downtime"),
    plannedMins: shiftDurationMins(shift),
    materials,
  });
  totals.machineOEE          = machine.OEE;
  totals.machineAvailability = machine.A;
  totals.machinePerformance  = machine.P;
  totals.machineQuality      = machine.Q;

  // Downtime reason breakdown — minutes lost per reason (excludes changeovers)
  const dtMap = {};
  dtLogRes.recordset.forEach((e) => {
    if (e.IsChangeover) return;
    const reason = e.ReasonName || "Unassigned";
    const mins = (() => {
      const [h, m, s] = String(e.Duration || "00:00:00").split(":").map(Number);
      return Math.round(((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) / 60);
    })();
    dtMap[reason] = (dtMap[reason] || 0) + mins;
  });
  const downtimeBreakdown = Object.entries(dtMap)
    .map(([reason, mins]) => ({ reason, mins }))
    .sort((a, b) => b.mins - a.mins);

  return { shiftName: shift.shiftName, date: dateStr, rows: enrichedRows, totals, downtimeBreakdown };
};
