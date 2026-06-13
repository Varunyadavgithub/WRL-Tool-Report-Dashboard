import { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Search, Calendar, Clock, Filter, Loader2, PackageOpen,
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets.js";

import { mapFOsRecord } from "./FactoryMonitor";
import fosClient, { FACTORY_OS_BASE, FACTORY_MACHINE_ID } from "../../utils/factoryOsClient";
import { selectMaterials, getMaterialByModel, extractSapCode, selectShifts, getShiftWindow, toMins } from "../../redux/slices/masterConfigSlice";

ChartJS.register(ArcElement, Tooltip, Legend);

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const pad = (n) => (n < 10 ? "0" + n : n);
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const todayStr   = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const extractHHMM = (t) => { if (!t) return null; const s = String(t); if (s.includes("T")) return s.split("T")[1].substring(0,5); if (s.length > 10 && s.includes(" ")) return s.split(" ")[1].substring(0,5); return s.substring(0,5); };
const offsetDate = (days) => { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;


const KpiCard = ({ icon: Icon, label, value, colorClass }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
    <div className={`p-2 rounded-lg w-fit ${colorClass}`}><Icon className="w-4 h-4" /></div>
    <p className="text-2xl font-bold text-slate-800 font-mono">{value}</p>
    <p className="text-[11px] text-slate-400 font-medium">{label}</p>
  </div>
);

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PartProcessQualityReport = () => {
  const materials    = useSelector(selectMaterials);
  const configShifts = useSelector(selectShifts).filter(s => s.status);
  const [startTime, setStartTime] = useState(`${todayStr()} 08:00`);
  const [endTime, setEndTime]     = useState(`${todayStr()} 20:00`);
  const [loading, setLoading]     = useState(false);
  const [ydayLoading, setYdayLoading]   = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(null);
  const [records, setRecords]     = useState([]);
  const [rawRecords, setRawRecords] = useState([]);
  const [showRaw, setShowRaw]     = useState(false);

  const fetchData = useCallback(async (start, end, setLoadFn) => {
    setLoadFn(true); setRecords([]); setRawRecords([]);
    try {
      const startDate = start.split(" ")[0];
      const endDate   = end.split(" ")[0];
      const startH    = (start.split(" ")[1] || "00:00").substring(0, 5);
      const endH      = (end.split(" ")[1]   || "23:59").substring(0, 5);
      const dates = [];
      const cur = new Date(startDate + "T00:00:00");
      const fin = new Date(endDate   + "T00:00:00");
      while (cur <= fin) { dates.push(`${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`); cur.setDate(cur.getDate() + 1); }
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
        raw.forEach(r => allRaw.push({ _fetchDate: date, ...r }));
        const mapped = raw.map(mapFOsRecord).filter(r => {
          const t = extractHHMM(r.startTime);
          if (!t) return false;
          if (date === startDate && date === endDate) return t >= startH && t <= endH;
          if (date === startDate) return t >= startH;
          if (date === endDate)   return t <= endH;
          return true;
        });
        allMapped.push(...mapped);
      }
      setRecords(allMapped);
      setRawRecords(allRaw);
      toast.success(`Quality data loaded — ${allMapped.length} records (${allRaw.length} raw)`);
    } catch { toast.error("Failed to fetch data."); }
    finally { setLoadFn(false); }
  }, []);

  const handleQuery     = () => { if (!startTime || !endTime) { toast.error("Please select a time range."); return; } fetchData(startTime, endTime, setLoading); };
  const handleToday     = () => { const s = `${todayStr()} 08:00`, e = `${offsetDate(1)} 08:00`; setStartTime(s); setEndTime(e); fetchData(s, e, setTodayLoading); };
  const handleYesterday = () => { const s = `${offsetDate(-1)} 08:00`, e = `${todayStr()} 08:00`; setStartTime(s); setEndTime(e); fetchData(s, e, setYdayLoading); };
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

  // Quality analysis - production records only
  const analysis = useMemo(() => {
    const prodRecords = records.filter((r) => r.state === "Production");
    const totalQty    = prodRecords.reduce((s, r) => s + (r.qty ?? 0), 0);
    const good        = prodRecords.filter((r) => r.quality === "GOOD");
    const goodQty     = good.length;
    const badQty      = prodRecords.length - goodQty;
    const passRate    = prodRecords.length > 0 ? ((goodQty / prodRecords.length) * 100).toFixed(1) : 0;

    // Model-wise quality breakdown — keyed on Part Name via SAP Code extraction
    const modelMap = {};
    prodRecords.forEach((r) => {
      const sap = r.sapCode || extractSapCode(r.model);
      const mat = getMaterialByModel(materials, r.model);
      // Display key: Part Name (master) > full program name > SAP code
      const key = mat?.partName || r.model || sap;
      if (!key) return;
      if (!modelMap[key]) modelMap[key] = { model: key, sapCode: sap, rawModel: r.model, total: 0, good: 0 };
      modelMap[key].total += 1;
      if (r.quality === "GOOD") modelMap[key].good += 1;
    });
    const modelBreakdown = Object.values(modelMap).sort((a, b) => b.total - a.total);

    // Shift-wise quality
    const shiftMap = {};
    prodRecords.forEach((r) => {
      if (!shiftMap[r.shift]) shiftMap[r.shift] = { shift: r.shift, total: 0, good: 0 };
      shiftMap[r.shift].total += 1;
      if (r.quality === "GOOD") shiftMap[r.shift].good += 1;
    });

    return { prodRecords, totalQty, goodQty, badQty, passRate, modelBreakdown, shiftBreakdown: Object.values(shiftMap) };
  }, [records, materials]);

  const donutData = useMemo(() => {
    if (!analysis.prodRecords.length) return null;
    return {
      labels: ["Good Quality", "No Quality Data"],
      datasets: [{
        data: [analysis.goodQty, analysis.badQty],
        backgroundColor: ["#22c55e", "#f43f5e"],
        borderWidth: 2, borderColor: "#fff",
      }],
    };
  }, [analysis]);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Part Process - Quality Report</h1>
          <p className="text-[11px] text-slate-400">Quality analysis from production records (GOOD / not-GOOD)</p>
        </div>
        {analysis.prodRecords.length > 0 && (
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-emerald-700">{analysis.passRate}%</span>
            <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wide">Pass Rate</span>
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
              <button onClick={handleYesterday} disabled={isAnyLoading} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 text-white"}`}>{ydayLoading ? <Spinner /> : <Calendar className="w-3.5 h-3.5" />} Yesterday</button>
              <button onClick={handleToday}     disabled={isAnyLoading} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>{todayLoading ? <Spinner /> : <Clock className="w-3.5 h-3.5" />} Today</button>
              <button onClick={handleQuery}     disabled={isAnyLoading} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}>{loading ? <Spinner /> : <Search className="w-3.5 h-3.5" />} {loading ? "Loading…" : "Query"}</button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        {analysis.prodRecords.length > 0 && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard icon={ShieldCheck}   label="Production Records"  value={analysis.prodRecords.length}  colorClass="bg-blue-50 text-blue-600"    />
            <KpiCard icon={CheckCircle2}  label="Good Quality"        value={analysis.goodQty}              colorClass="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={XCircle}       label="No Quality Data"     value={analysis.badQty}               colorClass="bg-rose-50 text-rose-500"    />
            <KpiCard icon={AlertTriangle} label="Pass Rate"           value={`${analysis.passRate}%`}       colorClass="bg-amber-50 text-amber-600"  />
          </div>
        )}

        {isAnyLoading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 py-16">
            <Spinner cls="w-5 h-5 text-blue-600" /><p className="text-sm text-slate-400">Fetching quality dataâ€¦</p>
          </div>
        )}

        {!isAnyLoading && analysis.prodRecords.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            {/* Model-wise quality table */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Model-wise Quality</span>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50">
                      {["Model","Total Records","Good Quality","Pass Rate","Shift"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.modelBreakdown.map((row, idx) => {
                      const pct = row.total > 0 ? ((row.good / row.total) * 100).toFixed(1) : 0;
                      return (
                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/40">
                          <td className="px-3 py-2 border-b border-slate-100">
                            {/* row.model is partName if master matched, else SAP/barcode */}
                            {materials.some(m => m.partName === row.model) ? (
                              <span className="font-semibold text-blue-700 text-xs">{row.model}</span>
                            ) : (
                              <div>
                                <span className="font-mono text-[11px] text-slate-600">{row.model}</span>
                                <span className="block text-[9px] font-bold text-rose-500 mt-0.5">⚠ Master not exist</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 text-center">{row.total}</td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-emerald-600 font-mono text-center">{row.good}</td>
                          <td className="px-3 py-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${parseFloat(pct) >= 95 ? "bg-emerald-500" : parseFloat(pct) >= 80 ? "bg-amber-500" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-[11px] font-bold font-mono ${parseFloat(pct) >= 95 ? "text-emerald-600" : parseFloat(pct) >= 80 ? "text-amber-600" : "text-rose-500"}`}>{pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-500 text-[11px]">
                            {analysis.shiftBreakdown.map((s) => s.shift).join(", ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Donut + Shift breakdown */}
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Quality Split</span>
                </div>
                <div className="p-4 flex flex-col items-center gap-3">
                  {donutData ? (
                    <>
                      <div className="w-40 h-40">
                        <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                      </div>
                      {donutData.labels.map((l, i) => (
                        <div key={l} className="flex items-center justify-between w-full text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: donutData.datasets[0].backgroundColor[i] }} />
                            <span className="text-slate-600">{l}</span>
                          </div>
                          <span className="font-bold text-slate-700 font-mono">{donutData.datasets[0].data[i]}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-300 py-6">
                      <ShieldCheck className="w-8 h-8 opacity-50" strokeWidth={1.2} />
                      <p className="text-xs text-slate-400">No data</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Shift breakdown */}
              {analysis.shiftBreakdown.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Shift-wise</span>
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    {analysis.shiftBreakdown.map((s) => {
                      const pct = s.total > 0 ? ((s.good / s.total) * 100).toFixed(1) : 0;
                      return (
                        <div key={s.shift} className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-700">{s.shift}</span>
                            <span className="font-bold font-mono text-emerald-600">{pct}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-slate-400">{s.good} good / {s.total} records</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isAnyLoading && analysis.prodRecords.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-12">
            <div className="flex flex-col items-center gap-2 text-slate-300">
              <PackageOpen className="w-8 h-8 opacity-50" strokeWidth={1.2} />
              <p className="text-xs text-slate-400">No data. Select filters and click Query.</p>
            </div>
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

export default PartProcessQualityReport;
