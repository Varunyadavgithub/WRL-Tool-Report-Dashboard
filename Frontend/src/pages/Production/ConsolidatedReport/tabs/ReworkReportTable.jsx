import { Wrench, CheckCircle, Clock, AlertTriangle, XCircle, Box, Tag, GitBranch } from "lucide-react";
import EmptyState from "../../../../components/ui/EmptyState";

function InfoCard({ icon: Icon, label, value, cls }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-100 px-3.5 py-2.5 shadow-sm">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-700 truncate max-w-[180px]" title={value}>{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    Completed:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle className="w-2.5 h-2.5" /> },
    "In Progress":{ cls: "bg-blue-50 text-blue-700 border-blue-200",          icon: <Clock className="w-2.5 h-2.5" /> },
    Pending:      { cls: "bg-amber-50 text-amber-700 border-amber-200",        icon: <Clock className="w-2.5 h-2.5" /> },
    Rejected:     { cls: "bg-red-50 text-red-700 border-red-200",              icon: <XCircle className="w-2.5 h-2.5" /> },
  };
  const s = cfg[status] || { cls: "bg-slate-100 text-slate-600 border-slate-200", icon: <Wrench className="w-2.5 h-2.5" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${s.cls}`}>
      {s.icon}{status || "—"}
    </span>
  );
}

function DurationBadge({ duration }) {
  if (!duration) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-200">
      <Clock className="w-2.5 h-2.5" /> In Progress
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200">
      <Clock className="w-2.5 h-2.5" />{duration}
    </span>
  );
}

function fmt(d) {
  if (!d) return null;
  return d.replace("T", " ").replace("Z", "").substring(0, 19);
}

function ReworkReportTable({ data }) {
  if (!Array.isArray(data)) return <EmptyState message="No rework data found." />;

  const first       = data.length > 0 ? data[0] : {};
  const modelName   = first.modelName    || first.Model_Name   || "";
  const category    = first.category     || first.Category     || "";
  const assemblySrNo= first.assembly     || first.Assembly_SrNo || "";
  const completed   = data.filter(d => d.reworkStatus === "Completed").length;
  const ongoing     = data.filter(d => !d.reworkOut).length;

  const headers = ["Station","Process Code","Rework IN","Rework Out","Duration","Operator","Status","Defect Category","Defect","Root Cause","Counter Action","Remark"];

  return (
    <div className="flex flex-col gap-4">
      {/* Info row */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
          <InfoCard icon={Box}      label="Model"          value={modelName}    cls="bg-amber-100 text-amber-700" />
          <InfoCard icon={Tag}      label="Category"       value={category}     cls="bg-violet-100 text-violet-700" />
          <InfoCard icon={GitBranch}label="Assembly Sr.No" value={assemblySrNo} cls="bg-blue-100 text-blue-700" />
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-100 shadow-sm">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Done</p>
                <p className="text-sm font-black text-emerald-700">{completed}</p>
              </div>
            </div>
            {ongoing > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-amber-100 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Ongoing</p>
                  <p className="text-sm font-black text-amber-700">{ongoing}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[500px] rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-amber-500 text-white">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-center border-r border-white/10 last:border-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map((item, idx) => {
              const isOngoing = !item.reworkOut;
              const bg        = isOngoing ? "bg-amber-50/40" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";
              return (
                <tr key={idx} className={`text-center transition-colors hover:bg-amber-50/30 ${bg}`}>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap font-bold text-slate-800">{item.station}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-600">{item.processCode}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-600">{fmt(item.reworkIN) || <span className="text-slate-300 italic">—</span>}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                    {fmt(item.reworkOut)
                      ? <span className="text-slate-600">{fmt(item.reworkOut)}</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                          <Clock className="w-2.5 h-2.5" /> Ongoing
                        </span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap"><DurationBadge duration={item.duration || item["Duration (DD,HH:MM)"]} /></td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-700 font-medium">{item.userName || <span className="text-slate-300 italic">—</span>}</td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap"><StatusBadge status={item.reworkStatus} /></td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap">
                    {item.defectCategory
                      ? <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-violet-50 text-violet-700 border border-violet-200">{item.defectCategory}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap max-w-[180px]">
                    {item.defect
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-red-50 text-red-600 border border-red-200" title={item.defect}>
                          <AlertTriangle className="w-2.5 h-2.5" />{item.defect}
                        </span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap max-w-[160px]">
                    {item.rootCause
                      ? <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-orange-200" title={item.rootCause}>{item.rootCause}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap max-w-[160px]">
                    {item.counterAction
                      ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-200" title={item.counterAction}>{item.counterAction}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-slate-100 max-w-[200px]">
                    {item.remark
                      ? <span className="text-slate-600 block truncate" title={item.remark}>{item.remark}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={headers.length} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Wrench className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                  <p className="text-sm">No rework data found for this serial number.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1 py-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Legend:</p>
          {[
            { cls: "bg-white border-slate-200",   label: "Completed" },
            { cls: "bg-amber-50 border-amber-200", label: "In Progress / Ongoing" },
          ].map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded border ${l.cls}`} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReworkReportTable;