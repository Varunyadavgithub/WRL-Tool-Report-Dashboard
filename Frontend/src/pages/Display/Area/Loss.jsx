import { useMemo } from "react";
import { PackageOpen } from "lucide-react";
import { PageHeader, TimerBar, StatCard, DonutCanvas } from "../Monitoring";

const ACCENT = "#b45309";

const Loss = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;
  const maxTime = useMemo(
    () => Math.max(...stations.map((s) => s.TotalStopTime ?? 0), 1),
    [stations],
  );

  const sorted = useMemo(
    () =>
      [...stations].sort(
        (a, b) => (b.TotalStopTime ?? 0) - (a.TotalStopTime ?? 0),
      ),
    [stations],
  );

  const totalStopTime = useMemo(
    () => stations.reduce((sum, s) => sum + (s.TotalStopTime ?? 0), 0),
    [stations],
  );
  const totalStopCount = useMemo(
    () => stations.reduce((sum, s) => sum + (s.TotalStopCount ?? 0), 0),
    [stations],
  );

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Loss Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />

        {/* Hero KPI Strip */}
        <div className="grid grid-cols-4 gap-3 px-5 py-3 bg-slate-50">
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

      {/* ── Main body — 50% Graphics + 50% Table ── */}
      <div className="flex flex-1 min-h-0 px-4 py-3 gap-4">
        {/* LEFT 50% — Donut + Top 5 Critical */}
        <div className="w-1/2 shrink-0 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-5 gap-4">
            {/* Donut */}
            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">
              Consumed Time
            </p>
            <div className="relative">
              <DonutCanvas
                pct={ls.ConsumedTimePct}
                size={200}
                fillColor="#f59e0b"
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-[44px] font-black text-slate-900 leading-none">
                  {Number(ls.ConsumedTimePct || 0).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Summary cards */}
            {stations.length > 0 && (
              <div className="w-full max-w-md mt-3 grid grid-cols-3 gap-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-red-400 uppercase font-bold tracking-wider">
                    Total Stop Time
                  </p>
                  <p className="text-xl font-black text-red-600 font-mono">
                    {totalStopTime.toLocaleString()}m
                  </p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-amber-400 uppercase font-bold tracking-wider">
                    Total Stops
                  </p>
                  <p className="text-xl font-black text-amber-600 font-mono">
                    {totalStopCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-blue-400 uppercase font-bold tracking-wider">
                    Stations
                  </p>
                  <p className="text-xl font-black text-blue-600 font-mono">
                    {stations.length}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 50% — Loss Table */}
        <div className="w-1/2 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div
            className="text-white font-bold text-sm text-center py-2.5 tracking-wider uppercase shrink-0"
            style={{ background: ACCENT }}
          >
            Station-wise Loss Breakdown
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {[
                    "Station Name",
                    "Stop Time (HH:MM:SS)",
                    "Stop Time (Min)",
                    "Stop Count",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-3 text-white font-bold border border-white/20 text-sm uppercase tracking-wider ${
                        i === 0 ? "text-left" : "text-center"
                      }`}
                      style={{ background: ACCENT }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const isCritical = s.TotalStopTime > 100;
                  const isHigh = s.TotalStopTime > 20;
                  const intensity = s.TotalStopTime / maxTime;
                  const rowBg = isCritical
                    ? `rgba(239,68,68,${0.08 + intensity * 0.12})`
                    : isHigh
                      ? "#fef3c7"
                      : i % 2 === 0
                        ? "#fff"
                        : "#f8fafc";
                  const textCol = isCritical
                    ? "#ef4444"
                    : isHigh
                      ? "#b45309"
                      : "#334155";

                  return (
                    <tr key={i} style={{ background: rowBg }}>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-700 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          {isCritical && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                          )}
                          <span className="truncate">{s.StationName}</span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-2.5 border-b border-slate-100 text-center font-bold font-mono text-sm"
                        style={{ color: textCol }}
                      >
                        {s.TotalStopTimeHMS ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 border-b border-slate-100 text-center text-sm"
                        style={{ color: textCol }}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min((s.TotalStopTime / maxTime) * 100, 100)}%`,
                                background: isCritical
                                  ? "#ef4444"
                                  : isHigh
                                    ? "#f59e0b"
                                    : "#94a3b8",
                              }}
                            />
                          </div>
                          <span className="font-bold font-mono min-w-[40px]">
                            {s.TotalStopTime}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`px-3 py-2.5 border-b border-slate-100 text-center font-bold font-mono text-sm ${
                          s.TotalStopCount > 10
                            ? "text-red-500"
                            : "text-slate-700"
                        }`}
                      >
                        {s.TotalStopCount}
                      </td>
                    </tr>
                  );
                })}
                {stations.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
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
