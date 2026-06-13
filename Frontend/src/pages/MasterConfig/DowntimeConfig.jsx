import { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { TimerOff, Building2, X } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";
import { selectDowntimeReasons, selectDepartments } from "../../redux/slices/masterConfigSlice";
import {
  useAddDowntimeReasonMutation, useUpdateDowntimeReasonMutation, useDeleteDowntimeReasonMutation,
  useAddDepartmentMutation, useUpdateDepartmentMutation, useDeleteDepartmentMutation,
} from "../../redux/api/masterConfigApi";

const INIT = { dtCode:"", reason:"", department:"", status:true };
const DEPT_INIT = { name:"" };

const DepartmentBadge = ({ name }) =>
  name ? (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">{name}</span>
  ) : (
    <span className="text-slate-300 text-xs">—</span>
  );

// ── Manage Departments modal — lightweight inline CRUD list ──────────────────
const DepartmentManagerModal = ({ onClose }) => {
  const departments = useSelector(selectDepartments);
  const [addDepartment]    = useAddDepartmentMutation();
  const [updateDepartment] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const [form, setForm]     = useState(DEPT_INIT);
  const [editId, setEditId] = useState(null);

  const startEdit  = (d) => { setForm({ name: d.name }); setEditId(d.id); };
  const resetForm  = () => { setForm(DEPT_INIT); setEditId(null); };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) { toast.error("Department name is required."); return; }
    const dup = departments.find((d) => d.name.toLowerCase() === name.toLowerCase() && d.id !== editId);
    if (dup) { toast.error("Department already exists."); return; }

    try {
      if (editId) {
        await updateDepartment({ ...departments.find((d) => d.id === editId), name }).unwrap();
        toast.success("Department updated.");
      } else {
        await addDepartment({ name, status: true }).unwrap();
        toast.success("Department added.");
      }
      resetForm();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save department.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDepartment(id).unwrap();
      if (editId === id) resetForm();
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete department.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-800">Manage Departments</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 shrink-0">
          <input
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Department name"
            className={inputCls}
          />
          <button onClick={handleSubmit} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 transition-colors shrink-0">
            {editId ? "Update" : "Add"}
          </button>
          {editId && (
            <button onClick={resetForm} className="px-3 py-2 text-sm font-semibold rounded-lg text-slate-500 hover:bg-slate-100 transition-colors shrink-0">
              Cancel
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {departments.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {departments.map((d, idx) => (
                <li key={d.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] text-slate-400 font-mono w-5">{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-700">{d.name}</span>
                  </div>
                  <TableActions onEdit={() => startEdit(d)} onDelete={() => handleDelete(d.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-14 text-center text-xs text-slate-400">No departments yet — add one above.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const DowntimeConfig = () => {
  const data        = useSelector(selectDowntimeReasons);
  const departments = useSelector(selectDepartments);
  const [addDowntimeReason]    = useAddDowntimeReasonMutation();
  const [updateDowntimeReason] = useUpdateDowntimeReasonMutation();
  const [deleteDowntimeReason] = useDeleteDowntimeReasonMutation();
  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");
  const [deptModalOpen, setDeptModalOpen] = useState(false);

  const filtered = useMemo(() => data.filter((r) => r.dtCode.toLowerCase().includes(search.toLowerCase()) || r.reason.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = async () => {
    if (!form.dtCode || !form.reason) { toast.error("Code and Reason are required."); return; }
    try {
      if (modal.mode === "add") {
        if (data.find((r) => r.dtCode === form.dtCode)) { toast.error("Downtime Code already exists."); return; }
        await addDowntimeReason(form).unwrap();
        toast.success("Downtime reason added.");
      } else {
        await updateDowntimeReason({ ...form, id: modal.row.id }).unwrap();
        toast.success("Downtime reason updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save downtime reason.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDowntimeReason(id).unwrap();
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete.");
    }
  };
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Downtime Configuration" subtitle="Define downtime reason codes, departments and escalation rules" icon={TimerOff} onAdd={openAdd} addLabel="Add Reason" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        <div className="flex justify-end">
          <button onClick={() => setDeptModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <Building2 className="w-3.5 h-3.5" /> Manage Departments
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Code</TH><TH>Reason</TH><TH>Department</TH>
                  <TH center>Status</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD><span className="font-mono font-bold text-rose-600 text-xs">{r.dtCode}</span></TD>
                    <TD cls="font-medium text-slate-700">{r.reason}</TD>
                    <TD><DepartmentBadge name={r.department} /></TD>
                    <TD center><StatusBadge active={r.status} /></TD>
                    <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={6} message="No downtime reasons configured." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Downtime Reason" : "Edit Downtime Reason"} onClose={closeModal} onSave={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Downtime Code" required><input value={form.dtCode} onChange={sf("dtCode")} placeholder="e.g. DT001" className={inputCls} /></Field>
            <Field label="Downtime Reason" required><input value={form.reason} onChange={sf("reason")} placeholder="e.g. Machine Breakdown" className={inputCls} /></Field>
            <Field label="Department">
              <select value={form.department} onChange={sf("department")} className={selectCls}>
                <option value="">— Select —</option>
                {departments.filter((d) => d.status).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </Field>
            <div className="col-span-2 flex gap-6 p-3 rounded-lg bg-slate-50 border border-slate-200">
              {[["status","Active"]].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form[k]} onChange={sf(k)} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-slate-700 font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {deptModalOpen && <DepartmentManagerModal onClose={() => setDeptModalOpen(false)} />}
    </div>
  );
};

export default DowntimeConfig;
