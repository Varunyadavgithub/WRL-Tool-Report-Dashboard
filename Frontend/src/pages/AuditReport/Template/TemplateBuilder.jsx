import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaFileAlt,
  FaPlus,
  FaTrash,
  FaSave,
  FaArrowUp,
  FaArrowDown,
  FaEye,
  FaEyeSlash,
  FaColumns,
  FaTimes,
  FaCopy,
  FaGripVertical,
  FaInfoCircle,
  FaImage,
  FaChevronDown,
  FaChevronUp,
  FaArrowLeft,
  FaLayerGroup,
  FaClipboardList,
  FaCheckDouble,
  FaKeyboard,
  FaCloudUploadAlt,
  FaTags,
  FaSearch,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import {
  MdAddCircle,
  MdOutlineFactCheck,
  MdDragIndicator,
} from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";

// ==================== STABLE ID GENERATOR ====================
// Fixes the Date.now() collision bug when multiple IDs are created synchronously
let _idSeq = 0;
const genId = () => `${Date.now()}_${++_idSeq}`;

// ==================== DEFAULT STATE FACTORIES ====================
const makeCheckpoint = () => ({
  id: genId(),
  checkPoint: "",
  method: "",
  specification: "",
});
const makeStage = () => ({
  id: genId(),
  stageName: "",
  checkPoints: [makeCheckpoint()],
});
const makeSection = () => ({
  id: genId(),
  sectionName: "",
  stages: [makeStage()],
});

// ==================== CONSTANTS ====================
const DEFAULT_COLUMNS = [
  {
    id: "section",
    name: "Section",
    visible: true,
    required: true,
    width: "w-32",
    type: "text",
    isGroupColumn: true,
  },
  {
    id: "stage",
    name: "Stage",
    visible: true,
    required: true,
    width: "w-32",
    type: "text",
    isGroupColumn: true,
  },
  {
    id: "checkPoint",
    name: "Check Points",
    visible: true,
    required: false,
    width: "w-40",
    type: "text",
  },
  {
    id: "method",
    name: "Method of Inspection",
    visible: true,
    required: false,
    width: "w-40",
    type: "text",
  },
  {
    id: "specification",
    name: "Specifications",
    visible: true,
    required: false,
    width: "w-48",
    type: "text",
  },
  {
    id: "observation",
    name: "Observations",
    visible: true,
    required: false,
    width: "w-40",
    type: "text",
    entryField: true,
  },
  {
    id: "image",
    name: "Image",
    visible: true,
    required: false,
    width: "w-36",
    type: "image",
    entryField: true,
  },
  {
    id: "remark",
    name: "Remark",
    visible: true,
    required: false,
    width: "w-40",
    type: "text",
    entryField: true,
  },
  {
    id: "status",
    name: "Status",
    visible: true,
    required: false,
    width: "w-28",
    type: "status",
    entryField: true,
  },
];

const DEFAULT_INFO_FIELDS = [
  {
    id: "modelName",
    name: "Model Name",
    type: "text",
    required: true,
    visible: true,
  },
  { id: "date", name: "Date", type: "date", required: true, visible: true },
  {
    id: "shift",
    name: "Shift",
    type: "select",
    required: true,
    visible: true,
    options: ["Day Shift", "Night Shift"],
  },
  {
    id: "serial",
    name: "Serial No.",
    type: "text",
    required: true,
    visible: true,
  },
];

const COLUMN_WIDTHS = [
  "w-20",
  "w-24",
  "w-28",
  "w-32",
  "w-36",
  "w-40",
  "w-48",
  "w-56",
  "w-64",
  "w-80",
];

const FIELD_TYPES = ["text", "date", "select", "number", "time"];
const COLUMN_TYPES = ["text", "number", "status", "date", "image"];
const CATEGORIES = [
  { value: "", label: "Select Category" },
  { value: "process", label: "Process Audit" },
  { value: "quality", label: "Quality Audit" },
  { value: "safety", label: "Safety Audit" },
  { value: "other", label: "Other" },
];

