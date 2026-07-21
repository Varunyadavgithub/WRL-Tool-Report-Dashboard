/**
 * productionLogic.js — backend port of Frontend/src/utils/productionLogic.js
 * Kept as a separate copy (rather than a cross-package import) since the
 * frontend file lives outside the backend's module resolution root. Logic
 * must stay in sync with the frontend version — same shift-end OEE figures
 * the Production Report shows should be reflected in the emailed report.
 */

export const IDLE_THRESHOLD_MINS = 10;  // Downtime ≥ 10 min → Idle
export const STD_CHANGEOVER_MINS = 5;   // Standard changeover allowance

export const parseDurSecs = (dur = "00:00:00") => {
  const [h, m, s] = (dur || "00:00:00").split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

const toDecimalMins = (timeStr) => {
  if (!timeStr) return 0;
  const s = String(timeStr);
  const timePart = s.includes("T") ? s.split("T")[1]
                 : s.length > 10 && s.includes(" ") ? s.split(" ")[1]
                 : s;
  const p = timePart.split(":");
  return (parseInt(p[0], 10) || 0) * 60
       + (parseInt(p[1], 10) || 0)
       + (parseInt(p[2], 10) || 0) / 60;
};

const fmtMins = (m) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

export const classifyState = (record, idleThreshold = IDLE_THRESHOLD_MINS) => {
  if (record.state !== "Downtime") return record.state;
  const mins = parseDurSecs(record.duration) / 60;
  return mins >= idleThreshold ? "Idle" : "Downtime";
};

export const enrichRecords = (records, idleThreshold = IDLE_THRESHOLD_MINS) =>
  records.map((r) => ({ ...r, effectiveState: classifyState(r, idleThreshold) }));

export const detectChangeovers = (records, stdMins = STD_CHANGEOVER_MINS, shiftStartMins = null) => {
  const prod = records.filter((r) => r.state === "Production" && r.model && r.startTime && (r.qty ?? 0) >= 0);
  if (!prod.length) return [];

  const rawTimes = prod.map((r) => toDecimalMins(r.startTime)).sort((a, b) => a - b);
  let autoThreshold = null;
  if (shiftStartMins !== null) {
    autoThreshold = shiftStartMins;
  } else {
    let biggestGap = 0;
    let gapMid     = null;
    for (let i = 1; i < rawTimes.length; i++) {
      const gap = rawTimes[i] - rawTimes[i - 1];
      if (gap > biggestGap) { biggestGap = gap; gapMid = (rawTimes[i - 1] + rawTimes[i]) / 2; }
    }
    if (biggestGap > 360 && gapMid !== null && rawTimes[0] < 480) {
      autoThreshold = gapMid;
    }
  }

  const normalize = (m) => (autoThreshold !== null && m < autoThreshold) ? m + 1440 : m;

  prod.sort((a, b) => normalize(toDecimalMins(a.startTime)) - normalize(toDecimalMins(b.startTime)));

  const changeovers = [];
  let prevModel   = null;
  let prevEndMins = null;
  let prevShift   = null;

  for (const r of prod) {
    const rawStart = toDecimalMins(r.startTime);
    const rawEnd   = toDecimalMins(r.endTime || r.startTime);
    const startMins = normalize(rawStart);
    const endMins   = normalize(rawEnd);

    if (prevModel !== null && prevModel !== r.model) {
      const gapMins = startMins - (prevEndMins ?? startMins);

      const overrunMins = Math.max(0, gapMins - stdMins);
      const coStartMins = prevEndMins ?? startMins;

      changeovers.push({
        fromModel:    prevModel,
        toModel:      r.model,
        shift:        r.shift || prevShift || null,
        startMins:    coStartMins,
        endMins:      startMins,
        durationMins: Math.round(gapMins * 10) / 10,
        stdMins,
        overrunMins:  Math.round(overrunMins * 10) / 10,
        isOverrun:    gapMins > stdMins,
        startTime:    fmtMins(coStartMins),
        endTime:      fmtMins(startMins),
      });
    }

    prevModel   = r.model;
    prevEndMins = endMins;
    prevShift   = r.shift || prevShift;
  }

  return changeovers;
};

export const isPunchingPart = (mat) =>
  mat && parseFloat(mat.noOfSheet) > 0 && parseFloat(mat.actualComponentsPerSheet) > 0;

export const componentQtyFromMachine = (machineQty, mat) => {
  const sheets = parseFloat(mat?.noOfSheet) || 1;
  const cps    = parseFloat(mat?.actualComponentsPerSheet) || 1;
  return machineQty * sheets * cps;
};

export const changeoverStats = (changeovers) => ({
  count:        changeovers.length,
  totalMins:    Math.round(changeovers.reduce((s, c) => s + c.durationMins, 0) * 10) / 10,
  overrunCount: changeovers.filter((c) => c.isOverrun).length,
  overrunMins:  Math.round(changeovers.reduce((s, c) => s + c.overrunMins, 0) * 10) / 10,
});

/**
 * Extract the actual program name from a machine barcode string.
 * "% O0001(1130596-C-OUTER-BTM-FLT-875H-NEW)" → "1130596-C-OUTER-BTM-FLT-875H-NEW"
 */
export const extractProgramName = (barcode) => {
  if (!barcode) return null;
  const m = String(barcode).match(/O\d+\(([^)]+)\)/);
  return m ? m[1].trim() : String(barcode).trim();
};

