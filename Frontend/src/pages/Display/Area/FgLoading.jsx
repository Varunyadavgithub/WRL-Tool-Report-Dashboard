import { PageHeader, TimerBar, GaugePanel, MetricTable, StatCard } from "../Monitoring";

const ACCENT = "#0f766e";

const FgLoading = ({ apiData = {}, progress, shift, shiftDate, config }) => {
  const d = apiData;
  const label = config?.stationName2 || "FG LOADING";

  const rows = [
    { label: "Working Time", unit: "Min", target: 570, actual: d.WorkingTimeMin },
    { label: "Takt Time", unit: "Sec", target: d.TactTimeSec, actual: d.TactTimeSec },
    { label: "Shift Output Target", unit: "No's", target: d.ShiftOutputTarget, actual: d.ShiftOutputTarget },
    { label: "Loading Till Now", unit: "No's", target: d.ProratedTarget, actual: d.LoadingTillNow },
    { label: "Loss Units", unit: "No's", target: null, actual: d.LossUnits },
    { label: "Loss Time", unit: "Min", target: null, actual: d.LossTime },
    { label: "UPH Target", unit: "No's", target: d.UPHTarget, actual: d.ActualUPH },
    { label: "Efficiency Till Now", unit: "%", target: null, actual: d.EfficiencyTillNow, highlight: "yellow" },
    { label: "Performance", unit: "%", target: null, actual: d.PerformancePct },
    { label: "Balance Qty", unit: "No's", target: null, actual: d.BalanceQty },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader title="Final Area Production Performance" shift={shift} shiftDate={shiftDate} accentHex={ACCENT} />
      <TimerBar progress={progress} accentHex={ACCENT} />

      {/* ── Hero KPI Strip ── */}
      <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-slate-50 shrink-0">
        <StatCard label="Loading Till Now" value={d.LoadingTillNow} accentHex="#0f766e" />
        <StatCard label="Prorated Target" value={d.ProratedTarget} accentHex="#15803d" />
        <StatCard label="Efficiency" value={d.EfficiencyTillNow != null ? `${d.EfficiencyTillNow}%` : null} accentHex="#f59e0b" />
        <StatCard label="Performance" value={d.PerformancePct != null ? `${d.PerformancePct}%` : null} accentHex="#7c3aed" />
        <StatCard label="Loss Units" value={d.LossUnits} accentHex="#ef4444" />
        <StatCard label="Balance Qty" value={d.BalanceQty} accentHex="#b45309" />
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 min-h-0 px-4 py-3 gap-4">
        <div className="w-[42%] shrink-0 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="scale-[1.35] origin-center">
            <GaugePanel value={d.GaugeValue ?? 0} label={label} sublabel="Units / Shift" accentHex={ACCENT} />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 gap-3">
          <div
            className="text-white font-bold text-sm text-center py-2 rounded-t-xl tracking-wider uppercase"
            style={{ background: ACCENT }}
          >
            {label} — Shift Metrics
          </div>
          <div className="flex-1 overflow-hidden">
            <MetricTable rows={rows} accentHex={ACCENT} />
          </div>
        </div>
      </div>

      {/* ── Monthly footer ── */}
      <div className="grid grid-cols-5 gap-3 px-5 py-3 bg-white border-t border-slate-200 shrink-0">
        <StatCard label="Monthly Plan" value={d.MonthlyPlanQty} accentHex={ACCENT} />
        <StatCard label="Monthly Achievement" value={d.MonthlyAchieved} accentHex="#15803d" />
        <StatCard label="Remaining Qty" value={d.MonthlyRemaining} accentHex="#b45309" />
        <StatCard label="Asking Rate" value={d.AskingRate} accentHex="#0f766e" sub="Units / Day" />
        <StatCard label="Remaining Days" value={d.RemainingDays} accentHex="#64748b" />
      </div>
    </div>
  );
};

export default FgLoading;