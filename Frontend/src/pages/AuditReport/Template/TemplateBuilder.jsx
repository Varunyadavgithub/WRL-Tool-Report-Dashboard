import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaFileAlt, FaPlus, FaTrash, FaSave, FaArrowUp, FaArrowDown,
  FaEye, FaEyeSlash, FaColumns, FaTimes, FaCopy, FaGripVertical,
  FaInfoCircle, FaImage, FaChevronDown, FaChevronUp, FaArrowLeft,
  FaLayerGroup, FaClipboardList, FaCheckDouble, FaKeyboard,
  FaCloudUploadAlt, FaTags, FaSearch, FaToggleOn, FaToggleOff,
  FaChevronRight, FaBars, FaUndo, FaRedo, FaExpand, FaCompress,
  FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaBan,
} from "react-icons/fa";
import { MdAddCircle, MdOutlineFactCheck, MdDragIndicator } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";

let _idSeq = 0;
const genId = () => `${Date.now()}_${++_idSeq}`;

const makeCheckpoint = () => ({ id: genId(), checkPoint: "", method: "", specification: "" });
const makeStage = () => ({ id: genId(), stageName: "", checkPoints: [makeCheckpoint()] });
const makeSection = () => ({ id: genId(), sectionName: "", stages: [makeStage()] });

const DEFAULT_COLUMNS = [
  { id: "section", name: "Section", visible: true, required: true, width: "w-36", type: "text", isGroupColumn: true },
  { id: "stage", name: "Stage", visible: true, required: true, width: "w-36", type: "text", isGroupColumn: true },
  { id: "checkPoint", name: "Check Points", visible: true, required: false, width: "w-48", type: "text" },
  { id: "method", name: "Method of Inspection", visible: true, required: false, width: "w-44", type: "text" },
  { id: "specification", name: "Specifications", visible: true, required: false, width: "w-48", type: "text" },
  { id: "observation", name: "Observations", visible: true, required: false, width: "w-44", type: "text", entryField: true },
  { id: "image", name: "Image", visible: true, required: false, width: "w-36", type: "image", entryField: true },
  { id: "remark", name: "Remark", visible: true, required: false, width: "w-40", type: "text", entryField: true },
  { id: "status", name: "Status", visible: true, required: false, width: "w-28", type: "status", entryField: true },
];

const DEFAULT_INFO_FIELDS = [
  { id: "modelName", name: "Model Name", type: "text", required: true, visible: true },
  { id: "date", name: "Date", type: "date", required: true, visible: true },
  { id: "shift", name: "Shift", type: "select", required: true, visible: true, options: ["Day Shift", "Night Shift"] },
  { id: "serial", name: "Serial No.", type: "text", required: true, visible: true },
];

const COLUMN_WIDTHS = ["w-20", "w-24", "w-28", "w-32", "w-36", "w-40", "w-44", "w-48", "w-56", "w-64", "w-80"];
const FIELD_TYPES = ["text", "date", "select", "number", "time"];
const COLUMN_TYPES = ["text", "number", "status", "date", "image"];
const CATEGORIES = [
  { value: "", label: "Select Category" },
  { value: "process", label: "Process Audit" },
  { value: "quality", label: "Quality Audit" },
  { value: "safety", label: "Safety Audit" },
  { value: "other", label: "Other" },
];

