import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEdit,
  FaSync,
  FaSearch,
  FaFilter,
  FaClipboardList,
  FaClock,
  FaUserCheck,
  FaExclamationTriangle,
  FaFileAlt,
  FaLayerGroup,
  FaThLarge,
  FaList,
  FaHistory,
  FaTimes,
  FaCheckDouble,
  FaChevronRight,
  FaTag,
  FaColumns,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { MdOutlineFactCheck } from "react-icons/md";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ROLES } from "../../../config/routes.config";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  draft:            { label: "Draft",           cls: "bg-gray-100 text-gray-700 border-gray-300" },
  pending_approval: { label: "Pending Approval", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  approved:         { label: "Approved",         cls: "bg-green-100 text-green-700 border-green-300" },
  rejected:         { label: "Rejected",         cls: "bg-red-100 text-red-700 border-red-300" },
};

const ACTION_CFG = {
  created:               { label: "Created",               color: "text-indigo-600", dot: "bg-indigo-400", type: "new"  },
  updated:               { label: "Updated",               color: "text-blue-600",   dot: "bg-blue-400",   type: "edit" },
  submitted_for_approval:{ label: "Submitted for Approval",color: "text-amber-600",  dot: "bg-amber-400",  type: "edit" },
  status_changed:        { label: "Status Changed",        color: "text-violet-600", dot: "bg-violet-400", type: "edit" },
  approved:              { label: "Approved",              color: "text-green-600",  dot: "bg-green-500",  type: "edit" },
  rejected:              { label: "Rejected",              color: "text-red-600",    dot: "bg-red-500",    type: "edit" },
  deleted:               { label: "Deleted",               color: "text-gray-500",   dot: "bg-gray-400",   type: "edit" },
};

const TypeBadge = ({ type }) =>
  type === "new" ? (
    <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
      New Template
    </span>
  ) : (
    <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide">
      Template Edit
    </span>
  );

const relativeTime = (d) => {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};

