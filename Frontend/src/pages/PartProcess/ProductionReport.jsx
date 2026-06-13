import { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  Search, Calendar, Clock, Filter, Loader2, Download,
  PackageOpen, BarChart2, List, TrendingUp, TrendingDown,
  ChevronDown, Zap,
} from "lucide-react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets.js";
import { selectMaterials, getMaterialByModel, selectShifts, toMins } from "../../redux/slices/masterConfigSlice";
import { enrichRecords, detectChangeovers, changeoverStats, parseDurSecs, IDLE_THRESHOLD_MINS, STD_CHANGEOVER_MINS, isPunchingPart } from "../../utils/productionLogic.js";
import { mapFOsRecord } from "./FactoryMonitor";
import fosClient, { FACTORY_OS_BASE, FACTORY_MACHINE_ID } from "../../utils/factoryOsClient";

// --- Helpers ----------------------------------------------------------------
const pad = (n) => (n < 10 ? "0" + n : n);
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
// "YYYY-MM-DD" from a Date
const fmtYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// "YYYY-MM-DD HH:MM:SS" from an absolute timestamp + the original time string
const fmtAbs = (ms, timeStr) =>
  ms ? `${fmtYMD(new Date(ms))} ${timeStr || ""}`.trim() : timeStr || "—";
const toDisplayDate = (isoDate) => {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
};
const todayStr = () => fmtYMD(new Date());
const extractHHMM = (t) => { if (!t) return null; const s = String(t); if (s.includes("T")) return s.split("T")[1].substring(0,5); if (s.length > 10 && s.includes(" ")) return s.split(" ")[1].substring(0,5); return s.substring(0,5); };
const offsetDate = (days) => { const d = new Date(); d.setDate(d.getDate()+days); return fmtYMD(d); };

// seconds-of-day from "HH:MM:SS" / "...THH:MM:SS" / "... HH:MM:SS"
const todSecs = (t) => {
  if (!t) return null;
  const s = String(t);
  let tp = s;
  if (s.includes("T")) tp = s.split("T")[1];
  else if (s.length > 10 && s.includes(" ")) tp = s.split(" ")[1];
  const [h, m, sec] = tp.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 3600 + m * 60 + (sec || 0);
};

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;


// OEE colour helpers
const oeeTextColor = (v) =>
  v >= 85 ? "text-emerald-600" : v >= 65 ? "text-amber-600" : "text-rose-500";
const oeeBgColor  = (v) =>
  v >= 85 ? "bg-emerald-50 border-emerald-200" : v >= 65 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200";

// Delta badge
const Delta = ({ actual, plan }) => {
  if (!plan) return null;
  const diff = actual - plan;
  return (
    <span className={`text-[9px] font-bold ${diff >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
      {diff >= 0 ? "▲" : "▼"}{Math.abs(diff)}
    </span>
  );
};

// --- Aggregation: raw records -> summary rows -------------------------------
const MACHINE_POWER_KW = 5; // default machine power assumption

const aggregateRecords = (records, materials, queryDateStr) => {
  if (!records.length) return [];

  // Enrich first — classifies Downtime >= 5 min as "Idle"
  const enriched = enrichRecords(records);

  const map = {};
  enriched.forEach((r) => {
    const sapCode = r.sapCode || (r.model ? getMaterialByModel(materials, r.model)?.sapCode : null) || "UNKNOWN";
    const key = sapCode;

    if (!map[key]) {
      const mat = getMaterialByModel(materials, r.model);
      map[key] = {
        sapCode, model: r.model,
        itemDescription: mat?.partName || r.model || "-",
        // NOTE: master no longer carries `cycleTime` (removed when the Material
        // Config was trimmed). "Defined CT" now reads the per-component defined
        // value. Confirm this is the target you want OEE/Performance measured
        // against, or re-introduce a per-sheet defined cycle time on the master.
        definedCycleTime: mat?.definedComponentCycleTime || 0,
        stdChangeoverTime: STD_CHANGEOVER_MINS,
        date: queryDateStr,
        planQty: 0, actualQty: 0, goodQty: 0,
        downtimeSecs: 0, downtimeCount: 0,  // brief downtime (<5m)
        idleSecs: 0,    idleCount: 0,        // idle (>=5m)
        cycleSecs: [], productionEvents: 0,
        rawRecords: [],  // keep for changeover detection
      };
    }

    const g = map[key];
    g.rawRecords.push(r);

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
    .filter((row) => row.sapCode !== "UNKNOWN") // drop downtime/idle bucket with no associated part
    .map((row, idx) => {
    const avgCycleSecs = row.cycleSecs.length > 0
      ? Math.round(row.cycleSecs.reduce((a, b) => a + b, 0) / row.cycleSecs.length)
      : row.definedCycleTime;

    // Detect actual changeovers from production records in this group
    const cos         = detectChangeovers(row.rawRecords);
    const coSt        = changeoverStats(cos);
    const downMins    = Math.round(row.downtimeSecs / 60);
    const idleMins    = Math.round(row.idleSecs / 60);
    const lossMins    = downMins + idleMins + coSt.overrunMins; // total loss
    const prodTimeMins  = Math.round((row.actualQty * avgCycleSecs) / 60);
    const actualTimeMins = prodTimeMins + downMins + idleMins;

    // Plan qty defaults to actual + 5% padding if not configured
    const planQty = row.planQty > 0 ? row.planQty : Math.ceil(row.actualQty * 1.05);
    const reqTimeMins = Math.round((planQty * row.definedCycleTime) / 60);

    // OEE
    const availSecs = actualTimeMins * 60;
    const A = availSecs > 0
      ? Math.max(0, (availSecs - row.downtimeSecs) / availSecs)
      : 1;
    const runSecs = availSecs - row.downtimeSecs;
    const P = runSecs > 0 && row.definedCycleTime > 0
      ? Math.min(1, (row.actualQty * row.definedCycleTime) / runSecs)
      : 1;
    const Q = row.actualQty > 0
      ? Math.min(1, row.goodQty / row.actualQty)
      : 1;
    const oee = Math.round(A * P * Q * 1000) / 10;
    const availability = Math.round(A * 1000) / 10;
    const performance   = Math.round(P * 1000) / 10;
    const quality       = Math.round(Q * 1000) / 10;

    const rejects = row.actualQty - row.goodQty;

    // Energy
    const idealEnergyWh = Math.round((planQty * row.definedCycleTime * MACHINE_POWER_KW) / 3600);
    const actualEnergyWh = Math.round((row.actualQty * avgCycleSecs * MACHINE_POWER_KW) / 3600);

    // --- Punching-process component metrics ---------------------------------
    // Values pulled from the Material Config master:
    //   noOfSheet                → No. of Sheets
    //   actualComponentsPerSheet → No. of Components per Sheet
    //   pncLoadingUnloading      → Loading/Unloading Time (s)
    const matForRow    = getMaterialByModel(materials, row.model);
    const punching     = isPunchingPart(matForRow);
    const noOfSheet    = Number(matForRow?.noOfSheet) || 0;
    const compPerSheet = Number(matForRow?.actualComponentsPerSheet) || 0;
    const loadUnload   = Number(matForRow?.pncLoadingUnloading) || 0;

    // Sheet CT = actual machine cycle time per punched sheet (from the machine)
    const sheetCT = avgCycleSecs;

    // Component CT = (Sheet CT + Loading/Unloading Time) ÷ No. of Components per Sheet
    const compCT = punching && compPerSheet > 0
      ? Math.round(((sheetCT + loadUnload) / compPerSheet) * 100) / 100
      : null;

    // Total Components Produced =
    //   (No. of Sheets × No. of Components per Sheet) × Machine sheet count (actualQty)
    const compQty = punching && noOfSheet > 0 && compPerSheet > 0
      ? Math.round(noOfSheet * compPerSheet * row.actualQty)
      : row.actualQty;

    return {
      srNo: idx + 1,
      date: row.date,
      sapCode: row.sapCode,
      itemDescription: row.itemDescription,
      planQty,
      actualQty: row.actualQty,        // Sheet Qty — machine sheet count
      isPunching: punching,
      componentQty: compQty,
      componentCycleTime: compCT,
      reqTimeMins,
      actualTimeMins,
      definedCycleTime: row.definedCycleTime,
      sheetCycleTime: avgCycleSecs,    // Sheet CT — actual machine cycle time
      stdChangeoverTime:    row.stdChangeoverTime,
      actualChangeoverTime: Math.round(coSt.totalMins * 10) / 10,
      plannedChangeovers:   coSt.count,           // each model change = 1 planned CO
      actualChangeovers:    coSt.count,
      coOverrunMins:        coSt.overrunMins,      // CO time beyond std
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
      // for detail drill-down
      rawRecords: null,
    };
  });
};

// --- Export CSV -------------------------------------------------------------
const exportCSV = (rows) => {
  const H = ["Sr No","Date","SAP Code","Item Description",
    "Plan Qty","Sheet Qty","Components Produced","Required Time (min)","Actual Time (min)",
    "Defined Cycle Time (s)","Sheet Cycle Time (s)","Component Cycle Time (s)",
    "Rejects","Loss (min)","Availability (%)","Performance (%)","Quality (%)","OEE (%)"];
  const csv = [H.join(","), ...rows.map((r) =>
    [r.srNo, r.date, r.sapCode, `"${r.itemDescription}"`,
     r.planQty, r.actualQty, r.componentQty ?? "", r.reqTimeMins, r.actualTimeMins,
     r.definedCycleTime, r.sheetCycleTime, r.componentCycleTime ?? "",
     r.rejects, r.lossMins, r.availability, r.performance, r.quality, r.oee].join(",")
  )].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "production_report.csv"; a.click();
};

// --- Summary Table Header Cell ----------------------------------------------
const TH = ({ children, center, wide, sticky }) => (
  <th className={`px-2.5 py-2 text-[10px] font-semibold text-slate-600 border-b border-r border-slate-200 whitespace-nowrap align-middle
    ${center ? "text-center" : "text-left"}
    ${wide ? "min-w-[120px]" : ""}
    ${sticky ? "sticky left-0 z-20 bg-slate-100" : "bg-slate-100"}`}>
    {children}
  </th>
);

// --- Main Component ---------------------------------------------------------
const PartProcessProductionReport = () => {
  const materials    = useSelector(selectMaterials);
  const configShifts = useSelector(selectShifts).filter(s => s.status);

  const [startTime, setStartTime] = useState(`${todayStr()} 08:00`);
  const [endTime, setEndTime]     = useState(`${todayStr()} 20:00`);
  const [loading, setLoading]     = useState(false);
  const [ydayLoading, setYdayLoading]   = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [records, setRecords]     = useState([]);
  const [rawRecords, setRawRecords] = useState([]);
  const [showRaw, setShowRaw]     = useState(false);
  const [viewMode, setViewMode]   = useState("summary"); // "summary" | "detail"

  // Extract query date from startTime
  const queryDate = startTime.split(" ")[0]; // "YYYY-MM-DD"

  const DEMO_RECORDS = [
    { srNo: 1,  shift: "Shift 2", state: "Production", model: "1127024-D-UNIT-FRAME-D150H", startTime: "08:00:41", endTime: "08:01:22", duration: "00:00:45", qty: 1, quality: "GOOD",  operator: null, downtimeReason: null },
    { srNo: 2,  shift: "Shift 2", state: "Production", model: "1127024-D-UNIT-FRAME-D150H", startTime: "08:01:22", endTime: "08:02:10", duration: "00:00:48", qty: 1, quality: "GOOD",  operator: null, downtimeReason: null },
    { srNo: 3,  shift: "Shift 2", state: "Downtime",   model: null,                         startTime: "08:02:10", endTime: "08:15:46", duration: "00:13:36", qty: 0, quality: null,    operator: null, downtimeReason: "Tool Change" },
    ...Array.from({ length: 55 }, (_, i) => ({
      srNo: i + 4, shift: "Shift 2", state: "Production",
      model: i % 3 === 0 ? "0109855-C-INR-BTM-550G-RT-AS" : "1127024-D-UNIT-FRAME-D150H",
      startTime: `${pad(8 + Math.floor(i / 8))}:${pad((i * 7) % 60)}:00`,
      endTime:   `${pad(8 + Math.floor(i / 8))}:${pad(((i * 7) + 43) % 60)}:00`,
      duration: `00:00:${pad(41 + (i % 12))}`,
      qty: 1, quality: i % 15 === 0 ? null : "GOOD", operator: null, downtimeReason: null,
    })),
    { srNo: 60, shift: "Shift 2", state: "Downtime", model: null, startTime: "12:10:00", endTime: "12:17:30", duration: "00:07:30", qty: 0, quality: null, operator: null, downtimeReason: "Assign" },
    ...Array.from({ length: 12 }, (_, i) => ({
      srNo: i + 61, shift: "Shift 1", state: "Production",
      model: "0109855-D-INR-BTM-550G-RT-AS",
      startTime: `0${pad(6 + Math.floor(i / 4))}:${pad((i * 9) % 60)}:00`,
      endTime:   `0${pad(6 + Math.floor(i / 4))}:${pad(((i * 9) + 38) % 60)}:00`,
      duration: `00:00:${pad(38 + (i % 8))}`,
      qty: 1, quality: "GOOD", operator: null, downtimeReason: null,
    })),
  ];

  // Fetch + filter. daily-summary groups by PRODUCTION DAY:
  //   date=D  ->  [D dayStart, (D+1) dayStart)
  // so post-midnight rows returned under date=D are really D+1 on the calendar.
  const fetchData = useCallback(async (start, end, setLoadFn) => {
    const startMs = new Date(start.replace(" ", "T") + ":00").getTime();
    const endMs   = new Date(end.replace(" ", "T") + ":00").getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      toast.error("Invalid time range.");
      return;
    }

    setLoadFn(true); setRecords([]); setRawRecords([]);
    try {
      // production-day start (seconds of day) = start of the earliest configured shift (08:00 here)
      const dayStartSec = configShifts.length
        ? Math.min(...configShifts.map((s) => toMins(s.startTime))) * 60
        : 0;

      // which production day (Date @ local midnight of its start date) an instant belongs to
      const prodDayOf = (ms) => {
        const d = new Date(ms);
        const tod = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
        const base = new Date(d); base.setHours(0, 0, 0, 0);
        if (tod < dayStartSec) base.setDate(base.getDate() - 1);
        return base;
      };

      // production-day summaries that overlap the window
      const dates = [];
      const cur  = prodDayOf(startMs);
      const last = prodDayOf(endMs - 1000); // last instant actually inside the window
      while (cur <= last) { dates.push(fmtYMD(cur)); cur.setDate(cur.getDate() + 1); }

      const allMapped = [];
      const allRaw    = [];

      for (const date of dates) {
        const raw = [];
        let url = `${FACTORY_OS_BASE}/monitoring/daily-summary/${FACTORY_MACHINE_ID}/?date=${date}&page=1`;
        while (url) {
          const res = await fosClient.get(url);
          raw.push(...(res.data?.results ?? [])); url = res.data?.next || null;
          if (raw.length >= 5000) break;
        }

        // tag each raw row with its REAL calendar date (post-midnight rows roll to date+1)
        raw.forEach((r) => {
          const tod = todSecs(r.start_time);
          let calDate = date;
          if (tod !== null && tod < dayStartSec) {
            const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + 1);
            calDate = fmtYMD(d);
          }
          allRaw.push({ _fetchDate: date, _calDate: calDate, ...r });
        });

        // Include ALL event types (production + downtime) so aggregateRecords
        // can compute Loss (downtime + idle + CO overrun) correctly.
        const midnight = new Date(date + "T00:00:00").getTime();
        const mapped = enrichRecords(raw.map(mapFOsRecord)).map((r) => {
          const tod    = todSecs(r.startTime);
          const todEnd = todSecs(r.endTime);
          const absMs  = tod === null
            ? null
            : midnight + (tod < dayStartSec ? 86400000 : 0) + tod * 1000;
          let absMsEnd = null;
          if (absMs !== null && todEnd !== null) {
            const sm = new Date(absMs); sm.setHours(0, 0, 0, 0);
            absMsEnd = sm.getTime() + todEnd * 1000;
            if (absMsEnd < absMs) absMsEnd += 86400000; // ran past midnight
          }
          return { ...r, _prodDay: date, _absMs: absMs, _absMsEnd: absMsEnd };
        });
        allMapped.push(...mapped);
      }

      // exact-window filter on real timestamps, newest first
      const filtered = allMapped
        .filter((r) =>
          r._absMs !== null &&
          r._absMs >= startMs &&
          r._absMs < endMs &&
          parseDurSecs(r.duration) <= 86400, // drop unclosed/open downtime
        )
        .sort((a, b) => b._absMs - a._absMs);

      setRecords(filtered);
      setRawRecords(allRaw);
      const prodCount = filtered.filter(r => r.state === "Production").length;
      toast.success(`${prodCount} production + ${filtered.length - prodCount} downtime records loaded`);
    } catch {
      setRecords(DEMO_RECORDS.filter(r => r.state === "Production"));
      toast("Demo data loaded - connect API for live data", { icon: "⚡" });
    } finally { setLoadFn(false); }
  }, [configShifts]);

  const handleQuery = () => {
    if (!startTime || !endTime) { toast.error("Select a time range."); return; }
    fetchData(startTime, endTime, setLoading);
  };
  const handleToday = () => {
    const start = `${todayStr()} 08:00`; const end = `${offsetDate(1)} 08:00`;
    setStartTime(start); setEndTime(end); fetchData(start, end, setTodayLoading);
  };
  const handleYesterday = () => {
    const start = `${offsetDate(-1)} 08:00`; const end = `${todayStr()} 08:00`;
    setStartTime(start); setEndTime(end); fetchData(start, end, setYdayLoading);
  };
  const isAnyLoading = loading || ydayLoading || todayLoading;

  // --- Aggregated summary ---------------------------------------------------
  const summary = useMemo(
    () => aggregateRecords(records, materials, queryDate),
    [records, materials, queryDate]
  );

  // Totals footer
  const totals = useMemo(() => ({
    planQty:       summary.reduce((s, r) => s + r.planQty, 0),
    actualQty:     summary.reduce((s, r) => s + r.actualQty, 0),
    componentQty:  summary.reduce((s, r) => s + (r.componentQty ?? r.actualQty), 0),
    rejects:       summary.reduce((s, r) => s + r.rejects, 0),
    lossMins:  summary.reduce((s, r) => s + r.lossMins, 0),
    availability: summary.length > 0 ? (summary.reduce((s, r) => s + r.availability, 0) / summary.length).toFixed(1) : 0,
    performance:  summary.length > 0 ? (summary.reduce((s, r) => s + r.performance, 0) / summary.length).toFixed(1) : 0,
    quality:      summary.length > 0 ? (summary.reduce((s, r) => s + r.quality, 0) / summary.length).toFixed(1) : 0,
    oee:       summary.length > 0 ? (summary.reduce((s, r) => s + r.oee, 0) / summary.length).toFixed(1) : 0,
    idealEnergyWh: summary.reduce((s, r) => s + r.idealEnergyWh, 0),
    actualEnergyWh: summary.reduce((s, r) => s + r.actualEnergyWh, 0),
  }), [summary]);

  // --- Detail records (raw) -------------------------------------------------
  const detailRecords = records;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* -- HEADER -- */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">
            Part Process - Production Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Production events only · OEE · Cycle Time · Quality & Loss
          </p>
        </div>
        {summary.length > 0 && (
          <div className="flex items-center gap-2">
            {[
              { label: "Plan Qty",   value: totals.planQty.toLocaleString(),   color: "slate"   },
              { label: "Sheet Qty",  value: totals.actualQty.toLocaleString(), color: "blue"    },
              { label: "Rejects",    value: totals.rejects.toLocaleString(),   color: "rose"    },
              { label: "Avg OEE",    value: `${totals.oee}%`,                  color: "emerald" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`flex flex-col items-center px-3 py-1.5 rounded-lg bg-${color}-50 border border-${color}-100 min-w-[68px]`}>
                <span className={`text-base font-bold font-mono text-${color}-600`}>{value}</span>
                <span className={`text-[9px] text-${color}-500 font-semibold uppercase tracking-wide`}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- BODY -- */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Filters</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[165px] flex-1">
              <DateTimePicker label="Start Time" name="start" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="min-w-[165px] flex-1">
              <DateTimePicker label="End Time" name="end" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="flex gap-2 pb-0.5 shrink-0 flex-wrap">
              <button onClick={handleYesterday} disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 text-white"}`}>
                {ydayLoading ? <Spinner /> : <Calendar className="w-3.5 h-3.5" />} Yesterday
              </button>
              <button onClick={handleToday} disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                {todayLoading ? <Spinner /> : <Clock className="w-3.5 h-3.5" />} Today
              </button>
              <button onClick={handleQuery} disabled={isAnyLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}>
                {loading ? <Spinner /> : <Search className="w-3.5 h-3.5" />} {loading ? "Loading…" : "Query"}
              </button>
            </div>
          </div>
        </div>

        {/* View mode tabs + export */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
            {[["summary", BarChart2, "Summary Report"], ["detail", List, "Detail Records"]].map(([mode, Icon, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === mode ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          {summary.length > 0 && viewMode === "summary" && (
            <button onClick={() => exportCSV(summary)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
        </div>

        {/* -- SUMMARY TABLE -- */}
        {viewMode === "summary" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="overflow-auto">
              <table className="border-separate border-spacing-0" style={{ minWidth: "2240px" }}>
                <thead className="sticky top-0 z-10">
                  {/* Group headers */}
                  <tr className="bg-slate-200">
                    <th colSpan={4} className="px-2 py-1.5 text-[10px] font-bold text-slate-600 border-b border-r border-slate-300 text-center sticky left-0 bg-slate-200 z-20">
                      Part Info
                    </th>
                    <th colSpan={3} className="px-2 py-1.5 text-[10px] font-bold text-blue-700 border-b border-r border-blue-200 text-center bg-blue-50">
                      Production Qty
                    </th>
                    <th colSpan={2} className="px-2 py-1.5 text-[10px] font-bold text-violet-700 border-b border-r border-violet-200 text-center bg-violet-50">
                      Time (min)
                    </th>
                    <th colSpan={3} className="px-2 py-1.5 text-[10px] font-bold text-cyan-700 border-b border-r border-cyan-200 text-center bg-cyan-50">
                      Cycle Time (s)
                    </th>
                    <th colSpan={2} className="px-2 py-1.5 text-[10px] font-bold text-rose-700 border-b border-r border-rose-200 text-center bg-rose-50">
                      Quality & Loss
                    </th>
                    <th colSpan={4} className="px-2 py-1.5 text-[10px] font-bold text-amber-700 border-b border-r border-amber-200 text-center bg-amber-50">
                      OEE (A × P × Q)
                    </th>
                  </tr>
                  {/* Column headers */}
                  <tr>
                    <TH sticky>Sr. No.</TH>
                    <TH>Date</TH>
                    <TH wide>SAP Code</TH>
                    <TH wide>Item Description</TH>
                    {/* Production Qty */}
                    <TH center>Plan Qty</TH>
                    <TH center>Sheet Qty</TH>
                    <TH center>Components Produced</TH>
                    {/* Time */}
                    <TH center>Required Time</TH>
                    <TH center>Actual Time</TH>
                    {/* Cycle Time */}
                    <TH center>Defined CT</TH>
                    <TH center>Sheet CT</TH>
                    <TH center>Component CT</TH>
                    {/* Quality & Loss */}
                    <TH center>Rejects</TH>
                    <TH center>Loss (min)</TH>
                    {/* OEE breakdown */}
                    <TH center>A (%)</TH>
                    <TH center>P (%)</TH>
                    <TH center>Q (%)</TH>
                    <TH center>OEE (%)</TH>
                  </tr>
                </thead>
                <tbody>
                  {isAnyLoading ? (
                    <tr><td colSpan={18} className="py-14 text-center">
                      <div className="flex justify-center items-center gap-2 text-slate-400">
                        <Spinner cls="w-5 h-5 text-blue-500" />
                        <span className="text-sm">Computing production summary…</span>
                      </div>
                    </td></tr>
                  ) : summary.length > 0 ? (
                    summary.map((r) => {
                      const cycleStatus = r.sheetCycleTime <= r.definedCycleTime ? "good" : "over";
                      return (
                        <tr key={r.srNo} className="hover:bg-blue-50/30 transition-colors even:bg-slate-50/30">
                          {/* Sr No */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-[11px] text-slate-400 font-mono sticky left-0 bg-white">
                            {r.srNo}
                          </td>
                          {/* Date */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-xs font-mono text-slate-600 whitespace-nowrap">
                            {toDisplayDate(r.date)}
                          </td>
                          {/* SAP Code */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100">
                            <span className="font-mono font-bold text-blue-600 text-xs">{r.sapCode}</span>
                          </td>
                          {/* Item Description — partName from master, or program name + warning */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 max-w-[240px]">
                            {materials.some(m => m.partName === r.itemDescription) ? (
                              <span className="font-semibold text-blue-700 text-xs leading-snug block">{r.itemDescription}</span>
                            ) : (
                              <div>
                                <span className="font-mono text-[11px] text-slate-600 block leading-snug">{r.itemDescription}</span>
                                <span className="text-[9px] font-bold text-rose-500">⚠ Master not exist</span>
                              </div>
                            )}
                          </td>
                          {/* Plan Qty */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center font-mono font-semibold text-slate-700">
                            {r.planQty}
                          </td>
                          {/* Sheet Qty — machine sheet count */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`font-bold font-mono text-sm ${r.actualQty >= r.planQty ? "text-emerald-600" : "text-blue-600"}`}>
                                {r.actualQty}
                              </span>
                              <Delta actual={r.actualQty} plan={r.planQty} />
                              <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${r.actualQty >= r.planQty ? "bg-emerald-500" : "bg-blue-500"}`}
                                  style={{ width: `${Math.min(100, (r.actualQty / r.planQty) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          {/* Components Produced */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`font-bold font-mono text-sm ${r.isPunching ? "text-violet-600" : "text-blue-500"}`}>
                              {r.componentQty}
                            </span>
                          </td>
                          {/* Required Time */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center font-mono text-violet-600 font-semibold">
                            {r.reqTimeMins}
                          </td>
                          {/* Actual Time */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`font-mono font-semibold ${r.actualTimeMins > r.reqTimeMins ? "text-amber-600" : "text-violet-600"}`}>
                              {r.actualTimeMins}
                            </span>
                          </td>
                          {/* Defined Cycle Time */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center font-mono font-semibold text-cyan-600">
                            {r.definedCycleTime > 0 ? `${r.definedCycleTime}` : "-"}
                          </td>
                          {/* Sheet CT — actual machine cycle time */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`font-mono font-bold ${cycleStatus === "good" ? "text-emerald-600" : "text-amber-600"}`}>
                              {r.sheetCycleTime > 0 ? r.sheetCycleTime : "-"}
                            </span>
                          </td>
                          {/* Component CT */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            {r.componentCycleTime != null ? (
                              <span className="font-mono font-semibold text-indigo-600">{r.componentCycleTime}</span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          {/* Rejects */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`font-bold font-mono ${r.rejects > 0 ? "text-rose-500" : "text-emerald-600"}`}>
                              {r.rejects}
                            </span>
                          </td>
                          {/* Loss (min) */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`font-bold font-mono ${r.lossMins > 30 ? "text-rose-500" : r.lossMins > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                              {r.lossMins}
                            </span>
                          </td>
                          {/* Availability */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center font-mono font-semibold text-slate-600">
                            {r.availability}%
                          </td>
                          {/* Performance */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center font-mono font-semibold text-slate-600">
                            {r.performance}%
                          </td>
                          {/* Quality */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center font-mono font-semibold text-slate-600">
                            {r.quality}%
                          </td>
                          {/* OEE */}
                          <td className="px-2.5 py-2.5 border-b border-r border-slate-100 text-center">
                            <div className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border ${oeeBgColor(r.oee)}`}>
                              <span className={`text-sm font-bold font-mono ${oeeTextColor(r.oee)}`}>
                                {r.oee}%
                              </span>
                              <div className="w-10 h-1 bg-white/60 rounded-full overflow-hidden mt-0.5">
                                <div
                                  className={`h-full rounded-full ${r.oee >= 85 ? "bg-emerald-500" : r.oee >= 65 ? "bg-amber-500" : "bg-rose-500"}`}
                                  style={{ width: `${r.oee}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={18} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <PackageOpen className="w-10 h-10 opacity-40" strokeWidth={1.2} />
                        <p className="text-sm text-slate-400 font-medium">No data - select filters and click Query</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>

                {/* Totals footer */}
                {summary.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100">
                      <td colSpan={4} className="px-2.5 py-2.5 border-t border-r-2 border-r-slate-300 border-slate-200 font-bold text-xs text-slate-700 sticky left-0 bg-slate-100">
                        TOTAL / AVG
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-slate-700">
                        {totals.planQty.toLocaleString()}
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-blue-600">
                        {totals.actualQty.toLocaleString()}
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-violet-600">
                        {totals.componentQty.toLocaleString()}
                      </td>
                      <td colSpan={5} className="border-t border-r border-slate-200" />
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-rose-500">
                        {totals.rejects.toLocaleString()}
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-amber-600">
                        {totals.lossMins}
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-slate-600">
                        {totals.availability}%
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-slate-600">
                        {totals.performance}%
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center font-bold font-mono text-slate-600">
                        {totals.quality}%
                      </td>
                      <td className="px-2.5 py-2.5 border-t border-r border-slate-200 text-center">
                        <span className={`font-bold font-mono ${oeeTextColor(parseFloat(totals.oee))}`}>
                          {totals.oee}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* -- DETAIL RECORDS TABLE -- */}
        {viewMode === "detail" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <List className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Raw Production Records
                </span>
                {detailRecords.length > 0 && (
                  <span className="text-[10px] text-slate-400">· {detailRecords.length} rows</span>
                )}
              </div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50">
                    {["Sr No","Shift","State","Model","Part Name","Start Time","End Time","Duration","Qty","Quality","Downtime Reason"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRecords.length > 0 ? detailRecords.map((r, idx) => {
                    const mat = r.model ? getMaterialByModel(materials, r.model) : null;
                    return (
                      <tr key={idx} className={`transition-colors hover:bg-blue-50/30 ${r.state === "Downtime" ? "bg-amber-50/40" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400">{r.srNo}</td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{r.shift}</span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          {r.state === "Production"
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Production</span>
                            : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Downtime</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {r.model ?? <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          {mat ? (
                            <span className="font-semibold text-blue-700 text-xs">{mat.partName}</span>
                          ) : r.model ? (
                            <div>
                              <span className="font-mono text-[11px] text-slate-600">{r.model}</span>
                              <span className="block text-[9px] font-bold text-rose-500 mt-0.5">⚠ Master not exist</span>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{fmtAbs(r._absMs, r.startTime)}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{fmtAbs(r._absMsEnd, r.endTime)}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">{r.duration}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-center font-bold text-blue-600 font-mono">{r.qty ?? 0}</td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          {r.quality === "GOOD"
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">GOOD</span>
                            : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-amber-600 font-medium">
                          {r.downtimeReason ?? <span className="text-slate-300">-</span>}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={11} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <PackageOpen className="w-8 h-8 opacity-50" strokeWidth={1.2} />
                        <p className="text-xs text-slate-400">No records - click Query to load data</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -- RAW DATA VERIFICATION -- */}
        {rawRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <button onClick={() => setShowRaw(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Raw API Data — {rawRecords.length} records</span>
                <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">Unprocessed</span>
              </div>
              <span className="text-[10px] text-slate-400">{showRaw ? "Hide ▲" : "Show ▼"}</span>
            </button>
            {showRaw && (
              <div className="overflow-auto max-h-96 border-t border-slate-100">
                <table className="min-w-full text-[10px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-amber-50">
                      {["#","Date","Shift","Type","Program / Barcode","Start","End","Duration","Qty","Quality","DT Reason","Asset","Line"].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-[9px] font-bold text-amber-700 border-b border-amber-200 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRecords.map((r, i) => (
                      <tr key={i} className={`hover:bg-amber-50/30 ${i%2===0?"bg-white":"bg-slate-50/50"}`}>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-400 font-mono">{i+1}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{r._calDate || r._fetchDate}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap text-slate-600">{r.shift?.shift_name||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap">
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${r.event_type==="Production"?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-600"}`}>{r.event_type}</span>
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-700 max-w-[200px] truncate" title={r.barcode||""}>{r.barcode||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">{r.start_time}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">{r.end_time}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{r.duration}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono font-bold text-slate-700">{r.parts_quantity??"-"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap">
                          {r.parts_quality?<span className={`text-[9px] font-bold px-1 rounded ${r.parts_quality==="GOOD"?"text-emerald-700 bg-emerald-50":"text-rose-600 bg-rose-50"}`}>{r.parts_quality}</span>:<span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-rose-600 whitespace-nowrap">{r.downtime_reason||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500 whitespace-nowrap">{r.asset_name||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500 whitespace-nowrap">{r.line_name||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default PartProcessProductionReport;