// src/pages/ConsolidatedReport/tabs/HistoryCardTable.jsx
import EmptyState from "../../../../components/ui/EmptyState";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiTool,
} from "react-icons/fi";

// ─── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    OK: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <FiCheckCircle size={11} />,
    },
    REWORKED: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: <FiTool size={11} />,
    },
    WAITING: {
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
      icon: <FiClock size={11} />,
    },
  };

  const style = config[status] || {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border
                  ${style.bg} ${style.text} ${style.border}`}
    >
      {style.icon}
      {status}
    </span>
  );
}

// ─── Process Status Badge ───────────────────────────────────────
function ProcessBadge({ status }) {
  const config = {
    REWORK: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: <FiAlertTriangle size={11} />,
    },
    PENDING: {
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
      icon: <FiClock size={11} />,
    },
  };

  const style = config[status] || {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: <FiCheckCircle size={11} />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border
                  ${style.bg} ${style.text} ${style.border}`}
    >
      {style.icon}
      {status || "NORMAL"}
    </span>
  );
}

// ─── Summary Card ───────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, count, color }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm bg-white
                  ${color.border} hover:shadow-md transition-shadow duration-200`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.bg}`}
      >
        <Icon size={18} className={color.icon} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none">
          {label}
        </p>
        <p className={`text-xl font-bold mt-0.5 ${color.text}`}>{count}</p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
function HistoryCardTable({ data }) {
  // ─── Field Access Helpers (SQL returns spaced column names) ──
  const get = (item, field) => {
    // Try both formats: spaced (SQL alias) and camelCase
    const map = {
      srNo: item["Sr No"] ?? item.SrNo ?? item.srNo,
      dateTime: item["Date & Time"] ?? item.DateTime ?? item.dateTime,
      activity: item["Activity"] ?? item.activity,
      processStatus: item["ProcessStatus"] ?? item.processStatus,
      checkPoint:
        item["Important check point"] ??
        item.ImportantCheckPoint ??
        item.importantCheckPoint,
      method:
        item["Method of checking"] ??
        item.MethodOfChecking ??
        item.methodOfChecking,
      operator:
        item["Name of Operator"] ?? item.OperatorName ?? item.operatorName,
      issue: item["Issue"] ?? item.issue,
      actionDateTime:
        item["Action Date & Time"] ??
        item.ActionDateTime ??
        item.actionDateTime,
      action: item["Action"] ?? item.action,
      result: item["Result"] ?? item.result,
    };
    return map[field];
  };

  const headers = [
    "Sr No",
    "Date & Time",
    "Activity",
    "Process Status",
    "Important Check Point",
    "Method of Checking",
    "Operator",
    "Issue",
    "Action Date & Time",
    "Action",
    "Result",
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Table ───────────────────────────────────────────── */}
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[550px] rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-center"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.isArray(data) && data.length > 0 ? (
              data.map((item, index) => {
                const result = get(item, "result");
                const processStatus = get(item, "processStatus");
                const isPending = result === "WAITING";
                const isRework = result === "REWORKED";

                // Row background based on status
                const rowBg = isPending
                  ? "bg-blue-50/40"
                  : isRework
                    ? "bg-amber-50/40"
                    : index % 2 === 0
                      ? "bg-white"
                      : "bg-gray-50/80";

                return (
                  <tr
                    key={index}
                    className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/70`}
                  >
                    {/* Sr No */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                        {get(item, "srNo")}
                      </span>
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      {get(item, "dateTime") ? (
                        <span className="text-gray-600">
                          {get(item, "dateTime")}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>

                    {/* Activity */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`font-semibold text-xs ${
                          isPending ? "text-blue-600" : "text-gray-800"
                        }`}
                      >
                        {get(item, "activity")}
                      </span>
                    </td>

                    {/* Process Status */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ProcessBadge status={processStatus} />
                    </td>

                    {/* Important Check Point */}
                    <td className="px-4 py-2.5 max-w-[200px]">
                      {get(item, "checkPoint") ? (
                        <span
                          className={`text-xs ${
                            isRework
                              ? "text-red-600 font-semibold"
                              : "text-gray-600"
                          }`}
                          title={get(item, "checkPoint")}
                        >
                          {get(item, "checkPoint")}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Method of Checking */}
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[180px]">
                      {get(item, "method") ? (
                        <span
                          className="bg-blue-100 px-2 py-0.5 rounded text-xs text-gray-600"
                          title={get(item, "method")}
                        >
                          {get(item, "method")}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Operator */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {get(item, "operator") ? (
                        <span className="text-gray-700 text-xs font-medium">
                          {get(item, "operator")}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Issue */}
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[180px]">
                      {get(item, "issue") ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold
                                     rounded-full bg-red-50 text-red-600 border border-red-200"
                          title={get(item, "issue")}
                        >
                          <FiAlertTriangle size={10} />
                          {get(item, "issue")}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Action Date & Time */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      {get(item, "actionDateTime") ? (
                        <span className="text-gray-600">
                          {get(item, "actionDateTime")}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {get(item, "action") ? (
                        <span
                          className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full
                                     bg-purple-50 text-purple-700 border border-purple-200"
                        >
                          {get(item, "action")}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Result */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <StatusBadge status={result} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length}>
                  <EmptyState message="No history card data found for this serial number." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HistoryCardTable;
