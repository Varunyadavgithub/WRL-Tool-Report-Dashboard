// ──────────────────────────────────────────────────────────────────────────
// KpiCard — a single "big number + label" summary tile, and ProgressBar — a
// labeled horizontal bar used for breakdowns (checkpoint results, status
// distribution, per-model completion, etc). Both were previously defined
// inline inside Auditdashboard.jsx; pulled out so any future page (Template
// dashboard, reports) can reuse the same visual language.
// ──────────────────────────────────────────────────────────────────────────
import { barWidth } from "../../utils/formatters";

export const KpiCard = ({ label, value, icon: Icon, iconCls, bg, border, valueCls, sub }) => (
  <div className={`${bg} border ${border} rounded-2xl px-5 py-4 transition-shadow hover:shadow-sm`}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      {Icon && <Icon className={`${iconCls} text-lg`} aria-hidden="true" />}
    </div>
    <p className={`text-3xl font-bold tabular-nums ${valueCls}`}>{value}</p>
    {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
  </div>
);

/**
 * A single labeled row: "Label ──bar── count %". `max` is the denominator
 * the bar's width is computed against (usually the group total).
 */
export const ProgressBar = ({ value, max, color, label, count, showPercent = true }) => {
  const width = barWidth(value, max);
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-20 flex-shrink-0 text-right">{label}</span>
      <div
        className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${count} (${percent}%)`}
      >
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-10 flex-shrink-0 tabular-nums">{count}</span>
      {showPercent && <span className="text-[11px] text-slate-400 w-8 flex-shrink-0 tabular-nums">{width}%</span>}
    </div>
  );
};

/** Thin multi-segment bar for showing several proportions in one strip (e.g. pass/fail/warning). */
export const StackedBar = ({ segments, total }) => (
  <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100">
    {segments
      .filter((s) => s.value > 0)
      .map((s, i) => (
        <div
          key={i}
          className={`h-full ${s.cls} transition-all`}
          style={{ width: `${total > 0 ? Math.round((s.value / total) * 100) : 0}%` }}
          title={`${s.label ?? ""}: ${s.value}`}
        />
      ))}
  </div>
);
