import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaIdBadge,
  FaStickyNote,
  FaClipboardCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaArrowLeft,
  FaPaperPlane,
  FaEye,
  FaEdit,
  FaUserCheck,
  FaUserShield,
  FaBarcode,
  FaImage,
  FaCloudUploadAlt,
  FaSearchPlus,
  FaTimes,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaSearch,
  FaFilter,
  FaBolt,
  FaSave,
  FaPrint,
  FaKeyboard,
  FaCheckDouble,
  FaBan,
} from "react-icons/fa";
import {
  MdFormatListNumbered,
  MdUpdate,
  MdDateRange,
  MdDragIndicator,
} from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../../hooks/useAuditData.js";
import { useGetModelVariantsByAssemblyQuery } from "../../../redux/api/commonApi.js";
import toast from "react-hot-toast";
import { getCurrentShift } from "../../../utils/shiftUtils.js";
import { baseURL } from "../../../assets/assets.js";

// ==================== CONSTANTS ====================
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const STATUS_CONFIG = {
  pass: {
    label: "Pass",
    color: "green",
    icon: FaCheckCircle,
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
  },
  fail: {
    label: "Fail",
    color: "red",
    icon: FaTimesCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
  },
  warning: {
    label: "Warning",
    color: "amber",
    icon: FaExclamationTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  na: {
    label: "N/A",
    color: "blue",
    icon: FaBan,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  pending: {
    label: "Pending",
    color: "gray",
    icon: FaClipboardCheck,
    bg: "",
    border: "border-gray-200",
    text: "text-gray-500",
    badge: "bg-gray-100 text-gray-600",
  },
};

const getCurrentDate = () => new Date().toISOString().split("T")[0];

const formatDateForDisplay = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  } catch {
    return "-";
  }
};

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// ==================== SUB-COMPONENTS ====================

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
    >
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const ProgressBar = ({ summary }) => {
  const done = summary.pass + summary.fail + summary.warning + summary.na;
  const pct = summary.total > 0 ? Math.round((done / summary.total) * 100) : 0;
  const passRate = done > 0 ? Math.round((summary.pass / done) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Completion
        </span>
        <span className="text-2xl font-black text-gray-800">
          {pct}
          <span className="text-sm text-gray-400">%</span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-indigo-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-5 gap-1 text-center">
        {[
          { key: "pass", label: "Pass", color: "text-green-600" },
          { key: "fail", label: "Fail", color: "text-red-600" },
          { key: "warning", label: "Warn", color: "text-amber-600" },
          { key: "na", label: "N/A", color: "text-blue-600" },
          { key: "pending", label: "Pending", color: "text-gray-500" },
        ].map(({ key, label, color }) => (
          <div key={key}>
            <div className={`text-lg font-bold ${color}`}>{summary[key]}</div>
            <div className="text-[10px] text-gray-400">{label}</div>
          </div>
        ))}
      </div>
      {done > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Pass Rate</span>
          <span
            className={`font-bold ${passRate >= 80 ? "text-green-600" : passRate >= 60 ? "text-amber-600" : "text-red-600"}`}
          >
            {passRate}%
          </span>
        </div>
      )}
    </div>
  );
};

const AutoSaveIndicator = ({ status }) => {
  const configs = {
    idle: {
      text: "All changes saved",
      dot: "bg-green-400",
      text_color: "text-green-600",
    },
    saving: {
      text: "Saving…",
      dot: "bg-amber-400 animate-pulse",
      text_color: "text-amber-600",
    },
    error: {
      text: "Save failed",
      dot: "bg-red-400",
      text_color: "text-red-600",
    },
  };
  const cfg = configs[status] || configs.idle;
  return (
    <div className={`flex items-center gap-1.5 text-xs ${cfg.text_color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.text}
    </div>
  );
};

const DragDropImageZone = ({ onFile, refEl, refKey }) => {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile({ target: { files: [file] } });
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
        dragging
          ? "border-blue-500 bg-blue-50 scale-105"
          : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
      }`}
    >
      <FaCloudUploadAlt
        size={22}
        className={dragging ? "text-blue-500" : "text-gray-400"}
      />
      <span className="text-[10px] text-gray-400 mt-1 text-center leading-tight">
        Drop or
        <br />
        click
      </span>
      <input
        ref={refEl}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={onFile}
      />
    </label>
  );
};

