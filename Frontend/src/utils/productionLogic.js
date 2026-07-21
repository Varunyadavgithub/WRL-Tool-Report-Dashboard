/**
 * productionLogic.js — shared business rules for production monitoring
 *
 * Rule 1 — Downtime classification
 *   Downtime duration < IDLE_THRESHOLD_MINS  →  "Downtime"  (brief mechanical stop)
 *   Downtime duration ≥ IDLE_THRESHOLD_MINS  →  "Idle"      (machine standing idle)
 *
 * Rule 2 — Changeover detection
 *   Whenever the production model changes (Part A → Part B), the elapsed time
 *   between the last Part-A cycle and the first Part-B cycle is the changeover.
 *   Standard changeover = STD_CHANGEOVER_MINS.
 *   Actual changeover   > STD_CHANGEOVER_MINS  →  excess is "changeover loss".
 *
 *   Known data issues handled here:
 *   a) Midnight bug: 23:36→00:07 naively sorts 00:07 first, giving a ~1408 min gap.
 *      Fix: normalise using shiftStartMins so overnight records sort correctly.
 *   b) Negative gaps (setup hidden as production): handled — not clamped to 0.
 *
 *   Every model switch is recorded as a changeover regardless of gap length —
 *   including near-instant ones (same die/tool, only a program change), which
 *   are real changeovers that just happen to run well inside STD_CHANGEOVER_MINS.
 *   This plant currently has a single machine feeding PartProcessEvents, so
 *   there's no interleaved-multi-machine data to produce false positives; if a
 *   second machine is ever added, group records by assetName before calling
 *   this so a "changeover" is never inferred across two different machines.
 */

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

// ── Rule 2: Changeover detection ──────────────────────────────────────────────
/**
 * @param records       Array of enriched production records
 * @param stdMins       Standard changeover allowance in minutes
 * @param shiftStartMins  Minutes-since-midnight of the shift's start time
 *                      (e.g. 1200 for "20:00").  Pass null for day shifts.
 *                      Used to fix the midnight sort bug for overnight shifts.
 */
export const detectChangeovers = (records, stdMins = STD_CHANGEOVER_MINS, shiftStartMins = null) => {
  const prod = records.filter(r => r.state === "Production" && r.model && r.startTime && (r.qty ?? 0) >= 0);
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
      const gapMins = startMins - (prevEndMins ?? startMins);

      const overrunMins = Math.max(0, gapMins - stdMins);
      const coStartMins = prevEndMins ?? startMins;

      changeovers.push({
        fromModel:    prevModel,
        toModel:      r.model,
        shift:        r.shift || prevShift || null,
        startMins:    coStartMins,          // normalised (may be > 1440 for overnight)
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
