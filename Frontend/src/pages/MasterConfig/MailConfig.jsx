import { useState, useMemo } from "react";
import { Mail, Bell } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";

const DEPTS       = ["Production","Quality","Maintenance","Management","Store","HR","Logistics","Engineering"];
const FREQUENCIES = ["Hourly","Shift-wise","Daily","Weekly","Monthly"];
const REPORTS     = ["Shift Production Report","Hourly Production Report","OEE Report","Downtime Report","Quality Report","Plan vs Actual Report","Machine Utilization Report","Rejection Report","Daily Management Report (DMR)"];

const INIT = { empName:"", empId:"", department:"Production", designation:"", email:"", mobile:"", subscriptions:[], frequency:"Shift-wise", whatsapp:false, sms:false, status:true };

const MailConfig = () => {
  const [data, setData]   = useState([]);
  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");
  const [tab, setTab]     = useState("subscribers");

  const filtered = useMemo(() =>
    data.filter((r) =>
      r.empName.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase())
    ), [data, search]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = () => {
    if (!form.empName || !form.email) { toast.error("Name and Email are required."); return; }
    if (modal.mode === "add") {
      setData([...data, { ...form, id: Date.now() }]);
      toast.success("Subscriber added.");
    } else {
      setData(data.map((r) => r.id === modal.row.id ? { ...form, id: r.id } : r));
      toast.success("Subscriber updated.");
    }
    closeModal();
  };

  const handleDelete = (id) => { setData(data.filter((r) => r.id !== id)); toast.success("Deleted."); };
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const toggleReport = (rep) =>
    setForm((f) => ({
      ...f,
      subscriptions: f.subscriptions.includes(rep) ? f.subscriptions.filter((r) => r !== rep) : [...f.subscriptions, rep],
    }));

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Mail & Notification Configuration" subtitle="Manage email subscribers, report subscriptions and notification preferences" icon={Mail} onAdd={openAdd} addLabel="Add Subscriber" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1 w-fit mb-3">
          {[["subscribers","Subscribers"],["reports","Report Matrix"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === k ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label}</button>
          ))}
        </div>

        {tab === "subscribers" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50">
                    <TH>#</TH><TH>Name</TH><TH>Emp ID</TH><TH>Department</TH>
                    <TH>Designation</TH><TH>Email</TH><TH>Mobile</TH>
                    <TH>Subscriptions</TH><TH center>Frequency</TH>
                    <TH center>WA</TH><TH center>SMS</TH><TH center>Status</TH><TH center>Actions</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length > 0 ? filtered.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                      <TD cls="text-slate-400">{idx + 1}</TD>
                      <TD cls="font-bold text-slate-800 whitespace-nowrap">{r.empName}</TD>
                      <TD mono cls="text-slate-500">{r.empId}</TD>
                      <TD><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.department}</span></TD>
                      <TD cls="text-slate-500 text-[11px]">{r.designation}</TD>
                      <TD cls="text-blue-600 text-[11px]">{r.email}</TD>
                      <TD mono cls="text-slate-500">{r.mobile}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {r.subscriptions.slice(0, 2).map((s) => (
                            <span key={s} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{s.split(" ").slice(0,2).join(" ")}</span>
                          ))}
                          {r.subscriptions.length > 2 && <span className="text-[9px] text-slate-400">+{r.subscriptions.length - 2} more</span>}
                        </div>
                      </TD>
                      <TD center><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{r.frequency}</span></TD>
                      <TD center>{r.whatsapp ? <span className="text-emerald-600 text-xs font-bold">✓</span> : <span className="text-slate-300">—</span>}</TD>
                      <TD center>{r.sms ? <span className="text-emerald-600 text-xs font-bold">✓</span> : <span className="text-slate-300">—</span>}</TD>
                      <TD center><StatusBadge active={r.status} /></TD>
                      <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                    </tr>
                  )) : <EmptyState colSpan={13} message="No subscribers configured." />}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50">
                    <TH>Report Name</TH>
                    {data.filter((r) => r.status).map((r) => <TH key={r.id} center>{r.empName.split(" ")[0]}</TH>)}
                  </tr>
                </thead>
                <tbody>
                  {REPORTS.map((rep) => (
                    <tr key={rep} className="hover:bg-blue-50/40 even:bg-slate-50/30">
                      <TD cls="font-medium text-slate-700 whitespace-nowrap">{rep}</TD>
                      {data.filter((r) => r.status).map((r) => (
                        <TD key={r.id} center>
                          {r.subscriptions.includes(rep)
                            ? <span className="text-emerald-600 font-bold">✓</span>
                            : <span className="text-slate-200">—</span>}
                        </TD>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Subscriber" : "Edit Subscriber"} onClose={closeModal} onSave={handleSave} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Employee Name" required><input value={form.empName} onChange={sf("empName")} placeholder="Full name" className={inputCls} /></Field>
            <Field label="Employee ID"><input value={form.empId} onChange={sf("empId")} placeholder="e.g. EMP001" className={inputCls} /></Field>
            <Field label="Department">
              <select value={form.department} onChange={sf("department")} className={selectCls}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select>
            </Field>
            <Field label="Designation"><input value={form.designation} onChange={sf("designation")} placeholder="e.g. Production Manager" className={inputCls} /></Field>
            <Field label="Email ID" required><input type="email" value={form.email} onChange={sf("email")} placeholder="email@company.com" className={inputCls} /></Field>
            <Field label="Mobile Number"><input value={form.mobile} onChange={sf("mobile")} placeholder="10-digit number" className={inputCls} /></Field>
            <Field label="Notification Frequency">
              <select value={form.frequency} onChange={sf("frequency")} className={selectCls}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select>
            </Field>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Report Subscriptions</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1">
                {REPORTS.map((rep) => (
                  <label key={rep} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                    <input type="checkbox" checked={form.subscriptions.includes(rep)} onChange={() => toggleReport(rep)} className="w-3.5 h-3.5 accent-blue-600" />
                    <span className="text-xs text-slate-700">{rep}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex gap-6 p-3 rounded-lg bg-slate-50 border border-slate-200">
              {[["whatsapp","WhatsApp Notifications"],["sms","SMS Notifications"],["status","Active"]].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form[k]} onChange={sf(k)} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-slate-700 font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MailConfig;
