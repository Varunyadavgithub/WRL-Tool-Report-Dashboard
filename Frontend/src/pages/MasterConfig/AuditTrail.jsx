import { useState, useMemo } from "react";
import { FileText, Search, Download, Eye, RotateCcw } from "lucide-react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import SelectField from "../../components/ui/SelectField";
import { TH, TD, EmptyState } from "./_shared";

const MODULES = ["All","Material Config","Shift Config","Downtime Config","Quality Config","Machine Config","Planning Config","Mail Config","User Management"];
const ACTIONS = ["All","CREATE","UPDATE","DELETE","LOGIN","EXPORT","UPLOAD"];

const ACTION_STYLE = {
  CREATE:"bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE:"bg-blue-50 text-blue-700 border-blue-200",
  DELETE:"bg-rose-50 text-rose-700 border-rose-200",
  LOGIN:"bg-slate-100 text-slate-600 border-slate-200",
  EXPORT:"bg-amber-50 text-amber-700 border-amber-200",
  UPLOAD:"bg-violet-50 text-violet-700 border-violet-200",
};

const ActionBadge = ({ a }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ACTION_STYLE[a] || ACTION_STYLE.LOGIN}`}>{a}</span>
);

const AuditTrail = () => {
  const [logs]    = useState([]);
  const [search, setSearch]     = useState("");
  const [module, setModule]     = useState("All");
  const [action, setAction]     = useState("All");
  const [detail, setDetail]     = useState(null);

  const filtered = useMemo(() =>
    logs.filter((l) =>
      (module === "All" || l.module === module) &&
      (action === "All" || l.action === action) &&
      (l.user.toLowerCase().includes(search.toLowerCase()) ||
       l.module.toLowerCase().includes(search.toLowerCase()) ||
       l.field.toLowerCase().includes(search.toLowerCase()))
    ), [logs, search, module, action]);

  const moduleOpts = MODULES.map((m) => ({ value: m, label: m }));
  const actionOpts = ACTIONS.map((a) => ({ value: a, label: a }));

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-5 py-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100"><FileText className="w-4 h-4 text-slate-600" /></div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-none">Audit Trail</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Complete configuration change history and user activity log</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, module, field…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-56" />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-3 items-end">
          <div className="min-w-[170px] flex-1">
            <SelectField label="Module" value={module} options={moduleOpts} onChange={(e) => setModule(e.target.value)} />
          </div>
          <div className="min-w-[150px] flex-1">
            <SelectField label="Action Type" value={action} options={actionOpts} onChange={(e) => setAction(e.target.value)} />
          </div>
          <span className="text-[11px] text-slate-400 pb-2 ml-auto">{filtered.length} of {logs.length} entries</span>
        </div>

        {/* Log table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Date & Time</TH><TH>User</TH><TH>Role</TH>
                  <TH>Module</TH><TH center>Action</TH><TH>Field Changed</TH>
                  <TH>Previous Value</TH><TH>New Value</TH><TH>Remark</TH>
                  <TH center>Details</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((l, idx) => (
                  <tr key={l.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD mono cls="text-slate-500 whitespace-nowrap">{l.ts}</TD>
                    <TD cls="font-semibold text-slate-700 whitespace-nowrap">{l.user}</TD>
                    <TD><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{l.role}</span></TD>
                    <TD><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">{l.module}</span></TD>
                    <TD center><ActionBadge a={l.action} /></TD>
                    <TD cls="text-slate-600 font-medium">{l.field}</TD>
                    <TD mono cls="text-rose-500 text-[11px]">{l.prev}</TD>
                    <TD mono cls="text-emerald-600 text-[11px]">{l.next}</TD>
                    <TD cls="text-slate-400 text-[11px]">{l.remark}</TD>
                    <TD center>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetail(l)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="View Details">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {l.action !== "DELETE" && (
                          <button
                            onClick={() => { alert(`Rollback feature: Will revert "${l.field}" from "${l.next}" back to "${l.prev}"`); }}
                            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors" title="Rollback"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </TD>
                  </tr>
                )) : <EmptyState colSpan={11} message="No audit log entries found." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">Change Detail</h2>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><FileText className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Date & Time", detail.ts],["User", detail.user],["Role", detail.role],
                ["Module", detail.module],["Action", detail.action],["Field", detail.field],
                ["Previous Value", detail.prev],["New Value", detail.next],["Remark", detail.remark],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-36 shrink-0 mt-0.5">{k}</span>
                  <span className="text-slate-700 font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTrail;
