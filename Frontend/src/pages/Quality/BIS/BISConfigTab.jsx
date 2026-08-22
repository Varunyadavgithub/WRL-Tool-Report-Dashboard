import { useState, useMemo, useEffect, Fragment } from "react";
<<<<<<< HEAD
import { Search, RefreshCw, Plus, Pencil, Trash2, CalendarClock, Save, X, SlidersHorizontal } from "lucide-react";
import Pagination from "../../../components/ui/Pagination";
import { usePagedSlice, FieldLabel, inputCls, reportTypeLabel } from "./shared";
=======
import { Search, RefreshCw, Plus, Pencil, Trash2, CalendarClock, Save, X, SlidersHorizontal, UserCheck, Upload, PenTool } from "lucide-react";
import Pagination from "../../../components/ui/Pagination";
import { fileBaseURL } from "../../../assets/assets";
import { usePagedSlice, FieldLabel, inputCls, reportTypeLabel, SearchableSelect } from "./shared";

const APPROVAL_ROLES = [
  { role: "preparer", label: "Preparer", codeKey: "preparerUserCode", nameKey: "preparerUserName", sigKey: "preparerSignaturePath" },
  { role: "reviewer", label: "Reviewer", codeKey: "reviewerUserCode", nameKey: "reviewerUserName", sigKey: "reviewerSignaturePath" },
  { role: "authorizer", label: "Authorizer", codeKey: "authorizerUserCode", nameKey: "authorizerUserName", sigKey: "authorizerSignaturePath" },
];

