import { useState, useCallback, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import {
  Search, Calendar, Clock, Filter, Loader2, PackageOpen,
  BarChart2, List, AlertTriangle, CheckCircle2,
} from "lucide-react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets.js";
import { useSelector } from "react-redux";
import { mapFOsRecord } from "./FactoryMonitor";
import fosClient, { FACTORY_OS_BASE, FACTORY_MACHINE_ID } from "../../utils/factoryOsClient";
import { selectMaterials, selectShifts, getMaterialByModel, extractSapCode, toMins, getShiftWindow } from "../../redux/slices/masterConfigSlice";
import { componentQtyFromMachine } from "../../utils/productionLogic.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const pad = (n) => (n < 10 ? "0" + n : n);
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const extractHHMM = (t) => { if (!t) return null; const s = String(t); if (s.includes("T")) return s.split("T")[1].substring(0,5); if (s.length > 10 && s.includes(" ")) return s.split(" ")[1].substring(0,5); return s.substring(0,5); };
const offsetDate = (days) => { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;

// Parse "HH:MM:SS" â†’ total seconds
const parseDurationSecs = (dur = "00:00:00") => {
  const [h, m, s] = (dur || "00:00:00").split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

const secsToMMSS = (secs) => `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;



// Resolve which configured shift an HH:MM time belongs to.
// Overrides API shift names (which may include "Break", "Lunch", "Dinner")
// so those intervals are grouped into their parent shift.
const resolveShift = (startTimeHHMM, configShifts) => {
  if (!startTimeHHMM || !configShifts?.length) return null;
  const t = toMins(startTimeHHMM.substring(0, 5));   // minutes since midnight
  return configShifts.find(s => {
    const s0 = toMins(s.startTime);
    let   e0 = toMins(s.endTime);
    if (e0 <= s0) e0 += 1440;          // overnight shift crosses midnight
    const tc = t < s0 ? t + 1440 : t; // handle overnight wrap
    return tc >= s0 && tc < e0;
  }) ?? null;
};

const PartProcessHourlyReport = () => {
  const materials     = useSelector(selectMaterials);
  const configShifts  = useSelector(selectShifts).filter(s => s.status);
  const [startTime, setStartTime] = useState(`${todayStr()} 08:00`);
  const [endTime,   setEndTime]   = useState(`${todayStr()} 20:00`);
  const [loading, setLoading]           = useState(false);
  const [ydayLoading, setYdayLoading]   = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(null);
  const [records, setRecords]           = useState([]);
  const [rawRecords, setRawRecords]     = useState([]);
  const [showRaw, setShowRaw]           = useState(false);

  const fetchData = useCallback(async (start, end, setLoadFn) => {
    setLoadFn(true); setRecords([]); setRawRecords([]);
    try {
      const startDate = start.split(" ")[0];
      const endDate   = end.split(" ")[0];
      const startH    = (start.split(" ")[1] || "00:00").substring(0, 5);
      const endH      = (end.split(" ")[1]   || "23:59").substring(0, 5);

      const dates = [];
      const cur   = new Date(startDate + "T00:00:00");
      const fin   = new Date(endDate   + "T00:00:00");
      while (cur <= fin) { dates.push(`${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`); cur.setDate(cur.getDate() + 1); }

      const allMapped = [];
      const allRaw    = [];
      for (const date of dates) {
        const raw = [];
        let url = `${FACTORY_OS_BASE}/monitoring/daily-summary/${FACTORY_MACHINE_ID}/?date=${date}&page=1`;
        while (url) {
          const res = await fosClient.get(url);
          raw.push(...(res.data?.results ?? []));
          url = res.data?.next || null;
          if (raw.length >= 5000) break;
        }
        raw.forEach(r => allRaw.push({ _fetchDate: date, ...r }));
        const mapped = raw.map(mapFOsRecord);
        const filtered = mapped.filter(r => {
          const t = extractHHMM(r.startTime);
          if (!t) return false;
          if (date === startDate && date === endDate) return t >= startH && t <= endH;
          if (date === startDate) return t >= startH;
          if (date === endDate)   return t <= endH;
          return true;
        });
        allMapped.push(...filtered);
      }

      setRecords(allMapped);
      setRawRecords(allRaw);
      toast.success(`${allMapped.length} records loaded (${allRaw.length} raw)`);
    } catch {
      toast.error("Failed to fetch data.");
    } finally { setLoadFn(false); }
  }, []);

  const handleQuery = () => {
    if (!startTime || !endTime) { toast.error("Please select a time range."); return; }
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
  const handleShiftSelect = (shift) => {
    const curMins = new Date().getHours() * 60 + new Date().getMinutes();
    const ssm = toMins(shift.startTime); const sem = toMins(shift.endTime);
    const isON = sem <= ssm;
    const baseDate = isON && curMins < sem ? offsetDate(-1) : todayStr();
    const win = getShiftWindow(shift, baseDate);
    if (!win) return;
    setStartTime(win.startDatetime); setEndTime(win.endDatetime);
    fetchData(win.startDatetime, win.endDatetime, (v) => setShiftLoading(v ? shift.shiftName : null));
  };
  const isAnyLoading = loading || ydayLoading || todayLoading || shiftLoading !== null;

  // Aggregate records by SHIFT + HOUR, sorted by shift name then hour
  const hourlyData = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      if (!r.startTime) return;
      const hour = parseInt(r.startTime.split(":")[0], 10);

      // Resolve the correct shift from Shift Config (groups breaks/meals into parent shift)
      const matchedShift = resolveShift(r.startTime, configShifts);
      const shiftName    = matchedShift?.shiftName || r.shift || "—";

      const key = `${shiftName}__${hour}`;   // compound key: shift + hour
      if (!map[key]) {
        map[key] = {
          key, hour, shift: shiftName,
          label: `${pad(hour)}:00`,
          qty: 0, componentQty: 0, prodCount: 0, downtimeCount: 0, downtimeSecs: 0,
          models: new Map(),
        };
      }
      if (r.state === "Production") {
        const rQty = r.qty ?? 0;
        map[key].qty += rQty;
        map[key].prodCount += 1;
        const mat  = getMaterialByModel(materials, r.model);
        map[key].componentQty += componentQtyFromMachine(rQty, mat);
        const name = mat?.partName || r.model || extractSapCode(r.model) || "Unknown";
        const prev = map[key].models.get(name) || { matched: !!mat, qty: 0 };
        map[key].models.set(name, { matched: !!mat, qty: prev.qty + rQty });
      } else if (r.state === "Downtime") {
        map[key].downtimeCount += 1;
        map[key].downtimeSecs += parseDurationSecs(r.duration);
      }
    });
    // Sort: shift name alphabetically (Shift 1 → Shift 2 → Shift 3), then hour asc
    return Object.values(map)
      .map(row => ({ ...row, componentQty: Math.round(row.componentQty) }))
      .sort((a, b) => {
        const sc = a.shift.localeCompare(b.shift);
        return sc !== 0 ? sc : a.hour - b.hour;
      });
  }, [records, materials, configShifts]);

  const totalQty = useMemo(() => hourlyData.reduce((s, r) => s + r.qty, 0), [hourlyData]);

  // ── Parts × Hour matrix for the dedicated breakdown section ──────────────
  const partsMatrix = useMemo(() => {
    if (!hourlyData.length) return { parts: [], hours: [] };
    // Collect all unique parts across all hours
    const partMap = new Map(); // name → { matched, total }
    hourlyData.forEach(row => {
      row.models.forEach((info, name) => {
        const prev = partMap.get(name) || { matched: info.matched, total: 0 };
        partMap.set(name, { matched: info.matched, total: prev.total + info.qty });
      });
    });
    // Sort by total qty descending
    const parts = [...partMap.entries()].sort((a, b) => b[1].total - a[1].total);
    const hours = hourlyData.map(r => ({ label: r.label, hour: r.hour }));
    // Helper: qty of a part in a specific hour
    const getQty = (partName, hour) =>
      hourlyData.find(r => r.hour === hour)?.models.get(partName)?.qty ?? 0;
    return { parts, hours, getQty };
  }, [hourlyData]);

  // ── Part Total Count bar chart ────────────────────────────────────────────
  const partCountChart = useMemo(() => {
    if (!partsMatrix.parts.length) return null;
    const wrap = (n) => n.split(" ").reduce((acc, w) => {
      const last = acc[acc.length - 1] || "";
      if (last.length + w.length < 20) { acc[acc.length - 1] = last ? `${last} ${w}` : w; }
      else acc.push(w);
      return acc;
    }, [""]);

    return {
      data: {
        labels: partsMatrix.parts.map(([name]) => wrap(name)),
        datasets: [{
          label: "Total Count",
          data: partsMatrix.parts.map(([, info]) => info.total),
          backgroundColor: partsMatrix.parts.map(([, info]) =>
            info.matched ? "rgba(34,197,94,0.75)" : "rgba(239,68,68,0.55)"
          ),
          borderColor: partsMatrix.parts.map(([, info]) =>
            info.matched ? "#16a34a" : "#dc2626"
          ),
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#fff", titleColor: "#1e293b",
            bodyColor: "#475569", borderColor: "#e2e8f0", borderWidth: 1,
            callbacks: {
              title: (items) => partsMatrix.parts[items[0]?.dataIndex]?.[0] ?? "",
              label: (ctx) => `  Count: ${ctx.parsed.x}`,
            },
          },
        },
        scales: {
          y: {
            grid: { display: false },
            ticks: { font: { size: 10, weight: "500" }, color: "#374151" },
          },
          x: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { font: { size: 10 }, color: "#94a3b8" },
            title: { display: true, text: "Production Count", font: { size: 10 }, color: "#94a3b8" },
          },
        },
      },
    };
  }, [partsMatrix]);

  const chartData = useMemo(() => {
    if (!hourlyData.length) return null;
    const maxVal = Math.max(...hourlyData.map((d) => d.qty), 1);
    return {
      data: {
        labels: hourlyData.map((d) => d.label),
        datasets: [
          {
            label: "Qty Produced",
            data: hourlyData.map((d) => d.qty),
            backgroundColor: "rgba(59,130,246,0.18)",
            borderColor: "rgba(37,99,235,1)",
            borderWidth: 2, borderRadius: 6, borderSkipped: false,
          },
          {
            label: "Downtime Events",
            data: hourlyData.map((d) => d.downtimeCount),
            backgroundColor: "rgba(251,191,36,0.25)",
            borderColor: "rgba(245,158,11,1)",
            borderWidth: 2, borderRadius: 6, borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: { backgroundColor: "#fff", titleColor: "#475569", bodyColor: "#1e293b", borderColor: "#e2e8f0", borderWidth: 1 },
        },
        scales: {
          x: { grid: { color: "rgba(148,163,184,0.15)" }, ticks: { font: { size: 10 }, color: "#94a3b8" } },
          y: { beginAtZero: true, max: maxVal + Math.ceil(maxVal * 0.2) + 2, grid: { color: "rgba(148,163,184,0.15)" }, ticks: { font: { size: 10 }, color: "#94a3b8" } },
        },
      },
    };
  }, [hourlyData]);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Part Process - Hourly Report</h1>
          <p className="text-[11px] text-slate-400">Hour-by-hour part production &amp; downtime breakdown</p>
        </div>
        {totalQty > 0 && (
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">{totalQty.toLocaleString()}</span>
            <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Total Qty</span>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Filters</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[170px] flex-1">
              <DateTimePicker label="Start Time" name="start" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="min-w-[170px] flex-1">
              <DateTimePicker label="End Time" name="end" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="flex gap-2 pb-0.5 shrink-0 flex-wrap">
              {configShifts.map(sh => (
                <button key={sh.shiftName} onClick={() => handleShiftSelect(sh)} disabled={isAnyLoading}
                  style={!isAnyLoading ? { backgroundColor: sh.color || "#6366f1", borderColor: sh.color || "#6366f1" } : {}}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border text-white transition-all ${isAnyLoading ? "bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed" : "opacity-90 hover:opacity-100"}`}>
                  {shiftLoading === sh.shiftName ? <Spinner /> : <Clock className="w-3.5 h-3.5" />} {sh.shiftName}
                </button>
              ))}
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
                {loading ? <Spinner /> : <Search className="w-3.5 h-3.5" />} {loading ? "Loading..." : "Query"}
              </button>
            </div>
          </div>
        </div>

        {isAnyLoading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching dataâ€¦</p>
          </div>
        )}

        {!isAnyLoading && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {/* Hourly Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <List className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Hourly Summary
                </span>
              </div>
              {/* Fixed height ≈ 1 shift (8 rows × 42px + header 40px) — rest scrolls */}
              <div className="overflow-auto" style={{ maxHeight: "420px" }}>
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50">
                      {["Shift","Hour","Machine Qty","Components Produced","Prod. Events","Downtime Events","Downtime (m:s)","Parts","Total Part Count"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-center font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyData.length > 0 ? (() => {
                      // Pre-compute per-shift totals for the "Total Part Count" column
                      const shiftTotals = {};
                      const shiftComponentTotals = {};
                      hourlyData.forEach(r => {
                        shiftTotals[r.shift] = (shiftTotals[r.shift] || 0) + r.qty;
                        shiftComponentTotals[r.shift] = (shiftComponentTotals[r.shift] || 0) + r.componentQty;
                      });

                      const rows = [];
                      hourlyData.forEach((row, idx) => {
                        const isFirstInShift = idx === 0 || hourlyData[idx - 1].shift !== row.shift;
                        const isLastInShift  = idx === hourlyData.length - 1 || hourlyData[idx + 1].shift !== row.shift;
                        const shiftBg = row.shift === "Shift 1" ? "bg-blue-50/20"
                          : row.shift === "Shift 2" ? "bg-violet-50/20"
                          : row.shift === "Shift 3" ? "bg-amber-50/20" : "";

                        rows.push(
                          <tr key={row.key} className={`hover:bg-blue-50/50 transition-colors text-center ${shiftBg}`}>
                            {/* Shift badge — first row of group only */}
                            <td className="px-3 py-2 border-b border-slate-100 text-center">
                              {isFirstInShift && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                  row.shift === "Shift 1" ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : row.shift === "Shift 2" ? "bg-violet-50 text-violet-700 border-violet-200"
                                  : row.shift === "Shift 3" ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}>{row.shift}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 font-mono font-semibold text-slate-700">{row.label}</td>
                            <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600 font-mono">{row.qty}</td>
                            <td className="px-3 py-2 border-b border-slate-100 font-bold text-violet-600 font-mono">
                              {row.componentQty !== row.qty ? row.componentQty : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-emerald-600 font-semibold">{row.prodCount}</td>
                            <td className="px-3 py-2 border-b border-slate-100 font-bold text-amber-600">{row.downtimeCount}</td>
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-rose-500">{secsToMMSS(row.downtimeSecs)}</td>
                            <td className="px-3 py-2 border-b border-slate-100 text-center font-bold text-violet-600 font-mono">{row.models.size}</td>
                            {/* Total Part Count — show only on last row of each shift */}
                            <td className="px-3 py-2 border-b border-slate-100 text-center">
                              {isLastInShift ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold font-mono shadow-sm">
                                    {shiftTotals[row.shift].toLocaleString()}
                                  </span>
                                  {shiftComponentTotals[row.shift] !== shiftTotals[row.shift] && (
                                    <span className="text-[9px] font-semibold text-violet-600">
                                      {shiftComponentTotals[row.shift].toLocaleString()} comp
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );

                        // Shift subtotal separator row
                        if (isLastInShift) {
                          rows.push(
                            <tr key={`sub_${row.shift}`} className={`text-center font-bold text-[11px] ${
                              row.shift === "Shift 1" ? "bg-blue-100/60"
                              : row.shift === "Shift 2" ? "bg-violet-100/60"
                              : row.shift === "Shift 3" ? "bg-amber-100/60"
                              : "bg-slate-100"
                            }`}>
                              <td colSpan={2} className="px-3 py-1.5 border-b-2 border-slate-300 text-left text-slate-600 italic text-[10px]">
                                {row.shift} — Subtotal
                              </td>
                              <td className="px-3 py-1.5 border-b-2 border-slate-300 text-blue-700">{shiftTotals[row.shift]}</td>
                              <td className="px-3 py-1.5 border-b-2 border-slate-300 text-violet-700">
                                {shiftComponentTotals[row.shift] !== shiftTotals[row.shift] ? shiftComponentTotals[row.shift] : "—"}
                              </td>
                              <td className="px-3 py-1.5 border-b-2 border-slate-300 text-emerald-700">
                                {hourlyData.filter(r => r.shift === row.shift).reduce((s,r) => s + r.prodCount, 0)}
                              </td>
                              <td className="px-3 py-1.5 border-b-2 border-slate-300 text-amber-700">
                                {hourlyData.filter(r => r.shift === row.shift).reduce((s,r) => s + r.downtimeCount, 0)}
                              </td>
                              <td className="px-3 py-1.5 border-b-2 border-slate-300 text-rose-600 font-mono">
                                {secsToMMSS(hourlyData.filter(r => r.shift === row.shift).reduce((s,r) => s + r.downtimeSecs, 0))}
                              </td>
                              <td colSpan={2} className="px-3 py-1.5 border-b-2 border-slate-300" />
                            </tr>
                          );
                        }
                      });
                      return rows;
                    })() : (
                      <tr><td colSpan={9} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-300">
                          <PackageOpen className="w-8 h-8 opacity-50" strokeWidth={1.2} />
                          <p className="text-xs text-slate-400">No data. Run a query.</p>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                  {hourlyData.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10">
                      <tr className="bg-slate-200 font-bold text-center text-[11px]">
                        <td className="px-3 py-2 border-t-2 border-slate-400" />
                        <td className="px-3 py-2 border-t-2 border-slate-400 text-slate-700">Grand Total</td>
                        <td className="px-3 py-2 border-t-2 border-slate-400 text-blue-700 font-mono">{totalQty}</td>
                        <td className="px-3 py-2 border-t-2 border-slate-400 text-violet-700 font-mono">
                          {(() => { const tot = hourlyData.reduce((s,r)=>s+r.componentQty,0); return tot !== totalQty ? tot.toLocaleString() : "—"; })()}
                        </td>
                        <td className="px-3 py-2 border-t-2 border-slate-400 text-emerald-700">{hourlyData.reduce((s,r)=>s+r.prodCount,0)}</td>
                        <td className="px-3 py-2 border-t-2 border-slate-400 text-amber-700">{hourlyData.reduce((s,r)=>s+r.downtimeCount,0)}</td>
                        <td className="px-3 py-2 border-t-2 border-slate-400 text-rose-600 font-mono">{secsToMMSS(hourlyData.reduce((s,r)=>s+r.downtimeSecs,0))}</td>
                        <td className="px-3 py-2 border-t-2 border-slate-400" />
                        <td className="px-3 py-2 border-t-2 border-slate-400">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-700 text-white text-[11px] font-bold font-mono">
                            {totalQty.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Hourly Trend
                </span>
              </div>
              <div className="p-4 h-[40vh] min-h-[280px]">
                {chartData ? (
                  <Bar data={chartData.data} options={chartData.options} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                    <BarChart2 className="w-8 h-8 opacity-50" strokeWidth={1.2} />
                    <p className="text-xs text-slate-400">No chart data. Run a query.</p>
                  </div>
                )}
              </div>
            </div>
          {partsMatrix.parts.length > 0 && (
            <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">

              {/* ── MODEL-WISE HOURLY BREAKDOWN — with scroll ── */}
              <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <List className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Model-wise Hourly Breakdown
                  </span>
                  <span className="text-[10px] text-slate-300 ml-1">· Units per model variant</span>
                  <span className="ml-auto text-[10px] text-slate-400">
                    {partsMatrix.parts.length} model{partsMatrix.parts.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Fixed height — same as hourly table (~1 shift) */}
                <div className="overflow-auto" style={{ maxHeight: "420px" }}>
                  <table className="min-w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-slate-500 border-b border-slate-200 w-24">Time</th>
                        <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-slate-500 border-b border-slate-200">Model Name</th>
                        <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-slate-500 border-b border-slate-200 w-24">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyData.flatMap(row =>
                        [...row.models.entries()]
                          .sort((a, b) => b[1].qty - a[1].qty)
                          .map(([name, info], idx) => (
                            <tr key={`${row.key}-${name}`}
                              className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-2.5 text-center border-b border-slate-100">
                                {idx === 0 ? (
                                  <span className="text-[13px] font-semibold text-slate-500">{row.label}</span>
                                ) : null}
                              </td>
                              <td className="px-5 py-2.5 text-center border-b border-slate-100">
                                {info.matched ? (
                                  <span className="text-[12px] font-medium text-slate-700">{name}</span>
                                ) : (
                                  <span className="text-[12px] font-mono text-slate-500">{name}</span>
                                )}
                              </td>
                              <td className="px-5 py-2.5 text-center border-b border-slate-100">
                                <span className="text-[14px] font-bold text-blue-600">{info.qty}</span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── PART NAME TOTAL COUNT ── */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Part Total Count
                  </span>
                  <span className="ml-auto text-[10px] font-bold text-blue-600">
                    {partsMatrix.parts.reduce((s, [, i]) => s + i.total, 0)} total
                  </span>
                </div>
                {/* Fixed height — matches breakdown section */}
                <div className="overflow-auto" style={{ maxHeight: "420px" }}>
                  <table className="min-w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 border-b border-slate-200">Part Name</th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-slate-500 border-b border-slate-200 w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partsMatrix.parts.map(([name, info], idx) => (
                        <tr key={name}
                          className={`transition-colors ${info.matched ? "hover:bg-emerald-50/30" : "hover:bg-rose-50/20"} ${idx % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                          <td className="px-4 py-2.5 border-b border-slate-100">
                            {info.matched ? (
                              <span className="text-[12px] font-semibold text-emerald-700 leading-snug block">{name}</span>
                            ) : (
                              <div>
                                <span className="text-[11px] font-mono text-slate-600 leading-snug block">{name}</span>
                                <span className="text-[9px] font-bold text-rose-500">⚠ Master not exist</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 border-b border-slate-100 text-center">
                            <span className="text-[14px] font-bold font-mono text-blue-600">{info.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Footer total */}
                    <tfoot className="sticky bottom-0">
                      <tr className="bg-slate-100 font-bold">
                        <td className="px-4 py-2 border-t-2 border-slate-300 text-[11px] text-slate-600">Total</td>
                        <td className="px-4 py-2 border-t-2 border-slate-300 text-center">
                          <span className="text-[13px] font-bold font-mono text-blue-700">
                            {partsMatrix.parts.reduce((s, [, i]) => s + i.total, 0)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>

            {/* ── PART COUNT CHART — full width below the two columns ── */}
            {partCountChart && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Part Count Chart
                  </span>
                  <div className="ml-auto flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block bg-emerald-500" /> Master matched
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block bg-rose-400" /> Not in master
                    </span>
                  </div>
                </div>
                {/* Height scales with number of parts (44px per bar, min 200px) */}
                <div className="p-4" style={{ height: Math.max(200, partsMatrix.parts.length * 44) }}>
                  <Bar data={partCountChart.data} options={partCountChart.options} />
                </div>
              </div>
            )}
            </>
          )}
        </div>
        )}

        {/* ── RAW DATA VERIFICATION ── */}
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
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{r._fetchDate}</td>
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

export default PartProcessHourlyReport;
