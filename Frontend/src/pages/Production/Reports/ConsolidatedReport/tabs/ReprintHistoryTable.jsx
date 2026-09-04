import { Printer, MessageSquare, AlertTriangle, PackageOpen } from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return null;
  return dateStr.replace("T", " ").replace("Z", "").substring(0, 19);
}

function ReprintHistoryTable({ data }) {
  const totalPrints  = data.length;
  const reprintCount = totalPrints > 1 ? totalPrints : 0;
  const headers      = ["Sr No","Print #","Printed By","Printed On","Remark","Type"];

  return (
    <div className="flex flex-col gap-4">
      {/* Reprint alert */}
      {reprintCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              This barcode has been reprinted <span className="font-bold">{reprintCount}</span> time{reprintCount > 1 && "s"}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              First printed by <span className="font-semibold">{data[0]?.Printed_By}</span> on{" "}
              <span className="font-semibold">{formatDate(data[0]?.Printed_On)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Table */}
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
                const isReprint = idx > 0;
                const rowBg     = isReprint ? "bg-amber-50/40" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";
                return (
                  <tr key={idx} className={`text-center transition-colors hover:bg-blue-50/60 ${rowBg}`}>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                        {item.Sr_No || idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        <Printer className="w-2.5 h-2.5" /> {idx + 1} of {totalPrints}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-blue-700 uppercase">{item.Printed_By?.charAt(0) || "?"}</span>
                        </div>
                        <span className="text-xs font-medium text-slate-700">{item.Printed_By}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      {formatDate(item.Printed_On) ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-slate-700 font-medium">{formatDate(item.Printed_On)?.split(" ")[0]}</span>
                          <span className="text-[10px] text-slate-400">{formatDate(item.Printed_On)?.split(" ")[1]}</span>
                        </div>
                      ) : <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap max-w-[300px]">
                      {item.Remark ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-600 truncate" title={item.Remark}>{item.Remark}</span>
                        </div>
                      ) : <span className="text-slate-300 italic">No remark</span>}
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        <AlertTriangle className="w-2.5 h-2.5" /> Reprint
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                    <p className="text-sm">No reprint history found for this serial number.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReprintHistoryTable;