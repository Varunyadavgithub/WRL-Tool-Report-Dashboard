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
  // qty > 0 (not >= 0) — a 0-qty "Production" row is a rework/correction
  // sub-cycle on an already-produced part, not a new completed unit, so it
  // must not mark a changeover boundary (its start/end time doesn't
  // represent the real transition point between two models).
  const prod = records.filter((r) => r.state === "Production" && r.model && r.startTime && (r.qty ?? 0) > 0);
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

  // ── Scheduled break intervals (Shift Break — lunch/dinner/shift-over) ──────
  // Wall-clock time already explained by a scheduled break must not ALSO be
  // counted as changeover time — otherwise a model switch that happens to
  // span a lunch/dinner break gets that same span counted TWICE: once as the
  // break, again as changeover overrun. Deliberately does NOT include generic
  // machine Downtime/Idle — a breakdown that occurs mid-changeover is real
  // changeover-blocking time (the new model genuinely wasn't set up and
  // running yet), so it stays counted as changeover, not netted out.
  // Raw break logs for this line frequently nest a coarse gap-filler record
  // around several finer-grained sub-records covering the same span, so the
  // intervals are merged into a non-overlapping union first — summing each
  // record's overlap independently would double/triple-count the overlapping
  // portions.
  const mergeIntervals = (intervals) => {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [];
    for (const iv of sorted) {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
      else merged.push({ ...iv });
    }
    return merged;
  };
  const stoppages = mergeIntervals(
    records
      .filter((r) => r.state === "Shift Break" && r.startTime)
      .map((r) => {
        const s = normalize(toDecimalMins(r.startTime));
        let e = normalize(toDecimalMins(r.endTime || r.startTime));
        if (e < s) e += 1440;
        return { start: s, end: e };
      }),
  );
  const overlapMins = (aStart, aEnd, bStart, bEnd) =>
    Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

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
      const rawGapMins = startMins - (prevEndMins ?? startMins);
      // A changeover can never take negative time. A negative rawGapMins
      // means prevEndMins is unreliable — e.g. the previous model's last
      // record had an anomalously long duration that overlapped several
      // OTHER models' real cycles in between — not that the changeover
      // ran backwards. Clamp to a zero-width marker at the new model's
      // actual start instead of stretching back to the bad timestamp.
      const gapMins = Math.max(0, rawGapMins);
      const coStartMins = rawGapMins < 0 ? startMins : (prevEndMins ?? startMins);

      // Net out any logged downtime/idle/break time inside this gap — the
      // remainder is the actual changeover (tooling/setup) time.
      const coveredMins = stoppages.reduce(
        (sum, s) => sum + overlapMins(coStartMins, startMins, s.start, s.end),
        0,
      );
      const netGapMins = Math.max(0, gapMins - coveredMins);
      const overrunMins = Math.max(0, netGapMins - stdMins);

      changeovers.push({
        fromModel:    prevModel,
        toModel:      r.model,
        shift:        r.shift || prevShift || null,
        startMins:    coStartMins,
        endMins:      startMins,
        durationMins: Math.round(netGapMins * 10) / 10,
        stdMins,
        overrunMins:  Math.round(overrunMins * 10) / 10,
        isOverrun:    netGapMins > stdMins,
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
 * Machine-wide OEE for a shift — backend port of usePartProcessOEE.js's
 * computeOEE(). Unlike aggregateRecords' per-SAP-code rows (each with its
 * own OEE%), this collapses the WHOLE shift into a single Availability/
 * Performance/Quality/OEE figure the way OEE is actually meant to be read
 * for a machine — averaging the per-row OEE percentages (which is what the
 * "Average OEE" metric card used to show) isn't equivalent to this and can
 * be pulled around by small-volume parts with an outsized share of rows.
 *
 * @param prodRecords  Production-state records for the shift (mapDbRecord shape)
 * @param downRecords  Downtime-state records for the shift
 * @param plannedMins  The shift's configured duration in minutes
 * @param materials    MaterialConfigs rows
 */
export const computeOEE = ({ prodRecords, downRecords, plannedMins, materials }) => {
  const ZERO = { A: 0, P: 100, Q: 100, OEE: 0, runTimeMins: 0, downMins: 0 };
  if (!prodRecords.length && !downRecords.length) return ZERO;

  const qty      = prodRecords.reduce((s, r) => s + (r.qty ?? 0), 0);
  const downSecs = downRecords.reduce((s, r) => s + parseDurSecs(r.duration), 0);
  const runSecs  = prodRecords.reduce((s, r) => s + parseDurSecs(r.duration), 0);
  const downMins = Math.round(downSecs / 60);
  const runTimeMins = Math.round(runSecs / 60);
  if (qty === 0) return { ...ZERO, downMins, runTimeMins };

  // A: Availability — planned shift duration less downtime.
  const planned = Math.max(plannedMins, runTimeMins, 1);
  const A = Math.min(100, Math.max(0, Math.round(((planned - downMins) / planned) * 100)));

  // Component-unit quantities, tallied per model actually run so P below can
  // weight each model by its OWN configured cycle time.
  const hasQualityData = prodRecords.some((r) => r.quality != null && r.quality !== "");
  const modelComponentTally = {};
  prodRecords.forEach((r) => {
    const mat = getMaterialByModel(materials, r.model);
    const comp = componentQtyFromMachine(r.qty ?? 0, mat);
    if (r.model) modelComponentTally[r.model] = (modelComponentTally[r.model] || 0) + comp;
  });

  // P: Performance — ideal production time (sum, across every model run, of
  // that model's own component qty × its own DefinedComponentCycleTime) over
  // net operating time. Models with no configured cycle time simply don't
  // contribute to either side instead of penalising the whole shift.
  let idealProdSecs = 0;
  let anyIdealCycle = false;
  Object.entries(modelComponentTally).forEach(([model, compQty]) => {
    const mat = getMaterialByModel(materials, model);
    const cycleSecs = mat?.definedComponentCycleTime > 0 ? mat.definedComponentCycleTime : null;
    if (cycleSecs) {
      idealProdSecs += compQty * cycleSecs;
      anyIdealCycle = true;
    }
  });
  const netSecs = Math.max(1, planned * 60 - downSecs);
  const P = anyIdealCycle ? Math.min(100, Math.max(0, Math.round((idealProdSecs / netSecs) * 100))) : 100;

  // Q: Quality — good qty / total qty across the whole shift.
  const good = hasQualityData
    ? prodRecords.filter((r) => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0)
    : qty;
  const Q = qty > 0 ? Math.min(100, Math.round((good / qty) * 100)) : 100;

  const OEE = Math.round((A * P * Q) / 10000);

  return { A, P, Q, OEE, runTimeMins, downMins };
};

/**
 * Aggregate raw PartProcessEvents (already mapped via mapDbRecord) into
 * per-model OEE/production rows — backend port of ProductionReport.jsx's
 * aggregateRecords(), used to build the shift-end email report.
 */
export const aggregateRecords = (records, materials, dateStr, plans = [], shiftName = null, realShiftNames = []) => {
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
      // Only count this as a real cycle sample if it actually produced
      // something — a Production-state event with 0 parts (e.g. a sync-gap
      // placeholder covering an outage window) has no completed cycle to
      // measure, so its duration must not drag the cycle-time average.
      if (dur > 0 && (r.qty ?? 0) > 0) g.cycleSecs.push(dur);
      g.productionEvents++;
    } else if (r.effectiveState === "Idle") {
      g.idleSecs  += parseDurSecs(r.duration);
      g.idleCount += 1;
    } else if (r.effectiveState === "Downtime") {
      g.downtimeSecs  += parseDurSecs(r.duration);
      g.downtimeCount += 1;
    }
  });

  // ---- Resolve planned qty per SAP code, consuming at most one plan each ----
  // buildShiftReport already scopes `records`/this whole call to a single
  // shift+date, so a plain SAP-code match here is equivalent to the
  // date+shift+SAP match the frontend needs (Frontend/src/pages/PartProcess/
  // ProductionReport.jsx's aggregateRecords) — no separate shift dimension
  // needed in the grouping key. Plans aren't reliably tagged to a real shift
  // (legacy rows use stale values that match nothing), so an exact shift
  // match is tried first, falling back to "All Shifts"/unrecognized values.
  // Each plan is consumed by at most one row; a leftover, unmatched plan
  // becomes its own "planned but not yet produced" row below.
  const availablePlans = plans
    .filter((p) => p.status !== false && p.status !== 0)
    .map((p) => ({ ...p, _used: false }));

  const consumePlan = (sapCode) => {
    let p = availablePlans.find((c) => !c._used && c.sapCode === sapCode && c.shift === shiftName);
    if (!p) {
      p = availablePlans.find((c) => !c._used && c.sapCode === sapCode &&
        (c.shift === "All Shifts" || !realShiftNames.includes(c.shift)));
    }
    if (p) p._used = true;
    return p;
  };

  const producedRows = Object.values(map)
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
      // Plan Qty comes from the real Planning Configuration entry when one
      // matches; otherwise falls back to a +5% estimate over actual qty.
      const matchedPlan = consumePlan(row.sapCode);
      const plannedQty  = matchedPlan ? Number(matchedPlan.targetQty) || 0 : 0;
      const planQty     = plannedQty > 0 ? plannedQty : Math.ceil(row.actualQty * 1.05);
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
        planQtyFromConfig: plannedQty > 0,
        isGhost: false,
      };
    });

  // ---- Plans with no matching actual production become their own rows —
  // "planned, not yet produced" — so the shift-end report shows what was
  // due this shift but never started, instead of silently omitting it.
  const ghostRows = availablePlans
    .filter((p) => !p._used)
    .map((p, i) => ({
      srNo: producedRows.length + i + 1,
      date: dateStr,
      startedAt: "Not Stated", completedAt: "",
      sapCode: p.sapCode,
      itemDescription: p.partName || p.sapCode,
      planQty: Number(p.targetQty) || 0,
      actualQty: 0, isPunching: false, componentQty: 0, componentCycleTime: null,
      reqTimeMins: 0, actualTimeMins: 0, definedCycleTime: 0, sheetCycleTime: 0,
      stdChangeoverTime: STD_CHANGEOVER_MINS, actualChangeoverTime: 0,
      plannedChangeovers: 0, actualChangeovers: 0, coOverrunMins: 0, coOverrunCount: 0,
      idleMins: 0, rejects: 0, lossMins: 0,
      oee: 0, availability: 0, performance: 0, quality: 0,
      idealEnergyWh: 0, actualEnergyWh: 0,
      planQtyFromConfig: true,
      isGhost: true,
    }));

  return [...producedRows, ...ghostRows];
};
