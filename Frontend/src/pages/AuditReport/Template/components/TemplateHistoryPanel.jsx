import { useEffect, useRef, useState } from "react";
import { FaHistory, FaChevronRight } from "react-icons/fa";
import toast from "react-hot-toast";
import useAuditData from "../../../../hooks/useAuditData";
import BeforeAfterCard from "./BeforeAfterCard";
import { getActionConfig } from "../constants/historyConfig";
import { HistoryStatusBadge, HistoryTypeBadge as TypeBadge } from "./diff/HistoryBadges";
import { fmtDateLong as fmtDate } from "../../utils/formatters";

// Consolidated "Change History" timeline — previously duplicated independently
// in TemplateList.jsx, TemplateBuilder.jsx, and TemplateApproval.jsx. Renders
// only the expandable content; the toggle button itself stays with each
// caller since its placement among other row/page action buttons differs.
//
// `variant` controls only the outer container classes — the timeline/card
// rendering is identical everywhere:
//   "inline-grid" — inside a card (TemplateList/TemplateApproval grid view)
//   "inline-list" — inside an expanded table row (TemplateList/TemplateApproval list view)
//   "panel"       — inside TemplateBuilder's review-mode section (own chrome already)
//
// Action/status config + badges now live in Template/constants/historyConfig.js
// and Template/components/diff/HistoryBadges.jsx — shared with the full-page
// TemplateChangeLog view so both render history identically.

const OUTER_CLASSES = {
  "inline-grid": "mt-3 border-t border-indigo-100 pt-3",
  "inline-list": "mt-1",
  panel: "p-5",
};

const TemplateHistoryPanel = ({ templateId, isOpen, variant = "inline-grid", title = "Change Log", refreshKey = 0 }) => {
  const { getTemplateHistory } = useAuditData();
  const [history, setHistory] = useState(null); // null = not yet loaded
  const [loading, setLoading] = useState(false);
  const [expandedChanges, setExpandedChanges] = useState(new Set());
  const lastKeyRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const key = `${templateId}:${refreshKey}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    setLoading(true);
    getTemplateHistory(templateId)
      .then(setHistory)
      .catch((err) => toast.error("Failed to load history: " + err.message))
      .finally(() => setLoading(false));
  }, [isOpen, templateId, refreshKey, getTemplateHistory]);

  const toggleChange = (key) =>
    setExpandedChanges((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (!isOpen) return null;

  return (
    <div className={OUTER_CLASSES[variant] || OUTER_CLASSES["inline-grid"]}>
      <div className="flex items-center gap-1.5 mb-2">
        <FaHistory className="text-indigo-400" size={10} />
        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">{title}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-4 border-indigo-100 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      ) : (history || []).length === 0 ? (
        <p className="text-center py-3 text-gray-400 text-[10px]">No history recorded yet.</p>
      ) : (
        <div className="relative border-l-2 border-indigo-100 ml-2 space-y-1.5">
          {history.map((entry) => {
            const cfg = getActionConfig(entry.Action);
            return (
              <div key={entry.Id} className="relative pl-4">
                <div className={`absolute -left-[5px] top-2 w-2 h-2 rounded-full ring-1 ring-white ${cfg.dot}`} />
                <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                  <div className="px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <TypeBadge type={cfg.type} />
                      <span className={`text-[9px] font-black ${cfg.color}`}>{cfg.label}</span>
                      {(entry.PreviousStatus || entry.NewStatus) && (
                        <div className="flex items-center gap-0.5">
                          {entry.PreviousStatus && <HistoryStatusBadge status={entry.PreviousStatus} />}
                          {entry.PreviousStatus && entry.NewStatus && (
                            <FaChevronRight size={6} className="text-gray-400" />
                          )}
                          {entry.NewStatus && <HistoryStatusBadge status={entry.NewStatus} />}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-gray-400">
                      {entry.ActionBy || "System"} · {fmtDate(entry.ActionAt)}
                    </span>
                  </div>

                  {entry.Comments && (
                    <div className="px-2.5 py-1 bg-red-50 border-t border-red-100">
                      <span className="text-[9px] font-bold text-red-500 mr-1">Remarks:</span>
                      <span className="text-[9px] text-red-600">{entry.Comments}</span>
                    </div>
                  )}

                  {entry.FieldChanges?.length > 0 && (
                    <div className="px-2.5 py-1.5 border-t border-gray-50 flex flex-wrap gap-1">
                      {entry.FieldChanges.map((fc, fi) => {
                        const changeKey = `${entry.Id}_${fi}`;
                        const isChangeOpen = expandedChanges.has(changeKey);
                        const isRemove = !fc.to || fc.to === "";
                        const isAdd = !fc.from || fc.from === "";
                        const dotClr = isRemove ? "bg-red-400" : isAdd ? "bg-green-400" : "bg-amber-400";
                        return (
                          <div key={fi} className="border border-gray-100 rounded overflow-hidden text-[9px]">
                            <button
                              type="button"
                              onClick={() => toggleChange(changeKey)}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 transition-colors w-full"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClr}`} />
                              <span className="font-bold text-gray-600 uppercase">{fc.field}</span>
                              {fc.note && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full font-bold ${isRemove ? "bg-red-100 text-red-600" : isAdd ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                                >
                                  {fc.note}
                                </span>
                              )}
                              <FaChevronRight
                                size={6}
                                className={`text-gray-400 ml-auto transition-transform ${isChangeOpen ? "rotate-90" : ""}`}
                              />
                            </button>
                            {isChangeOpen && <BeforeAfterCard from={fc.from} to={fc.to} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TemplateHistoryPanel;
