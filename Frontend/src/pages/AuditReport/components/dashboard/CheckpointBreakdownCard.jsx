// ──────────────────────────────────────────────────────────────────────────
// Checkpoint Results card — bar-per-outcome breakdown + a stacked summary
// strip at the bottom. Pulled out of Auditdashboard.jsx unchanged in logic.
// ──────────────────────────────────────────────────────────────────────────
import { FaChartBar } from "react-icons/fa";
import { ProgressBar, StackedBar, CardSkeleton } from "../../components/common";

export default function CheckpointBreakdownCard({ loading, cpAgg, cpPassRate }) {
  if (loading) return <CardSkeleton rows={5} />;

  const rateColor = cpPassRate >= 80 ? "text-emerald-600" : cpPassRate >= 60 ? "text-amber-600" : "text-red-500";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg">
            <FaChartBar className="text-indigo-500 text-sm" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Checkpoint Results</h3>
            <p className="text-[11px] text-slate-400">Aggregated from all audits</p>
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 tabular-nums">
          {cpAgg.total.toLocaleString()} total
        </span>
      </div>

      <div className="space-y-3">
        <ProgressBar value={cpAgg.pass} max={cpAgg.total} color="bg-emerald-400" label="Pass" count={cpAgg.pass} />
        <ProgressBar value={cpAgg.fail} max={cpAgg.total} color="bg-red-400" label="Fail" count={cpAgg.fail} />
        <ProgressBar value={cpAgg.warning} max={cpAgg.total} color="bg-amber-400" label="Warning" count={cpAgg.warning} />
        <ProgressBar value={cpAgg.na} max={cpAgg.total} color="bg-blue-300" label="N/A" count={cpAgg.na} />
        <ProgressBar value={cpAgg.pending} max={cpAgg.total} color="bg-slate-300" label="Pending" count={cpAgg.pending} />
      </div>

      {cpAgg.total > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Overall checkpoint distribution</span>
            <span className={`font-semibold ${rateColor}`}>{cpPassRate}% pass</span>
          </div>
          <StackedBar
            total={cpAgg.total}
            segments={[
              { value: cpAgg.pass, cls: "bg-emerald-400", label: "Pass" },
              { value: cpAgg.warning, cls: "bg-amber-400", label: "Warning" },
              { value: cpAgg.fail, cls: "bg-red-400", label: "Fail" },
              { value: cpAgg.na, cls: "bg-blue-300", label: "N/A" },
              { value: cpAgg.pending, cls: "bg-slate-300", label: "Pending" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
