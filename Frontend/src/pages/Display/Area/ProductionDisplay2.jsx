import {
  PageHeader,
  TimerBar,
  GaugePanel,
  MetricTable,
  StatCard,
} from "../Monitoring";

const ACCENT = "#0f766e";

const ProductionDisplay2 = ({
  apiData = {},
  progress,
  shift,
  shiftDate,
  config,
}) => {
  const d = apiData;
  const label = config?.stationName2 || "FG LOADING";

  const rows = [
    {
      label: "Working Time",
      unit: "Min",
      target: d.WorkingTimeMin,
      actual: d.ActualWorkingMin,
    },
    {
      label: "Takt Time",
      unit: "Sec",
      target: d.TactTimeSec,
      actual: d.ActualTaktTimeSec,
    },
    {
      label: "Shift Output Target",
      unit: "No's",
      target: d.ShiftOutputTarget,
      actual: d.ActualQty,
    },
    {
      label: "Packing Till Now",
      unit: "No's",
      target: d.ShiftOutputTarget,
      actual: d.ActualQty,
    },
    { label: "Loss Units", unit: "No's", target: null, actual: d.LossUnits },

    {
      label: "UPH Target",
      unit: "No's",
      target: d.UPHTarget,
      actual: d.ActualUPH_Avg,
    },
    {
      label: "Efficiency Till Now",
      unit: "%",
      target: null,
      actual: d.EfficiencyTillNow,
      highlight: "yellow",
    },
    { label: "Performance", unit: "%", target: null, actual: d.PerformancePct },
    {
      label: "Balance Qty",
      unit: "No's",
      target: null,
      actual: d.ShiftOutputTarget - d.ActualQty,
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Final Area Production Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />

        {/* Hero KPI Strip */}
        <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-slate-50">
          <StatCard
            label="Shift Target"
            value={d.ShiftOutputTarget}
            accentHex="#15803d"
          />
          <StatCard
            label="Shift Output"
            value={d.ActualQty}
            accentHex="#1e40af"
          />
          <StatCard
            label="Efficiency"
            value={
              d.EfficiencyTillNow != null ? `${d.EfficiencyTillNow}%` : null
            }
            accentHex="#f59e0b"
          />
          <StatCard
            label="Performance"
            value={d.PerformancePct != null ? `${d.PerformancePct}%` : null}
            accentHex="#7c3aed"
          />
          <StatCard
            label="Loss Units"
            value={d.LossUnits}
            accentHex="#ef4444"
          />
          <StatCard
            label="Balance Qty"
            value={d.ShiftOutputTarget - d.ActualQty}
            accentHex="#b45309"
          />
        </div>
      </div>

      {/* ── Main body — 50% Gauge + 50% Table ── */}
      <div className="flex flex-1 min-h-0 px-4 py-3 gap-4">
        {/* LEFT 50% — Gauge */}
        <div className="w-1/2 shrink-0 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="scale-[1.35] origin-center">
            <GaugePanel
              value={d.GaugeValue ?? 0}
              label={label}
              sublabel="Units / Shift"
              accentHex={ACCENT}
            />
          </div>
        </div>

        {/* RIGHT 50% — Table */}
        <div className="w-1/2 flex flex-col min-w-0 gap-3">
          <div
            className="text-white font-bold text-sm text-center py-2 rounded-t-xl tracking-wider uppercase"
            style={{ background: ACCENT }}
          >
            {label} — Shift Metrics
          </div>
          <div className="flex-1 overflow-auto">
            <MetricTable rows={rows} accentHex={ACCENT} />
          </div>
        </div>
      </div>

      {/* ── Monthly footer ── */}
      <div className="grid grid-cols-5 gap-3 px-5 py-3 bg-white border-t border-slate-200 shrink-0">
        <StatCard
          label="Monthly Plan"
          value={d.MonthlyPlanQty}
          accentHex={ACCENT}
        />
        <StatCard
          label="Monthly Achievement"
          value={d.MonthlyAchieved}
          accentHex="#15803d"
        />
        <StatCard
          label="Remaining Qty"
          value={d.MonthlyRemaining}
          accentHex="#b45309"
        />
        <StatCard
          label="Asking Rate"
          value={d.AskingRate}
          accentHex="#0f766e"
          sub="Units / Day"
        />
        <StatCard
          label="Remaining Days"
          value={d.RemainingDays}
          accentHex="#64748b"
        />
      </div>
    </div>
  );
};

export default ProductionDisplay2;