// ==================== SUB-COMPONENTS ====================
const Badge = ({ children, color = "gray" }) => {
  const colors = {
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-green-100 text-green-700 border-green-200",
    orange: "bg-orange-100 text-orange-700 border-orange-200",
    pink: "bg-pink-100 text-pink-700 border-pink-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color]}`}
    >
      {children}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div
    className={`flex items-center gap-3 bg-white rounded-xl border px-4 py-3 shadow-sm ${color}`}
  >
    <Icon className="text-lg flex-shrink-0" />
    <div>
      <div className="text-xl font-black text-gray-800 leading-none">
        {value}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  </div>
);

const IconBtn = ({
  icon: Icon,
  onClick,
  title,
  disabled,
  color = "gray",
  size = 11,
}) => {
  const colors = {
    gray: "bg-gray-100 hover:bg-gray-200 text-gray-500",
    blue: "bg-blue-100 hover:bg-blue-200 text-blue-600",
    green: "bg-green-100 hover:bg-green-200 text-green-600",
    red: "bg-red-100 hover:bg-red-200 text-red-600",
    purple: "bg-purple-100 hover:bg-purple-200 text-purple-600",
    indigo: "bg-indigo-100 hover:bg-indigo-200 text-indigo-600",
    amber: "bg-amber-100 hover:bg-amber-200 text-amber-600",
  };
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 ${colors[color]}`}
    >
      <Icon size={size} />
    </button>
  );
};

// ==================== MAIN COMPONENT ====================
const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { createTemplate, updateTemplate, getTemplateById } = useAuditData();

  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showInfoFieldManager, setShowInfoFieldManager] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: "", type: "text" });
  const [sectionSearch, setSectionSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [collapsedStages, setCollapsedStages] = useState({});
  const [hasDraft, setHasDraft] = useState(false);
  const newColInputRef = useRef(null);

  // ==================== Template state ====================
  const [templateMeta, setTemplateMeta] = useState({
    name: "",
    description: "",
    category: "",
    version: "1.0",
    isActive: true,
  });
  const [headerConfig, setHeaderConfig] = useState({
    showFormatNo: true,
    showRevNo: true,
    showRevDate: true,
    defaultFormatNo: "",
    defaultRevNo: "",
  });
  const [infoFields, setInfoFields] = useState(DEFAULT_INFO_FIELDS);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [defaultSections, setDefaultSections] = useState([makeSection()]);

  // ==================== Keyboard shortcuts ====================
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        setShowColumnManager(false);
        setShowInfoFieldManager(false);
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [templateMeta, headerConfig, infoFields, columns, defaultSections]);

  // ==================== Auto-draft to localStorage ====================
  useEffect(() => {
    if (templateMeta.name && !initialLoading) {
      const draft = {
        templateMeta,
        headerConfig,
        infoFields,
        columns,
        defaultSections,
        savedAt: Date.now(),
      };
      localStorage.setItem(
        `template_draft_${id || "new"}`,
        JSON.stringify(draft),
      );
      setHasDraft(true);
    }
  }, [templateMeta, headerConfig, infoFields, columns, defaultSections]);

  const clearDraft = () => {
    localStorage.removeItem(`template_draft_${id || "new"}`);
    setHasDraft(false);
    toast.success("Draft cleared");
  };

  // ==================== Load template ====================
  useEffect(() => {
    const loadTemplate = async () => {
      if (!id) {
        // Try loading draft for new templates
        const draft = localStorage.getItem("template_draft_new");
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            const age = Date.now() - parsed.savedAt;
            if (age < 24 * 60 * 60 * 1000) {
              // < 24h
              setHasDraft(true);
            }
          } catch {}
        }
        return;
      }
      setInitialLoading(true);
      try {
        const tmpl = await getTemplateById(id);
        if (tmpl) {
          setTemplateMeta({
            name: tmpl.name || "",
            description: tmpl.description || "",
            category: tmpl.category || "",
            version: tmpl.version || "1.0",
            isActive: tmpl.isActive !== false,
          });
          if (tmpl.headerConfig) setHeaderConfig(tmpl.headerConfig);
          if (tmpl.infoFields) setInfoFields(tmpl.infoFields);
          if (tmpl.columns) setColumns(tmpl.columns);
          if (tmpl.defaultSections) {
            setDefaultSections(
              tmpl.defaultSections.map((section) => {
                if (section.stages) return section;
                return {
                  id: section.id || genId(),
                  sectionName: section.sectionName,
                  stages: [
                    {
                      id: genId(),
                      stageName: section.stageName || "",
                      checkPoints: section.checkPoints || [],
                    },
                  ],
                };
              }),
            );
          }
        }
      } catch (err) {
        toast.error("Failed to load template: " + err.message);
        navigate("/auditreport/templates");
      } finally {
        setInitialLoading(false);
      }
    };
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ==================== Stats ====================
  const stats = useMemo(() => {
    let stages = 0,
      checkpoints = 0;
    defaultSections.forEach((s) => {
      stages += s.stages?.length || 0;
      s.stages?.forEach((st) => {
        checkpoints += st.checkPoints?.length || 0;
      });
    });
    return {
      sections: defaultSections.length,
      stages,
      checkpoints,
      visibleCols: columns.filter((c) => c.visible).length,
    };
  }, [defaultSections, columns]);

  // ==================== Section CRUD ====================
  const addSection = () => {
    const s = makeSection();
    setDefaultSections((prev) => [...prev, s]);
    setTimeout(() => document.getElementById(`sec-input-${s.id}`)?.focus(), 50);
  };

  const deleteSection = (sectionId) => {
    if (defaultSections.length <= 1) {
      toast.error("At least one section required");
      return;
    }
    setDefaultSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const duplicateSection = (sectionId) => {
    const src = defaultSections.find((s) => s.id === sectionId);
    if (!src) return;
    const dup = {
      ...src,
      id: genId(),
      sectionName: `${src.sectionName} (Copy)`,
      stages: src.stages.map((st) => ({
        ...st,
        id: genId(),
        checkPoints: st.checkPoints.map((cp) => ({ ...cp, id: genId() })),
      })),
    };
    setDefaultSections((prev) => [...prev, dup]);
    toast.success("Section duplicated");
  };

  const moveSection = (index, dir) => {
    setDefaultSections((prev) => {
      const arr = [...prev];
      const ni = dir === "up" ? index - 1 : index + 1;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[index], arr[ni]] = [arr[ni], arr[index]];
      return arr;
    });
  };

  const updateSectionName = (sectionId, value) => {
    setDefaultSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, sectionName: value } : s)),
    );
  };

  // ==================== Stage CRUD ====================
  const addStage = (sectionId) => {
    const st = makeStage();
    setDefaultSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, stages: [...s.stages, st] } : s,
      ),
    );
    setTimeout(
      () => document.getElementById(`stage-input-${st.id}`)?.focus(),
      50,
    );
  };

  const deleteStage = (sectionId, stageId) => {
    setDefaultSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        if (s.stages.length <= 1) {
          toast.error("At least one stage required");
          return s;
        }
        return { ...s, stages: s.stages.filter((st) => st.id !== stageId) };
      }),
    );
  };

  const duplicateStage = (sectionId, stageId) => {
    setDefaultSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const src = s.stages.find((st) => st.id === stageId);
        if (!src) return s;
        const dup = {
          ...src,
          id: genId(),
          stageName: `${src.stageName} (Copy)`,
          checkPoints: src.checkPoints.map((cp) => ({ ...cp, id: genId() })),
        };
        return { ...s, stages: [...s.stages, dup] };
      }),
    );
  };

  const moveStage = (sectionId, stageIndex, dir) => {
    setDefaultSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const arr = [...s.stages];
        const ni = dir === "up" ? stageIndex - 1 : stageIndex + 1;
        if (ni < 0 || ni >= arr.length) return s;
        [arr[stageIndex], arr[ni]] = [arr[ni], arr[stageIndex]];
        return { ...s, stages: arr };
      }),
    );
  };

  const updateStageName = (sectionId, stageId, value) => {
    setDefaultSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              stages: s.stages.map((st) =>
                st.id === stageId ? { ...st, stageName: value } : st,
              ),
            },
      ),
    );
  };

  // ==================== Checkpoint CRUD ====================
  const addCheckpoint = (sectionId, stageId) => {
    const cp = makeCheckpoint();
    setDefaultSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              stages: s.stages.map((st) =>
                st.id !== stageId
                  ? st
                  : { ...st, checkPoints: [...st.checkPoints, cp] },
              ),
            },
      ),
    );
  };

  const deleteCheckpoint = (sectionId, stageId, cpId) => {
    setDefaultSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              stages: s.stages.map((st) => {
                if (st.id !== stageId) return st;
                if (st.checkPoints.length <= 1) {
                  toast.error("At least one checkpoint required");
                  return st;
                }
                return {
                  ...st,
                  checkPoints: st.checkPoints.filter((cp) => cp.id !== cpId),
                };
              }),
            },
      ),
    );
  };

  const moveCheckpoint = (sectionId, stageId, index, dir) => {
    setDefaultSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              stages: s.stages.map((st) => {
                if (st.id !== stageId) return st;
                const arr = [...st.checkPoints];
                const ni = dir === "up" ? index - 1 : index + 1;
                if (ni < 0 || ni >= arr.length) return st;
                [arr[index], arr[ni]] = [arr[ni], arr[index]];
                return { ...st, checkPoints: arr };
              }),
            },
      ),
    );
  };

  const updateCheckpoint = (sectionId, stageId, cpId, field, value) => {
    setDefaultSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              stages: s.stages.map((st) =>
                st.id !== stageId
                  ? st
                  : {
                      ...st,
                      checkPoints: st.checkPoints.map((cp) =>
                        cp.id !== cpId ? cp : { ...cp, [field]: value },
                      ),
                    },
              ),
            },
      ),
    );
  };

  // Bulk paste checkpoints — newline separated
  const handleBulkPaste = (sectionId, stageId, text) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return; // single line = normal paste
    const newCPs = lines.map((line) => ({
      ...makeCheckpoint(),
      checkPoint: line,
    }));
    setDefaultSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              stages: s.stages.map((st) =>
                st.id !== stageId
                  ? st
                  : {
                      ...st,
                      checkPoints: [
                        ...st.checkPoints.filter((cp) => cp.checkPoint),
                        ...newCPs,
                      ],
                    },
              ),
            },
      ),
    );
    toast.success(`Added ${lines.length} checkpoints from paste`);
  };

  // ==================== Column management ====================
  const addColumn = () => {
    if (!newColumn.name.trim()) {
      toast.error("Enter a column name");
      return;
    }
    const colId =
      newColumn.name.toLowerCase().replace(/\s+/g, "_") + "_" + genId();
    setColumns((prev) => [
      ...prev,
      {
        id: colId,
        name: newColumn.name,
        visible: true,
        required: false,
        width: "w-40",
        type: newColumn.type,
        entryField: false,
      },
    ]);
    setNewColumn({ name: "", type: "text" });
    newColInputRef.current?.focus();
    toast.success(`Column "${newColumn.name}" added`);
  };

  const toggleColumnVisibility = (id) =>
    setColumns((prev) =>
      prev.map((c) =>
        c.id === id && !c.required ? { ...c, visible: !c.visible } : c,
      ),
    );
  const toggleColumnEntryField = (id) =>
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, entryField: !c.entryField } : c)),
    );
  const deleteColumn = (id) => {
    const col = columns.find((c) => c.id === id);
    if (!col || col.required) return;
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };
  const moveColumn = (index, dir) => {
    setColumns((prev) => {
      const arr = [...prev];
      const ni = dir === "up" ? index - 1 : index + 1;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[index], arr[ni]] = [arr[ni], arr[index]];
      return arr;
    });
  };
  const updateColumn = (id, updates) =>
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );

  // ==================== Info field management ====================
  const addInfoField = () =>
    setInfoFields((prev) => [
      ...prev,
      {
        id: `field_${genId()}`,
        name: "New Field",
        type: "text",
        required: false,
        visible: true,
      },
    ]);
  const updateInfoField = (id, updates) =>
    setInfoFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    );
  const deleteInfoField = (id) =>
    setInfoFields((prev) => prev.filter((f) => f.id !== id));
  const moveInfoField = (index, dir) => {
    setInfoFields((prev) => {
      const arr = [...prev];
      const ni = dir === "up" ? index - 1 : index + 1;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[index], arr[ni]] = [arr[ni], arr[index]];
      return arr;
    });
  };

  const visibleColumns = columns.filter((c) => c.visible);
  const editableColumns = visibleColumns.filter(
    (c) => !c.entryField && c.id !== "section" && c.id !== "stage",
  );

  // ==================== Filtered sections ====================
  const filteredSections = useMemo(() => {
    if (!sectionSearch.trim()) return defaultSections;
    const q = sectionSearch.toLowerCase();
    return defaultSections.filter(
      (s) =>
        s.sectionName.toLowerCase().includes(q) ||
        s.stages.some(
          (st) =>
            st.stageName.toLowerCase().includes(q) ||
            st.checkPoints.some((cp) =>
              JSON.stringify(cp).toLowerCase().includes(q),
            ),
        ),
    );
  }, [defaultSections, sectionSearch]);

  // ==================== Save ====================
  const handleSave = async () => {
    if (!templateMeta.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: templateMeta.name,
        description: templateMeta.description,
        category: templateMeta.category,
        version: templateMeta.version,
        isActive: templateMeta.isActive,
        headerConfig,
        infoFields,
        columns,
        defaultSections,
      };
      if (id) {
        await updateTemplate(id, payload);
        toast.success("Template updated ?");
      } else {
        await createTemplate(payload);
        toast.success("Template created ?");
        localStorage.removeItem("template_draft_new");
      }
      navigate("/auditreport/templates");
    } catch (err) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ==================== Loading ====================
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-gray-700">Loading template…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* ==================== KEYBOARD SHORTCUTS MODAL ==================== */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FaKeyboard className="text-indigo-500" /> Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)}>
                <FaTimes className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                ["Ctrl + S", "Save Template"],
                ["Esc", "Close Modals"],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{d}</span>
                  <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== INFO FIELD MANAGER MODAL ==================== */}
      {showInfoFieldManager && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white flex-shrink-0">
              <h3 className="text-base font-black flex items-center gap-2">
                <FaInfoCircle /> Manage Info Fields
              </h3>
              <button
                onClick={() => setShowInfoFieldManager(false)}
                className="p-1.5 hover:bg-purple-800 rounded-lg transition"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 mb-4">
                These fields appear in the audit header (Model Name, Date,
                Shift, etc.). Drag to reorder.
              </p>
              <div className="space-y-2">
                {infoFields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`rounded-xl border p-3 transition-all ${field.visible ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <MdDragIndicator className="text-gray-300 flex-shrink-0" />
                      <div className="flex gap-1 flex-col flex-shrink-0">
                        <button
                          onClick={() => moveInfoField(index, "up")}
                          disabled={index === 0}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                        >
                          <FaArrowUp size={9} />
                        </button>
                        <button
                          onClick={() => moveInfoField(index, "down")}
                          disabled={index === infoFields.length - 1}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                        >
                          <FaArrowDown size={9} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) =>
                          updateInfoField(field.id, { name: e.target.value })
                        }
                        className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-purple-400 outline-none"
                        placeholder="Field Name"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateInfoField(field.id, { type: e.target.value })
                        }
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-purple-400 outline-none"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateInfoField(field.id, {
                              required: e.target.checked,
                            })
                          }
                          className="rounded"
                        />{" "}
                        Req
                      </label>
                      <button
                        onClick={() =>
                          updateInfoField(field.id, { visible: !field.visible })
                        }
                        className={`p-1.5 rounded-lg transition ${field.visible ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                      >
                        {field.visible ? (
                          <FaEye size={12} />
                        ) : (
                          <FaEyeSlash size={12} />
                        )}
                      </button>
                      <button
                        onClick={() => deleteInfoField(field.id)}
                        className="p-1.5 bg-red-100 hover:bg-red-200 text-red-500 rounded-lg transition"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                    {/* Select options editor */}
                    {field.type === "select" && (
                      <div className="mt-2.5 pl-10">
                        <label className="text-xs text-gray-500 mb-1 block">
                          Options (one per line):
                        </label>
                        <textarea
                          value={(field.options || []).join("\n")}
                          onChange={(e) =>
                            updateInfoField(field.id, {
                              options: e.target.value
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean),
                            })
                          }
                          rows={3}
                          placeholder="Day Shift&#10;Night Shift&#10;Evening Shift"
                          className="w-full px-2 py-1.5 border border-purple-200 rounded-lg text-xs resize-none focus:border-purple-400 outline-none bg-purple-50"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          {(field.options || []).length} option(s)
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addInfoField}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all"
              >
                <FaPlus size={11} /> Add Field
              </button>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowInfoFieldManager(false)}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all"
              >
                Done ({infoFields.length} fields)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COLUMN MANAGER MODAL ==================== */}
      {showColumnManager && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex-shrink-0">
              <h3 className="text-base font-black flex items-center gap-2">
                <FaColumns /> Manage Table Columns
              </h3>
              <button
                onClick={() => setShowColumnManager(false)}
                className="p-1.5 hover:bg-indigo-800 rounded-lg transition"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {/* Add new column */}
              <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">
                  Add New Column
                </h4>
                <div className="flex gap-2">
                  <input
                    ref={newColInputRef}
                    type="text"
                    placeholder="Column name…"
                    value={newColumn.name}
                    onChange={(e) =>
                      setNewColumn((p) => ({ ...p, name: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addColumn()}
                    className="flex-1 px-3 py-2 border border-indigo-200 rounded-xl text-sm focus:border-indigo-400 outline-none bg-white"
                  />
                  <select
                    value={newColumn.type}
                    onChange={(e) =>
                      setNewColumn((p) => ({ ...p, type: e.target.value }))
                    }
                    className="px-2 py-2 border border-indigo-200 rounded-xl text-xs focus:border-indigo-400 outline-none bg-white"
                  >
                    {COLUMN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addColumn}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-1"
                  >
                    <FaPlus size={11} /> Add
                  </button>
                </div>
                <p className="text-[10px] text-indigo-400 mt-2">
                  Press Enter to add quickly
                </p>
              </div>

              <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                <strong>Entry Fields</strong> (orange) are filled by auditors
                during audit entry. Other columns are pre-filled in the
                template.
              </div>

              <div className="space-y-2">
                {columns.map((col, index) => (
                  <div
                    key={col.id}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                      !col.visible
                        ? "bg-gray-50 border-gray-100 opacity-60"
                        : col.entryField
                          ? "bg-amber-50 border-amber-200"
                          : "bg-white border-gray-200"
                    }`}
                  >
                    <MdDragIndicator className="text-gray-300 flex-shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveColumn(index, "up")}
                        disabled={index === 0}
                        className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                      >
                        <FaArrowUp size={9} />
                      </button>
                      <button
                        onClick={() => moveColumn(index, "down")}
                        disabled={index === columns.length - 1}
                        className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                      >
                        <FaArrowDown size={9} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={col.name}
                      disabled={col.required}
                      onChange={(e) =>
                        updateColumn(col.id, { name: e.target.value })
                      }
                      className="flex-1 min-w-[100px] text-sm font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 outline-none disabled:cursor-not-allowed text-gray-800"
                    />

                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      {col.required && <Badge color="blue">Required</Badge>}
                      {col.isGroupColumn && <Badge color="green">Group</Badge>}
                      {col.entryField && <Badge color="orange">Entry</Badge>}
                      {col.type === "image" && (
                        <Badge color="pink">
                          <FaImage size={8} /> Image
                        </Badge>
                      )}
                    </div>

                    <select
                      value={col.type}
                      onChange={(e) =>
                        updateColumn(col.id, { type: e.target.value })
                      }
                      className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:border-indigo-400 outline-none bg-white"
                    >
                      {COLUMN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={col.width}
                      onChange={(e) =>
                        updateColumn(col.id, { width: e.target.value })
                      }
                      className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:border-indigo-400 outline-none bg-white"
                    >
                      {COLUMN_WIDTHS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => toggleColumnEntryField(col.id)}
                      title="Toggle Entry Field"
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${col.entryField ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-gray-100 text-gray-500"}`}
                    >
                      Entry
                    </button>

                    <button
                      onClick={() => toggleColumnVisibility(col.id)}
                      disabled={col.required}
                      className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${col.visible ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                    >
                      {col.visible ? (
                        <FaEye size={12} />
                      ) : (
                        <FaEyeSlash size={12} />
                      )}
                    </button>

                    {!col.required && (
                      <button
                        onClick={() => deleteColumn(col.id)}
                        className="p-1.5 bg-red-100 hover:bg-red-200 text-red-500 rounded-lg transition"
                      >
                        <FaTrash size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowColumnManager(false)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all"
              >
                Done ({columns.filter((c) => c.visible).length} visible columns)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STICKY HEADER ==================== */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auditreport/templates")}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all"
            >
              <FaArrowLeft size={11} /> Back
            </button>
            <div className="flex items-center gap-2">
              <MdOutlineFactCheck className="text-xl text-indigo-600" />
              <div>
                <h1 className="text-sm font-black text-gray-800 leading-none">
                  {id ? "Edit Template" : "New Template"}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5 leading-none">
                  {templateMeta.name || "Untitled"}
                </p>
              </div>
            </div>

            {hasDraft && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-600 font-semibold">
                  Draft saved
                </span>
                <button
                  onClick={clearDraft}
                  className="text-amber-400 hover:text-amber-600 transition"
                >
                  <FaTimes size={10} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition"
              title="Shortcuts"
            >
              <FaKeyboard size={13} />
            </button>
            <button
              onClick={() => setShowInfoFieldManager(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-sm font-semibold transition-all"
            >
              <FaInfoCircle size={12} /> Info Fields
            </button>
            <button
              onClick={() => setShowColumnManager(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold transition-all"
            >
              <FaColumns size={12} /> Columns
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md shadow-indigo-200"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                  Saving…
                </>
              ) : (
                <>
                  <FaSave size={12} /> Save Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-5 space-y-4">
        {/* ==================== STATS ROW ==================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={FaLayerGroup}
            label="Sections"
            value={stats.sections}
            color="border-slate-200 text-slate-500"
          />
          <StatCard
            icon={FaTags}
            label="Stages"
            value={stats.stages}
            color="border-indigo-200 text-indigo-500"
          />
          <StatCard
            icon={FaClipboardList}
            label="Checkpoints"
            value={stats.checkpoints}
            color="border-green-200 text-green-600"
          />
          <StatCard
            icon={FaColumns}
            label="Visible Cols"
            value={stats.visibleCols}
            color="border-amber-200 text-amber-600"
          />
        </div>

        {/* ==================== TEMPLATE META + HEADER CONFIG ==================== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Meta */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaFileAlt className="text-indigo-500" /> Template Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateMeta.name}
                  onChange={(e) =>
                    setTemplateMeta((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g., Assembly Line Quality Check v2"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-sm transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Category
                </label>
                <select
                  value={templateMeta.category}
                  onChange={(e) =>
                    setTemplateMeta((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-sm transition-all"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Version
                </label>
                <input
                  type="text"
                  value={templateMeta.version}
                  onChange={(e) =>
                    setTemplateMeta((p) => ({ ...p, version: e.target.value }))
                  }
                  placeholder="1.0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-sm transition-all"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Description
                </label>
                <textarea
                  value={templateMeta.description}
                  onChange={(e) =>
                    setTemplateMeta((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Describe what this template is used for…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-sm resize-none transition-all"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${templateMeta.isActive ? "bg-indigo-500" : "bg-gray-300"}`}
                    onClick={() =>
                      setTemplateMeta((p) => ({ ...p, isActive: !p.isActive }))
                    }
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${templateMeta.isActive ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    Active Template
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${templateMeta.isActive ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {templateMeta.isActive ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Header config */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaFileAlt className="text-indigo-500" /> Header Configuration
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: "Show Format No", key: "showFormatNo" },
                { label: "Show Rev No", key: "showRevNo" },
                { label: "Show Rev Date", key: "showRevDate" },
              ].map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${headerConfig[item.key] ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-200"}`}
                >
                  <input
                    type="checkbox"
                    checked={headerConfig[item.key]}
                    onChange={(e) =>
                      setHeaderConfig((p) => ({
                        ...p,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Default Format No
                </label>
                <input
                  type="text"
                  value={headerConfig.defaultFormatNo}
                  onChange={(e) =>
                    setHeaderConfig((p) => ({
                      ...p,
                      defaultFormatNo: e.target.value,
                    }))
                  }
                  placeholder="QA-001"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-sm transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Default Rev No
                </label>
                <input
                  type="text"
                  value={headerConfig.defaultRevNo}
                  onChange={(e) =>
                    setHeaderConfig((p) => ({
                      ...p,
                      defaultRevNo: e.target.value,
                    }))
                  }
                  placeholder="01"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-sm transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ==================== SECTION BUILDER ==================== */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Builder header */}
          <div className="px-5 py-4 bg-gradient-to-br from-slate-800 to-indigo-900 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HiClipboardDocumentCheck className="text-2xl" />
                <div>
                  <h2 className="font-black text-lg leading-none">
                    {templateMeta.name || "Template Preview"}
                  </h2>
                  <p className="text-indigo-300 text-xs mt-1">
                    {stats.sections} sections · {stats.stages} stages ·{" "}
                    {stats.checkpoints} checkpoints
                  </p>
                </div>
              </div>
              {/* Search */}
              <div className="relative hidden sm:block">
                <FaSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300"
                  size={11}
                />
                <input
                  type="text"
                  placeholder="Search sections…"
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-white/10 border border-white/20 text-white placeholder-indigo-300 rounded-xl text-sm focus:outline-none focus:bg-white/20 transition-all w-48"
                />
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-start gap-2">
            <FaInfoCircle
              className="text-indigo-500 mt-0.5 flex-shrink-0"
              size={13}
            />
            <div className="text-xs text-indigo-700">
              <span className="font-semibold">Builder tip:</span> Add sections ?
              stages ? checkpoints.{" "}
              <span className="font-semibold">Entry Field</span> columns
              (highlighted in amber) are filled by auditors. Paste multiple
              lines into a checkpoint field to bulk-add checkpoints.
            </div>
          </div>

          {/* Column header strip */}
          <div className="overflow-x-auto border-b border-gray-200">
            <div className="flex bg-slate-700 text-white min-w-max">
              {visibleColumns.map((col) => (
                <div
                  key={col.id}
                  className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border-r border-slate-600 flex-shrink-0 ${col.width} ${col.entryField ? "bg-slate-600" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    {col.type === "image" && (
                      <FaImage size={10} className="text-pink-300" />
                    )}
                    {col.name}
                    {col.entryField && col.type !== "image" && (
                      <span className="text-amber-300 text-[9px]">(Entry)</span>
                    )}
                  </div>
                </div>
              ))}
              <div className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide w-28 text-center flex-shrink-0">
                Actions
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="divide-y divide-gray-100">
            {filteredSections.map((section, sectionIndex) => {
              const realIndex = defaultSections.findIndex(
                (s) => s.id === section.id,
              );
              const isCollapsed = collapsedSections[section.id];
              const cpCount = section.stages.reduce(
                (t, st) => t + st.checkPoints.length,
                0,
              );

              return (
                <div
                  key={section.id}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  {/* Section header row */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border-b border-slate-200 sticky top-[57px] z-10">
                    <button
                      onClick={() =>
                        setCollapsedSections((p) => ({
                          ...p,
                          [section.id]: !p[section.id],
                        }))
                      }
                      className="p-1 hover:bg-slate-200 rounded-lg transition flex-shrink-0"
                    >
                      {isCollapsed ? (
                        <FaChevronDown size={11} className="text-slate-500" />
                      ) : (
                        <FaChevronUp size={11} className="text-slate-500" />
                      )}
                    </button>

                    <input
                      id={`sec-input-${section.id}`}
                      type="text"
                      value={section.sectionName}
                      onChange={(e) =>
                        updateSectionName(section.id, e.target.value)
                      }
                      placeholder="Section Name…"
                      className="flex-1 min-w-0 font-bold text-slate-800 bg-transparent border-b-2 border-transparent focus:border-indigo-400 outline-none py-0.5 text-sm transition-colors"
                    />

                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {section.stages.length} stage
                      {section.stages.length !== 1 ? "s" : ""} · {cpCount}{" "}
                      checkpoints
                    </span>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <IconBtn
                        icon={FaPlus}
                        onClick={() => addStage(section.id)}
                        title="Add Stage"
                        color="indigo"
                      />
                      <IconBtn
                        icon={FaCopy}
                        onClick={() => duplicateSection(section.id)}
                        title="Duplicate Section"
                        color="purple"
                      />
                      <IconBtn
                        icon={FaArrowUp}
                        onClick={() => moveSection(realIndex, "up")}
                        title="Move Up"
                        color="blue"
                        disabled={realIndex === 0}
                      />
                      <IconBtn
                        icon={FaArrowDown}
                        onClick={() => moveSection(realIndex, "down")}
                        title="Move Down"
                        color="blue"
                        disabled={realIndex === defaultSections.length - 1}
                      />
                      <IconBtn
                        icon={FaTrash}
                        onClick={() => deleteSection(section.id)}
                        title="Delete Section"
                        color="red"
                        disabled={defaultSections.length <= 1}
                      />
                    </div>
                  </div>

                  {/* Stages */}
                  {!isCollapsed &&
                    section.stages.map((stage, stageIndex) => {
                      const isStageCollapsed = collapsedStages[stage.id];
                      return (
                        <div
                          key={stage.id}
                          className="border-b border-gray-100 last:border-b-0"
                        >
                          {/* Stage header row */}
                          <div className="flex items-center gap-2 px-6 py-2 bg-indigo-50/60 border-b border-indigo-100">
                            <button
                              onClick={() =>
                                setCollapsedStages((p) => ({
                                  ...p,
                                  [stage.id]: !p[stage.id],
                                }))
                              }
                              className="p-1 hover:bg-indigo-100 rounded-lg transition flex-shrink-0"
                            >
                              {isStageCollapsed ? (
                                <FaChevronDown
                                  size={10}
                                  className="text-indigo-400"
                                />
                              ) : (
                                <FaChevronUp
                                  size={10}
                                  className="text-indigo-400"
                                />
                              )}
                            </button>

                            <input
                              id={`stage-input-${stage.id}`}
                              type="text"
                              value={stage.stageName}
                              onChange={(e) =>
                                updateStageName(
                                  section.id,
                                  stage.id,
                                  e.target.value,
                                )
                              }
                              placeholder="Stage Name…"
                              className="flex-1 min-w-0 font-semibold text-indigo-800 bg-transparent border-b-2 border-transparent focus:border-indigo-400 outline-none py-0.5 text-xs transition-colors"
                            />

                            <span className="text-[10px] text-indigo-400 flex-shrink-0">
                              {stage.checkPoints.length} checkpoint
                              {stage.checkPoints.length !== 1 ? "s" : ""}
                            </span>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <IconBtn
                                icon={FaPlus}
                                onClick={() =>
                                  addCheckpoint(section.id, stage.id)
                                }
                                title="Add Checkpoint"
                                color="green"
                                size={10}
                              />
                              <IconBtn
                                icon={FaCopy}
                                onClick={() =>
                                  duplicateStage(section.id, stage.id)
                                }
                                title="Duplicate Stage"
                                color="purple"
                                size={10}
                              />
                              <IconBtn
                                icon={FaArrowUp}
                                onClick={() =>
                                  moveStage(section.id, stageIndex, "up")
                                }
                                title="Move Up"
                                color="blue"
                                size={10}
                                disabled={stageIndex === 0}
                              />
                              <IconBtn
                                icon={FaArrowDown}
                                onClick={() =>
                                  moveStage(section.id, stageIndex, "down")
                                }
                                title="Move Down"
                                color="blue"
                                size={10}
                                disabled={
                                  stageIndex === section.stages.length - 1
                                }
                              />
                              <IconBtn
                                icon={FaTrash}
                                onClick={() =>
                                  deleteStage(section.id, stage.id)
                                }
                                title="Delete Stage"
                                color="red"
                                size={10}
                                disabled={section.stages.length <= 1}
                              />
                            </div>
                          </div>

                          {/* Checkpoints table */}
                          {!isStageCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <tbody>
                                  {stage.checkPoints.map((cp, cpIndex) => (
                                    <tr
                                      key={cp.id}
                                      className="border-b border-gray-100 last:border-b-0 hover:bg-slate-50/50 transition-colors group"
                                    >
                                      {visibleColumns.map((col) => {
                                        // Section column — show static label
                                        if (col.id === "section") {
                                          return (
                                            <td
                                              key={col.id}
                                              className={`px-3 py-2 border-r border-gray-100 bg-slate-50 align-middle text-center ${col.width}`}
                                            >
                                              {cpIndex === 0 &&
                                              stageIndex === 0 ? (
                                                <span
                                                  className="text-xs text-slate-500 font-semibold truncate block max-w-[80px]"
                                                  title={section.sectionName}
                                                >
                                                  {section.sectionName || (
                                                    <span className="text-gray-300 italic">
                                                      Section
                                                    </span>
                                                  )}
                                                </span>
                                              ) : null}
                                            </td>
                                          );
                                        }

                                        // Stage column — show static label
                                        if (col.id === "stage") {
                                          return (
                                            <td
                                              key={col.id}
                                              className={`px-3 py-2 border-r border-gray-100 bg-indigo-50/40 align-middle text-center ${col.width}`}
                                            >
                                              {cpIndex === 0 ? (
                                                <span
                                                  className="text-xs text-indigo-600 font-semibold truncate block max-w-[80px]"
                                                  title={stage.stageName}
                                                >
                                                  {stage.stageName || (
                                                    <span className="text-gray-300 italic">
                                                      Stage
                                                    </span>
                                                  )}
                                                </span>
                                              ) : null}
                                            </td>
                                          );
                                        }

                                        // Entry fields — placeholder
                                        if (col.entryField) {
                                          return (
                                            <td
                                              key={col.id}
                                              className={`px-3 py-2 border-r border-gray-100 bg-amber-50/50 ${col.width}`}
                                            >
                                              {col.type === "image" ? (
                                                <div className="flex items-center justify-center gap-1 text-gray-300">
                                                  <FaImage size={12} />
                                                  <span className="text-[10px] italic">
                                                    Upload in audit
                                                  </span>
                                                </div>
                                              ) : (
                                                <span className="text-[10px] text-gray-300 italic">
                                                  {col.type === "status"
                                                    ? "Pass/Fail/Warn"
                                                    : "Entry in audit"}
                                                </span>
                                              )}
                                            </td>
                                          );
                                        }

                                        // Editable checkpoint fields
                                        return (
                                          <td
                                            key={col.id}
                                            className={`px-2 py-1.5 border-r border-gray-100 ${col.width}`}
                                          >
                                            <input
                                              type="text"
                                              placeholder={col.name}
                                              value={cp[col.id] || ""}
                                              onChange={(e) =>
                                                updateCheckpoint(
                                                  section.id,
                                                  stage.id,
                                                  cp.id,
                                                  col.id,
                                                  e.target.value,
                                                )
                                              }
                                              onPaste={(e) => {
                                                if (col.id === "checkPoint") {
                                                  const text =
                                                    e.clipboardData.getData(
                                                      "text",
                                                    );
                                                  if (text.includes("\n")) {
                                                    e.preventDefault();
                                                    handleBulkPaste(
                                                      section.id,
                                                      stage.id,
                                                      text,
                                                    );
                                                  }
                                                }
                                              }}
                                              className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                            />
                                          </td>
                                        );
                                      })}

                                      {/* Actions */}
                                      <td className="px-2 py-2 w-28">
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <IconBtn
                                            icon={FaArrowUp}
                                            onClick={() =>
                                              moveCheckpoint(
                                                section.id,
                                                stage.id,
                                                cpIndex,
                                                "up",
                                              )
                                            }
                                            disabled={cpIndex === 0}
                                            color="blue"
                                            size={10}
                                            title="Move Up"
                                          />
                                          <IconBtn
                                            icon={FaArrowDown}
                                            onClick={() =>
                                              moveCheckpoint(
                                                section.id,
                                                stage.id,
                                                cpIndex,
                                                "down",
                                              )
                                            }
                                            disabled={
                                              cpIndex ===
                                              stage.checkPoints.length - 1
                                            }
                                            color="blue"
                                            size={10}
                                            title="Move Down"
                                          />
                                          <IconBtn
                                            icon={FaTrash}
                                            onClick={() =>
                                              deleteCheckpoint(
                                                section.id,
                                                stage.id,
                                                cp.id,
                                              )
                                            }
                                            disabled={
                                              stage.checkPoints.length <= 1
                                            }
                                            color="red"
                                            size={10}
                                            title="Delete"
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {/* Add checkpoint button */}
                              <div className="px-6 py-2 bg-gray-50/50 border-t border-gray-100">
                                <button
                                  onClick={() =>
                                    addCheckpoint(section.id, stage.id)
                                  }
                                  className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
                                >
                                  <FaPlus size={9} /> Add checkpoint
                                  <span className="text-gray-300 font-normal ml-1">
                                    · or paste multiple lines
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="py-12 text-center">
                <FaSearch className="text-3xl text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  No sections match your search
                </p>
              </div>
            )}
          </div>

          {/* Add section footer */}
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={addSection}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200"
            >
              <MdAddCircle size={16} /> Add New Section
            </button>
            <div className="text-xs text-gray-400">
              Ctrl+S to save · Tip: paste multiple lines into a checkpoint to
              bulk-add
            </div>
          </div>
        </div>

        {/* Bottom save button */}
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-base transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                Saving…
              </>
            ) : (
              <>
                <FaSave size={14} />{" "}
                {id ? "Update Template" : "Create Template"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateBuilder;
