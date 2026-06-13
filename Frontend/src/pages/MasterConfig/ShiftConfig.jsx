import { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { Clock } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";
import { selectShifts } from "../../redux/slices/masterConfigSlice";
import { useAddShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation } from "../../redux/api/masterConfigApi";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const INIT = { shiftName:"", shiftCode:"", startTime:"08:00", endTime:"16:00", breakStart:"12:00", breakEnd:"12:30", teaBreaks:"2", overtimeShift:false, weeklyOff:["Sunday"], color:"#3b82f6", status:true };

const ShiftConfig = () => {
  const data     = useSelector(selectShifts);
  const [addShift]    = useAddShiftMutation();
  const [updateShift] = useUpdateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();
  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => data.filter((r) => r.shiftName.toLowerCase().includes(search.toLowerCase()) || r.shiftCode.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = async () => {
    if (!form.shiftName || !form.shiftCode) { toast.error("Shift Name and Code required."); return; }
    try {
      if (modal.mode === "add") {
        await addShift(form).unwrap();
        toast.success("Shift added.");
      } else {
        await updateShift({ ...form, id: modal.row.id }).unwrap();
        toast.success("Shift updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save shift.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteShift(id).unwrap();
      toast.success("Shift deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete shift.");
    }
  };
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const toggleDay = (day) =>
    setForm((f) => ({ ...f, weeklyOff: f.weeklyOff.includes(day) ? f.weeklyOff.filter((d) => d !== day) : [...f.weeklyOff, day] }));

  const duration = (start, end) => {
    if (!start || !end) return "—";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 1440;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Shift Configuration" subtitle="Define shifts, break timings, weekly offs and holiday calendar" icon={Clock} onAdd={openAdd} addLabel="Add Shift" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Shift Name</TH><TH>Code</TH><TH>Start</TH><TH>End</TH>
                  <TH>Duration</TH><TH>Break</TH><TH center>Tea Breaks</TH>
                  <TH>Weekly Off</TH><TH center>OT Shift</TH><TH center>Status</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD cls="font-bold text-slate-800">{r.shiftName}</TD>
                    <TD><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{r.shiftCode}</span></TD>
                    <TD mono cls="text-emerald-600 font-semibold">{r.startTime}</TD>
                    <TD mono cls="text-rose-500 font-semibold">{r.endTime}</TD>
                    <TD cls="font-semibold text-slate-600">{duration(r.startTime, r.endTime)}</TD>
                    <TD mono cls="text-slate-500">{r.breakStart && r.breakEnd ? `${r.breakStart} – ${r.breakEnd}` : "—"}</TD>
                    <TD center cls="text-slate-600">{r.teaBreaks}</TD>
                    <TD cls="text-slate-500">{r.weeklyOff?.join(", ") || "—"}</TD>
                    <TD center>{r.overtimeShift ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">OT</span> : <span className="text-slate-300">—</span>}</TD>
                    <TD center><StatusBadge active={r.status} /></TD>
                    <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={12} message="No shifts configured yet." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Shift" : "Edit Shift"} onClose={closeModal} onSave={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Shift Name" required><input value={form.shiftName} onChange={sf("shiftName")} placeholder="e.g. Shift A" className={inputCls} /></Field>
            <Field label="Shift Code" required><input value={form.shiftCode} onChange={sf("shiftCode")} placeholder="e.g. SA" className={inputCls} /></Field>
            <Field label="Start Time" required><input type="time" value={form.startTime} onChange={sf("startTime")} className={inputCls} /></Field>
            <Field label="End Time" required><input type="time" value={form.endTime} onChange={sf("endTime")} className={inputCls} /></Field>
            <Field label="Break Start Time"><input type="time" value={form.breakStart} onChange={sf("breakStart")} className={inputCls} /></Field>
            <Field label="Break End Time"><input type="time" value={form.breakEnd} onChange={sf("breakEnd")} className={inputCls} /></Field>
            <Field label="Number of Tea Breaks">
              <select value={form.teaBreaks} onChange={sf("teaBreaks")} className={selectCls}>
                {["0","1","2","3"].map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Weekly Off Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${form.weeklyOff?.includes(day) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.overtimeShift} onChange={sf("overtimeShift")} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-slate-700 font-medium">Overtime Shift</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.status} onChange={sf("status")} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-slate-700 font-medium">Active</span>
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ShiftConfig;
