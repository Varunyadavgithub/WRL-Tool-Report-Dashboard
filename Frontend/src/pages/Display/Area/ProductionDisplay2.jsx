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
      actual:
        d.ShiftOutputTarget != null && d.ActualQty != null
          ? d.ShiftOutputTarget - d.ActualQty
          : null,
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-slate-50 shrink-0">
        <PageHeader
          title="Final Area Production Performance"
          shift={shift}
          shiftDate={shiftDate}
          accentHex={ACCENT}
        />
        <TimerBar progress={progress} accentHex={ACCENT} />

        {/* Hero KPI Strip */}
        <div className="grid grid-cols-6 gap-2.5 px-4 py-2.5 bg-slate-50">
          <StatCard
            label="Shift Target"
            value={d.ShiftOutputTarget}
            accentHex="#15803d"
          />
          <StatCard
            label="Shift Output"
            value={d.ActualQty}
            accentHex="#0f766e"
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
            value={
              d.ShiftOutputTarget != null && d.ActualQty != null
                ? d.ShiftOutputTarget - d.ActualQty
                : null
            }
            accentHex="#b45309"
          />
        </div>
      </div>

      {/* ── Main body — 55% Gauge + 45% Table ── */}
      <div className="flex flex-1 min-h-0 px-4 py-2 gap-4">
        {/* LEFT — Gauge (wider) */}
        <div
          className="w-[55%] shrink-0 rounded-2xl border-2 shadow-md overflow-hidden"
          style={{
            borderColor: `${ACCENT}20`,
            background: `linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`,
          }}
        >
          <GaugePanel
            value={d.GaugeValue ?? 0}
            maxValue={1000}
            label={label}
            sublabel="Units / Shift"
            accentHex={ACCENT}
          />
        </div>

        {/* RIGHT — Table */}
        <div className="w-[45%] flex flex-col min-w-0">
          <div
            className="text-white font-bold text-sm text-center py-2.5 rounded-t-xl tracking-wider uppercase flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-white/50" />
            {label} — Shift Metrics
          </div>
          <div className="flex-1 overflow-auto bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm">
            <MetricTable rows={rows} accentHex={ACCENT} />
          </div>
        </div>
      </div>

      {/* ── Monthly footer ── */}
      <div className="grid grid-cols-5 gap-2.5 px-4 py-2.5 bg-white border-t border-slate-200 shrink-0">
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
