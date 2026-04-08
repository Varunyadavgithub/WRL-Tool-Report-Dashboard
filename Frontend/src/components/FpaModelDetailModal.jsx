import { useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useLazyGetFpaByModelQuery } from "../redux/api/fpaReportApi";
import { closeModelModal, openDefectModal } from "../redux/slices/fpaReportSlice.js";
import Loader from "./ui/Loader";
import { HiOutlineClipboardList, HiOutlineBadgeCheck } from "react-icons/hi";
import { IoCloseOutline } from "react-icons/io5";
import { FaArrowRight, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { MdOutlineSpeed } from "react-icons/md";
import { RiAlarmWarningLine } from "react-icons/ri";

/* ── FPQI status helper ── */
const fpqiStyle = (val) => {
  if (val === null || val === undefined) return null;
  if (val > 5) return { label: "Poor", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" };
  if (val > 2) return { label: "Fair", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" };
  return           { label: "Good", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
};

/* ── Mini stat chip ── */
const StatChip = ({ label, value, colorClass = "text-gray-800" }) => (
  <div className="flex flex-col items-center px-4 py-2 bg-white rounded-lg border border-gray-100">
    <span className={`text-lg font-black ${colorClass}`}>{value}</span>
    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</span>
  </div>
);

const FpaModelDetailModal = ({ modelName, startDate, endDate }) => {
  const dispatch = useDispatch();

  const [triggerFetch, { data: modelData, isLoading, isFetching }] =
    useLazyGetFpaByModelQuery();

  useEffect(() => {
    if (modelName && startDate && endDate) {
      triggerFetch({ model: modelName, startDate, endDate });
    }
  }, [modelName, startDate, endDate, triggerFetch]);

  const handleClose   = () => dispatch(closeModelModal());
  const handleFGSR    = (fgsrNo) => dispatch(openDefectModal(fgsrNo));

  const records = modelData?.data || [];
  const loading = isLoading || isFetching;

  /* Derived summary */
  const summary = useMemo(() => ({
    total:     records.length,
    critical:  records.reduce((s, r) => s + (r.Critical || 0), 0),
    major:     records.reduce((s, r) => s + (r.Major    || 0), 0),
    minor:     records.reduce((s, r) => s + (r.Minor    || 0), 0),
    avgFPQI:   records.length
      ? (records.reduce((s, r) => s + (parseFloat(r.FPQI) || 0), 0) / records.length).toFixed(3)
      : null,
    worstFG: records.length
      ? records.reduce((worst, r) =>
          parseFloat(r.FPQI || 0) > parseFloat(worst.FPQI || 0) ? r : worst, records[0])
      : null,
  }), [records]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-slate-50 to-blue-50/40 rounded-t-2xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Model Details</span>
            </div>
            <h2 className="text-base font-black text-gray-900 truncate pr-4" title={modelName}>
              {modelName}
            </h2>
          </div>
          <button onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors flex-shrink-0">
            <IoCloseOutline size={20} />
          </button>
        </div>

        {/* ── Summary Stats Bar ── */}
        {!loading && records.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/60">
            <div className="flex flex-wrap items-center gap-2">
              <StatChip label="FG Inspected"  value={summary.total}    colorClass="text-blue-700" />
              <StatChip label="Critical"      value={summary.critical} colorClass="text-red-600" />
              <StatChip label="Major"         value={summary.major}    colorClass="text-orange-600" />
              <StatChip label="Minor"         value={summary.minor}    colorClass="text-yellow-600" />
              {summary.avgFPQI !== null && (
                <StatChip label="Avg FPQI"
                  value={summary.avgFPQI}
                  colorClass={
                    parseFloat(summary.avgFPQI) > 5 ? "text-red-700"
                    : parseFloat(summary.avgFPQI) > 2 ? "text-amber-700"
                    : "text-emerald-700"
                  } />
              )}
              {/* Worst FG callout */}
              {summary.worstFG && parseFloat(summary.worstFG.FPQI) > 0 && (
                <div className="ml-auto flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                  <RiAlarmWarningLine size={13} className="text-red-500 flex-shrink-0" />
                  <div className="text-[10px]">
                    <span className="text-gray-500">Worst FG: </span>
                    <span className="font-black text-red-700 font-mono">{summary.worstFG.FGSRNo}</span>
                    <span className="text-gray-400 ml-1">(FPQI: {parseFloat(summary.worstFG.FPQI).toFixed(3)})</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="p-12 flex items-center justify-center">
              <Loader />
            </div>
          )}

          {!loading && records.length === 0 && (
            <div className="p-14 text-center">
              <HiOutlineClipboardList className="text-gray-200 text-5xl mx-auto mb-3" />
              <p className="text-gray-500 font-semibold text-sm">No inspection records found for this model.</p>
            </div>
          )}

          {!loading && records.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-gray-100 text-gray-400 text-[9px] uppercase tracking-widest font-bold">
                  <th className="px-4 py-2.5 text-left">SR</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Shift</th>
                  <th className="px-4 py-2.5 text-left">FGSRNo</th>
                  <th className="px-4 py-2.5 text-left">Country</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-center">Critical</th>
                  <th className="px-4 py-2.5 text-center">Major</th>
                  <th className="px-4 py-2.5 text-center">Minor</th>
                  <th className="px-4 py-2.5 text-center">FPQI</th>
                  <th className="px-4 py-2.5 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((item, index) => {
                  const fpqi      = item.FPQI !== null ? parseFloat(item.FPQI) : null;
                  const st        = fpqiStyle(fpqi);
                  const hasDefect = (item.Critical + item.Major + item.Minor) > 0;
                  const totalDef  = (item.Critical || 0) + (item.Major || 0) + (item.Minor || 0);

                  return (
                    <tr key={index}
                      className={`transition-colors hover:bg-blue-50/40 ${hasDefect ? "bg-red-50/10" : ""}`}>
                      <td className="px-4 py-2.5 text-gray-400 font-mono text-[10px]">{item.SRNO}</td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium">
                        {new Date(item.Date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="bg-blue-50 text-blue-700 font-bold text-[10px] px-1.5 py-0.5 rounded">
                          {item.Shift}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-blue-600 font-bold text-[11px]">
                        {item.FGSRNo}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{item.Country}</td>

                      {/* Defect status indicator */}
                      <td className="px-4 py-2.5 text-center">
                        {hasDefect ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
                            <RiAlarmWarningLine size={9} />
                            {totalDef} defect{totalDef > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                            <HiOutlineBadgeCheck size={10} />
                            Clean
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-black text-sm ${item.Critical > 0 ? "text-red-600" : "text-gray-200"}`}>
                          {item.Critical}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-black text-sm ${item.Major > 0 ? "text-orange-600" : "text-gray-200"}`}>
                          {item.Major}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-black text-sm ${item.Minor > 0 ? "text-yellow-500" : "text-gray-200"}`}>
                          {item.Minor}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        {fpqi !== null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-black ${st?.bg} ${st?.text} ${st?.border}`}>
                              {fpqi.toFixed(3)}
                            </span>
                            <span className={`text-[9px] font-semibold ${st?.text}`}>{st?.label}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => handleFGSR(item.FGSRNo)}
                          className="text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-all">
                          Details <FaArrowRight size={8} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals row */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-gray-200 text-[10px] font-black text-gray-600 uppercase">
                  <td colSpan={6} className="px-4 py-2.5 text-right tracking-wider">Totals →</td>
                  <td className="px-4 py-2.5 text-center text-red-600">{summary.critical}</td>
                  <td className="px-4 py-2.5 text-center text-orange-600">{summary.major}</td>
                  <td className="px-4 py-2.5 text-center text-yellow-600">{summary.minor}</td>
                  <td colSpan={2} className="px-4 py-2.5 text-center text-gray-500">
                    Avg: {summary.avgFPQI ?? "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {records.length} FG inspection records · Click "Details" to see individual defects
          </span>
          <button onClick={handleClose}
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FpaModelDetailModal;