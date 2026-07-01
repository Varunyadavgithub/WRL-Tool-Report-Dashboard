import { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { ListChecks } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";
import { selectCheckpointLibrary } from "../../redux/slices/masterConfigSlice";
import {
  useAddCheckpointLibraryEntryMutation,
  useUpdateCheckpointLibraryEntryMutation,
  useDeleteCheckpointLibraryEntryMutation,
} from "../../redux/api/masterConfigApi";

const CATEGORIES = ["", "process", "quality", "safety", "other"];
const INIT = { checkPoint: "", method: "", specification: "", category: "", required: false, status: true };

const CheckpointLibraryConfig = () => {
  const data = useSelector(selectCheckpointLibrary);
  const [addEntry] = useAddCheckpointLibraryEntryMutation();
  const [updateEntry] = useUpdateCheckpointLibraryEntryMutation();
  const [deleteEntry] = useDeleteCheckpointLibraryEntryMutation();
  const [modal, setModal] = useState({ open: false, mode: "add", row: null });
  const [form, setForm] = useState(INIT);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      [r.checkPoint, r.method, r.specification, r.category].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const openAdd = () => { setForm(INIT); setModal({ open: true, mode: "add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open: true, mode: "edit", row }); };
  const closeModal = () => setModal({ open: false });

  const handleSave = async () => {
    if (!form.checkPoint.trim()) { toast.error("Check Point text is required."); return; }
    try {
      if (modal.mode === "add") {
        await addEntry(form).unwrap();
        toast.success("Checkpoint added.");
      } else {
        await updateEntry({ ...form, id: modal.row.id }).unwrap();
        toast.success("Checkpoint updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save checkpoint.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEntry(id).unwrap();
      toast.success("Checkpoint deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete checkpoint.");
    }
  };

  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader
        title="Checkpoint Library"
        subtitle="Reusable checkpoints that can be inserted into any audit template"
        icon={ListChecks}
        onAdd={openAdd}
        addLabel="Add Checkpoint"
        search={search}
        onSearch={setSearch}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Check Point</TH><TH>Method</TH><TH>Specification</TH>
                  <TH>Category</TH><TH center>Required</TH><TH center>Usage</TH>
                  <TH center>Status</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD cls="font-bold text-slate-800">{r.checkPoint}</TD>
                    <TD cls="text-slate-500">{r.method || "—"}</TD>
                    <TD cls="text-slate-500">{r.specification || "—"}</TD>
                    <TD>
                      {r.category ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 capitalize">{r.category}</span>
                      ) : "—"}
                    </TD>
                    <TD center>
                      {r.required ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Required</span>
                      ) : <span className="text-slate-300">—</span>}
                    </TD>
                    <TD center cls="text-slate-500">{r.usageCount ?? 0}</TD>
                    <TD center><StatusBadge active={r.status} /></TD>
                    <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={9} message="No checkpoints in the library yet." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Checkpoint" : "Edit Checkpoint"} onClose={closeModal} onSave={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Check Point" required><input value={form.checkPoint} onChange={sf("checkPoint")} placeholder="e.g. Check Visual Defects" className={inputCls} /></Field>
            </div>
            <Field label="Method"><input value={form.method} onChange={sf("method")} placeholder="e.g. Visual" className={inputCls} /></Field>
            <Field label="Specification"><input value={form.specification} onChange={sf("specification")} placeholder="e.g. No scratches" className={inputCls} /></Field>
            <Field label="Category">
              <select value={form.category} onChange={sf("category")} className={selectCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c ? c.charAt(0).toUpperCase() + c.slice(1) : "Select Category"}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.required} onChange={sf("required")} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-slate-700 font-medium">Required</span>
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

export default CheckpointLibraryConfig;
