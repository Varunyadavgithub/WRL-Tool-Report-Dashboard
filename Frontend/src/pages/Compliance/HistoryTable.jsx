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
} from "react-icons/fa";

const ESCALATION_META = {
  L0: {
    label: "Info",
    dot: "bg-blue-500 border-blue-200",
    text: "text-blue-700",
    icon: <FaInfoCircle />,
  },
  L1: {
    label: "Warning",
    dot: "bg-yellow-500 border-yellow-200",
    text: "text-yellow-700",
    icon: <FaExclamationTriangle />,
  },
  L2: {
    label: "Critical",
    dot: "bg-orange-500 border-orange-200",
    text: "text-orange-700",
    icon: <FaBell />,
  },
  L3: {
    label: "Audit Risk",
    dot: "bg-red-500 border-red-200",
    text: "text-red-700",
    icon: <FaTimesCircle />,
  },
};

export default function HistoryTable({ id }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const res = await axios.get(baseURL + "compliance/certs/" + id);
      setHistory(res?.data?.data);
    } catch {
      toast.error("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="py-6 text-center italic text-gray-500">
        Loading timeline…
      </div>
    );

  if (!history.length)
    return (
      <div className="py-6 text-center italic text-gray-400">
        No timeline available
      </div>
    );

  return (
    <div className="mt-4 bg-gray-50 border border-dashed rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">
        Calibration & Escalation Timeline
      </h3>

      <div className="relative border-l-2 border-gray-300 ml-4 space-y-6">
        {history.map((h, i) => {
          const isEscalation = h.EventType === "ESCALATION";
          const esc = isEscalation ? ESCALATION_META[h.EscalationLevel] : null;

          return (
            <div key={i} className="relative pl-6">
              {/* DOT */}
              <span
                className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4
                  ${
                    isEscalation
                      ? esc.dot
                      : h.Result === "Pass"
                      ? "bg-green-500 border-green-200"
                      : "bg-red-500 border-red-200"
                  }
                `}
              />

              {/* CARD */}
              <div className="bg-white rounded-lg shadow p-4">
                {/* HEADER */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {isEscalation ? (
                      <>
                        {esc.icon}
                        <span className={esc.text}>
                          Escalation {h.EscalationLevel} – {esc.label}
                        </span>
                      </>
                    ) : h.Result === "Pass" ? (
                      <>
                        <FaCheckCircle className="text-green-600" />
                        <span className="text-green-700">
                          Calibration Passed
                        </span>
                      </>
                    ) : (
                      <>
                        <FaTimesCircle className="text-red-600" />
                        <span className="text-red-700">Calibration Failed</span>
                      </>
                    )}
                  </div>

                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <FaCalendarAlt />
                    {h.EventTime?.slice(0, 10)}
                  </span>
                </div>

                {/* DETAILS */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  {!isEscalation && (
                    <>
                      <div className="flex items-center gap-1">
                        <FaUser />
                        <b>Employee:</b> {h.EmployeeName || "—"}
                      </div>

                      <div className="flex items-center gap-1">
                        <FaBuilding />
                        <b>Department:</b> {h.department_name || "—"}
                      </div>

                      <div>
                        <b>Agency:</b> {h.CalibrationAgency || "—"}
                      </div>

                      <div>
                        <b>Valid Till:</b> {h.ValidTill?.slice(0, 10) || "—"}
                      </div>
                    </>
                  )}

                  {isEscalation &&
                    (() => {
                      const ccList = h.MailCC
                        ? h.MailCC.split(",").map((e) => e.trim())
                        : [];

                      return (
                        <>
                          <div>
                            <b>Emplyee:</b> {h.MailTo || "—"}
                          </div>

                          <div>
                            <b>Mail CC:</b>
                            <div className="ml-2 mt-1 space-y-1">
                              {ccList[0] && (
                                <div>
                                  <b>Manager:</b> {ccList[0]}
                                </div>
                              )}
                              {ccList[1] && (
                                <div>
                                  <b>Plant Head:</b> {ccList[1]}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                </div>

                {/* PDF */}
                {h.FilePath && (
                  <div className="mt-3 flex items-center gap-2">
                    <FaFilePdf className="text-red-600" />
                    <a
                      href={
                        baseURL.replace(/\/api\/v1\/?$/, "") +
                        "/" +
                        h.FilePath.replace(/^\/+/, "")
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      View Report
                    </a>
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