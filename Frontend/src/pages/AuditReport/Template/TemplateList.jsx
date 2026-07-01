import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";
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
  FaHistory,
  FaCodeBranch,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ROLES } from "../../../config/routes.config";
import TemplateHistoryPanel from "./components/TemplateHistoryPanel";
import NewTemplateNamePrompt from "./components/NewTemplateNamePrompt";
import { useTemplateSearch } from "../../../hooks/useTemplateSearch";
import { Modal, ConfirmModal, StatusBadge as SharedStatusBadge, ModalCloseBtn, TD } from "../_shared.jsx";

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

// Prefer the precomputed SQL stat columns (set once at save time) — only walk
// defaultSections for legacy templates saved before those columns existed.
// FIX: the defaultSections walk only counted section.checkPoints (flat), missed stages?checkPoints hierarchy
const getTotalCheckpoints = (template) => {
  if (template?.checkpointCount != null) return template.checkpointCount;
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
  if (template?.stageCount != null) return template.stageCount;
  if (!template?.defaultSections) return 0;
  return template.defaultSections.reduce(
    (t, s) => t + (s.stages?.length || 1),
    0,
  );
};

const getTotalSections = (template) => {
  if (template?.sectionCount != null) return template.sectionCount;
  return template?.defaultSections?.length || 0;
};

const getCategoryConfig = (category) =>
  CATEGORIES.find((c) => c.value === category) ||
  CATEGORIES[CATEGORIES.length - 1];

// Approval-status badge palettes — light variant for the table-view row, dark/translucent
// variant for the gradient grid-card header (both rendered via shared StatusBadge below).
const APPROVAL_STATUS_LABELS = {
  approved:         { label: "Approved", cls: "flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 border border-green-300" },
  pending_approval: { label: "Pending",  cls: "flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 border border-amber-300" },
  rejected:         { label: "Rejected", cls: "flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 border border-red-300" },
  draft:            { label: "Draft",    cls: "flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600 border border-gray-300" },
};

const APPROVAL_STATUS_LABELS_DARK = {
  approved:         { label: "Approved", cls: "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold bg-green-500/20 text-green-300 border border-green-500/30" },
  pending_approval: { label: "Pending",  cls: "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  rejected:         { label: "Rejected", cls: "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold bg-red-500/20 text-red-300 border border-red-500/30" },
  draft:            { label: "Draft",    cls: "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold bg-gray-500/20 text-gray-300 border border-gray-500/30" },
};

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
  const navigate = useNavigate();
  if (!template) return null;
  const catCfg = getCategoryConfig(template.category);
  const checkpoints = getTotalCheckpoints(template);
  const stages = getTotalStages(template);

  return (
    <Modal onClose={onClose}>
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
          <ModalCloseBtn onClick={onClose} />
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
          <button
            onClick={() => navigate(`/auditreport/templates/${template.id}/compare`)}
            title="Compare versions"
            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 transition-colors flex items-center gap-1"
          >
            v{template.version || "1.0"} <FaCodeBranch size={9} />
          </button>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {getTotalSections(template)} sections
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
    </Modal>
  );
};

