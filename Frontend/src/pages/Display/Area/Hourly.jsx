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

  const chartData = useMemo(
    () => ({
      labels: hours.map((h) => `H${h.HourNo}`),
      datasets: [
        {
          type: "line",
          label: "Target",
          data: hours.map((h) => h.Target),
          backgroundColor: "rgba(30,64,175,0.7)",
          borderColor: "#1e40af",
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "Actual",
          data: hours.map((h) => h.Actual),
          backgroundColor: "rgba(245,158,11,0.85)",
          borderColor: "#d97706",
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "Loss",
          data: hours.map((h) => h.HourLoss),
          borderColor: "#ef4444",
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: "#ef4444",
          tension: 0.3,
          fill: false,
          yAxisID: "y2",
        },
      ],
    }),
    [hours],
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          padding: 14,
          cornerRadius: 10,
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
        },
        datalabels: {
          display: true,
          anchor: (ctx) => (ctx.dataset.type === "line" ? "center" : "end"),
          align: (ctx) => (ctx.dataset.type === "line" ? "top" : "top"),
          color: (ctx) => {
            if (ctx.dataset.label === "Target") return "#1e40af";
            if (ctx.dataset.label === "Actual") return "#d97706";
            return "#ef4444";
          },
          font: { size: 10, weight: "bold" },
          formatter: (value) => (value != null && value !== 0 ? value : ""),
          padding: 2,
          clip: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            font: { size: 12, weight: "bold" },
            maxRotation: 0,
          },
        },
        y: {
          position: "left",
          beginAtZero: true,
          ticks: { color: "#64748b", font: { size: 11 } },
          grid: { color: "#f1f5f9" },
        },
        y2: {
          position: "right",
          beginAtZero: true,
          ticks: { color: "#ef4444", font: { size: 11 } },
          grid: { display: false },
        },
      },
    }),
    [],
  );

  const tableRows = [
    { label: "Target", vals: hours.map((h) => h.Target), color: "#1e40af" },
    { label: "Actual", vals: hours.map((h) => h.Actual), color: "#0f172a" },
    {
      label: "Cumul. Loss",
      vals: hours.map((h) => h.CumulativeLoss),
      color: "#ef4444",
    },
    {
      label: "Achiev. %",
      isObj: true,
      vals: hours.map((h) => {
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
                  {hours.map((h, i) => (
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
                    {hours.map((_, ci) => {
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

          <div className="flex-1 bg-white border border-slate-100 rounded-xl px-4 pt-3 pb-2 min-h-[200px] flex flex-col shadow-sm">
            <div className="flex gap-5 justify-center mb-2 text-xs">
              {[
                ["#1e40af", "Target"],
                ["#d97706", "Actual"],
                ["#ef4444", "Loss"],
              ].map(([cl, l]) => (
                <span
                  key={l}
                  className="flex items-center gap-1.5 text-slate-500 font-semibold"
                >
                  <span
                    className="w-3 h-3 rounded-sm inline-block"
                    style={{ background: cl }}
                  />
                  {l}
                </span>
              ))}
            </div>
            <div className="flex-1 relative min-h-0">
              <Chart
                key={`hrly-${hours.length}`}
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
