import { useMemo, useState, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { PageHeader, TimerBar, StatCard } from "../Monitoring";

ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend);

const ACCENT = "#15803d";

const Quality = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { summary: qs = {}, defects = [] } = apiData;
  const chartRef = useRef(null);
  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    label: "",
    value: "",
    color: "",
  });

  const externalTooltipHandler = useCallback((context) => {
    const { tooltip: tt } = context;

    if (tt.opacity === 0) {
      setTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
      return;
    }

    const { caretX, caretY } = tt;
    const dataPoint = tt.dataPoints?.[0];
    if (!dataPoint) return;

    setTooltip({
      show: true,
      x: caretX,
      y: caretY,
      label: dataPoint.label || "",
      value: dataPoint.raw ?? "",
      color: dataPoint.dataset.backgroundColor[dataPoint.dataIndex] || "#000",
    });
  }, []);

  const pieData = useMemo(
    () => ({
      labels: ["OK Units", "Defect Units"],
      datasets: [
        {
          type: "doughnut",
          data: [qs.OkUnit || 0, qs.DefectUnit || 0],
          backgroundColor: ["rgba(21,128,61,0.85)", "rgba(220,38,38,0.85)"],
          borderColor: ["#15803d", "#b91c1c"],
          borderWidth: 3,
          borderRadius: 6,
          spacing: 2,
          hoverOffset: 8,
        },
      ],
    }),
    [qs],
  );

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: "68%",
      rotation: -90,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: externalTooltipHandler,
        },
      },
      animation: {
        animateRotate: true,
        duration: 1400,
        easing: "easeInOutQuart",
      },
      hover: { mode: "nearest" },
    }),
    [externalTooltipHandler],
  );

  const okPct = qs.OkPct ?? 0;
  const defPct = qs.DefectPct ?? 0;

  const pct = okPct;
  const statusColor = pct >= 90 ? "#16a34a" : pct >= 70 ? "#f59e0b" : "#dc2626";
  const statusLabel =
    pct >= 90 ? "On Track" : pct >= 70 ? "Warning" : "Critical";

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Quality Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />

        {/* Hero KPI Strip */}
        <div className="grid grid-cols-7 gap-2.5 px-4 py-2.5 bg-slate-50">
          <StatCard label="Plan" value={qs.Plan} accentHex="#7c3aed" />
          <StatCard
            label="Achieved"
            value={qs.TotalAchieved}
            accentHex="#15803d"
          />
          <StatCard label="OK Units" value={qs.OkUnit} accentHex="#059669" />
          <StatCard label="Defects" value={qs.DefectUnit} accentHex="#ef4444" />
          <StatCard
            label="Rework Done"
            value={qs.ReworkDone}
            accentHex="#f59e0b"
          />
          <StatCard
            label="OK %"
            value={qs.OkPct != null ? `${qs.OkPct}%` : null}
            accentHex="#0f766e"
            sub="First pass yield"
          />
          <StatCard
            label="Defect %"
            value={qs.DefectPct != null ? `${qs.DefectPct}%` : null}
            accentHex="#dc2626"
          />
        </div>
      </div>

      {/* ── Main body — 55% Doughnut + 45% Table ── */}
      <div className="flex flex-1 min-h-0 px-4 py-2 gap-4">
        {/* LEFT — Doughnut */}
        <div
          className="w-[55%] shrink-0 rounded-2xl border-2 shadow-md overflow-hidden flex flex-col items-center justify-center relative"
          style={{
            borderColor: `${ACCENT}20`,
            background: `linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`,
          }}
        >
          {/* Background glow */}
          <div
            className="absolute inset-0 opacity-[0.04] rounded-2xl"
            style={{
              background: `radial-gradient(circle at 50% 60%, ${ACCENT}, transparent 70%)`,
            }}
          />

          {/* Top label */}
          <div className="text-center mb-3 z-10">
            <p
              className="text-lg font-extrabold uppercase tracking-[0.2em] font-mono"
              style={{ color: ACCENT }}
            >
              Quality Overview
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              OK vs Defect Distribution
            </p>
          </div>

          {/* Responsive donut */}
          <div className="relative w-full max-w-[260px] aspect-square z-10">
            <Chart
              ref={chartRef}
              key={`q-${qs.OkUnit}-${qs.DefectUnit}`}
              type="doughnut"
              data={pieData}
              options={pieOptions}
            />

            {/* Center overlay — behind tooltip */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <span className="text-4xl md:text-5xl font-black text-black leading-none drop-shadow-sm">
                {qs.TotalAchieved ?? 0}
              </span>
              <span className="text-xs text-black font-bold mt-1 uppercase tracking-wider">
                Total Units
              </span>
            </div>

            {/* Custom HTML tooltip — on top of everything */}
            {tooltip.show && (
              <div
                className="absolute z-50 pointer-events-none"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: "translate(-50%, -120%)",
                }}
              >
                <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-white/10 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: tooltip.color }}
                    />
                    <span className="text-sm font-bold">{tooltip.label}</span>
                  </div>
                  <div className="text-2xl font-black font-mono mt-0.5 text-center">
                    {Number(tooltip.value).toLocaleString()}
                  </div>
                </div>
                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-3 h-3 bg-slate-900 rotate-45 -mt-1.5" />
                </div>
              </div>
            )}
          </div>

          {/* Big value badge */}
          <div className="z-10 flex flex-col items-center mt-3">
            <div
              className="px-10 py-3 rounded-2xl text-white font-black text-4xl font-mono tracking-[0.15em] shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}dd)`,
                boxShadow: `0 8px 30px ${ACCENT}40`,
              }}
            >
              {String(qs.OkUnit ?? 0).padStart(3, "0")}
              <span className="text-white/60 text-lg ml-1">OK</span>
            </div>

            {/* Status pill */}
            <div
              className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full border-[1.5px]"
              style={{
                borderColor: `${statusColor}44`,
                background: `${statusColor}10`,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: statusColor }}
              />
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: statusColor }}
              >
                {statusLabel}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {okPct}% OK
              </span>
            </div>
          </div>

          {/* Legend pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-4 z-10">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-200">
              <span className="w-3.5 h-3.5 bg-green-700 rounded-md shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider">
                  OK Units
                </span>
                <span className="text-base font-black text-green-800 font-mono leading-tight">
                  {qs.OkUnit ?? 0}
                </span>
              </div>
              <span className="ml-1 text-[10px] font-bold text-green-500 bg-green-100 px-2 py-0.5 rounded-full">
                {okPct}%
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl border border-red-200">
              <span className="w-3.5 h-3.5 bg-red-600 rounded-md shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">
                  Defects
                </span>
                <span className="text-base font-black text-red-700 font-mono leading-tight">
                  {qs.DefectUnit ?? 0}
                </span>
              </div>
              <span className="ml-1 text-[10px] font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                {defPct}%
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — Defects table */}
        <div className="w-[45%] flex flex-col min-w-0">
          <div
            className="text-white font-bold text-sm text-center py-2.5 rounded-t-xl tracking-wider uppercase flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-white/50" />
            Top Defects Today
          </div>
          <div className="flex-1 overflow-auto bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2.5 text-white font-bold border border-white/20 text-sm uppercase tracking-wider ${
                        i === 1 ? "text-left" : "text-center"
                      }`}
                      style={{ background: ACCENT }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defects.length > 0 ? (
                  defects.map((df, i) => {
                    const isTop = i < 3;
                    return (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                      >
                        <td className="px-3 py-2.5 border-b border-slate-100 text-center text-slate-400 font-mono text-sm w-14">
                          {df.SrNo}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-700 font-semibold text-sm">
                          <div className="flex items-center gap-2">
                            {isTop && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            )}
                            {df.DefectName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-center w-24">
                          <span
                            className={`inline-block font-black text-lg px-3 py-0.5 rounded-lg border ${
                              isTop
                                ? "bg-red-50 text-red-600 border-red-200"
                                : "bg-amber-50 text-amber-600 border-amber-200"
                            }`}
                          >
                            {df.DefectCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-16 text-center text-slate-400 text-lg"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-4xl">✓</span>
                        <p>No defects recorded this shift</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quality;
