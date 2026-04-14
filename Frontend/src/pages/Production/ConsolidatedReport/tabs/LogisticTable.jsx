import { AlertTriangle, PackageOpen } from "lucide-react";
import EmptyState from "../../../../components/ui/EmptyState";

const FALLBACK = {
  FG_Auto_Scan:        "FG Not Unloaded",
  FG_Auto_Scan_Date:   "FG Not Unloaded",
  FG_Unloading:        "FG Not Scanned",
  FG_Unloading_Date:   "FG Not Scanned",
  Session_ID:          "FG Not Dispatched",
  Vehicle_No:          "FG Not Dispatched",
  DockNo:              "FG Not Dispatched",
  Vehicle_Entry_Time:  "FG Not Dispatched",
};

const HEADERS = [
  "FG Auto Scan", "FG Auto Scan Date", "FG Unloading", "FG Unloading Date",
  "Session ID", "Vehicle No", "Dock No", "Vehicle Entry Time",
];

const FIELDS = Object.keys(FALLBACK);

function LogisticTable({ data }) {
  return (
    <div className="overflow-auto max-h-[550px] rounded-xl border border-slate-200 shadow-sm">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0" style={{ minWidth: "900px" }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {HEADERS.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.isArray(data) && data.length > 0 ? (
            data.map((item, idx) => (
              <tr key={idx} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center">
                {FIELDS.map((field) => {
                  const value = item?.[field];
                  return (
                    <td key={field} className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {value == null ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {FALLBACK[field]}
                        </span>
                      ) : (
                        <span className={field === "Session_ID" ? "font-mono font-semibold text-blue-700" : "text-slate-700"}>
                          {value}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                  <p className="text-sm max-w-xs">Logistic data will be available only after the FG number is generated.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default LogisticTable;