import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, RefreshCw, Loader2, ShieldCheck, Timer, ArrowRightLeft,
  LayoutDashboard, ClipboardList, AlertTriangle, Search, Factory,
  Wifi, WifiOff, Gauge, X,
} from "lucide-react";
import { usePartProcessOEE, oeeColor, p2 } from "./usePartProcessOEE";
import { isActiveShift } from "../../redux/slices/masterConfigSlice";

const RingProgress = ({ value, max, size = 84, stroke = 8, color = "#3b82f6" }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0) / max, 1);
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
};

const SummaryTile = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}1A` }}>
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-extrabold font-mono leading-tight" style={{ color }}>{value}</p>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide truncate">{label}</p>
    </div>
  </div>
);

const PartProcessOverview = () => {
  const navigate = useNavigate();
  const {
    time, shifts, loading,
    rangeMode, handleToday, handleYesterday, loadToday,
    selectedShift, setSelectedShift, isToday,
    activeOEE, activeA, activeP, activeQ, activePUnverified, activeQUnverified,
    displayGood, displayBad, passR, dMins,
    curModel, curMat, isRunning,
    coStats, shiftProgress,
  } = usePartProcessOEE();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | online | offline

  const statTiles = [
    { label: "Good Parts", value: displayGood,     color: "#0069b4" },
    { label: "NG Parts",   value: displayBad,       color: "#111827" },
    { label: "Pass Rate",  value: `${passR || 0}%`, color: passR >= 95 ? "#008236" : oeeColor(passR) },
    { label: "Downtime",   value: `${dMins || 0}m`, color: dMins > 0 ? "#ef4444" : "#111827" },
  ];

  // Scaffolding for a future multi-machine grid — each machine becomes one
  // entry here and gets its own card below, filtered by search/status.
  const machineName = curMat?.partName || curModel || "Part Process Machine";
  const machines = [
    { id: "part-process", name: machineName, model: curModel, isRunning, oee: activeOEE },
  ];

  const q = search.trim().toLowerCase();
  const filteredMachines = machines.filter((m) => {
    const matchesSearch = !q || m.name.toLowerCase().includes(q) || (m.model || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || (statusFilter === "online" ? m.isRunning : !m.isRunning);
    return matchesSearch && matchesStatus;
  });
  const showCard = filteredMachines.some((m) => m.id === "part-process");

  const summary = {
    total: machines.length,
    online: machines.filter((m) => m.isRunning).length,
    offline: machines.filter((m) => !m.isRunning).length,
    avgOEE: machines.length ? Math.round(machines.reduce((s, m) => s + m.oee, 0) / machines.length) : 0,
  };

  const statusFilters = [
    { key: "all", label: "All" },
    { key: "online", label: "Online" },
    { key: "offline", label: "Offline" },
  ];

  const hasFilters = q || statusFilter !== "all";

  return (
    <div className="h-full bg-slate-100 overflow-auto  ">
      <div className="max-w-12xl mx-auto flex flex-col gap-4  ">

        {/* ── PAGE HEADER ── */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 leading-tight">Part Process Overview</h1>
            <p className="text-xs text-slate-500">Live OEE monitoring across part-process machines</p>
          </div>
          <div className="flex-1" />
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search machine or model..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {search && (
              <button onClick={() => setSearch("")} title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {statusFilters.map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${statusFilter === f.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── SUMMARY STRIP ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3">
          <SummaryTile icon={Factory} label="Machines" value={summary.total} color="#0069b4" />
          <SummaryTile icon={Wifi} label="Online" value={summary.online} color="#059669" />
          <SummaryTile icon={WifiOff} label="Offline" value={summary.offline} color="#e11d48" />
          <SummaryTile icon={Gauge} label="Avg OEE" value={`${summary.avgOEE}%`} color={oeeColor(summary.avgOEE)} />
        </div>

        {/* ── MACHINE CARDS GRID ── */}
        <div className="flex flex-wrap gap-4 items-start p-3">
          {!showCard ? (
            <div className="w-full bg-white border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
              <Search className="w-6 h-6 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">No machines match your search</p>
              {hasFilters && (
                <button onClick={() => { setSearch(""); setStatusFilter("all"); }}
                  className="text-xs font-bold text-blue-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
          <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

            {/* ── HEADER ── */}
            <div className="p-4 pb-3 border-b border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-slate-800 leading-tight truncate">Part Process</h2>
                  <p className="text-[11px] text-slate-500 truncate">{curMat?.partName || curModel || "Production Monitoring"}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-extrabold tracking-wider ${isRunning ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-rose-500 bg-rose-50 text-rose-600"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    {isRunning ? "ONLINE" : "OFFLINE"}
                  </span>
                  <button onClick={loadToday} disabled={loading} title="Refresh data"
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-slate-200">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <button onClick={handleToday}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${rangeMode==="today" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                  Today
                </button>
                <button onClick={handleYesterday}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${rangeMode==="yesterday" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                  Yesterday
                </button>
                <div className="w-px h-3.5 bg-slate-200" />
                <button onClick={() => setSelectedShift(null)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${!selectedShift ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-600"}`}>
                  All Shifts
                </button>
                {shifts.map((s) => {
                  const active = isActiveShift(s) && isToday;
                  const selected = selectedShift?.id === s.id;
                  return (
                    <button key={s.id} onClick={() => setSelectedShift(s)}
                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${selected ? "text-white" : active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                      style={selected ? { backgroundColor: s.color || "#3b82f6" } : {}}>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {s.shiftName}
                    </button>
                  );
                })}
                <div className="ml-auto flex items-center gap-1 text-[10px] font-mono text-slate-400">
                  <Clock className="w-3 h-3" />
                  {p2(time.getHours())}:{p2(time.getMinutes())}:{p2(time.getSeconds())}
                </div>
              </div>
            </div>

            {/* ── OEE RING + A/P/Q ── */}
            <button type="button" onClick={() => navigate("/part-process/dashboard")}
              className="w-full p-4 flex items-center gap-4 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left">
              <div className="relative shrink-0">
                <RingProgress value={activeOEE} max={100} color={oeeColor(activeOEE)} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-extrabold font-mono" style={{ color: oeeColor(activeOEE) }}>{activeOEE}%</span>
                  <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">OEE</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-1.5">
                {[
                  { label: "Availability", value: activeA, unverified: false },
                  { label: "Performance",  value: activeP, unverified: activePUnverified },
                  { label: "Quality",      value: activeQ, unverified: activeQUnverified },
                ].map(({ label, value, unverified }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-xs font-bold font-mono" style={{ color: oeeColor(value) }}>
                      {value}%{unverified && <span className="text-slate-400">*</span>}
                    </span>
                    <span className="text-[8px] text-slate-400 font-semibold uppercase tracking-wide text-center leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </button>

            {/* ── SHIFT PROGRESS ── */}
            {shiftProgress && selectedShift && (
              <div className="px-4 py-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-slate-400">{selectedShift.shiftName} Progress</span>
                  <span className="flex items-center gap-1 font-bold font-mono" style={{ color: selectedShift.color || "#3b82f6" }}>
                    {shiftProgress.pct}% · <Timer className="w-2.5 h-2.5" /> {shiftProgress.remaining} left
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${shiftProgress.pct}%`, backgroundColor: selectedShift.color || "#3b82f6" }} />
                </div>
              </div>
            )}

            {/* ── STAT TILES ── */}
            <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-slate-100">
              {statTiles.map((row) => (
                <div key={row.label} className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-extrabold font-mono" style={{ color: row.color }}>{row.value}</span>
                  <span className="text-[8px] text-slate-400 font-semibold uppercase tracking-wide text-center leading-tight">{row.label}</span>
                </div>
              ))}
            </div>

            {/* ── CHANGEOVERS ── */}
            {coStats.count > 0 && (
              <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 text-[11px]">
                <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span className="text-slate-500"><strong className="font-mono text-slate-800">{coStats.count}</strong> changeovers · <strong className="font-mono text-slate-800">{coStats.totalMins}m</strong></span>
                {coStats.overrunCount > 0 && (
                  <span className="text-rose-500 font-semibold ml-auto">{coStats.overrunCount} overrun</span>
                )}
              </div>
            )}

            {(activePUnverified || activeQUnverified) && (
              <p className="px-4 py-1.5 text-[9px] text-slate-400 border-b border-slate-100">* not configured in master data, defaulted to 100%</p>
            )}

            {/* ── ACTIONS ── */}
            <button type="button" onClick={() => navigate("/part-process/dashboard")}
              className="w-full h-10 flex items-center justify-center gap-2 text-[11px] font-extrabold tracking-wider text-blue-700 hover:bg-blue-50 border-b border-slate-100">
              <LayoutDashboard className="w-3.5 h-3.5" /> OPEN FULL DASHBOARD
            </button>
            <div className="grid grid-cols-3 bg-slate-50">
              <button type="button" onClick={() => navigate("/part-process/production-report")}
                className="h-11 flex items-center justify-center gap-1.5 border-r border-slate-200 text-center text-[10px] font-extrabold leading-tight tracking-wider text-emerald-700 hover:bg-emerald-50">
                <ClipboardList className="w-3.5 h-3.5" /> PRODUCTION
              </button>
              <button type="button" onClick={() => navigate("/part-process/quality-report")}
                className="h-11 flex items-center justify-center gap-1.5 border-r border-slate-200 text-center text-[10px] font-extrabold leading-tight tracking-wider text-amber-600 hover:bg-amber-50">
                <ShieldCheck className="w-3.5 h-3.5" /> QUALITY
              </button>
              <button type="button" onClick={() => navigate("/part-process/downtime-report")}
                className="h-11 flex items-center justify-center gap-1.5 text-center text-[10px] font-extrabold leading-tight tracking-wider text-rose-600 hover:bg-rose-50">
                <AlertTriangle className="w-3.5 h-3.5" /> DOWNTIME
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartProcessOverview; 