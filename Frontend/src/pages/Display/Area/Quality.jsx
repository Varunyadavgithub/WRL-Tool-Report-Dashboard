import { useMemo } from "react";
import { Chart as ChartJS, ArcElement, DoughnutController, Tooltip, Legend } from "chart.js";
import { Chart } from "react-chartjs-2";
import { PageHeader, TimerBar, DonutCanvas } from "../Monitoring";

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
        borderWidth: 2,
        hoverOffset: 0,
      }],
    }),
    [qs],
  );

  const pieOptions = useMemo(
    () => ({
      responsive: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
      },
      animation: { duration: 400 },
    }),
    [],
  );

  const sidebarRows = [
    ["Plan", qs.Plan], ["Achieved", qs.TotalAchieved], ["OK Unit", qs.OkUnit],
    ["Defect", qs.DefectUnit], ["Rework", qs.ReworkDone],
    ["OK %", qs.OkPct != null ? `${qs.OkPct}%` : null],
    ["Defect %", qs.DefectPct != null ? `${qs.DefectPct}%` : null],
  ];

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader title="Quality Performance" shift={shift} shiftDate={shiftDate} accentHex={ACCENT} />
      <TimerBar progress={progress} accentHex={ACCENT} />
      <div className="flex flex-1 min-h-0">
        <div className="w-[190px] shrink-0 flex flex-col gap-2.5 px-3 py-3.5 bg-slate-50 border-r border-slate-100 justify-center">
          <div className="relative flex justify-center">
            <DonutCanvas pct={qs.ConsumedTimePct} size={130} fillColor="#22c55e" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-xl font-extrabold text-slate-900">{Number(qs.ConsumedTimePct || 0).toFixed(0)}%</div>
              <div className="text-[9px] text-slate-400">Time</div>
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
            {sidebarRows.map(([k, v], i) => (
              <div key={i} className={`flex justify-between px-2.5 py-1 text-[11px] text-slate-400 border-b border-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                <span>{k}</span>
                <strong className="text-slate-900">{v ?? "—"}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-around px-5 py-3 gap-5 min-w-0">
          <div className="flex flex-col items-center gap-2.5">
            <p className="text-[13px] text-slate-900 font-bold">Quality Overview</p>
            <div className="relative">
              <Chart key={`q-${qs.OkUnit}-${qs.DefectUnit}`} type="doughnut" data={pieData} options={pieOptions} width={200} height={200} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-[26px] font-extrabold text-slate-900">{qs.TotalAchieved ?? 0}</div>
                <div className="text-[10px] text-slate-400">Total</div>
              </div>
            </div>
            <div className="flex gap-3.5 text-[11px]">
              <span className="flex items-center gap-1 text-green-700">
                <span className="w-2.5 h-2.5 bg-green-700 rounded-sm inline-block" /> OK: {qs.OkUnit ?? 0}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-sm inline-block" /> Defect: {qs.DefectUnit ?? 0}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-[13px] text-center py-2 rounded-t-lg" style={{ background: ACCENT }}>
              Top Defects Today
            </div>
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h) => (
                    <th key={h} className="bg-emerald-100 px-2.5 py-1.5 border border-slate-100 text-left font-bold" style={{ color: ACCENT }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defects.length > 0 ? (
                  defects.map((df, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                      <td className="px-2.5 py-1.5 border border-slate-100 text-center text-slate-400">{df.SrNo}</td>
                      <td className="px-2.5 py-1.5 border border-slate-100 text-slate-700">{df.DefectName}</td>
                      <td className="px-2.5 py-1.5 border border-slate-100 text-center font-extrabold text-red-500">{df.DefectCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400 border border-slate-100">No defects recorded this shift</td>
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