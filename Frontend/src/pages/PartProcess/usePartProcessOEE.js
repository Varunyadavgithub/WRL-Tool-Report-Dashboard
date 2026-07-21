import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  selectMaterials, selectShifts, getMaterialByModel,
  isActiveShift, shiftElapsedMins, shiftDurationMins, shiftPlannedProductionMins, toMins as sliceToMins,
} from "../../redux/slices/masterConfigSlice";
import axios from "axios";
import { mapDbRecord } from "../../utils/mapDbRecord.js";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";
import { enrichRecords, detectChangeovers, changeoverStats, isPunchingPart } from "../../utils/productionLogic.js";
import { getTodayRange, getYesterdayRange, formatDateTimeLocal } from "../../utils/dateUtils.js";

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS  (shared between the Part Process Overview card and Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

export const p2 = (n) => String(n).padStart(2, "0");

/** Parse "HH:MM:SS" → total seconds */
export const parseDurSecs = (dur = "00:00:00") => {
  const [h, m, s] = (dur || "00:00:00").split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

// Do NOT shadow the imported toMins. Use a single canonical implementation
// here and refer to it everywhere. Supports "HH:MM", "HH:MM:SS" and full ISO
// datetime strings.
export const timeStrToMins = (t) => {
  if (!t) return null;
  const s = String(t);
  // Handle "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const timePart = s.includes("T") ? s.split("T")[1]
                 : s.length > 10 && s.includes(" ") ? s.split(" ")[1]
                 : s;
  const p = timePart.split(":");
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
};

export const oeeColor = (v) =>
  v >= 85 ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

// Overnight normalisation used CONSISTENTLY throughout (OEE graph, timeline,
// changeovers, shift-filter). Given a shift, returns a function that adds
// 1440 to any time whose raw minute-value falls in the "after-midnight"
// portion of an overnight shift.
export const makeNormalizer = (shiftStartMins, shiftEndMins) => {
  const isOvernight = shiftStartMins !== null && shiftEndMins !== null && shiftEndMins <= shiftStartMins;
  if (!isOvernight || shiftStartMins === null) return (m) => m;         // no-op for day shifts
  return (m) => (m !== null && m < shiftStartMins ? m + 1440 : m);
};

// Today string helper
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

// Next date string helper
const nextDateStr = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

// FactoryOS supplies ShiftName on each event. Prefer that persisted identity
// over deriving a shift from the clock: it stays correct for custom ranges and
// for events whose displayed time contains a full datetime string.
const normaliseShiftName = (value) => String(value || "")
  .trim()
  .replace(/\s+/g, " ")
  .toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// PUNCHING COMPONENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const componentQtyFromMaster = (machineQty, mat) => {
  const q            = machineQty || 0;
  const noOfSheet    = Number(mat?.noOfSheet) || 0;
  const compPerSheet = Number(mat?.actualComponentsPerSheet) || 0;
  return isPunchingPart(mat) && noOfSheet > 0 && compPerSheet > 0
    ? noOfSheet * compPerSheet * q
    : q;
};

// Actual component CT = (machine cycle time + load/unload allowance) spread
// across every component produced per machine cycle (comps/sheet × sheets/cycle)
// — same formula as ProductionReport.jsx / productionLogic.js's Actual CT.
const componentCTFromMaster = (sheetCT, mat) => {
  const noOfSheet    = Number(mat?.noOfSheet) || 0;
  const compPerSheet = Number(mat?.actualComponentsPerSheet) || 0;
  const loadUnload   = Number(mat?.pncLoadingUnloading) || 0;
  if (!isPunchingPart(mat) || compPerSheet <= 0 || noOfSheet <= 0) return null;
  return Math.round((((Number(sheetCT) || 0) + loadUnload) / (noOfSheet * compPerSheet)) * 100) / 100;
};

// ─────────────────────────────────────────────────────────────────────────────
// CLOCK HOOK
// ─────────────────────────────────────────────────────────────────────────────

export const useClock = () => {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
};

// ─────────────────────────────────────────────────────────────────────────────
// OEE CALCULATION HELPER
// ─────────────────────────────────────────────────────────────────────────────
// Single canonical OEE calculator used for BOTH "All Shifts" and per-shift
// views.
//
// Key rules:
//   • Q falls back to 100 when no quality field is present (qUnverified flag)
//   • P falls back to 100 when no ideal cycle time in master config (pUnverified)
//   • runTimeMins and downTimeMins are ALWAYS returned
//   • No hardcoded P = 80

export const computeOEE = ({ prodRecords, downRecords, plannedMins, materials }) => {
  const ZERO = {
    qty: 0, good: 0, bad: 0, componentQty: 0, componentGood: 0, componentBad: 0, passRate: 0,
    downCount: 0, downMins: 0, runTimeMins: 0, avgCycleSecs: 0,
    A: 0, P: 100, Q: 100, OEE: 0,
    pUnverified: true, qUnverified: true,
  };

  if (!prodRecords.length && !downRecords.length) return ZERO;

  const qty      = prodRecords.reduce((s, r) => s + (r.qty ?? 0), 0);
  const downSecs = downRecords.reduce((s, r) => s + parseDurSecs(r.duration), 0);
  const runSecs  = prodRecords.reduce((s, r) => s + parseDurSecs(r.duration), 0);
  const downMins = Math.round(downSecs / 60);
  const runTimeMins = Math.round(runSecs / 60);

  if (qty === 0) return { ...ZERO, downCount: downRecords.length, downMins, runTimeMins };

  // ── A: Availability ───────────────────────────────────────────────────────
  // Planned time = configured shift duration (passed in as plannedMins).
  // However when "All Shifts" fetches 2 calendar days, accumulated downtime
  // can exceed a single shift's window making A go negative.
  // Guard: planned is always at least runTimeMins (machine was running that long)
  // and at most runTimeMins + downMins (total active machine time observed).
  // This gives a meaningful A without requiring a separate calendar API.
  const actualObservedMins = runTimeMins + downMins;
  // For "All Shifts" the passed plannedMins = sum of ALL configured shifts which
  // may be less than actual span when data covers 2 days. Use the larger value.
  const planned  = Math.max(plannedMins, runTimeMins, 1);
  const A        = Math.min(100, Math.max(0, Math.round(((planned - downMins) / planned) * 100)));

  // ── Component-unit quantities ───────────────────────────────────────────
  // Convert every record's machine/sheet qty into component units (punching
  // parts: sheets × comps/sheet). Computed up front so Performance can use
  // component qty instead of raw sheet qty — DefinedComponentCycleTime is a
  // per-COMPONENT cycle time, so multiplying it by raw sheet qty understated
  // P for any punching part with >1 component per sheet.
  const hasQualityData = prodRecords.some(r => r.quality != null && r.quality !== "");
  let componentQty = 0;
  let componentGood = 0;
  const modelComponentTally = {};
  prodRecords.forEach((r) => {
    const mat = getMaterialByModel(materials, r.model);
    const comp = componentQtyFromMaster(r.qty ?? 0, mat);
    componentQty += comp;
    if (!hasQualityData || r.quality === "GOOD") componentGood += comp;
    if (r.model) modelComponentTally[r.model] = (modelComponentTally[r.model] || 0) + comp;
  });
  componentQty  = Math.round(componentQty);
  componentGood = Math.round(componentGood);
  const componentBad = Math.max(0, componentQty - componentGood);

  // ── P: Performance ────────────────────────────────────────────────────────
  // Ideal production time = sum, across every model actually run, of that
  // model's OWN component qty × its OWN DefinedComponentCycleTime — not one
  // "dominant" model's cycle time applied against the whole shift's qty.
  // Models with no configured cycle time simply don't contribute to either
  // side (same "don't penalise unknown config" rule as before, now applied
  // per model instead of picking one model for the entire shift).
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
  const plannedSecs  = planned * 60;
  const netSecs      = Math.max(1, plannedSecs - downSecs);
  const pUnverified  = !anyIdealCycle;
  const P            = anyIdealCycle
    ? Math.min(100, Math.max(0, Math.round((idealProdSecs / netSecs) * 100)))
    : 100;  // no model in this window has a configured std cycle → don't penalise, flag instead

  // ── Q: Quality ────────────────────────────────────────────────────────────
  const good           = hasQualityData
    ? prodRecords.filter(r => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0)
    : qty; // treat all as good when quality sensor not connected
  const qUnverified    = !hasQualityData;
  const Q              = qty > 0 ? Math.min(100, Math.round((good / qty) * 100)) : 100;

  // A, P and Q are percentages, so convert their product back to a
  // percentage with the standard OEE formula: A × P × Q ÷ 10,000.
  const OEE = Math.round((A * P * Q) / 10000);

  const avgCycleSecs = prodRecords.length > 0 ? Math.round(runSecs / prodRecords.length) : 0;

  return {
    qty, good, bad: Math.max(0, qty - good), componentQty, componentGood, componentBad,
    passRate: Math.round((good / qty) * 100),
    downCount: downRecords.length, downMins, runTimeMins, avgCycleSecs,
    A, P, Q, OEE, pUnverified, qUnverified,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HOOK ── data loading + OEE computation
// ─────────────────────────────────────────────────────────────────────────────
// Used by both the Part Process Overview card and the full Dashboard so the
// two pages always agree on records, filters and OEE numbers.

export const usePartProcessOEE = () => {
  const time      = useClock();
  const materials = useSelector(selectMaterials);
  const shifts    = useSelector(selectShifts).filter(s => s.status);

  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  // ── Date range mode: "today" | "yesterday" | "custom" ─────────────────
  // rangeStart / rangeEnd are ISO UTC strings (from dateUtils).
  // selectedDate is derived from rangeStart for shift-filter logic.
  const [rangeMode,  setRangeMode]  = useState("today");
  const [rangeStart, setRangeStart] = useState(() => getTodayRange().startDate);
  const [rangeEnd,   setRangeEnd]   = useState(() => getTodayRange().endDate);
  // Custom picker values (datetime-local strings "YYYY-MM-DDTHH:mm")
  const [customStart, setCustomStart] = useState(() => formatDateTimeLocal(getTodayRange().startDate));
  const [customEnd,   setCustomEnd]   = useState(() => formatDateTimeLocal(getTodayRange().endDate));
  const [showCustom,  setShowCustom]  = useState(false);

  // selectedDate = calendar date of rangeStart (used for shift-filter & OEE scoping)
  const selectedDate = rangeStart ? rangeStart.slice(0, 10) : todayStr();
  const isToday = rangeMode === "today";

  const applyRange = useCallback((mode, start, end) => {
    setRangeMode(mode);
    setRangeStart(start);
    setRangeEnd(end);
    setShowCustom(false);
  }, []);

  const handleToday = () => {
    const r = getTodayRange();
    applyRange("today", r.startDate, r.endDate);
  };
  const handleYesterday = () => {
    const r = getYesterdayRange();
    applyRange("yesterday", r.startDate, r.endDate);
  };
  const handleCustomApply = () => {
    if (!customStart || !customEnd) { toast.error("Select both start and end datetime."); return; }
    const s = new Date(customStart).toISOString();
    const e = new Date(customEnd).toISOString();
    if (new Date(e) <= new Date(s)) { toast.error("End must be after start."); return; }
    applyRange("custom", s, e);
  };

  const [selectedShift, setSelectedShift] = useState(
    () => shifts.find(isActiveShift) ?? null
  );

  // ── Fetch records for a datetime range from the local DB ────────────────
  // PartProcessEvents (DB3) is kept in sync with FactoryOS by the backend
  // cron (partProcessSync.js). We query EventDate from the UTC day of
  // startISO through the day after endISO (extra day catches overnight-shift
  // records tagged under the previous calendar date), then filter
  // client-side to the exact [rangeStart, rangeEnd] window.
  const loadForRange = useCallback(async (startISO, endISO) => {
    setLoading(true);
    setRecords([]);
    setLoadProgress({ loaded: 0, total: 0 });

    const startDay = new Date(startISO);
    startDay.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(endISO);
    endDay.setUTCHours(0, 0, 0, 0);
    endDay.setUTCDate(endDay.getUTCDate() + 1); // include day after end

    const startDate = startDay.toISOString().slice(0, 10);
    const endDate   = endDay.toISOString().slice(0, 10);

    try {
      const res  = await axios.get(`${PART_PROCESS_API}/records-range`, {
        params: { startDate, endDate },
        withCredentials: true,
      });
      const rows = res.data?.data ?? [];

      if (rows.length > 0) {
        // Client-side filter: keep only records whose startTime falls in [rangeStart, rangeEnd]
        const rStart = new Date(startISO).getTime();
        const rEnd   = new Date(endISO).getTime();

        // EventDate is a plain calendar-date tag (whatever wall-clock date the
        // event actually happened on), not a shift-adjusted "production day" —
        // confirmed directly against the DB. So a record's absolute timestamp
        // is always just EventDate + StartTime, with no date bump needed. An
        // earlier version bumped the date forward for any StartTime before
        // 08:00 assuming EventDate lagged an overnight shift's post-midnight
        // tail — but EventDate was already correct, so that bump pushed the
        // tail's timestamp a full day late, past rEnd, silently dropping it.
        const filtered = rows.filter(r => {
          if (!r.StartTime) return true; // keep if no time (let downstream handle)
          const eventDate = String(r.EventDate).slice(0, 10);
          const timeStr   = String(r.StartTime);
          const ts = (timeStr.includes("T") || timeStr.length > 8)
            ? new Date(timeStr).getTime()
            : new Date(`${eventDate}T${timeStr}`).getTime();
          return ts >= rStart && ts <= rEnd;
        });
        const mapped = (filtered.length > 0 ? filtered : rows)
          .map((r, i) => ({ ...mapDbRecord(r, i), eventDate: String(r.EventDate).slice(0, 10) }));
        setRecords(enrichRecords(mapped));
      } else {
        setRecords([]);
      }
    } catch {
      setRecords([]);
      toast.error("Failed to load production data.");
    } finally {
      setLoading(false);
      setLoadProgress({ loaded: 0, total: 0 });
    }
  }, []);

  const loadToday = useCallback(() => {
    const r = getTodayRange();
    setRangeStart(r.startDate);
    setRangeEnd(r.endDate);
    loadForRange(r.startDate, r.endDate);
  }, [loadForRange]);

  // Reload whenever range changes
  useEffect(() => {
    if (rangeStart && rangeEnd) loadForRange(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd, loadForRange]);

  // The FactoryOS importer updates PartProcessEvents in the background, on its
  // own 5-minute cron (Backend/cron/factoryOsSync.cron.js). Polling faster than
  // that just re-fetches data that hasn't changed yet, so this matches the
  // sync cadence instead of guessing a shorter interval — same freshness, far
  // fewer redundant /records-range calls hitting the API and DB.
  useEffect(() => {
    if (!rangeStart || !rangeEnd) return undefined;
    const timer = setInterval(() => loadForRange(rangeStart, rangeEnd), 300_000);
    return () => clearInterval(timer);
  }, [rangeStart, rangeEnd, loadForRange]);

  // ── Shift-filtered records ──────────────────────────────────────────────
  const shiftRecords = useMemo(() => {
    if (!selectedShift) return records;

    const selectedShiftName = normaliseShiftName(selectedShift.shiftName);
    const recordsWithShiftName = selectedShiftName
      ? records.filter((r) => normaliseShiftName(r.shift) && normaliseShiftName(r.shift) !== "—")
      : [];

    // When the source contains ShiftName, use it as the authoritative filter.
    // The previous implementation only inspected clock time; if a shift's
    // configuration was incomplete it returned the complete record set, so all
    // shift buttons displayed the same KPI values.
    if (recordsWithShiftName.length > 0) {
      return records.filter(
        (r) => normaliseShiftName(r.shift) === selectedShiftName,
      );
    }

    // Older imports without ShiftName are still supported by the time window.
    if (!selectedShift.startTime || !selectedShift.endTime) return [];

    const ssm    = sliceToMins(selectedShift.startTime);
    const sem    = sliceToMins(selectedShift.endTime);
    const isON   = sem <= ssm;
    const nextDt = isON ? nextDateStr(selectedDate) : null;

    return records.filter(r => {
      if (!r.startTime) return false;
      const t = timeStrToMins(r.startTime);
      if (t === null) return false;
      if (!isON) {
        if (r.eventDate && r.eventDate !== selectedDate) return false;
        return t >= ssm && t < sem;
      }
      if (r.eventDate) {
        if (r.eventDate === selectedDate) return t >= ssm;
        if (r.eventDate === nextDt)       return t < sem;
        return false;
      }
      return t >= ssm || t < sem;
    });
  }, [records, selectedShift, selectedDate]);

  // ── Changeover analysis ─────────────────────────────────────────────────
  // For "All Shifts", use all records; for specific shift, use shiftRecords
  const changeoverRecords = selectedShift ? shiftRecords : records;
  const shiftStartMins = selectedShift ? sliceToMins(selectedShift.startTime) : null;
  const changeovers    = useMemo(
    () => detectChangeovers(changeoverRecords, undefined, shiftStartMins),
    [changeoverRecords, shiftStartMins],
  );
  const coStats = useMemo(() => changeoverStats(changeovers), [changeovers]);

  // ── OEE — unified computeOEE for both All Shifts + per shift ────────────
  const allShiftOEE = useMemo(() => {
    // For "All Shifts", use all records (not filtered by eventDate) to get the complete OEE
    // for the selected date range. The date filtering is already done by loadForRange.
    const prod = records.filter(r => r.state === "Production");
    const down = records.filter(r => r.state === "Downtime");

    // plannedMins = sum of net production time (shift duration minus
    // configured breaks) of all active shifts. This ensures the denominator
    // is correct for "All Shifts" view.
    const plannedMins = shifts.length > 0
      ? shifts.reduce((s, sh) => s + shiftPlannedProductionMins(sh), 0)
      : 480; // fallback to 8 hours if no shifts configured

    return computeOEE({ prodRecords: prod, downRecords: down, plannedMins, materials });
  }, [records, shifts, materials]);

  const shiftOEE = useMemo(() => {
    // shiftRecords is already time-filtered to the selected shift's window,
    // including both the selectedDate portion and the D+1 after-midnight portion
    // for overnight shifts (Shift 2: 20:00 D → 08:00 D+1).
    // Use shiftRecords directly — no extra date filter needed here.
    const prod = shiftRecords.filter(r => r.state === "Production");
    const down = shiftRecords.filter(r => r.state === "Downtime");
    const plannedMins = selectedShift ? Math.max(1, shiftPlannedProductionMins(selectedShift)) : 480;
    return computeOEE({ prodRecords: prod, downRecords: down, plannedMins, materials });
  }, [shiftRecords, selectedShift, materials]);

  // Active OEE values (shift-scoped when a shift is selected)
  const activeOEEData    = selectedShift ? shiftOEE    : allShiftOEE;
  const activeOEE        = activeOEEData.OEE;
  const activeA          = activeOEEData.A;
  const activeP          = activeOEEData.P;
  const activeQ          = activeOEEData.Q;
  const activePUnverified = activeOEEData.pUnverified;
  const activeQUnverified = activeOEEData.qUnverified;

  // Display quantities
  const displayQty          = activeOEEData.qty;
  const displayComponentQty = activeOEEData.componentQty;
  const displayGood         = activeOEEData.good;
  const displayBad          = activeOEEData.bad;
  const displayComponentGood = activeOEEData.componentGood;
  const displayComponentBad  = activeOEEData.componentBad;
  const passR               = activeOEEData.passRate;
  const dMins               = activeOEEData.downMins;
  const activeAvgCycleSecs  = activeOEEData.avgCycleSecs;

  // ── Current model / material lookup ────────────────────────────────────
  // /records-range returns rows ORDER BY EventDate ASC, StartTime ASC (oldest
  // first), so records[]/shiftRecords[] are in ascending order — picking the
  // FIRST array entry (as a naive .find() would) actually returns the OLDEST
  // record of the range, not the latest. Every "most recent" lookup here must
  // instead reduce by parsed timestamp, same as latestRecord below.
  const srcRecords = selectedShift ? shiftRecords : records;
  const parseRecordTs = (r) => {
    if (!r) return null;
    const s = String(r.startTime || "");
    // Full datetime string
    if (s.includes("T") || (s.length > 10 && s.includes(" "))) {
      const t = Date.parse(s);
      if (!Number.isNaN(t)) return t;
    }
    // Combine eventDate + startTime when startTime is time-only
    if (r.eventDate && s) {
      const t = Date.parse(`${r.eventDate}T${s}`);
      if (!Number.isNaN(t)) return t;
    }
    // Fall back to syncedAt if available
    if (r.syncedAt) {
      const t = Date.parse(r.syncedAt);
      if (!Number.isNaN(t)) return t;
    }
    return null;
  };

  const prodRecords = srcRecords.filter(r => r.state === "Production");
  const latestProdRecord = prodRecords.length > 0
    ? prodRecords.reduce((a, b) => (parseRecordTs(a) || 0) > (parseRecordTs(b) || 0) ? a : b)
    : null;
  const curModel = latestProdRecord?.model ?? null;
  const curMat   = curModel ? getMaterialByModel(materials, curModel) : null;
  const curComponentCT = componentCTFromMaster(activeAvgCycleSecs, curMat);

  // Determine running status based on the most recent Production record's timestamp.
  // Rationale: raw DB updates can interleave Downtime/Production rows — using the
  // first array entry made the UI flip to OFFLINE incorrectly. Instead we look
  // for the latest Production record (or fallback to the newest record) and
  // consider the machine running only if that record is Production and
  // occurred within a short recency window.
  let isRunning = false;
  if (srcRecords && srcRecords.length > 0) {
    const nowMs = time.getTime();
    const THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    // Latest record of any state
    const latestRecord = srcRecords.reduce((a, b) => (parseRecordTs(a) || 0) > (parseRecordTs(b) || 0) ? a : b);
    const latestRecordTs = parseRecordTs(latestRecord);
    const latestProdTs = parseRecordTs(latestProdRecord);

    // Prefer explicit DB event type: if the latest record is a recent Downtime,
    // the machine is stopped. Otherwise if a recent Production exists treat
    // the machine as running. Fall back to latest-record Production as last resort.
    if (latestRecord && latestRecord.state === "Downtime" && latestRecordTs && (nowMs - latestRecordTs) < THRESHOLD_MS) {
      isRunning = false;
    } else if (latestProdRecord && latestProdTs && (nowMs - latestProdTs) < THRESHOLD_MS) {
      isRunning = true;
    } else if (latestRecord && latestRecord.state === "Production" && latestRecordTs && (nowMs - latestRecordTs) < THRESHOLD_MS) {
      isRunning = true;
    } else {
      isRunning = false;
    }
  }
  // Latest record (any state) for consumers that want to display explicit
  // event-type based status (e.g. "Downtime" → show STOPPED).
  const latestRecord = (srcRecords && srcRecords.length > 0)
    ? srcRecords.reduce((a, b) => (parseRecordTs(a) || 0) > (parseRecordTs(b) || 0) ? a : b)
    : null;

  // ── Shift progress ──────────────────────────────────────────────────────
  const shiftProgress = useMemo(() => {
    if (!selectedShift || !isToday) return null;
    const elapsed = shiftElapsedMins(selectedShift);
    const total   = shiftDurationMins(selectedShift);
    const pct     = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
    const rem     = Math.max(0, total - elapsed);
    return { elapsed, total, pct, remaining: `${p2(Math.floor(rem / 60))}h ${p2(rem % 60)}m` };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShift, isToday, time]);

  return {
    time, materials, shifts,
    records, loading, loadProgress,
    rangeMode, rangeStart, rangeEnd,
    customStart, setCustomStart, customEnd, setCustomEnd, showCustom, setShowCustom,
    selectedDate, isToday,
    applyRange, handleToday, handleYesterday, handleCustomApply,
    selectedShift, setSelectedShift,
    loadForRange, loadToday,
    shiftRecords, changeoverRecords, shiftStartMins, changeovers, coStats,
    allShiftOEE, shiftOEE, activeOEEData,
    activeOEE, activeA, activeP, activeQ, activePUnverified, activeQUnverified,
    displayQty, displayComponentQty, displayGood, displayBad,
    displayComponentGood, displayComponentBad, passR, dMins, activeAvgCycleSecs,
    curModel, curMat, curComponentCT, isRunning,
    latestRecord, latestProdRecord,
    shiftProgress,
  };
};
