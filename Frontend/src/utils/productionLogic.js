export const IDLE_THRESHOLD_MINS = 10;  // Downtime ≥ 10 min → Idle
export const STD_CHANGEOVER_MINS = 5;   // Standard changeover allowance

// ── Helpers ───────────────────────────────────────────────────────────────────
export const parseDurSecs = (dur = "00:00:00") => {
  const [h, m, s] = (dur || "00:00:00").split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

// Convert "HH:MM:SS" (or any prefix) → decimal minutes since midnight
const toDecimalMins = (timeStr) => {
  if (!timeStr) return 0;
  const s = String(timeStr);
  // Handle full datetime strings: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const timePart = s.includes("T") ? s.split("T")[1]
                 : s.length > 10 && s.includes(" ") ? s.split(" ")[1]
                 : s;
  const p = timePart.split(":");
  return (parseInt(p[0], 10) || 0) * 60
       + (parseInt(p[1], 10) || 0)
       + (parseInt(p[2], 10) || 0) / 60;
};

// Format decimal minutes → "HH:MM" (wraps at 24 h)

const fmtMins = (m) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

// ── Rule 1: Classify each record's effective state ────────────────────────────
export const classifyState = (record, idleThreshold = IDLE_THRESHOLD_MINS) => {
  if (record.state !== "Downtime") return record.state;
  const mins = parseDurSecs(record.duration) / 60;
  return mins >= idleThreshold ? "Idle" : "Downtime";
};

export const enrichRecords = (records, idleThreshold = IDLE_THRESHOLD_MINS) =>
  records.map(r => ({ ...r, effectiveState: classifyState(r, idleThreshold) }));

// ── Shift history resolution ────────────────────────────────────────────────
/**
 * ShiftConfigs (the Shift Master table) is a flat "current state" table —
 * editing a shift's timing overwrites in place, so rendering a HISTORICAL
 * production date with the live shift config silently uses today's timing
 * instead of whatever was actually in effect back then. ShiftConfigHistory
 * (append-only, one row per create/update — see
 * Backend/controllers/masterConfig/shifts.controller.js) fixes that: this
 * resolves which snapshot applied on a given production date.
 *
 * Anchored at 08:00 IST — the existing production-day boundary used
 * throughout this codebase (see getTodayRange/getYesterdayRange in
 * utils/dateUtils.js) — since shift timing isn't expected to change
 * mid-shift, whatever was true at the start of the production day governs
 * the whole day.
 *
 * @param historyRows  Full ShiftConfigHistory array (selectShiftHistory)
 * @param shiftId      The shift's id (ShiftConfigs.Id)
 * @param dateStr      "YYYY-MM-DD" production date to resolve as of
 * @param fallback     Returned when no history row qualifies (e.g. a
 *                     brand-new shift created after the last history fetch)
 */
export const resolveShiftAsOf = (historyRows, shiftId, dateStr, fallback = null) => {
  if (!Array.isArray(historyRows) || !shiftId || !dateStr) return fallback;
  const anchor = new Date(`${dateStr}T08:00:00+05:30`).getTime();
  if (Number.isNaN(anchor)) return fallback;
  let best = null;
  for (const h of historyRows) {
    if (h.shiftId !== shiftId) continue;
    const t = new Date(h.effectiveFrom).getTime();
    if (Number.isNaN(t) || t > anchor) continue;
    if (!best || t > new Date(best.effectiveFrom).getTime()) best = h;
  }
  return best || fallback;
};

/**
 * Which shift(s) a machine was assigned to, replayed from an append-only
 * assign/unassign log (MachineShiftAllocationHistory) rather than the
 * current-state MachineShiftAllocations table — so a historical date
 * reflects what was actually assigned back then, not today's assignment.
 * Same 08:00 IST anchor convention as resolveShiftAsOf.
 *
 * @param historyRows  Full MachineShiftAllocationHistory array
 * @param machineId    The machine's id (Machines.Id)
 * @param dateStr      "YYYY-MM-DD" production date to resolve as of
 * @returns            Array of shiftIds assigned as of that date
 */
export const resolveMachineShiftsAsOf = (historyRows, machineId, dateStr) => {
  if (!Array.isArray(historyRows) || !machineId || !dateStr) return [];
  const anchor = new Date(`${dateStr}T08:00:00+05:30`).getTime();
  if (Number.isNaN(anchor)) return [];
  const latestByShift = new Map(); // shiftId -> { action, t }
  for (const h of historyRows) {
    if (h.machineId !== machineId) continue;
    const t = new Date(h.actionAt).getTime();
    if (Number.isNaN(t) || t > anchor) continue;
    const prev = latestByShift.get(h.shiftId);
    if (!prev || t > prev.t) latestByShift.set(h.shiftId, { action: h.action, t });
  }
  return [...latestByShift.entries()]
    .filter(([, v]) => v.action === "assigned")
    .map(([shiftId]) => shiftId);
};

// ── Interval merging (shared by changeover netting + downtime/idle totals) ────
// Merges a set of {start, end} intervals (any consistent unit — decimal
// minutes or epoch ms) into a non-overlapping union. Raw event logs for this
// line frequently nest a coarse gap-filler record around several
// finer-grained sub-records covering the same span, so summing each record's
// duration independently double/triple-counts the overlapping portions —
// merging first is required before any total-duration figure is trustworthy.
export const mergeIntervals = (intervals) => {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }
  return merged;
};

