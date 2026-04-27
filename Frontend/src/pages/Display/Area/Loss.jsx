import { useMemo, useState, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { PackageOpen } from "lucide-react";
import { PageHeader, TimerBar, StatCard } from "../Monitoring";

ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend);

const ACCENT = "#b45309";

const Loss = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;
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

  const consumedPct = Number(ls.ConsumedTimePct || 0);
  const remaining = 100 - Math.min(Math.max(consumedPct, 0), 100);

  const donutData = useMemo(
    () => ({
      labels: ["Consumed", "Remaining"],
      datasets: [
        {
          type: "doughnut",
          data: [Math.min(Math.max(consumedPct, 0), 100), remaining],
          backgroundColor: ["rgba(245,158,11,0.85)", "rgba(241,245,249,0.9)"],
          borderColor: ["#f59e0b", "#e2e8f0"],
          borderWidth: 3,
          borderRadius: consumedPct > 0 && consumedPct < 100 ? 6 : 0,
          spacing: 2,
          hoverOffset: 8,
        },
      ],
    }),
    [consumedPct, remaining],
  );

  const donutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      cutout: "68%",
      rotation: -90,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: externalTooltipHandler },
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

  const sorted = useMemo(
    () =>
      [...stations].sort(
        (a, b) => (b.TotalStopCount ?? 0) - (a.TotalStopCount ?? 0),
      ),
    [stations],
  );
  const totalStopCount = useMemo(
    () => stations.reduce((sum, s) => sum + (s.TotalStopCount ?? 0), 0),
    [stations],
  );

  const statusColor =
    consumedPct >= 90 ? "#dc2626" : consumedPct >= 70 ? "#f59e0b" : "#16a34a";
  const statusLabel =
    consumedPct >= 90 ? "Critical" : consumedPct >= 70 ? "Warning" : "On Track";

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Loss Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />
        <div className="grid grid-cols-4 gap-2.5 px-4 py-2.5 bg-slate-50">
          <StatCard label="Plan" value={ls.Plan} accentHex="#7c3aed" />
          <StatCard label="Achieved" value={ls.Achieved} accentHex="#15803d" />
          <StatCard label="Balance" value={ls.Remaining} accentHex="#ef4444" />
          <StatCard
            label="Time Consumed"
            value={
              ls.ConsumedTimePct != null
                ? `${Number(ls.ConsumedTimePct).toFixed(0)}%`
                : null
            }
            accentHex="#f59e0b"
            sub="of shift elapsed"
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 px-4 py-2 gap-4">
        {/* LEFT — Donut */}
        <div
          className="w-[55%] shrink-0 rounded-2xl border-2 shadow-md overflow-hidden flex flex-col items-center justify-center relative"
          style={{
            borderColor: `${ACCENT}20`,
            background: `linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.04] rounded-2xl"
            style={{
              background: `radial-gradient(circle at 50% 60%, ${ACCENT}, transparent 70%)`,
            }}
          />
          <div className="text-center mb-3 z-10">
            <p
              className="text-lg font-extrabold uppercase tracking-[0.2em] font-mono"
              style={{ color: ACCENT }}
            >
              Consumed Time
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Shift Time Utilization
            </p>
          </div>

          <div className="relative w-full max-w-[260px] aspect-square z-10">
            <Chart
              ref={chartRef}
              key={`loss-${consumedPct}`}
              type="doughnut"
              data={donutData}
              options={donutOptions}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <span className="text-4xl md:text-5xl font-black text-black leading-none drop-shadow-sm">
                {consumedPct.toFixed(0)}%
              </span>
              <span className="text-xs text-black font-bold mt-1 uppercase tracking-wider">
                Elapsed
              </span>
            </div>
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
                    {Number(tooltip.value).toFixed(1)}%
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="w-3 h-3 bg-slate-900 rotate-45 -mt-1.5" />
                </div>
              </div>
            )}
          </div>

          <div className="z-10 flex flex-col items-center mt-3">
            <div
              className="px-10 py-3 rounded-2xl text-white font-black text-4xl font-mono tracking-[0.15em] shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}dd)`,
                boxShadow: `0 8px 30px ${ACCENT}40`,
              }}
            >
              {totalStopCount.toLocaleString()}
              <span className="text-white/60 text-lg ml-1">stops</span>
            </div>
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
                {consumedPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {stations.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mt-4 z-10">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
                <span className="w-3.5 h-3.5 bg-amber-600 rounded-md shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider">
                    Stops
                  </span>
                  <span className="text-base font-black text-amber-700 font-mono leading-tight">
                    {totalStopCount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-200">
                <span className="w-3.5 h-3.5 bg-blue-600 rounded-md shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">
                    Stations
                  </span>
                  <span className="text-base font-black text-blue-700 font-mono leading-tight">
                    {stations.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Table (only Station Name & Stop Count) */}
        <div className="w-[45%] flex flex-col min-w-0">
          <div
            className="text-white font-bold text-sm text-center py-2.5 rounded-t-xl tracking-wider uppercase flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-white/50" /> Station-wise
            Loss Breakdown
          </div>
          <div className="flex-1 overflow-auto bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["Station Name", "Stop Count"].map((h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2.5 text-white font-bold border border-white/20 text-sm uppercase tracking-wider ${i === 0 ? "text-left" : "text-center"}`}
                      style={{ background: ACCENT }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const isHigh = s.TotalStopCount > 10;
                  const rowBg = isHigh
                    ? "#fef3c7"
                    : i % 2 === 0
                      ? "#fff"
                      : "#f8fafc";
                  return (
                    <tr key={i} style={{ background: rowBg }}>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-700 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          {isHigh && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                          )}
                          <span className="truncate">{s.StationName}</span>
                        </div>
                      </td>
                      <td
                        className={`px-3 py-2.5 border-b border-slate-100 text-center font-bold font-mono text-sm ${isHigh ? "text-red-500" : "text-slate-700"}`}
                      >
                        {s.TotalStopCount}
                      </td>
                    </tr>
                  );
                })}
                {stations.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-16 text-center text-slate-400 border border-slate-100"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <PackageOpen
                          className="w-14 h-14 opacity-20"
                          strokeWidth={1.2}
                        />
                        <p className="text-lg">
                          No loss data recorded this shift
                        </p>
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

export default Loss;