// ==================== MAIN COMPONENT ====================
const AuditEntry = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");

  const {
    getTemplateById,
    getAuditById,
    createAudit,
    updateAudit,
    loading,
    error,
  } = useAuditData();

  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle");
  const [initialLoading, setInitialLoading] = useState(true);
  const [template, setTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState({});

  // Filter/search
  const [checkpointFilter, setCheckpointFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Serial number state
  const [serialNo, setSerialNo] = useState("");
  const [debouncedSerial, setDebouncedSerial] = useState("");
  const [modelFetched, setModelFetched] = useState(false);

  // Shift and date
  const [currentShift, setCurrentShift] = useState(getCurrentShift());
  const [currentDate, setCurrentDate] = useState(getCurrentDate());

  // Image states
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRefs = useRef({});

  // Keyboard shortcut handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setShowPreview((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape" && imagePreview) {
        setImagePreview(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [imagePreview]);

  // Update shift every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentShift(getCurrentShift());
      const newDate = getCurrentDate();
      if (newDate !== currentDate) setCurrentDate(newDate);
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  // Debounce serial number
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSerial(serialNo.trim().length >= 3 ? serialNo.trim() : "");
    }, 800);
    return () => clearTimeout(timer);
  }, [serialNo]);

  // RTK Query for model variants
  const {
    data: modelVariants,
    isLoading: isLoadingModels,
    isError: isModelError,
    isFetching: isFetchingModels,
  } = useGetModelVariantsByAssemblyQuery(debouncedSerial, {
    skip: !debouncedSerial || debouncedSerial.length < 3,
  });

  // Audit header data
  const [auditData, setAuditData] = useState({
    templateId: "",
    templateName: "",
    reportName: "",
    formatNo: "",
    revNo: "",
    revDate: "",
    notes: "",
    status: "submitted",
  });
  const [infoData, setInfoData] = useState({});
  const [sections, setSections] = useState([]);
  const [signatures, setSignatures] = useState({
    auditor: { name: "", date: "" },
    reviewer: { name: "", date: "" },
    approver: { name: "", date: "" },
  });

  // Auto-populate model
  useEffect(() => {
    if (modelVariants && modelVariants.length > 0 && !modelFetched) {
      const first = modelVariants[0];
      setInfoData((prev) => ({
        ...prev,
        serialNo: serialNo,
        modelName: first.label,
        modelCode: first.value,
      }));
      setModelFetched(true);
      toast.success(`Model found: ${first.label}`, { icon: "??" });
    } else if (modelVariants?.length === 0 && debouncedSerial) {
      toast.error("No model found for this serial number");
    }
  }, [modelVariants, serialNo, debouncedSerial, modelFetched]);

  useEffect(() => {
    if (isModelError && debouncedSerial)
      toast.error("Failed to fetch model for this serial number");
  }, [isModelError, debouncedSerial]);

  // ==================== Image Handlers ====================
  const processImageFile = (file) =>
    new Promise((resolve, reject) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        reject(new Error("Invalid type. Use JPG, PNG, GIF, or WebP."));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error("File exceeds 5MB limit."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) =>
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result,
          uploadedAt: new Date().toISOString(),
        });
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (
    sectionId,
    stageId,
    checkpointId,
    columnId,
    event,
  ) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imageData = await processImageFile(file);
      setSections((prev) =>
        prev.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                stages: section.stages.map((stage) =>
                  stage.id === stageId
                    ? {
                        ...stage,
                        checkPoints: stage.checkPoints.map((cp) =>
                          cp.id === checkpointId
                            ? { ...cp, [columnId]: imageData }
                            : cp,
                        ),
                      }
                    : stage,
                ),
              }
            : section,
        ),
      );
      toast.success(`Image uploaded!`, { icon: "??" });
    } catch (err) {
      toast.error(err.message);
    }
    const refKey = `${sectionId}-${stageId}-${checkpointId}-${columnId}`;
    if (fileInputRefs.current[refKey]) fileInputRefs.current[refKey].value = "";
  };

  const handleImageRemove = (sectionId, stageId, checkpointId, columnId) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              stages: section.stages.map((stage) =>
                stage.id === stageId
                  ? {
                      ...stage,
                      checkPoints: stage.checkPoints.map((cp) =>
                        cp.id === checkpointId
                          ? { ...cp, [columnId]: null }
                          : cp,
                      ),
                    }
                  : stage,
              ),
            }
          : section,
      ),
    );
    toast.success("Image removed.");
  };

  // ==================== Migrate structures ====================
  const migrateTemplateStructure = useCallback((templateSections) => {
    if (!Array.isArray(templateSections)) return [];
    return templateSections.map((section) => {
      if (section.stages && Array.isArray(section.stages)) {
        return {
          ...section,
          id: section.id || generateId(),
          stages: section.stages.map((stage) => ({
            ...stage,
            id: stage.id || generateId(),
            checkPoints: (stage.checkPoints || []).map((cp) => ({
              ...cp,
              id: cp.id || generateId(),
              observation: cp.observation || "",
              remark: cp.remark || "",
              status: cp.status || "pending",
            })),
          })),
        };
      }
      return {
        id: generateId(),
        sectionName: section.sectionName || "",
        stages: [
          {
            id: generateId(),
            stageName: section.stageName || "",
            checkPoints: (section.checkPoints || []).map((cp) => ({
              ...cp,
              id: generateId(),
              observation: "",
              remark: "",
              status: "pending",
            })),
          },
        ],
      };
    });
  }, []);

  const migrateAuditSections = useCallback((auditSections) => {
    if (!Array.isArray(auditSections)) return [];
    return auditSections.map((section) => {
      if (section.stages && Array.isArray(section.stages)) {
        return {
          ...section,
          id: section.id || generateId(),
          stages: section.stages.map((stage) => ({
            ...stage,
            id: stage.id || generateId(),
            checkPoints: (stage.checkPoints || []).map((cp) => ({
              ...cp,
              id: cp.id || generateId(),
            })),
          })),
        };
      }
      return {
        ...section,
        id: section.id || generateId(),
        stages: [
          {
            id: generateId(),
            stageName: section.stageName || "",
            checkPoints: (section.checkPoints || []).map((cp) => ({
              ...cp,
              id: cp.id || generateId(),
            })),
          },
        ],
      };
    });
  }, []);

  // Load template or existing audit
  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      try {
        if (id) {
          const audit = await getAuditById(id);
          if (audit) {
            setAuditData({
              templateId: audit.templateId || "",
              templateName: audit.templateName || "",
              reportName: audit.reportName || "",
              formatNo: audit.formatNo || "",
              revNo: audit.revNo || "",
              revDate: audit.revDate || "",
              notes: audit.notes || "",
              status: audit.status || "submitted",
            });
            const existingInfoData = audit.infoData || {};
            setInfoData(existingInfoData);
            if (existingInfoData.serialNo) {
              setSerialNo(existingInfoData.serialNo);
              setModelFetched(true);
            }
            setSections(migrateAuditSections(audit.sections || []));
            setSignatures(
              audit.signatures || {
                auditor: { name: "", date: "" },
                reviewer: { name: "", date: "" },
                approver: { name: "", date: "" },
              },
            );
            setTemplate({
              columns: audit.columns,
              infoFields: audit.infoFields,
              headerConfig: audit.headerConfig,
            });
          }
        } else if (templateId) {
          const tmpl = await getTemplateById(templateId);
          if (tmpl) {
            setTemplate(tmpl);
            const todayDate = getCurrentDate();
            const shift = getCurrentShift();
            setAuditData({
              templateId: tmpl.id,
              templateName: tmpl.name,
              reportName: tmpl.name,
              formatNo: tmpl.headerConfig?.defaultFormatNo || "",
              revNo: tmpl.headerConfig?.defaultRevNo || "",
              revDate: todayDate,
              notes: "",
              status: "submitted",
            });
            const initialInfoData = {};
            tmpl.infoFields?.forEach((field) => {
              initialInfoData[field.id] =
                field.id === "date"
                  ? todayDate
                  : field.id === "shift"
                    ? shift.value
                    : "";
            });
            setInfoData(initialInfoData);
            setSections(migrateTemplateStructure(tmpl.defaultSections));
            setSignatures({
              auditor: { name: "", date: todayDate },
              reviewer: { name: "", date: "" },
              approver: { name: "", date: "" },
            });
          }
        }
      } catch (err) {
        console.error("Load data error:", err);
        toast.error("Failed to load data. Please try again.");
        navigate("/auditreport/audits");
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [id, templateId]);

  // Handlers
  const handleSerialChange = useCallback((value) => {
    setSerialNo(value);
    setModelFetched(false);
    setInfoData((prev) => ({
      ...prev,
      serialNo: value,
      modelName: "",
      modelCode: "",
    }));
  }, []);

  const handleModelSelect = useCallback(
    (modelValue) => {
      const selected = modelVariants?.find((m) => m.value === modelValue);
      if (selected)
        setInfoData((prev) => ({
          ...prev,
          modelName: selected.label,
          modelCode: selected.value,
        }));
    },
    [modelVariants],
  );

  const handleInfoChange = useCallback(
    (fieldId, value) => {
      if (fieldId === "serialNo" || fieldId === "serial")
        handleSerialChange(value);
      else setInfoData((prev) => ({ ...prev, [fieldId]: value }));
    },
    [handleSerialChange],
  );

  const handleEntryFieldChange = useCallback(
    (sectionId, stageId, checkpointId, field, value) => {
      setSections((prev) =>
        prev.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                stages: section.stages.map((stage) =>
                  stage.id === stageId
                    ? {
                        ...stage,
                        checkPoints: stage.checkPoints.map((cp) =>
                          cp.id === checkpointId
                            ? { ...cp, [field]: value }
                            : cp,
                        ),
                      }
                    : stage,
                ),
              }
            : section,
        ),
      );
    },
    [],
  );

  const handleSignatureChange = useCallback((role, field, value) => {
    setSignatures((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  }, []);

  // Bulk status for entire section
  const handleBulkStatus = (sectionId, status) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              stages: section.stages.map((stage) => ({
                ...stage,
                checkPoints: stage.checkPoints.map((cp) => ({ ...cp, status })),
              })),
            }
          : section,
      ),
    );
    toast.success(`All checkpoints set to "${STATUS_CONFIG[status]?.label}"`, {
      icon: "?",
    });
  };

  const toggleSection = (sectionId) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const visibleColumns = template?.columns?.filter((col) => col.visible) || [];

  const getSummary = useCallback(() => {
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0,
      na = 0;
    sections.forEach((section) => {
      section.stages?.forEach((stage) => {
        stage.checkPoints?.forEach((cp) => {
          if (cp.status === "pass") pass++;
          else if (cp.status === "fail") fail++;
          else if (cp.status === "warning") warning++;
          else if (cp.status === "na") na++;
          else pending++;
        });
      });
    });
    return {
      pass,
      fail,
      warning,
      pending,
      na,
      total: pass + fail + warning + pending + na,
    };
  }, [sections]);

  const summary = getSummary();

  const getSectionStats = (section) => {
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0,
      na = 0;
    section.stages?.forEach((stage) => {
      stage.checkPoints?.forEach((cp) => {
        if (cp.status === "pass") pass++;
        else if (cp.status === "fail") fail++;
        else if (cp.status === "warning") warning++;
        else if (cp.status === "na") na++;
        else pending++;
      });
    });
    const total = pass + fail + warning + pending + na;
    return { pass, fail, warning, pending, na, total };
  };

  const getSectionTotalCheckpoints = (section) => {
    if (!section.stages) return 0;
    return section.stages.reduce(
      (total, stage) => total + (stage.checkPoints?.length || 0),
      0,
    );
  };

  // Filter checkpoints
  const filterCheckpoint = (cp) => {
    if (checkpointFilter !== "all" && cp.status !== checkpointFilter)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const text = JSON.stringify(cp).toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  };

  // Submit
  const handleSubmit = async () => {
    if (!serialNo.trim()) {
      toast.error("Serial Number is required");
      return;
    }
    if (!infoData.modelName) {
      toast.error("Waiting for model to be fetched");
      return;
    }
    if (!auditData.templateId) {
      toast.error("Template is required");
      return;
    }
    if (!auditData.reportName?.trim()) {
      toast.error("Report name is required");
      return;
    }

    setSaving(true);
    setAutoSaveStatus("saving");
    try {
      const finalInfoData = {
        ...infoData,
        serialNo: serialNo.trim(),
        serial: serialNo.trim(),
        shift: infoData.shift || currentShift.value,
        date: infoData.date || currentDate,
      };
      const auditPayload = {
        templateId: parseInt(auditData.templateId, 10),
        templateName: auditData.templateName,
        reportName: auditData.reportName,
        formatNo: auditData.formatNo || null,
        revNo: auditData.revNo || null,
        revDate: auditData.revDate || null,
        notes: auditData.notes || null,
        status: "submitted",
        infoData: finalInfoData,
        sections,
        signatures,
        columns: template?.columns || [],
        infoFields: template?.infoFields || [],
        headerConfig: template?.headerConfig || {},
      };
      if (id) await updateAudit(id, auditPayload);
      else await createAudit(auditPayload);
      setAutoSaveStatus("idle");
      toast.success("Audit submitted successfully! ?");
      setTimeout(() => navigate("/auditreport/audits"), 500);
    } catch (error) {
      console.error("Submit error:", error);
      setAutoSaveStatus("error");
      toast.error(error.message || "Error submitting audit.");
    } finally {
      setSaving(false);
    }
  };

  // Field icon
  const getFieldIcon = useCallback((fieldId) => {
    const icons = {
      modelName: <BiSolidFactory className="text-indigo-600" />,
      serialNo: <FaBarcode className="text-purple-600" />,
      serial: <FaBarcode className="text-purple-600" />,
      date: <FaCalendarAlt className="text-red-500" />,
      shift: <FaClock className="text-amber-500" />,
      eid: <FaIdBadge className="text-teal-600" />,
    };
    return icons[fieldId] || <FaClipboardCheck className="text-gray-500" />;
  }, []);

  // Render info field input
  const renderInfoFieldInput = useCallback(
    (field) => {
      const value = infoData[field.id] || "";

      if (showPreview) {
        return (
          <span className="font-semibold text-gray-800">
            {field.id === "date" ? formatDateForDisplay(value) : value || "-"}
          </span>
        );
      }

      if (field.id === "serialNo" || field.id === "serial") {
        return (
          <div className="relative">
            <input
              type="text"
              value={serialNo}
              onChange={(e) => handleSerialChange(e.target.value)}
              placeholder={`Enter ${field.name}`}
              className="w-full font-semibold text-gray-800 bg-transparent border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-1 pr-8 transition-colors"
            />
            {(isLoadingModels || isFetchingModels) && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
              </div>
            )}
            {!isLoadingModels &&
              !isFetchingModels &&
              serialNo &&
              infoData.modelName && (
                <FaCheckCircle className="absolute right-0 top-1/2 -translate-y-1/2 text-green-500" />
              )}
          </div>
        );
      }

      if (field.id === "modelName") {
        return (
          <div>
            {modelVariants && modelVariants.length > 1 ? (
              <>
                <select
                  value={infoData.modelCode || ""}
                  onChange={(e) => handleModelSelect(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-transparent border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-1"
                >
                  <option value="">Select Model</option>
                  {modelVariants.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {infoData.modelCode && (
                  <span className="text-xs text-indigo-600 mt-1 block">
                    Code: {infoData.modelCode}
                  </span>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={infoData.modelName || ""}
                  readOnly
                  placeholder={
                    isLoadingModels || isFetchingModels
                      ? "Fetching…"
                      : !serialNo
                        ? "Enter serial first"
                        : "No model found"
                  }
                  className="w-full font-semibold bg-gray-50 border-b-2 border-gray-200 outline-none rounded px-2 py-1 text-gray-700 cursor-not-allowed"
                />
                <span
                  className={`text-xs mt-1 block ${infoData.modelName ? "text-green-600" : "text-gray-400"}`}
                >
                  {isLoadingModels || isFetchingModels
                    ? "? Fetching model data…"
                    : !serialNo
                      ? "? Enter serial number first"
                      : infoData.modelName
                        ? `? Code: ${infoData.modelCode || "N/A"}`
                        : debouncedSerial
                          ? "? No model found"
                          : "Waiting for serial…"}
                </span>
              </>
            )}
          </div>
        );
      }

      if (field.id === "shift") {
        return (
          <div>
            <input
              type="text"
              value={value || currentShift.value}
              readOnly
              className="w-full font-semibold text-amber-800 bg-amber-50 border-b-2 border-amber-200 outline-none rounded px-2 py-1 cursor-not-allowed"
            />
            <span className="text-xs text-amber-600 mt-1 block">
              ? Auto: {currentShift.label}
            </span>
          </div>
        );
      }

      if (field.id === "date") {
        return (
          <div>
            <input
              type="text"
              value={formatDateForDisplay(value || currentDate)}
              readOnly
              className="w-full font-semibold text-red-800 bg-red-50 border-b-2 border-red-200 outline-none rounded px-2 py-1 cursor-not-allowed"
            />
            <span className="text-xs text-red-500 mt-1 block">
              ? Auto: Today's Date
            </span>
          </div>
        );
      }

      const commonClass =
        "w-full font-semibold text-gray-800 bg-transparent border-b-2 border-gray-200 focus:border-indigo-500 outline-none py-1 transition-colors";
      switch (field.type) {
        case "date":
          return (
            <input
              type="date"
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              className={commonClass}
            />
          );
        case "select":
          return (
            <select
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              className={commonClass}
            >
              <option value="">Select {field.name}</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        case "number":
          return (
            <input
              type="number"
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              placeholder={`Enter ${field.name}`}
              className={commonClass}
            />
          );
        default:
          return (
            <input
              type="text"
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              placeholder={`Enter ${field.name}`}
              className={commonClass}
            />
          );
      }
    },
    [
      infoData,
      showPreview,
      serialNo,
      isLoadingModels,
      isFetchingModels,
      modelVariants,
      debouncedSerial,
      currentShift,
      currentDate,
      handleSerialChange,
      handleModelSelect,
      handleInfoChange,
    ],
  );

  // Render Image Cell
  const renderImageCell = (column, checkpoint, section, stage) => {
    const imageData = checkpoint[column.id];
    const refKey = `${section.id}-${stage.id}-${checkpoint.id}-${column.id}`;

    if (showPreview) {
      const isFilename = typeof imageData === "string" && imageData.length > 0;
      const isOldFormat =
        imageData && typeof imageData === "object" && imageData.data;
      if (isFilename || isOldFormat) {
        const imgSrc = isFilename
          ? `${baseURL}audit-report/images/${imageData}`
          : imageData.data;
        return (
          <td key={column.id} className="px-3 py-2 border-r border-gray-100">
            <div className="flex justify-center">
              <img
                src={imgSrc}
                alt={isFilename ? imageData : imageData?.name || "img"}
                className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-indigo-400 hover:shadow-lg transition-all"
                onClick={() =>
                  setImagePreview(
                    isFilename
                      ? {
                          fileName: imageData,
                          data: imgSrc,
                          name: imageData,
                          size: null,
                        }
                      : imageData,
                  )
                }
                onError={(e) => {
                  e.target.src =
                    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzljYTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg==";
                }}
              />
            </div>
          </td>
        );
      }
      return (
        <td
          key={column.id}
          className="px-3 py-2 border-r border-gray-100 text-center"
        >
          <span className="text-xs text-gray-300 italic">—</span>
        </td>
      );
    }

    return (
      <td key={column.id} className="px-3 py-2 border-r border-gray-100">
        <div className="flex justify-center">
          {imageData && imageData.data ? (
            <div className="relative group">
              <img
                src={imageData.data}
                alt={imageData.name || "img"}
                className="w-20 h-20 object-cover rounded-xl border-2 border-gray-200 cursor-pointer group-hover:border-indigo-400 transition-all"
                onClick={() => setImagePreview(imageData)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-xl transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setImagePreview(imageData)}
                  className="p-1.5 bg-white rounded-full text-indigo-600 shadow"
                  title="View"
                >
                  <FaSearchPlus size={11} />
                </button>
                <button
                  onClick={() =>
                    handleImageRemove(
                      section.id,
                      stage.id,
                      checkpoint.id,
                      column.id,
                    )
                  }
                  className="p-1.5 bg-white rounded-full text-red-600 shadow"
                  title="Remove"
                >
                  <FaTrash size={11} />
                </button>
              </div>
              <p
                className="text-[10px] text-gray-400 mt-1 truncate max-w-[80px] text-center"
                title={imageData.name}
              >
                {imageData.name}
              </p>
            </div>
          ) : (
            <DragDropImageZone
              refEl={(el) => (fileInputRefs.current[refKey] = el)}
              onFile={(e) =>
                handleImageUpload(
                  section.id,
                  stage.id,
                  checkpoint.id,
                  column.id,
                  e,
                )
              }
            />
          )}
        </div>
      </td>
    );
  };

  // ==================== LOADING STATE ====================
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <div>
            <p className="font-semibold text-gray-700">Loading Audit</p>
            <p className="text-sm text-gray-400 mt-1">
              Preparing your workspace…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!template && !id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-sm mx-4">
          <HiClipboardDocumentCheck className="text-5xl text-indigo-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            No Template Selected
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Choose a template to start a new audit entry.
          </p>
          <button
            onClick={() => navigate("/auditreport/templates")}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-indigo-200"
          >
            Browse Templates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* ==================== Image Preview Modal ==================== */}
      {imagePreview && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 backdrop-blur-sm"
          onClick={() => setImagePreview(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
              <div className="flex items-center gap-2">
                <FaImage className="text-indigo-400" />
                <span className="font-medium text-sm">
                  {imagePreview.name || imagePreview.fileName || "Image"}
                </span>
                {imagePreview.size && (
                  <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                    {formatFileSize(imagePreview.size)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setImagePreview(null)}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-gray-50 min-h-[300px]">
              <img
                src={imagePreview.data}
                alt={imagePreview.name || "Preview"}
                className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md"
              />
            </div>
            <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {imagePreview.uploadedAt
                  ? `Uploaded: ${new Date(imagePreview.uploadedAt).toLocaleString()}`
                  : ""}
              </span>
              {imagePreview.data && (
                <a
                  href={imagePreview.data}
                  download={imagePreview.name || "image"}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== Keyboard Shortcuts Modal ==================== */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
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
                ["Ctrl + Enter", "Submit Audit"],
                ["Ctrl + P", "Toggle Preview"],
                ["Esc", "Close Modals"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{desc}</span>
                  <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== STICKY HEADER ==================== */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate("/auditreport/audits")}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-all"
            >
              <FaArrowLeft size={12} /> Back
            </button>

            <div className="flex items-center gap-2">
              <HiClipboardDocumentCheck className="text-xl text-indigo-600" />
              <div>
                <h1 className="text-sm font-bold text-gray-800 leading-none">
                  {id ? "Edit Audit" : "New Audit Entry"}
                </h1>
                <p className="text-xs text-gray-400 leading-none mt-0.5">
                  {auditData.templateName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                <FaCalendarAlt size={10} /> {formatDateForDisplay(currentDate)}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100 flex items-center gap-1">
                <FaClock size={10} /> {currentShift.label}
              </span>
            </div>

            <AutoSaveIndicator status={autoSaveStatus} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Keyboard Shortcuts"
            >
              <FaKeyboard size={14} />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Print"
            >
              <FaPrint size={14} />
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                showPreview
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-gray-700 hover:bg-gray-800 text-white"
              }`}
            >
              {showPreview ? (
                <>
                  <FaEdit size={12} /> Edit
                </>
              ) : (
                <>
                  <FaEye size={12} /> Preview
                </>
              )}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || isLoadingModels}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-indigo-200"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                  Submitting…
                </>
              ) : (
                <>
                  <FaPaperPlane size={12} /> Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== MAIN LAYOUT ==================== */}
      <div className="max-w-[1600px] mx-auto px-4 py-5 flex gap-4">
        {/* ==================== LEFT SIDEBAR ==================== */}
        <aside className="hidden xl:flex flex-col gap-4 w-64 flex-shrink-0">
          <ProgressBar summary={summary} />

          {/* Filter Panel */}
          {!showPreview && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <FaFilter size={10} /> Filter
              </h3>
              <div className="relative mb-2">
                <FaSearch
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"
                  size={11}
                />
                <input
                  type="text"
                  placeholder="Search checkpoints…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-indigo-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                {["all", "pending", "pass", "fail", "warning", "na"].map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setCheckpointFilter(f)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                        checkpointFilter === f
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="capitalize">
                        {f === "all"
                          ? "All Checkpoints"
                          : STATUS_CONFIG[f]?.label}
                      </span>
                      {f !== "all" && (
                        <span className="text-gray-400">{summary[f] || 0}</span>
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Section Overview */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Sections
            </h3>
            <div className="space-y-2">
              {sections.map((section) => {
                const stats = getSectionStats(section);
                const pct =
                  stats.total > 0
                    ? Math.round(
                        ((stats.pass + stats.fail + stats.warning + stats.na) /
                          stats.total) *
                          100,
                      )
                    : 0;
                return (
                  <div key={section.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs text-gray-600 font-medium truncate max-w-[140px]"
                        title={section.sectionName}
                      >
                        {section.sectionName || "—"}
                      </span>
                      <span className="text-xs text-gray-400">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ==================== MAIN CONTENT ==================== */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* ==================== REPORT HEADER ==================== */}
            <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-gray-100">
              <div className="md:col-span-2 bg-gradient-to-br from-slate-800 to-indigo-900 p-7">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/10 rounded-xl">
                    <HiClipboardDocumentCheck className="text-3xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white leading-tight">
                      {auditData.reportName || "Audit Report"}
                    </h1>
                    <p className="text-indigo-300 text-sm mt-1">
                      Template: {auditData.templateName}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2.5 py-1 bg-white/10 rounded-full text-xs text-white">
                        {summary.total} Checkpoints
                      </span>
                      <span className="px-2.5 py-1 bg-green-500/20 rounded-full text-xs text-green-300">
                        {summary.pass} Passed
                      </span>
                      {summary.fail > 0 && (
                        <span className="px-2.5 py-1 bg-red-500/20 rounded-full text-xs text-red-300">
                          {summary.fail} Failed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 divide-y divide-gray-100">
                {template?.headerConfig?.showFormatNo !== false && (
                  <div className="p-3.5 flex items-center gap-3">
                    <MdFormatListNumbered className="text-xl text-indigo-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Format No
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {auditData.formatNo || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {template?.headerConfig?.showRevNo !== false && (
                  <div className="p-3.5 flex items-center gap-3">
                    <MdUpdate className="text-xl text-green-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Rev. No
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {auditData.revNo || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {template?.headerConfig?.showRevDate !== false && (
                  <div className="p-3.5 flex items-center gap-3">
                    <MdDateRange className="text-xl text-purple-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Rev. Date
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {formatDateForDisplay(auditData?.revDate) || "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ==================== INFO FIELDS ==================== */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-100 bg-white">
              {template?.infoFields
                ?.filter((f) => f.visible)
                .map((field, index, arr) => (
                  <div
                    key={field.id}
                    className={`p-4 ${index < arr.length - 1 ? "border-r" : ""} border-gray-100`}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">
                        {getFieldIcon(field.id)}
                      </span>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {field.name}
                        {field.required && (
                          <span className="text-red-400 ml-0.5">*</span>
                        )}
                      </span>
                    </div>
                    {renderInfoFieldInput(field)}
                  </div>
                ))}
            </div>

            {/* ==================== NOTES ==================== */}
            <div className="p-4 border-b border-gray-100 bg-amber-50/50">
              <div className="flex items-center gap-2 mb-2">
                <FaStickyNote className="text-amber-500" />
                <span className="font-semibold text-gray-700 text-sm">
                  Notes
                </span>
              </div>
              {showPreview ? (
                <p className="text-gray-600 text-sm pl-5 leading-relaxed">
                  {auditData.notes || "No notes added."}
                </p>
              ) : (
                <textarea
                  placeholder="Add notes, observations, or special instructions…"
                  value={auditData.notes}
                  onChange={(e) =>
                    setAuditData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full text-sm text-gray-700 bg-white border border-amber-200 rounded-xl px-3 py-2 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none resize-none transition-all"
                />
              )}
            </div>

            {/* ==================== FILTER BAR (mobile) ==================== */}
            {!showPreview && (
              <div className="xl:hidden flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto">
                <FaFilter size={11} className="text-gray-400 flex-shrink-0" />
                {["all", "pending", "pass", "fail", "warning", "na"].map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setCheckpointFilter(f)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        checkpointFilter === f
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-500 border border-gray-200"
                      }`}
                    >
                      {f === "all" ? "All" : STATUS_CONFIG[f]?.label}
                    </button>
                  ),
                )}
              </div>
            )}

            {/* ==================== SECTIONS & TABLE ==================== */}
            {sections.map((section) => {
              const isCollapsed = collapsedSections[section.id];
              const sectionStats = getSectionStats(section);
              const sectionPct =
                sectionStats.total > 0
                  ? Math.round(
                      ((sectionStats.pass +
                        sectionStats.fail +
                        sectionStats.warning +
                        sectionStats.na) /
                        sectionStats.total) *
                        100,
                    )
                  : 0;

              return (
                <div
                  key={section.id}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-700 text-white sticky top-[57px] z-20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="p-1 hover:bg-white/10 rounded transition"
                      >
                        {isCollapsed ? (
                          <FaChevronDown size={12} />
                        ) : (
                          <FaChevronUp size={12} />
                        )}
                      </button>
                      <span className="font-bold text-sm truncate">
                        {section.sectionName || "Unnamed Section"}
                      </span>
                      <span className="text-slate-300 text-xs flex-shrink-0">
                        {sectionStats.total} checks
                      </span>
                      <div className="hidden sm:flex items-center gap-1 text-xs">
                        {sectionStats.pass > 0 && (
                          <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                            {sectionStats.pass}?
                          </span>
                        )}
                        {sectionStats.fail > 0 && (
                          <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                            {sectionStats.fail}?
                          </span>
                        )}
                        {sectionStats.warning > 0 && (
                          <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                            {sectionStats.warning}!
                          </span>
                        )}
                        {sectionStats.pending > 0 && (
                          <span className="bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                            {sectionStats.pending} pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bulk Actions */}
                    {!showPreview && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-slate-400 mr-1 hidden sm:inline">
                          Bulk:
                        </span>
                        {[
                          {
                            status: "pass",
                            icon: FaCheckDouble,
                            color: "hover:bg-green-500/30 text-green-300",
                            title: "All Pass",
                          },
                          {
                            status: "fail",
                            icon: FaTimesCircle,
                            color: "hover:bg-red-500/30 text-red-300",
                            title: "All Fail",
                          },
                          {
                            status: "warning",
                            icon: FaExclamationTriangle,
                            color: "hover:bg-amber-500/30 text-amber-300",
                            title: "All Warning",
                          },
                          {
                            status: "na",
                            icon: FaBan,
                            color: "hover:bg-blue-500/30 text-blue-300",
                            title: "All N/A",
                          },
                        ].map(({ status, icon: Icon, color, title }) => (
                          <button
                            key={status}
                            onClick={() => handleBulkStatus(section.id, status)}
                            className={`p-1.5 rounded-lg transition text-slate-400 ${color}`}
                            title={title}
                          >
                            <Icon size={12} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Collapsed indicator */}
                  {isCollapsed && (
                    <div className="px-4 py-2 bg-slate-50 text-xs text-gray-400 flex items-center justify-between">
                      <span>{sectionStats.total} checkpoints hidden</span>
                      <span>{sectionPct}% complete</span>
                    </div>
                  )}

                  {/* Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {visibleColumns.map((column) => (
                              <th
                                key={column.id}
                                className={`px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide border-r border-gray-200 last:border-r-0 whitespace-nowrap ${column.width} ${
                                  column.entryField || column.type === "image"
                                    ? "text-indigo-700 bg-indigo-50"
                                    : "text-gray-500"
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  {column.type === "image" && (
                                    <FaImage
                                      size={10}
                                      className="text-pink-400"
                                    />
                                  )}
                                  {column.name}
                                  {column.entryField &&
                                    column.type !== "image" && (
                                      <span className="text-indigo-400 text-[9px] font-normal">
                                        (Entry)
                                      </span>
                                    )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.stages?.map((stage) => {
                            // Filter checkpoints
                            const filteredCPs =
                              stage.checkPoints?.filter(filterCheckpoint) || [];
                            if (
                              filteredCPs.length === 0 &&
                              (checkpointFilter !== "all" || searchQuery)
                            )
                              return null;

                            let stageRendered = false;
                            const stageRowSpan = filteredCPs.length;

                            return filteredCPs.map((checkpoint, cpIdx) => {
                              const showStage = !stageRendered && cpIdx === 0;
                              if (showStage) stageRendered = true;

                              const statusCfg =
                                STATUS_CONFIG[checkpoint.status] ||
                                STATUS_CONFIG.pending;

                              return (
                                <tr
                                  key={`${stage.id}-${checkpoint.id}`}
                                  className={`border-b border-gray-100 last:border-b-0 hover:bg-slate-50/80 transition-colors group ${statusCfg.bg}`}
                                >
                                  {visibleColumns.map((column) => {
                                    if (column.id === "section") return null; // handled at section level

                                    if (column.id === "stage") {
                                      if (showStage) {
                                        return (
                                          <td
                                            key={column.id}
                                            rowSpan={stageRowSpan}
                                            className="px-3 py-2 font-semibold text-indigo-800 bg-indigo-50/80 border-r border-gray-200 text-center align-middle"
                                          >
                                            <span className="text-xs">
                                              {stage.stageName || "—"}
                                            </span>
                                          </td>
                                        );
                                      }
                                      return null;
                                    }

                                    if (column.type === "image") {
                                      return renderImageCell(
                                        column,
                                        checkpoint,
                                        section,
                                        stage,
                                      );
                                    }

                                    if (column.id === "status") {
                                      return (
                                        <td
                                          key={column.id}
                                          className="px-2 py-2 border-r border-gray-100 bg-white/50"
                                        >
                                          {showPreview ? (
                                            <StatusBadge
                                              status={checkpoint.status}
                                            />
                                          ) : (
                                            <select
                                              value={
                                                checkpoint.status || "pending"
                                              }
                                              onChange={(e) =>
                                                handleEntryFieldChange(
                                                  section.id,
                                                  stage.id,
                                                  checkpoint.id,
                                                  "status",
                                                  e.target.value,
                                                )
                                              }
                                              className={`w-full text-xs px-2 py-1.5 rounded-lg border font-medium focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                                                checkpoint.status === "pass"
                                                  ? "bg-green-50 border-green-200 text-green-700 focus:ring-green-300"
                                                  : checkpoint.status === "fail"
                                                    ? "bg-red-50 border-red-200 text-red-700 focus:ring-red-300"
                                                    : checkpoint.status ===
                                                        "warning"
                                                      ? "bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-300"
                                                      : checkpoint.status ===
                                                          "na"
                                                        ? "bg-blue-50 border-blue-200 text-blue-700 focus:ring-blue-300"
                                                        : "bg-gray-50 border-gray-200 text-gray-600 focus:ring-gray-300"
                                              }`}
                                            >
                                              <option value="pending">
                                                ? Pending
                                              </option>
                                              <option value="pass">
                                                ? Pass
                                              </option>
                                              <option value="fail">
                                                ? Fail
                                              </option>
                                              <option value="warning">
                                                ? Warning
                                              </option>
                                              <option value="na">— N/A</option>
                                            </select>
                                          )}
                                        </td>
                                      );
                                    }

                                    if (column.entryField) {
                                      return (
                                        <td
                                          key={column.id}
                                          className="px-2 py-2 border-r border-gray-100"
                                        >
                                          {showPreview ? (
                                            <span className="text-gray-700 text-xs">
                                              {checkpoint[column.id] || "—"}
                                            </span>
                                          ) : (
                                            <input
                                              type={
                                                column.type === "number"
                                                  ? "number"
                                                  : "text"
                                              }
                                              placeholder={column.name}
                                              value={
                                                checkpoint[column.id] || ""
                                              }
                                              onChange={(e) =>
                                                handleEntryFieldChange(
                                                  section.id,
                                                  stage.id,
                                                  checkpoint.id,
                                                  column.id,
                                                  e.target.value,
                                                )
                                              }
                                              className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all min-w-[80px]"
                                            />
                                          )}
                                        </td>
                                      );
                                    }

                                    return (
                                      <td
                                        key={column.id}
                                        className="px-3 py-2 border-r border-gray-100 last:border-r-0"
                                      >
                                        <span className="text-gray-700 text-xs">
                                          {checkpoint[column.id] || "—"}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ==================== SUMMARY ==================== */}
            <div className="p-5 bg-gray-50 border-t border-gray-200">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">
                <FaClipboardCheck className="text-indigo-500" /> Audit Summary
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  {
                    key: "total",
                    label: "Total",
                    bg: "bg-white",
                    border: "border-gray-200",
                    val_color: "text-gray-800",
                    icon: null,
                  },
                  {
                    key: "pass",
                    label: "Passed",
                    bg: "bg-green-50",
                    border: "border-green-200",
                    val_color: "text-green-700",
                    icon: FaCheckCircle,
                  },
                  {
                    key: "warning",
                    label: "Warnings",
                    bg: "bg-amber-50",
                    border: "border-amber-200",
                    val_color: "text-amber-700",
                    icon: FaExclamationTriangle,
                  },
                  {
                    key: "fail",
                    label: "Failed",
                    bg: "bg-red-50",
                    border: "border-red-200",
                    val_color: "text-red-700",
                    icon: FaTimesCircle,
                  },
                  {
                    key: "na",
                    label: "N/A",
                    bg: "bg-blue-50",
                    border: "border-blue-200",
                    val_color: "text-blue-700",
                    icon: FaBan,
                  },
                  {
                    key: "pending",
                    label: "Pending",
                    bg: "bg-gray-50",
                    border: "border-gray-200",
                    val_color: "text-gray-500",
                    icon: null,
                  },
                ].map(({ key, label, bg, border, val_color, icon: Icon }) => (
                  <div
                    key={key}
                    className={`${bg} rounded-xl p-3.5 text-center border ${border} shadow-sm`}
                  >
                    <div
                      className={`text-2xl font-black ${val_color} flex items-center justify-center gap-1`}
                    >
                      {Icon && <Icon size={16} />}
                      {summary[key]}
                    </div>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pass Rate Bar */}
              {summary.total > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">
                      Overall Progress
                    </span>
                    <span className="text-xs font-bold text-gray-700">
                      {Math.round(
                        ((summary.pass +
                          summary.fail +
                          summary.warning +
                          summary.na) /
                          summary.total) *
                          100,
                      )}
                      % completed
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    {summary.pass > 0 && (
                      <div
                        className="bg-green-400 h-full transition-all"
                        style={{
                          width: `${(summary.pass / summary.total) * 100}%`,
                        }}
                        title={`Pass: ${summary.pass}`}
                      />
                    )}
                    {summary.warning > 0 && (
                      <div
                        className="bg-amber-400 h-full transition-all"
                        style={{
                          width: `${(summary.warning / summary.total) * 100}%`,
                        }}
                        title={`Warning: ${summary.warning}`}
                      />
                    )}
                    {summary.fail > 0 && (
                      <div
                        className="bg-red-400 h-full transition-all"
                        style={{
                          width: `${(summary.fail / summary.total) * 100}%`,
                        }}
                        title={`Fail: ${summary.fail}`}
                      />
                    )}
                    {summary.na > 0 && (
                      <div
                        className="bg-blue-300 h-full transition-all"
                        style={{
                          width: `${(summary.na / summary.total) * 100}%`,
                        }}
                        title={`N/A: ${summary.na}`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {[
                      ["bg-green-400", "Pass"],
                      ["bg-amber-400", "Warning"],
                      ["bg-red-400", "Fail"],
                      ["bg-blue-300", "N/A"],
                      ["bg-gray-200", "Pending"],
                    ].map(([c, l]) => (
                      <span
                        key={l}
                        className="flex items-center gap-1 text-[10px] text-gray-400"
                      >
                        <span className={`w-2 h-2 rounded-full ${c}`} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ==================== SIGNATURES ==================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-t-2 border-gray-100">
              {[
                {
                  role: "auditor",
                  label: "Auditor Signature",
                  icon: FaUserCheck,
                  color: "text-indigo-600",
                  ring: "focus:ring-indigo-100 focus:border-indigo-400",
                },
                {
                  role: "approver",
                  label: "Approved By",
                  icon: FaUserShield,
                  color: "text-purple-600",
                  ring: "focus:ring-purple-100 focus:border-purple-400",
                },
              ].map(({ role, label, icon: Icon, color, ring }, i) => (
                <div
                  key={role}
                  className={`p-6 ${i === 0 ? "border-r border-gray-100" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className={`text-lg ${color}`} />
                    <span className="text-sm font-bold text-gray-700">
                      {label}
                    </span>
                  </div>
                  {showPreview ? (
                    <div className="text-center py-4">
                      <div className="border-b-2 border-gray-300 w-3/4 mx-auto pb-6 mb-2">
                        <span className="text-gray-700 font-semibold text-lg">
                          {signatures[role]?.name || ""}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDateForDisplay(signatures[role]?.date) || "Date"}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          placeholder="Enter full name"
                          value={signatures[role]?.name || ""}
                          onChange={(e) =>
                            handleSignatureChange(role, "name", e.target.value)
                          }
                          className={`w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 transition-all ${ring}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={signatures[role]?.date || ""}
                          onChange={(e) =>
                            handleSignatureChange(role, "date", e.target.value)
                          }
                          className={`w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 transition-all ${ring}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ==================== FOOTER SUBMIT ==================== */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {summary.pending > 0
                  ? `? ${summary.pending} checkpoint${summary.pending !== 1 ? "s" : ""} still pending`
                  : "? All checkpoints reviewed"}
              </p>
              <button
                onClick={handleSubmit}
                disabled={saving || isLoadingModels}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200/60"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Submitting…
                  </>
                ) : (
                  <>
                    <FaPaperPlane size={13} /> Submit Audit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditEntry;
