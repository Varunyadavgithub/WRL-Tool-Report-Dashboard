import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  selectMaterials, selectShifts, getMaterialByModel,
  isActiveShift, shiftElapsedMins, shiftDurationMins, toMins as sliceToMins,
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

const componentCTFromMaster = (sheetCT, mat) => {
  const compPerSheet = Number(mat?.actualComponentsPerSheet) || 0;
  const loadUnload   = Number(mat?.pncLoadingUnloading) || 0;
  if (!isPunchingPart(mat) || compPerSheet <= 0) return null;
  return Math.round((((Number(sheetCT) || 0) + loadUnload) / compPerSheet) * 100) / 100;
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
    qty: 0, good: 0, bad: 0, componentQty: 0, passRate: 0,
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

  // ── P: Performance ────────────────────────────────────────────────────────
  // Find the dominant model (highest qty) and look up its ideal cycle time
  const modelTally = {};
  prodRecords.forEach(r => { if (r.model) modelTally[r.model] = (modelTally[r.model] || 0) + (r.qty ?? 0); });
  const topModel     = Object.entries(modelTally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const masterEntry  = topModel ? getMaterialByModel(materials, topModel) : null;
  const idealCycleSecs = (masterEntry?.definedComponentCycleTime > 0) ? masterEntry.definedComponentCycleTime : null;
  const plannedSecs  = planned * 60;
  const netSecs      = Math.max(1, plannedSecs - downSecs);
  const pUnverified  = !idealCycleSecs;
  const P            = idealCycleSecs
    ? Math.min(100, Math.max(0, Math.round(((qty * idealCycleSecs) / netSecs) * 100)))
    : 100;  // unknown std cycle → don't penalise, flag instead

  // ── Q: Quality ────────────────────────────────────────────────────────────
  const hasQualityData = prodRecords.some(r => r.quality != null && r.quality !== "");
  const good           = hasQualityData
    ? prodRecords.filter(r => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0)
    : qty; // treat all as good when quality sensor not connected
  const qUnverified    = !hasQualityData;
  const Q              = qty > 0 ? Math.min(100, Math.round((good / qty) * 100)) : 100;

  // A, P and Q are percentages, so convert their product back to a
  // percentage with the standard OEE formula: A × P × Q ÷ 10,000.
  const OEE = Math.round((A * P * Q) / 10000);

  const componentQty = Math.round(
    prodRecords.reduce((s, r) => {
      const mat = getMaterialByModel(materials, r.model);
      return s + componentQtyFromMaster(r.qty ?? 0, mat);
    }, 0)
  );

  const avgCycleSecs = prodRecords.length > 0 ? Math.round(runSecs / prodRecords.length) : 0;

  return {
    qty, good, bad: Math.max(0, qty - good), componentQty,
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

        // Production-day boundary: StartTime before this (in minutes) belongs to the
        // NEXT calendar date (post-midnight portion of an overnight shift).
        const _rsDt       = new Date(startISO);
        const dayStartMins = _rsDt.getHours() * 60 + _rsDt.getMinutes();
        const bumpDate = (d) => {
          const [y, mo, dy] = d.split("-").map(Number);
          const dt = new Date(y, mo - 1, dy + 1);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        };

        const filtered = rows.filter(r => {
          if (!r.StartTime) return true; // keep if no time (let downstream handle)
          const eventDate = String(r.EventDate).slice(0, 10);
          const timeStr   = String(r.StartTime);
          let ts;
          if (timeStr.includes("T") || timeStr.length > 8) {
            ts = new Date(timeStr).getTime();
          } else {
            // Overnight correction: StartTime before day-start means next calendar date
            const [hh, mm] = timeStr.split(":").map(Number);
            const todMins  = (hh || 0) * 60 + (mm || 0);
            const calDate  = todMins < dayStartMins ? bumpDate(eventDate) : eventDate;
            ts = new Date(`${calDate}T${timeStr}`).getTime();
          }
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

    // plannedMins = sum of durations of all active shifts
    // This ensures the denominator is correct for "All Shifts" view
    const plannedMins = shifts.length > 0
      ? shifts.reduce((s, sh) => s + shiftDurationMins(sh), 0)
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
    const plannedMins = selectedShift ? Math.max(1, shiftDurationMins(selectedShift)) : 480;
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
  const passR               = activeOEEData.passRate;
  const dMins               = activeOEEData.downMins;
  const activeAvgCycleSecs  = activeOEEData.avgCycleSecs;

  // ── Current model / material lookup ────────────────────────────────────
  const latestProdRecord = (selectedShift ? shiftRecords : records).find(r => r.state === "Production");
  const curModel = latestProdRecord?.model ?? null;
  const curMat   = curModel ? getMaterialByModel(materials, curModel) : null;
  const curComponentCT = componentCTFromMaster(activeAvgCycleSecs, curMat);
  const isRunning = (selectedShift ? shiftRecords : records)[0]?.state === "Production";

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
    displayQty, displayComponentQty, displayGood, displayBad, passR, dMins, activeAvgCycleSecs,
    curModel, curMat, curComponentCT, isRunning,
    shiftProgress,
  };
};
