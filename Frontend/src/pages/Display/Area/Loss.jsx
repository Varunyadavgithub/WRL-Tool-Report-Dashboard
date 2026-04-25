import { useMemo } from "react";
import { PackageOpen } from "lucide-react";
import { PageHeader, TimerBar, SidebarPanel } from "../Monitoring";

const ACCENT = "#b45309";

const Loss = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;
  const maxTime = useMemo(() => Math.max(...stations.map((s) => s.TotalStopTime ?? 0), 1), [stations]);

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader title="Loss Performance" shift={shift} shiftDate={shiftDate} accentHex={ACCENT} />
      <TimerBar progress={progress} accentHex={ACCENT} />
      <div className="flex flex-1 min-h-0">
        <SidebarPanel
          pct={ls.ConsumedTimePct}
          fillColor="#f59e0b"
          infoRows={[["Plan", ls.Plan], ["Achieved", ls.Achieved], ["Balance", ls.Remaining]]}
        />
        <div className="flex-1 p-3 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {["Station Name", "Stop Time (HH:MM:SS)", "Stop Time (Min)", "Stop Count"].map((h, i) => (
                  <th key={i} className={`px-3 py-2 text-white font-bold border border-white/20 ${i === 0 ? "text-left" : "text-center"}`} style={{ background: ACCENT }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map((s, i) => {
                const isCritical = s.TotalStopTime > 100;
                const isHigh = s.TotalStopTime > 20;
                const intensity = s.TotalStopTime / maxTime;
                const rowBg = isCritical ? `rgba(239,68,68,${0.08 + intensity * 0.12})` : isHigh ? "#fef3c7" : i % 2 === 0 ? "#fff" : "#f8fafc";
                const textCol = isCritical ? "#ef4444" : isHigh ? "#b45309" : "#334155";
                return (
                  <tr key={i} style={{ background: rowBg }}>
                    <td className="px-3 py-2 border border-slate-100 text-slate-700 font-semibold">{s.StationName}</td>
                    <td className="px-3 py-2 border border-slate-100 text-center font-bold" style={{ color: textCol }}>{s.TotalStopTimeHMS ?? "—"}</td>
                    <td className="px-3 py-2 border border-slate-100 text-center font-bold" style={{ color: textCol }}>{s.TotalStopTime}</td>
                    <td className={`px-3 py-2 border border-slate-100 text-center font-bold ${s.TotalStopCount > 10 ? "text-red-500" : "text-slate-700"}`}>
                      {s.TotalStopCount}
                    </td>
                  </tr>
                );
              })}
              {stations.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-7 text-center text-slate-400 border border-slate-100">
                    <div className="flex flex-col items-center gap-2">
                      <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                      <p className="text-sm">No loss data recorded this shift</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Loss;