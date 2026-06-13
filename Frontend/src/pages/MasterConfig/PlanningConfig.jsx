import { useState, useMemo } from "react";
import { CalendarRange, Upload, Download, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";

const PRIORITIES = ["High","Medium","Low"];
const SHIFTS = ["Shift A","Shift B","Shift C","All Shifts"];

const today = new Date();
const fmtDate = (d) => d.toISOString().split("T")[0];

const INIT = { machineName:"", sapCode:"", partName:"", modelCode:"", targetQty:"", shift:"Shift A", planDate: fmtDate(today), priority:"Medium", customer:"", plannedCycleTime:"", status:"Active" };

const PriorityBadge = ({ p }) => {
  const c = { High:"bg-rose-50 text-rose-700 border-rose-200", Medium:"bg-amber-50 text-amber-700 border-amber-200", Low:"bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c[p]}`}>{p}</span>;
};

const AchievementBar = ({ target, actual }) => {
  if (!target || !actual) return <span className="text-slate-300 text-xs">—</span>;
  const pct = Math.min(100, Math.round((actual / target) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-bold font-mono ${pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-rose-500"}`}>{pct}%</span>
    </div>
  );
};

const PlanningConfig = () => {
  const [data, setData]   = useState([]);
  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(fmtDate(today));

  const filtered = useMemo(() =>
    data.filter((r) =>
      (!dateFilter || r.planDate === dateFilter) &&
      (r.machineName.toLowerCase().includes(search.toLowerCase()) ||
       r.sapCode.includes(search) ||
       r.partName.toLowerCase().includes(search.toLowerCase()))
    ), [data, search, dateFilter]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = () => {
    if (!form.machineName || !form.sapCode || !form.targetQty) { toast.error("Machine, SAP Code and Target Qty are required."); return; }
    if (modal.mode === "add") {
      setData([...data, { ...form, id: Date.now(), actualQty: 0, targetQty: +form.targetQty, plannedCycleTime: +form.plannedCycleTime }]);
      toast.success("Plan added.");
    } else {
      setData(data.map((r) => r.id === modal.row.id ? { ...form, id: r.id, targetQty: +form.targetQty, plannedCycleTime: +form.plannedCycleTime } : r));
      toast.success("Plan updated.");
    }
    closeModal();
  };

  const handleDelete = (id) => { setData(data.filter((r) => r.id !== id)); toast.success("Deleted."); };
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const totalTarget = filtered.reduce((s, r) => s + r.targetQty, 0);
  const totalActual = filtered.reduce((s, r) => s + r.actualQty, 0);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Planning Configuration" subtitle="Manage production plans, shift targets and plan vs actual tracking" icon={CalendarRange} onAdd={openAdd} addLabel="Add Plan" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4">
        {/* Action bar */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500">Plan Date:</label>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
            <Upload className="w-3.5 h-3.5" /> Upload Excel Plan
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-600"><TrendingUp className="w-3 h-3 text-emerald-500" /> Target: <strong>{totalTarget.toLocaleString()}</strong></span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">Actual: <strong className="text-blue-600">{totalActual.toLocaleString()}</strong></span>
            <span className={`font-bold ${totalTarget > 0 && (totalActual / totalTarget) >= 0.9 ? "text-emerald-600" : "text-amber-600"}`}>
              {totalTarget > 0 ? `${Math.round((totalActual / totalTarget) * 100)}%` : "—"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Machine</TH><TH>SAP Code</TH><TH>Part Name</TH>
                  <TH center>Shift</TH><TH center>Target</TH><TH center>Actual</TH>
                  <TH>Achievement</TH><TH center>Priority</TH><TH>Customer</TH>
                  <TH center>Cycle Time</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD cls="font-medium text-slate-700 whitespace-nowrap">{r.machineName}</TD>
                    <TD mono cls="text-blue-600 font-bold">{r.sapCode}</TD>
                    <TD cls="text-slate-600 whitespace-nowrap">{r.partName}</TD>
                    <TD center><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{r.shift}</span></TD>
                    <TD center cls="font-bold text-slate-700">{r.targetQty.toLocaleString()}</TD>
                    <TD center cls={`font-bold ${r.actualQty >= r.targetQty ? "text-emerald-600" : "text-blue-600"}`}>{r.actualQty.toLocaleString()}</TD>
                    <TD><AchievementBar target={r.targetQty} actual={r.actualQty} /></TD>
                    <TD center><PriorityBadge p={r.priority} /></TD>
                    <TD cls="text-slate-500 text-[11px]">{r.customer}</TD>
                    <TD center cls="text-slate-600">{r.plannedCycleTime}s</TD>
                    <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={12} message="No production plans for the selected date." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Production Plan" : "Edit Production Plan"} onClose={closeModal} onSave={handleSave} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Machine Name" required><input value={form.machineName} onChange={sf("machineName")} placeholder="e.g. Bending Machine 1" className={inputCls} /></Field>
            <Field label="SAP Code" required><input value={form.sapCode} onChange={sf("sapCode")} placeholder="e.g. 1127024" className={inputCls} /></Field>
            <Field label="Part Name"><input value={form.partName} onChange={sf("partName")} placeholder="e.g. D-UNIT FRAME D150H" className={inputCls} /></Field>
            <Field label="Model Code"><input value={form.modelCode} onChange={sf("modelCode")} placeholder="e.g. D150H" className={inputCls} /></Field>
            <Field label="Target Quantity" required><input type="number" value={form.targetQty} onChange={sf("targetQty")} placeholder="e.g. 480" className={inputCls} min={1} /></Field>
            <Field label="Planned Cycle Time (s)"><input type="number" value={form.plannedCycleTime} onChange={sf("plannedCycleTime")} placeholder="e.g. 45" className={inputCls} min={1} /></Field>
            <Field label="Shift">
              <select value={form.shift} onChange={sf("shift")} className={selectCls}>{SHIFTS.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Production Date"><input type="date" value={form.planDate} onChange={sf("planDate")} className={inputCls} /></Field>
            <Field label="Priority">
              <select value={form.priority} onChange={sf("priority")} className={selectCls}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="Customer"><input value={form.customer} onChange={sf("customer")} placeholder="e.g. Whirlpool" className={inputCls} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PlanningConfig;
