import { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Search,
  Calendar,
  Clock,
  Filter,
  Loader2,
  PackageOpen,
  TimerOff,
  AlertCircle,
  BarChart2,
  Download,
  TrendingDown,
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import toast from "react-hot-toast";
import { mapFOsRecord } from "./FactoryMonitor";
import fosClient, {
  FACTORY_OS_BASE,
  FACTORY_MACHINE_ID,
} from "../../utils/factoryOsClient";
import {
  enrichRecords,
  detectChangeovers,
  changeoverStats,
  parseDurSecs,
  IDLE_THRESHOLD_MINS,
  STD_CHANGEOVER_MINS,
} from "../../utils/productionLogic.js";
import {
  selectMaterials,
  getMaterialByModel,
  selectShifts,
  getShiftWindow,
  toMins,
} from "../../redux/slices/masterConfigSlice";

ChartJS.register(
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n) => (n < 10 ? "0" + n : n);
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
// "YYYY-MM-DD" from a Date
const fmtYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// "YYYY-MM-DD HH:MM:SS" from an absolute timestamp + the original time string
const fmtAbs = (ms, timeStr) =>
  ms ? `${fmtYMD(new Date(ms))} ${timeStr || ""}`.trim() : timeStr || "—";

const secsToMins = (s) => (s / 60).toFixed(1);
const fmtDur = (dur = "00:00:00") => {
  const [h, m, s] = (dur || "00:00:00").split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + (s || 0) / 60;
  if (total >= 60)
    return `${Math.floor(total / 60)}h ${Math.round(total % 60)}m`;
  return `${total.toFixed(1)}m`;
};

// Extract "HH:MM" from any time format:
//   "HH:MM:SS"              → "HH:MM"
//   "YYYY-MM-DD HH:MM:SS"   → "HH:MM"
//   "YYYY-MM-DDTHH:MM:SS"   → "HH:MM"
const extractHHMM = (t) => {
  if (!t) return null;
  const s = String(t);
  if (s.includes("T")) return s.split("T")[1].substring(0, 5);
  if (s.length > 10 && s.includes(" ")) return s.split(" ")[1].substring(0, 5);
  return s.substring(0, 5);
};

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

// Returns today's date as "YYYY-MM-DD"
const todayStr = () => fmtYMD(new Date());

// Returns "YYYY-MM-DD" offset by days from today
const offsetDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return fmtYMD(d);
};

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Export CSV ─────────────────────────────────────────────────────────────────
const exportCSV = (rows, changeovers) => {
  const dtRows = rows.map((r) => [
    r.eventId || r.srNo,
    r.shift,
    r.effectiveState === "Idle" ? "Idle" : "Downtime",
    fmtAbs(r._absMs, r.startTime),
    fmtAbs(r._absMsEnd, r.endTime),
    r.duration,
    r.downtimeReason || "Unassigned",
    r.operator || "—",
  ]);
  const coRows = changeovers.map((c, i) => [
    `CO-${i + 1}`,
    c.shift || "—",
    "Changeover",
    c.startTime,
    c.endTime,
    `${c.durationMins.toFixed(1)}m`,
    `${c.fromModel} → ${c.toModel}`,
    c.isOverrun ? `Overrun +${c.overrunMins.toFixed(1)}m` : "Within standard",
  ]);
  const H = [
    "Event ID",
    "Shift",
    "Type",
    "Start",
    "End",
    "Duration",
    "Reason / Info",
    "Notes",
  ];
  const csv = [H, ...dtRows, ...coRows].map((r) => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "downtime_report.csv";
  a.click();
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
const KpiCard = ({
  icon: Icon,
  label,
  value,
  sub,
  colorClass,
  borderColor,
}) => (
  <div
    className={`bg-white rounded-xl border-l-4 shadow-sm p-4 flex flex-col gap-1 ${borderColor}`}
  >
    <div className="flex items-center justify-between mb-1">
      <div className={`p-1.5 rounded-lg ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
    </div>
    <p className="text-xl font-bold font-mono text-slate-800">{value}</p>
    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
    {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
  </div>
);

// ── Type badge ─────────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  if (type === "Idle")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        <Clock className="w-2.5 h-2.5" /> Idle ≥{IDLE_THRESHOLD_MINS}m
      </span>
    );
  if (type === "Changeover")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap">
        <ArrowRight className="w-2.5 h-2.5" /> Changeover
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
      <TimerOff className="w-2.5 h-2.5" /> Downtime
    </span>
  );
};

// Resolve the correct shift from master config, overriding whatever the API says.
// The FactoryOS API can assign records to sub-intervals ("Break", "Dinner") that
// are not real shifts — and near boundaries the API shift can be off by one.
const resolveShift = (startTime, configShifts) => {
  if (!startTime || !configShifts?.length) return null;
  const hhmm = extractHHMM(startTime);
  if (!hhmm) return null;
  const t = toMins(hhmm);
  return (
    configShifts.find((s) => {
      const s0 = toMins(s.startTime);
      let e0 = toMins(s.endTime);
      if (e0 <= s0) e0 += 1440; // overnight shift crosses midnight
      const tc = t < s0 ? t + 1440 : t; // normalise overnight wrap
      return tc >= s0 && tc < e0;
    }) ?? null
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const PartProcessDowntimeReport = () => {
  const materials = useSelector(selectMaterials);
  const shifts = useSelector(selectShifts).filter((s) => s.status);
  const [startTime, setStartTime] = useState(`${todayStr()} 08:00`);
  const [endTime, setEndTime] = useState(`${todayStr()} 20:00`);
  const [loading, setLoading] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(null); // shiftName being loaded
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [rawRecords, setRawRecords] = useState([]); // raw API records for verification
  const [appliedRange, setAppliedRange] = useState(null);
  const [showAllDT, setShowAllDT] = useState(false);
  const [showAllCO, setShowAllCO] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  // Fetch + filter. The daily-summary endpoint groups by PRODUCTION DAY:
  //   date=D  →  [D dayStart, (D+1) dayStart)
  // so a record at 02:00 returned under date=D is really D+1 02:00 on the calendar.
  const fetchData = useCallback(
    async (start, end, setLoadFn) => {
      const startMs = new Date(start.replace(" ", "T") + ":00").getTime();
      const endMs = new Date(end.replace(" ", "T") + ":00").getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        toast.error("Invalid time range.");
        return;
      }

      setLoadFn(true);
      setRecords([]);
      setRawRecords([]);
      try {
        // production-day start (seconds of day) = start of the earliest configured shift (08:00 here)
        const dayStartSec = shifts.length
          ? Math.min(...shifts.map((s) => toMins(s.startTime))) * 60
          : 0;

        // which production day (Date @ local midnight of its start date) an instant belongs to
        const prodDayOf = (ms) => {
          const d = new Date(ms);
          const tod =
            d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
          const base = new Date(d);
          base.setHours(0, 0, 0, 0);
          if (tod < dayStartSec) base.setDate(base.getDate() - 1);
          return base;
        };

        // production-day summaries that overlap the window
        const dates = [];
        const cur = prodDayOf(startMs);
        const last = prodDayOf(endMs - 1000); // last instant actually inside the window
        while (cur <= last) {
          dates.push(fmtYMD(cur));
          cur.setDate(cur.getDate() + 1);
        }

        const allMapped = [];
        const allRaw = [];

        for (const date of dates) {
          const raw = [];
          let url = `${FACTORY_OS_BASE}/monitoring/daily-summary/${FACTORY_MACHINE_ID}/?date=${date}&page=1`;
          while (url) {
            const res = await fosClient.get(url);
            raw.push(...(res.data?.results ?? []));
            url = res.data?.next || null;
            if (raw.length >= 5000) break;
          }

          // tag each raw row with its REAL calendar date (post-midnight rows roll to date+1)
          raw.forEach((r) => {
            const tod = todSecs(r.start_time);
            let calDate = date;
            if (tod !== null && tod < dayStartSec) {
              const d = new Date(date + "T00:00:00");
              d.setDate(d.getDate() + 1);
              calDate = fmtYMD(d);
            }
            allRaw.push({ _fetchDate: date, _calDate: calDate, ...r });
          });

          const midnight = new Date(date + "T00:00:00").getTime();
          const mapped = enrichRecords(raw.map(mapFOsRecord)).map((r) => {
            const matched = resolveShift(r.startTime, shifts);
            const tod = todSecs(r.startTime);
            const todEnd = todSecs(r.endTime);

            // absolute start: post-midnight (tod < dayStart) belongs to the next calendar day
            const absMs =
              tod === null
                ? null
                : midnight + (tod < dayStartSec ? 86400000 : 0) + tod * 1000;

            // absolute end: same calendar day as start, +1 day if it ran past midnight
            let absMsEnd = null;
            if (absMs !== null && todEnd !== null) {
              const sm = new Date(absMs);
              sm.setHours(0, 0, 0, 0);
              absMsEnd = sm.getTime() + todEnd * 1000;
              if (absMsEnd < absMs) absMsEnd += 86400000;
            }

            return {
              ...(matched ? { ...r, shift: matched.shiftName } : r),
              _prodDay: date,
              _absMs: absMs,
              _absMsEnd: absMsEnd,
            };
          });
          allMapped.push(...mapped);
        }

        // exact-window filter on real timestamps, newest first
        const filtered = allMapped
          .filter(
            (r) =>
              r._absMs !== null &&
              r._absMs >= startMs &&
              r._absMs < endMs &&
              parseDurSecs(r.duration) <= 86400, // drop unclosed/open downtime (>24h impossible in one prod day)
          )
          .sort((a, b) => b._absMs - a._absMs);

        const startMin = toMins(
          (start.split(" ")[1] || "00:00").substring(0, 5),
        );
        const startDate = fmtYMD(new Date(startMs));
        const startCal = new Date(startMs);
        startCal.setHours(0, 0, 0, 0);
        const endCal = new Date(endMs - 1000);
        endCal.setHours(0, 0, 0, 0);
        const crossesMidnight = startCal.getTime() !== endCal.getTime();

        setRecords(filtered);
        setRawRecords(allRaw);
        setAppliedRange({
          startMin,
          startDate,
          crossesMidnight,
          days: dates.length,
        });
        toast.success(
          `${filtered.length} records loaded (${allRaw.length} raw)`,
        );
      } catch {
        toast.error("Failed to fetch data.");
      } finally {
        setLoadFn(false);
      }
    },
    [shifts],
  );

  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Select a time range.");
      return;
    }
    fetchData(startTime, endTime, setLoading);
  };

  // Quick-select: today full day (both shifts)
  const handleToday = () => {
    const start = `${todayStr()} 08:00`;
    const end = `${offsetDate(1)} 08:00`;
    setStartTime(start);
    setEndTime(end);
    fetchData(start, end, setTodayLoading);
  };

  // Quick-select: yesterday full day
  const handleYesterday = () => {
    const start = `${offsetDate(-1)} 08:00`;
    const end = `${todayStr()} 08:00`;
    setStartTime(start);
    setEndTime(end);
    fetchData(start, end, setYdayLoading);
  };

  // Quick-select: a specific shift of today (auto-detects correct base date for overnight)
  const handleShiftSelect = (shift) => {
    const curMins = new Date().getHours() * 60 + new Date().getMinutes();
    const ssm = toMins(shift.startTime);
    const sem = toMins(shift.endTime);
    const isON = sem <= ssm;
    // Overnight + current time is before shift-end → shift started on the previous day
    const baseDate = isON && curMins < sem ? offsetDate(-1) : todayStr();
    const win = getShiftWindow(shift, baseDate);
    if (!win) return;
    setStartTime(win.startDatetime);
    setEndTime(win.endDatetime);
    fetchData(win.startDatetime, win.endDatetime, (v) =>
      setShiftLoading(v ? shift.shiftName : null),
    );
  };

  const isAnyLoading =
    loading || ydayLoading || todayLoading || shiftLoading !== null;

  // ── Derived data ───────────────────────────────────────────────────────────
  const allDT = useMemo(
    () => records.filter((r) => r.state === "Downtime"),
    [records],
  );
  const briefDT = useMemo(
    () => allDT.filter((r) => (r.effectiveState || r.state) === "Downtime"),
    [allDT],
  );
  const idleDT = useMemo(
    () => allDT.filter((r) => (r.effectiveState || r.state) === "Idle"),
    [allDT],
  );

  const changeovers = useMemo(() => {
    if (!records.length) return [];
    // records are already clipped to the window; give detectChangeovers the timeline
    // anchor so post-midnight rows sort after the evening ones.
    const anchor = appliedRange?.crossesMidnight ? appliedRange.startMin : null;
    return detectChangeovers(records, undefined, anchor);
  }, [records, appliedRange]);

  const coSt = useMemo(() => changeoverStats(changeovers), [changeovers]);

  const totalDTSecs = useMemo(
    () => allDT.reduce((s, r) => s + parseDurSecs(r.duration), 0),
    [allDT],
  );
  const idleSecs = useMemo(
    () => idleDT.reduce((s, r) => s + parseDurSecs(r.duration), 0),
    [idleDT],
  );
  const briefSecs = useMemo(
    () => briefDT.reduce((s, r) => s + parseDurSecs(r.duration), 0),
    [briefDT],
  );

  // Reason breakdown
  const reasonMap = useMemo(() => {
    const m = {};
    allDT.forEach((r) => {
      const k = r.downtimeReason || "Unassigned";
      m[k] = (m[k] || 0) + parseDurSecs(r.duration);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [allDT]);

  // Shift breakdown
  const shiftMap = useMemo(() => {
    const m = {};
    allDT.forEach((r) => {
      m[r.shift] = (m[r.shift] || 0) + parseDurSecs(r.duration);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [allDT]);

  // ── Charts ─────────────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    const vals = [briefSecs / 60, idleSecs / 60, coSt.overrunMins].map(
      (v) => Math.round(v * 10) / 10,
    );
    if (vals.every((v) => v === 0)) return null;
    return {
      labels: [
        `Downtime (<${IDLE_THRESHOLD_MINS}m)`,
        `Idle (≥${IDLE_THRESHOLD_MINS}m)`,
        `CO Overrun`,
      ],
      datasets: [
        {
          data: vals,
          backgroundColor: ["#f43f5e", "#f59e0b", "#8b5cf6"],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    };
  }, [briefSecs, idleSecs, coSt]);

  const reasonChartData = useMemo(() => {
    if (!reasonMap.length) return null;
    const top = reasonMap.slice(0, 8);
    return {
      labels: top.map(([r]) => (r.length > 18 ? r.slice(0, 18) + "…" : r)),
      datasets: [
        {
          label: "Duration (min)",
          data: top.map(([, s]) => Math.round((s / 60) * 10) / 10),
          backgroundColor: "rgba(239,68,68,0.7)",
          borderColor: "#dc2626",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [reasonMap]);

  // Resolve the calendar date for a changeover's start/end minutes (handles overnight)
  const coDate = (mins) => {
    if (!appliedRange?.startDate || mins == null) return "";
    const norm = (((mins % 1440) + 1440) % 1440);
    const d = new Date(appliedRange.startDate + "T00:00:00");
    if (appliedRange.crossesMidnight && norm < appliedRange.startMin)
      d.setDate(d.getDate() + 1);
    return fmtYMD(d);
  };

  const hasData = allDT.length > 0 || changeovers.length > 0;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">
            Downtime Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Downtime · Idle · Changeover analysis
          </p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-100 min-w-[70px]">
              <span className="text-base font-bold font-mono text-rose-600">
                {secsToMins(totalDTSecs)}m
              </span>
              <span className="text-[9px] text-rose-500 font-semibold uppercase tracking-wide">
                Total DT
              </span>
            </div>
            <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[70px]">
              <span className="text-base font-bold font-mono text-amber-600">
                {idleDT.length}
              </span>
              <span className="text-[9px] text-amber-500 font-semibold uppercase tracking-wide">
                Idle Events
              </span>
            </div>
            <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-[70px]">
              <span className="text-base font-bold font-mono text-violet-600">
                {coSt.count}
              </span>
              <span className="text-[9px] text-violet-500 font-semibold uppercase tracking-wide">
                Changeovers
              </span>
            </div>
            <button
              onClick={() => exportCSV(allDT, changeovers)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[165px] flex-1">
              <DateTimePicker
                label="Start Time"
                name="start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="min-w-[165px] flex-1">
              <DateTimePicker
                label="End Time"
                name="end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pb-0.5 shrink-0 flex-wrap">
              {/* Shift quick-select buttons */}
              {shifts.map((sh) => (
                <button
                  key={sh.shiftName}
                  onClick={() => handleShiftSelect(sh)}
                  disabled={isAnyLoading}
                  style={
                    !isAnyLoading
                      ? {
                          backgroundColor: sh.color || "#6366f1",
                          borderColor: sh.color || "#6366f1",
                        }
                      : {}
                  }
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border text-white ${isAnyLoading ? "bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed" : "opacity-90 hover:opacity-100"}`}
                >
                  {shiftLoading === sh.shiftName ? (
                    <Spinner />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  {sh.shiftName}
                </button>
              ))}
              <button
                onClick={handleYesterday}
                disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
              >
                {ydayLoading ? (
                  <Spinner />
                ) : (
                  <Calendar className="w-3.5 h-3.5" />
                )}{" "}
                Yesterday
              </button>
              <button
                onClick={handleToday}
                disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
              >
                {todayLoading ? <Spinner /> : <Clock className="w-3.5 h-3.5" />}{" "}
                Today
              </button>
              <button
                onClick={handleQuery}
                disabled={isAnyLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}
              >
                {loading ? <Spinner /> : <Search className="w-3.5 h-3.5" />}{" "}
                {loading ? "Loading…" : "Query"}
              </button>
            </div>
          </div>
        </div>

        {isAnyLoading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 py-16">
            <Spinner cls="w-5 h-5 text-blue-500" />
            <p className="text-sm text-slate-400">Fetching downtime data…</p>
          </div>
        )}

        {!isAnyLoading && !hasData && records.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-12 text-center text-slate-400">
            <TimerOff
              className="w-8 h-8 opacity-30 mx-auto mb-2"
              strokeWidth={1.2}
            />
            <p className="text-sm">No downtime events found for this range.</p>
          </div>
        )}

        {!isAnyLoading && !hasData && records.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-12 text-center text-slate-400">
            <PackageOpen
              className="w-8 h-8 opacity-30 mx-auto mb-2"
              strokeWidth={1.2}
            />
            <p className="text-sm">Select filters and click Query.</p>
          </div>
        )}

        {!isAnyLoading && hasData && (
          <>
            {/* ── KPI CARDS ── */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
              <KpiCard
                icon={TimerOff}
                label="Total Downtime"
                value={`${secsToMins(totalDTSecs)}m`}
                sub={`${allDT.length} events`}
                colorClass="bg-rose-50 text-rose-500"
                borderColor="border-l-rose-400"
              />
              <KpiCard
                icon={Activity}
                label="Brief Downtime"
                value={briefDT.length}
                sub={`<${IDLE_THRESHOLD_MINS}m each · ${secsToMins(briefSecs)}m total`}
                colorClass="bg-red-50 text-red-500"
                borderColor="border-l-red-400"
              />
              <KpiCard
                icon={Clock}
                label="Idle Events"
                value={idleDT.length}
                sub={`≥${IDLE_THRESHOLD_MINS}m each · ${secsToMins(idleSecs)}m total`}
                colorClass="bg-amber-50 text-amber-500"
                borderColor="border-l-amber-400"
              />
              <KpiCard
                icon={ArrowRight}
                label="Changeovers"
                value={coSt.count}
                sub={`${coSt.totalMins}m total CO time`}
                colorClass="bg-violet-50 text-violet-500"
                borderColor="border-l-violet-400"
              />
              <KpiCard
                icon={TrendingDown}
                label="CO Overrun Loss"
                value={`${coSt.overrunMins}m`}
                sub={`${coSt.overrunCount} COs > ${STD_CHANGEOVER_MINS}m std`}
                colorClass="bg-purple-50 text-purple-500"
                borderColor="border-l-purple-400"
              />
            </div>

            {/* ── CHARTS ROW ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {/* Donut — type breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Loss Breakdown
                  </span>
                </div>
                <div className="p-4 flex flex-col items-center gap-3">
                  {donutData ? (
                    <>
                      <div className="w-40 h-40">
                        <Doughnut
                          data={donutData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                backgroundColor: "#fff",
                                titleColor: "#374151",
                                bodyColor: "#475569",
                                borderColor: "#e5e7eb",
                                borderWidth: 1,
                              },
                            },
                          }}
                        />
                      </div>
                      <div className="w-full flex flex-col gap-1.5">
                        {donutData.labels.map((l, i) => (
                          <div
                            key={l}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    donutData.datasets[0].backgroundColor[i],
                                }}
                              />
                              <span className="text-slate-600 text-[11px]">
                                {l}
                              </span>
                            </div>
                            <span className="font-bold font-mono text-slate-700">
                              {donutData.datasets[0].data[i]}m
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 py-8">
                      No downtime data
                    </p>
                  )}
                </div>
              </div>

              {/* Bar chart — reason-wise */}
              <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <BarChart2 className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Loss by Reason (min)
                  </span>
                </div>
                <div className="p-4 h-44">
                  {reasonChartData ? (
                    <Bar
                      data={reasonChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: "#fff",
                            titleColor: "#374151",
                            bodyColor: "#475569",
                            borderColor: "#e5e7eb",
                            borderWidth: 1,
                            callbacks: { label: (c) => `${c.parsed.y}m` },
                          },
                        },
                        scales: {
                          x: {
                            grid: { display: false },
                            ticks: { font: { size: 10 }, color: "#94a3b8" },
                          },
                          y: {
                            beginAtZero: true,
                            grid: { color: "rgba(0,0,0,0.05)" },
                            ticks: { font: { size: 10 }, color: "#94a3b8" },
                          },
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-300 text-xs">
                      No reason data
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── SHIFT BREAKDOWN ── */}
            {shiftMap.length > 1 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Shift-wise Downtime
                </p>
                <div className="flex gap-3 flex-wrap">
                  {shiftMap.map(([sh, secs]) => {
                    const pct =
                      totalDTSecs > 0
                        ? Math.round((secs / totalDTSecs) * 100)
                        : 0;
                    return (
                      <div
                        key={sh}
                        className="flex-1 min-w-[120px] bg-slate-50 rounded-xl p-3 border border-slate-200"
                      >
                        <p className="text-xs font-bold text-slate-700 mb-1">
                          {sh}
                        </p>
                        <p className="text-lg font-bold font-mono text-rose-500">
                          {secsToMins(secs)}m
                        </p>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full bg-rose-400 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {pct}% of total
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── CHANGEOVER ANALYSIS ── */}
            {changeovers.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      Changeover Analysis
                    </span>
                    <span className="text-[10px] text-slate-400">
                      · {coSt.count} changeovers · std {STD_CHANGEOVER_MINS}m
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {coSt.overrunMins > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                        <AlertCircle className="w-3 h-3" /> {coSt.overrunMins}m
                        overrun loss
                      </span>
                    )}
                    <button
                      onClick={() => setShowAllCO((v) => !v)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      {showAllCO ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {showAllCO ? "Less" : `Show all ${changeovers.length}`}
                    </button>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50">
                        {[
                          "#",
                          "Shift",
                          "From Model",
                          "To Model",
                          "Start",
                          "End",
                          "Gap",
                          "Std",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllCO ? changeovers : changeovers.slice(0, 5)).map(
                        (co, idx) => {
                          const fromMat = getMaterialByModel(
                            materials,
                            co.fromModel,
                          );
                          const toMat = getMaterialByModel(
                            materials,
                            co.toModel,
                          );
                          const sDate = coDate(
                            co.startMins ?? toMins(co.startTime),
                          );
                          const eDate = coDate(
                            co.endMins ?? toMins(co.endTime),
                          );
                          return (
                            <tr
                              key={idx}
                              className={`transition-colors hover:bg-slate-50 ${co.isOverrun ? "bg-rose-50/30" : "bg-white"}`}
                            >
                              <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                                {co.shift && co.shift !== "—" ? (
                                  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    {co.shift}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-700 break-words min-w-[140px]">
                                    {fromMat?.partName || co.fromModel}
                                  </p>
                                  {fromMat && (
                                    <p className="text-[9px] text-slate-400 font-mono">
                                      {fromMat.sapCode}
                                    </p>
                                  )}
                                  {!fromMat && (
                                    <p className="text-[9px] text-red-400 font-mono">
                                      master not exist
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-700 break-words min-w-[140px]">
                                    {toMat?.partName || co.toModel}
                                  </p>
                                  {toMat && (
                                    <p className="text-[9px] text-slate-400 font-mono">
                                      {toMat.sapCode}
                                    </p>
                                  )}
                                  {!toMat && (
                                    <p className="text-[9px] text-red-400 font-mono">
                                      master not exist
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                                {sDate ? `${sDate} ${co.startTime}` : co.startTime}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                                {eDate ? `${eDate} ${co.endTime}` : co.endTime}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-slate-700">
                                {co.durationMins.toFixed(1)}m
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 font-mono">
                                {co.stdMins}m
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                {co.isOverrun ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                                    +{co.overrunMins.toFixed(1)}m overrun
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Within std
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── DOWNTIME EVENTS TABLE ── */}
            {allDT.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <TimerOff className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      Downtime Events
                    </span>
                    <span className="text-[10px] text-slate-400">
                      · {allDT.length} total
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAllDT((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    {showAllDT ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {showAllDT ? "Show less" : `Show all ${allDT.length}`}
                  </button>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50">
                        {[
                          "#",
                          "Shift",
                          "Type",
                          "Start",
                          "End",
                          "Duration",
                          "Reason",
                          "Operator",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllDT ? allDT : allDT.slice(0, 10)).map(
                        (r, idx) => {
                          const effState = r.effectiveState || r.state;
                          const isIdle = effState === "Idle";
                          const secs = parseDurSecs(r.duration);
                          const maxSecs = Math.max(
                            ...allDT.map((x) => parseDurSecs(x.duration)),
                            1,
                          );
                          return (
                            <tr
                              key={idx}
                              className={`transition-colors ${isIdle ? "hover:bg-amber-50/30 bg-amber-50/10" : "hover:bg-rose-50/20"}`}
                            >
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                  {r.shift}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                <TypeBadge
                                  type={isIdle ? "Idle" : "Downtime"}
                                />
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                                {fmtAbs(r._absMs, r.startTime)}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                                {fmtAbs(r._absMsEnd, r.endTime)}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-bold font-mono ${isIdle ? "text-amber-600" : "text-rose-500"}`}
                                  >
                                    {fmtDur(r.duration)}
                                  </span>
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${isIdle ? "bg-amber-400" : "bg-rose-400"}`}
                                      style={{
                                        width: `${Math.min(100, (secs / maxSecs) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                {r.downtimeReason ? (
                                  <span className="text-[11px] font-medium text-slate-700">
                                    {r.downtimeReason}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                    ⚠ Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500">
                                {r.operator || (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                  {!showAllDT && allDT.length > 10 && (
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-center">
                      <button
                        onClick={() => setShowAllDT(true)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Show {allDT.length - 10} more events
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── RAW DATA VERIFICATION ── */}
        {rawRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Raw API Data — {rawRecords.length} records
                </span>
                <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                  Unprocessed
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {showRaw ? "Hide ▲" : "Show ▼"}
              </span>
            </button>
            {showRaw && (
              <div className="overflow-auto max-h-96 border-t border-slate-100">
                <table className="min-w-full text-[10px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-amber-50">
                      {[
                        "#",
                        "Date",
                        "Shift",
                        "Type",
                        "Program / Barcode",
                        "Start",
                        "End",
                        "Duration",
                        "Qty",
                        "Quality",
                        "DT Reason",
                        "Asset",
                        "Line",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-2 py-2 text-left text-[9px] font-bold text-amber-700 border-b border-amber-200 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRecords.map((r, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-amber-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                      >
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-400 font-mono">
                          {i + 1}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                          {r._calDate || r._fetchDate}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap text-slate-600">
                          {r.shift?.shift_name || "—"}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${r.event_type === "Production" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}
                          >
                            {r.event_type}
                          </span>
                        </td>
                        <td
                          className="px-2 py-1.5 border-b border-slate-100 text-slate-700 max-w-[200px] truncate"
                          title={r.barcode || ""}
                        >
                          {r.barcode || "—"}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                          {r.start_time}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                          {r.end_time}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                          {r.duration}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono font-bold text-slate-700">
                          {r.parts_quantity ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap">
                          {r.parts_quality ? (
                            <span
                              className={`text-[9px] font-bold px-1 py-0.5 rounded ${r.parts_quality === "GOOD" ? "text-emerald-700 bg-emerald-50" : "text-rose-600 bg-rose-50"}`}
                            >
                              {r.parts_quality}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-rose-600 whitespace-nowrap">
                          {r.downtime_reason || "—"}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                          {r.asset_name || "—"}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                          {r.line_name || "—"}
                        </td>
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

export default PartProcessDowntimeReport;