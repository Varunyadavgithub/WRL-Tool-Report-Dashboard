/**
 * HourlyWidget.jsx — Model Summary Panels
 *
 * Two header buttons:
 *  1. "Hourly"  → compact stacked bar on top + full-width cross-tab pivot table below (Image 1 style)
 *  2. "Total"   → ranked table + horizontal bar chart side-by-side
 */

import { useState, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  MdDownload,
  MdWbSunny,
  MdNightlight,
  MdBolt,
  MdTrendingUp,
  MdBarChart,
  MdShowChart,
  MdFunctions,
  MdClose,
  MdSchedule,
  MdLeaderboard,
} from "react-icons/md";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from "chart.js";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
);

// ── Palette ───────────────────────────────────────────────────────────────────
const DAY_COLOR = "rgba(14,165,233,0.75)";
const NIGHT_COLOR = "rgba(139,92,246,0.65)";
const AVG_COLOR = "rgba(234,88,12,0.85)";

const MODEL_COLORS = [
  "#0ea5e9",
  "#f97316",
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#ef4444",
  "#6366f1",
  "#84cc16",
];

const isDay = (h) => h >= 8 && h < 20;
const heatBg = (frac) => {
  if (frac >= 0.85) return "rgba(14,165,233,0.08)";
  if (frac >= 0.65) return "rgba(20,184,166,0.06)";
  if (frac >= 0.4) return "rgba(250,204,21,0.05)";
  return "";
};

const makeOptions = (maxVal, showLegend) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  plugins: {
    legend: {
      display: showLegend,
      position: "top",
      labels: {
        font: { size: 9, family: "inherit" },
        boxWidth: 7,
        padding: 6,
        color: "#64748b",
      },
    },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 8,
      callbacks: {
        label: (ctx) =>
          `  ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() ?? ""}`,
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
        maxTicksLimit: 5,
      },
    },
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 9 }, color: "#94a3b8", maxRotation: 0 },
    },
  },
});

const makeStackedOptions = (maxVal) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 8,
      callbacks: {
        label: (ctx) =>
          `  ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() ?? ""}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      stacked: true,
      border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: {
        font: { size: 9, family: "monospace" },
        color: "#94a3b8",
        callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
        maxTicksLimit: 4,
      },
    },
    x: {
      stacked: true,
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 9 }, color: "#94a3b8", maxRotation: 0 },
    },
  },
});

const makeHorizOptions = (maxVal) => ({
  indexAxis: "y",
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 8,
      callbacks: {
        label: (ctx) => `  Count: ${ctx.parsed.x?.toLocaleString() ?? ""}`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      max: maxVal + Math.max(Math.ceil(maxVal * 0.18), 5),
      border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: {
        font: { size: 9, family: "monospace" },
        color: "#94a3b8",
        callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
        maxTicksLimit: 5,
      },
    },
    y: {
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 9 }, color: "#475569" },
    },
  },
});

// ── Category Widget ───────────────────────────────────────────────────────────
const CategoryWidget = ({ title, data = [], icon: Icon }) => {
  const total = data.reduce((s, r) => s + (r.TotalCount || 0), 0);
  const maxCount = Math.max(
    data.reduce((m, r) => Math.max(m, r.TotalCount || 0), 0),
    1,
  );

  const exportCSV = () => {
    if (!data.length) return;
    const csv = [
      ["#", "Category", "Count", "%"],
      ...data.map((r, i) => [
        i + 1,
        r.category,
        r.TotalCount,
        total > 0 ? ((r.TotalCount / total) * 100).toFixed(1) + "%" : "0%",
      ]),
    ]
      .map((r) => r.join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${title.replace(/\s+/g, "_")}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const catChartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 220 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#94a3b8",
        bodyColor: "#f1f5f9",
        padding: 8,
        callbacks: {
          label: (ctx) => `  ${ctx.parsed.x.toLocaleString()} units`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: "rgba(0,0,0,0.04)" },
        ticks: {
          font: { size: 9, family: "monospace" },
          color: "#94a3b8",
          maxTicksLimit: 5,
        },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: { font: { size: 9 }, color: "#475569" },
      },
    },
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div className="flex items-center gap-1.5 text-slate-500">
          {Icon && <Icon size={13} />}
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-slate-800">
            {total.toLocaleString()}
          </span>
          <button
            onClick={exportCSV}
            title="Export CSV"
            className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <MdDownload size={13} />
          </button>
        </div>
      </div>
      {data.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div
            style={{
              width: "44%",
              overflowY: "auto",
              borderRight: "1px solid #f1f5f9",
            }}
          >
            <table
              style={{
                width: "100%",
                fontSize: 11,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#f8fafc",
                    zIndex: 1,
                  }}
                >
                  {["#", "Category", "Count", "Share"].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "6px 8px",
                        textAlign: i >= 2 ? "right" : "left",
                        color: "#94a3b8",
                        fontWeight: 600,
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const pct =
                    total > 0
                      ? ((row.TotalCount / total) * 100).toFixed(1)
                      : "0.0";
                  const frac = (row.TotalCount || 0) / maxCount;
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #f8fafc",
                        background: heatBg(frac),
                      }}
                    >
                      <td
                        style={{
                          padding: "5px 8px",
                          color: "#cbd5e1",
                          fontFamily: "monospace",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          color: "#475569",
                          maxWidth: 110,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={row.category}
                      >
                        {row.category}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: "#1e293b",
                        }}
                      >
                        {(row.TotalCount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: "5px 8px 5px 4px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 4,
                              background: "#f1f5f9",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.round(frac * 100)}%`,
                                background: `hsla(${200 - i * 8},70%,${55 - i * 1.2}%,0.85)`,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "#94a3b8",
                              width: 34,
                              textAlign: "right",
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
            <Bar
              data={{
                labels: data.map((r) => r.category),
                datasets: [
                  {
                    label: "Count",
                    data: data.map((r) => r.TotalCount || 0),
                    backgroundColor: data.map(
                      (_, i) =>
                        `hsla(${200 - i * 8},70%,${55 - i * 1.2}%,0.72)`,
                    ),
                    borderWidth: 0,
                    borderRadius: 3,
                  },
                ],
              }}
              options={catChartOptions}
            />
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "#cbd5e1",
          }}
        >
          <MdBarChart size={26} />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            No data — select a range and query
          </span>
        </div>
      )}
    </div>
  );
};