export const extractSapCode = (modelString) => {
  if (!modelString) return null;
  const match = String(modelString).match(/\d+/);
  return match ? match[0] : null;
};

/**
 * Material lookup — tries ALL numeric sequences in the program name,
 * longest first (most likely to be the SAP code). Mirrors the frontend's
 * getMaterialByModel in masterConfigSlice.js exactly.
 */
export const getMaterialByModel = (materials, modelString) => {
  if (!modelString || !materials?.length) return null;

  const allNums = [...String(modelString).matchAll(/\d+/g)]
    .map((m) => m[0])
    .sort((a, b) => b.length - a.length);

  if (!allNums.length) return null;

  for (const num of allNums) {
    const exact = materials.find((m) => m.sapCode === num);
    if (exact) return exact;

    const stripped = num.replace(/^0+/, "");
    if (stripped && stripped !== num) {
      const noZero = materials.find((m) => m.sapCode === stripped);
      if (noZero) return noZero;
    }

    const search = stripped || num;
    if (search.length >= 4) {
      const inName = materials.find((m) => m.partName && m.partName.includes(search));
      if (inName) return inName;
    }
  }

  return null;
};

/** Maps a PartProcessEvents DB row to the internal record shape used by aggregateRecords. */
export const mapDbRecord = (r) => {
  const rawBarcode  = r.Barcode || null;
  const programName = extractProgramName(rawBarcode);
  const sapCode     = extractSapCode(programName);

  return {
    eventId:        r.EventId,
    shift:          r.ShiftName || "—",
    state:          r.EventType || "Production",
    model:          programName,
    sapCode,
    startTime:      r.StartTime || "",
    endTime:        r.EndTime || "",
    duration:       r.Duration || "00:00:00",
    qty:            r.PartsQty ?? 0,
    quality:        r.PartsQuality || null,
  };
};

const MACHINE_POWER_KW = 5;

/**
 * Aggregate raw PartProcessEvents (already mapped via mapDbRecord) into
 * per-model OEE/production rows — backend port of ProductionReport.jsx's
 * aggregateRecords(), used to build the shift-end email report.
 */