// Day index (integer) for a "YYYY-MM-DD" calendar date — used to place a
// record on an absolute, day-indexed minute line instead of guessing its day
// from bare time-of-day.
const dayIndex = (dateStr) => {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isFinite(t) ? t / 86400000 : 0;
};

/**
 * Builds {start, end} decimal-minute intervals for `subset`, correctly
 * ordered across midnight.
 *
 * Prefers each record's own `eventDate` (the true calendar date the DB says
 * the event happened on) — this places every record on an absolute,
 * day-indexed minute line with no guessing: exact, per-record, immune to
 * how the records happen to be distributed across the window. Only falls
 * back to reconstructing order from bare time-of-day (using the known
 * `shiftStartMins` boundary, or guessing from the biggest time gap as a last
 * resort) when `eventDate` isn't available on every record in `subset` —
 * that guess can misfire on a plain day shift (or any record set spanning
 * a full day) with an uneven distribution of events, wrongly treating part
 * of the set as spilling over from the previous day and inflating the total
 * by a spurious ~24h.
 *
 * @param subset          The records to build intervals for.
 * @param thresholdSource  Records to detect the gap-guess threshold from when
 *                 falling back (mergedStateMins wants this to be the FULL
 *                 record set, not just its matching subset, so an overnight
 *                 shift's boundary is found correctly even when e.g. all the
 *                 Idle records happen to fall on one side). Defaults to `subset`.
 * @param shiftStartMins  Minutes-since-midnight of the shift's start time
 *                 (e.g. 1200 for "20:00"), same convention as detectChangeovers.
 *                 Only consulted in the no-eventDate fallback path.
 */
const buildIntervals = (subset, thresholdSource, shiftStartMins) => {
  const withTimes = subset.filter(r => r.startTime);
  if (!withTimes.length) return [];

  if (withTimes.every(r => r.eventDate)) {
    return withTimes.map(r => {
      const base = dayIndex(r.eventDate) * 1440;
      const s = base + toDecimalMins(r.startTime);
      let e = base + toDecimalMins(r.endTime || r.startTime);
      if (e < s) e += 1440; // this record's own end-of-day time precedes its start → it crossed midnight
      return { start: s, end: e };
    });
  }

  const rawTimes = (thresholdSource ?? withTimes)
    .filter(r => r.startTime)
    .map(r => toDecimalMins(r.startTime))
    .sort((a, b) => a - b);
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
    if (biggestGap > 360 && gapMid !== null && rawTimes[0] < 480) autoThreshold = gapMid;
  }
  const normalize = (m) => (autoThreshold !== null && m < autoThreshold) ? m + 1440 : m;

  return withTimes.map(r => {
    const s = normalize(toDecimalMins(r.startTime));
    let e = normalize(toDecimalMins(r.endTime || r.startTime));
    if (e < s) e += 1440;
    return { start: s, end: e };
  });
};

/**
 * Total minutes covered by records whose (effectiveState || state) matches
 * `state`, after merging overlapping/duplicate records — so a coarse
 * downtime record and its nested finer sub-records aren't summed multiple
 * times over the same wall-clock span.
 *
 * @param records  Enriched records for ONE shift/date scope (state, effectiveState,
 *                 startTime, endTime, duration, ideally eventDate)
 * @param state    "Idle" | "Downtime" | "Shift Break" | any effectiveState/state value
 * @param shiftStartMins  See buildIntervals — only used when records lack eventDate.
 */
export const mergedStateMins = (records, state, shiftStartMins = null) => {
  const matching = records.filter(r => (r.effectiveState || r.state) === state && r.startTime);
  if (!matching.length) return 0;

  return mergeIntervals(buildIntervals(matching, records, shiftStartMins))
    .reduce((sum, iv) => sum + (iv.end - iv.start), 0);
};

/**
 * Same merge-then-sum as mergedStateMins, but for a record set the caller
 * has ALREADY filtered (e.g. computeOEE's downRecords, which mixes both
 * effectiveState "Idle" and "Downtime" rows under one raw state==="Downtime"
 * filter) — merges every record in the array with no further state check,
 * since splitting them into separate Idle/Downtime buckets and merging each
 * bucket separately would miss overlaps that span BOTH classifications (a
 * coarse multi-hour record classifies as Idle while a brief record nested
 * inside it classifies as Downtime, even though they cover the same span).
 *
 * @param shiftStartMins  See buildIntervals — only used when records lack eventDate.
 */
export const mergedDurationMins = (records, shiftStartMins = null) =>
  mergeIntervals(buildIntervals(records, records, shiftStartMins))
    .reduce((sum, iv) => sum + (iv.end - iv.start), 0);

