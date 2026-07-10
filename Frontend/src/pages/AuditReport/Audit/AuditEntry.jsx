import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
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
  FaCamera,
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
  FaFileAlt,
  FaHourglassHalf,
  FaSync,
  FaTools,
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
import { ROLES } from "../../../config/routes.config";

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
  rework: {
    label: "Rework",
    color: "orange",
    icon: FaSync,
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
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

const canUseGetUserMedia = () =>
  window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

const ImageZone = ({ onFile, uploadRef }) => {
  const [open, setOpen]         = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showCam, setShowCam]   = useState(false);
  const zoneRef        = useRef(null);
  const videoRef       = useRef(null);
  const streamRef      = useRef(null);
  const nativeCamRef   = useRef(null);
  const localUploadRef = useRef(null);

  // uploadRef comes in as a plain callback (parent stores the node in a ref
  // map keyed by cell, used later to reset .value after upload) — mirror the
  // node into it while also keeping a local ref we can call .click() on.
  const setUploadRef = (el) => {
    localUploadRef.current = el;
    if (typeof uploadRef === "function") uploadRef(el);
    else if (uploadRef) uploadRef.current = el;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (zoneRef.current && !zoneRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Attach stream to video element after camera modal opens
  useEffect(() => {
    if (showCam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [showCam]);

  // Stop stream on unmount
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile({ target: { files: [file] } });
  };

  const startCamera = async () => {
    setOpen(false);

    if (!canUseGetUserMedia()) {
      nativeCamRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setShowCam(true);
    } catch {
      nativeCamRef.current?.click();
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setShowCam(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      onFile({ target: { files: [file] } });
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  return (
    <>
      {/* ── Trigger button + dropdown ───────────────────────────────────── */}
      <div
        ref={zoneRef}
        className="relative flex flex-col items-center"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed rounded-xl cursor-pointer transition-all focus:outline-none ${
            dragging ? "border-blue-500 bg-blue-50 scale-105"
            : open    ? "border-indigo-400 bg-indigo-50"
            :           "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50"
          }`}
          title="Add photo"
        >
          <FaCamera size={18} className={open || dragging ? "text-indigo-500" : "text-gray-400"} />
          <span className="text-[9px] text-gray-400 mt-1 font-medium">Add Photo</span>
        </button>

        {/* Hidden file inputs — kept permanently mounted (not inside the
            dropdown below) so they survive `open` flipping to false. The
            native camera intent can take several seconds; if these lived
            inside the conditional dropdown, React would unmount them the
            moment the dropdown closes and the returning photo's change
            event would have no element left to land on. */}
        <input ref={setUploadRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onFile} />
        <input ref={nativeCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

        {open && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-38 min-w-[140px]">
            {/* Upload from file */}
            <button
              type="button"
              onClick={() => { setOpen(false); localUploadRef.current?.click(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 transition-colors"
            >
              <FaCloudUploadAlt size={13} className="text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-700">Upload File</span>
            </button>
            <div className="h-px bg-gray-100 mx-3" />
            {/* Open camera via getUserMedia */}
            <button
              type="button"
              onClick={startCamera}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 transition-colors"
            >
              <FaCamera size={13} className="text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-700">Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Camera modal ────────────────────────────────────────────────── */}
      {showCam && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[200] p-4">
          <p className="text-white text-sm font-semibold mb-3">Point the camera and click Capture</p>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="rounded-xl max-w-full max-h-[65vh] bg-black"
          />
          <div className="flex items-center gap-4 mt-5">
            <button
              type="button"
              onClick={stopCamera}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-sm transition border border-white/20"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-lg flex items-center gap-2"
            >
              <FaCamera size={14} /> Capture
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ==================== MAIN COMPONENT ====================
const AuditEntry = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const templateId    = searchParams.get("template");
  const serialFromUrl = searchParams.get("serial") || "";
  const { user } = useSelector((store) => store.auth);

  // Capture the moment the operator opened the audit form
  const startedAtRef = useRef(new Date().toISOString());

  const {
    getTemplateById,
    getAuditById,
    createAudit,
    updateAudit,
    approveAudit,
    rejectAudit,
  } = useAuditData();

  const userRoles = [user?.role, user?.roleName]
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase());
  const isAdmin          = userRoles.includes(ROLES.SUPER_ADMIN);
  const isLQE            = userRoles.includes(ROLES.LINE_QUALITY_ENGINEER);
  const isQualityAuditor = userRoles.includes(ROLES.QUALITY_AUDITOR);

  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle");
  const [initialLoading, setInitialLoading] = useState(true);
  const [template, setTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Approval modal (used by Line Quality Engineer)
  const [approvalModal, setApprovalModal]     = useState({ open: false, action: null });
  const [approvalComments, setApprovalComments] = useState("");
  const [approving, setApproving]             = useState(false);

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
    createdBy: "",
    approvalComments: "",
    startedAt: "",
    submittedAt: "",
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
      toast.success(`Model found: ${first.label}`);
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
      toast.success("Image uploaded!");
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
              createdBy: audit.createdBy || "",
              approvalComments: audit.approvalComments || "",
              startedAt: audit.startedAt || "",
              submittedAt: audit.submittedAt || "",
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
            // Check if template is approved (admin can use any template)
            if (!isAdmin && tmpl.approvalStatus !== "approved") {
              toast.error("Template is not approved. Please use an approved template.");
              navigate("/auditreport/templates");
              return;
            }
            setTemplate(tmpl);
            const todayDate = getCurrentDate();
            const shift = getCurrentShift();
            setAuditData({
              templateId: tmpl.id,
              templateName: tmpl.name,
              reportName: tmpl.name,
              formatNo: tmpl.headerConfig?.defaultFormatNo || "",
              revNo: tmpl.headerConfig?.defaultRevNo || "",
              revDate: tmpl.headerConfig?.defaultRevDate || "",
              notes: "",
              status: "submitted",
            });
            const initialInfoData = {};
            tmpl.infoFields?.forEach((field) => {
              if (field.id === "date") {
                initialInfoData[field.id] = todayDate;
              } else if (field.id === "shift") {
                initialInfoData[field.id] = shift.value;
              } else if (field.id === "serialNo" || field.id === "serial") {
                initialInfoData[field.id] = serialFromUrl;
              } else {
                initialInfoData[field.id] = "";
              }
            });

            // Pre-fill serial from URL — the debounce + RTK Query will
            // automatically fetch and populate modelName from MaterialBarcode
            if (serialFromUrl) {
              setSerialNo(serialFromUrl);
            }

            setInfoData(initialInfoData);
            setSections(migrateTemplateStructure(tmpl.defaultSections));
            setSignatures({
              auditor: {
                name: user?.name || user?.userCode || user?.usercode || "",
                date: todayDate,
              },
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

  // ── Permissions (recalculate whenever auditData or user changes) ─────────────
  const isOwner = !!id && !!auditData.createdBy &&
    (user?.userCode === auditData.createdBy || user?.name === auditData.createdBy ||
     user?.usercode === auditData.createdBy);

  const canEdit =
    !['approved', 'rejected'].includes(auditData.status) &&        // approved/rejected = read-only for everyone
    (
      !id ||                                                        // new audit
      (isAdmin && auditData.status !== 'submitted') ||             // admin can edit draft/rework only
      (['draft', 'rework'].includes(auditData.status) && (isOwner || isAdmin || isQualityAuditor))
    );

  // LQE or Super Admin reviewing a submitted audit (never the Quality Auditor)
  const isLQEReview = !!id && !isQualityAuditor && (isLQE || isAdmin) && auditData.status === 'submitted';

  // Force preview-mode (read-only) when the user cannot edit
  useEffect(() => {
    if (!initialLoading && id && !canEdit) setShowPreview(true);
  }, [initialLoading, canEdit, id]);

  // ── Approval handlers (Line Quality Engineer) ────────────────────────────────
  const handleAuditApproval = async () => {
    if (!id) return;
    const isApprove = approvalModal.action === 'approve';
    const isRework  = approvalModal.action === 'rework';
    if (!isApprove && !approvalComments.trim()) {
      toast.error(isRework ? "Rework instructions are required" : "Rejection reason is required");
      return;
    }
    setApproving(true);
    try {
      const payload = {
        approverName: user?.name || user?.userCode || user?.usercode || "LQE",
        comments: approvalComments.trim() || null,
      };
      if (isApprove) {
        await approveAudit(id, payload);
        toast.success("Audit approved successfully");
      } else if (isRework) {
        await rejectAudit(id, { ...payload, isRework: true });
        toast.success("Audit sent for rework — returned to quality auditor for correction");
      } else {
        await rejectAudit(id, payload);
        toast.success("Audit rejected — returned to operator for correction");
      }
      setApprovalModal({ open: false, action: null });
      setApprovalComments("");
      navigate("/auditreport/audits");
    } catch (err) {
      toast.error(err.message || "Action failed");
    } finally {
      setApproving(false);
    }
  };

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
    toast.success(`All checkpoints set to "${STATUS_CONFIG[status]?.label}"`);
  };

  const toggleSection = (sectionId) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // "section" is shown as a sticky group-header bar outside the table.
  // Including it in visibleColumns creates a <th> with no matching <td> (body returns null),
  // which shifts every body column one position right — making specification appear blank.
  const visibleColumns = template?.columns?.filter((col) => col.visible && col.id !== "section") || [];

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

  // Filter checkpoints
  const filterCheckpoint = (cp) => {
    // When status is 'rework', automatically filter to show only failed checkpoints
    const effectiveFilter = auditData.status === 'rework' ? 'fail' : checkpointFilter;
    if (effectiveFilter !== "all" && cp.status !== effectiveFilter)
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
        startedAt: auditData.startedAt || startedAtRef.current,
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

  // Save as Draft
  const handleSaveAsDraft = async () => {
    if (!auditData.templateId) {
      toast.error("Template is required");
      return;
    }

    setSaving(true);
    setAutoSaveStatus("saving");
    try {
      const finalInfoData = {
        ...infoData,
        serialNo: serialNo.trim() || "",
        serial: serialNo.trim() || "",
        shift: infoData.shift || currentShift.value,
        date: infoData.date || currentDate,
      };
      const auditPayload = {
        templateId: parseInt(auditData.templateId, 10),
        templateName: auditData.templateName,
        reportName: auditData.reportName || "Draft Audit",
        formatNo: auditData.formatNo || null,
        revNo: auditData.revNo || null,
        revDate: auditData.revDate || null,
        notes: auditData.notes || null,
        status: "draft",
        startedAt: auditData.startedAt || startedAtRef.current,
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
      toast.success("Audit saved as draft");
      setTimeout(() => navigate("/auditreport/audits"), 500);
    } catch (error) {
      console.error("Save as draft error:", error);
      setAutoSaveStatus("error");
      toast.error(error.message || "Error saving audit as draft.");
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
                    ? "Fetching model data…"
                    : !serialNo
                      ? "Enter serial number first"
                      : infoData.modelName
                        ? `Code: ${infoData.modelCode || "N/A"}`
                        : debouncedSerial
                          ? "No model found"
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
              Auto: {currentShift.label}
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
              Auto: Today's Date
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
            <ImageZone
              uploadRef={(el) => (fileInputRefs.current[refKey] = el)}
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
    <div className="min-h-screen bg-gray-50 font-sans">
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
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 text-gray-700">
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
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 w-full">
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

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                <FaCalendarAlt size={10} /> {formatDateForDisplay(currentDate)}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100 flex items-center gap-1">
                <FaClock size={10} /> {currentShift.label}
              </span>
              {/* Audit Start Time */}
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center gap-1" title="Audit started at">
                <FaClock size={10} />
                Start: {new Date(auditData.startedAt || startedAtRef.current).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </span>
              {/* Audit End / Submitted Time */}
              {auditData.submittedAt && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1" title="Audit submitted at">
                  <FaCheckCircle size={10} />
                  End: {new Date(auditData.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              )}
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

            {/* Preview/Edit toggle — only when user can edit */}
            {canEdit && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all border ${
                  showPreview
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                }`}
              >
                {showPreview ? (
                  <><FaEdit size={12} /> Edit</>
                ) : (
                  <><FaEye size={12} /> Preview</>
                )}
              </button>
            )}

            {/* LQE: Reject / Rework / Approve buttons */}
            {isLQEReview && (
              <>
                <button
                  onClick={() => { setApprovalComments(""); setApprovalModal({ open: true, action: 'reject' }); }}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-red-200"
                >
                  <FaTimesCircle size={12} /> Reject
                </button>
                <button
                  onClick={() => { setApprovalComments(""); setApprovalModal({ open: true, action: 'rework' }); }}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-orange-200"
                >
                  <FaTools size={12} /> Rework
                </button>
                <button
                  onClick={() => { setApprovalComments(""); setApprovalModal({ open: true, action: 'approve' }); }}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-emerald-200"
                >
                  <FaCheckCircle size={12} /> Approve
                </button>
              </>
            )}

            {/* Save / Submit — only for editable audits */}
            {canEdit && (
              <>
                <button
                  onClick={handleSaveAsDraft}
                  disabled={saving || isLoadingModels}
                  className="flex items-center gap-2 px-5 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-gray-200"
                >
                  {saving ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                  ) : (
                    <><FaFileAlt size={12} /> Save as Draft</>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* ==================== MAIN LAYOUT ==================== */}
      <div className="w-full px-4 py-4 space-y-4">
        {/* ==================== TOP SUMMARY PANELS ==================== */}
        <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(420px,1fr)_minmax(260px,360px)] gap-4">
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
              <div className="flex flex-wrap gap-2">
                {["all", "pending", "pass", "fail", "warning", "na"].map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setCheckpointFilter(f)}
                      className={`min-w-[116px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-3 ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2 max-h-28 overflow-y-auto pr-1">
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
        </div>

        {/* ==================== MAIN CONTENT ==================== */}
        <div className="min-w-0">

          {/* ── Status Banner ─────────────────────────────────────────────── */}
          {id && auditData.status === 'draft' && (
            <div className="mb-3 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
              <FaFileAlt className="text-gray-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-gray-800">Draft — Work in Progress</p>
                <p className="text-xs text-gray-600 mt-0.5">This audit is saved as a draft. You can continue editing and submit for approval when ready.</p>
              </div>
            </div>
          )}

          {id && auditData.status === 'submitted' && !isLQEReview && (
            <div className="mb-3 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
              <FaHourglassHalf className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-800">Submitted — Pending Approval</p>
                <p className="text-xs text-amber-600 mt-0.5">This audit has been submitted to the Line Quality Engineer for review. Editing is locked until a decision is made.</p>
              </div>
            </div>
          )}
          {id && auditData.status === 'submitted' && isLQEReview && (
            <div className="mb-3 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
              <FaUserCheck className="text-blue-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-blue-800">Pending Your Approval</p>
                <p className="text-xs text-blue-600 mt-0.5">Review the audit below and use the Approve / Reject buttons in the header.</p>
              </div>
            </div>
          )}
          {id && auditData.status === 'rejected' && (
            <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm">
              <div className="flex items-center gap-2 mb-1">
                <FaTimesCircle className="text-red-500 flex-shrink-0" />
                <p className="font-bold text-red-800">Rejected — Corrections Required</p>
              </div>
              {auditData.approvalComments && (
                <div className="mt-2 ml-5 px-3 py-2 bg-red-100 border border-red-200 rounded-lg">
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-0.5">Rejection Remark</p>
                  <p className="text-xs text-red-700 font-medium">{auditData.approvalComments}</p>
                </div>
              )}
              <p className="text-xs text-red-500 mt-2 ml-5">Please make the necessary corrections and resubmit.</p>
            </div>
          )}
          {id && auditData.status === 'rework' && (
            <div className="mb-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm">
              <div className="flex items-center gap-2 mb-1">
                <FaSync className="text-orange-500 flex-shrink-0" />
                <p className="font-bold text-orange-800">Rework Required — Failed Checkpoints Need Correction</p>
              </div>
              {auditData.approvalComments && (
                <div className="mt-2 ml-5 px-3 py-2 bg-orange-100 border border-orange-200 rounded-lg">
                  <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-0.5">Rework Instructions</p>
                  <p className="text-xs text-orange-700 font-medium">{auditData.approvalComments}</p>
                </div>
              )}
              <p className="text-xs text-orange-500 mt-2 ml-5">Please recheck the failed checkpoints in the rework section below and resubmit.</p>
            </div>
          )}
          {id && auditData.status === 'approved' && (
            <div className="mb-3 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
              <FaCheckCircle className="text-emerald-500 flex-shrink-0" />
              <p className="font-bold text-emerald-800">Approved — This audit has been approved and is now read-only.</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* ==================== REPORT HEADER ==================== */}
            <div className="grid grid-cols-1 md:grid-cols-3 border-b border-gray-100">
              <div className="md:col-span-2 bg-indigo-50 border-r border-indigo-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-100 rounded-xl flex-shrink-0">
                    <HiClipboardDocumentCheck className="text-2xl text-indigo-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900 leading-tight">
                      {auditData.reportName || "Audit Report"}
                    </h1>
                    <p className="text-indigo-500 text-sm mt-1">
                      Template: {auditData.templateName}
                    </p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="px-2.5 py-1 bg-white border border-indigo-100 rounded-full text-xs text-indigo-700 font-semibold">
                        {summary.total} Checkpoints
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-xs text-emerald-700 font-semibold">
                        {summary.pass} Passed
                      </span>
                      {summary.fail > 0 && (
                        <span className="px-2.5 py-1 bg-red-50 border border-red-100 rounded-full text-xs text-red-600 font-semibold">
                          {summary.fail} Failed
                        </span>
                      )}
                      {summary.pending > 0 && (
                        <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs text-amber-700 font-semibold">
                          {summary.pending} Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white divide-y divide-gray-100">
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
                {/* Audit Start */}
                <div className="p-3.5 flex items-center gap-3">
                  <FaClock className="text-lg text-indigo-500 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                      Audit Start
                    </span>
                    <span className="font-bold text-gray-700 text-sm">
                      {(() => {
                        const t = auditData.startedAt || startedAtRef.current;
                        return t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
                      })()}
                    </span>
                  </div>
                </div>
                {/* Audit End */}
                <div className="p-3.5 flex items-center gap-3">
                  <FaCheckCircle className="text-lg text-emerald-500 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                      Audit End
                    </span>
                    <span className="font-bold text-gray-700 text-sm">
                      {auditData.submittedAt
                        ? new Date(auditData.submittedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
                        : "—"}
                    </span>
                  </div>
                </div>
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
                  <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 sticky top-[57px] z-20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="p-1 hover:bg-indigo-100 rounded transition text-indigo-400"
                      >
                        {isCollapsed ? (
                          <FaChevronDown size={11} />
                        ) : (
                          <FaChevronUp size={11} />
                        )}
                      </button>
                      <span className="font-black text-sm text-indigo-800 truncate">
                        {section.sectionName || "Unnamed Section"}
                      </span>
                      <span className="text-indigo-400 text-xs flex-shrink-0">
                        {sectionStats.total} checks
                      </span>
                      <div className="hidden sm:flex items-center gap-1 text-xs">
                        {sectionStats.pass > 0 && (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                            {sectionStats.pass} pass
                          </span>
                        )}
                        {sectionStats.fail > 0 && (
                          <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                            {sectionStats.fail} fail
                          </span>
                        )}
                        {sectionStats.warning > 0 && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                            {sectionStats.warning} warn
                          </span>
                        )}
                        {sectionStats.pending > 0 && (
                          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                            {sectionStats.pending} pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bulk Actions */}
                    {!showPreview && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-indigo-300 mr-1 hidden sm:inline">
                          Bulk:
                        </span>
                        {[
                          {
                            status: "pass",
                            icon: FaCheckDouble,
                            color: "hover:bg-emerald-100 text-emerald-600",
                            title: "All Pass",
                          },
                          {
                            status: "fail",
                            icon: FaTimesCircle,
                            color: "hover:bg-red-100 text-red-500",
                            title: "All Fail",
                          },
                          {
                            status: "warning",
                            icon: FaExclamationTriangle,
                            color: "hover:bg-amber-100 text-amber-500",
                            title: "All Warning",
                          },
                          {
                            status: "na",
                            icon: FaBan,
                            color: "hover:bg-blue-100 text-blue-500",
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
                    <div className="px-4 py-2 bg-indigo-50/50 text-xs text-indigo-400 flex items-center justify-between border-b border-indigo-100">
                      <span>{sectionStats.total} checkpoints hidden</span>
                      <span>{sectionPct}% complete</span>
                    </div>
                  )}

                  {/* Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            {visibleColumns.map((column) => (
                              <th
                                key={column.id}
                                className={`px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider border-r border-gray-100 last:border-r-0 whitespace-nowrap ${column.width} ${
                                  column.entryField || column.type === "image"
                                    ? "text-indigo-600 bg-indigo-50/60"
                                    : "text-gray-500 bg-gray-50"
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
                                                Pending
                                              </option>
                                              <option value="pass">Pass</option>
                                              <option value="fail">Fail</option>
                                              <option value="warning">
                                                Warning
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
            <div className="border-t border-gray-100 grid grid-cols-1 md:grid-cols-2">
              {/* Auditor */}
              <div className="px-6 py-5 flex items-center gap-6 border-r border-gray-100">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <FaUserCheck className="text-indigo-500" />
                  <span className="text-sm font-bold text-gray-700">Auditor</span>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Name</p>
                    <p className="text-sm font-semibold text-gray-800">{signatures.auditor?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
                    <p className="text-sm font-semibold text-gray-800">{formatDateForDisplay(signatures.auditor?.date) || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Approver */}
              <div className="px-6 py-5 flex items-center gap-6">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <FaUserShield className="text-purple-500" />
                  <span className="text-sm font-bold text-gray-700">Approved By</span>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Name</p>
                    <p className="text-sm font-semibold text-gray-800">{signatures.approver?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
                    <p className="text-sm font-semibold text-gray-800">{formatDateForDisplay(signatures.approver?.date) || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ==================== LQE INLINE REVIEW PANEL ==================== */}
            {isLQEReview && (
              <div className="border-t border-blue-100 bg-blue-50/40 px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <FaUserCheck className="text-blue-500" />
                  <h3 className="text-sm font-black text-blue-800">Review Decision</h3>
                  <span className="text-xs text-blue-500 ml-1">— Add remarks and approve or reject this audit</span>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">
                    Remarks <span className="text-red-400 font-normal normal-case">(required for rejection)</span>
                  </label>
                  <textarea
                    value={approvalComments}
                    onChange={(e) => setApprovalComments(e.target.value)}
                    placeholder="Add review remarks or rejection reason…"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none transition-all bg-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (!approvalComments.trim()) { toast.error("Rejection reason is required"); return; }
                      setApprovalModal({ open: true, action: 'reject' });
                    }}
                    disabled={approving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 shadow-sm shadow-red-200"
                  >
                    <FaTimesCircle size={13} /> Reject Audit
                  </button>
                  <button
                    onClick={() => setApprovalModal({ open: true, action: 'rework' })}
                    disabled={approving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 shadow-sm shadow-orange-200"
                  >
                    <FaTools size={13} /> Send for Rework
                  </button>
                  <button
                    onClick={() => setApprovalModal({ open: true, action: 'approve' })}
                    disabled={approving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 shadow-sm shadow-emerald-200"
                  >
                    <FaCheckCircle size={13} /> Approve Audit
                  </button>
                </div>
              </div>
            )}

            {/* ==================== FOOTER SUBMIT ==================== */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {summary.pending > 0
                  ? `${summary.pending} checkpoint${summary.pending !== 1 ? "s" : ""} still pending`
                  : "All checkpoints reviewed"}
              </p>
              {canEdit ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveAsDraft}
                    disabled={saving || isLoadingModels}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-gray-200/60"
                  >
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                    ) : (
                      <><FaFileAlt size={13} /> Save as Draft</>
                    )}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || isLoadingModels}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200/60"
                  >
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                    ) : (
                      <><FaPaperPlane size={13} /> Submit Audit</>
                    )}
                  </button>
                </div>
              ) : isLQEReview ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setApprovalComments(""); setApprovalModal({ open: true, action: 'reject' }); }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all"
                  >
                    <FaTimesCircle size={13} /> Reject
                  </button>
                  <button
                    onClick={() => { setApprovalComments(""); setApprovalModal({ open: true, action: 'rework' }); }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all"
                  >
                    <FaTools size={13} /> Rework
                  </button>
                  <button
                    onClick={() => { setApprovalComments(""); setApprovalModal({ open: true, action: 'approve' }); }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all"
                  >
                    <FaCheckCircle size={13} /> Approve Audit
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== Approval Modal (LQE) ==================== */}
      {approvalModal.open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setApprovalModal({ open: false, action: null })}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 text-white ${
              approvalModal.action === 'approve' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700'
              : approvalModal.action === 'rework'  ? 'bg-gradient-to-r from-orange-500 to-orange-600'
              : 'bg-gradient-to-r from-red-600 to-red-700'
            }`}>
              <h3 className="text-lg font-bold flex items-center gap-2">
                {approvalModal.action === 'approve' ? <FaCheckCircle /> : approvalModal.action === 'rework' ? <FaTools /> : <FaTimesCircle />}
                {approvalModal.action === 'approve' ? 'Approve Audit' : approvalModal.action === 'rework' ? 'Send for Rework' : 'Reject Audit'}
              </h3>
              <p className="text-xs mt-1 opacity-80">
                {approvalModal.action === 'approve'
                  ? 'Confirm approval. The audit will be marked as approved and locked.'
                  : approvalModal.action === 'rework'
                  ? 'Specify what needs to be corrected. The audit will be returned to the quality auditor.'
                  : 'Provide a reason. The audit will be returned to the operator for correction.'}
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  {approvalModal.action === 'approve' ? 'Comments (optional)' : approvalModal.action === 'rework' ? 'Rework Instructions *' : 'Rejection Reason *'}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={
                    approvalModal.action === 'approve' ? 'Add any approval notes…'
                    : approvalModal.action === 'rework' ? 'Describe which checkpoints need to be rechecked…'
                    : 'Describe what needs to be corrected…'
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setApprovalModal({ open: false, action: null })}
                  disabled={approving}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAuditApproval}
                  disabled={approving || (['reject', 'rework'].includes(approvalModal.action) && !approvalComments.trim())}
                  className={`px-5 py-2 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    approvalModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700'
                    : approvalModal.action === 'rework' ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {approving ? 'Processing…' : approvalModal.action === 'approve' ? 'Confirm Approve' : approvalModal.action === 'rework' ? 'Send for Rework' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditEntry;