const getTotalCheckpoints = (template) => {
  if (!template?.defaultSections) return 0;
  let n = 0;
  template.defaultSections.forEach((s) => {
    if (s.stages) s.stages.forEach((st) => { n += st.checkPoints?.length || 0; });
    else n += s.checkPoints?.length || 0;
  });
  return n;
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_LABELS[status] || { label: "Not Set", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const TemplateApproval = () => {
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);
  const { templates, loadTemplates, updateTemplate, getTemplateHistory } = useAuditData();

  const canApprove = [ROLES.SUPER_ADMIN, ROLES.QUALITY_MANAGER].includes(user?.roleName);
  const isAdmin    = user?.roleName === ROLES.SUPER_ADMIN;

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode]     = useState("list");

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [rejectReason, setRejectReason]         = useState("");
  const [rejecting, setRejecting]               = useState(false);

  // History — inline row expansion
  const [expandedHistoryId, setExpandedHistoryId]   = useState(null);     // which template row is open
  const [historyCache, setHistoryCache]             = useState({});        // id → history[]
  const [historyLoadingId, setHistoryLoadingId]     = useState(null);
  const [expandedChanges, setExpandedChanges]       = useState(new Set()); // "entryId_fi" keys

  const toggleChange = (key) =>
    setExpandedChanges((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });

  // ── Visibility ───────────────────────────────────────────────────────────

  const visibleTemplates = useMemo(() => {
    const myId = user?.name || user?.usercode;
    return templates.filter((t) => {
      if (t.approvalStatus === "draft") return isAdmin || (myId && t.createdBy === myId);
      return true;
    });
  }, [templates, isAdmin, user]);

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await loadTemplates(); }
      catch (err) { toast.error("Failed to load templates: " + err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await loadTemplates(); toast.success("Refreshed"); }
    catch { toast.error("Refresh failed"); }
    finally { setRefreshing(false); }
  };

  // ── History panel ────────────────────────────────────────────────────────

  const openHistory = async (template) => {
    // Toggle off if already open
    if (expandedHistoryId === template.id) { setExpandedHistoryId(null); return; }

    setExpandedHistoryId(template.id);

    // Use cache if available
    if (historyCache[template.id]) return;

    setHistoryLoadingId(template.id);
    try {
      const data = await getTemplateHistory(template.id);
      setHistoryCache((prev) => ({ ...prev, [template.id]: data }));
    } catch (err) {
      toast.error("Failed to load history: " + err.message);
    } finally {
      setHistoryLoadingId(null);
    }
  };

  // ── Approve / Reject ─────────────────────────────────────────────────────

  const handleApprove = async (template) => {
    try {
      await updateTemplate(template.id, {
        approvalStatus: "approved",
        approvedBy: user?.name || user?.usercode || user?.roleName,
        approvedAt: new Date().toISOString(),
      });
      toast.success(`"${template.name}" approved`);
      await loadTemplates();
      if (expandedHistoryId === template.id) { setHistoryCache((p) => { const n={...p}; delete n[template.id]; return n; }); openHistory(template); }
    } catch (err) { toast.error("Approval failed: " + err.message); }
  };

  const handleRejectClick = (template) => {
    setSelectedTemplate(template);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedTemplate || !rejectReason.trim()) { toast.error("Please provide a rejection reason"); return; }
    setRejecting(true);
    try {
      await updateTemplate(selectedTemplate.id, {
        approvalStatus: "rejected",
        rejectionReason: rejectReason.trim(),
      });
      toast.success(`"${selectedTemplate.name}" rejected`);
      setShowRejectModal(false);
      setSelectedTemplate(null);
      await loadTemplates();
      if (expandedHistoryId === selectedTemplate.id) { setHistoryCache((p) => { const n={...p}; delete n[selectedTemplate.id]; return n; }); openHistory(selectedTemplate); }
    } catch (err) { toast.error("Rejection failed: " + err.message); }
    finally { setRejecting(false); }
  };

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = visibleTemplates;
    if (filterStatus === "pending") list = list.filter((t) => t.approvalStatus === "pending_approval" || !t.approvalStatus);
    else if (filterStatus !== "all") list = list.filter((t) => t.approvalStatus === filterStatus);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((t) => t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q));
    }
    return list;
  }, [visibleTemplates, filterStatus, searchTerm]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    all:      visibleTemplates.length,
    pending:  visibleTemplates.filter((t) => t.approvalStatus === "pending_approval" || !t.approvalStatus).length,
    approved: visibleTemplates.filter((t) => t.approvalStatus === "approved").length,
    rejected: visibleTemplates.filter((t) => t.approvalStatus === "rejected").length,
    draft:    visibleTemplates.filter((t) => t.approvalStatus === "draft").length,
  }), [visibleTemplates]);

  if (!canApprove) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <FaExclamationTriangle className="text-5xl text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 text-sm">Only Quality Managers and Super Admins can access this page.</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <HiClipboardDocumentCheck className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900 leading-none">Template Approval</h1>
              <p className="text-[10px] text-gray-400 mt-0.5">Review, approve and track template changes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all text-xs ${viewMode === "list" ? "bg-white shadow text-indigo-600" : "text-gray-400"}`}><FaList size={12} /></button>
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all text-xs ${viewMode === "grid" ? "bg-white shadow text-indigo-600" : "text-gray-400"}`}><FaThLarge size={12} /></button>
            </div>
            <button onClick={handleRefresh} disabled={refreshing || loading} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-500 rounded-xl text-xs font-semibold transition disabled:opacity-40">
              <FaSync size={11} className={(refreshing || loading) ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="w-full px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { key: "all",      label: "All",      cls: "bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400" },
            { key: "pending",  label: "Pending",  cls: "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400" },
            { key: "approved", label: "Approved", cls: "bg-green-50 text-green-700 border-green-200 hover:border-green-400" },
            { key: "rejected", label: "Rejected", cls: "bg-red-50 text-red-600 border-red-200 hover:border-red-400" },
            { key: "draft",    label: "Drafts",   cls: "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400" },
          ].map(({ key, label, cls }) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${cls} ${filterStatus === key ? "ring-2 ring-offset-1 ring-indigo-400 shadow-sm" : ""}`}>
              {label}
              <span className="font-black">{counts[key]}</span>
            </button>
          ))}

          {/* Search */}
          <div className="relative ml-auto min-w-[220px]">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
            <input type="text" placeholder="Search templates…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><FaTimes size={10} /></button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
              <MdOutlineFactCheck className="text-5xl text-gray-200 mx-auto mb-4" />
              <h3 className="text-base font-bold text-gray-500 mb-1">No templates found</h3>
              <p className="text-sm text-gray-400">{filterStatus === "pending" ? "No pending templates." : "Try adjusting your filters."}</p>
            </div>
          ) : viewMode === "list" ? (

            /* ── List view ── */
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-50 border-b border-indigo-100">
                    {["Template", "Category", "Checkpoints", "Status", "Created By", "Submitted By", "Updated", "Actions"].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500 ${i > 1 ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((t, idx) => {
                    const cps      = getTotalCheckpoints(t);
                    const isOpen   = expandedHistoryId === t.id;
                    const tHistory = historyCache[t.id] || [];
                    const isLoading = historyLoadingId === t.id;

                    return (
                      <React.Fragment key={t.id}>
                        {/* ── Main row ── */}
                        <tr className={`hover:bg-indigo-50/20 transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : ""} ${isOpen ? "bg-indigo-50/30" : ""}`}>
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="font-black text-gray-800 text-xs truncate" title={t.name}>{t.name}</p>
                            {t.description && <p className="text-[10px] text-gray-400 truncate mt-0.5">{t.description}</p>}
                            <p className="text-[10px] text-indigo-500 font-mono mt-0.5">{t.templateCode}</p>
                            {t.rejectionReason && (
                              <div className="mt-1 px-2 py-1 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Rejection Reason</p>
                                <p className="text-[10px] text-red-600 leading-tight">{t.rejectionReason}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs text-gray-600 capitalize">{t.category || "—"}</span>
                            <p className="text-[10px] text-gray-400 mt-0.5">v{t.version || "01"}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-black text-indigo-600">{cps}</span>
                            <p className="text-[10px] text-gray-400">{t.defaultSections?.length || 0} sections</p>
                          </td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={t.approvalStatus} /></td>
                          <td className="px-4 py-3 text-center text-xs text-gray-600">{t.createdBy || "—"}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-600">{t.approvedBy || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <p className="text-xs text-gray-600">{relativeTime(t.updatedAt)}</p>
                            <p className="text-[10px] text-gray-400">{new Date(t.updatedAt).toLocaleDateString("en-IN")}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => navigate(`/auditreport/templates/${t.id}`)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition" title="View/Edit"><FaEye size={11} /></button>
                              <button onClick={() => openHistory(t)} className={`p-1.5 rounded-lg transition flex items-center gap-1 ${isOpen ? "bg-indigo-200 text-indigo-700" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"}`} title="Toggle Change Log">
                                <FaHistory size={11} />
                                <FaChevronRight size={8} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              </button>
                              {(t.approvalStatus === "pending_approval" || !t.approvalStatus) && (
                                <>
                                  <button onClick={() => handleApprove(t)} className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition" title="Approve"><FaCheckCircle size={11} /></button>
                                  <button onClick={() => handleRejectClick(t)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition" title="Reject"><FaTimesCircle size={11} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── Inline history row ── */}
                        {isOpen && (
                          <tr>
                            <td colSpan={8} className="px-6 py-4 bg-indigo-50/20 border-t border-indigo-100">
                              <div className="flex items-center gap-2 mb-3">
                                <FaHistory className="text-indigo-400" size={12} />
                                <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Change Log — {t.name}</span>
                              </div>

                              {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="w-6 h-6 border-4 border-indigo-100 border-t-indigo-400 rounded-full animate-spin" />
                                </div>
                              ) : tHistory.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-xs">No history recorded yet.</div>
                              ) : (
                                <div className="relative border-l-2 border-indigo-100 ml-3 space-y-2">
                                  {tHistory.map((entry, ei) => {
                                    const cfg = ACTION_CFG[entry.Action?.toLowerCase()] || ACTION_CFG.updated;
                                    return (
                                      <div key={entry.Id} className="relative pl-5">
                                        <div className={`absolute -left-[5px] top-2.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${cfg.dot}`} />
                                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                          {/* Entry header */}
                                          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <TypeBadge type={cfg.type} />
                                              <span className={`text-[10px] font-black ${cfg.color}`}>{cfg.label}</span>
                                              {(entry.PreviousStatus || entry.NewStatus) && (
                                                <div className="flex items-center gap-1">
                                                  {entry.PreviousStatus && <StatusBadge status={entry.PreviousStatus} />}
                                                  {entry.PreviousStatus && entry.NewStatus && <FaChevronRight size={7} className="text-gray-400" />}
                                                  {entry.NewStatus && <StatusBadge status={entry.NewStatus} />}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                              <span>{entry.ActionBy || "System"}</span>
                                              <span>{fmtDate(entry.ActionAt)}</span>
                                            </div>
                                          </div>

                                          {/* Rejection comment */}
                                          {entry.Comments && (
                                            <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                                              <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider mr-2">Remarks:</span>
                                              <span className="text-[10px] text-red-600">{entry.Comments}</span>
                                            </div>
                                          )}

                                          {/* Field changes — collapsible */}
                                          {entry.FieldChanges?.length > 0 && (
                                            <div className="px-4 py-2.5 flex flex-wrap gap-2">
                                              {entry.FieldChanges.map((fc, fi) => {
                                                const key    = `${entry.Id}_${fi}`;
                                                const isOpen = expandedChanges.has(key);
                                                const isRm   = !fc.to || fc.to === "";
                                                const isAdd  = !fc.from || fc.from === "";
                                                const dotClr = isRm ? "bg-red-400" : isAdd ? "bg-green-400" : "bg-amber-400";
                                                return (
                                                  <div key={fi} className="border border-gray-100 rounded-lg overflow-hidden text-[9px] min-w-[120px]">
                                                    <button type="button" onClick={() => toggleChange(key)}
                                                      className="w-full flex items-center justify-between px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                                                      <div className="flex items-center gap-1.5">
                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClr}`} />
                                                        <span className="font-bold text-gray-600 uppercase tracking-wide">{fc.field}</span>
                                                        {fc.note && <span className={`px-1.5 py-0.5 rounded-full font-bold ${isRm ? "bg-red-100 text-red-600" : isAdd ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{fc.note}</span>}
                                                      </div>
                                                      <FaChevronRight size={7} className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                                                    </button>
                                                    {isOpen && (
                                                      <div className="grid grid-cols-2 gap-1 p-1.5 bg-white">
                                                        <div className="bg-red-50 rounded px-1.5 py-1 border border-red-100">
                                                          <p className="text-red-400 font-bold uppercase mb-0.5">Before</p>
                                                          <p className="text-red-700 font-semibold break-all">{fc.from ?? "—"}</p>
                                                        </div>
                                                        <div className="bg-green-50 rounded px-1.5 py-1 border border-green-100">
                                                          <p className="text-green-400 font-bold uppercase mb-0.5">After</p>
                                                          <p className="text-green-700 font-semibold break-all">{fc.to ?? "—"}</p>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

          ) : (

            /* ── Grid view ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((t) => {
                const cps = getTotalCheckpoints(t);
                const isActive = expandedHistoryId === t.id;
                return (
                  <div key={t.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isActive ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-100"}`}>
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg flex-shrink-0"><HiClipboardDocumentCheck className="text-lg text-white" /></div>
                        <StatusBadge status={t.approvalStatus} />
                      </div>
                      <h3 className="font-black text-white text-sm leading-tight line-clamp-2">{t.name}</h3>
                      <p className="text-indigo-200 text-[10px] mt-1 font-mono">{t.templateCode}</p>
                    </div>
                    <div className="p-4 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-indigo-50 rounded-lg px-2 py-1.5 text-center"><p className="text-[9px] text-indigo-400 font-bold uppercase">Checkpoints</p><p className="text-base font-black text-indigo-700">{cps}</p></div>
                        <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center"><p className="text-[9px] text-gray-400 font-bold uppercase">Sections</p><p className="text-base font-black text-gray-700">{t.defaultSections?.length || 0}</p></div>
                      </div>
                      {[["Category",   t.category  || "—"],["Version",  `v${t.version || "01"}`],
                        ["Created By", t.createdBy || "—"],["Approved By", t.approvedBy || "—"],
                        ["Updated",    relativeTime(t.updatedAt)]].map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-gray-50 pb-1.5">
                          <span className="text-gray-400 font-medium">{k}</span>
                          <span className="text-gray-700 font-semibold truncate max-w-[100px]">{v}</span>
                        </div>
                      ))}
                      {t.rejectionReason && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                          <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Rejection Reason</p>
                          <p className="text-[10px] text-red-600 leading-tight mt-0.5">{t.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
                      <button onClick={() => navigate(`/auditreport/templates/${t.id}`)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-semibold transition"><FaEye size={10} /> View</button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openHistory(t)} className={`p-1.5 rounded-lg transition ${isActive ? "bg-indigo-200 text-indigo-700" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"}`} title="History"><FaHistory size={10} /></button>
                        {(t.approvalStatus === "pending_approval" || !t.approvalStatus) && (
                          <>
                            <button onClick={() => handleApprove(t)} className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition"><FaCheckCircle size={10} /></button>
                            <button onClick={() => handleRejectClick(t)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition"><FaTimesCircle size={10} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Reject Modal ───────────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-base font-black flex items-center gap-2"><FaTimesCircle /> Reject Template</h3>
              <p className="text-red-200 text-xs mt-1">Template: <strong>{selectedTemplate?.name}</strong></p>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-gray-700 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describe what needs to be corrected…" rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
              <div className="flex items-center justify-end gap-3 mt-4">
                <button onClick={() => setShowRejectModal(false)} disabled={rejecting}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm disabled:opacity-50 transition">Cancel</button>
                <button onClick={handleReject} disabled={rejecting || !rejectReason.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition">
                  {rejecting ? "Rejecting…" : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateApproval;
