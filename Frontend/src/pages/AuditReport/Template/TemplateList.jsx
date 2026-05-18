import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCopy,
  FaSearch,
  FaFilter,
  FaFileAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaSync,
  FaThLarge,
  FaList,
  FaSortAmountDown,
  FaSortAmountUp,
  FaLayerGroup,
  FaClipboardList,
  FaEye,
  FaTimes,
  FaChevronRight,
  FaExclamationTriangle,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ROLES } from "../../../config/routes.config";

// ==================== CONSTANTS ====================
const CATEGORIES = [
  {
    value: "",
    label: "All",
    color: "bg-gray-100 text-gray-700 border-gray-200",
  },
  {
    value: "quality",
    label: "Quality",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    value: "safety",
    label: "Safety",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  {
    value: "process",
    label: "Process",
    color: "bg-green-100 text-green-700 border-green-200",
  },
  {
    value: "compliance",
    label: "Compliance",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  {
    value: "other",
    label: "Other",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
];

const SORT_OPTIONS = [
  { value: "updatedAt_desc", label: "Recently Updated" },
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "checkpoints_desc", label: "Most Checkpoints" },
  { value: "sections_desc", label: "Most Sections" },
];

// ==================== HELPERS ====================
const relativeTime = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "—";
  }
};

// FIX: original only counted section.checkPoints (flat), missed stages?checkPoints hierarchy
const getTotalCheckpoints = (template) => {
  if (!template?.defaultSections) return 0;
  let total = 0;
  template.defaultSections.forEach((section) => {
    if (section.stages && Array.isArray(section.stages)) {
      section.stages.forEach((stage) => {
        total += stage.checkPoints?.length || 0;
      });
    } else {
      total += section.checkPoints?.length || 0;
    }
  });
  return total;
};

const getTotalStages = (template) => {
  if (!template?.defaultSections) return 0;
  return template.defaultSections.reduce(
    (t, s) => t + (s.stages?.length || 1),
    0,
  );
};

const getCategoryConfig = (category) =>
  CATEGORIES.find((c) => c.value === category) ||
  CATEGORIES[CATEGORIES.length - 1];