// ── Hourly Model Panel (Image 1 style) ────────────────────────────────────────
// Compact stacked bar on top + full-width cross-tab pivot table below
// ── Hourly Model Panel (Flat list: Time | Model Name | Count) ─────────────────
const HourlyModelPanel = ({ modelData, onClose }) => {
  // Sort rows by hour then by count desc
  const flatRows = useMemo(() => {
    return [...modelData].sort(
      (a, b) =>
        a.TIMEHOUR - b.TIMEHOUR || (b.Model_Count || 0) - (a.Model_Count || 0),
    );
  }, [modelData]);

  const grandTotal = flatRows.reduce((s, r) => s + (r.Model_Count || 0), 0);

  // For the stacked bar chart (unchanged)
  const MAX_MODELS = 10;
  const topModels = useMemo(() => {
    const map = {};
    for (const item of modelData) {
      if (!map[item.MatCode])
        map[item.MatCode] = {
          MatCode: item.MatCode,
          Name: item.Name || item.MatCode,
          Total: 0,
        };
      map[item.MatCode].Total += item.Model_Count || 0;
    }
    return Object.values(map)
      .sort((a, b) => b.Total - a.Total)
      .slice(0, MAX_MODELS);
  }, [modelData]);

  const hours = useMemo(
    () => [...new Set(modelData.map((d) => d.TIMEHOUR))].sort((a, b) => a - b),
    [modelData],
  );
  const lookup = useMemo(() => {
    const m = {};
    for (const item of modelData) {
      if (!m[item.TIMEHOUR]) m[item.TIMEHOUR] = {};
      m[item.TIMEHOUR][item.MatCode] =
        (m[item.TIMEHOUR][item.MatCode] || 0) + (item.Model_Count || 0);
    }
    return m;
  }, [modelData]);

  const hourTotals = hours.map((h) =>
    topModels.reduce((s, m) => s + (lookup[h]?.[m.MatCode] || 0), 0),
  );
  const maxHourTotal = Math.max(...hourTotals, 0);

  const chartDatasets = topModels.map((model, i) => ({
    label: model.Name.length > 14 ? model.Name.slice(0, 12) + "…" : model.Name,
    data: hours.map((h) => lookup[h]?.[model.MatCode] || 0),
    backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length],
    borderWidth: 0,
    borderRadius: 2,
    stack: "s",
  }));

  // Model color lookup by MatCode
  const modelColorMap = useMemo(() => {
    const map = {};
    topModels.forEach((m, i) => {
      map[m.MatCode] = MODEL_COLORS[i % MODEL_COLORS.length];
    });
    return map;
  }, [topModels]);

  const exportCSV = () => {
    const csv = [
      ["Time", "Model Name", "Count"],
      ...flatRows.map((r) => [
        `${r.TIMEHOUR}:00`,
        r.Name || r.MatCode,
        r.Model_Count || 0,
      ]),
    ]
      .map((r) => r.join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `hourly_model_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        background: "#fff",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div className="flex items-center gap-2">
          <MdSchedule size={13} className="text-sky-500" />
          <span className="text-xs font-semibold text-slate-700">
            Model-wise Hourly Breakdown
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            {flatRows.length} rows · {grandTotal.toLocaleString()} units
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={exportCSV}
            title="Export CSV"
            className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <MdDownload size={13} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MdClose size={14} />
          </button>
        </div>
      </div>

      {/* Stacked bar chart strip — unchanged */}
      <div
        style={{
          height: 100,
          flexShrink: 0,
          padding: "5px 12px 3px",
          borderBottom: "1px solid #f1f5f9",
          background: "#fafbfc",
        }}
      >
        <Bar
          data={{
            labels: hours.map((h) => `${h}:00`),
            datasets: chartDatasets,
          }}
          options={makeStackedOptions(maxHourTotal)}
        />
      </div>

      {/* ── Flat list table: Time | Model Name | Count ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table
            style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}
          >
            <thead>
              <tr
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  background: "#f8fafc",
                }}
              >
                <th
                  style={{
                    padding: "8px 16px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#64748b",
                    borderBottom: "2px solid #e2e8f0",
                    width: 80,
                  }}
                >
                  Time
                </th>
                <th
                  style={{
                    padding: "8px 16px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#64748b",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  Model Name
                </th>
                <th
                  style={{
                    padding: "8px 16px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#64748b",
                    borderBottom: "2px solid #e2e8f0",
                    width: 80,
                  }}
                >
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((row, i) => {
                const color = modelColorMap[row.MatCode] || "#94a3b8";
                const prevHour = i > 0 ? flatRows[i - 1].TIMEHOUR : null;
                const isNewHour = row.TIMEHOUR !== prevHour;
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      borderTop:
                        isNewHour && i > 0 ? "1px solid #e2e8f0" : undefined,
                      background: isNewHour ? "rgba(14,165,233,0.03)" : "#fff",
                    }}
                  >
                    {/* Time — only show on first row of each hour group */}
                    <td
                      style={{
                        padding: "7px 16px",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        fontSize: 11,
                        color: isDay(row.TIMEHOUR) ? "#0ea5e9" : "#8b5cf6",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isNewHour ? `${row.TIMEHOUR}:00` : ""}
                    </td>
                    {/* Model Name */}
                    <td
                      style={{
                        padding: "7px 16px",
                        color: "#334155",
                        fontSize: 11,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: color,
                            flexShrink: 0,
                          }}
                        />
                        {row.Name || row.MatCode}
                      </div>
                    </td>
                    {/* Count */}
                    <td
                      style={{
                        padding: "7px 16px",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        color,
                      }}
                    >
                      {(row.Model_Count || 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grand total footer */}
        <div
          style={{
            height: 32,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderTop: "2px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "#94a3b8",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Total
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            {grandTotal.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Total Model Panel ─────────────────────────────────────────────────────────
const TotalModelPanel = ({ modelData, onClose }) => {
  const modelTotals = useMemo(() => {
    const map = {};
    for (const item of modelData) {
      if (!map[item.MatCode])
        map[item.MatCode] = {
          MatCode: item.MatCode,
          Name: item.Name || item.MatCode,
          Category: item.Category,
          Total: 0,
        };
      map[item.MatCode].Total += item.Model_Count || 0;
    }
    return Object.values(map).sort((a, b) => b.Total - a.Total);
  }, [modelData]);

  const grandTotal = modelTotals.reduce((s, m) => s + m.Total, 0);
  const maxVal = modelTotals[0]?.Total || 0;

  const exportCSV = () => {
    const csv = [
      ["#", "MatCode", "Name", "Category", "Count", "%"],
      ...modelTotals.map((m, i) => [
        i + 1,
        m.MatCode,
        m.Name,
        m.Category,
        m.Total,
        grandTotal > 0 ? ((m.Total / grandTotal) * 100).toFixed(1) + "%" : "0%",
      ]),
    ]
      .map((r) => r.join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `total_model_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const chartHeight = Math.max(160, modelTotals.length * 24);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        background: "#fff",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div className="flex items-center gap-2">
          <MdLeaderboard size={13} className="text-teal-500" />
          <span className="text-xs font-semibold text-slate-700">
            Total Model Summary
          </span>
          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 text-[9px] font-mono">
            {modelTotals.length} models · {grandTotal.toLocaleString()} units
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={exportCSV}
            title="Export CSV"
            className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <MdDownload size={13} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MdClose size={14} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {/* Ranked table */}
        <div
          style={{
            width: "48%",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #f1f5f9",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                fontSize: 11,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#f8fafc",
                    zIndex: 1,
                  }}
                >
                  {["#", "Model Name", "Count", "Share"].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "6px 8px",
                        textAlign: i >= 2 ? "right" : "left",
                        color: "#94a3b8",
                        fontWeight: 600,
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelTotals.map((model, i) => {
                  const pct =
                    grandTotal > 0
                      ? ((model.Total / grandTotal) * 100).toFixed(1)
                      : "0.0";
                  const frac = model.Total / Math.max(maxVal, 1);
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #f8fafc",
                        background: heatBg(frac),
                      }}
                    >
                      <td
                        style={{
                          padding: "5px 8px",
                          color: "#cbd5e1",
                          fontFamily: "monospace",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td style={{ padding: "5px 8px", maxWidth: 140 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              flexShrink: 0,
                              background: MODEL_COLORS[i % MODEL_COLORS.length],
                            }}
                          />
                          <span
                            style={{
                              color: "#475569",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 10.5,
                            }}
                            title={model.Name}
                          >
                            {model.Name}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: MODEL_COLORS[i % MODEL_COLORS.length],
                        }}
                      >
                        {model.Total.toLocaleString()}
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "right" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 4,
                          }}
                        >

                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "#94a3b8",
                              width: 32,
                              textAlign: "right",
                              fontSize: 10,
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            style={{
              height: 28,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 10px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Total
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 12,
                color: "#1e293b",
              }}
            >
              {grandTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Horizontal bar chart */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            padding: "8px 10px",
          }}
        >
          <div style={{ height: chartHeight, minHeight: "100%" }}>
            <Bar
              data={{
                labels: modelTotals.map((m) =>
                  m.Name.length > 18 ? m.Name.slice(0, 16) + "…" : m.Name,
                ),
                datasets: [
                  {
                    label: "Count",
                    data: modelTotals.map((m) => m.Total),
                    backgroundColor: modelTotals.map(
                      (_, i) => MODEL_COLORS[i % MODEL_COLORS.length],
                    ),
                    borderWidth: 0,
                    borderRadius: 3,
                  },
                ],
              }}
              options={makeHorizOptions(maxVal)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main HourlyWidget ─────────────────────────────────────────────────────────
const HourlyWidget = ({
  title,
  data = [],
  modelData = [],
  datasets = [],
  isCategoryChart = false,
  icon: Icon,
}) => {
  const [chartType, setChartType] = useState("bar");
  const [showCumul, setShowCumul] = useState(false);
  const [modelPanel, setModelPanel] = useState(null); // null | "hourly" | "total"

  const hasModelData = modelData?.length > 0;

  const total = useMemo(
    () =>
      datasets.reduce(
        (s, ds) => s + data.reduce((r, row) => r + (row[ds.key] || 0), 0),
        0,
      ),
    [data, datasets],
  );
  const rowTotals = useMemo(
    () =>
      data.map((row) => datasets.reduce((s, ds) => s + (row[ds.key] || 0), 0)),
    [data, datasets],
  );
  const peakIdx = useMemo(
    () => rowTotals.indexOf(Math.max(...rowTotals, 0)),
    [rowTotals],
  );
  const peakRow = data[peakIdx];
  const avgPerRow = data.length > 0 ? Math.round(total / data.length) : 0;

  const cumulative = useMemo(() => {
    let cum = 0;
    return rowTotals.map((v) => (cum += v));
  }, [rowTotals]);

  const shiftTotals = useMemo(
    () =>
      data.reduce(
        (acc, row, i) => {
          const h = row.TIMEHOUR ?? -1;
          if (h >= 8 && h < 20) acc.day += rowTotals[i];
          else acc.night += rowTotals[i];
          return acc;
        },
        { day: 0, night: 0 },
      ),
    [data, rowTotals],
  );
  const dayPct = total > 0 ? Math.round((shiftTotals.day / total) * 100) : 0;

  if (isCategoryChart)
    return <CategoryWidget title={title} data={data} icon={Icon} />;

  const exportCSV = () => {
    if (!data.length) return;
    const headers = [
      "Hr#",
      "Time",
      ...datasets.map((d) => d.label),
      "Total",
      "Cumulative",
    ];
    const rows = data.map((row, i) => [
      row.HOUR_NUMBER || row.HourNumber || i + 1,
      `${row.TIMEHOUR ?? ""}:00`,
      ...datasets.map((d) => row[d.key] || 0),
      rowTotals[i],
      cumulative[i],
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${title.replace(/\s+/g, "_")}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const labels = data.map((r) => `${r.TIMEHOUR ?? "?"}:00`);
  const allVals = datasets.flatMap((ds) => data.map((r) => r[ds.key] || 0));
  const maxVal = Math.max(...allVals, avgPerRow, 0);
  const chartDatasets = datasets.map((ds) => ({
    label: ds.label,
    data: data.map((r) => r[ds.key] || 0),
    backgroundColor: data.map((r) =>
      isDay(r.TIMEHOUR ?? -1) ? DAY_COLOR : NIGHT_COLOR,
    ),
    borderColor: data.map((r) =>
      isDay(r.TIMEHOUR ?? -1) ? DAY_COLOR : NIGHT_COLOR,
    ),
    borderWidth: chartType === "line" ? 1.5 : 0,
    borderRadius: chartType === "bar" ? 3 : 0,
    pointBackgroundColor: data.map((r) =>
      isDay(r.TIMEHOUR ?? -1) ? DAY_COLOR : NIGHT_COLOR,
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
  const showAvgLine = avgPerRow > 0;
  const showLegend = datasets.length > 1 || showAvgLine;
  const finalDatasets = showAvgLine
    ? [...chartDatasets, avgDataset]
    : chartDatasets;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Overlay panels */}
      {modelPanel === "hourly" && hasModelData && (
        <HourlyModelPanel
          modelData={modelData}
          onClose={() => setModelPanel(null)}
        />
      )}
      {modelPanel === "total" && hasModelData && (
        <TotalModelPanel
          modelData={modelData}
          onClose={() => setModelPanel(null)}
        />
      )}

      {/* Header */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={13} className="text-slate-400" />}
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {hasModelData && (
            <>
              <button
                onClick={() =>
                  setModelPanel((p) => (p === "hourly" ? null : "hourly"))
                }
                title="Model-wise Hourly Breakdown"
                className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-semibold
                  transition-all border ${
                    modelPanel === "hourly"
                      ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                      : "text-sky-600 border-sky-200 bg-sky-50 hover:bg-sky-100"
                  }`}
              >
                <MdSchedule size={11} />
                <span>Hourly</span>
              </button>
              <button
                onClick={() =>
                  setModelPanel((p) => (p === "total" ? null : "total"))
                }
                title="Total Model Summary"
                className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-semibold
                  transition-all border ${
                    modelPanel === "total"
                      ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                      : "text-teal-600 border-teal-200 bg-teal-50 hover:bg-teal-100"
                  }`}
              >
                <MdLeaderboard size={11} />
                <span>Total</span>
              </button>
              <div
                style={{
                  width: 1,
                  height: 14,
                  background: "#e2e8f0",
                  margin: "0 2px",
                }}
              />
            </>
          )}
          <button
            onClick={() => setShowCumul((p) => !p)}
            title="Toggle running total"
            className={`p-1 rounded transition-colors ${
              showCumul
                ? "bg-sky-100 text-sky-600"
                : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"
            }`}
          >
            <MdFunctions size={13} />
          </button>
          <span className="font-mono text-sm font-bold text-slate-800 mx-1">
            {total.toLocaleString()}
          </span>
          <button
            onClick={exportCSV}
            title="Export CSV"
            className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <MdDownload size={13} />
          </button>
        </div>
      </div>

      {/* Shift bar */}
      {data.length > 0 && (
        <div
          style={{
            height: 28,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 8,
            borderBottom: "1px solid #f8fafc",
          }}
        >
          <MdWbSunny size={10} className="text-sky-400 shrink-0" />
          <span
            style={{
              fontSize: 10,
              color: "#64748b",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {shiftTotals.day.toLocaleString()}
          </span>
          <div
            style={{
              flex: 1,
              height: 4,
              background: "#f1f5f9",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${dayPct}%`,
                background: "linear-gradient(90deg,#0ea5e9,#38bdf8)",
                borderRadius: 2,
                transition: "width 0.6s",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 10,
              color: "#64748b",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {shiftTotals.night.toLocaleString()}
          </span>
          <MdNightlight size={10} className="text-violet-400 shrink-0" />
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {peakRow && (
              <span
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-600"
                style={{ fontSize: 9 }}
              >
                <MdBolt size={9} />
                {peakRow.TIMEHOUR}:00
              </span>
            )}
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500"
              style={{ fontSize: 9 }}
            >
              <MdTrendingUp size={9} />
              {avgPerRow.toLocaleString()}/hr
            </span>
          </div>
        </div>
      )}

      {/* Body */}
      {data.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* Table */}
          <div
            style={{
              width: "38%",
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid #f1f5f9",
              overflow: "hidden",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto" }}>
              <table
                style={{
                  width: "100%",
                  fontSize: 10.5,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "#f8fafc",
                      zIndex: 1,
                    }}
                  >
                    <th
                      style={{
                        padding: "5px 6px",
                        color: "#94a3b8",
                        fontWeight: 600,
                        textAlign: "center",
                        borderBottom: "1px solid #f1f5f9",
                        width: 28,
                      }}
                    >
                      Hr
                    </th>
                    <th
                      style={{
                        padding: "5px 6px",
                        color: "#94a3b8",
                        fontWeight: 600,
                        textAlign: "center",
                        borderBottom: "1px solid #f1f5f9",
                        width: 38,
                      }}
                    >
                      Time
                    </th>
                    {datasets.map((ds) => (
                      <th
                        key={ds.key}
                        style={{
                          padding: "5px 6px",
                          color: "#94a3b8",
                          fontWeight: 600,
                          textAlign: "right",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {ds.label}
                      </th>
                    ))}
                    {datasets.length > 1 && (
                      <th
                        style={{
                          padding: "5px 6px",
                          color: "#94a3b8",
                          fontWeight: 600,
                          textAlign: "right",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        Tot
                      </th>
                    )}
                    <th
                      style={{
                        padding: "5px 6px",
                        color: "#94a3b8",
                        fontWeight: 600,
                        textAlign: "right",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      %
                    </th>
                    {showCumul && (
                      <th
                        style={{
                          padding: "5px 6px",
                          color: "#94a3b8",
                          fontWeight: 600,
                          textAlign: "right",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        Cum
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const rTotal = rowTotals[i];
                    const frac = total > 0 ? rTotal / total : 0;
                    const isPeak = i === peakIdx;
                    const bg = isPeak
                      ? "rgba(245,158,11,0.08)"
                      : heatBg(rTotal / Math.max(...rowTotals, 1));
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid #f8fafc",
                          background: bg,
                        }}
                      >
                        <td
                          style={{
                            padding: "4px 6px",
                            textAlign: "center",
                            color: "#cbd5e1",
                            fontFamily: "monospace",
                          }}
                        >
                          {row.HOUR_NUMBER || row.HourNumber || i + 1}
                        </td>
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 500,
                              color: isDay(row.TIMEHOUR ?? -1)
                                ? "#0ea5e9"
                                : "#8b5cf6",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            {row.TIMEHOUR ?? "?"}:00
                            {isPeak && (
                              <MdBolt size={8} style={{ color: "#f59e0b" }} />
                            )}
                          </span>
                        </td>
                        {datasets.map((ds) => (
                          <td
                            key={ds.key}
                            style={{
                              padding: "4px 6px",
                              textAlign: "right",
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "#1e293b",
                            }}
                          >
                            {(row[ds.key] || 0).toLocaleString()}
                          </td>
                        ))}
                        {datasets.length > 1 && (
                          <td
                            style={{
                              padding: "4px 6px",
                              textAlign: "right",
                              fontFamily: "monospace",
                              color: "#475569",
                            }}
                          >
                            {rTotal.toLocaleString()}
                          </td>
                        )}
                        <td
                          style={{
                            padding: "4px 6px",
                            textAlign: "right",
                            fontFamily: "monospace",
                            color: "#94a3b8",
                            fontSize: 10,
                          }}
                        >
                          {(frac * 100).toFixed(1)}%
                        </td>
                        {showCumul && (
                          <td
                            style={{
                              padding: "4px 6px",
                              textAlign: "right",
                              fontFamily: "monospace",
                              color: "#475569",
                              fontSize: 10,
                            }}
                          >
                            {cumulative[i].toLocaleString()}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              style={{
                height: 28,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 10px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 12,
                  color: "#1e293b",
                }}
              >
                {total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Chart */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              padding: "6px 10px 8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 4,
                marginBottom: 4,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginRight: "auto",
                  fontSize: 9,
                  color: "#94a3b8",
                }}
              >
                {[
                  ["Day", DAY_COLOR, 8],
                  ["Night", NIGHT_COLOR, 8],
                ].map(([label, color, size]) => (
                  <span
                    key={label}
                    style={{ display: "flex", alignItems: "center", gap: 3 }}
                  >
                    <span
                      style={{
                        width: size,
                        height: size,
                        borderRadius: 2,
                        background: color,
                        display: "inline-block",
                      }}
                    />
                    {label}
                  </span>
                ))}
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span
                    style={{
                      width: 12,
                      height: 2,
                      background: AVG_COLOR,
                      display: "inline-block",
                      borderRadius: 1,
                    }}
                  />
                  Avg
                </span>
              </div>
              {[
                ["bar", MdBarChart],
                ["line", MdShowChart],
              ].map(([type, Ico]) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`p-1 rounded transition-colors ${chartType === type ? "bg-slate-100 text-slate-700" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
                >
                  <Ico size={13} />
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              {chartType === "bar" ? (
                <Bar
                  data={{ labels, datasets: finalDatasets }}
                  options={makeOptions(maxVal, showLegend)}
                />
              ) : (
                <Line
                  data={{ labels, datasets: finalDatasets }}
                  options={makeOptions(maxVal, showLegend)}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "#cbd5e1",
          }}
        >
          <MdBarChart size={26} />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            No data — select a range and query
          </span>
        </div>
      )}
    </div>
  );
};

export default HourlyWidget;
