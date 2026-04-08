// BUG FIX: SQL alias is `assembly` not `Assembly_SrNo`
// Also fixes: reworkOut field check (was `Rework_Out`, should be `reworkOut`)

import EmptyState from "../../../../components/ui/EmptyState";
import {
  FiTool, FiCheckCircle, FiClock, FiAlertTriangle, FiXCircle,
} from "react-icons/fi";
import { BsBoxSeam } from "react-icons/bs";
import { MdOutlineCategory } from "react-icons/md";
import { TbGitBranch } from "react-icons/tb";

function InfoCard({ Icon, label, value, cls }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white border border-gray-100
                    px-3.5 py-2.5 shadow-sm">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{label}</p>
        <p className="text-sm font-bold text-gray-700 truncate max-w-[180px]" title={value}>{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    Completed:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <FiCheckCircle size={10} /> },
    "In Progress":{ cls: "bg-blue-50 text-blue-700 border-blue-200",          icon: <FiClock size={10} /> },
    Pending:      { cls: "bg-amber-50 text-amber-700 border-amber-200",        icon: <FiClock size={10} /> },
    Rejected:     { cls: "bg-red-50 text-red-700 border-red-200",              icon: <FiXCircle size={10} /> },
  };
  const s = cfg[status] || { cls: "bg-gray-100 text-gray-600 border-gray-200", icon: <FiTool size={10} /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${s.cls}`}>
      {s.icon}{status || "—"}
    </span>
  );
}

function DurationBadge({ duration }) {
  if (!duration) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-200">
      <FiClock size={10} /> In Progress
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200">
      <FiClock size={10} />{duration}
    </span>
  );
}

function fmt(d) {
  if (!d) return null;
  return d.replace("T", " ").replace("Z", "").substring(0, 19);
}

function ReworkReportTable({ data }) {
  if (!Array.isArray(data)) return <EmptyState message="No rework data found." />;

  const first = data.length > 0 ? data[0] : {};
  // BUG FIX: SQL returns camelCase aliases: modelName, category, assembly
  const modelName   = first.modelName   || first.Model_Name  || "";
  const category    = first.category    || first.Category    || "";
  const assemblySrNo= first.assembly    || first.Assembly_SrNo || ""; // ← BUG FIX

  const completed  = data.filter(d => d.reworkStatus === "Completed").length;
  const ongoing    = data.filter(d => !d.reworkOut).length;  // ← BUG FIX: was `Rework_Out`

  const headers = [
    "Station","Process Code","Rework IN","Rework Out",
    "Duration","Operator","Status","Defect Category",
    "Defect","Root Cause","Counter Action","Remark",
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Info row */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4
                        bg-gradient-to-r from-amber-50/50 via-orange-50/30 to-amber-50/50
                        rounded-2xl border border-amber-100">
          <InfoCard Icon={BsBoxSeam}        label="Model"          value={modelName}     cls="bg-amber-100 text-amber-700" />
          <InfoCard Icon={MdOutlineCategory} label="Category"       value={category}      cls="bg-violet-100 text-violet-700" />
          <InfoCard Icon={TbGitBranch}       label="Assembly Sr.No" value={assemblySrNo}  cls="bg-blue-100 text-blue-700" />

          {/* Quick stats */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-100 shadow-sm">
              <FiCheckCircle size={13} className="text-emerald-600" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Done</p>
                <p className="text-sm font-black text-emerald-700">{completed}</p>
              </div>
            </div>
            {ongoing > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-amber-100 shadow-sm">
                <FiClock size={13} className="text-amber-600" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Ongoing</p>
                  <p className="text-sm font-black text-amber-700">{ongoing}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              {headers.map((h, i) => (
                <th key={i}
                    className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length > 0 ? data.map((item, idx) => {
              const isOngoing = !item.reworkOut;  // ← BUG FIX: camelCase from SQL alias
              const bg = isOngoing
                ? "bg-amber-50/40"
                : idx % 2 === 0 ? "bg-white" : "bg-gray-50/60";
              return (
                <tr key={idx} className={`text-center transition-colors duration-150 ${bg} hover:bg-amber-50/30`}>
                  <td className="px-4 py-2.5 whitespace-nowrap font-bold text-gray-800">{item.station}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">
                      {item.processCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">
                    {fmt(item.reworkIN) || <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                    {fmt(item.reworkOut)
                      ? <span className="text-gray-600">{fmt(item.reworkOut)}</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                          <FiClock size={10} /> Ongoing
                        </span>
                    }
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <DurationBadge duration={item.duration || item["Duration (DD,HH:MM)"]} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700 font-medium">
                    {item.userName || <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><StatusBadge status={item.reworkStatus} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {item.defectCategory
                      ? <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">{item.defectCategory}</span>
                      : <span className="text-gray-300 italic text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap max-w-[180px]">
                    {item.defect
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-red-50 text-red-600 border border-red-200" title={item.defect}>
                          <FiAlertTriangle size={10} />{item.defect}
                        </span>
                      : <span className="text-gray-300 italic text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap max-w-[160px]">
                    {item.rootCause
                      ? <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold border border-orange-200" title={item.rootCause}>{item.rootCause}</span>
                      : <span className="text-gray-300 italic text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap max-w-[160px]">
                    {item.counterAction
                      ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold border border-blue-200" title={item.counterAction}>{item.counterAction}</span>
                      : <span className="text-gray-300 italic text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    {item.remark
                      ? <span className="text-gray-600 text-xs block truncate" title={item.remark}>{item.remark}</span>
                      : <span className="text-gray-300 italic text-xs">—</span>}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={headers.length}><EmptyState message="No rework data found for this serial number." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1 py-1">
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Legend:</p>
          {[
            { cls: "bg-white border-gray-200",   label: "Completed" },
            { cls: "bg-amber-50 border-amber-200", label: "In Progress / Ongoing" },
          ].map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded border ${l.cls}`} />
              <span className="text-xs text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReworkReportTable;