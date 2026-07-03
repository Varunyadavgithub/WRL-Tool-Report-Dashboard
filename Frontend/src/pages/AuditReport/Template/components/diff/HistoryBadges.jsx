// ──────────────────────────────────────────────────────────────────────────
// Badge components for a single history entry — extracted out of
// TemplateHistoryPanel.jsx (same markup/behavior) so TemplateChangeLog can
// render identical badges without duplicating them.
// ──────────────────────────────────────────────────────────────────────────
import { getHistoryStatusConfig } from "../../constants/historyConfig";

export const HistoryStatusBadge = ({ status }) => {
  const cfg = getHistoryStatusConfig(status);
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export const HistoryTypeBadge = ({ type }) =>
  type === "new" ? (
    <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
      New Template
    </span>
  ) : (
    <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide">
      Template Edit
    </span>
  );