// Who currently holds each of the 3 BIS report sign-off roles (Preparer →
// Reviewer → Authorizer), plus their signature image — used to route the
// Approvals queue and stamped onto reports as they move through it.
const BISApprovalFlowSettings = ({ approvalFlow, approvalFlowLoading, approvalUsers, onSaveApprovalFlow, onUploadSignature }) => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingRole, setUploadingRole] = useState(null);

  useEffect(() => {
    if (approvalFlow) {
      setForm({
        preparerUserCode: approvalFlow.preparerUserCode || "",
        reviewerUserCode: approvalFlow.reviewerUserCode || "",
        authorizerUserCode: approvalFlow.authorizerUserCode || "",
      });
    }
  }, [approvalFlow]);

  if (!form) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs text-slate-400">
        {approvalFlowLoading ? "Loading approval flow…" : "Approval flow unavailable."}
      </div>
    );
  }

  const userOptions = approvalUsers.map((u) => ({ value: u.UserCode, label: `${u.UserName} (${u.UserCode})` }));

  const handleSave = async () => {
    setSaving(true);
    await onSaveApprovalFlow(form);
    setSaving(false);
  };

  const handleFileChange = async (role, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingRole(role);
    await onUploadSignature(role, file);
    setUploadingRole(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-500" /> Approval Flow
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Who prepares, reviews and authorizes BIS test reports, and the signature image attached to each of their approvals.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {APPROVAL_ROLES.map(({ role, label, codeKey, sigKey }) => (
          <div key={role} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-700 mb-2">{label}</p>
            <FieldLabel>Assigned User</FieldLabel>
            <SearchableSelect
              placeholder="Search user…"
              value={form[codeKey]}
              onChange={(v) => setForm((p) => ({ ...p, [codeKey]: v }))}
              options={userOptions}
            />
            <div className="mt-3 flex items-center gap-2">
              {approvalFlow?.[sigKey] ? (
                <img src={fileBaseURL + approvalFlow[sigKey]} alt={`${label} signature`} className="h-10 w-20 object-contain border border-slate-200 rounded bg-white" />
              ) : (
                <div className="h-10 w-20 flex items-center justify-center border border-dashed border-slate-200 rounded bg-white text-slate-300">
                  <PenTool className="w-4 h-4" />
                </div>
              )}
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 cursor-pointer transition-all">
                <Upload className="w-3 h-3" /> {uploadingRole === role ? "Uploading…" : "Upload signature"}
                <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(e) => handleFileChange(role, e)} disabled={uploadingRole === role} />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61

const FREQUENCY_FIELDS = [
  { type: "Introduction", freqKey: "introductionFrequencyMonths", durKey: "introductionDurationDays", freqUnit: "months", durUnit: "days" },
  { type: "Sound", freqKey: "soundFrequencyMonths", durKey: "soundDurationDays", freqUnit: "months", durUnit: "days" },
  { type: "Volume", freqKey: "volumeFrequencyMonths", durKey: "volumeDurationDays", freqUnit: "months", durUnit: "days" },
];
const OVERRIDE_KEYS = FREQUENCY_FIELDS.flatMap(({ freqKey, durKey }) => [freqKey, durKey]);

// Inline schedule-override editor — expands under a model row so frequency/
// duration overrides can be edited without opening the full Add/Edit modal.
const InlineOverrideEditor = ({ row, onSave, onCancel }) => {
  const [draft, setDraft] = useState(() => Object.fromEntries(OVERRIDE_KEYS.map((k) => [k, row[k] ?? ""])));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <tr className="bg-indigo-50/40">
      <td colSpan={7} className="px-4 py-3 border-b border-indigo-100">
        <div className="flex flex-wrap items-end gap-3">
          {FREQUENCY_FIELDS.map(({ type, freqKey, durKey }) => (
            <div key={type} className="border border-slate-200 bg-white rounded-lg p-2.5 flex items-end gap-2">
              <p className="text-[11px] font-semibold text-slate-600 w-16 shrink-0">{reportTypeLabel(type)}</p>
              <div>
                <FieldLabel>Freq (mo)</FieldLabel>
                <input type="number" min={1} placeholder="Default" value={draft[freqKey]}
                  onChange={(e) => setDraft((p) => ({ ...p, [freqKey]: e.target.value }))} className={`${inputCls} w-20`} />
              </div>
              <div>
                <FieldLabel>Dur (days)</FieldLabel>
                <input type="number" min={1} placeholder="Default" value={draft[durKey]}
                  onChange={(e) => setDraft((p) => ({ ...p, [durKey]: e.target.value }))} className={`${inputCls} w-20`} />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onCancel} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Leave a field blank to fall back to the global default in Test Schedule Settings above.</p>
      </td>
    </tr>
  );
};

// Global BIS test-frequency defaults (Introduction/Sound/Volume cadence +
// typical test duration) — falls back for any model without a per-model
// override on BISConfigTab's model table below.
const BISTestFrequencySettings = ({ testConfig, testConfigLoading, onSaveTestConfig }) => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (testConfig) setForm(testConfig);
  }, [testConfig]);

  if (!form) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs text-slate-400">
        {testConfigLoading ? "Loading schedule settings…" : "Schedule settings unavailable."}
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await onSaveTestConfig(form);
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-500" /> Test Schedule Settings
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Default frequency and typical duration for each BIS report type. Individual models can override these on the model table below.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {FREQUENCY_FIELDS.map(({ type, freqKey, durKey }) => (
          <div key={type} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-700 mb-2">{reportTypeLabel(type)} Report</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Frequency (months)</FieldLabel>
                <input type="number" min={1} value={form[freqKey] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [freqKey]: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <FieldLabel>Duration (days)</FieldLabel>
                <input type="number" min={1} value={form[durKey] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [durKey]: e.target.value }))} className={inputCls} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// BISCategory management — which models are BIS-controlled (BIS / Non-BIS
// classification).
const BISConfigTab = ({
  categories, categorySearch, setCategorySearch, categoryLoading, onRefresh, onAddCategory, onEditCategory, onDeleteCategory,
  testConfig, testConfigLoading, onSaveTestConfig, onInlineUpdateOverrides,
<<<<<<< HEAD
=======
  approvalFlow, approvalFlowLoading, approvalUsers, onSaveApprovalFlow, onUploadApprovalSignature,
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
}) => {
  const [limit, setLimit] = useState(25);
  const [editingOverrideId, setEditingOverrideId] = useState(null);

  const filteredCategories = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter(
      (c) => c.materialCode?.toLowerCase().includes(term) || c.materialName?.toLowerCase().includes(term) || c.modelName?.toLowerCase().includes(term),
    );
  }, [categories, categorySearch]);

  const { page, setPage, totalPages, slice: pagedCategories } = usePagedSlice(filteredCategories, limit);

  return (
    <div className="flex flex-col gap-4">
<<<<<<< HEAD
=======
      <BISApprovalFlowSettings
        approvalFlow={approvalFlow}
        approvalFlowLoading={approvalFlowLoading}
        approvalUsers={approvalUsers}
        onSaveApprovalFlow={onSaveApprovalFlow}
        onUploadSignature={onUploadApprovalSignature}
      />
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
      <BISTestFrequencySettings testConfig={testConfig} testConfigLoading={testConfigLoading} onSaveTestConfig={onSaveTestConfig} />

      {/* Category management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800">BIS / Non-BIS Model Classification</h2>
            <p className="text-[11px] text-slate-400">
              Manage which models are BIS-controlled. New Type-100 models are auto-added as Non-BIS; edit them here to reclassify.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search material code / model" className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-64" />
            </div>
            <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={onAddCategory} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all">
              <Plus className="w-3.5 h-3.5" /> Add Model
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[200px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr>
                {["Material Code", "Material Name", "Model Name", "Category", "Schedule", "Updated", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedCategories.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-16 text-center text-slate-400">{categoryLoading ? "Loading…" : "No models found."}</td></tr>
              ) : (
                pagedCategories.map((row) => {
                  const hasOverride = ["introductionFrequencyMonths", "introductionDurationDays", "soundFrequencyMonths", "soundDurationDays", "volumeFrequencyMonths", "volumeDurationDays"]
                    .some((k) => row[k] !== null && row[k] !== undefined);
                  return (
                  <Fragment key={row.id}>
                  <tr className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
                    <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-600">{row.materialCode}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500">{row.materialName || "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800">{row.modelName}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.category === 1 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                        {row.category === 1 ? "BIS" : "Non-BIS"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      {row.category === 1 ? (
                        <button
                          onClick={() => setEditingOverrideId((id) => (id === row.id ? null : row.id))}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                            hasOverride ? "bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100" : "bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200"
                          }`}
                          title="Edit schedule override"
                        >
                          <SlidersHorizontal className="w-2.5 h-2.5" /> {hasOverride ? "Custom" : "Default"}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onEditCategory(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeleteCategory(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingOverrideId === row.id && (
                    <InlineOverrideEditor
                      row={row}
                      onCancel={() => setEditingOverrideId(null)}
                      onSave={async (draft) => {
                        try {
                          await onInlineUpdateOverrides(row, draft);
                          setEditingOverrideId(null);
                        } catch {
                          // Keep the editor open on failure — the toast already reported it.
                        }
                      }}
                    />
                  )}
                  </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <Pagination currentPage={page} totalPages={totalPages} totalRecords={filteredCategories.length} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
        </div>
      </div>
    </div>
  );
};

export default BISConfigTab;
