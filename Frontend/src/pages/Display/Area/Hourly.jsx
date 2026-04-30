import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Chart } from "react-chartjs-2";
import { PageHeader, TimerBar, StatCard } from "../Monitoring";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  ChartDataLabels,
  ChartTitle,
  Tooltip,
  Legend,
  Filler,
);

const ACCENT = "#7c3aed";

const Hourly = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { hours = [], summary = {} } = apiData;

  const hourStats = useMemo(
    () =>
      hours.map((h) => {
        const target = Number(h.Target) || 0;
        const actual = Number(h.Actual) || 0;
        const pct = target > 0 ? (actual / target) * 100 : 0;
        return { ...h, _target: target, _actual: actual, _pct: pct };
      }),
    [hours],
  );

  const chartData = useMemo(
    () => ({
      labels: hourStats.map((h) => `H${h.HourNo}`),
      datasets: [
        // ── Loss line — drawn ON TOP ──
        {
          type: "line",
          label: "Loss",
          data: hourStats.map((h) => h.HourLoss),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.1)",
          borderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointBackgroundColor: "#ef4444",
          pointBorderColor: "#fff",
          pointBorderWidth: 2.5,
          tension: 0.4,
          fill: false,
          yAxisID: "y2",
          order: 0, // drawn last → on top
        },
        // ── Target dashed line ──
        {
          type: "line",
          label: "Target",
          data: hourStats.map((h) => h._target),
          borderColor: "#1e40af",
          backgroundColor: "transparent",
          borderWidth: 2.5,
          borderDash: [8, 5],
          pointRadius: 0, // no dots — clean line
          pointHoverRadius: 5,
          pointBackgroundColor: "#1e40af",
          tension: 0,
          fill: false,
          yAxisID: "y",
          order: 1,
        },
        // ── Actual bars (the hero) ──
        {
          type: "bar",
          label: "Actual",
          data: hourStats.map((h) => h._actual),
          backgroundColor: "rgba(245,158,11,0.85)",
          borderColor: "#d97706",
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
          yAxisID: "y",
          order: 2, // drawn first → at bottom
        },
      ],
    }),
    [hourStats],
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 40, right: 12, bottom: 18, left: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 14,
          cornerRadius: 10,
          titleFont: { size: 14, weight: "bold" },
          bodyFont: { size: 13 },
          boxPadding: 6,
          callbacks: {
            title: (items) => `Hour ${items[0].label}`,
          },
        },
        datalabels: {
          display: (ctx) => {
            const v = ctx.dataset.data[ctx.dataIndex];
            // Hide Target labels (line is enough), only show Actual + Loss values
            if (ctx.dataset.label === "Target") return false;
            return v != null && v !== 0;
          },
          // 👇 anchor/align now depend on dataset
          anchor: (ctx) => {
            if (ctx.dataset.label === "Loss") return "center"; // sit on the dot
            return "end"; // top of bar
          },
          align: (ctx) => {
            if (ctx.dataset.label === "Loss") return "bottom"; // 🔴 red value goes DOWN
            return "top"; // 🟡 yellow value goes UP
          },
          offset: (ctx) => {
            if (ctx.dataset.label === "Loss") return 10; // push red label well below the dot
            if (ctx.dataset.label === "Actual") return 18; // push yellow label well above blue line
            return 4;
          },
          color: (ctx) => {
            if (ctx.dataset.label === "Actual") return "#92400e";
            return "#dc2626";
          },
          backgroundColor: (ctx) => {
            if (ctx.dataset.label === "Loss") return "rgba(255,255,255,0.95)";
            if (ctx.dataset.label === "Actual") return "rgba(255,255,255,0.9)"; // small pill so it floats over the blue line cleanly
            return null;
          },
          borderColor: (ctx) => {
            if (ctx.dataset.label === "Loss") return "#fecaca";
            if (ctx.dataset.label === "Actual") return "#fde68a";
            return null;
          },
          borderWidth: (ctx) =>
            ctx.dataset.label === "Loss" || ctx.dataset.label === "Actual"
              ? 1.5
              : 0,
          borderRadius: 6,
          padding: (ctx) =>
            ctx.dataset.label === "Loss" || ctx.dataset.label === "Actual"
              ? { top: 3, bottom: 3, left: 6, right: 6 }
              : 2,
          font: (ctx) => ({
            size: ctx.dataset.label === "Actual" ? 12 : 11,
            weight: 800,
          }),
          formatter: (value) => (value != null && value !== 0 ? value : ""),
          clip: false,
          clamp: true,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#e2e8f0" },
          ticks: {
            color: "#475569",
            font: { size: 13, weight: "bold" },
            maxRotation: 0,
            padding: 4,
          },
        },
        y: {
          position: "left",
          beginAtZero: true,
          border: { display: false },
          ticks: {
            color: "#94a3b8",
            font: { size: 11, weight: 600 },
            padding: 6,
          },
          grid: { color: "#f1f5f9", lineWidth: 1 },
          grace: "25%",
          title: {
            display: true,
            text: "Units Produced",
            color: "#64748b",
            font: { size: 11, weight: "bold" },
          },
        },
        y2: {
          position: "right",
          beginAtZero: true,
          border: { display: false },
          ticks: {
            color: "#ef4444",
            font: { size: 11, weight: 600 },
            padding: 6,
          },
          grid: { display: false },
          title: {
            display: true,
            text: "Loss",
            color: "#ef4444",
            font: { size: 11, weight: "bold" },
          },
        },
      },
    }),
    [],
  );

  const tableRows = [
    {
      label: "Target",
      vals: hourStats.map((h) => h._target),
      color: "#1e40af",
    },
    {
      label: "Actual",
      vals: hourStats.map((h) => h._actual),
      color: "#0f172a",
    },
    {
      label: "Cumul. Loss",
      vals: hourStats.map((h) => h.CumulativeLoss),
      color: "#ef4444",
    },
    {
      label: "Achiev. %",
      isObj: true,
      vals: hourStats.map((h) => {
        const a = Number(h.AchievementPct || 0);
        return { v: `${a.toFixed(0)}%`, c: a >= 85 ? "#15803d" : "#d97706" };
      }),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Hourly Production Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />
        <div className="grid grid-cols-4 gap-3 px-5 py-3 bg-slate-50">
          <StatCard
            label="Shift Plan"
            value={summary.ShiftPlan}
            accentHex="#7c3aed"
          />
          <StatCard
            label="Total Achieved"
            value={summary.TotalAchieved}
            accentHex="#15803d"
          />
          <StatCard
            label="Remaining"
            value={summary.Remaining}
            accentHex="#ef4444"
          />
          <StatCard
            label="Time Consumed"
            value={
              summary.ConsumedTimePct != null
                ? `${Number(summary.ConsumedTimePct).toFixed(0)}%`
                : null
            }
            accentHex="#f59e0b"
            sub="of shift elapsed"
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 px-4 py-3 gap-4">
        <div className="flex-1 flex flex-col min-w-0 gap-3">
          {/* Hour-by-hour table */}
          <div className="overflow-x-auto shrink-0">
            <table className="min-w-full border-separate border-spacing-0 text-[11px]">
              <thead>
                <tr>
                  <th
                    className="px-2.5 py-1.5 text-white font-bold border border-white/20 text-left"
                    style={{ background: ACCENT }}
                  >
                    Metric
                  </th>
                  {hourStats.map((h, i) => (
                    <th
                      key={i}
                      className="px-2 py-1.5 text-white font-bold border border-white/20 text-center min-w-[52px]"
                      style={{ background: ACCENT }}
                    >
                      H{h.HourNo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                  >
                    <td className="px-2.5 py-1 border border-slate-100 text-slate-700 font-semibold">
                      {row.label}
                    </td>
                    {hourStats.map((_, ci) => {
                      const item = row.isObj
                        ? row.vals[ci]
                        : { v: row.vals[ci], c: row.color };
                      return (
                        <td
                          key={ci}
                          className="px-2 py-1 border border-slate-100 text-center font-bold"
                          style={{ color: item.c }}
                        >
                          {item.v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart card */}
          <div className="flex-1 bg-white border border-slate-100 rounded-xl px-5 pt-3 pb-3 min-h-[220px] flex flex-col shadow-sm">
            {/* Clean legend pills */}
            <div className="flex gap-4 justify-center mb-3 text-xs">
              <span className="flex items-center gap-2 text-slate-700 font-bold">
                <span
                  className="w-4 h-3 rounded-sm"
                  style={{ background: "rgba(245,158,11,0.85)" }}
                />
                Actual Production
              </span>
              <span className="flex items-center gap-2 text-slate-700 font-bold">
                <span
                  className="w-5 h-0.5"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, #1e40af 0 5px, transparent 5px 9px)",
                  }}
                />
                Target
              </span>
              <span className="flex items-center gap-2 text-slate-700 font-bold">
                <span className="flex items-center gap-0.5">
                  <span className="w-2.5 h-0.5 bg-red-500" />
                  <span className="w-2 h-2 rounded-full bg-red-500 border border-white shadow-sm" />
                  <span className="w-2.5 h-0.5 bg-red-500" />
                </span>
                Loss
              </span>
            </div>

            <div className="flex-1 relative min-h-0">
              <Chart
                key={`hrly-${hourStats.length}`}
                type="bar"
                data={chartData}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hourly;
