import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import ExportButton from "../../components/ui/ExportButton";
import EmptyState from "../../components/ui/EmptyState";
import {
  Search, RotateCcw, Clock, StopCircle, Play, Activity,
  MapPin, Calendar, BarChart2, List, ChevronDown, Loader2,
  Filter, Layers, Server, TrendingUp, Zap, AlertTriangle,
  Award, ArrowUp, ArrowDown, Minus,
} from "lucide-react";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Tab config ─────────────────────────────────────────────────────────────────
const INNER_TABS = [
  { key: "summary",   label: "Summary Report",  icon: BarChart2  },
  { key: "detail",    label: "Detail Report",   icon: List       },
  { key: "analytics", label: "Analytics",       icon: TrendingUp },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMinutes(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

// ── Duration Badge ─────────────────────────────────────────────────────────────
function DurationBadge({ duration, seconds }) {
  const color =
    seconds > 600  ? "bg-red-50 text-red-700 border-red-200"
    : seconds > 120 ? "bg-amber-50 text-amber-700 border-amber-200"
    :                 "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${color}`}>
      <Clock className="w-2.5 h-2.5" /> {duration}
    </span>
  );
}

// ── Dependent Select ───────────────────────────────────────────────────────────
function DependentSelect({ label, icon: Icon, value, onChange, options, loading, disabled, placeholder, allLabel }) {
  return (
    <div className="flex flex-col gap-1 min-w-[170px] flex-1">
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs text-slate-700 bg-slate-50 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {loading ? "Loading…" : disabled ? placeholder : allLabel}
          </option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
        {loading
          ? <Spinner cls="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          : <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        }
      </div>
    </div>
  );
}

// ── Mini horizontal bar ────────────────────────────────────────────────────────
function HBar({ pct, color = "bg-blue-500" }) {
  return (
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-700`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

// ── Analytics Panel ────────────────────────────────────────────────────────────
function AnalyticsPanel({ summaryData, detailData }) {
  // ── derived metrics ──────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (!summaryData.length && !detailData.length) return null;

    const totalStops   = summaryData.reduce((s, d) => s + (d.Total_Stop_Count || 0), 0);
    const totalSeconds = summaryData.reduce((s, d) => s + (d.Total_Seconds    || 0), 0);
    const avgPerStop   = totalStops > 0 ? Math.round(totalSeconds / totalStops) : 0;
    const maxStation   = summaryData[0] || null;
    const minStation   = summaryData[summaryData.length - 1] || null;

    // Duration buckets from detail data
    const short  = detailData.filter((d) => (d.Duration_Seconds || 0) <= 120).length;
    const medium = detailData.filter((d) => (d.Duration_Seconds || 0) > 120 && (d.Duration_Seconds || 0) <= 600).length;
    const long   = detailData.filter((d) => (d.Duration_Seconds || 0) > 600).length;
    const total  = detailData.length || 1;

    // Hourly distribution from detail data
    const hourMap = {};
    detailData.forEach((d) => {
      if (!d.Stop_Time) return;
      const h = parseInt(d.Stop_Time.split(":")[0], 10);
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap[h] || 0 }));
    const peakHour = hourly.reduce((max, cur) => (cur.count > max.count ? cur : max), { hour: 0, count: 0 });
    const maxHourCount = Math.max(...hourly.map((h) => h.count), 1);

    // Daily trend
    const dayMap = {};
    detailData.forEach((d) => {
      const date = (d.Date || "").toString().split("T")[0];
      if (!date) return;
      if (!dayMap[date]) dayMap[date] = { stops: 0, seconds: 0 };
      dayMap[date].stops   += 1;
      dayMap[date].seconds += d.Duration_Seconds || 0;
    });
    const daily = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
    const maxDayStops = Math.max(...daily.map((d) => d.stops), 1);

    // Top 5 stations
    const top5 = summaryData.slice(0, 5);
    const maxSec = top5[0]?.Total_Seconds || 1;

    // Efficiency score (lower is better; 100 = no stops, 0 = very bad)
    const efficiencyScore = Math.max(0, Math.min(100, Math.round(100 - (totalSeconds / 86400) * 100)));

    return {
      totalStops, totalSeconds, avgPerStop, maxStation, minStation,
      short, medium, long, total, hourly, peakHour, maxHourCount,
      daily, maxDayStops, top5, maxSec, efficiencyScore,
    };
  }, [summaryData, detailData]);

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400">
        <TrendingUp className="w-10 h-10 text-slate-200" />
        <p className="text-sm">Run a query to see analytics.</p>
      </div>
    );
  }

  const { totalStops, totalSeconds, avgPerStop, maxStation, minStation,
    short, medium, long, total, hourly, peakHour, daily, maxDayStops,
    top5, maxSec, efficiencyScore } = analytics;

  const bucketPct = (n) => Math.round((n / total) * 100);

  const fmt12 = (h) => {
    const suffix = h < 12 ? "AM" : "PM";
    const disp   = h % 12 === 0 ? 12 : h % 12;
    return `${disp}:00 ${suffix}`;
  };

  // Auto-generated insight sentences
  const insights = [];
  if (long > 0)
    insights.push({ icon: AlertTriangle, color: "text-red-500", text: `${long} stop${long > 1 ? "s" : ""} exceeded 10 minutes — review ${maxStation?.Station_Name} first.` });
  if (peakHour.count > 0)
    insights.push({ icon: Zap, color: "text-amber-500", text: `Peak downtime occurs around ${fmt12(peakHour.hour)} with ${peakHour.count} stop${peakHour.count > 1 ? "s" : ""}.` });
  if (maxStation)
    insights.push({ icon: ArrowUp, color: "text-blue-500", text: `${maxStation.Station_Name} accounts for ${Math.round((maxStation.Total_Seconds / totalSeconds) * 100)}% of total downtime.` });
  if (minStation && minStation !== maxStation)
    insights.push({ icon: Award, color: "text-emerald-500", text: `${minStation.Station_Name} has the lowest downtime at ${formatMinutes(minStation.Total_Seconds)}.` });
  if (avgPerStop > 300)
    insights.push({ icon: Clock, color: "text-purple-500", text: `Average stop duration is ${formatMinutes(avgPerStop)} — consider root-cause analysis for frequent long stops.` });

  return (
    <div className="flex-1 overflow-auto min-h-0 p-4 grid gap-4">

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Stops",    value: totalStops,            sub: "events",          color: "blue",   Icon: StopCircle  },
          { label: "Total Downtime", value: formatSeconds(totalSeconds), sub: "hh:mm:ss", color: "red",    Icon: Clock       },
          { label: "Avg Stop",       value: formatSeconds(avgPerStop),  sub: "per event", color: "amber",  Icon: Minus       },
          { label: "Stations",       value: summaryData.length,    sub: "affected",        color: "purple", Icon: MapPin      },
        ].map(({ label, value, sub, color, Icon }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-3 flex flex-col gap-1`}>
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 text-${color}-400`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest text-${color}-400`}>{label}</span>
            </div>
            <p className={`text-xl font-bold font-mono text-${color}-700 leading-tight`}>{value}</p>
            <p className={`text-[10px] text-${color}-400`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main 2-col grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top 5 Stations */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-red-400" /> Top Stations by Downtime
          </h3>
          <div className="flex flex-col gap-2.5">
            {top5.map((s, i) => {
              const pct = Math.round((s.Total_Seconds / maxSec) * 100);
              const barColors = ["bg-red-500", "bg-orange-400", "bg-amber-400", "bg-yellow-400", "bg-lime-400"];
              return (
                <div key={s.Station_Name} className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    i === 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-700 truncate w-32 shrink-0">
                    {s.Station_Name}
                  </span>
                  <HBar pct={pct} color={barColors[i] || "bg-slate-400"} />
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 w-16 text-right">
                    {formatSeconds(s.Total_Seconds)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Duration Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" /> Stop Duration Distribution
          </h3>
          {/* Stacked bar */}
          <div className="flex h-8 rounded-lg overflow-hidden mb-4 gap-0.5">
            {short  > 0 && <div className="bg-emerald-400 flex items-center justify-center text-[9px] font-bold text-white transition-all" style={{ width: `${bucketPct(short)}%` }}>{bucketPct(short)}%</div>}
            {medium > 0 && <div className="bg-amber-400  flex items-center justify-center text-[9px] font-bold text-white transition-all" style={{ width: `${bucketPct(medium)}%` }}>{bucketPct(medium)}%</div>}
            {long   > 0 && <div className="bg-red-500    flex items-center justify-center text-[9px] font-bold text-white transition-all" style={{ width: `${bucketPct(long)}%` }}>{bucketPct(long)}%</div>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Short",  count: short,  threshold: "≤ 2 min",   color: "emerald" },
              { label: "Medium", count: medium, threshold: "2–10 min",  color: "amber"   },
              { label: "Long",   count: long,   threshold: "> 10 min",  color: "red"     },
            ].map(({ label, count, threshold, color }) => (
              <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-lg p-2 text-center`}>
                <p className={`text-lg font-bold text-${color}-700`}>{count}</p>
                <p className={`text-[10px] font-semibold text-${color}-500`}>{label}</p>
                <p className={`text-[9px] text-${color}-400`}>{threshold}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly Heatmap */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Hourly Stop Frequency
            {peakHour.count > 0 && (
              <span className="ml-auto text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Peak: {fmt12(peakHour.hour)}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-12 gap-1">
            {hourly.map(({ hour, count }) => {
              const intensity = count / (analytics.maxHourCount || 1);
              const bg =
                intensity === 0  ? "bg-slate-100"
                : intensity < 0.3 ? "bg-blue-100"
                : intensity < 0.6 ? "bg-amber-300"
                :                   "bg-red-500";
              return (
                <div key={hour} className="flex flex-col items-center gap-0.5">
                  <div
                    title={`${fmt12(hour)}: ${count} stop${count !== 1 ? "s" : ""}`}
                    className={`w-full aspect-square rounded ${bg} cursor-default transition-transform hover:scale-110`}
                  />
                  {hour % 6 === 0 && (
                    <span className="text-[8px] text-slate-400">{hour}h</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 justify-end">
            <span className="text-[9px] text-slate-400">Less</span>
            {["bg-slate-100","bg-blue-100","bg-amber-300","bg-red-500"].map((c) => (
              <div key={c} className={`w-3 h-3 rounded ${c}`} />
            ))}
            <span className="text-[9px] text-slate-400">More</span>
          </div>
        </div>

        {/* Daily Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Daily Stop Trend
          </h3>
          {daily.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No daily data available.</p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {daily.map(({ date, stops }) => {
                const pct = (stops / maxDayStops) * 100;
                const isMax = stops === maxDayStops;
                return (
                  <div key={date} className="flex flex-col items-center gap-0.5 flex-1 min-w-0" title={`${date}: ${stops} stops`}>
                    <span className={`text-[8px] font-bold ${isMax ? "text-red-600" : "text-slate-400"}`}>
                      {stops}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${isMax ? "bg-red-400" : "bg-blue-300"}`}
                      style={{ height: `${Math.max(4, pct)}%` }}
                    />
                    <span className="text-[7px] text-slate-400 truncate w-full text-center">
                      {date.slice(5)} {/* MM-DD */}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-Insights ──────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-blue-400" /> Key Insights
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {insights.map(({ icon: Icon, color, text }, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
                <p className="text-xs text-slate-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Station comparison table ───────────────────────────────────────── */}
      {summaryData.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" /> Station Comparison
          </h3>
          <div className="overflow-auto">
            <table className="w-full text-xs border-separate border-spacing-0 min-w-[500px]">
              <thead>
                <tr className="bg-slate-50">
                  {["Station", "Stops", "Total Time", "Avg/Stop", "Share %", "Severity"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryData.map((s, i) => {
                  const share = Math.round((s.Total_Seconds / totalSeconds) * 100);
                  const avg   = s.Total_Stop_Count > 0
                    ? Math.round((s.Total_Seconds || 0) / s.Total_Stop_Count) : 0;
                  const severity =
                    s.Total_Seconds > 1800 ? { label: "Critical", cls: "bg-red-100 text-red-700" }
                    : s.Total_Seconds > 600  ? { label: "High",     cls: "bg-amber-100 text-amber-700" }
                    : s.Total_Seconds > 120  ? { label: "Medium",   cls: "bg-yellow-100 text-yellow-700" }
                    :                          { label: "Low",       cls: "bg-emerald-100 text-emerald-700" };
                  return (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-700">
                        {s.Station_Name}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <span className="font-bold text-slate-700">{s.Total_Stop_Count}</span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600">
                        {formatSeconds(s.Total_Seconds)}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">
                        {formatSeconds(avg)}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <HBar pct={share} color="bg-blue-400" />
                          <span className="text-[10px] font-bold text-blue-600 w-8 text-right">{share}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${severity.cls}`}>
                          {severity.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary Table ──────────────────────────────────────────────────────────────
function SummaryTable({ data }) {
  const totalStops   = data.reduce((sum, d) => sum + (d.Total_Stop_Count || 0), 0);
  const totalSeconds = data.reduce((sum, d) => sum + (d.Total_Seconds    || 0), 0);

  return (
    <div className="overflow-auto flex-1 min-h-0">
      <table className="min-w-[700px] w-full text-xs text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {["Sr No", "Station Name", "Total Stop Time", "Total Stops", "Avg per Stop"].map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center first:text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item, idx) => {
              const isTop = idx === 0;
              const avgSeconds = item.Total_Stop_Count > 0
                ? Math.round((item.Total_Seconds || 0) / item.Total_Stop_Count)
                : 0;
              return (
                <tr key={idx} className={`transition-colors hover:bg-blue-50/60 ${isTop ? "bg-red-50/40" : "even:bg-slate-50/40"}`}>
                  <td className="px-3 py-2 border-b border-slate-100 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${isTop ? "bg-red-100 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-600"}`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-3 h-3 shrink-0 ${isTop ? "text-red-400" : "text-slate-400"}`} />
                      <span className={`font-semibold ${isTop ? "text-red-700" : "text-slate-800"}`}>
                        {item.Station_Name}
                      </span>
                      {isTop && (
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-red-100 text-red-600 rounded-md">
                          Highest
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 border-b border-slate-100 text-center">
                    <DurationBadge duration={item.Total_Stop_Time} seconds={item.Total_Seconds} />
                  </td>
                  <td className="px-3 py-2 border-b border-slate-100 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                      item.Total_Stop_Count > 10 ? "bg-red-50 text-red-700 border-red-200"
                      : item.Total_Stop_Count > 5  ? "bg-amber-50 text-amber-700 border-amber-200"
                      :                              "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      <StopCircle className="w-2.5 h-2.5" /> {item.Total_Stop_Count}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b border-slate-100 text-center">
                    <span className="text-xs text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded-lg">
                      {formatSeconds(avgSeconds)}
                    </span>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={5}>
                <EmptyState message="No stop & loss data found for the selected filters." />
              </td>
            </tr>
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-slate-800 text-white">
              <td colSpan={2} className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <BarChart2 className="w-3 h-3" /> TOTAL ({data.length} stations)
                </div>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-white/15">
                  <Clock className="w-2.5 h-2.5" /> {formatSeconds(totalSeconds)}
                </span>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-white/15">
                  <StopCircle className="w-2.5 h-2.5" /> {totalStops}
                </span>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="text-[10px] font-bold font-mono bg-white/10 px-2.5 py-1 rounded-full">
                  {totalStops > 0 ? formatSeconds(Math.round(totalSeconds / totalStops)) : "—"}
                </span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Detail Table ───────────────────────────────────────────────────────────────
function DetailTable({ data }) {
  const [expandedStations, setExpandedStations] = useState(new Set());

  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach((item) => {
      const key = item.Station_Name || "Unknown Station";
      if (!groups[key]) groups[key] = { stationName: key, records: [], totalSeconds: 0, longStops: 0 };
      groups[key].records.push(item);
      groups[key].totalSeconds += item.Duration_Seconds || 0;
      if ((item.Duration_Seconds || 0) > 600) groups[key].longStops += 1;
    });
    return Object.values(groups).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [data]);

  const toggleStation = useCallback((name) =>
    setExpandedStations((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    }), []);

  const totalDetailSeconds = useMemo(() =>
    data.reduce((sum, d) => sum + (d.Duration_Seconds || 0), 0), [data]);
  const totalLongStops = useMemo(() =>
    data.filter((d) => (d.Duration_Seconds || 0) > 600).length, [data]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="px-4 py-2 shrink-0 border-b border-slate-100">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          {groupedData.length} Stations · {data.length} Total Stops
        </span>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {groupedData.length > 0 ? (
          groupedData.map((group, gIdx) => {
            const isExpanded = expandedStations.has(group.stationName);
            const isWorst    = gIdx === 0;
            const stopCount  = group.records.length;
            return (
              <div key={group.stationName} className="border-b border-slate-100 last:border-b-0">
                <button
                  onClick={() => toggleStation(group.stationName)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isExpanded ? "bg-blue-600 text-white"
                    : isWorst  ? "bg-red-50/60 hover:bg-red-50"
                    : gIdx % 2 === 0 ? "bg-white hover:bg-slate-50"
                    : "bg-slate-50/40 hover:bg-slate-100/60"}`}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-0 text-white/70" : "-rotate-90 text-slate-400"}`} />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${isExpanded ? "text-white/70" : isWorst ? "text-red-400" : "text-slate-400"}`} />
                    <span className={`text-sm font-bold truncate ${isExpanded ? "text-white" : isWorst ? "text-red-700" : "text-slate-800"}`}>
                      {group.stationName}
                    </span>
                    {isWorst && !isExpanded && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-red-100 text-red-600 rounded-md shrink-0">
                        Highest
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                      isExpanded ? "bg-white/15 text-white border-white/20"
                      : stopCount > 10 ? "bg-red-50 text-red-700 border-red-200"
                      : stopCount > 5  ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      <StopCircle className="w-2.5 h-2.5" /> {stopCount}
                    </span>
                    {group.longStops > 0 && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${isExpanded ? "bg-red-400/30 text-red-100 border-red-400/20" : "bg-red-50 text-red-600 border-red-200"}`}>
                        {group.longStops} long
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border font-mono ${
                      isExpanded ? "bg-white/15 text-white border-white/20"
                      : group.totalSeconds > 600 ? "bg-red-50 text-red-700 border-red-200"
                      : group.totalSeconds > 120 ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                      <Clock className="w-2.5 h-2.5" /> {formatSeconds(group.totalSeconds)}
                    </span>
                  </div>
                </button>

                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[2000px]" : "max-h-0"}`}>
                  <div className="bg-white">
                    <div className="grid grid-cols-12 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">
                      <div className="col-span-1">#</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-3">Stop Time</div>
                      <div className="col-span-3">Start Time</div>
                      <div className="col-span-3">Duration</div>
                    </div>
                    {group.records.map((item, rIdx) => {
                      const secs     = item.Duration_Seconds || 0;
                      const isLong   = secs > 600;
                      const isMedium = secs > 120;
                      return (
                        <div key={rIdx} className={`grid grid-cols-12 px-4 py-2.5 items-center border-b border-slate-100/80 text-center transition-colors hover:bg-blue-50/30 ${isLong ? "bg-red-50/20" : rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                          <div className="col-span-1 flex justify-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${isLong ? "bg-red-100 text-red-600" : isMedium ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                              {item.Sr_No}
                            </span>
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium bg-slate-50 px-2 py-0.5 rounded-md">
                              <Calendar className="w-2.5 h-2.5 text-slate-400" />
                              {String(item.Date).split("T")[0]}
                            </span>
                          </div>
                          <div className="col-span-3 flex justify-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200">
                              <StopCircle className="w-2.5 h-2.5" /> {item.Stop_Time}
                            </span>
                          </div>
                          <div className="col-span-3 flex justify-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <Play className="w-2.5 h-2.5" /> {item.Start_Time}
                            </span>
                          </div>
                          <div className="col-span-3 flex justify-center items-center gap-2">
                            <DurationBadge duration={item.Duration} seconds={secs} />
                            {isLong && (
                              <span className="text-[8px] font-bold uppercase text-red-500 animate-pulse">
                                ⚠ Long
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-12 px-4 py-2 items-center bg-slate-100/80 border-t border-slate-200 text-center">
                      <div className="col-span-3 col-start-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subtotal</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-[10px] font-bold text-slate-500">
                          {stopCount} {stopCount === 1 ? "stop" : "stops"}
                        </span>
                      </div>
                      <div className="col-span-3 flex justify-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                          <Clock className="w-2.5 h-2.5" /> {formatSeconds(group.totalSeconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-10">
            <EmptyState message="No detail data found for the selected filters." />
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div className="shrink-0 bg-slate-800 text-white px-4 py-3 flex items-center justify-between rounded-b-xl">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-white/60" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Grand Total</p>
              <p className="text-xs font-bold text-white/90">{groupedData.length} Stations · {data.length} Records</p>
            </div>
          </div>
          {totalLongStops > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-bold rounded-full bg-red-500/25 text-red-200 border border-red-400/30">
              <StopCircle className="w-2.5 h-2.5" /> {totalLongStops} Long Stops (&gt;10 min)
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">Total Duration</span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-white/15 border border-white/10">
              <Clock className="w-3 h-3" /> {formatSeconds(totalDetailSeconds)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function StopLossReport() {
  // ── filter state ──
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [lineName, setLineName] = useState("");
  const [location, setLocation] = useState("");
  const [station,  setStation]  = useState("");

  // ── dropdown option state ──
  const [lines,          setLines]          = useState([]);
  const [locations,      setLocations]      = useState([]);
  const [stations,       setStations]       = useState([]);
  const [stationsLoading, setStationsLoading] = useState(false);

  // ── report state ──
  const [activeTab, setActiveTab] = useState(INNER_TABS[0].key);
  const [queried,   setQueried]   = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);   // Bug fix: prevent double-submit
  const [tabCache,  setTabCache]  = useState({
    summary:   { data: [], loading: false, fetched: false },
    detail:    { data: [], loading: false, fetched: false },
    analytics: { data: [], loading: false, fetched: false },
  });

  // Abort controller ref so we can cancel in-flight requests on reset
  const abortRef = useRef(null);

  // Fetch lines and locations independently on mount
  useEffect(() => {
    axios
      .get(`${baseURL}prod/stop-loss/lines`)
      .then((res) => setLines(res?.data?.data?.map((r) => r.LineName) || []))
      .catch(() => toast.error("Failed to load lines."));
    axios
      .get(`${baseURL}prod/stop-loss/locations`)
      .then((res) => setLocations(res?.data?.data?.map((r) => r.Location) || []))
      .catch(() => toast.error("Failed to load locations."));
  }, []);

  // Fetch stations when line + location are both selected (station is optional)
  useEffect(() => {
    setStation("");
    setStations([]);
    if (!lineName || !location) return;

    setStationsLoading(true);
    axios
      .get(`${baseURL}prod/stop-loss/stations`, { params: { location, lineName } })
      .then((res) => setStations(res?.data?.data?.map((r) => r.StationName) || []))
      .catch(() => toast.error("Failed to fetch stations."))
      .finally(() => setStationsLoading(false));
  }, [location, lineName]);

  // ── fetchTabData — analytics is derived client-side, not a real API call ──
  const fetchTabData = useCallback(
    async (tabKey) => {
      // Analytics is computed from already-fetched summary + detail — no API needed
      if (tabKey === "analytics") {
        setTabCache((prev) => ({
          ...prev,
          analytics: { data: [], loading: false, fetched: true },
        }));
        return;
      }

      const endpoint =
        tabKey === "summary" ? "prod/stop-loss/summary" : "prod/stop-loss/detail";

      setTabCache((prev) => ({ ...prev, [tabKey]: { ...prev[tabKey], loading: true } }));

      try {
        const res = await axios.get(`${baseURL}${endpoint}`, {
          params: { fromDate, toDate, location, lineName, station },
          signal: abortRef.current?.signal,
        });
        const data = res?.data?.data || [];
        setTabCache((prev) => ({ ...prev, [tabKey]: { data, loading: false, fetched: true } }));
      } catch (err) {
        if (axios.isCancel(err)) return;
        toast.error(`Failed to fetch ${tabKey} data.`);
        setTabCache((prev) => ({ ...prev, [tabKey]: { ...prev[tabKey], loading: false } }));
      }
    },
    [fromDate, toDate, location, lineName, station],
  );

  const handleQuery = async () => {
    if (isQuerying) return;                                    // Bug fix: guard
    if (!fromDate || !toDate) { toast.error("Please select From Date and To Date."); return; }
    if (!lineName)            { toast.error("Please select a Line.");                 return; }
    if (!location)            { toast.error("Please select a Location.");             return; }
    if (new Date(fromDate) >= new Date(toDate)) {
      toast.error("From Date must be before To Date.");        // Bug fix: date order check
      return;
    }

    // Cancel previous in-flight requests
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsQuerying(true);
    setTabCache({
      summary:   { data: [], loading: false, fetched: false },
      detail:    { data: [], loading: false, fetched: false },
      analytics: { data: [], loading: false, fetched: false },
    });
    setQueried(true);

    try {
      await fetchTabData(activeTab === "analytics" ? "summary" : activeTab);
      // If landing on analytics, also pre-fetch detail
      if (activeTab === "analytics") await fetchTabData("detail");
    } finally {
      setIsQuerying(false);
    }
  };

  const handleTabSwitch = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);
      if (!queried) return;

      // Analytics needs both summary + detail to be fetched first
      if (tabKey === "analytics") {
        const needsSummary = !tabCache.summary.fetched && !tabCache.summary.loading;
        const needsDetail  = !tabCache.detail.fetched  && !tabCache.detail.loading;
        if (needsSummary) fetchTabData("summary");
        if (needsDetail)  fetchTabData("detail");
        // Mark analytics fetched once both are in
        setTabCache((prev) => ({ ...prev, analytics: { ...prev.analytics, fetched: true } }));
        return;
      }

      if (!tabCache[tabKey].fetched && !tabCache[tabKey].loading)
        fetchTabData(tabKey);
    },
    [queried, tabCache, fetchTabData],
  );

  const handleReset = () => {
    abortRef.current?.abort();
    setFromDate(""); setToDate("");
    setLineName(""); setLocation(""); setStation("");
    setStations([]);
    setQueried(false);
    setIsQuerying(false);
    setActiveTab(INNER_TABS[0].key);
    setTabCache({
      summary:   { data: [], loading: false, fetched: false },
      detail:    { data: [], loading: false, fetched: false },
      analytics: { data: [], loading: false, fetched: false },
    });
  };

  const currentCache = tabCache[activeTab];
  const currentTab   = INNER_TABS.find((t) => t.key === activeTab);

  // For header KPIs — always derived from summary
  const summaryData  = tabCache.summary.data;
  const totalStops   = summaryData.reduce((s, d) => s + (d.Total_Stop_Count || 0), 0);
  const totalSeconds = summaryData.reduce((s, d) => s + (d.Total_Seconds    || 0), 0);

  const isBusy = currentCache.loading || isQuerying;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">

      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Stop Loss Report</h1>
          <p className="text-[11px] text-slate-400">Station-level downtime analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {queried && summaryData.length > 0 && (
            <>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-blue-700">{summaryData.length}</span>
                <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">Stations</span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-red-50 border border-red-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-red-700">{totalStops}</span>
                <span className="text-[10px] text-red-500 font-medium uppercase tracking-wide">Total Stops</span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[90px]">
                <span className="text-lg font-bold font-mono text-amber-700">{formatSeconds(totalSeconds)}</span>
                <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">Total Time</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">

        {/* ── FILTERS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Filters</p>
          </div>
          <div className="flex flex-wrap gap-3 items-end">

            {/* From Date */}
            <div className="flex flex-col gap-1 min-w-[185px] flex-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">From Date & Time</label>
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                max={toDate || undefined}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
              />
            </div>

            {/* To Date */}
            <div className="flex flex-col gap-1 min-w-[185px] flex-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">To Date & Time</label>
              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate || undefined}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
              />
            </div>

            {/* Line */}
            <div className="flex flex-col gap-1 min-w-[160px] flex-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Line</label>
              <div className="relative">
                <select
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs text-slate-700 bg-slate-50 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                >
                  <option value="">Select Line</option>
                  {lines.map((line, i) => (
                    <option key={i} value={line}>{line}</option>
                  ))}
                </select>
                <Layers className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Location — loaded independently on mount */}
            <div className="flex flex-col gap-1 min-w-[160px] flex-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Location</label>
              <div className="relative">
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs text-slate-700 bg-slate-50 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                >
                  <option value="">Select Location</option>
                  {locations.map((loc, i) => (
                    <option key={i} value={loc}>{loc}</option>
                  ))}
                </select>
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <DependentSelect
              label="Station (Optional)"
              icon={Server}
              value={station}
              onChange={setStation}
              options={stations}
              loading={stationsLoading}
              disabled={!location}
              placeholder="Select Location first"
              allLabel="All Stations"
            />

            {/* Buttons */}
            <div className="flex items-center gap-2 pb-0.5 shrink-0">
              <button
                onClick={handleQuery}
                disabled={isBusy}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isBusy
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {isBusy ? <Spinner /> : <Search className="w-4 h-4" />}
                {isBusy ? "Searching…" : "Query"}
              </button>
              {queried && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-all"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              )}
            </div>

            {/* Active filter badge */}
            {queried && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl ml-auto shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  <div>
                    <p className="text-[9px] uppercase font-bold text-blue-400 tracking-widest leading-none">Line</p>
                    <p className="text-xs font-bold text-blue-700 mt-0.5">{lineName}</p>
                  </div>
                </div>
                <div className="w-px h-7 bg-blue-200" />
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  <div>
                    <p className="text-[9px] uppercase font-bold text-blue-400 tracking-widest leading-none">Location</p>
                    <p className="text-xs font-bold text-blue-700 mt-0.5">{location}</p>
                  </div>
                </div>
                {station && (
                  <>
                    <div className="w-px h-7 bg-blue-200" />
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-blue-500" />
                      <div>
                        <p className="text-[9px] uppercase font-bold text-blue-400 tracking-widest leading-none">Station</p>
                        <p className="text-xs font-bold text-blue-700 mt-0.5">{station}</p>
                      </div>
                    </div>
                  </>
                )}
                <div className="w-px h-7 bg-blue-200" />
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <div>
                    <p className="text-[9px] uppercase font-bold text-blue-400 tracking-widest leading-none">Period</p>
                    <p className="text-[11px] font-semibold text-blue-700 mt-0.5">
                      {fromDate?.replace("T", " ")} → {toDate?.replace("T", " ")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── REPORT PANEL ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <div className="flex gap-1 pt-1.5">
              {INNER_TABS.map((tab) => {
                const Icon     = tab.icon;
                const isActive = activeTab === tab.key;
                const cache    = tab.key === "analytics"
                  ? { loading: tabCache.summary.loading || tabCache.detail.loading, fetched: tabCache.summary.fetched && tabCache.detail.fetched, data: [] }
                  : tabCache[tab.key];
                const count    = tab.key !== "analytics" && cache.fetched ? cache.data.length : null;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabSwitch(tab.key)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-all ${
                      isActive
                        ? "bg-white text-blue-700 border-t-2 border-x border-t-blue-500 border-x-slate-200 -mb-px shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    {cache.loading
                      ? <Spinner cls="w-3.5 h-3.5" />
                      : <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
                    }
                    {tab.label}
                    {count != null && (
                      <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-4 px-1 rounded-full text-[10px] font-bold ${isActive ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}>
                        {count}
                      </span>
                    )}
                    {cache.fetched && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
            {queried && currentCache.fetched && currentCache.data.length > 0 && activeTab !== "analytics" && (
              <div className="py-2">
                <ExportButton
                  data={currentCache.data}
                  filename={`Stop_Loss_${activeTab === "summary" ? "Summary" : "Detail"}_Report`}
                />
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {!queried ? (
              <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-base font-bold text-slate-500">Stop & Loss Report</p>
                <p className="text-sm mt-1 text-slate-400 text-center max-w-xs">
                  Select date range, line and location, then click{" "}
                  <span className="font-semibold text-blue-500">Query</span> to view the report.
                </p>
              </div>
            ) : currentCache.loading ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3">
                <Spinner cls="w-6 h-6 text-blue-600" />
                <p className="text-sm text-slate-400">Fetching {currentTab.label}…</p>
              </div>
            ) : activeTab === "analytics" ? (
              // Analytics derives from already-cached data — show even while detail is loading
              <AnalyticsPanel
                summaryData={tabCache.summary.data}
                detailData={tabCache.detail.data}
              />
            ) : currentCache.fetched ? (
              activeTab === "summary"
                ? <SummaryTable data={currentCache.data} />
                : <DetailTable  data={currentCache.data} />
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400">
                <Spinner cls="w-5 h-5" />
                <p className="text-sm">Loading {currentTab.label}…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StopLossReport;