const Badge = ({ children, color = "gray" }) => {
  const colors = {
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-green-100 text-green-700 border-green-200",
    orange: "bg-orange-100 text-orange-700 border-orange-200",
    pink: "bg-pink-100 text-pink-700 border-pink-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color]}`}>{children}</span>;
};

const IconBtn = ({ icon: Icon, onClick, title, disabled, color = "gray", size = 11, active }) => {
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
    <button onClick={onClick} title={title} disabled={disabled}
      className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 ${active ? "ring-2 ring-indigo-400" : ""} ${colors[color]}`}>
      <Icon size={size} />
    </button>
  );
};

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { createTemplate, updateTemplate, getTemplateById } = useAuditData();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("meta");
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
  const [dragState, setDragState] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const newColInputRef = useRef(null);

  const [templateMeta, setTemplateMeta] = useState({ name: "", description: "", category: "", version: "1.0", isActive: true });
  const [headerConfig, setHeaderConfig] = useState({ showFormatNo: true, showRevNo: true, showRevDate: true, defaultFormatNo: "", defaultRevNo: "" });
  const [infoFields, setInfoFields] = useState(DEFAULT_INFO_FIELDS);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [defaultSections, setDefaultSections] = useState([makeSection()]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), { templateMeta, headerConfig, infoFields, columns, defaultSections }]);
    setRedoStack([]);
  }, [templateMeta, headerConfig, infoFields, columns, defaultSections]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, { templateMeta, headerConfig, infoFields, columns, defaultSections }]);
    setUndoStack(s => s.slice(0, -1));
    setTemplateMeta(prev.templateMeta); setHeaderConfig(prev.headerConfig);
    setInfoFields(prev.infoFields); setColumns(prev.columns); setDefaultSections(prev.defaultSections);
    toast("Undo", { icon: "\u21A9" });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(s => [...s, { templateMeta, headerConfig, infoFields, columns, defaultSections }]);
    setRedoStack(r => r.slice(0, -1));
    setTemplateMeta(next.templateMeta); setHeaderConfig(next.headerConfig);
    setInfoFields(next.infoFields); setColumns(next.columns); setDefaultSections(next.defaultSections);
    toast("Redo", { icon: "\u21AA" });
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); handleRedo(); }
      if (e.key === "Escape") { setShowColumnManager(false); setShowInfoFieldManager(false); setShowShortcuts(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); setSidebarOpen(s => !s); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [templateMeta, headerConfig, infoFields, columns, defaultSections, undoStack, redoStack]);

  useEffect(() => {
    if (templateMeta.name && !initialLoading) {
      const draft = { templateMeta, headerConfig, infoFields, columns, defaultSections, savedAt: Date.now() };
      localStorage.setItem(`template_draft_${id || "new"}`, JSON.stringify(draft));
      setHasDraft(true);
    }
  }, [templateMeta, headerConfig, infoFields, columns, defaultSections]);

  const clearDraft = () => { localStorage.removeItem(`template_draft_${id || "new"}`); setHasDraft(false); toast.success("Draft cleared"); };

  useEffect(() => {
    const loadTemplate = async () => {
      if (!id) {
        const draft = localStorage.getItem("template_draft_new");
        if (draft) { try { const p = JSON.parse(draft); if (Date.now() - p.savedAt < 86400000) setHasDraft(true); } catch {} }
        return;
      }
      setInitialLoading(true);
      try {
        const tmpl = await getTemplateById(id);
        if (tmpl) {
          setTemplateMeta({ name: tmpl.name || "", description: tmpl.description || "", category: tmpl.category || "", version: tmpl.version || "1.0", isActive: tmpl.isActive !== false });
          if (tmpl.headerConfig) setHeaderConfig(tmpl.headerConfig);
          if (tmpl.infoFields) setInfoFields(tmpl.infoFields);
          if (tmpl.columns) setColumns(tmpl.columns);
          if (tmpl.defaultSections) {
            setDefaultSections(tmpl.defaultSections.map(s => {
              if (s.stages) return s;
              return { id: s.id || genId(), sectionName: s.sectionName, stages: [{ id: genId(), stageName: s.stageName || "", checkPoints: s.checkPoints || [] }] };
            }));
          }
        }
      } catch (err) { toast.error("Failed to load template: " + err.message); navigate("/auditreport/templates"); }
      finally { setInitialLoading(false); }
    };
    loadTemplate();
  }, [id]);

  const stats = useMemo(() => {
    let stages = 0, checkpoints = 0;
    defaultSections.forEach(s => { stages += s.stages?.length || 0; s.stages?.forEach(st => { checkpoints += st.checkPoints?.length || 0; }); });
    return { sections: defaultSections.length, stages, checkpoints, visibleCols: columns.filter(c => c.visible).length };
  }, [defaultSections, columns]);

  const addSection = () => { pushUndo(); const s = makeSection(); setDefaultSections(p => [...p, s]); setTimeout(() => document.getElementById(`sec-input-${s.id}`)?.focus(), 50); };
  const deleteSection = (sectionId) => { if (defaultSections.length <= 1) { toast.error("At least one section required"); return; } pushUndo(); setDefaultSections(p => p.filter(s => s.id !== sectionId)); };
  const duplicateSection = (sectionId) => { pushUndo(); const src = defaultSections.find(s => s.id === sectionId); if (!src) return; const dup = { ...src, id: genId(), sectionName: `${src.sectionName} (Copy)`, stages: src.stages.map(st => ({ ...st, id: genId(), checkPoints: st.checkPoints.map(cp => ({ ...cp, id: genId() })) })) }; setDefaultSections(p => [...p, dup]); toast.success("Section duplicated"); };
  const moveSection = (index, dir) => { pushUndo(); setDefaultSections(p => { const arr = [...p]; const ni = dir === "up" ? index - 1 : index + 1; if (ni < 0 || ni >= arr.length) return arr; [arr[index], arr[ni]] = [arr[ni], arr[index]]; return arr; }); };
  const updateSectionName = (sectionId, value) => { setDefaultSections(p => p.map(s => s.id === sectionId ? { ...s, sectionName: value } : s)); };

  const addStage = (sectionId) => { pushUndo(); const st = makeStage(); setDefaultSections(p => p.map(s => s.id === sectionId ? { ...s, stages: [...s.stages, st] } : s)); setTimeout(() => document.getElementById(`stage-input-${st.id}`)?.focus(), 50); };
  const deleteStage = (sectionId, stageId) => { pushUndo(); setDefaultSections(p => p.map(s => { if (s.id !== sectionId) return s; if (s.stages.length <= 1) { toast.error("At least one stage required"); return s; } return { ...s, stages: s.stages.filter(st => st.id !== stageId) }; })); };
  const duplicateStage = (sectionId, stageId) => { pushUndo(); setDefaultSections(p => p.map(s => { if (s.id !== sectionId) return s; const src = s.stages.find(st => st.id === stageId); if (!src) return s; return { ...s, stages: [...s.stages, { ...src, id: genId(), stageName: `${src.stageName} (Copy)`, checkPoints: src.checkPoints.map(cp => ({ ...cp, id: genId() })) }] }; })); };
  const moveStage = (sectionId, stageIndex, dir) => { pushUndo(); setDefaultSections(p => p.map(s => { if (s.id !== sectionId) return s; const arr = [...s.stages]; const ni = dir === "up" ? stageIndex - 1 : stageIndex + 1; if (ni < 0 || ni >= arr.length) return s; [arr[stageIndex], arr[ni]] = [arr[ni], arr[stageIndex]]; return { ...s, stages: arr }; })); };
  const updateStageName = (sectionId, stageId, value) => { setDefaultSections(p => p.map(s => s.id !== sectionId ? s : { ...s, stages: s.stages.map(st => st.id === stageId ? { ...st, stageName: value } : st) })); };

  const addCheckpoint = (sectionId, stageId) => { pushUndo(); const cp = makeCheckpoint(); setDefaultSections(p => p.map(s => s.id !== sectionId ? s : { ...s, stages: s.stages.map(st => st.id !== stageId ? st : { ...st, checkPoints: [...st.checkPoints, cp] }) })); };
  const deleteCheckpoint = (sectionId, stageId, cpId) => { pushUndo(); setDefaultSections(p => p.map(s => s.id !== sectionId ? s : { ...s, stages: s.stages.map(st => { if (st.id !== stageId) return st; if (st.checkPoints.length <= 1) { toast.error("At least one checkpoint required"); return st; } return { ...st, checkPoints: st.checkPoints.filter(cp => cp.id !== cpId) }; }) })); };
  const moveCheckpoint = (sectionId, stageId, index, dir) => { pushUndo(); setDefaultSections(p => p.map(s => s.id !== sectionId ? s : { ...s, stages: s.stages.map(st => { if (st.id !== stageId) return st; const arr = [...st.checkPoints]; const ni = dir === "up" ? index - 1 : index + 1; if (ni < 0 || ni >= arr.length) return st; [arr[index], arr[ni]] = [arr[ni], arr[index]]; return { ...st, checkPoints: arr }; }) })); };
  const updateCheckpoint = (sectionId, stageId, cpId, field, value) => { setDefaultSections(p => p.map(s => s.id !== sectionId ? s : { ...s, stages: s.stages.map(st => st.id !== stageId ? st : { ...st, checkPoints: st.checkPoints.map(cp => cp.id !== cpId ? cp : { ...cp, [field]: value }) }) })); };

  const handleBulkPaste = (sectionId, stageId, text) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    pushUndo();
    const newCPs = lines.map(line => ({ ...makeCheckpoint(), checkPoint: line }));
    setDefaultSections(p => p.map(s => s.id !== sectionId ? s : { ...s, stages: s.stages.map(st => st.id !== stageId ? st : { ...st, checkPoints: [...st.checkPoints.filter(cp => cp.checkPoint), ...newCPs] }) }));
    toast.success(`Added ${lines.length} checkpoints`);
  };

  const addColumn = () => {
    if (!newColumn.name.trim()) { toast.error("Enter a column name"); return; }
    pushUndo();
    const colId = newColumn.name.toLowerCase().replace(/\s+/g, "_") + "_" + genId();
    setColumns(p => [...p, { id: colId, name: newColumn.name, visible: true, required: false, width: "w-40", type: newColumn.type, entryField: false }]);
    setNewColumn({ name: "", type: "text" }); newColInputRef.current?.focus();
    toast.success(`Column "${newColumn.name}" added`);
  };

  const toggleColumnVisibility = (id) => setColumns(p => p.map(c => c.id === id && !c.required ? { ...c, visible: !c.visible } : c));
  const toggleColumnEntryField = (id) => setColumns(p => p.map(c => c.id === id ? { ...c, entryField: !c.entryField } : c));
  const deleteColumn = (id) => { const col = columns.find(c => c.id === id); if (!col || col.required) return; pushUndo(); setColumns(p => p.filter(c => c.id !== id)); };
  const moveColumn = (index, dir) => { setColumns(p => { const arr = [...p]; const ni = dir === "up" ? index - 1 : index + 1; if (ni < 0 || ni >= arr.length) return arr; [arr[index], arr[ni]] = [arr[ni], arr[index]]; return arr; }); };
  const updateColumn = (id, updates) => setColumns(p => p.map(c => c.id === id ? { ...c, ...updates } : c));

  const addInfoField = () => { pushUndo(); setInfoFields(p => [...p, { id: `field_${genId()}`, name: "New Field", type: "text", required: false, visible: true }]); };
  const updateInfoField = (id, updates) => setInfoFields(p => p.map(f => f.id === id ? { ...f, ...updates } : f));
  const deleteInfoField = (id) => { pushUndo(); setInfoFields(p => p.filter(f => f.id !== id)); };
  const moveInfoField = (index, dir) => { setInfoFields(p => { const arr = [...p]; const ni = dir === "up" ? index - 1 : index + 1; if (ni < 0 || ni >= arr.length) return arr; [arr[index], arr[ni]] = [arr[ni], arr[index]]; return arr; }); };

  const visibleColumns = columns.filter(c => c.visible);
  const editableColumns = visibleColumns.filter(c => !c.entryField && c.id !== "section" && c.id !== "stage");

  const filteredSections = useMemo(() => {
    if (!sectionSearch.trim()) return defaultSections;
    const q = sectionSearch.toLowerCase();
    return defaultSections.filter(s => s.sectionName.toLowerCase().includes(q) || s.stages.some(st => st.stageName.toLowerCase().includes(q) || st.checkPoints.some(cp => JSON.stringify(cp).toLowerCase().includes(q))));
  }, [defaultSections, sectionSearch]);

  const handleSave = async () => {
    if (!templateMeta.name.trim()) { toast.error("Template name is required"); return; }
    setSaving(true);
    try {
      const payload = { name: templateMeta.name, description: templateMeta.description, category: templateMeta.category, version: templateMeta.version, isActive: templateMeta.isActive, headerConfig, infoFields, columns, defaultSections };
      if (id) { await updateTemplate(id, payload); toast.success("Template updated"); }
      else { await createTemplate(payload); toast.success("Template created"); localStorage.removeItem("template_draft_new"); }
      navigate("/auditreport/templates");
    } catch (err) { toast.error("Save failed: " + err.message); }
    finally { setSaving(false); }
  };

  const handleDragStart = (e, type, data) => { setDragState({ type, ...data }); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDropSection = (e, targetIndex) => { e.preventDefault(); if (!dragState || dragState.type !== "section") return; const srcIdx = dragState.index; if (srcIdx === targetIndex) return; pushUndo(); setDefaultSections(p => { const arr = [...p]; const [item] = arr.splice(srcIdx, 1); arr.splice(targetIndex, 0, item); return arr; }); setDragState(null); };
  const handleDropStage = (e, sectionId, targetIndex) => { e.preventDefault(); if (!dragState || dragState.type !== "stage" || dragState.sectionId !== sectionId) return; pushUndo(); setDefaultSections(p => p.map(s => { if (s.id !== sectionId) return s; const arr = [...s.stages]; const [item] = arr.splice(dragState.index, 1); arr.splice(targetIndex, 0, item); return { ...s, stages: arr }; })); setDragState(null); };

  if (initialLoading) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-gray-700">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