// ── Rule 2: Changeover detection ──────────────────────────────────────────────
/**
 * @param records       Array of enriched production records
 * @param stdMins       Standard changeover allowance in minutes
 * @param shiftStartMins  Minutes-since-midnight of the shift's start time
 *                      (e.g. 1200 for "20:00").  Pass null for day shifts.
 *                      Used to fix the midnight sort bug for overnight shifts.
 * @param breakWindowMins  { start, end } minutes-since-midnight of the shift's
 *                      configured lunch/dinner break (e.g. shift.breakStart/
 *                      breakEnd resolved via resolveShiftAsOf), so a
 *                      changeover that happens to span the break doesn't get
 *                      that same span counted twice. Pass null if unknown —
 *                      the break then simply isn't netted out.
 */
export const detectChangeovers = (records, stdMins = STD_CHANGEOVER_MINS, shiftStartMins = null, breakWindowMins = null) => {
  // qty > 0 (not >= 0) — a 0-qty "Production" row is a rework/correction
  // sub-cycle on an already-produced part, not a new completed unit, so it
  // must not mark a changeover boundary (its start/end time doesn't
  // represent the real transition point between two models).
  const prod = records.filter(r => r.state === "Production" && r.model && r.startTime && (r.qty ?? 0) > 0);
  if (!prod.length) return [];

  // ── Auto-detect midnight crossing ───────────────────────────────────────────
  // When data spans midnight (e.g. Shift 2: 20:00–08:00), raw times look like
  // [00:07=7, 23:36=1416]. A naive sort puts 00:07 first → 1408 min "gap" bug.
  //
  // Strategy: find the largest time gap between consecutive raw values.
  // If that gap is > 6 hours (360 min), the data spans midnight.
  // The midpoint of that gap becomes the normalisation threshold:
  // times BELOW the midpoint are "next day" and get +1440.
  //
  // shiftStartMins (explicit caller hint) overrides the auto-detection.
  const rawTimes = prod.map(r => toDecimalMins(r.startTime)).sort((a, b) => a - b);
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
    // Only apply normalization when the biggest gap implies a midnight crossing
    // (gap > 6 h = 360 min and the low cluster is before 08:00 = 480 min)
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
  // intervals are merged into a non-overlapping union first (mergeIntervals,
  // exported above) — summing each record's overlap independently would
  // double/triple-count the overlapping portions.
  //
  // `records` with state === "Shift Break" essentially never occurs in
  // practice — FactoryOS's raw EventType is only ever "Production"/"Downtime",
  // there's no third state it emits for a break window — so this filter
  // alone was silently a no-op. `breakWindowMins` (the shift's own configured
  // break, resolved by the caller) is the real source of truth and is what
  // actually nets a break out below.
  const stoppages = mergeIntervals([
    ...records
      .filter(r => r.state === "Shift Break" && r.startTime)
      .map(r => {
        const s = normalize(toDecimalMins(r.startTime));
        let e = normalize(toDecimalMins(r.endTime || r.startTime));
        if (e < s) e += 1440;
        return { start: s, end: e };
      }),
    ...(breakWindowMins ? [(() => {
      const s = normalize(breakWindowMins.start);
      let e = normalize(breakWindowMins.end);
      if (e < s) e += 1440;
      return { start: s, end: e };
    })()] : []),
  ]);
  const overlapMins = (aStart, aEnd, bStart, bEnd) =>
    Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

  const changeovers = [];
  let prevModel   = null;
  let prevEndMins = null;  // already normalised
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
        startMins:    coStartMins,          // normalised (may be > 1440 for overnight)
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

// ── Punching-process component calculations ───────────────────────────────────

/** True when the material has punching sheet configuration */
export const isPunchingPart = (mat) =>
  mat && parseFloat(mat.noOfSheet) > 0 && parseFloat(mat.actualComponentsPerSheet) > 0;

/** Component Cycle Time = (Punching CT + Loading/Unloading Time) ÷ Components per Sheet */
export const computeComponentCycleTime = (mat) => {
  if (!mat) return null;
  const cps = parseFloat(mat.actualComponentsPerSheet);
  const ct  = parseFloat(mat.actualTotalPunchingCT) || 0;
  const lu  = parseFloat(mat.pncLoadingUnloading) || 0;
  if (!(cps > 0) || ct + lu <= 0) return null;
  return (ct + lu) / cps;
};

/** Total Components = machineQty × noOfSheet × actualComponentsPerSheet
 *  Defaults noOfSheet and actualComponentsPerSheet to 1 when not configured. */
export const componentQtyFromMachine = (machineQty, mat) => {
  const sheets = parseFloat(mat?.noOfSheet) || 1;
  const cps    = parseFloat(mat?.actualComponentsPerSheet) || 1;
  return machineQty * sheets * cps;
};

/**
 * Aggregate changeover stats from a detectChangeovers() result.
 */
export const changeoverStats = (changeovers) => ({
  count:        changeovers.length,
  totalMins:    Math.round(changeovers.reduce((s, c) => s + c.durationMins, 0) * 10) / 10,
  overrunCount: changeovers.filter(c => c.isOverrun).length,
  overrunMins:  Math.round(changeovers.reduce((s, c) => s + c.overrunMins, 0) * 10) / 10,
});
