// ──────────────────────────────────────────────────────────────────────────
// Change Log — standalone full-page view of a template's history.
//
// This is the same data TemplateHistoryPanel already shows inline (compact,
// embedded in cards/rows), but as its own page: filterable by action type,
// and using the same ChangeRow / BeforeAfterCard visual language as the
// redesigned Compare Versions page so the two feel like one coherent
// feature rather than two unrelated screens.
// ──────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaHistory, FaCodeBranch, FaSync, FaChevronRight } from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";

import useTemplateHistory from "./hooks/useTemplateHistory";
import { getActionConfig, ACTION_FILTERS } from "./constants/historyConfig";
import { HistoryStatusBadge, HistoryTypeBadge } from "./components/diff/HistoryBadges";
import BeforeAfterCard from "./components/BeforeAfterCard";
import { ChangeRow } from "./components/diff/ChangeRow";
import { EmptyState, CardSkeleton, SecondaryButton } from "../components/common";
import { fmtDateLong as fmtDate } from "../utils/formatters";

// Classify a single field change the same way TemplateHistoryPanel did,
// mapped onto the shared added/removed/modified vocabulary from the diff tree.
const fieldChangeType = (fc) => {
  if (!fc.to || fc.to === "") return "removed";
  if (!fc.from || fc.from === "") return "added";
  return "modified";
};

const HistoryEntryCard = ({ entry }) => {
  const cfg = getActionConfig(entry.Action);
  const hasStatusTransition = entry.PreviousStatus || entry.NewStatus;

  return (
    <div className="relative pl-8">
      <span className={`absolute left-1.5 top-4 w-2.5 h-2.5 rounded-full ring-2 ring-white ${cfg.dot}`} aria-hidden="true" />
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <HistoryTypeBadge type={cfg.type} />
            <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
            {hasStatusTransition && (
              <div className="flex items-center gap-1">
                {entry.PreviousStatus && <HistoryStatusBadge status={entry.PreviousStatus} />}
                {entry.PreviousStatus && entry.NewStatus && <FaChevronRight size={7} className="text-slate-400" aria-hidden="true" />}
                {entry.NewStatus && <HistoryStatusBadge status={entry.NewStatus} />}
              </div>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            {entry.ActionBy || "System"} · {fmtDate(entry.ActionAt)}
          </span>
        </div>

        {entry.Comments && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100">
            <span className="text-[11px] font-bold text-red-500 mr-1">Remarks:</span>
            <span className="text-[11px] text-red-600">{entry.Comments}</span>
          </div>
        )}

        {entry.FieldChanges?.length > 0 && (
          <div className="border-t border-slate-50 divide-y divide-slate-50">
            {entry.FieldChanges.map((fc, fi) => (
              <ChangeRow key={fi} type={fieldChangeType(fc)} label={fc.field} meta={fc.note} level={0}>
                <div className="pb-2 pl-5">
                  <BeforeAfterCard from={fc.from} to={fc.to} />
                </div>
              </ChangeRow>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TemplateChangeLog = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { history, loading, refresh } = useTemplateHistory(id);
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return history;
    return history.filter((entry) => entry.Action?.toLowerCase() === filter);
  }, [history, filter]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Sticky header — mirrors Compare Versions for a consistent feel ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/auditreport/templates")}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300"
              aria-label="Back to templates"
            >
              <FaArrowLeft size={13} className="text-slate-600" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <HiClipboardDocumentCheck className="text-indigo-500 flex-shrink-0" size={16} aria-hidden="true" />
              <h1 className="text-base font-bold text-slate-900 truncate">Change Log</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="history-filter">Filter by action</label>
            <select
              id="history-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {ACTION_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <SecondaryButton icon={FaSync} onClick={refresh} disabled={loading}>
              Refresh
            </SecondaryButton>
            <SecondaryButton icon={FaCodeBranch} onClick={() => navigate(`/auditreport/templates/${id}/compare`)}>
              Compare versions
            </SecondaryButton>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-3xl mx-auto space-y-4">
        {loading ? (
          <div className="space-y-3">
            <CardSkeleton rows={3} />
            <CardSkeleton rows={3} />
            <CardSkeleton rows={3} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState
              icon={FaHistory}
              title={history.length === 0 ? "No history recorded yet" : "No entries match this filter"}
              subtitle={history.length === 0 ? "Changes to this template will show up here." : "Try a different action type."}
            />
          </div>
        ) : (
          <div className="relative border-l-2 border-indigo-100 ml-1.5 space-y-4">
            {filtered.map((entry) => (
              <HistoryEntryCard key={entry.Id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateChangeLog;
