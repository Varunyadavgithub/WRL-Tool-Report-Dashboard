import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaFilePdf,
  FaUser,
  FaBuilding,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaInfoCircle,
  FaBell,
  FaChevronDown,
  FaChevronRight,
  FaEnvelope,
} from "react-icons/fa";

const ESCALATION_META = {
  L0: { label: "Info",       dot: "bg-blue-500 border-blue-200",   text: "text-blue-700",   bg: "bg-blue-50",   icon: <FaInfoCircle /> },
  L1: { label: "Warning",    dot: "bg-yellow-500 border-yellow-200",text: "text-yellow-700", bg: "bg-yellow-50", icon: <FaExclamationTriangle /> },
  L2: { label: "Critical",   dot: "bg-orange-500 border-orange-200",text: "text-orange-700", bg: "bg-orange-50", icon: <FaBell /> },
  L3: { label: "Audit Risk", dot: "bg-red-500 border-red-200",     text: "text-red-700",    bg: "bg-red-50",    icon: <FaTimesCircle /> },
};

export default function HistoryTable({ id }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set()); // indices of expanded cards

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const res = await axios.get(baseURL + "compliance/certs/" + id);
      const data = res?.data?.data || [];
      setHistory(data);
      // Auto-expand the first (most recent) entry
      if (data.length > 0) setExpanded(new Set([0]));
    } catch {
      toast.error("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });

  if (loading)
    return <div className="py-6 text-center italic text-gray-500">Loading timeline…</div>;

  if (!history.length)
    return <div className="py-6 text-center italic text-gray-400">No timeline available</div>;

  return (
    <div className="mt-4 bg-gray-50 border border-dashed rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-5 uppercase tracking-wider">
        Calibration &amp; Escalation Timeline
      </h3>

      <div className="relative border-l-2 border-gray-200 ml-4 space-y-3">
        {history.map((h, i) => {
          const isEscalation = h.EventType === "ESCALATION";
          const esc          = isEscalation ? ESCALATION_META[h.EscalationLevel] : null;
          const isOpen       = expanded.has(i);
          const isPass       = !isEscalation && h.Result === "Pass";

          const dotCls = isEscalation
            ? esc.dot
            : isPass ? "bg-green-500 border-green-200" : "bg-red-500 border-red-200";

          const headerBg = isEscalation
            ? (esc?.bg || "bg-gray-50")
            : isPass ? "bg-green-50" : "bg-red-50";

          const titleCls = isEscalation
            ? (esc?.text || "text-gray-700")
            : isPass ? "text-green-700" : "text-red-700";

          const titleIcon = isEscalation
            ? esc.icon
            : isPass ? <FaCheckCircle className="text-green-600" /> : <FaTimesCircle className="text-red-600" />;

          const titleText = isEscalation
            ? `Escalation ${h.EscalationLevel} – ${esc.label}`
            : isPass ? "Calibration Passed" : "Calibration Failed";

          // CC list for escalation
          const ccList = isEscalation && h.MailCC
            ? h.MailCC.split(",").map((e) => e.trim())
            : [];

          return (
            <div key={i} className="relative pl-6">
              {/* Timeline dot */}
              <span className={`absolute -left-[9px] top-3.5 w-4 h-4 rounded-full border-4 ${dotCls}`} />

              {/* Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                {/* ── Clickable header ── */}
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${headerBg} hover:brightness-95`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {titleIcon}
                    <span className={titleCls}>{titleText}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <FaCalendarAlt size={10} /> {h.EventTime?.slice(0, 10)}
                    </span>
                    {isOpen
                      ? <FaChevronDown  size={11} className="text-gray-400" />
                      : <FaChevronRight size={11} className="text-gray-400" />
                    }
                  </div>
                </button>

                {/* ── Expandable details ── */}
                {isOpen && (
                  <div className="px-4 py-3 border-t border-gray-100">
                    {!isEscalation ? (
                      /* Calibration details */
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <FaUser size={10} className="text-gray-400 flex-shrink-0" />
                          <span><b>Employee:</b> {h.EmployeeName || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FaBuilding size={10} className="text-gray-400 flex-shrink-0" />
                          <span><b>Department:</b> {h.department_name || "—"}</span>
                        </div>
                        <div><b>Agency:</b> {h.CalibrationAgency || "—"}</div>
                        <div><b>Valid Till:</b> {h.ValidTill?.slice(0, 10) || "—"}</div>

                        {/* PDF report link */}
                        {h.FilePath && (
                          <div className="col-span-2 mt-2 pt-2 border-t border-gray-50">
                            <a
                              href={baseURL.replace(/\/api\/v1\/?$/, "") + "/" + h.FilePath.replace(/^\/+/, "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium underline"
                            >
                              <FaFilePdf className="text-red-500" size={12} /> View Report
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Escalation details */
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600">
                        <div className="flex items-start gap-1.5">
                          <FaEnvelope size={10} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <span><b>Employee:</b> {h.MailTo || "—"}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <FaEnvelope size={10} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <b>Mail CC:</b>
                            <div className="ml-1 mt-1 space-y-0.5">
                              {ccList[0] && <div><b>Manager:</b> {ccList[0]}</div>}
                              {ccList[1] && <div><b>Plant Head:</b> {ccList[1]}</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
