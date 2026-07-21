/**
 * Builds the per-model production/OEE breakdown for one shift occurrence,
 * used by the shift-end email report cron. Mirrors ProductionReport.jsx's
 * aggregation, plus merges in PartProcessQualityLog (Accepted/Rejected) the
 * same way Frontend/src/pages/PartProcess/ProductionReport.jsx does.
 */
import { aggregateRecords, mapDbRecord } from "../utils/productionLogic.js";

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
  const [eventsRes, materialsRes, qLogRes, dtLogRes] = await Promise.all([
    pool.request()
      .input("date", dateStr)
      .input("shiftName", shift.shiftName)
      .query(`
        SELECT EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality
        FROM PartProcessEvents
        WHERE EventDate = @date AND ShiftName = @shiftName
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
  ]);

  const records   = eventsRes.recordset.map(mapDbRecord);
  const materials = materialsRes.recordset;
  if (!records.length) return null;

  const rows = aggregateRecords(records, materials, dateStr);
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
    acc.oeeSum        += r.oee;
    acc.aSum          += r.availability;
    acc.pSum          += r.performance;
    acc.qSum          += r.quality;
    return acc;
  }, { planQty: 0, actualQty: 0, componentQty: 0, accepted: 0, rejected: 0, rejects: 0, lossMins: 0, oeeSum: 0, aSum: 0, pSum: 0, qSum: 0 });

  const n = enrichedRows.length || 1;
  totals.oee         = Math.round((totals.oeeSum / n) * 10) / 10;
  totals.availability = Math.round((totals.aSum / n) * 10) / 10;
  totals.performance  = Math.round((totals.pSum / n) * 10) / 10;
  totals.quality      = Math.round((totals.qSum / n) * 10) / 10;

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
