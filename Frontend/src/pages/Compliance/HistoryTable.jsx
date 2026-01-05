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
} from "react-icons/fa";

export default function HistoryTable({ id }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await axios.get(baseURL + "compliance/certs/" + id);
      setHistory(res.data);
    } catch {
      toast.error("Failed to load calibration history");
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="py-6 text-center text-gray-500 italic">
        Loading calibration timeline…
      </div>
    );

  if (history.length === 0)
    return (
      <div className="py-6 text-center text-gray-400 italic">
        No calibration history found
      </div>
    );

  return (
    <div className="mt-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">
        Calibration Timeline
      </h3>

      <div className="relative border-l-2 border-gray-300 ml-4 space-y-6">
        {history.map((h, i) => {
          const isPass = h.Result === "Pass";

          return (
            <div key={i} className="relative pl-6">
              {/* DOT */}
              <span
                className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 ${
                  isPass
                    ? "bg-green-500 border-green-200"
                    : "bg-red-500 border-red-200"
                }`}
              />

              {/* CARD */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {isPass ? (
                      <FaCheckCircle className="text-green-600" />
                    ) : (
                      <FaTimesCircle className="text-red-600" />
                    )}
                    <span
                      className={isPass ? "text-green-700" : "text-red-700"}
                    >
                      {h.Result || "Result N/A"}
                    </span>
                  </div>

                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <FaCalendarAlt />
                    {h.CalibratedOn?.slice(0, 10)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <FaUser />
                    <span>
                      <b>Performed By:</b> {h.EmployeeName || "—"}
                    </span>
                  </div>

                  <div>
                    <b>Department:</b> {h.department_name || "—"}
                  </div>
                  <div className="flex items-center gap-1">
                    <FaBuilding />
                    <span>
                      <b>Agency:</b> {h.CalibrationAgency || "—"}
                    </span>
                  </div>

                  <div>
                    <b>Valid Till:</b> {h.ValidTill?.slice(0, 10) || "—"}
                  </div>
                </div>

                {h.FilePath && (
                  <div className="mt-3">
                    <a
                      href={
                        baseURL.replace(/\/api\/v1\/?$/, "") +
                        "/" +
                        h.FilePath.replace(/^\/+/, "")
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      View PDF
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
