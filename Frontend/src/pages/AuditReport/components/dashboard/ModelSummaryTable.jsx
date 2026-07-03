// ──────────────────────────────────────────────────────────────────────────
// Model Summary table — per-model production/audit completion, with a
// totals footer row. Sticky header + accessible empty state added on top of
// the original markup.
// ──────────────────────────────────────────────────────────────────────────
import { FaIndustry, FaExclamationTriangle } from "react-icons/fa";
import { pct } from "../../utils/formatters";
import { TableSkeleton, EmptyState } from "../../components/common";

const COLUMNS = ["#", "Model", "Production", "Required", "Done", "Pending", "Completion"];

export default function ModelSummaryTable({ loading, modelSummary, modelTotals }) {
  if (loading) return <TableSkeleton rows={6} />;

  const completion = pct(modelTotals.auditDone, modelTotals.auditRequired);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <FaIndustry className="text-blue-500 text-sm" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Model Summary</h3>
            <p className="text-[11px] text-slate-400">Current shift · {modelSummary.length} models tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {modelTotals.pending > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full">
              {modelTotals.pending} pending audits
            </span>
          )}
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full tabular-nums ${
              completion >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {completion}% complete
          </span>
        </div>
      </div>

      {modelSummary.length === 0 ? (
        <EmptyState icon={FaExclamationTriangle} title="No production data for this shift" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-50 border-b border-blue-100">
                {COLUMNS.map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-blue-500 ${
                      i > 1 ? "text-center" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {modelSummary.map((row, idx) => {
                const rate = pct(row.auditDone, row.auditRequired);
                return (
                  <tr key={row.modelName} className={`hover:bg-blue-50/20 transition-colors ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                    <td className="px-4 py-2.5 text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 text-xs">{row.modelName}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-blue-600 text-xs tabular-nums">{row.production}</td>
                    <td className="px-4 py-2.5 text-center font-medium text-slate-700 text-xs tabular-nums">{row.auditRequired}</td>
                    <td className="px-4 py-2.5 text-center text-xs tabular-nums">
                      <span className={`font-semibold ${row.auditDone > 0 ? "text-emerald-600" : "text-slate-400"}`}>{row.auditDone}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs tabular-nums">
                      <span className={`font-semibold ${row.pending > 0 ? "text-red-500" : "text-emerald-500"}`}>{row.pending}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rate >= 80 ? "bg-emerald-400" : rate > 0 ? "bg-amber-400" : "bg-slate-200"}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-semibold w-8 flex-shrink-0 tabular-nums ${
                            rate >= 80 ? "text-emerald-600" : rate > 0 ? "text-amber-600" : "text-slate-400"
                          }`}
                        >
                          {rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50/60 border-t-2 border-blue-100">
                <td className="px-4 py-3" colSpan={2}>
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total</span>
                </td>
                <td className="px-4 py-3 text-center font-bold text-blue-700 text-xs tabular-nums">{modelTotals.production}</td>
                <td className="px-4 py-3 text-center font-bold text-slate-800 text-xs tabular-nums">{modelTotals.auditRequired}</td>
                <td className="px-4 py-3 text-center font-bold text-emerald-700 text-xs tabular-nums">{modelTotals.auditDone}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold text-xs tabular-nums ${modelTotals.pending > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {modelTotals.pending}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-bold tabular-nums ${completion >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                    {completion}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
