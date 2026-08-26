import { useState, useMemo } from "react";
import { Droplets, Send } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "../MasterConfig/_shared";
import {
  useGetChemBulkStorageRecipientsQuery,
  useAddChemBulkStorageRecipientMutation,
  useUpdateChemBulkStorageRecipientMutation,
  useDeleteChemBulkStorageRecipientMutation,
  useTestChemBulkStorageRecipientMutation,
  useSendChemBulkStorageReportNowMutation,
} from "../../redux/api/chemicalApi";

const INIT = { name: "", email: "", status: true };

const ChemBulkStorageMailConfig = () => {
  const { data } = useGetChemBulkStorageRecipientsQuery();

  const [addRecipient]    = useAddChemBulkStorageRecipientMutation();
  const [updateRecipient] = useUpdateChemBulkStorageRecipientMutation();
  const [deleteRecipient] = useDeleteChemBulkStorageRecipientMutation();
  const [testRecipient, { isLoading: testing }] = useTestChemBulkStorageRecipientMutation();
  const [sendNow, { isLoading: sendingNow }] = useSendChemBulkStorageReportNowMutation();
  const [testingId, setTestingId] = useState(null);

  const [modal, setModal] = useState({ open: false, mode: "add", row: null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");

  const recipients = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() =>
    recipients.filter((r) =>
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())
    ), [recipients, search]);

  const openAdd  = () => { setForm(INIT); setModal({ open: true, mode: "add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open: true, mode: "edit", row }); };
  const closeModal = () => setModal({ open: false });

  const handleSave = async () => {
    if (!form.email) { toast.error("Email is required."); return; }
    try {
      if (modal.mode === "add") {
        await addRecipient(form).unwrap();
        toast.success("Recipient added.");
      } else {
        await updateRecipient({ ...form, id: modal.row.id }).unwrap();
        toast.success("Recipient updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save recipient.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRecipient(id).unwrap();
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete.");
    }
  };

  const handleTest = async (row) => {
    setTestingId(row.id);
    try {
      const res = await testRecipient(row.id).unwrap();
      toast.success(res?.message || `Test email sent to ${row.email}`, { duration: 6000 });
    } catch (err) {
      toast.error(err?.data?.message || "Failed to send test email.");
    } finally {
      setTestingId(null);
    }
  };

  const handleSendNow = async () => {
    try {
      const res = await sendNow().unwrap();
      toast.success(res?.message || "Report sent.", { duration: 6000 });
    } catch (err) {
      toast.error(err?.data?.message || "Failed to send report.");
    }
  };

  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader
        title="Chemical Bulk Storage Mail Config"
        subtitle="Manage who receives the daily ISO/POLY tank consumption report"
        icon={Droplets}
        onAdd={openAdd}
        addLabel="Add Recipient"
        search={search}
        onSearch={setSearch}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="flex justify-end mb-3">
          <button
            onClick={handleSendNow}
            disabled={sendingNow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> {sendingNow ? "Sending…" : "Send Report Now"}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Name</TH><TH>Email</TH><TH center>Status</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD cls="font-bold text-slate-800 whitespace-nowrap">{r.name || "—"}</TD>
                    <TD cls="text-blue-600 text-[11px]">{r.email}</TD>
                    <TD center><StatusBadge active={r.status} /></TD>
                    <TD center>
                      <TableActions
                        onEdit={() => openEdit(r)}
                        onDelete={() => handleDelete(r.id)}
                        onTest={() => handleTest(r)}
                        testing={testing && testingId === r.id}
                      />
                    </TD>
                  </tr>
                )) : <EmptyState colSpan={5} message="No recipients configured." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Recipient" : "Edit Recipient"} onClose={closeModal} onSave={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name"><input value={form.name} onChange={sf("name")} placeholder="Full name" className={inputCls} /></Field>
            <Field label="Email ID" required><input type="email" value={form.email} onChange={sf("email")} placeholder="email@company.com" className={inputCls} /></Field>
            <div className="col-span-2 flex gap-6 p-3 rounded-lg bg-slate-50 border border-slate-200">
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

export default ChemBulkStorageMailConfig;
