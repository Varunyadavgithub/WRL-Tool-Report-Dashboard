import { useState, useEffect, useCallback, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement, PointElement, CategoryScale,
  LinearScale, Tooltip, Legend, Filler,
} from "chart.js";
import {
  RefreshCw, Calendar, Loader2, Cpu, Zap, TimerOff,
  CheckCircle2, AlertTriangle, BarChart2, Activity,
  ChevronLeft, ChevronRight, Download, PackageOpen,
  Gauge, Layers, Wifi, LockOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import axios from "axios";
import fosClient, {
  FACTORY_OS_BASE, FACTORY_MACHINE_ID,
  PART_PROCESS_API,
} from "../../utils/factoryOsClient";
import {
  extractSapCode, extractProgramName, getMaterialByModel,
  selectMaterials,
} from "../../redux/slices/masterConfigSlice";

// Re-export so Dashboard / ProductionReport can still import from this file
export { FACTORY_OS_BASE, FACTORY_MACHINE_ID };

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

// ── Helpers ────────────────────────────────────────────────────────────────────
const parseDur = (d = "00:00:00") => {
  const [h, m, s] = (d || "00:00:00").split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};
const p2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const oeeTextCls  = (v) => v >= 85 ? "text-emerald-600" : v >= 65 ? "text-amber-600" : "text-rose-500";
const oeeBgCls    = (v) => v >= 85 ? "bg-emerald-50 border-emerald-200" : v >= 65 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200";
const oeeHexColor = (v) => v >= 85 ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

// ── Map FactoryOS record → internal model ──────────────────────────────────────
export const mapFOsRecord = (r, idx) => {
  const rawBarcode  = r.barcode || r.model_name || null;
  // Step 1: Extract program name from "% O<num>(<program>)" format
  //   "% O0001(1130596-C-OUTER-BTM-FLT-875H-NEW)" → "1130596-C-OUTER-BTM-FLT-875H-NEW"
  //   "% O9030(NCT-FJOB-A-5B)  (AMNC-F-JOB)"      → "NCT-FJOB-A-5B"
  const programName = extractProgramName(rawBarcode);
  // Step 2: Extract SAP Code from the clean program name
  //   "1130596-C-OUTER-BTM-FLT-875H-NEW" → "1130596"
  const sapCode     = extractSapCode(programName);
  return {
    srNo:           idx + 1,
    id:             r.id,
    eventId:        r.event_id,
    shift:          r.shift?.shift_name || "—",
    state:          r.event_type,       // "Production" | "Downtime"
    model:          programName,        // clean program name (inside parentheses)
    rawBarcode:     rawBarcode,         // original machine string e.g. "% O0001(...)"
    sapCode:        sapCode,            // extracted SAP Code for master lookup
    startTime:      r.start_time,
    endTime:        r.end_time,
    duration:       r.duration,
    qty:            r.parts_quantity,
    quality:        r.parts_quality,
    operator:       r.operator_name || null,
    downtimeReason: r.downtime_reason || null,
    // Extra fields
    assetName:      r.asset_name,
    lineName:       r.line_name,
    energy:         r.energy ?? 0,
    m30Counter:     r.process_parameters?.M30counter ?? null,
    downtimeComment: r.downtime_comment || null,
    modifiedAt:     r.modified_at,
    partQuality:    r.part_quality,
  };
};

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;

const EventBadge = ({ type }) =>
  type === "Production" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" /> Production
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <TimerOff className="w-3 h-3" /> Downtime
    </span>
  );