export const aggregateRecords = (records, materials, dateStr) => {
  if (!records.length) return [];

  // Downtime rows do not carry a model. Keep each stop with the model that
  // ran immediately before it in the same shift instead of discarding it as
  // an UNKNOWN row.
  const lastModelByShift = new Map();
  const enriched = enrichRecords(records).map((record) => {
    const shiftKey = record.shift || "__unassigned_shift__";
    if (record.state === "Production" && record.model) {
      lastModelByShift.set(shiftKey, record.model);
      return record;
    }
    if (record.state === "Downtime" && !record.model) {
      const model = lastModelByShift.get(shiftKey);
      if (model) return { ...record, model };
    }
    return record;
  });

  const map = {};
  enriched.forEach((r) => {
    const mat     = getMaterialByModel(materials, r.model);
    const sapCode = mat?.sapCode || r.sapCode || "UNKNOWN";
    const key = sapCode;

    if (!map[key]) {
      map[key] = {
        sapCode, model: r.model,
        itemDescription: mat?.partName || r.model || "-",
        definedCycleTime: mat?.definedComponentCycleTime || 0,
        stdChangeoverTime: STD_CHANGEOVER_MINS,
        date: dateStr,
        startedAt: "", completedAt: "",
        planQty: 0, actualQty: 0, goodQty: 0,
        downtimeSecs: 0, downtimeCount: 0,
        idleSecs: 0,    idleCount: 0,
        cycleSecs: [], productionEvents: 0,
        rawRecords: [],
      };
    }

    const g = map[key];
    g.rawRecords.push(r);
    // Records arrive pre-sorted by StartTime ASC (fetchShiftRawData's query),
    // so first-seen/last-seen tracks the model's production window within
    // this single-date, single-shift fetch. (Doesn't attempt to re-order an
    // overnight shift's wrapped 00:00-08:00 tail — that's a display-only
    // approximation, not used in any OEE math below.)
    if (!g.startedAt && r.startTime) g.startedAt = r.startTime;
    if (r.endTime || r.startTime) g.completedAt = r.endTime || r.startTime;

    if (r.state === "Production") {
      g.actualQty += r.qty ?? 0;
      if (r.quality === "GOOD") g.goodQty += r.qty ?? 0;
      const dur = parseDurSecs(r.duration);
      if (dur > 0) g.cycleSecs.push(dur);
      g.productionEvents++;
    } else if (r.effectiveState === "Idle") {
      g.idleSecs  += parseDurSecs(r.duration);
      g.idleCount += 1;
    } else if (r.effectiveState === "Downtime") {
      g.downtimeSecs  += parseDurSecs(r.duration);
      g.downtimeCount += 1;
    }
  });

  return Object.values(map)
    .filter((row) => row.sapCode !== "UNKNOWN")
    .map((row, idx) => {
      const avgCycleSecs = row.cycleSecs.length > 0
        ? Math.round(row.cycleSecs.reduce((a, b) => a + b, 0) / row.cycleSecs.length)
        : row.definedCycleTime;

      const cos      = detectChangeovers(row.rawRecords);
      const coSt     = changeoverStats(cos);
      const downMins = Math.round(row.downtimeSecs / 60);
      const idleMins = Math.round(row.idleSecs / 60);
      const lossMins = downMins + idleMins + coSt.overrunMins;
      const planQty    = row.planQty > 0 ? row.planQty : Math.ceil(row.actualQty * 1.05);
      const reqTimeMins = Math.round((planQty * row.definedCycleTime) / 60);

      const availableTimeSecs = planQty * row.definedCycleTime;
      const totalDowntimeSecs = row.downtimeSecs + row.idleSecs;
      const actualTimeMins = Math.round((row.actualQty * avgCycleSecs) / 60);
      const A = availableTimeSecs > 0
        ? Math.max(0, Math.min(1, (availableTimeSecs - totalDowntimeSecs) / availableTimeSecs))
        : 0;
      const netOperatingSecs = Math.max(1, availableTimeSecs - totalDowntimeSecs);
      const P = row.definedCycleTime > 0
        ? Math.max(0, Math.min(1, (row.actualQty * row.definedCycleTime) / netOperatingSecs))
        : 1;
      const Q = row.actualQty > 0
        ? Math.min(1, row.goodQty / row.actualQty)
        : 1;
      const availability = Math.round(A * 1000) / 10;
      const performance   = Math.round(P * 1000) / 10;
      const quality       = Math.round(Q * 1000) / 10;
      const oee = Math.round((availability * performance * quality / 10000) * 10) / 10;

      const rejects = row.actualQty - row.goodQty;

      const idealEnergyWh  = Math.round((planQty * row.definedCycleTime * MACHINE_POWER_KW) / 3600);
      const actualEnergyWh = Math.round((row.actualQty * avgCycleSecs * MACHINE_POWER_KW) / 3600);

      const matForRow = getMaterialByModel(materials, row.model);
      const punching     = isPunchingPart(matForRow);
      const noOfSheet     = Number(matForRow?.noOfSheet) || 0;
      const compPerSheet  = Number(matForRow?.actualComponentsPerSheet) || 0;
      const loadUnload    = Number(matForRow?.pncLoadingUnloading) || 0;

      const sheetCT = punching && noOfSheet > 0
        ? Math.round((avgCycleSecs / noOfSheet) * 100) / 100
        : avgCycleSecs;
      // Actual CT = (machine cycle time + load/unload allowance) spread across
      // every component produced per machine cycle (comps/sheet × sheets/cycle).
      const compCT = punching && compPerSheet > 0 && noOfSheet > 0
        ? Math.round(((avgCycleSecs + loadUnload) / (compPerSheet * noOfSheet)) * 100) / 100
        : null;
      const compQty = punching && noOfSheet > 0 && compPerSheet > 0
        ? Math.round(noOfSheet * compPerSheet * row.actualQty)
        : row.actualQty;

      return {
        srNo: idx + 1,
        date: row.date,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        sapCode: row.sapCode,
        itemDescription: row.itemDescription,
        planQty,
        actualQty: row.actualQty,
        isPunching: punching,
        componentQty: compQty,
        componentCycleTime: compCT,
        reqTimeMins,
        actualTimeMins,
        definedCycleTime: row.definedCycleTime,
        sheetCycleTime: sheetCT,
        stdChangeoverTime:    row.stdChangeoverTime,
        actualChangeoverTime: Math.round(coSt.totalMins * 10) / 10,
        plannedChangeovers:   coSt.count,
        actualChangeovers:    coSt.count,
        coOverrunMins:        coSt.overrunMins,
        coOverrunCount:       coSt.overrunCount,
        idleMins,
        rejects,
        lossMins,
        oee: isNaN(oee) ? 0 : oee,
        availability,
        performance,
        quality,
        idealEnergyWh,
        actualEnergyWh,
      };
    });
};
