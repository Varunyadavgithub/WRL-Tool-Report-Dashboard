import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Plus, Search, RefreshCw, Eye, Pencil, History, Trash2, FileStack,
  Thermometer, Volume2, Box, ArrowLeft, AlertTriangle, CalendarClock, PenLine,
} from "lucide-react";
import { baseURL } from "../../../assets/assets";
import PopupModal from "../../../components/ui/PopupModal";
import Pagination from "../../../components/ui/Pagination";
import { BIS_REPORT_TYPES, usePagedSlice, MultiSelectDropdown, mapEquipmentToFormState, reportTypeLabel } from "./shared";
import BISIntroductionReportForm from "./BISIntroductionReportForm";
import BISSoundReportForm from "./BISSoundReportForm";
import BISVolumeReportForm from "./BISVolumeReportForm";
import BISReportDetailView from "./BISReportDetailView";

const TYPE_ICON = { Introduction: Thermometer, Sound: Volume2, Volume: Box };
const STATUS_STYLE = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
<<<<<<< HEAD
  Final: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Superseded: "bg-amber-50 text-amber-700 border-amber-100",
};
=======
  PendingReview: "bg-blue-50 text-blue-700 border-blue-100",
  PendingApproval: "bg-violet-50 text-violet-700 border-violet-100",
  Final: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Superseded: "bg-amber-50 text-amber-700 border-amber-100",
};
const EDITABLE_STATUSES = ["Draft", "Final"]; // Pending* is locked to the approval actions
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
const FORM_BY_TYPE = { Introduction: BISIntroductionReportForm, Sound: BISSoundReportForm, Volume: BISVolumeReportForm };

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const BISTestReportsTab = () => {
  const [mode, setMode] = useState("list"); // list | pick-type | create | edit | view
  const [newReportType, setNewReportType] = useState(null);
  const [createPrefill, setCreatePrefill] = useState(null);

  const [reports, setReports] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [modelSearch, setModelSearch] = useState("");
  const [limit, setLimit] = useState(25);

  const [models, setModels] = useState([]);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copyingEquipment, setCopyingEquipment] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-test-reports`);
      setReports(res?.data?.reports || []);
    } catch {
      toast.error("Failed to fetch BIS test reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-category`);
      const bisModels = (res?.data?.categories || []).filter((c) => c.category === 1);
      const seen = new Set();
      setModels(bisModels.filter((m) => (seen.has(m.modelName) ? false : (seen.add(m.modelName), true))).map((m) => ({ modelName: m.modelName, materialCode: m.materialCode })));
    } catch {
      toast.error("Failed to fetch BIS models");
    }
  };

  const fetchSchedule = async () => {
    try {
      setScheduleLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-test-schedule`);
      setSchedule(res?.data?.schedule || []);
    } catch {
      toast.error("Failed to fetch BIS test schedule");
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => { fetchReports(); fetchModels(); fetchSchedule(); }, []);

  // "Pending" = already overdue. "Due this month" = next-due date falls in
  // the current calendar month but hasn't lapsed yet — the two lists this
  // tab needs to answer "what report do I need to make right now".
  const now = new Date();
  const isCurrentMonth = (d) => {
    if (!d) return false;
    const dt = new Date(d);
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  };
  const pendingItems = useMemo(
    () => schedule.filter((i) => i.status === "Overdue").sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0)),
    [schedule],
  );
  const currentMonthItems = useMemo(
    () => schedule.filter((i) => i.status !== "Overdue" && isCurrentMonth(i.nextDueDate)).sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule],
  );

  const filtered = useMemo(() => {
    const term = modelSearch.trim().toLowerCase();
    return reports.filter((r) => {
      if (typeFilter.length > 0 && !typeFilter.includes(r.ReportType)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(r.Status)) return false;
      if (term && !r.ModelName?.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [reports, typeFilter, statusFilter, modelSearch]);

  const { page, setPage, totalPages, slice: pagedReports } = usePagedSlice(filtered, limit);

  const openCreate = (reportType, prefill = null) => {
    setNewReportType(reportType);
    setCreatePrefill(prefill);
    setDetail(null);
    setMode("create");
  };

  const openEdit = async (row) => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-test-reports/${row.Id}`);
      setDetail(res.data);
      setNewReportType(row.ReportType);
      setMode("edit");
    } catch {
      toast.error("Failed to load report");
    }
  };

  const openView = async (row) => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-test-reports/${row.Id}`);
      setDetail(res.data);
      setHistory(null);
      setMode("view");
    } catch {
      toast.error("Failed to load report");
    }
  };

  const openHistory = async (row) => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-test-reports/${row.Id}/history`);
      if (res.data.history.length <= 1) {
        toast("This report has no earlier versions.", { icon: "ℹ️" });
        return;
      }
      await openView(row);
      setHistory(res.data.history);
    } catch {
      toast.error("Failed to load report history");
    }
  };

  const backToList = () => {
    setMode("list");
    setDetail(null);
    setHistory(null);
    setNewReportType(null);
    setCreatePrefill(null);
    fetchReports();
    fetchSchedule();
  };

