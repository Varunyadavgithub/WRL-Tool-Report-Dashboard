import { useState, useEffect, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import {
  Calendar, Loader2, RefreshCw, Gauge, Activity, Timer, ShieldCheck,
  PackageOpen, AlertTriangle, TimerOff, ArrowRightLeft, Search, BarChart3,
} from "lucide-react";
import toast from "react-hot-toast";
import { shiftDurationMins } from "../../redux/slices/masterConfigSlice";
import { usePartProcessOEE, computeOEE, parseDurSecs } from "./usePartProcessOEE";
import { detectChangeovers, changeoverStats } from "../../utils/productionLogic.js";
import { getLastNDaysRange } from "../../utils/dateUtils.js";

ChartJS.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#06b6d4", "#e879f9", "#fb923c", "#64748b"];

const fmtDateLabel = (iso) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const fmtHrsMins = (mins) => {
  const m = Math.round(mins || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

const TICK = { font: { size: 10 }, color: "#94a3b8" };
const GRID = { color: "rgba(148,163,184,0.08)" };
const LEGEND = { display: true, position: "top", labels: { usePointStyle: true, pointStyle: "circle", font: { size: 11 }, padding: 14, color: "#475569" } };
const TOOLTIP = { backgroundColor: "#fff", titleColor: "#1e293b", bodyColor: "#475569", borderColor: "#e2e8f0", borderWidth: 1 };

// ─────────────────────────────────────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, sub, color = "#3b82f6" }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
      <Icon className="w-4.5 h-4.5" style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-lg font-bold text-slate-800 leading-tight truncate">{value}</p>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 truncate">{sub}</p>}
    </div>
  </div>
);

const ChartCard = ({ title, icon: Icon, height = 240, children, empty = false }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-slate-400" />
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</p>
    </div>
    {empty ? (
      <div className="flex flex-1 items-center justify-center text-xs text-slate-400" style={{ minHeight: height }}>
        No data for the selected range
      </div>
    ) : (
      <div style={{ height }}>{children}</div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const PartProcessAnalytics = () => {
  const {
    records, loading, loadProgress, materials, shifts,
    rangeStart, rangeEnd, applyRange, loadForRange,
  } = usePartProcessOEE();

  const [preset, setPreset] = useState("7d");
  const [caFrom, setCaFrom] = useState("");
  const [caTo, setCaTo] = useState("");

  useEffect(() => {
    if (preset === "custom") return;
    const r = getLastNDaysRange(preset === "30d" ? 30 : 7);
    applyRange("custom", r.startDate, r.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const handleApplyCustom = () => {
    if (!caFrom || !caTo) { toast.error("Select both start and end dates."); return; }
    const s = new Date(`${caFrom}T00:00:00`).toISOString();
    const e = new Date(`${caTo}T23:59:59.999`).toISOString();
    if (new Date(e) <= new Date(s)) { toast.error("End date must be after start date."); return; }
    setPreset("custom");
    applyRange("custom", s, e);
  };

  // ── Per-day aggregation (OEE + changeovers) ─────────────────────────────
  const { dailyStats, allChangeovers } = useMemo(() => {
    if (!records.length) return { dailyStats: [], allChangeovers: [] };
    const byDate = {};
    records.forEach((r) => {
      if (!r.eventDate) return;
      (byDate[r.eventDate] ??= []).push(r);
    });
    const plannedMins = shifts.length > 0 ? shifts.reduce((s, sh) => s + shiftDurationMins(sh), 0) : 1440;

    const days = [];
    const cos = [];
    Object.keys(byDate).sort().forEach((date) => {
      const dayRecords = byDate[date];
      const prod = dayRecords.filter((r) => r.state === "Production");
      const down = dayRecords.filter((r) => r.state === "Downtime");
      const oee  = computeOEE({ prodRecords: prod, downRecords: down, plannedMins, materials });
      const dayCos = detectChangeovers(dayRecords, undefined, null);
      const coS = changeoverStats(dayCos);
      days.push({ date, ...oee, coCount: coS.count, coMins: coS.totalMins });
      dayCos.forEach((co) => cos.push({ ...co, date }));
    });
    return { dailyStats: days, allChangeovers: cos };
  }, [records, shifts, materials]);

  // ── Range summary KPIs ───────────────────────────────────────────────────
  const summary = useMemo(() => {
    const n = dailyStats.length;
    if (!n) return null;
    const sum = (k) => dailyStats.reduce((s, d) => s + (d[k] || 0), 0);
    return {
      avgOEE: Math.round(sum("OEE") / n),
      avgA:   Math.round(sum("A") / n),
      avgP:   Math.round(sum("P") / n),
      avgQ:   Math.round(sum("Q") / n),
      totalGood: sum("good"),
      totalBad:  sum("bad"),
      totalDownMins: sum("downMins"),
      totalCO: sum("coCount"),
      totalCOMins: Math.round(sum("coMins") * 10) / 10,
      days: n,
    };
  }, [dailyStats]);

  // ── Downtime by reason ───────────────────────────────────────────────────
  const downtimeByReason = useMemo(() => {
    const map = {};
    records.filter((r) => r.state === "Downtime").forEach((r) => {
      const reason = r.downtimeReason || "Unassigned";
      map[reason] = (map[reason] || 0) + parseDurSecs(r.duration);
    });
    return Object.entries(map)
      .map(([reason, secs]) => ({ reason, mins: Math.round(secs / 60) }))
      .filter((d) => d.mins > 0)
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 8);
  }, [records]);

  // ── Shift-wise comparison ────────────────────────────────────────────────
  const shiftStats = useMemo(() => {
    const byShift = {};
    records.forEach((r) => {
      const key = r.shift || "Unassigned";
      (byShift[key] ??= []).push(r);
    });
    return Object.entries(byShift).map(([name, recs]) => {
      const prod = recs.filter((r) => r.state === "Production");
      const down = recs.filter((r) => r.state === "Downtime");
      const oee  = computeOEE({ prodRecords: prod, downRecords: down, plannedMins: 1, materials });
      const cfg  = shifts.find((s) => s.shiftName === name);
      return { name, color: cfg?.color || "#64748b", ...oee };
    }).sort((a, b) => b.qty - a.qty);
  }, [records, shifts, materials]);

  // ── Top changeover transitions ───────────────────────────────────────────
  const topChangeovers = useMemo(() => {
    const map = {};
    allChangeovers.forEach((co) => {
      const key = `${co.fromModel} → ${co.toModel}`;
      (map[key] ??= { key, from: co.fromModel, to: co.toModel, count: 0, totalMins: 0 });
      map[key].count += 1;
      map[key].totalMins += co.durationMins;
    });
    return Object.values(map)
      .map((x) => ({ ...x, totalMins: Math.round(x.totalMins * 10) / 10 }))
      .sort((a, b) => b.totalMins - a.totalMins)
      .slice(0, 6);
  }, [allChangeovers]);

  const hasData = dailyStats.length > 0;

  // ── Chart datasets ───────────────────────────────────────────────────────
  const oeeTrendData = useMemo(() => ({
    labels: dailyStats.map((d) => fmtDateLabel(d.date)),
    datasets: [
      { label: "OEE",          data: dailyStats.map((d) => d.OEE), borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.10)", fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2 },
      { label: "Availability", data: dailyStats.map((d) => d.A),   borderColor: "#22c55e", backgroundColor: "transparent", tension: 0.35, pointRadius: 2, borderWidth: 1.5 },
      { label: "Performance",  data: dailyStats.map((d) => d.P),   borderColor: "#f59e0b", backgroundColor: "transparent", tension: 0.35, pointRadius: 2, borderWidth: 1.5 },
      { label: "Quality",      data: dailyStats.map((d) => d.Q),   borderColor: "#a78bfa", backgroundColor: "transparent", tension: 0.35, pointRadius: 2, borderWidth: 1.5 },
    ],
  }), [dailyStats]);

  const oeeTrendOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: LEGEND,
      tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: TICK },
      y: { beginAtZero: true, max: 110, grid: GRID, ticks: { ...TICK, stepSize: 20, callback: (v) => v + "%" } },
    },
  }), []);

  const productionTrendData = useMemo(() => ({
    labels: dailyStats.map((d) => fmtDateLabel(d.date)),
    datasets: [
      { label: "Good",     data: dailyStats.map((d) => d.good), backgroundColor: "#22c55e", borderRadius: 4, stack: "qty" },
      { label: "Rejected", data: dailyStats.map((d) => d.bad),  backgroundColor: "#ef4444", borderRadius: 4, stack: "qty" },
    ],
  }), [dailyStats]);

  const productionTrendOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: LEGEND, tooltip: TOOLTIP },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: TICK },
      y: { stacked: true, beginAtZero: true, grid: GRID, ticks: TICK },
    },
  }), []);

  const downtimeTrendData = useMemo(() => ({
    labels: dailyStats.map((d) => fmtDateLabel(d.date)),
    datasets: [
      { label: "Downtime (min)",   data: dailyStats.map((d) => d.downMins), backgroundColor: "#f97316", borderRadius: 4 },
      { label: "Changeover (min)", data: dailyStats.map((d) => d.coMins),   backgroundColor: "#f59e0b", borderRadius: 4 },
    ],
  }), [dailyStats]);

  const downtimeTrendOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: LEGEND, tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => ` ${ctx.dataset.label.split(" ")[0]}: ${ctx.parsed.y} min` } } },
    scales: {
      x: { grid: { display: false }, ticks: TICK },
      y: { beginAtZero: true, grid: GRID, ticks: TICK },
    },
  }), []);

  const downtimeReasonData = useMemo(() => ({
    labels: downtimeByReason.map((d) => d.reason),
    datasets: [{ label: "Minutes", data: downtimeByReason.map((d) => d.mins), backgroundColor: CHART_COLORS, borderRadius: 4 }],
  }), [downtimeByReason]);

  const downtimeReasonOptions = useMemo(() => ({
    indexAxis: "y",
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => ` ${ctx.parsed.x} min` } } },
    scales: {
      x: { beginAtZero: true, grid: GRID, ticks: TICK },
      y: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#374151" } },
    },
  }), []);

  const shiftCompareData = useMemo(() => ({
    labels: shiftStats.map((s) => s.name),
    datasets: [
      { label: "OEE", data: shiftStats.map((s) => s.OEE), backgroundColor: "#3b82f6", borderRadius: 4 },
      { label: "A",   data: shiftStats.map((s) => s.A),   backgroundColor: "#22c55e", borderRadius: 4 },
      { label: "P",   data: shiftStats.map((s) => s.P),   backgroundColor: "#f59e0b", borderRadius: 4 },
      { label: "Q",   data: shiftStats.map((s) => s.Q),   backgroundColor: "#a78bfa", borderRadius: 4 },
    ],
  }), [shiftStats]);

  const shiftCompareOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: LEGEND,
      tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: TICK },
      y: { beginAtZero: true, max: 110, grid: GRID, ticks: { ...TICK, stepSize: 20, callback: (v) => v + "%" } },
    },
  }), []);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
        {loading && loadProgress.total > 0 && (
          <div className="bg-blue-600 shrink-0">
            <div className="flex items-center justify-between px-5 py-1 text-[11px] text-white/80">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading…&nbsp;
                <span className="font-bold text-white font-mono">{loadProgress.loaded.toLocaleString()}</span>
                <span className="opacity-60">of</span>
                <span className="font-bold text-white font-mono">{loadProgress.total.toLocaleString()}</span>
              </span>
              <span className="font-bold text-white font-mono">
                {loadProgress.total > 0 ? Math.round((loadProgress.loaded / loadProgress.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-0.5 bg-blue-500">
              <div className="h-full bg-white/70 transition-all duration-300"
                style={{ width: `${loadProgress.total > 0 ? (loadProgress.loaded / loadProgress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-none">Amada Machine Analytics</p>
              <span className="text-[10px] text-slate-400">
                {summary ? `${summary.days} day${summary.days > 1 ? "s" : ""} · ${(summary.totalGood + summary.totalBad).toLocaleString("en-IN")} parts produced` : "Part Process · Production Analytics"}
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {[
                { label: "Last 7 Days",  key: "7d" },
                { label: "Last 30 Days", key: "30d" },
              ].map(({ label, key }) => (
                <button key={key} onClick={() => setPreset(key)} disabled={loading}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all disabled:opacity-40 ${
                    preset === key
                      ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {label}
                </button>
              ))}
              <button onClick={() => setPreset("custom")} disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all disabled:opacity-40 ${
                  preset === "custom"
                    ? "bg-white text-purple-700 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                <Calendar className="w-3.5 h-3.5" />
                Custom
              </button>
            </div>

            {preset === "custom" && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 shadow-sm">
                <input type="date" value={caFrom} onChange={(e) => setCaFrom(e.target.value)}
                  className="text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400" />
                <span className="text-slate-400 text-xs font-bold">→</span>
                <input type="date" value={caTo} onChange={(e) => setCaTo(e.target.value)}
                  className="text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400" />
                <button onClick={handleApplyCustom} disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-colors">
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  Apply
                </button>
              </div>
            )}

            <button onClick={() => loadForRange(rangeStart, rangeEnd)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {!hasData ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300 py-20">
            <BarChart3 className="w-10 h-10 opacity-30" strokeWidth={1.2} />
            <p className="text-sm text-slate-400">{loading ? "Loading production data…" : "No production data found for the selected range"}</p>
          </div>
        ) : (
          <>
            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <KpiCard icon={Gauge}        label="Avg OEE"      value={`${summary.avgOEE}%`} color="#3b82f6" />
              <KpiCard icon={Activity}     label="Avg A"        value={`${summary.avgA}%`}   color="#22c55e" />
              <KpiCard icon={Timer}        label="Avg P"        value={`${summary.avgP}%`}   color="#f59e0b" />
              <KpiCard icon={ShieldCheck}  label="Avg Q"        value={`${summary.avgQ}%`}   color="#a78bfa" />
              <KpiCard icon={PackageOpen}  label="Good Parts"   value={summary.totalGood.toLocaleString("en-IN")} color="#22c55e" />
              <KpiCard icon={AlertTriangle} label="Rejected"    value={summary.totalBad.toLocaleString("en-IN")}  color="#ef4444" />
              <KpiCard icon={TimerOff}     label="Downtime"     value={fmtHrsMins(summary.totalDownMins)} color="#f97316" />
              <KpiCard icon={ArrowRightLeft} label="Changeovers" value={summary.totalCO} sub={`${summary.totalCOMins.toFixed(1)} min total`} color="#06b6d4" />
            </div>

            {/* ── OEE Trend ── */}
            <ChartCard title="OEE / A / P / Q Trend" icon={Gauge} height={260}>
              <Line data={oeeTrendData} options={oeeTrendOptions} />
            </ChartCard>

            {/* ── Production & Downtime trends ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Production Trend (Good vs Rejected)" icon={PackageOpen} height={240}>
                <Bar data={productionTrendData} options={productionTrendOptions} />
              </ChartCard>
              <ChartCard title="Downtime & Changeover Trend" icon={TimerOff} height={240}>
                <Bar data={downtimeTrendData} options={downtimeTrendOptions} />
              </ChartCard>
            </div>

            {/* ── Downtime reasons & Shift comparison ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Downtime by Reason" icon={AlertTriangle} height={240} empty={downtimeByReason.length === 0}>
                <Bar data={downtimeReasonData} options={downtimeReasonOptions} />
              </ChartCard>
              <ChartCard title="Shift-wise Comparison" icon={Activity} height={240} empty={shiftStats.length === 0}>
                <Bar data={shiftCompareData} options={shiftCompareOptions} />
              </ChartCard>
            </div>

            {/* ── Top changeovers & shift totals ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Top Changeover Transitions</p>
                </div>
                {topChangeovers.length === 0 ? (
                  <div className="flex items-center justify-center text-xs text-slate-400 py-10">No changeovers in the selected range</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-100">
                        <th className="py-1.5 font-semibold">From</th>
                        <th className="py-1.5 font-semibold">To</th>
                        <th className="py-1.5 font-semibold text-right">Count</th>
                        <th className="py-1.5 font-semibold text-right">Total (min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topChangeovers.map((c) => (
                        <tr key={c.key} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5 font-mono text-slate-600 truncate max-w-[140px]">{c.from || "—"}</td>
                          <td className="py-1.5 font-mono text-slate-600 truncate max-w-[140px]">{c.to || "—"}</td>
                          <td className="py-1.5 text-right font-semibold text-slate-700">{c.count}</td>
                          <td className="py-1.5 text-right font-mono text-amber-600">{c.totalMins.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Shift Totals</p>
                </div>
                {shiftStats.length === 0 ? (
                  <div className="flex items-center justify-center text-xs text-slate-400 py-10">No shift data in the selected range</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-100">
                        <th className="py-1.5 font-semibold">Shift</th>
                        <th className="py-1.5 font-semibold text-right">Good</th>
                        <th className="py-1.5 font-semibold text-right">Rejected</th>
                        <th className="py-1.5 font-semibold text-right">Downtime</th>
                        <th className="py-1.5 font-semibold text-right">OEE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftStats.map((s) => (
                        <tr key={s.name} className="border-b border-slate-50 last:border-0">
                          <td className="py-1.5">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-mono text-emerald-600">{s.good.toLocaleString("en-IN")}</td>
                          <td className="py-1.5 text-right font-mono text-rose-500">{s.bad.toLocaleString("en-IN")}</td>
                          <td className="py-1.5 text-right font-mono text-orange-500">{fmtHrsMins(s.downMins)}</td>
                          <td className="py-1.5 text-right font-mono font-bold text-blue-600">{s.OEE}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PartProcessAnalytics;
