import { useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";
import { selectQualityDefects, selectQualityPassword, setQualityPassword } from "../../redux/slices/masterConfigSlice";
import { useAddQualityDefectMutation, useUpdateQualityDefectMutation, useDeleteQualityDefectMutation } from "../../redux/api/masterConfigApi";

const DEF_CATS = ["Dimensional","Surface Finish","Assembly","Material","Process","Cosmetic","Functional","Documentation"];
const SEVERITIES = ["Critical","Major","Minor","Observation"];
const STAGES = ["Incoming","In-Process","Final Inspection","Customer End","Outgoing"];
const TYPES = ["Rework","Rejection","Hold","Observation"];

const INIT = { qCode:"", defectName:"", category:"Dimensional", type:"Rework", severity:"Minor", stage:"In-Process", rootCause:"", capaRequired:false, status:true };

const SeverityBadge = ({ s }) => {
  const c = { Critical:"bg-rose-100 text-rose-700 border-rose-300", Major:"bg-orange-50 text-orange-700 border-orange-200", Minor:"bg-amber-50 text-amber-700 border-amber-200", Observation:"bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c[s] || c.Observation}`}>{s}</span>;
};

const TypeBadge = ({ t }) => {
  const c = { Rework:"bg-blue-50 text-blue-700 border-blue-200", Rejection:"bg-rose-50 text-rose-700 border-rose-200", Hold:"bg-amber-50 text-amber-700 border-amber-200", Observation:"bg-slate-100 text-slate-500 border-slate-200" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c[t] || c.Observation}`}>{t}</span>;
};

const QualityConfig = () => {
  const dispatch = useDispatch();
  const data     = useSelector(selectQualityDefects);
  const savedPwd = useSelector(selectQualityPassword);
  const [addQualityDefect]    = useAddQualityDefectMutation();
  const [updateQualityDefect] = useUpdateQualityDefectMutation();
  const [deleteQualityDefect] = useDeleteQualityDefectMutation();
  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");
  const [pwdInput, setPwdInput]   = useState(savedPwd);
  const [showPwd,  setShowPwd]    = useState(false);

  const handleSavePwd = () => {
    dispatch(setQualityPassword(pwdInput.trim()));
    toast.success(pwdInput.trim() ? "Log Quality password saved." : "Password cleared — no password required.");
  };

  const filtered = useMemo(() => data.filter((r) => r.qCode.toLowerCase().includes(search.toLowerCase()) || r.defectName.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = async () => {
    if (!form.qCode || !form.defectName) { toast.error("Code and Defect Name are required."); return; }
    try {
      if (modal.mode === "add") {
        if (data.find((r) => r.qCode === form.qCode)) { toast.error("Quality Code already exists."); return; }
        await addQualityDefect(form).unwrap();
        toast.success("Defect code added.");
      } else {
        await updateQualityDefect({ ...form, id: modal.row.id }).unwrap();
        toast.success("Defect code updated.");
      }
      closeModal();
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save defect code.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteQualityDefect(id).unwrap();
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to delete.");
    }
  };
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Quality Configuration" subtitle="Manage defect codes, severity levels, CAPA requirements and inspection stages" icon={ShieldCheck} onAdd={openAdd} addLabel="Add Defect Code" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {/* ── Log Quality Password ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-slate-700">Log Quality Password</span>
            {savedPwd ? (
              <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">Protected</span>
            ) : (
              <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">No Password</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">When set, operators must enter this password before logging a quality entry from the Dashboard. Leave blank to allow unrestricted access.</p>
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <input
                type={showPwd ? "text" : "password"}
                value={pwdInput}
                onChange={(e) => setPwdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePwd()}
                placeholder="Enter password (leave blank for no restriction)"
                className={`${inputCls} pr-9`}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={handleSavePwd}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white whitespace-nowrap">
              Save Password
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Code</TH><TH>Defect Name</TH><TH>Category</TH>
                  <TH center>Type</TH><TH center>Severity</TH><TH>Inspection Stage</TH>
                  <TH>Root Cause</TH><TH center>CAPA</TH><TH center>Status</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD><span className="font-mono font-bold text-violet-600 text-xs">{r.qCode}</span></TD>
                    <TD cls="font-medium text-slate-700 whitespace-nowrap">{r.defectName}</TD>
                    <TD><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.category}</span></TD>
                    <TD center><TypeBadge t={r.type} /></TD>
                    <TD center><SeverityBadge s={r.severity} /></TD>
                    <TD cls="text-slate-500 text-[11px]">{r.stage}</TD>
                    <TD cls="text-slate-500 text-[11px]">{r.rootCause || <span className="text-slate-300">—</span>}</TD>
                    <TD center>{r.capaRequired ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Required</span> : <span className="text-slate-300 text-xs">—</span>}</TD>
                    <TD center><StatusBadge active={r.status} /></TD>
                    <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={11} message="No quality defect codes configured." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Defect Code" : "Edit Defect Code"} onClose={closeModal} onSave={handleSave}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quality Code" required><input value={form.qCode} onChange={sf("qCode")} placeholder="e.g. QD001" className={inputCls} /></Field>
            <Field label="Defect Name" required><input value={form.defectName} onChange={sf("defectName")} placeholder="e.g. Dimensional Variation" className={inputCls} /></Field>
            <Field label="Defect Category">
              <select value={form.category} onChange={sf("category")} className={selectCls}>
                {DEF_CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Defect Type">
              <select value={form.type} onChange={sf("type")} className={selectCls}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Severity Level">
              <select value={form.severity} onChange={sf("severity")} className={selectCls}>
                {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Inspection Stage">
              <select value={form.stage} onChange={sf("stage")} className={selectCls}>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Root Cause"><input value={form.rootCause} onChange={sf("rootCause")} placeholder="e.g. Tool Wear, Wrong Parameters" className={inputCls} /></Field>
            </div>
            <div className="col-span-2 flex gap-6 p-3 rounded-lg bg-slate-50 border border-slate-200">
              {[["capaRequired","CAPA Required"],["status","Active"]].map(([k, label]) => (
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

export default QualityConfig;
