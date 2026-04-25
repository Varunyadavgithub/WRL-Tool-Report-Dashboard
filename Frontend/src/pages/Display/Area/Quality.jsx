import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, DoughnutController, Tooltip, Legend } from "chart.js";
import { Chart } from "react-chartjs-2";
import { PageHeader, TimerBar, StatCard, DonutCanvas } from "../Monitoring";

ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend);

const ACCENT = "#15803d";

const Quality = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { summary: qs = {}, defects = [] } = apiData;

  const pieData = useMemo(
    () => ({
      labels: ["OK Units", "Defect Units"],
      datasets: [{
        type: "doughnut",
        data: [qs.OkUnit || 0, qs.DefectUnit || 0],
        backgroundColor: ["rgba(21,128,61,0.85)", "rgba(220,38,38,0.85)"],
        borderColor: ["#15803d", "#b91c1c"],
        borderWidth: 3,
        hoverOffset: 0,
      }],
    }),
    [qs],
  );

  const pieOptions = useMemo(
    () => ({
      responsive: false,
      cutout: "65%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` },
          titleFont: { size: 14 }, bodyFont: { size: 13 }, padding: 12,
        },
      },
      animation: { duration: 400 },
    }),
    [],
  );

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader title="Quality Performance" shift={shift} shiftDate={shiftDate} accentHex={ACCENT} />
      <TimerBar progress={progress} accentHex={ACCENT} />

      {/* ── Hero KPI Strip ── */}
      <div className="grid grid-cols-7 gap-3 px-5 py-3 bg-slate-50 shrink-0">
        <StatCard label="Plan" value={qs.Plan} accentHex="#7c3aed" />
        <StatCard label="Achieved" value={qs.TotalAchieved} accentHex="#15803d" />
        <StatCard label="OK Units" value={qs.OkUnit} accentHex="#059669" />
        <StatCard label="Defects" value={qs.DefectUnit} accentHex="#ef4444" />
        <StatCard label="Rework Done" value={qs.ReworkDone} accentHex="#f59e0b" />
        <StatCard label="OK %" value={qs.OkPct != null ? `${qs.OkPct}%` : null} accentHex="#0f766e" sub="First pass yield" />
        <StatCard label="Defect %" value={qs.DefectPct != null ? `${qs.DefectPct}%` : null} accentHex="#dc2626" />
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 min-h-0 px-4 py-3 gap-4">
        {/* Large doughnut */}
        <div className="w-[35%] shrink-0 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm p-6 gap-4">
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Quality Overview</p>
          <div className="relative">
            <Chart
              key={`q-${qs.OkUnit}-${qs.DefectUnit}`}
              type="doughnut" data={pieData} options={pieOptions}
              width={280} height={280}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-[40px] font-black text-slate-900 leading-none">
                {qs.TotalAchieved ?? 0}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-semibold">Total</div>
            </div>
          </div>
          <div className="flex gap-6 text-sm font-bold">
            <span className="flex items-center gap-2 text-green-700">
              <span className="w-4 h-4 bg-green-700 rounded inline-block" /> OK: {qs.OkUnit ?? 0}
            </span>
            <span className="flex items-center gap-2 text-red-500">
              <span className="w-4 h-4 bg-red-500 rounded inline-block" /> Defect: {qs.DefectUnit ?? 0}
            </span>
          </div>
        </div>

        {/* Defects table */}
        <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div
            className="text-white font-bold text-sm text-center py-2.5 tracking-wider uppercase shrink-0"
            style={{ background: ACCENT }}
          >
            Top Defects Today
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h) => (
                    <th
                      key={h}
                      className="bg-emerald-50 px-4 py-3 border-b border-slate-200 text-left font-bold text-xs uppercase tracking-wider"
                      style={{ color: ACCENT }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defects.length > 0 ? (
                  defects.map((df, i) => (
                    <tr key={i} className={`transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                      <td className="px-4 py-3 border-b border-slate-100 text-center text-slate-400 font-mono w-16">
                        {df.SrNo}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">
                        {df.DefectName}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 text-center w-24">
                        <span className="inline-block bg-red-50 text-red-600 font-black text-lg px-3 py-0.5 rounded-lg border border-red-200">
                          {df.DefectCount}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400 text-base">
                      No defects recorded this shift ✓
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