// ──────────────────────────────────────────────────────────────────────────
// "Models with Pending Audits" — top 5 models by pending count, each with a
// mini completion bar. Shows a celebratory empty state when nothing's
// pending.
// ──────────────────────────────────────────────────────────────────────────
import { FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import { pct } from "../../utils/formatters";
import { CardSkeleton, EmptyState } from "../../components/common";

export default function TopPendingModelsCard({ loading, topPendingModels }) {
  if (loading) return <CardSkeleton rows={4} />;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-red-50 rounded-lg">
          <FaExclamationTriangle className="text-red-400 text-sm" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Models with Pending Audits</h3>
          <p className="text-[11px] text-slate-400">Requires immediate attention</p>
        </div>
      </div>

      {topPendingModels.length === 0 ? (
        <EmptyState icon={FaCheckCircle} title="All models are on track!" tone="success" />
      ) : (
        <div className="space-y-3">
          {topPendingModels.map((m, idx) => {
            const rate = pct(m.auditDone, m.auditRequired);
            return (
              <div key={m.modelName} className="flex items-center gap-3 p-3 bg-red-50/40 border border-red-100 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="text-xs font-semibold text-slate-800 truncate">{m.modelName}</p>
                    <span className="text-[11px] font-semibold text-red-600 flex-shrink-0 tabular-nums">{m.pending} pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${rate >= 80 ? "bg-emerald-400" : rate > 0 ? "bg-amber-400" : "bg-slate-300"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 flex-shrink-0 tabular-nums">
                      {m.auditDone}/{m.auditRequired} done
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
