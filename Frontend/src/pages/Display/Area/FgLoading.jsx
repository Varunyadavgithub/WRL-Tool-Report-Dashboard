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
      <div className="flex flex-1 min-h-0">
        <GaugePanel value={d.GaugeValue ?? 0} label={label} sublabel="Units / Shift" accentHex={ACCENT} />
        <div className="flex-1 flex flex-col p-3 min-w-0 gap-2">
          <div className="text-white font-bold text-[13px] text-center py-1.5 rounded-t-lg" style={{ background: ACCENT }}>
            {label}
          </div>
          <MetricTable rows={rows} accentHex={ACCENT} />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 px-3 py-2.5 bg-white border-t border-slate-100 shrink-0">
        <StatCard label="Monthly Plan" value={d.MonthlyPlanQty} accentHex={ACCENT} />
        <StatCard label="Monthly Achievement" value={d.MonthlyAchieved} accentHex="#15803d" />
        <StatCard label="Remaining Qty" value={d.MonthlyRemaining} accentHex="#b45309" />
        <StatCard label="Asking Rate" value={d.AskingRate} accentHex="#0f766e" />
        <StatCard label="Remaining Days" value={d.RemainingDays} accentHex="#64748b" />
      </div>
    </div>
  );
};

export default FgLoading;