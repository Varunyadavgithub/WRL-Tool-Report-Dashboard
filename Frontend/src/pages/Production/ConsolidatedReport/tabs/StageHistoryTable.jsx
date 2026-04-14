import { useState } from "react";
import { List, Clock, PackageOpen } from "lucide-react";
import EmptyState from "../../../../components/ui/EmptyState";

function ActivityBadge({ type }) {
  const styles = {
    IN:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    OUT: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border ${styles[type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {type || "—"}
    </span>
  );
}

// ── Timeline view ──────────────────────────────────────────────────────────────
function TimelineView({ data }) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-blue-200 via-blue-100 to-transparent" />
      {data.map((item, idx) => {
        const isIN = item.ActivityTypeName === "IN";
        return (
          <div key={idx} className="relative mb-4 last:mb-0">
            <div className={`absolute -left-5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isIN ? "bg-emerald-100 border-emerald-400" : "bg-red-100 border-red-400"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isIN ? "bg-emerald-500" : "bg-red-500"}`} />
            </div>
            <div className={`ml-2 p-3.5 rounded-xl border transition-colors hover:shadow-sm ${isIN ? "bg-emerald-50/40 border-emerald-100" : "bg-red-50/40 border-red-100"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isIN ? "text-emerald-700 bg-emerald-100" : "text-red-700 bg-red-100"}`}>#{idx + 1}</span>
                  <span className="font-semibold text-slate-800 text-sm">{item.StationName}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">{item.StationCode}</span>
                </div>
                <ActivityBadge type={item.ActivityTypeName} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-slate-400" />{item.ActivityOn?.replace("T"," ").replace("Z","").substring(0,19) || "—"}</span>
                <span className="text-slate-400">Operator:</span>
                <span className="font-medium text-slate-700">{item.UserName}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageHistoryTable({ data }) {
  const [view, setView] = useState("table");
  const headers = ["#","Station Code","Station Name","Operator","Activity On","Type"];

  return (
    <div className="flex flex-col gap-3">
      {Array.isArray(data) && data.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 font-semibold">{data.length} stage record{data.length !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${view === "table" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <List className="w-3 h-3" /> Table
            </button>
            <button onClick={() => setView("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${view === "timeline" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <Clock className="w-3 h-3" /> Timeline
            </button>
          </div>
        </div>
      )}

      {view === "timeline" && Array.isArray(data) && data.length > 0 ? (
        <div className="max-h-[520px] overflow-y-auto pr-2">
          <TimelineView data={data} />
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[520px] rounded-xl border border-slate-200 shadow-sm">
          <table className="min-w-full text-xs text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100">
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.isArray(data) && data.length > 0 ? (
                data.map((item, idx) => (
                  <tr key={idx} className="text-center transition-colors hover:bg-blue-50/60 even:bg-slate-50/40">
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{idx + 1}</span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-600">{item.StationCode}</span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-700 font-medium text-left">{item.StationName}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-600">{item.UserName}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-500 font-mono text-[10px]">
                      {item.ActivityOn?.replace("T"," ").replace("Z","").substring(0,19)}
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap"><ActivityBadge type={item.ActivityTypeName} /></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                      <p className="text-sm">No stage history found for this serial number.</p>
                    </div>
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