// ==================== MAIN COMPONENT ====================
const TemplateList = () => {
  const { user } = useSelector((store) => store.auth);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const {
    templates,
    deleteTemplate,
    duplicateTemplate,
    checkTemplateName,
    loadTemplates,
    updateTemplate,
  } = useAuditData();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [sortKey, setSortKey] = useState("updatedAt_desc");
  const [viewMode, setViewMode] = useState("list"); // "grid" | "list"
  const [activeTab, setActiveTab] = useState("all"); // "all" | "draft"
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dupLoadingId, setDupLoadingId] = useState(null);
  const [submitLoadingId, setSubmitLoadingId] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState(null); // template being duplicated, or null
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // History inline expansion — fetching/caching now lives in TemplateHistoryPanel
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const canCreateEdit = [
    ROLES.SUPER_ADMIN,
    ROLES.QUALITY_MANAGER,
    ROLES.LINE_QUALITY_ENGINEER,
  ].includes(user?.roleName);

  const isAdmin = user?.roleName === ROLES.SUPER_ADMIN;
  const isLineOperator = user?.roleName === ROLES.QUALITY_OPERATOR;

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

  // Load templates on mount, and re-fetch when the version-history toggle
  // flips (includeHistory=true reveals inactive/old versions per template).
  useEffect(() => {
    const fetchTemplates = async () => {
      setInitialLoading(true);
      try {
        await loadTemplates(showVersionHistory ? { includeHistory: true } : {});
      } catch (err) {
        toast.error("Failed to load templates: " + err.message);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVersionHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTemplates(showVersionHistory ? { includeHistory: true } : {});
      toast.success("Refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmitForApproval = async (template) => {
    setSubmitLoadingId(template.id);
    try {
      await updateTemplate(template.id, {
        approvalStatus: "pending_approval",
        createdByUser:
          user?.name || String(user?.userCode ?? user?.usercode ?? "SYSTEM"),
      });
      toast.success(`"${template.name}" submitted for approval`);
    } catch (err) {
      toast.error("Submit failed: " + err.message);
    } finally {
      setSubmitLoadingId(null);
    }
  };

  // Duplicate always prompts for a new name (never silently auto-names
  // "(Copy)") — opens the same two-step name-collision dialog used for "New
  // Template", just with "Create Version" instead of "Edit Existing" on a
  // collision.
  const handleDuplicate = (template) => setDuplicateSource(template);

  const duplicateCreatedBy = () =>
    user?.name || String(user?.userCode ?? user?.usercode ?? "SYSTEM");

  // duplicateTemplate's single call both checks the name AND performs the
  // duplication when it's unique — so the prompt's "check" step IS the
  // create. onUnique then just finalizes the UI (the row is already in
  // `templates` via the hook's optimistic update).
  const handleDuplicateCheck = async (newName) => {
    setDupLoadingId(duplicateSource.id);
    try {
      return await duplicateTemplate(duplicateSource.id, { newName, createdBy: duplicateCreatedBy() });
    } finally {
      setDupLoadingId(null);
    }
  };

  const handleDuplicateUnique = async (newName) => {
    toast.success(`"${newName}" created from "${duplicateSource.name}"`);
    setDuplicateSource(null);
  };

  const handleDuplicateConfirmVersion = async (existing) => {
    setDupLoadingId(duplicateSource.id);
    try {
      await duplicateTemplate(duplicateSource.id, {
        newName: existing.name,
        createdBy: duplicateCreatedBy(),
        confirmCreateVersion: true,
      });
      toast.success(`New version created on "${existing.name}"`);
      setDuplicateSource(null);
    } finally {
      setDupLoadingId(null);
    }
  };

  // New Template: name-uniqueness is checked BEFORE the builder ever opens.
  // Unique -> builder opens pre-filled, brand new (v01 on first Save).
  // Collision -> "Edit Existing" opens the builder against that template's
  // current content; Save there creates a new version, never overwrites.
  const handleNewTemplateCheck = async (name) => checkTemplateName(name);

  const handleNewTemplateUnique = (name) => {
    setShowNamePrompt(false);
    navigate("/auditreport/templates/new", { state: { presetName: name } });
  };

  const handleNewTemplateConfirmExisting = (existing) => {
    setShowNamePrompt(false);
    navigate(`/auditreport/templates/${existing.id}`, { state: { editMode: true } });
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

  // ==================== HISTORY ====================
  const openHistory = (template) =>
    setExpandedHistoryId((prev) => (prev === template.id ? null : template.id));

  // ==================== FILTER + SORT ====================
  const enriched = useMemo(
    () =>
      templates.map((t) => ({
        ...t,
        _checkpoints: getTotalCheckpoints(t),
        _stages: getTotalStages(t),
        _sections: getTotalSections(t),
      })),
    [templates],
  );

  // My draft templates — only visible to their creator and super admin
  const myDrafts = useMemo(() => {
    // Match against both name (new records) and userCode as string (old records).
    const myName = user?.name || "";
    const myCode = String(user?.userCode ?? user?.usercode ?? "");
    return enriched.filter((t) => {
      if (t.approvalStatus !== "draft") return false;
      const createdBy = String(t.createdBy ?? "");
      const isOwner =
        (myName && createdBy === myName) || (myCode && createdBy === myCode);
      return isAdmin || isOwner;
    });
  }, [enriched, isAdmin, user]);

  // Non-draft templates visible to this role
  const filteredTemplates = useMemo(() => {
    const nonDraft = enriched.filter((t) => t.approvalStatus !== "draft");
    if (isLineOperator)
      return nonDraft.filter((t) => t.approvalStatus === "approved");
    return nonDraft;
  }, [enriched, isLineOperator]);

  const categoryFiltered = useMemo(() => {
    const base = activeTab === "draft" ? myDrafts : filteredTemplates;
    if (!filterCategory) return base;
    return base.filter((t) => t.category === filterCategory);
  }, [activeTab, myDrafts, filteredTemplates, filterCategory]);

  const filtered = useTemplateSearch(categoryFiltered, searchTerm);

  const sorted = useMemo(() => {
    const [field, dir] = sortKey.split("_");
    const mult = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (field === "name")
        return mult * (a.name || "").localeCompare(b.name || "");
      if (field === "checkpoints")
        return mult * ((a._checkpoints || 0) - (b._checkpoints || 0));
      if (field === "sections")
        return mult * ((a._sections || 0) - (b._sections || 0));
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
          canEdit={canCreateEdit}
        />
      )}

      {/* ==================== NEW TEMPLATE NAME PROMPT ==================== */}
      {showNamePrompt && (
        <NewTemplateNamePrompt
          title="New Template"
          inputLabel="Template Name"
          onClose={() => setShowNamePrompt(false)}
          onCheck={handleNewTemplateCheck}
          onUnique={handleNewTemplateUnique}
          onConfirmExisting={handleNewTemplateConfirmExisting}
          existingActionLabel="Edit Existing"
        />
      )}

      {/* ==================== DUPLICATE NAME PROMPT ==================== */}
      {duplicateSource && (
        <NewTemplateNamePrompt
          title={`Duplicate "${duplicateSource.name}"`}
          inputLabel="New Template Name"
          initialValue={`${duplicateSource.name} (Copy)`}
          onClose={() => setDuplicateSource(null)}
          onCheck={handleDuplicateCheck}
          onUnique={handleDuplicateUnique}
          onConfirmExisting={handleDuplicateConfirmVersion}
          existingActionLabel="Create Version"
        />
      )}

      {/* ==================== DELETE MODAL ==================== */}
      {showDeleteModal && (
        <ConfirmModal
          onClose={() => { setShowDeleteModal(false); setTemplateToDelete(null); }}
          onConfirm={handleDelete}
          confirming={deleteLoading}
          icon={FaTrash}
          title="Delete Template"
          subtitle="This action cannot be undone."
          confirmLabel={<><FaTrash size={11} /> Delete Template</>}
          confirmingLabel={<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}Deleting…</>}
        >
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
        </ConfirmModal>
      )}

      {/* ==================== STICKY HEADER ==================== */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 w-full flex flex-wrap items-center justify-between gap-3">
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
                  {sorted.length} {activeTab === "draft" ? "draft" : ""}{" "}
                  templates
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
            {/* Scan Serial button */}
            <button
              onClick={() => navigate("/auditreport/scan-serial")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl font-bold text-sm transition-all"
            >
              <FaSearch size={11} /> Scan Serial
            </button>

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

            <button
              onClick={() => setShowVersionHistory((v) => !v)}
              title="Show all versions, including inactive/old ones"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all border ${
                showVersionHistory
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              <FaCodeBranch size={11} />
              <span className="hidden sm:inline">Version History</span>
            </button>

            {canCreateEdit && (
              <button
                onClick={() => setShowNamePrompt(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200"
              >
                <FaPlus size={11} /> New Template
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================== TAB BAR ==================== */}
      {canCreateEdit && (
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex items-center gap-0">
            <button
              onClick={() => {
                setActiveTab("all");
                setSearchTerm("");
                setFilterCategory("");
              }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "all"
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FaClipboardList size={12} />
              All Templates
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "all" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}
              >
                {filteredTemplates.length}
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab("draft");
                setSearchTerm("");
                setFilterCategory("");
              }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "draft"
                  ? "border-amber-500 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FaFileAlt size={12} />
              My Drafts
              {myDrafts.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "draft" ? "bg-amber-100 text-amber-700" : "bg-amber-50 text-amber-600"}`}
                >
                  {myDrafts.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="w-full px-6 py-5 space-y-4">
        {/* ==================== STATS ROW ==================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
              (t, tmpl) => t + getTotalSections(tmpl),
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
              {hasFilters
                ? "No matching templates"
                : activeTab === "draft"
                  ? "No drafts yet"
                  : "No templates yet"}
            </h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
              {hasFilters
                ? "Try adjusting your search or category filter."
                : activeTab === "draft"
                  ? "Templates you save as draft will appear here."
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
              {canCreateEdit && (
                <button
                  onClick={() => setShowNamePrompt(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200"
                >
                  <FaPlus size={11} /> Create Template
                </button>
              )}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          /* ==================== GRID VIEW ==================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
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
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {template.approvalStatus && (
                          <SharedStatusBadge
                            config={APPROVAL_STATUS_LABELS_DARK[template.approvalStatus] || APPROVAL_STATUS_LABELS_DARK.draft}
                          />
                        )}
                        <span
                          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold ${isActive ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-white/10 text-white/50 border border-white/20"}`}
                        >
                          {isActive ? (
                            <FaCheckCircle size={8} />
                          ) : (
                            <FaTimesCircle size={8} />
                          )}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/auditreport/templates/${template.id}/compare`);
                      }}
                      title="Compare versions"
                      className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 transition-colors flex items-center gap-1"
                    >
                      v{template.version || "1.0"} <FaCodeBranch size={8} />
                    </button>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {template._sections} sections
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
                    {activeTab === "draft" ? (
                      <button
                        onClick={() => handleSubmitForApproval(template)}
                        disabled={submitLoadingId === template.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-amber-200"
                      >
                        {submitLoadingId === template.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FaCheckCircle size={10} />
                        )}
                        {submitLoadingId === template.id
                          ? "Submitting…"
                          : "Submit for Approval"}
                      </button>
                    ) : (
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
                    )}

                    <button
                      onClick={() =>
                        navigate(`/auditreport/templates/${template.id}/view`)
                      }
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl transition-all"
                      title="View"
                    >
                      <FaEye size={13} />
                    </button>

                    {canCreateEdit && (
                      <button
                        onClick={() =>
                          navigate(`/auditreport/templates/${template.id}`)
                        }
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all"
                        title="Edit"
                      >
                        <FaEdit size={13} />
                      </button>
                    )}

                    {canCreateEdit && (
                      <>
                        {activeTab !== "draft" && (
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
                        )}
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
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400">
                    <div className="flex items-center justify-between">
                      <div>
                        <div>
                          Updated{" "}
                          {relativeTime(
                            template.updatedAt || template.createdAt,
                          )}
                        </div>
                        {template.createdBy && (
                          <div className="mt-0.5">
                            <span className="text-gray-500 font-medium">
                              By:
                            </span>{" "}
                            {template.createdBy}
                          </div>
                        )}
                        {template.createdAt && (
                          <div className="mt-0.5">
                            <span className="text-gray-500 font-medium">
                              On:
                            </span>{" "}
                            {new Date(template.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openHistory(template)}
                        className={`p-1.5 rounded-lg transition-all flex items-center gap-0.5 ${expandedHistoryId === template.id ? "bg-indigo-200 text-indigo-700" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"}`}
                        title="Change History"
                      >
                        <FaHistory size={11} />
                        <FaChevronRight
                          size={7}
                          className={`transition-transform ${expandedHistoryId === template.id ? "rotate-90" : ""}`}
                        />
                      </button>
                    </div>

                    <TemplateHistoryPanel
                      templateId={template.id}
                      isOpen={expandedHistoryId === template.id}
                      variant="inline-grid"
                    />
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden xl:table-cell">
                    Created By
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
                  const isHistoryOpen = expandedHistoryId === template.id;

                  return (
                    <React.Fragment key={template.id}>
                      <tr
                        className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} ${isHistoryOpen ? "bg-indigo-50/30" : ""}`}
                      >
                        {/* Template name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                              <HiClipboardDocumentCheck className="text-indigo-500 text-base" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-800 text-sm truncate">
                                  {template.name}
                                </p>
                                {template.approvalStatus && (
                                  <SharedStatusBadge
                                    config={APPROVAL_STATUS_LABELS[template.approvalStatus] || APPROVAL_STATUS_LABELS.draft}
                                  />
                                )}
                              </div>
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
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1" title="Sections">
                                <FaLayerGroup
                                  size={10}
                                  className="text-slate-400"
                                />{" "}
                                {template._sections}
                              </span>
                              <span className="text-gray-200">|</span>
                              <span className="flex items-center gap-1" title="Checkpoints">
                                <FaClipboardList
                                  size={10}
                                  className="text-indigo-400"
                                />{" "}
                                {template._checkpoints}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/auditreport/templates/${template.id}/compare`);
                              }}
                              title="Compare versions"
                              className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 transition-colors flex items-center gap-1"
                            >
                              v{template.version || "1.0"} <FaCodeBranch size={8} />
                            </button>
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

                        {/* Created By */}
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="text-xs text-gray-600 font-medium">
                            {template.createdBy || "—"}
                          </div>
                          {template.createdAt && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(template.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {activeTab === "draft" ? (
                              <button
                                onClick={() =>
                                  handleSubmitForApproval(template)
                                }
                                disabled={submitLoadingId === template.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all"
                              >
                                {submitLoadingId === template.id ? (
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <FaCheckCircle size={9} />
                                )}
                                {submitLoadingId === template.id
                                  ? "…"
                                  : "Submit"}
                              </button>
                            ) : (
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
                            )}
                            <button
                              onClick={() =>
                                navigate(
                                  `/auditreport/templates/${template.id}/view`,
                                )
                              }
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-all"
                              title="View"
                            >
                              <FaEye size={12} />
                            </button>
                            {/* History button */}
                            <button
                              onClick={() => openHistory(template)}
                              className={`p-1.5 rounded-lg transition-all flex items-center gap-0.5 ${isHistoryOpen ? "bg-indigo-200 text-indigo-700" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"}`}
                              title="Change History"
                            >
                              <FaHistory size={12} />
                              <FaChevronRight
                                size={7}
                                className={`transition-transform ${isHistoryOpen ? "rotate-90" : ""}`}
                              />
                            </button>
                            {canCreateEdit && (
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
                            )}
                            {canCreateEdit && (
                              <>
                                {activeTab !== "draft" && (
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
                                )}
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

                      {/* Inline history row */}
                      {isHistoryOpen && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-6 py-4 bg-indigo-50/20 border-t border-indigo-100"
                          >
                            <TemplateHistoryPanel
                              templateId={template.id}
                              isOpen={isHistoryOpen}
                              variant="inline-list"
                              title={`Change Log — ${template.name}`}
                            />
                          </td>
                        </tr>
                      )}

                      {/* Version history row — shown when the "Version History" toggle
                          is on and the backend returned this template's other versions */}
                      {showVersionHistory && template.versions?.length > 1 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 bg-blue-50/20 border-t border-blue-100">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                              <FaCodeBranch size={10} /> All Versions — {template.name}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {template.versions.map((v) => (
                                <button
                                  key={v.Version}
                                  onClick={() => navigate(`/auditreport/templates/${template.id}/compare?to=${v.Version}`)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                    v.IsActiveVersion
                                      ? "bg-green-50 border-green-200 text-green-700"
                                      : "bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-700"
                                  }`}
                                  title={`Created by ${v.CreatedBy || "—"} on ${v.CreatedAt ? new Date(v.CreatedAt).toLocaleString() : "—"}`}
                                >
                                  <span className="font-bold">v{v.Version}</span>
                                  <span>{v.ApprovalStatus}</span>
                                  {v.IsActiveVersion && <FaCheckCircle size={9} />}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
