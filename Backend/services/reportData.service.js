/**
 * Per-report-type data aggregation for the shift-end email Excel attachments.
 * Each builder returns the same `blocks` shape the frontend's multi-section
 * exports use (Frontend/src/utils/reportExport.js) — a flat ordered list of
 * table sections — but reads from one shared raw-data fetch instead of the
 * live API calls the report pages make, since this runs server-side off the
 * shift-end cron. Only table blocks are produced; a spreadsheet attachment
 * is for the raw sortable numbers, not static chart images.
 */
import {
  mapDbRecord, enrichRecords, detectChangeovers, changeoverStats, parseDurSecs,
  getMaterialByModel,
} from "../utils/productionLogic.js";

const MATERIAL_SELECT = `
  SELECT
    Id AS id, SapCode AS sapCode, PartName AS partName,
    NoOfSheet AS noOfSheet, ActualComponentsPerSheet AS actualComponentsPerSheet,
    PncLoadingUnloading AS pncLoadingUnloading, DefinedComponentCycleTime AS definedComponentCycleTime,
    Status AS status
  FROM MaterialConfigs WHERE Status = 1`;

// ── Shared raw fetch — events, materials, downtime log for one shift occurrence ──
export const fetchShiftRawData = async (pool, shift, dateStr) => {
  const [eventsRes, materialsRes, dtLogRes] = await Promise.all([
    pool.request().input("date", dateStr).input("shiftName", shift.shiftName).query(`
      SELECT EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality
      FROM PartProcessEvents WHERE EventDate = @date AND ShiftName = @shiftName ORDER BY StartTime ASC`),
    pool.request().query(MATERIAL_SELECT),
    pool.request().input("date", dateStr).input("shiftName", shift.shiftName).query(`
      SELECT Id, SrNo, EventId, ShiftName, EventDate, StartTime, EndTime, Duration, Model, FromModel,
             IsChangeover, ReasonCode, ReasonName, Category, Planned, Remarks, LoggedAt
      FROM PartProcessDowntimeLog WHERE EventDate = @date AND ShiftName = @shiftName ORDER BY LoggedAt DESC`),
  ]);

  return {
    records: eventsRes.recordset.map(mapDbRecord),
    materials: materialsRes.recordset,
    dtLogRows: dtLogRes.recordset,
    dateStr,
    shiftName: shift.shiftName,
  };
};

