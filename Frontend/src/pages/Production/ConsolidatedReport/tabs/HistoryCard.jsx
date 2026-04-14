import EmptyState from "../../../../components/ui/EmptyState";
import { CheckCircle, AlertTriangle, Clock, Wrench, PackageOpen } from "lucide-react";

function StatusBadge({ status }) {
  const config = {
    OK:       { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: <CheckCircle className="w-2.5 h-2.5" /> },
    REWORKED: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: <Wrench className="w-2.5 h-2.5" /> },
    WAITING:  { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200",    icon: <Clock className="w-2.5 h-2.5" /> },
  };
  const style = config[status] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      {style.icon}{status}
    </span>
  );
}

function ProcessBadge({ status }) {
  const config = {
    REWORK:  { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     icon: <AlertTriangle className="w-2.5 h-2.5" /> },
    PENDING: { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200",    icon: <Clock className="w-2.5 h-2.5" /> },
  };
  const style = config[status] || { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: <CheckCircle className="w-2.5 h-2.5" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      {style.icon}{status || "NORMAL"}
    </span>
  );
}

function HistoryCardTable({ data }) {
  const get = (item, field) => {
    const map = {
      srNo:          item["Sr No"]                  ?? item.SrNo          ?? item.srNo,
      dateTime:      item["Date & Time"]             ?? item.DateTime       ?? item.dateTime,
      activity:      item["Activity"]               ?? item.activity,
      processStatus: item["ProcessStatus"]           ?? item.processStatus,
      checkPoint:    item["Important check point"]  ?? item.ImportantCheckPoint ?? item.importantCheckPoint,
      method:        item["Method of checking"]     ?? item.MethodOfChecking    ?? item.methodOfChecking,
      operator:      item["Name of Operator"]       ?? item.OperatorName   ?? item.operatorName,
      issue:         item["Issue"]                  ?? item.issue,
      actionDateTime:item["Action Date & Time"]     ?? item.ActionDateTime  ?? item.actionDateTime,
      action:        item["Action"]                 ?? item.action,
      result:        item["Result"]                 ?? item.result,
    };
    return map[field];
  };

  const headers = ["Sr No","Date & Time","Activity","Process Status","Important Check Point","Method of Checking","Operator","Issue","Action Date & Time","Action","Result"];

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[550px] rounded-xl border border-slate-200 shadow-sm">
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
            data.map((item, idx) => {
              const result        = get(item, "result");
              const processStatus = get(item, "processStatus");
              const isPending     = result === "WAITING";
              const isRework      = result === "REWORKED";
              const rowBg = isPending ? "bg-blue-50/40" : isRework ? "bg-amber-50/40" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";
              return (
                <tr key={idx} className={`text-center transition-colors hover:bg-blue-50/60 ${rowBg}`}>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">{get(item,"srNo")}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-600">{get(item,"dateTime") || <span className="text-slate-300 italic">—</span>}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                    <span className={`font-semibold ${isPending ? "text-blue-600" : "text-slate-800"}`}>{get(item,"activity")}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap"><ProcessBadge status={processStatus} /></td>
                  <td className="px-3 py-2.5 border-b border-slate-100 max-w-[200px]">
                    {get(item,"checkPoint")
                      ? <span className={isRework ? "text-red-600 font-semibold" : "text-slate-600"} title={get(item,"checkPoint")}>{get(item,"checkPoint")}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 max-w-[180px]">
                    {get(item,"method")
                      ? <span className="bg-blue-100 px-2 py-0.5 rounded text-[11px] text-slate-600" title={get(item,"method")}>{get(item,"method")}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-700 font-medium">{get(item,"operator") || <span className="text-slate-300 italic">—</span>}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap max-w-[180px]">
                    {get(item,"issue")
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-red-50 text-red-600 border border-red-200" title={get(item,"issue")}>
                          <AlertTriangle className="w-2.5 h-2.5" />{get(item,"issue")}
                        </span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-600">{get(item,"actionDateTime") || <span className="text-slate-300 italic">—</span>}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                    {get(item,"action")
                      ? <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-violet-50 text-violet-700 border border-violet-200">{get(item,"action")}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap"><StatusBadge status={result} /></td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={headers.length} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                  <p className="text-sm">No history card data found for this serial number.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default HistoryCardTable;