<<<<<<< HEAD
  const handleCreate = async (payload, status) => {
    try {
      setSaving(true);
      await axios.post(`${baseURL}quality/bis-test-reports`, { ...payload, status });
      toast.success(status === "Final" ? "Report submitted" : "Draft saved");
=======
  // The form always saves as a Draft; "Submit for Review" (status === "Final"
  // from the form's own button, kept as that signal) chains a second call
  // that hands the just-saved Draft to the approval flow's Preparer step.
  const submitForReview = async (id) => {
    try {
      await axios.post(`${baseURL}quality/bis-test-reports/${id}/submit-for-review`);
      toast.success("Report submitted for review");
    } catch (err) {
      toast.error(err.response?.data?.message || "Saved as Draft, but submitting for review failed");
    }
  };

  const handleCreate = async (payload, status) => {
    try {
      setSaving(true);
      const res = await axios.post(`${baseURL}quality/bis-test-reports`, payload);
      if (status === "Final") await submitForReview(res.data.id);
      else toast.success("Draft saved");
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
      backToList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (payload, status) => {
    try {
      setSaving(true);
<<<<<<< HEAD
      await axios.put(`${baseURL}quality/bis-test-reports/${detail.header.Id}`, { ...payload, status });
      toast.success(status === "Final" ? "Report submitted" : "Draft saved");
=======
      await axios.put(`${baseURL}quality/bis-test-reports/${detail.header.Id}`, payload);
      if (status === "Final") await submitForReview(detail.header.Id);
      else toast.success("Draft saved");
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
      backToList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update report");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEquipment = async (reportType) => async () => {
    try {
      setCopyingEquipment(true);
      const listRes = await axios.get(`${baseURL}quality/bis-test-reports`, { params: { reportType } });
      const last = (listRes?.data?.reports || [])[0];
      if (!last) {
        toast("No previous report of this type to copy from.", { icon: "ℹ️" });
        return null;
      }
      const detailRes = await axios.get(`${baseURL}quality/bis-test-reports/${last.Id}`);
      const eq = mapEquipmentToFormState(detailRes.data.equipment);
      if (eq.length === 0) toast("That report had no equipment recorded.", { icon: "ℹ️" });
      else toast.success(`Copied ${eq.length} instrument(s) from ${last.ModelName}`);
      return eq;
    } catch {
      toast.error("Failed to copy equipment");
      return null;
    } finally {
      setCopyingEquipment(false);
    }
  };

  const askDelete = (row) => { setReportToDelete(row); setShowDeleteModal(true); };
  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await axios.delete(`${baseURL}quality/bis-test-reports/${reportToDelete.Id}`);
      toast.success("Draft deleted");
      setShowDeleteModal(false);
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete draft");
    } finally {
      setDeleting(false);
    }
  };

  // ── Create / Edit form ──────────────────────────────────────────────────
  if (mode === "create" || mode === "edit") {
    const FormComponent = FORM_BY_TYPE[newReportType];
    return (
      <div className="flex flex-col gap-3">
        <button onClick={backToList} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-all w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Test Reports
        </button>
        <FormComponent
          initialData={mode === "edit" ? detail : null}
          prefillHeader={mode === "create" ? createPrefill : null}
          models={models}
          onSave={mode === "edit" ? handleUpdate : handleCreate}
          onCancel={backToList}
          saving={saving}
          onCopyEquipment={async () => {
            const eq = await handleCopyEquipment(newReportType)();
            return eq;
          }}
          copyingEquipment={copyingEquipment}
        />
      </div>
    );
  }

  // ── View / print ─────────────────────────────────────────────────────────
  if (mode === "view" && detail) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={backToList} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-all w-fit print:hidden">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Test Reports
        </button>
        {history && (
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Version History</span>
            {history.map((v) => (
              <button
                key={v.Id}
                onClick={async () => { const res = await axios.get(`${baseURL}quality/bis-test-reports/${v.Id}`); setDetail(res.data); }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                  v.Id === detail.header.Id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                }`}
              >
                v{v.Version} · {v.Status} · {fmtDate(v.UpdatedAt)}
              </button>
            ))}
          </div>
        )}
        <BISReportDetailView data={detail} onClose={backToList} />
      </div>
    );
  }

  // ── List ─────────────────────────────────────────────────────────────────
  const DueList = ({ title, icon: DueIcon, accent, items, emptyText }) => (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center gap-2 mb-2">
        <DueIcon className="w-3.5 h-3.5" style={{ color: accent }} />
        <p className="text-xs font-bold text-slate-700">{title}</p>
        <span className="text-[10px] text-slate-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-56 overflow-auto pr-1">
          {items.map((it) => (
            <div key={`${it.modelName}|${it.reportType}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{it.modelName}</p>
                <p className="text-[10px] text-slate-400">{reportTypeLabel(it.reportType)} · Due {fmtDate(it.nextDueDate)}</p>
              </div>
              <button
                onClick={() => openCreate(it.reportType, { modelName: it.modelName, materialCode: it.materialCode })}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
              >
                <PenLine className="w-3 h-3" /> Create
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Reports Due</h2>
          {scheduleLoading && <span className="text-[10px] text-slate-400">Loading…</span>}
        </div>
        <div className="flex flex-wrap gap-6">
          <DueList title="Pending (Overdue)" icon={AlertTriangle} accent="#ef4444" items={pendingItems} emptyText="Nothing overdue." />
          <DueList title="Due This Month" icon={CalendarClock} accent="#f59e0b" items={currentMonthItems} emptyText="Nothing else due this month." />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
        <MultiSelectDropdown label="Report Type" options={BIS_REPORT_TYPES} selected={typeFilter} onChange={setTypeFilter} labelFor={reportTypeLabel} />
<<<<<<< HEAD
        <MultiSelectDropdown label="Status" options={["Draft", "Final", "Superseded"]} selected={statusFilter} onChange={setStatusFilter} />
=======
        <MultiSelectDropdown label="Status" options={["Draft", "PendingReview", "PendingApproval", "Final", "Superseded"]} selected={statusFilter} onChange={setStatusFilter} />
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Model</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={modelSearch} onChange={(e) => setModelSearch(e.target.value)}
              placeholder="Search model…" className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-52" />
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={fetchReports} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all">
            <Plus className="w-3.5 h-3.5" /> New Report
          </button>
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
            {BIS_REPORT_TYPES.map((t) => {
              const Icon = TYPE_ICON[t];
              return (
                <button key={t} onClick={() => openCreate(t)} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                  <Icon className="w-3.5 h-3.5" /> {reportTypeLabel(t)} Report
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-360px)] min-h-[200px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr>
                {["Type", "Model", "Test Report No.", "Test Date", "Tested By", "Result", "Status", "Version", "Updated", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedReports.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-16 text-center text-slate-400">
                  {loading ? "Loading…" : (
                    <div className="flex flex-col items-center gap-2">
                      <FileStack className="w-10 h-10 opacity-20" strokeWidth={1.2} />
                      <p>No reports yet. Click "New Report" to create one.</p>
                    </div>
                  )}
                </td></tr>
              ) : (
                pagedReports.map((row) => {
                  const Icon = TYPE_ICON[row.ReportType];
                  return (
                    <tr key={row.Id} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium"><Icon className="w-3.5 h-3.5 text-slate-400" /> {reportTypeLabel(row.ReportType)}</span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800">{row.ModelName}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 font-mono">{row.TestReportNo || "—"}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 font-mono">{fmtDate(row.TestDateTo)}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500">{row.TestedBy || "—"}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        {row.Result && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.Result === "PASS" ? "bg-emerald-100 text-emerald-700" : row.Result === "FAIL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{row.Result}</span>}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[row.Status] || STATUS_STYLE.Draft}`}>{row.Status}</span>
<<<<<<< HEAD
=======
                        {row.Status === "Draft" && row.WorkflowRemarks && (
                          <p className="text-[10px] text-red-500 mt-0.5 max-w-[160px] truncate" title={row.WorkflowRemarks}>Rejected: {row.WorkflowRemarks}</p>
                        )}
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 font-mono">v{row.Version}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400">{fmtDate(row.UpdatedAt)}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openView(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="View"><Eye className="w-3.5 h-3.5" /></button>
<<<<<<< HEAD
                          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
=======
                          {EDITABLE_STATUSES.includes(row.Status) && (
                            <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          )}
>>>>>>> 03ac1332bb57d4fc6436f1650f76f21cda4f0d61
                          <button onClick={() => openHistory(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-all" title="History"><History className="w-3.5 h-3.5" /></button>
                          {row.Status === "Draft" && (
                            <button onClick={() => askDelete(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete Draft"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <Pagination currentPage={page} totalPages={totalPages} totalRecords={filtered.length} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
        </div>
      </div>

      {showDeleteModal && (
        <PopupModal
          title="Delete Draft Report"
          description={`Delete the draft ${reportTypeLabel(reportToDelete?.ReportType)} report for "${reportToDelete?.ModelName}"? This cannot be undone.`}
          confirmText={deleting ? "Deleting…" : "Yes, Delete"}
          cancelText="Cancel"
          modalId="delete-report-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={<Trash2 className="w-10 h-10 text-red-500 mx-auto" />}
          confirmButtonColor="bg-red-600 hover:bg-red-700"
        />
      )}
    </div>
  );
};

export default BISTestReportsTab;
