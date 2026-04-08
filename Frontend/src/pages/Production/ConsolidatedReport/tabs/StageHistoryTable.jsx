import { useState } from "react";
import { FiList, FiClock } from "react-icons/fi";
import { MdOutlineTimeline } from "react-icons/md";
import EmptyState from "../../../../components/ui/EmptyState";

function ActivityBadge({ type }) {
  const styles = {
    IN:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    OUT: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-block px-3 py-0.5 text-xs font-bold rounded-full border
                      ${styles[type] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {type || "—"}
    </span>
  );
}

// Timeline view
function TimelineView({ data }) {
  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-200 via-indigo-100 to-transparent" />

      {data.map((item, index) => {
        const isIN = item.ActivityTypeName === "IN";
        return (
          <div key={index} className="relative mb-4 last:mb-0">
            {/* Node */}
            <div className={`absolute -left-5 w-4 h-4 rounded-full border-2 flex items-center justify-center
                            ${isIN ? "bg-emerald-100 border-emerald-400" : "bg-red-100 border-red-400"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isIN ? "bg-emerald-500" : "bg-red-500"}`} />
            </div>

            <div className={`ml-2 p-3.5 rounded-xl border transition-colors
                            hover:shadow-sm
                            ${isIN ? "bg-emerald-50/40 border-emerald-100" : "bg-red-50/40 border-red-100"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg
                                    ${isIN ? "text-emerald-700 bg-emerald-100" : "text-red-700 bg-red-100"}`}>
                    #{index + 1}
                  </span>
                  <span className="font-semibold text-gray-800 text-sm">{item.StationName}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">
                    {item.StationCode}
                  </span>
                </div>
                <ActivityBadge type={item.ActivityTypeName} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <FiClock size={10} className="text-gray-400" />
                  {item.ActivityOn?.replace("T", " ").replace("Z", "").substring(0, 19) || "—"}
                </span>
                <span className="text-gray-400">Operator:</span>
                <span className="font-medium text-gray-700">{item.UserName}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageHistoryTable({ data }) {
  const [view, setView] = useState("table"); // "table" | "timeline"

  const headers = ["#", "Station Code", "Station Name", "Operator", "Activity On", "Type"];

  return (
    <div className="flex flex-col gap-3">
      {/* View switcher */}
      {Array.isArray(data) && data.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 font-semibold">
            {data.length} stage record{data.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            <button onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         transition-all cursor-pointer
                         ${view === "table" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <FiList size={12} /> Table
            </button>
            <button onClick={() => setView("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         transition-all cursor-pointer
                         ${view === "timeline" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <MdOutlineTimeline size={13} /> Timeline
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {view === "timeline" && Array.isArray(data) && data.length > 0 ? (
        <div className="max-h-[520px] overflow-y-auto pr-2">
          <TimelineView data={data} />
        </div>
      ) : (
        <div className="w-full overflow-x-auto overflow-y-auto max-h-[520px] rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                {headers.map((h, i) => (
                  <th key={i}
                      className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-center">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.isArray(data) && data.length > 0 ? (
                data.map((item, index) => (
                  <tr key={index}
                      className={`text-center transition-colors duration-150
                                  ${index % 2 === 0 ? "bg-white" : "bg-gray-50/80"}
                                  hover:bg-indigo-50/70`}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">
                        {item.StationCode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 font-medium text-left">
                      {item.StationName}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-xs">
                      {item.UserName}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs font-mono">
                      {item.ActivityOn?.replace("T", " ").replace("Z", "").substring(0, 19)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ActivityBadge type={item.ActivityTypeName} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length}>
                    <EmptyState message="No stage history found for this serial number." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StageHistoryTable;