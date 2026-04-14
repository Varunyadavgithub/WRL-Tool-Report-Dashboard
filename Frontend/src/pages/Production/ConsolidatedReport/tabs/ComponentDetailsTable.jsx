import EmptyState from "../../../../components/ui/EmptyState";
import { PackageOpen } from "lucide-react";

function ComponentDetailsTable({ data }) {
  const headers = ["Name", "Serial Number", "Type", "Supplier Name", "SAP Code", "Scanned On"];

  return (
    <div className="overflow-auto max-h-[550px] rounded-xl border border-slate-200 shadow-sm">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {headers.map((h) => (
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
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-600">{item.name}</span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] font-mono">{item.serial}</span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                  <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full border bg-blue-50 text-blue-600 border-blue-200">{item.type}</span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap text-slate-600">{item.supplierName}</td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap font-mono text-slate-500">{item.sapCode}</td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap text-slate-500 font-mono text-[10px]">
                  {item.scannedOn?.replace("T", " ").replace("Z", "")}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                  <p className="text-sm">No component details found for this serial number.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ComponentDetailsTable;