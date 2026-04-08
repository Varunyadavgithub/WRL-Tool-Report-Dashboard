/**
 * HourlyWidget.jsx  — Redesigned
 *
 * Improvements over original:
 *  • Table + chart always visible side-by-side (no tab switching)
 *  • Heat-map row colouring — intensity relative to peak
 *  • Day (08-19) bars sky-blue, Night (20-07) bars slate-violet
 *  • Average reference line rendered as a second Chart.js dataset
 *  • Running-cumulative column (toggled via header button)
 *  • % share column in table
 *  • Bug fix: expandedGroup resets when data prop changes
 *  • Bug fix: safe maxCount (avoids division-by-zero)
 *  • Bar / Line chart toggle preserved
 *  • Removed: hour-group collapsible rows (08–12, 12–16, etc.)
 */

import { useState, useMemo, useEffect } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  MdDownload, MdWbSunny, MdNightlight, MdBolt,
  MdTrendingUp, MdBarChart, MdShowChart, MdFunctions,
} from "react-icons/md";
import {
  Chart as ChartJS, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend, LineElement, PointElement,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

// ── Palette ───────────────────────────────────────────────────────────────────
const DAY_COLOR   = "rgba(14,165,233,0.75)";   // sky-500
const NIGHT_COLOR = "rgba(139,92,246,0.65)";   // violet-500
const AVG_COLOR   = "rgba(234,88,12,0.85)";    // orange-600 — avg reference line

// Is a given hour part of the day shift?
const isDay = (h) => h >= 8 && h < 20;

// Heat-map cell colour based on fraction of peak (0–1)
const heatBg = (frac) => {
  if (frac >= 0.85) return "rgba(14,165,233,0.12)";   // sky
  if (frac >= 0.65) return "rgba(20,184,166,0.09)";   // teal
  if (frac >= 0.40) return "rgba(250,204,21,0.07)";   // yellow
  return "";
};

// ── Shared chart options factory ──────────────────────────────────────────────
const makeOptions = (maxVal, showLegend, isLine) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  plugins: {
    legend: {
      display: showLegend,
      position: "top",
      labels: { font: { size: 9, family: "inherit" }, boxWidth: 7, padding: 6, color: "#64748b" },
    },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 8,
      callbacks: {
        label: (ctx) => `  ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() ?? ""}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: maxVal + Math.max(Math.ceil(maxVal * 0.18), 5),
      border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: {
        font: { size: 9, family: "monospace" },
        color: "#94a3b8",
        callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
        maxTicksLimit: 6,
      },
    },
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 9 }, color: "#94a3b8", maxRotation: 45 },
    },
  },
});

// ── Category Widget ────────────────────────────────────────────────────────────
const CategoryWidget = ({ title, data = [], icon: Icon }) => {
  const total    = data.reduce((s, r) => s + (r.TotalCount || 0), 0);
  const maxCount = Math.max(data.reduce((m, r) => Math.max(m, r.TotalCount || 0), 0), 1);

  const exportCSV = () => {
    if (!data.length) return;
    const csv = [["#","Category","Count","%"],
      ...data.map((r, i) => [i+1, r.category, r.TotalCount, total > 0 ? ((r.TotalCount/total)*100).toFixed(1)+"%" : "0%"]),
    ].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href  = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${title.replace(/\s+/g,"_")}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const catChartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 220 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a", titleColor: "#94a3b8", bodyColor: "#f1f5f9",
        padding: 8,
        callbacks: { label: (ctx) => `  ${ctx.parsed.x.toLocaleString()} units` },
      },
    },
    scales: {
      x: {
        beginAtZero: true, border: { display: false },
        grid: { color: "rgba(0,0,0,0.04)" },
        ticks: { font: { size: 9, family: "monospace" }, color: "#94a3b8", maxTicksLimit: 5 },
      },
      y: {
        border: { display: false }, grid: { display: false },
        ticks: { font: { size: 9 }, color: "#475569" },
      },
    },
  };

  const chartData = {
    labels: data.map((r) => r.category),
    datasets: [{
      label: "Count",
      data: data.map((r) => r.TotalCount || 0),
      backgroundColor: data.map((_, i) =>
        `hsla(${200 - i * 8},70%,${55 - i * 1.2}%,0.72)`
      ),
      borderWidth: 0,
      borderRadius: 3,
    }],
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#fff",
      borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ height:36, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 12px", borderBottom:"1px solid #f1f5f9" }}>
        <div className="flex items-center gap-1.5 text-slate-500">
          {Icon && <Icon size={13} />}
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-slate-800">{total.toLocaleString()}</span>
          <button onClick={exportCSV} title="Export CSV"
            className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <MdDownload size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {data.length > 0 ? (
        <div style={{ flex:1, minHeight:0, display:"flex" }}>
          {/* Ranked table */}
          <div style={{ width:"44%", overflowY:"auto", borderRight:"1px solid #f1f5f9" }}>
            <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ position:"sticky", top:0, background:"#f8fafc", zIndex:1 }}>
                  <th style={{ padding:"6px 8px", textAlign:"left", color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #f1f5f9" }}>#</th>
                  <th style={{ padding:"6px 8px", textAlign:"left", color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #f1f5f9" }}>Category</th>
                  <th style={{ padding:"6px 8px", textAlign:"right", color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #f1f5f9" }}>Count</th>
                  <th style={{ padding:"6px 8px 6px 4px", textAlign:"right", color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #f1f5f9" }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const pct  = total > 0 ? ((row.TotalCount / total) * 100).toFixed(1) : "0.0";
                  const frac = (row.TotalCount || 0) / maxCount;
                  return (
                    <tr key={i}
                      style={{ borderBottom:"1px solid #f8fafc", background: heatBg(frac) }}
                    >
                      <td style={{ padding:"5px 8px", color:"#cbd5e1", fontFamily:"monospace" }}>{i+1}</td>
                      <td style={{ padding:"5px 8px", color:"#475569", maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={row.category}>
                        {row.category}
                      </td>
                      <td style={{ padding:"5px 8px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:"#1e293b" }}>
                        {(row.TotalCount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding:"5px 8px 5px 4px" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4 }}>
                          <div style={{ width:40, height:4, background:"#f1f5f9", borderRadius:2, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${Math.round(frac*100)}%`,
                              background:`hsla(${200 - i*8},70%,${55-i*1.2}%,0.85)`, borderRadius:2 }} />
                          </div>
                          <span style={{ fontFamily:"monospace", color:"#94a3b8", width:34, textAlign:"right" }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Horizontal bar chart */}
          <div style={{ flex:1, padding:"10px 12px", minWidth:0 }}>
            <Bar data={chartData} options={catChartOptions} />
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, color:"#cbd5e1" }}>
          <MdBarChart size={26} />
          <span style={{ fontSize:12, color:"#94a3b8" }}>No data — select a range and query</span>
        </div>
      )}
    </div>
  );
};

// ── Hourly Widget ─────────────────────────────────────────────────────────────
const HourlyWidget = ({
  title,
  data = [],
  datasets = [],
  isCategoryChart = false,
  icon: Icon,
}) => {
  const [chartType, setChartType] = useState("bar");
  const [showCumul, setShowCumul] = useState(false);



  // ── Computed values ────────────────────────────────────────────────────────
  const total = useMemo(
    () => datasets.reduce((s, ds) => s + data.reduce((r, row) => r + (row[ds.key] || 0), 0), 0),
    [data, datasets]
  );

  const rowTotals = useMemo(
    () => data.map((row) => datasets.reduce((s, ds) => s + (row[ds.key] || 0), 0)),
    [data, datasets]
  );

  const peakIdx = useMemo(
    () => rowTotals.indexOf(Math.max(...rowTotals, 0)),
    [rowTotals]
  );
  const peakRow = data[peakIdx];

  const avgPerRow = data.length > 0 ? Math.round(total / data.length) : 0;

  const cumulative = useMemo(() => {
    let cum = 0;
    return rowTotals.map((v) => (cum += v));
  }, [rowTotals]);

  const shiftTotals = useMemo(() =>
    data.reduce((acc, row, i) => {
      const h = row.TIMEHOUR ?? -1;
      if (h >= 8 && h < 20) acc.day += rowTotals[i]; else acc.night += rowTotals[i];
      return acc;
    }, { day: 0, night: 0 }),
    [data, rowTotals]
  );
  const dayPct = total > 0 ? Math.round((shiftTotals.day / total) * 100) : 0;

    if (isCategoryChart) {
    return <CategoryWidget title={title} data={data} icon={Icon} />;
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!data.length) return;
    const headers = ["Hr#","Time",...datasets.map(d=>d.label),"Total","Cumulative"];
    const rows = data.map((row, i) => [
      row.HOUR_NUMBER || row.HourNumber || i+1,
      `${row.TIMEHOUR ?? ""}:00`,
      ...datasets.map(d => row[d.key] || 0),
      rowTotals[i],
      cumulative[i],
    ]);
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `${title.replace(/\s+/g,"_")}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const labels = data.map((r) => `${r.TIMEHOUR ?? "?"}:00`);

  const allVals = datasets.flatMap((ds) => data.map((r) => r[ds.key] || 0));
  const maxVal  = Math.max(...allVals, avgPerRow, 0);

  const chartDatasets = datasets.map((ds) => ({
    label: ds.label,
    data: data.map((r) => r[ds.key] || 0),
    backgroundColor: data.map((r) =>
      isDay(r.TIMEHOUR ?? -1) ? DAY_COLOR : NIGHT_COLOR
    ),
    borderColor: data.map((r) =>
      isDay(r.TIMEHOUR ?? -1) ? DAY_COLOR : NIGHT_COLOR
    ),
    borderWidth: chartType === "line" ? 1.5 : 0,
    borderRadius: chartType === "bar" ? 3 : 0,
    pointBackgroundColor: data.map((r) =>
      isDay(r.TIMEHOUR ?? -1) ? DAY_COLOR : NIGHT_COLOR
    ),
    pointRadius: chartType === "line" ? 2.5 : 0,
    fill: false,
    tension: 0.35,
    order: 2,
  }));

  const avgDataset = {
    label: `Avg (${avgPerRow.toLocaleString()})`,
    data: data.map(() => avgPerRow),
    type: "line",
    borderColor: AVG_COLOR,
    borderWidth: 1.5,
    borderDash: [5, 3],
    pointRadius: 0,
    fill: false,
    tension: 0,
    order: 1,
  };

  const showAvgLine  = avgPerRow > 0;
  const showLegend   = datasets.length > 1 || showAvgLine;
  const chartOptions = makeOptions(maxVal, showLegend, chartType === "line");

  const finalDatasets = showAvgLine ? [...chartDatasets, avgDataset] : chartDatasets;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#fff",
      borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>

      {/* ── Widget header ── */}
      <div style={{ height:36, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 12px", borderBottom:"1px solid #f1f5f9" }}>
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={13} className="text-slate-400" />}
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowCumul(p => !p)}
            title="Toggle running total column"
            className={`p-1 rounded transition-colors text-xs ${
              showCumul ? "bg-sky-100 text-sky-600" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"
            }`}
          >
            <MdFunctions size={13} />
          </button>
          <span className="font-mono text-sm font-bold text-slate-800">{total.toLocaleString()}</span>
          <button onClick={exportCSV} title="Export CSV"
            className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <MdDownload size={13} />
          </button>
        </div>
      </div>

      {/* ── Shift bar ── */}
      {data.length > 0 && (
        <div style={{ height:28, flexShrink:0, display:"flex", alignItems:"center",
          padding:"0 12px", gap:8, borderBottom:"1px solid #f8fafc" }}>
          <MdWbSunny size={10} className="text-sky-400 shrink-0" />
          <span style={{ fontSize:10, color:"#64748b", fontFamily:"monospace", flexShrink:0 }}>
            {shiftTotals.day.toLocaleString()}
          </span>
          <div style={{ flex:1, height:4, background:"#f1f5f9", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${dayPct}%`,
              background:"linear-gradient(90deg,#0ea5e9,#38bdf8)", borderRadius:2, transition:"width 0.6s" }} />
          </div>
          <span style={{ fontSize:10, color:"#64748b", fontFamily:"monospace", flexShrink:0 }}>
            {shiftTotals.night.toLocaleString()}
          </span>
          <MdNightlight size={10} className="text-violet-400 shrink-0" />
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {peakRow && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-600"
                style={{ fontSize:9 }}>
                <MdBolt size={9} />{peakRow.TIMEHOUR}:00
              </span>
            )}
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500"
              style={{ fontSize:9 }}>
              <MdTrendingUp size={9} />{avgPerRow.toLocaleString()}/hr
            </span>
          </div>
        </div>
      )}

      {/* ── Body: table + chart ── */}
      {data.length > 0 ? (
        <div style={{ flex:1, minHeight:0, display:"flex" }}>

          {/* Table — 38% */}
          <div style={{ width:"38%", display:"flex", flexDirection:"column", borderRight:"1px solid #f1f5f9", overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto" }}>
              <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ position:"sticky", top:0, background:"#f8fafc", zIndex:1 }}>
                    <th style={{ padding:"5px 6px", color:"#94a3b8", fontWeight:600, textAlign:"center", borderBottom:"1px solid #f1f5f9", width:28 }}>Hr</th>
                    <th style={{ padding:"5px 6px", color:"#94a3b8", fontWeight:600, textAlign:"center", borderBottom:"1px solid #f1f5f9", width:38 }}>Time</th>
                    {datasets.map(ds => (
                      <th key={ds.key} style={{ padding:"5px 6px", color:"#94a3b8", fontWeight:600, textAlign:"right", borderBottom:"1px solid #f1f5f9" }}>
                        {ds.label}
                      </th>
                    ))}
                    {datasets.length > 1 && (
                      <th style={{ padding:"5px 6px", color:"#94a3b8", fontWeight:600, textAlign:"right", borderBottom:"1px solid #f1f5f9" }}>Tot</th>
                    )}
                    <th style={{ padding:"5px 6px", color:"#94a3b8", fontWeight:600, textAlign:"right", borderBottom:"1px solid #f1f5f9" }}>%</th>
                    {showCumul && (
                      <th style={{ padding:"5px 6px", color:"#94a3b8", fontWeight:600, textAlign:"right", borderBottom:"1px solid #f1f5f9" }}>Cum</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const rTotal = rowTotals[i];
                    const frac   = total > 0 ? rTotal / total : 0;
                    const isPeak = i === peakIdx;
                    const bg     = isPeak
                      ? "rgba(245,158,11,0.08)"
                      : heatBg(rTotal / Math.max(...rowTotals, 1));
                    return (
                      <tr key={i} style={{ borderBottom:"1px solid #f8fafc", background: bg }}>
                        <td style={{ padding:"4px 6px", textAlign:"center", color:"#cbd5e1", fontFamily:"monospace" }}>
                          {row.HOUR_NUMBER || row.HourNumber || i + 1}
                        </td>
                        <td style={{ padding:"4px 6px", textAlign:"center" }}>
                          <span style={{
                            fontSize:10, fontWeight:500,
                            color: isDay(row.TIMEHOUR ?? -1) ? "#0ea5e9" : "#8b5cf6",
                            display:"inline-flex", alignItems:"center", gap:2,
                          }}>
                            {row.TIMEHOUR ?? "?"}:00
                            {isPeak && <MdBolt size={8} style={{ color:"#f59e0b" }} />}
                          </span>
                        </td>
                        {datasets.map(ds => (
                          <td key={ds.key} style={{ padding:"4px 6px", textAlign:"right", fontFamily:"monospace", fontWeight:700, color:"#1e293b" }}>
                            {(row[ds.key] || 0).toLocaleString()}
                          </td>
                        ))}
                        {datasets.length > 1 && (
                          <td style={{ padding:"4px 6px", textAlign:"right", fontFamily:"monospace", color:"#475569" }}>
                            {rTotal.toLocaleString()}
                          </td>
                        )}
                        <td style={{ padding:"4px 6px", textAlign:"right", fontFamily:"monospace", color:"#94a3b8", fontSize:10 }}>
                          {(frac * 100).toFixed(1)}%
                        </td>
                        {showCumul && (
                          <td style={{ padding:"4px 6px", textAlign:"right", fontFamily:"monospace", color:"#475569", fontSize:10 }}>
                            {cumulative[i].toLocaleString()}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sticky total footer */}
            <div style={{ height:28, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"0 10px", borderTop:"1px solid #e2e8f0", background:"#f8fafc" }}>
              <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Total</span>
              <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:12, color:"#1e293b" }}>
                {total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Chart — 62% */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", padding:"6px 10px 8px" }}>
            {/* Chart type toggle */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:4, marginBottom:4, flexShrink:0 }}>
              {/* Day / Night legend */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:"auto", fontSize:9, color:"#94a3b8" }}>
                <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:DAY_COLOR, display:"inline-block" }} />Day
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:NIGHT_COLOR, display:"inline-block" }} />Night
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:12, height:2, background:AVG_COLOR, display:"inline-block", borderRadius:1 }} />Avg
                </span>
              </div>
              <button onClick={() => setChartType("bar")} title="Bar chart"
                className={`p-1 rounded transition-colors ${chartType==="bar" ? "bg-slate-100 text-slate-700" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}>
                <MdBarChart size={13} />
              </button>
              <button onClick={() => setChartType("line")} title="Line chart"
                className={`p-1 rounded transition-colors ${chartType==="line" ? "bg-slate-100 text-slate-700" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}>
                <MdShowChart size={13} />
              </button>
            </div>

            {/* Chart canvas */}
            <div style={{ flex:1, minHeight:0, position:"relative" }}>
              {chartType === "bar" ? (
                <Bar data={{ labels, datasets: finalDatasets }} options={chartOptions} />
              ) : (
                <Line data={{ labels, datasets: finalDatasets }} options={chartOptions} />
              )}
            </div>
          </div>

        </div>
      ) : (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, color:"#cbd5e1" }}>
          <MdBarChart size={26} />
          <span style={{ fontSize:12, color:"#94a3b8" }}>No data — select a range and query</span>
        </div>
      )}
    </div>
  );
};

export default HourlyWidget;