// ==================== SUB-COMPONENTS ====================
const StatCard = ({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
    <div
      className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}
    >
      <Icon className={`text-lg ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-black text-gray-800 leading-none">
        {value}
      </div>
      <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// Template preview modal
const PreviewModal = ({ template, onClose, onUse, onEdit, canEdit }) => {
  if (!template) return null;
  const catCfg = getCategoryConfig(template.category);
  const checkpoints = getTotalCheckpoints(template);
  const stages = getTotalStages(template);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-br from-slate-800 to-indigo-900 text-white flex items-start justify-between gap-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HiClipboardDocumentCheck className="text-xl text-indigo-300" />
              <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                Template Preview
              </span>
            </div>
            <h2 className="text-lg font-black leading-tight">
              {template.name}
            </h2>
            {template.description && (
              <p className="text-indigo-300 text-xs mt-1 line-clamp-2">
                {template.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition flex-shrink-0"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* Meta badges */}
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 flex-shrink-0">
          {template.category && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${catCfg.color}`}
            >
              {catCfg.label}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            v{template.version || "1.0"}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {template.defaultSections?.length || 0} sections
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
            {stages} stages
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            {checkpoints} checkpoints
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${template.isActive !== false ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
          >
            {template.isActive !== false ? (
              <FaCheckCircle size={9} />
            ) : (
              <FaTimesCircle size={9} />
            )}
            {template.isActive !== false ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Section structure */}
        <div className="flex-1 overflow-y-auto p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Section Structure
          </h3>
          {template.defaultSections?.length > 0 ? (
            <div className="space-y-2">
              {template.defaultSections.map((section, si) => (
                <div
                  key={section.id || si}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-700 text-white">
                    <span className="font-semibold text-sm">
                      {section.sectionName || `Section ${si + 1}`}
                    </span>
                    <span className="text-xs text-slate-300">
                      {section.stages?.length || 0} stages
                    </span>
                  </div>
                  {section.stages?.map((stage, sti) => (
                    <div
                      key={stage.id || sti}
                      className="border-t border-gray-100"
                    >
                      <div className="flex items-center justify-between px-4 py-2 bg-indigo-50">
                        <span className="text-xs font-semibold text-indigo-700">
                          {stage.stageName || `Stage ${sti + 1}`}
                        </span>
                        <span className="text-[10px] text-indigo-400">
                          {stage.checkPoints?.length || 0} checkpoints
                        </span>
                      </div>
                      {stage.checkPoints?.slice(0, 3).map((cp, ci) => (
                        <div
                          key={cp.id || ci}
                          className="flex items-center gap-2 px-6 py-1.5 border-t border-gray-50"
                        >
                          <FaChevronRight
                            size={8}
                            className="text-gray-300 flex-shrink-0"
                          />
                          <span className="text-xs text-gray-600 truncate">
                            {cp.checkPoint || `Checkpoint ${ci + 1}`}
                          </span>
                        </div>
                      ))}
                      {(stage.checkPoints?.length || 0) > 3 && (
                        <div className="px-6 py-1.5 border-t border-gray-50">
                          <span className="text-[10px] text-gray-400 italic">
                            +{stage.checkPoints.length - 3} more checkpoints…
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-300">
              <FaClipboardList className="text-3xl mx-auto mb-2" />
              <p className="text-sm">No sections defined</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-gray-400">
            Created {relativeTime(template.createdAt)}
            {template.updatedAt &&
              template.updatedAt !== template.createdAt &&
              ` · Updated ${relativeTime(template.updatedAt)}`}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  onEdit();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold transition-all"
              >
                <FaEdit size={11} /> Edit
              </button>
            )}
            <button
              onClick={() => {
                onUse();
                onClose();
              }}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200"
            >
              <FaPlus size={11} /> Use Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const TemplateList = () => {
  const { user } = useSelector((store) => store.auth);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const { templates, deleteTemplate, duplicateTemplate, loadTemplates } =
    useAuditData();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [sortKey, setSortKey] = useState("updatedAt_desc");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dupLoadingId, setDupLoadingId] = useState(null); // per-template duplicate loading
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const canEdit = [
    ROLES.ADMIN,
    ROLES.QUALITY_MANAGER,
    ROLES.LINE_QUALITY_ENGINEER,
  ].includes(user?.roleName);

  // Keyboard shortcut — Ctrl+F ? focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setPreviewTemplate(null);
        setShowDeleteModal(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Load templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setInitialLoading(true);
      try {
        await loadTemplates();
      } catch (err) {
        toast.error("Failed to load templates: " + err.message);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTemplates();
      toast.success("Refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // FIX: per-template duplicate loading (original shared one actionLoading blocked all buttons)
  const handleDuplicate = async (template) => {
    setDupLoadingId(template.id);
    try {
      await duplicateTemplate(template.id);
      toast.success(`"${template.name}" duplicated!`);
    } catch (err) {
      toast.error("Duplicate failed: " + err.message);
    } finally {
      setDupLoadingId(null);
    }
  };

  const confirmDelete = (template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  // FIX: added missing toast.success on successful delete
  const handleDelete = async () => {
    if (!templateToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteTemplate(templateToDelete.id);
      toast.success(`"${templateToDelete.name}" deleted`); // ? was missing
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ==================== FILTER + SORT ====================
  const enriched = useMemo(
    () =>
      templates.map((t) => ({
        ...t,
        _checkpoints: getTotalCheckpoints(t),
        _stages: getTotalStages(t),
      })),
    [templates],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return enriched.filter((t) => {
      if (
        q &&
        !["name", "description", "category"].some((k) =>
          t[k]?.toLowerCase().includes(q),
        )
      )
        return false;
      if (filterCategory && t.category !== filterCategory) return false;
      return true;
    });
  }, [enriched, searchTerm, filterCategory]);

  const sorted = useMemo(() => {
    const [field, dir] = sortKey.split("_");
    const mult = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (field === "name")
        return mult * (a.name || "").localeCompare(b.name || "");
      if (field === "checkpoints")
        return mult * ((a._checkpoints || 0) - (b._checkpoints || 0));
      if (field === "sections")
        return (
          mult *
          ((a.defaultSections?.length || 0) - (b.defaultSections?.length || 0))
        );
      const da = new Date(a[field] || a.createdAt || 0);
      const db = new Date(b[field] || b.createdAt || 0);
      return mult * (da - db);
    });
  }, [filtered, sortKey]);

  // ==================== STATS ====================
  const stats = useMemo(
    () => ({
      total: templates.length,
      active: templates.filter((t) => t.isActive !== false).length,
      inactive: templates.filter((t) => t.isActive === false).length,
      byCategory: CATEGORIES.slice(1).reduce((acc, c) => {
        acc[c.value] = templates.filter((t) => t.category === c.value).length;
        return acc;
      }, {}),
    }),
    [templates],
  );

  const hasFilters = searchTerm || filterCategory;
  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategory("");
  };

  // ==================== LOADING ====================
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <div>
            <p className="font-semibold text-gray-700">Loading Templates</p>
            <p className="text-sm text-gray-400 mt-1">
              Fetching audit templates…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* ==================== PREVIEW MODAL ==================== */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUse={() =>
            navigate(`/auditreport/audits/new?template=${previewTemplate.id}`)
          }
          onEdit={() =>
            navigate(`/auditreport/templates/${previewTemplate.id}`)
          }
          canEdit={canEdit}
        />
      )}

      {/* ==================== DELETE MODAL ==================== */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-base font-black flex items-center gap-2">
                <FaTrash size={13} /> Delete Template
              </h3>
              <p className="text-red-200 text-xs mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-3">
                You are about to permanently delete:
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <p className="font-bold text-gray-800">
                  {templateToDelete?.name}
                </p>
                {templateToDelete?.category && (
                  <p className="text-xs text-gray-400 mt-1 capitalize">
                    {templateToDelete.category} audit
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <FaExclamationTriangle
                  className="text-red-500 mt-0.5 flex-shrink-0"
                  size={12}
                />
                <p className="text-xs text-red-600 font-medium">
                  All sections, stages, and checkpoint configurations will be
                  permanently removed.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTemplateToDelete(null);
                }}
                disabled={deleteLoading}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-all shadow-md shadow-red-200"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Deleting…
                  </>
                ) : (
                  <>
                    <FaTrash size={11} /> Delete Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STICKY HEADER ==================== */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <HiClipboardDocumentCheck className="text-xl text-indigo-600" />
              </div>
              <div>
                <h1 className="text-base font-black text-gray-800 leading-none">
                  Audit Templates
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sorted.length} of {templates.length} templates
                  {hasFilters && (
                    <span className="ml-1 text-indigo-500 font-semibold">
                      · filtered
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                title="Grid view"
              >
                <FaThLarge size={13} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                title="List view"
              >
                <FaList size={13} />
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <FaSync size={11} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">
                {refreshing ? "…" : "Refresh"}
              </span>
            </button>

            {canEdit && (
              <button
                onClick={() => navigate("/auditreport/templates/new")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200"
              >
                <FaPlus size={11} /> New Template
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-5 space-y-4">
        {/* ==================== STATS ROW ==================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={HiClipboardDocumentCheck}
            label="Total Templates"
            value={stats.total}
            iconBg="bg-slate-100"
            iconColor="text-slate-600"
          />
          <StatCard
            icon={FaCheckCircle}
            label="Active"
            value={stats.active}
            iconBg="bg-green-50"
            iconColor="text-green-500"
          />
          <StatCard
            icon={FaTimesCircle}
            label="Inactive"
            value={stats.inactive}
            iconBg="bg-red-50"
            iconColor="text-red-500"
          />
          <StatCard
            icon={FaClipboardList}
            label="Total Sections"
            value={templates.reduce(
              (t, tmpl) => t + (tmpl.defaultSections?.length || 0),
              0,
            )}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
          />
        </div>

        {/* ==================== SEARCH + FILTER BAR ==================== */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-center mb-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <FaSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
                size={12}
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search templates… (Ctrl+F)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <FaTimes size={11} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <FaSortAmountDown
                size={12}
                className="text-gray-400 flex-shrink-0"
              />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:border-indigo-400 outline-none bg-white"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-100 font-semibold transition-all"
              >
                <FaTimes size={11} /> Clear
              </button>
            )}
          </div>

          {/* Category chip filters */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const count =
                cat.value === ""
                  ? templates.length
                  : stats.byCategory[cat.value] || 0;
              return (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    filterCategory === cat.value
                      ? cat.value === ""
                        ? "bg-slate-800 text-white border-slate-800"
                        : cat.color
                            .replace("border-", "border-")
                            .replace("bg-", "bg-")
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {cat.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterCategory === cat.value ? "bg-white/20" : "bg-gray-100"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================== EMPTY STATE ==================== */}
        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-14 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <FaFileAlt className="text-4xl text-gray-200" />
            </div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">
              {hasFilters ? "No matching templates" : "No templates yet"}
            </h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
              {hasFilters
                ? "Try adjusting your search or category filter."
                : "Create your first audit template to get started."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all"
                >
                  <FaTimes size={11} /> Clear Filters
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => navigate("/auditreport/templates/new")}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200"
                >
                  <FaPlus size={11} /> Create Template
                </button>
              )}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          /* ==================== GRID VIEW ==================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((template) => {
              const catCfg = getCategoryConfig(template.category);
              const isActive = template.isActive !== false;
              const isDuplicating = dupLoadingId === template.id;

              return (
                <div
                  key={template.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col overflow-hidden"
                >
                  {/* Card top */}
                  <div className="relative bg-gradient-to-br from-slate-800 to-indigo-900 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 bg-white/10 rounded-xl flex-shrink-0">
                        <HiClipboardDocumentCheck className="text-xl text-white" />
                      </div>
                      <span
                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold flex-shrink-0 ${isActive ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-white/10 text-white/50 border border-white/20"}`}
                      >
                        {isActive ? (
                          <FaCheckCircle size={8} />
                        ) : (
                          <FaTimesCircle size={8} />
                        )}
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="font-black text-white text-sm mt-3 leading-tight line-clamp-2">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-indigo-300 text-xs mt-1.5 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="px-4 py-3 flex flex-wrap gap-1.5 border-b border-gray-100">
                    {template.category && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${catCfg.color}`}
                      >
                        {catCfg.label}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                      v{template.version || "1.0"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {template.defaultSections?.length || 0} sections
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {template._checkpoints} checkpoints
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="px-4 py-3 flex items-center justify-between text-xs text-gray-400 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <FaLayerGroup size={9} /> {template._stages} stages
                      </span>
                      <span className="flex items-center gap-1">
                        <FaClipboardList size={9} /> {template._checkpoints}{" "}
                        checks
                      </span>
                    </div>
                  </div>

                  {/* Body actions */}
                  <div className="p-4 flex gap-2 flex-1 items-end">
                    <button
                      onClick={() =>
                        navigate(
                          `/auditreport/audits/new?template=${template.id}`,
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-200"
                    >
                      <FaPlus size={10} /> Use
                    </button>

                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl transition-all"
                      title="Preview"
                    >
                      <FaEye size={13} />
                    </button>

                    {canEdit && (
                      <>
                        <button
                          onClick={() =>
                            navigate(`/auditreport/templates/${template.id}`)
                          }
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all"
                          title="Edit"
                        >
                          <FaEdit size={13} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(template)}
                          disabled={isDuplicating}
                          className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition-all disabled:opacity-50"
                          title="Duplicate"
                        >
                          {isDuplicating ? (
                            <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FaCopy size={13} />
                          )}
                        </button>
                        <button
                          onClick={() => confirmDelete(template)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all"
                          title="Delete"
                        >
                          <FaTrash size={13} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
                    <span>
                      Updated{" "}
                      {relativeTime(template.updatedAt || template.createdAt)}
                    </span>
                    <span className="font-mono text-gray-300">
                      #{template.id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ==================== LIST VIEW ==================== */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden md:table-cell">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">
                    Structure
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden xl:table-cell">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((template, idx) => {
                  const catCfg = getCategoryConfig(template.category);
                  const isActive = template.isActive !== false;
                  const isDuplicating = dupLoadingId === template.id;

                  return (
                    <tr
                      key={template.id}
                      className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                    >
                      {/* Template name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <HiClipboardDocumentCheck className="text-indigo-500 text-base" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">
                              {template.name}
                            </p>
                            {template.description && (
                              <p className="text-xs text-gray-400 truncate max-w-[200px]">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {template.category ? (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${catCfg.color}`}
                          >
                            {catCfg.label}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Structure */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FaLayerGroup
                              size={10}
                              className="text-slate-400"
                            />{" "}
                            {template.defaultSections?.length || 0}
                          </span>
                          <span className="text-gray-200">|</span>
                          <span className="flex items-center gap-1">
                            <FaClipboardList
                              size={10}
                              className="text-indigo-400"
                            />{" "}
                            {template._checkpoints}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                        >
                          {isActive ? (
                            <FaCheckCircle size={9} />
                          ) : (
                            <FaTimesCircle size={9} />
                          )}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-xs text-gray-400">
                          {relativeTime(
                            template.updatedAt || template.createdAt,
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() =>
                              navigate(
                                `/auditreport/audits/new?template=${template.id}`,
                              )
                            }
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                          >
                            <FaPlus size={9} /> Use
                          </button>
                          <button
                            onClick={() => setPreviewTemplate(template)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-all"
                            title="Preview"
                          >
                            <FaEye size={12} />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() =>
                                  navigate(
                                    `/auditreport/templates/${template.id}`,
                                  )
                                }
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all"
                                title="Edit"
                              >
                                <FaEdit size={12} />
                              </button>
                              <button
                                onClick={() => handleDuplicate(template)}
                                disabled={isDuplicating}
                                className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-all disabled:opacity-50"
                                title="Duplicate"
                              >
                                {isDuplicating ? (
                                  <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <FaCopy size={12} />
                                )}
                              </button>
                              <button
                                onClick={() => confirmDelete(template)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all"
                                title="Delete"
                              >
                                <FaTrash size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* List footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-bold text-gray-700">{sorted.length}</span>{" "}
                of{" "}
                <span className="font-bold text-gray-700">
                  {templates.length}
                </span>{" "}
                templates
              </span>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateList;
