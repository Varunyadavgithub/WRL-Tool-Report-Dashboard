/**
 * Per-report-type data aggregation for the shift-end email PDF attachments.
 * Each builder returns the same `blocks` shape the frontend's multi-section
 * exports use (Frontend/src/utils/reportExport.js) — a flat ordered list of
 * table/image sections — but reads from one shared raw-data fetch instead of
 * the live API calls the report pages make, since this runs server-side off
 * the shift-end cron.
 */
import {
  mapDbRecord, enrichRecords, detectChangeovers, changeoverStats, parseDurSecs,
  getMaterialByModel, componentQtyFromMachine, extractSapCode,
} from "../utils/productionLogic.js";
import { renderChartPNG } from "../utils/pdfChart.js";

const MATERIAL_SELECT = `
  SELECT
    Id AS id, SapCode AS sapCode, PartName AS partName,
    NoOfSheet AS noOfSheet, ActualComponentsPerSheet AS actualComponentsPerSheet,
    PncLoadingUnloading AS pncLoadingUnloading, DefinedComponentCycleTime AS definedComponentCycleTime,
    Status AS status
  FROM MaterialConfigs WHERE Status = 1`;

// ── Shared raw fetch — events, materials, quality log, downtime log for one shift occurrence ──
export const fetchShiftRawData = async (pool, shift, dateStr) => {
  const [eventsRes, materialsRes, qLogRes, dtLogRes] = await Promise.all([
    pool.request().input("date", dateStr).input("shiftName", shift.shiftName).query(`
      SELECT EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality
      FROM PartProcessEvents WHERE EventDate = @date AND ShiftName = @shiftName ORDER BY StartTime ASC`),
    pool.request().query(MATERIAL_SELECT),
    pool.request().input("date", dateStr).input("shiftName", shift.shiftName).query(`
      SELECT Id, ShiftName, EventDate, Model, PartName, SapCode, InspectedQty, RejectedQty,
             DefectCode, DefectName, Severity, Disposition, Remarks
      FROM PartProcessQualityLog WHERE EventDate = @date AND ShiftName = @shiftName ORDER BY LoggedAt DESC`),
    pool.request().input("date", dateStr).input("shiftName", shift.shiftName).query(`
      SELECT Id, SrNo, EventId, ShiftName, EventDate, StartTime, EndTime, Duration, Model, FromModel,
             IsChangeover, ReasonCode, ReasonName, Category, Planned, Remarks, LoggedAt
      FROM PartProcessDowntimeLog WHERE EventDate = @date AND ShiftName = @shiftName ORDER BY LoggedAt DESC`),
  ]);

  return {
    records: eventsRes.recordset.map(mapDbRecord),
    materials: materialsRes.recordset,
    qLogRows: qLogRes.recordset,
    dtLogRows: dtLogRes.recordset,
    dateStr,
    shiftName: shift.shiftName,
  };
};

// ── Production Report — reuses buildShiftReport's per-model OEE rows ─────────
export const buildProductionReportBlocks = (shiftReport) => {
  const columns = [
    { label: "SAP Code", align: "left", value: (r) => r.sapCode },
    { label: "Item Description", align: "left", value: (r) => r.itemDescription, width: 2.5 },
    { label: "Plan Qty", align: "center", value: (r) => r.planQty },
    { label: "Sheet Qty", align: "center", value: (r) => r.actualQty },
    { label: "Component Qty", align: "center", value: (r) => r.componentQty },
    { label: "Accepted", align: "center", value: (r) => r.accepted },
    { label: "Rejected", align: "center", value: (r) => r.rejected },
    { label: "Loss (min)", align: "center", value: (r) => r.lossMins },
    { label: "A%", align: "center", value: (r) => r.availability },
    { label: "P%", align: "center", value: (r) => r.performance },
    { label: "Q%", align: "center", value: (r) => r.quality },
    { label: "OEE%", align: "center", value: (r) => r.oee },
  ];
  const blocks = [{ type: "table", heading: "Production Summary", columns, rows: shiftReport.rows }];
  if (shiftReport.downtimeBreakdown.length) {
    blocks.push({
      type: "table", heading: "Downtime Breakdown",
      columns: [
        { label: "Reason", align: "left", value: (r) => r.reason, width: 3 },
        { label: "Minutes", align: "center", value: (r) => r.mins },
      ],
      rows: shiftReport.downtimeBreakdown,
    });
  }
  return blocks;
};

