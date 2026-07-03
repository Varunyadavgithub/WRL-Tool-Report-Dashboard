// ──────────────────────────────────────────────────────────────────────────
// Recent Audits table — last N audits with a status badge and a link to
// view all. Rows navigate to the audit detail page; now keyboard-operable
// (previously mouse-only via a bare onClick on <tr>).
// ──────────────────────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";
import { FaClipboardList, FaArrowRight } from "react-icons/fa";
import { getStatusConfig } from "../../constants/statusConfig";
import { fmtDate, relativeTime } from "../../utils/formatters";
import { StatusBadge, ClickableRow, TableSkeleton, EmptyState } from "../../components/common";

const COLUMNS = ["Report", "Status", "By", "Created"];

export default function RecentAuditsTable({ loading, recentAudits }) {
  const navigate = useNavigate();
  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-violet-50 rounded-lg">
            <FaClipboardList className="text-violet-500 text-sm" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Recent Audits</h3>
            <p className="text-[11px] text-slate-400">Last 10 entries</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold px-2.5 py-1 bg-violet-50 text-violet-600 border border-violet-100 rounded-full">
            {recentAudits.length} records
          </span>
          <button
            onClick={() => navigate("/auditreport/audits")}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 rounded"
          >
            View all <FaArrowRight size={9} aria-hidden="true" />
          </button>
        </div>
      </div>

      {recentAudits.length === 0 ? (
        <EmptyState icon={FaClipboardList} title="No audits yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-violet-50 border-b border-violet-100">
                {COLUMNS.map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-violet-500 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentAudits.map((audit, idx) => {
                const cfg = getStatusConfig(audit.status);
                return (
                  <ClickableRow
                    key={audit.id}
                    onActivate={() => navigate(`/auditreport/audits/${audit.id}`)}
                    className={`hover:bg-violet-50/30 ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}
                    aria-label={`Open audit ${audit.auditCode || audit.id}`}
                  >
                    <td className="px-4 py-2.5 max-w-[140px]">
                      <p className="font-semibold text-slate-800 truncate">{audit.auditCode || `#${audit.id}`}</p>
                      <p className="text-[11px] text-slate-400 truncate">{audit.templateName || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge config={cfg}>{audit.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-medium">{audit.createdBy || "—"}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-600">{fmtDate(audit.createdAt)}</p>
                      <p className="text-[11px] text-slate-400">{relativeTime(audit.createdAt)}</p>
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