// ── Downtime Report ───────────────────────────────────────────────────────
export const buildDowntimeReportBlocks = (raw) => {
  const { materials, dtLogRows } = raw;
  const enriched = enrichRecords(raw.records);
  const allDT = enriched.filter((r) => r.state === "Downtime");

  const dtRows = allDT.map((r, idx) => {
    const logged = dtLogRows.find((d) => d.EventId && String(d.EventId) === String(r.eventId));
    return {
      idx: idx + 1, shift: r.shift,
      type: r.effectiveState === "Idle" ? "Idle" : "Downtime",
      start: r.startTime, end: r.endTime, duration: r.duration,
      reason: logged?.ReasonName || "Unassigned",
    };
  });

  const changeovers = detectChangeovers(raw.records);
  const coRows = changeovers.map((c, i) => ({
    idx: i + 1, shift: c.shift || "—",
    fromModel: getMaterialByModel(materials, c.fromModel)?.partName || c.fromModel,
    toModel: getMaterialByModel(materials, c.toModel)?.partName || c.toModel,
    start: c.startTime, end: c.endTime, duration: `${c.durationMins.toFixed(1)}m`,
    status: c.isOverrun ? `+${c.overrunMins.toFixed(1)}m overrun` : "Within std",
  }));

  const blocks = [{
    type: "table", heading: "Downtime Events",
    columns: [
      { label: "#", align: "center", value: (r) => r.idx },
      { label: "Shift", align: "left", value: (r) => r.shift },
      { label: "Type", align: "center", value: (r) => r.type },
      { label: "Start", align: "left", value: (r) => r.start },
      { label: "End", align: "left", value: (r) => r.end },
      { label: "Duration", align: "center", value: (r) => r.duration },
      { label: "Reason", align: "left", value: (r) => r.reason, width: 2.5 },
    ],
    rows: dtRows,
  }];

  if (coRows.length) {
    blocks.push({
      type: "table", heading: "Changeovers",
      columns: [
        { label: "#", align: "center", value: (r) => r.idx },
        { label: "Shift", align: "left", value: (r) => r.shift },
        { label: "From", align: "left", value: (r) => r.fromModel, width: 2 },
        { label: "To", align: "left", value: (r) => r.toModel, width: 2 },
        { label: "Start", align: "left", value: (r) => r.start },
        { label: "End", align: "left", value: (r) => r.end },
        { label: "Duration", align: "center", value: (r) => r.duration },
        { label: "Status", align: "left", value: (r) => r.status, width: 2 },
      ],
      rows: coRows,
    });
  }

  const briefSecs = allDT.filter((r) => r.effectiveState !== "Idle").reduce((s, r) => s + parseDurSecs(r.duration), 0);
  const idleSecs = allDT.filter((r) => r.effectiveState === "Idle").reduce((s, r) => s + parseDurSecs(r.duration), 0);
  const coStats = changeoverStats(changeovers);

  if (briefSecs + idleSecs + coStats.overrunMins > 0) {
    blocks.push({
      type: "table", heading: "Loss Summary",
      columns: [
        { label: "Type", align: "left", value: (r) => r.type, width: 2 },
        { label: "Minutes", align: "center", value: (r) => r.mins },
      ],
      rows: [
        { type: "Downtime", mins: Math.round(briefSecs / 60) },
        { type: "Idle", mins: Math.round(idleSecs / 60) },
        { type: "Changeover Overrun", mins: coStats.overrunMins },
      ],
    });
  }

  // Loss by Reason / Department — straight from the logged downtime entries
  // (their own Duration field), same source the Downtime Report page charts.
  const reasonMins = {};
  const deptMins = {};
  dtLogRows.forEach((e) => {
    if (e.IsChangeover) return;
    const mins = Math.round(parseDurSecs(e.Duration) / 60);
    const reason = e.ReasonName || "Unassigned";
    reasonMins[reason] = (reasonMins[reason] || 0) + mins;
    if (e.Category) deptMins[e.Category] = (deptMins[e.Category] || 0) + mins;
  });
  const reasonEntries = Object.entries(reasonMins).sort((a, b) => b[1] - a[1]);
  const deptEntries = Object.entries(deptMins).sort((a, b) => b[1] - a[1]);

  if (reasonEntries.length) {
    blocks.push({
      type: "table", heading: "Loss by Reason",
      columns: [
        { label: "Reason", align: "left", value: (r) => r[0], width: 3 },
        { label: "Minutes", align: "center", value: (r) => r[1] },
      ],
      rows: reasonEntries,
    });
  }

  if (deptEntries.length) {
    blocks.push({
      type: "table", heading: "Loss by Department",
      columns: [
        { label: "Department", align: "left", value: (r) => r[0], width: 2.5 },
        { label: "Minutes", align: "center", value: (r) => r[1] },
      ],
      rows: deptEntries,
    });
  }

  if (dtLogRows.length) {
    blocks.push({
      type: "table", heading: "Logged Entries",
      columns: [
        { label: "Shift", align: "left", value: (e) => e.ShiftName || "" },
        { label: "Type", align: "center", value: (e) => (e.IsChangeover ? "Changeover" : "Downtime") },
        { label: "Start", align: "left", value: (e) => e.StartTime || "" },
        { label: "End", align: "left", value: (e) => e.EndTime || "" },
        { label: "Duration", align: "center", value: (e) => e.Duration || "" },
        { label: "Reason", align: "left", value: (e) => e.ReasonName || "", width: 1.5 },
        { label: "Category", align: "left", value: (e) => e.Category || "" },
        { label: "Remarks", align: "left", value: (e) => e.Remarks || "", width: 1.5 },
      ],
      rows: dtLogRows,
    });
  }

  return blocks;
};