// ── Quality Report ─────────────────────────────────────────────────────────
export const buildQualityReportBlocks = (raw) => {
  const { materials, qLogRows } = raw;
  const prodRecords = raw.records.filter((r) => r.state === "Production");

  const modelMap = {};
  prodRecords.forEach((r) => {
    const qty = r.qty ?? 0;
    const mat = getMaterialByModel(materials, r.model);
    const sap = mat?.sapCode || r.sapCode || extractSapCode(r.model);
    const key = mat?.partName || r.model || sap;
    if (!key) return;
    if (!modelMap[key]) modelMap[key] = { model: key, total: 0, componentQty: 0 };
    modelMap[key].total += qty;
    modelMap[key].componentQty += Math.round(componentQtyFromMachine(qty, mat));
  });

  const qualityByModel = {};
  qLogRows.forEach((e) => {
    const key = e.PartName || e.Model || "";
    if (!key) return;
    if (!qualityByModel[key]) qualityByModel[key] = { rejected: 0 };
    qualityByModel[key].rejected += e.RejectedQty ?? 0;
  });

  const modelRows = Object.values(modelMap)
    .map((m) => {
      const rejected = qualityByModel[m.model]?.rejected ?? 0;
      return { ...m, rejected, accepted: Math.max(0, m.componentQty - rejected) };
    })
    .sort((a, b) => b.total - a.total);

  const totalAccepted = modelRows.reduce((s, m) => s + m.accepted, 0);
  const totalRejected = modelRows.reduce((s, m) => s + m.rejected, 0);

  const blocks = [{
    type: "table", heading: "Model-wise Quality",
    columns: [
      { label: "Model", align: "left", value: (r) => r.model, width: 2.5 },
      { label: "Sheet Qty", align: "center", value: (r) => r.total },
      { label: "Component Qty", align: "center", value: (r) => r.componentQty },
      { label: "Rejected", align: "center", value: (r) => r.rejected },
      { label: "Accepted", align: "center", value: (r) => r.accepted },
    ],
    rows: modelRows,
  }];

  if (totalAccepted + totalRejected > 0) {
    const buffer = renderChartPNG({
      type: "doughnut",
      data: { labels: ["Accepted", "Rejected"], datasets: [{ data: [totalAccepted, totalRejected], backgroundColor: ["#22c55e", "#f43f5e"] }] },
      options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } } } },
    }, 320, 280);
    blocks.push({ type: "image", heading: "Quality Split", buffer, width: 220, height: 190 });
  }

  if (modelRows.length) {
    const h = Math.max(160, modelRows.length * 32);
    const buffer = renderChartPNG({
      type: "bar",
      data: {
        labels: modelRows.map((r) => r.model),
        datasets: [
          { label: "Accepted", data: modelRows.map((r) => r.accepted), backgroundColor: "#22c55e" },
          { label: "Rejected", data: modelRows.map((r) => r.rejected), backgroundColor: "#f43f5e" },
        ],
      },
      options: { indexAxis: "y", scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { position: "top", labels: { boxWidth: 10 } } } },
    }, 500, h + 60);
    blocks.push({ type: "image", heading: "Accepted vs Rejected", buffer, width: 460, height: h });
  }

  if (qLogRows.length) {
    blocks.push({
      type: "table", heading: "Quality Log Entries",
      columns: [
        { label: "Date", align: "left", value: (e) => String(e.EventDate || "").slice(0, 10) },
        { label: "Shift", align: "left", value: (e) => e.ShiftName || "" },
        { label: "Part Name", align: "left", value: (e) => e.PartName || e.Model || "", width: 2 },
        { label: "Inspected", align: "center", value: (e) => e.InspectedQty ?? 0 },
        { label: "Rejected", align: "center", value: (e) => e.RejectedQty ?? 0 },
        { label: "Defect", align: "left", value: (e) => e.DefectName || "", width: 2 },
        { label: "Severity", align: "left", value: (e) => e.Severity || "" },
        { label: "Disposition", align: "left", value: (e) => e.Disposition || "" },
      ],
      rows: qLogRows,
    });
  }

  return blocks;
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
    const buffer = renderChartPNG({
      type: "doughnut",
      data: {
        labels: ["Downtime", "Idle", "CO Overrun"],
        datasets: [{ data: [Math.round(briefSecs / 60), Math.round(idleSecs / 60), coStats.overrunMins], backgroundColor: ["#f43f5e", "#f59e0b", "#8b5cf6"] }],
      },
      options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } } } },
    }, 320, 280);
    blocks.push({ type: "image", heading: "Loss Breakdown", buffer, width: 220, height: 190 });
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
  const reasonEntries = Object.entries(reasonMins).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const deptEntries = Object.entries(deptMins).sort((a, b) => b[1] - a[1]);

  if (reasonEntries.length) {
    const buffer = renderChartPNG({
      type: "bar",
      data: { labels: reasonEntries.map(([r]) => r), datasets: [{ label: "Minutes", data: reasonEntries.map(([, m]) => m), backgroundColor: "#ef4444" }] },
      options: { plugins: { legend: { display: false } } },
    }, 500, 240);
    blocks.push({ type: "image", heading: "Loss by Reason (min)", buffer, width: 460, height: 220 });
  }

  if (deptEntries.length) {
    const colors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0ea5e9", "#f43f5e", "#14b8a6"];
    const buffer = renderChartPNG({
      type: "bar",
      data: {
        labels: deptEntries.map(([d]) => d),
        datasets: [{ label: "Minutes", data: deptEntries.map(([, m]) => m), backgroundColor: deptEntries.map((_, i) => colors[i % colors.length]) }],
      },
      options: { plugins: { legend: { display: false } } },
    }, 500, 240);
    blocks.push({ type: "image", heading: "Loss by Department (min)", buffer, width: 460, height: 220 });
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

// ── Hourly Report ──────────────────────────────────────────────────────────
export const buildHourlyReportBlocks = (raw) => {
  const { materials, qLogRows } = raw;
  const prod = raw.records.filter((r) => r.state === "Production");

  const hourMap = {};
  prod.forEach((r) => {
    const hh = String(r.startTime || "").slice(0, 2) || "00";
    if (!hourMap[hh]) hourMap[hh] = { totalQty: 0, models: {} };
    const qty = r.qty ?? 0;
    hourMap[hh].totalQty += qty;
    const mat = getMaterialByModel(materials, r.model);
    const name = mat?.partName || r.model || "Unknown";
    hourMap[hh].models[name] = (hourMap[hh].models[name] || 0) + qty;
  });

  const hourRows = Object.entries(hourMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hh, info]) => ({
      label: `${hh}:00 - ${String((parseInt(hh, 10) + 1) % 24).padStart(2, "0")}:00`,
      totalQty: info.totalQty,
      models: info.models,
    }));

  const blocks = [{
    type: "table", heading: "Hourly Summary",
    columns: [
      { label: "Time", align: "left", value: (r) => r.label },
      { label: "Total Qty", align: "center", value: (r) => r.totalQty },
    ],
    rows: hourRows,
  }];

  if (hourRows.length) {
    const buffer = renderChartPNG({
      type: "bar",
      data: { labels: hourRows.map((r) => r.label), datasets: [{ label: "Qty", data: hourRows.map((r) => r.totalQty), backgroundColor: "#3b82f6" }] },
      options: { plugins: { legend: { display: false } } },
    }, 480, 230);
    blocks.push({ type: "image", heading: "Hourly Trend", buffer, width: 460, height: 220 });
  }

  const modelBreakdownRows = hourRows.flatMap((row) =>
    Object.entries(row.models)
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({ time: row.label, modelName: name, count: qty })));

  if (modelBreakdownRows.length) {
    blocks.push({
      type: "table", heading: "Model-wise Hourly Breakdown",
      columns: [
        { label: "Time", align: "left", value: (r) => r.time },
        { label: "Model Name", align: "left", value: (r) => r.modelName, width: 2.5 },
        { label: "Count", align: "center", value: (r) => r.count },
      ],
      rows: modelBreakdownRows,
    });
  }

  const partMap = {};
  prod.forEach((r) => {
    const mat = getMaterialByModel(materials, r.model);
    const name = mat?.partName || r.model || "Unknown";
    partMap[name] = (partMap[name] || 0) + (r.qty ?? 0);
  });
  const qualityByPart = {};
  qLogRows.forEach((e) => {
    const key = e.PartName || e.Model || "";
    if (!key) return;
    qualityByPart[key] = (qualityByPart[key] || 0) + (e.RejectedQty ?? 0);
  });
  const partRows = Object.entries(partMap).map(([name, total]) => {
    const rejected = qualityByPart[name] ?? 0;
    return { name, total, accepted: Math.max(0, total - rejected), rejected };
  });

  if (partRows.length) {
    blocks.push({
      type: "table", heading: "Part Total Count",
      columns: [
        { label: "Part Name", align: "left", value: (r) => r.name, width: 2.5 },
        { label: "Total", align: "center", value: (r) => r.total },
        { label: "Accepted", align: "center", value: (r) => r.accepted },
        { label: "Rejected", align: "center", value: (r) => r.rejected },
      ],
      rows: partRows,
    });

    const h = Math.max(190, partRows.length * 26);
    const buffer = renderChartPNG({
      type: "bar",
      data: {
        labels: partRows.map((r) => r.name),
        datasets: [
          { label: "Accepted", data: partRows.map((r) => r.accepted), backgroundColor: "#22c55e" },
          { label: "Rejected", data: partRows.map((r) => r.rejected), backgroundColor: "#f43f5e" },
        ],
      },
      options: { indexAxis: "y", scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { position: "top", labels: { boxWidth: 10 } } } },
    }, 480, h + 60);
    blocks.push({ type: "image", heading: "Part Count Chart", buffer, width: 460, height: h });
  }

  return blocks;
};