// ── KPI Card ───────────────────────────────────────────────────────────────────
const KCard = ({ icon: Icon, label, value, sub, color, extra }) => (
  <div className={`bg-white rounded-xl border shadow-sm p-4 ${color ?? "border-slate-200"}`}>
    <div className="flex items-center justify-between mb-2">
      <div className={`p-2 rounded-lg ${color ? "bg-white/60" : "bg-slate-50"}`}>
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      {extra}
    </div>
    <p className="text-xl font-bold font-mono text-slate-800">{value}</p>
    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-slate-300 mt-0.5">{sub}</p>}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const FactoryMonitor = () => {
  const materials = useSelector(selectMaterials);

  // Resolve part info from any input (raw barcode or already-clean program name):
  //   "% O0001(1130596-C-OUTER-BTM-FLT-875H-NEW)" or "1130596-C-OUTER-BTM-FLT-875H-NEW"
  //   → extractProgramName → extractSapCode → exact master lookup
  const getMat = (input) => {
    if (!input) return null;
    const prog = extractProgramName(input) || input; // handles "% O..." or already-clean names
    return getMaterialByModel(materials, prog);
  };

  // ── DB Sync Status ────────────────────────────────────────────────────────
  const [syncInfo,    setSyncInfo]    = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const _ldate = (d) => { const p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  const [manualStart, setManualStart] = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return _ldate(d); });
  const [manualEnd,   setManualEnd]   = useState(() => _ldate(new Date()));

  const fetchSyncStatus = async () => {
    try {
      const res = await axios.get(`${PART_PROCESS_API}/sync-status`, { withCredentials: true });
      setSyncInfo(res.data);
    } catch { /* silent */ }
  };

  const triggerManualSync = async () => {
    if (syncLoading) return;
    setSyncLoading(true);
    try {
      await axios.post(`${PART_PROCESS_API}/sync`, {}, {
        params: { startDate: manualStart, endDate: manualEnd },
        withCredentials: true,
      });
      toast.success(`Sync started: ${manualStart} → ${manualEnd}`);
      // Poll status every 3s while running
      const poll = setInterval(async () => {
        const res = await axios.get(`${PART_PROCESS_API}/sync-status`, { withCredentials: true });
        setSyncInfo(res.data);
        if (!res.data?.sync?.running) { clearInterval(poll); setSyncLoading(false); }
      }, 3000);
    } catch (e) {
      toast.error("Sync trigger failed"); setSyncLoading(false);
    }
  };

  // Load sync status on mount
  useEffect(() => { fetchSyncStatus(); }, []);

  const [date, setDate]               = useState(todayStr());
  const [pageRecords, setPageRecords] = useState([]);
  const [allRecords, setAllRecords]   = useState([]);
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [hasNext, setHasNext]         = useState(false);
  const [hasPrev, setHasPrev]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [loadingAll, setLoadingAll]   = useState(false);
  const [allLoaded, setAllLoaded]     = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [assetInfo, setAssetInfo]     = useState(null);
  const [shiftFilter, setShiftFilter] = useState("");
  // Auth is handled by the backend proxy — always "ok" from the frontend's view
  const [authStatus, setAuthStatus]   = useState("ok");

  // Which records to use for analysis
  const activeRaw = allLoaded ? allRecords : pageRecords;
  const totalPages = Math.ceil(total / 10);

  // Auth is handled server-side — no client-side token management needed.

  // ── Fetch single page ────────────────────────────────────────────────────
  const fetchPage = useCallback(async (pg, dt) => {
    setLoading(true);
    try {
      const url = `${FACTORY_OS_BASE}/monitoring/daily-summary/${FACTORY_MACHINE_ID}/?date=${dt}&page=${pg}`;
      const res = await fosClient.get(url);   // ← authenticated
      const d   = res.data;
      setPageRecords(d.results || []);
      setTotal(d.count || 0);
      setHasNext(!!d.next);
      setHasPrev(!!d.previous);
      setPage(pg);
      setAllLoaded(false);
      if (d.results?.[0] && !assetInfo) {
        const r = d.results[0];
        setAssetInfo({ asset: r.asset_name, line: r.line_name, plant: r.plant_name, company: r.company_name });
      }
    } catch (err) {
      toast.error(err.response?.status === 401
        ? "Session expired — please re-login to WRL Dashboard."
        : "Failed to fetch data from FactoryOS proxy.");
    } finally { setLoading(false); }
  }, [assetInfo, authStatus]);

  // ── Fetch all pages ──────────────────────────────────────────────────────
  const fetchAll = useCallback(async (dt) => {
    setLoadingAll(true);
    const all = [];
    let url = `${FACTORY_OS_BASE}/monitoring/daily-summary/${FACTORY_MACHINE_ID}/?date=${dt}&page=1`;
    try {
      while (url) {
        const res = await fosClient.get(url);  // ← authenticated
        all.push(...(res.data.results || []));
        url = res.data.next || null;
        if (all.length >= 5000) { toast("Safety cap: 5000 records."); break; }
      }
      setAllRecords(all);
      setAllLoaded(true);
      if (all[0] && !assetInfo) {
        const r = all[0];
        setAssetInfo({ asset: r.asset_name, line: r.line_name, plant: r.plant_name, company: r.company_name });
      }
      toast.success(`All ${all.length} records loaded.`);
    } catch (err) {
      if (err.response?.status === 401) setAuthStatus("failed");
      toast.error("Failed to load all pages.");
    } finally { setLoadingAll(false); }
  }, [assetInfo]);

  // Auto-load page 1 on date change (only when auth is ready)
  useEffect(() => {
    if (authStatus === "ok") fetchPage(1, date);
  }, [date, authStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchPage(page, date), 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, page, date]);

  // ── Apply shift filter ───────────────────────────────────────────────────
  const filtered = useMemo(() =>
    shiftFilter ? activeRaw.filter(r => r.shift?.shift_name === shiftFilter) : activeRaw,
    [activeRaw, shiftFilter]
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const prod = filtered.filter(r => r.event_type === "Production");
    const down = filtered.filter(r => r.event_type === "Downtime");
    const totalQty   = prod.reduce((s, r) => s + (r.parts_quantity || 0), 0);
    const goodQty    = prod.filter(r => r.parts_quality === "GOOD").reduce((s, r) => s + (r.parts_quantity || 0), 0);
    const downSecs   = down.reduce((s, r) => s + parseDur(r.duration), 0);
    const totalSecs  = filtered.reduce((s, r) => s + parseDur(r.duration), 0);
    const totalEnergy = filtered.reduce((s, r) => s + (r.energy || 0), 0);
    const avgCycle   = prod.length > 0
      ? prod.reduce((s, r) => s + parseDur(r.duration), 0) / prod.length : 45;
    const A   = totalSecs > 0 ? Math.min(100, ((totalSecs - downSecs) / totalSecs) * 100) : 0;
    const runS = Math.max(0, totalSecs - downSecs);
    const P   = runS > 0 ? Math.min(100, (totalQty * avgCycle / runS) * 100) : 0;
    const Q   = totalQty > 0 ? Math.min(100, (goodQty / totalQty) * 100) : 100;
    const oee = Math.round((A / 100) * (P / 100) * (Q / 100) * 100 * 10) / 10;
    // Distinct programs from barcode
    const programs = [...new Set(prod.filter(r => r.barcode).map(r => r.barcode))];
    // Shift groups
    const shifts = [...new Set(filtered.map(r => r.shift?.shift_name).filter(Boolean))];
    return {
      totalQty, goodQty, rejects: totalQty - goodQty,
      downCount: down.length, downMins: Math.round(downSecs / 60),
      oee, A: Math.round(A * 10) / 10, P: Math.round(P * 10) / 10, Q: Math.round(Q * 10) / 10,
      avgCycleS: Math.round(avgCycle),
      totalEnergy: Math.round(totalEnergy * 100) / 100,
      pending: down.filter(r => !r.downtime_reason).length,
      prodCount: prod.length,
      programs, shifts,
    };
  }, [filtered]);

  // ── OEE time-series ───────────────────────────────────────────────────────
  const oeeTS = useMemo(() => {
    if (!filtered.length) return { labels: [], oee: [], a: [], p: [], q: [] };
    const toM = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const times = filtered.filter(r => r.start_time).map(r => toM(r.start_time));
    const s0 = Math.min(...times), s1 = Math.max(...times, s0 + 60);
    const labels = [], oeeA = [], aA = [], pA = [], qA = [];
    for (let t = s0; t <= s1; t += 30) {
      labels.push(`${p2(Math.floor(t / 60))}:${p2(t % 60)}`);
      const up  = filtered.filter(r => r.start_time && toM(r.start_time) <= t);
      if (!up.length) { oeeA.push(0); aA.push(0); pA.push(0); qA.push(100); continue; }
      const pr  = up.filter(r => r.event_type === "Production");
      const dn  = up.filter(r => r.event_type === "Downtime");
      const qty = pr.reduce((s, r) => s + (r.parts_quantity || 0), 0);
      const good = pr.filter(r => r.parts_quality === "GOOD").reduce((s, r) => s + (r.parts_quantity || 0), 0);
      const dS  = dn.reduce((s, r) => s + parseDur(r.duration), 0);
      const eS  = Math.max((t - s0) * 60, 1);
      const A   = Math.max(0, Math.min(100, ((eS - dS) / eS) * 100));
      const rS  = Math.max(0, eS - dS);
      const P   = rS > 0 ? Math.min(100, (qty * 45 / rS) * 100) : 0;
      const Q   = qty > 0 ? Math.min(100, (good / qty) * 100) : 100;
      oeeA.push(Math.round((A / 100) * (P / 100) * (Q / 100) * 100 * 10) / 10);
      aA.push(Math.round(A * 10) / 10); pA.push(Math.round(P * 10) / 10); qA.push(Math.round(Q * 10) / 10);
    }
    return { labels, oee: oeeA, a: aA, p: pA, q: qA };
  }, [filtered]);

  const lineData = useMemo(() => ({
    labels: oeeTS.labels,
    datasets: [
      { label: "OEE",         data: oeeTS.oee, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.12)", fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
      { label: "Availability",data: oeeTS.a,   borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.06)",  fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
      { label: "Performance", data: oeeTS.p,   borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.06)", fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
      { label: "Quality",     data: oeeTS.q,   borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.06)", fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
    ],
  }), [oeeTS]);

  const lineOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "top", align: "center", labels: { usePointStyle: true, pointStyle: "circle", font: { size: 11 }, padding: 18, color: "#475569" } },
      tooltip: { backgroundColor: "#fff", titleColor: "#374151", bodyColor: "#374151", borderColor: "#e5e7eb", borderWidth: 1, callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` } },
    },
    scales: {
      x: { grid: { color: "rgba(148,163,184,0.1)" }, ticks: { font: { size: 10 }, color: "#94a3b8", maxTicksLimit: 14 } },
      y: { beginAtZero: true, max: 110, grid: { color: "rgba(148,163,184,0.08)" }, ticks: { font: { size: 10 }, color: "#94a3b8", stepSize: 20, callback: (v) => v + "%" } },
    },
  }), []);

  const exportCSV = () => {
    const H = ["Event ID","Shift","Type","Barcode / Program","Start","End","Duration","Qty","Quality","M30Counter","Operator","DT Reason","DT Comment","Energy (Wh)","Modified At"];
    const csv = [H.join(","), ...filtered.map(r =>
      [r.event_id, r.shift?.shift_name, r.event_type,
       `"${(r.barcode||"").replace(/"/g,'""')}"`,
       r.start_time, r.end_time, r.duration,
       r.parts_quantity, r.parts_quality,
       r.process_parameters?.M30counter ?? "—",
       r.operator_name || "—", r.downtime_reason || "—",
       r.downtime_comment || "—", r.energy, r.modified_at].join(",")
    )].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `monitor_${date}.csv`; a.click();
  };

  const shifts = [...new Set((allLoaded ? allRecords : pageRecords).map(r => r.shift?.shift_name).filter(Boolean))];

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
        {/* Asset banner */}
        <div className="flex items-center gap-4 px-5 py-2 bg-slate-800 text-white text-[11px] flex-wrap">
          <div className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-cyan-400" /><span className="font-bold text-cyan-400">{assetInfo?.asset || "Amada"}</span></div>
          <span className="text-slate-500">|</span>
          <span>Line: <strong className="text-slate-200">{assetInfo?.line || "Freezer"}</strong></span>
          <span className="text-slate-500">|</span>
          <span>Plant: <strong className="text-slate-200">{assetInfo?.plant || "—"}</strong></span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{assetInfo?.company || "Western Refrigeration"}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
              <LockOpen className="w-3 h-3" /> Server-side JWT Proxy
            </span>
            <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Wifi className="w-3 h-3" /> FactoryOS API
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setAllLoaded(false); }}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          {/* Shift filter */}
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          >
            <option value="">All Shifts</option>
            {shifts.map((s) => <option key={s}>{s}</option>)}
          </select>

          {/* Load All */}
          <button
            onClick={() => fetchAll(date)}
            disabled={loadingAll || allLoaded}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              allLoaded ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : loadingAll ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            {loadingAll ? <><Spinner /> Loading all…</> : allLoaded ? <><CheckCircle2 className="w-3.5 h-3.5" /> All {allRecords.length} loaded</> : <><Layers className="w-3.5 h-3.5" /> Load All Pages</>}
          </button>

          {/* Auto-refresh */}
          <label className="flex items-center gap-2 cursor-pointer ml-1">
            <div
              onClick={() => setAutoRefresh(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${autoRefresh ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoRefresh ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Auto (60s)</span>
          </label>

          {/* Refresh */}
          <button onClick={() => fetchPage(page, date)} disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all ml-1">
            {loading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
          </button>

          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors ml-auto">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>

        {/* Summary bar */}
        {total > 0 && (
          <div className="flex items-center gap-4 px-5 pb-2 text-[11px] text-slate-500">
            <span>Total: <strong className="text-slate-700">{total}</strong> records</span>
            <span className="text-slate-300">·</span>
            <span>Showing: <strong>{allLoaded ? `all ${filtered.length}` : `page ${page}/${totalPages} (${filtered.length})`}</strong></span>
            {kpi.pending > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                <AlertTriangle className="w-3 h-3" /> {kpi.pending} pending downtime
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">

        {/* ── DB SYNC STATUS PANEL ── */}
        <div className={`rounded-xl border shadow-sm p-4 shrink-0 ${
          syncInfo?.sync?.running ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${syncInfo?.sync?.running ? "bg-blue-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                {syncInfo?.sync?.running
                  ? `Syncing ${syncInfo.sync.phase} — ${syncInfo.sync.currentDate || "..."} (${syncInfo.sync.doneCount}/${syncInfo.sync.totalDates})`
                  : "DB Sync Status"}
              </span>
              {syncInfo?.overall && (
                <span className="text-[10px] text-slate-400">
                  · {syncInfo.overall.TotalRecords?.toLocaleString()} records · {syncInfo.overall.EarliestDate} → {syncInfo.overall.LatestDate}
                </span>
              )}
            </div>

            {/* Progress bar when running */}
            {syncInfo?.sync?.running && syncInfo.sync.totalDates > 0 && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex justify-between text-[10px] text-blue-600 mb-1">
                  <span>{syncInfo.sync.recordsSaved?.toLocaleString()} records saved</span>
                  <span>{Math.round((syncInfo.sync.doneCount / syncInfo.sync.totalDates) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((syncInfo.sync.doneCount / syncInfo.sync.totalDates) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Manual sync controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={manualStart} onChange={e => setManualStart(e.target.value)}
                className="text-[11px] px-2 py-1 rounded border border-slate-200 focus:outline-none focus:border-blue-400" />
              <span className="text-[10px] text-slate-400">→</span>
              <input type="date" value={manualEnd} onChange={e => setManualEnd(e.target.value)}
                className="text-[11px] px-2 py-1 rounded border border-slate-200 focus:outline-none focus:border-blue-400" />
              <button
                onClick={triggerManualSync}
                disabled={syncLoading || syncInfo?.sync?.running}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                  syncLoading || syncInfo?.sync?.running
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                }`}
              >
                {syncLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {syncLoading ? "Syncing..." : "Sync Range"}
              </button>
              <button onClick={fetchSyncStatus}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all" title="Refresh status">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Last 7 days quick stats */}
          {syncInfo?.last7?.length > 0 && !syncInfo?.sync?.running && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {syncInfo.last7.map(d => (
                <div key={d.EventDate} className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-center min-w-[90px]">
                  <p className="text-[10px] font-mono text-slate-500">{d.EventDate}</p>
                  <p className="text-sm font-bold text-blue-600 font-mono">{d.TotalRecords}</p>
                  <p className="text-[9px] text-slate-400">{d.TotalQty} parts</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <KCard icon={PackageOpen} label="Parts Produced" value={kpi.totalQty.toLocaleString()}
            sub={`${kpi.prodCount} events`} />
          <KCard icon={CheckCircle2} label="Good Quality"  value={kpi.goodQty.toLocaleString()}
            sub={kpi.totalQty > 0 ? `${((kpi.goodQty/kpi.totalQty)*100).toFixed(1)}% pass` : "—"}
            color="border-emerald-200" />
          <KCard icon={TimerOff}     label="Downtime"      value={`${kpi.downMins} min`}
            sub={`${kpi.downCount} events · ${kpi.pending} unassigned`}
            color="border-amber-200" />
          {/* OEE card with ring */}
          <div className={`bg-white rounded-xl border shadow-sm p-4 ${oeeBgCls(kpi.oee)}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5"><Gauge className="w-4 h-4 text-slate-500" /><span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">OEE</span></div>
              <span className={`text-xl font-bold font-mono ${oeeTextCls(kpi.oee)}`}>{kpi.oee}%</span>
            </div>
            <div className="flex gap-2 text-[10px] mt-2">
              {[["A", kpi.A, "#22c55e"], ["P", kpi.P, "#f59e0b"], ["Q", kpi.Q, "#a78bfa"]].map(([k, v, c]) => (
                <div key={k} className="flex-1 flex flex-col gap-0.5">
                  <div className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-bold font-mono" style={{ color: c }}>{v}%</span></div>
                  <div className="h-1 bg-slate-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: c }} /></div>
                </div>
              ))}
            </div>
          </div>
          <KCard icon={Zap} label="Energy (Wh)" value={kpi.totalEnergy.toFixed(1)}
            sub={`Avg cycle: ${kpi.avgCycleS}s`} color="border-blue-200" />
        </div>

        {/* OEE Chart + Program summary */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {/* OEE Line Chart */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">OEE</span>
              <span className={`text-xs font-bold font-mono ${oeeTextCls(kpi.oee)}`}>
                A:{kpi.A}% · P:{kpi.P}% · Q:{kpi.Q}% → OEE:{kpi.oee}%
              </span>
            </div>
            <div className="p-4 h-52">
              {oeeTS.labels.length > 1 ? (
                <Line data={lineData} options={lineOpts} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                  {loading ? <Spinner cls="w-6 h-6 text-blue-400" /> : <><BarChart2 className="w-8 h-8 opacity-40" strokeWidth={1.2} /><p className="text-xs text-slate-400">No data for this date</p></>}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Program summary + Shift breakdown */}
          <div className="flex flex-col gap-3">
            {/* Programs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Programs Running</span>
                <span className="ml-auto text-[10px] text-slate-400">{kpi.programs.length} distinct</span>
              </div>
              <div className="p-3 flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                {kpi.programs.length > 0 ? kpi.programs.map((prog, i) => {
                  const cnt = filtered.filter(r => r.barcode === prog && r.event_type === "Production").reduce((s,r) => s + (r.parts_quantity||0), 0);
                  const cleanProg = extractProgramName(prog); // extract from "% O<n>(<name>)"
                  const sap = extractSapCode(cleanProg);
                  const mat = getMat(cleanProg);
                  return (
                    <div key={i} className={`flex items-start justify-between gap-2 p-2 rounded-lg transition-colors ${mat ? "hover:bg-emerald-50" : "hover:bg-slate-50"}`}>
                      <div className="flex-1 min-w-0" title={prog}>
                        {mat ? (
                          <>
                            <p className="text-[11px] font-bold text-emerald-700 leading-snug">{mat.partName}</p>
                            <p className="text-[9px] font-mono text-slate-400">{sap} · {cleanProg}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] font-mono text-slate-600 leading-snug">{cleanProg}</p>
                            <p className="text-[9px] font-bold text-rose-500">⚠ Master not exist</p>
                          </>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-blue-600 font-mono">{cnt}</span>
                        {mat && (
                          <p className="text-[9px] font-mono text-slate-400">{sap}</p>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex items-center justify-center py-6 text-slate-300">
                    <p className="text-xs">No program data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shift summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                <Layers className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Shift Summary</span>
              </div>
              <div className="p-3 flex flex-col divide-y divide-slate-100">
                {kpi.shifts.length > 0 ? kpi.shifts.map((sh) => {
                  const shR = filtered.filter(r => r.shift?.shift_name === sh);
                  const qty = shR.filter(r => r.event_type === "Production").reduce((s,r) => s + (r.parts_quantity||0), 0);
                  const dCount = shR.filter(r => r.event_type === "Downtime").length;
                  return (
                    <div key={sh} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-semibold text-slate-700">{sh}</span>
                      <div className="flex gap-3">
                        <span className="font-bold text-blue-600 font-mono">{qty} qty</span>
                        {dCount > 0 && <span className="text-amber-600 font-semibold">{dCount} DT</span>}
                      </div>
                    </div>
                  );
                }) : <p className="text-xs text-slate-300 py-3 text-center">No shift data</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <PackageOpen className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Events Feed</span>
              <span className="text-[10px] text-slate-400">· {filtered.length} records</span>
              {!allLoaded && total > 10 && (
                <span className="text-[10px] text-amber-600 font-semibold">· {total} total (page {page}/{totalPages})</span>
              )}
            </div>
            {/* Pagination (visible when not all loaded) */}
            {!allLoaded && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => fetchPage(page - 1, date)} disabled={!hasPrev || loading}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <span className="text-[11px] text-slate-500 font-mono min-w-[60px] text-center">
                  {page} / {totalPages}
                </span>
                <button onClick={() => fetchPage(page + 1, date)} disabled={!hasNext || loading}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            )}
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  {["#","Event ID","Shift","Type","Part Name / Program","Start","End","Duration","Qty","Quality","M30 Counter","Operator","DT Reason","Energy (Wh)","Modified"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={15} className="py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-slate-400">
                      <Spinner cls="w-5 h-5 text-blue-500" /><span>Fetching data…</span>
                    </div>
                  </td></tr>
                ) : filtered.length > 0 ? filtered.map((r, idx) => {
                  const isPending = r.event_type === "Downtime" && !r.downtime_reason;
                  return (
                    <tr key={r.id || idx}
                      className={`transition-colors ${isPending ? "bg-amber-50/60 hover:bg-amber-50" : r.event_type === "Downtime" ? "bg-slate-50/60 hover:bg-slate-100/60" : "hover:bg-blue-50/30"} even:bg-slate-50/20`}>
                      <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-[11px] text-slate-500 whitespace-nowrap">{r.event_id}</td>
                      <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{r.shift?.shift_name}</span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100"><EventBadge type={r.event_type} /></td>
                      <td className="px-3 py-2 border-b border-slate-100 max-w-[240px]">
                        {/* r.barcode is the raw API field in FactoryMonitor (raw records, not mapped) */}
                        {r.barcode ? (() => {
                          const cleanProg = extractProgramName(r.barcode); // e.g. "1130596-C-OUTER-BTM-FLT-875H-NEW"
                          const sap       = extractSapCode(cleanProg);
                          const mat       = getMat(cleanProg);
                          return mat ? (
                            <div title={r.barcode}>
                              <p className="text-[11px] font-bold text-emerald-700 leading-snug">{mat.partName}</p>
                              <p className="text-[9px] font-mono text-slate-400">{sap} · {cleanProg}</p>
                            </div>
                          ) : (
                            <div title={r.barcode}>
                              <p className="text-[11px] font-mono text-slate-600 leading-snug">{cleanProg}</p>
                              <p className="text-[9px] font-bold text-rose-500">⚠ Master not exist</p>
                            </div>
                          );
                        })() : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{r.start_time}</td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{r.end_time}</td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">{r.duration}</td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center font-bold text-blue-600 font-mono">{r.parts_quantity}</td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        {r.parts_quality === "GOOD"
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">GOOD</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">
                        {r.process_parameters?.M30counter ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-slate-500">
                        {r.operator_name || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        {isPending ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">⚠ Unassigned</span>
                        ) : r.downtime_reason ? (
                          <span className="text-[10px] font-semibold text-slate-600">{r.downtime_reason}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">{r.energy?.toFixed(2) ?? 0}</td>
                      <td className="px-3 py-2 border-b border-slate-100 text-[10px] text-slate-400 whitespace-nowrap">{r.modified_at}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={15} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <PackageOpen className="w-8 h-8 opacity-50" strokeWidth={1.2} />
                      <p className="text-xs text-slate-400">No records for {date}</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom pagination */}
          {!allLoaded && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 shrink-0 bg-slate-50">
              <span className="text-[11px] text-slate-400">{total} total records · page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => fetchPage(1, date)} disabled={page === 1 || loading}
                  className="px-2 py-1 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 transition-colors">First</button>
                <button onClick={() => fetchPage(page - 1, date)} disabled={!hasPrev || loading}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 transition-colors"><ChevronLeft className="w-3.5 h-3.5 text-slate-500" /></button>
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button key={pg} onClick={() => fetchPage(pg, date)}
                      className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${pg === page ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-white text-slate-600"}`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => fetchPage(page + 1, date)} disabled={!hasNext || loading}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 transition-colors"><ChevronRight className="w-3.5 h-3.5 text-slate-500" /></button>
                <button onClick={() => fetchPage(totalPages, date)} disabled={page === totalPages || loading}
                  className="px-2 py-1 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 transition-colors">Last</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FactoryMonitor;
