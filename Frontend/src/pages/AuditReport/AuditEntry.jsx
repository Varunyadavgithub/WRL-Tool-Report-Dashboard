import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaIdBadge,
  FaStickyNote,
  FaClipboardCheck,
  FaSave,
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
} from "react-icons/fa";
import { MdFormatListNumbered, MdUpdate, MdDateRange } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../hooks/useAuditData";
import { useGetModelVariantsByAssemblyQuery } from "../../redux/api/commonApi.js";
import toast from "react-hot-toast";
import { getCurrentShift } from "../../utils/shiftUtils.js";

// Get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  return new Date().toISOString().split("T")[0];
};

// Format date for display (DD/MM/YYYY)
const formatDateForDisplay = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
};

// Generate unique IDs
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [template, setTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Serial number state for API call
  const [serialNo, setSerialNo] = useState("");
  const [debouncedSerial, setDebouncedSerial] = useState("");
  const [modelFetched, setModelFetched] = useState(false);

  // Current shift and date state
  const [currentShift, setCurrentShift] = useState(getCurrentShift());
  const [currentDate, setCurrentDate] = useState(getCurrentDate());

  // Update shift every minute to keep it accurate
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentShift(getCurrentShift());
      const newDate = getCurrentDate();
      if (newDate !== currentDate) {
        setCurrentDate(newDate);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [currentDate]);

  // Debounce serial number input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (serialNo.trim() && serialNo.length >= 3) {
        setDebouncedSerial(serialNo.trim());
      } else {
        setDebouncedSerial("");
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [serialNo]);

  // RTK Query hook for fetching model variants
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
    status: "draft",
  });

  // Info fields data
  const [infoData, setInfoData] = useState({});

  // Sections data with stages and checkpoints
  const [sections, setSections] = useState([]);

  // Signature data
  const [signatures, setSignatures] = useState({
    auditor: { name: "", date: "" },
    reviewer: { name: "", date: "" },
    approver: { name: "", date: "" },
  });

  // Auto-populate model when serial number returns data
  useEffect(() => {
    if (modelVariants && modelVariants.length > 0 && !modelFetched) {
      const firstModel = modelVariants[0];
      setInfoData((prev) => ({
        ...prev,
        serialNo: serialNo,
        modelName: firstModel.label,
        modelCode: firstModel.value,
      }));
      setModelFetched(true);
      toast.success(`Model found: ${firstModel.label}`);
    } else if (modelVariants && modelVariants.length === 0 && debouncedSerial) {
      toast.error("No model found for this serial number");
    }
  }, [modelVariants, serialNo, debouncedSerial, modelFetched]);

  // Handle model error
  useEffect(() => {
    if (isModelError && debouncedSerial) {
      toast.error("Failed to fetch model for this serial number");
    }
  }, [isModelError, debouncedSerial]);

  // Helper function to migrate old template structure to new structure
  const migrateTemplateStructure = useCallback((templateSections) => {
    if (!templateSections || !Array.isArray(templateSections)) {
      return [];
    }

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

  // Helper function to migrate audit sections
  const migrateAuditSections = useCallback((auditSections) => {
    if (!auditSections || !Array.isArray(auditSections)) {
      return [];
    }

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
          // Editing existing audit
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
              status: audit.status || "draft",
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
          // Creating new audit from template
          const tmpl = await getTemplateById(templateId);
          if (tmpl) {
            setTemplate(tmpl);
            setAuditData({
              templateId: tmpl.id,
              templateName: tmpl.name,
              reportName: tmpl.name,
              formatNo: tmpl.headerConfig?.defaultFormatNo || "",
              revNo: tmpl.headerConfig?.defaultRevNo || "",
              revDate: getCurrentDate(),
              notes: "",
              status: "draft",
            });

            const shift = getCurrentShift();
            const todayDate = getCurrentDate();

            const initialInfoData = {};
            tmpl.infoFields?.forEach((field) => {
              if (field.id === "date") {
                initialInfoData[field.id] = todayDate;
              } else if (field.id === "shift") {
                initialInfoData[field.id] = shift.value;
              } else {
                initialInfoData[field.id] = "";
              }
            });
            setInfoData(initialInfoData);

            const initialSections = migrateTemplateStructure(
              tmpl.defaultSections,
            );
            setSections(initialSections);

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
  }, [
    id,
    templateId,
    getAuditById,
    getTemplateById,
    migrateAuditSections,
    migrateTemplateStructure,
    navigate,
  ]);

  // Handle serial number change
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

  // Handle model selection from dropdown
  const handleModelSelect = useCallback(
    (modelValue) => {
      const selectedModel = modelVariants?.find((m) => m.value === modelValue);
      if (selectedModel) {
        setInfoData((prev) => ({
          ...prev,
          modelName: selectedModel.label,
          modelCode: selectedModel.value,
        }));
      }
    },
    [modelVariants],
  );

  // Handle info field change
  const handleInfoChange = useCallback(
    (fieldId, value) => {
      if (fieldId === "serialNo" || fieldId === "serial") {
        handleSerialChange(value);
      } else {
        setInfoData((prev) => ({ ...prev, [fieldId]: value }));
      }
    },
    [handleSerialChange],
  );

  // Handle notes change
  const handleNotesChange = useCallback((value) => {
    setAuditData((prev) => ({ ...prev, notes: value }));
  }, []);

  // Handle checkpoint entry field change
  const handleEntryFieldChange = useCallback(
    (sectionId, stageId, checkpointId, field, value) => {
      const allowedFields = ["observation", "remark", "status"];
      if (!allowedFields.includes(field)) {
        return;
      }

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

  // Handle signature change
  const handleSignatureChange = useCallback((role, field, value) => {
    setSignatures((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: value,
      },
    }));
  }, []);

  // Get visible columns from template
  const visibleColumns = template?.columns?.filter((col) => col.visible) || [];

  // Get status badge
  const getStatusBadge = useCallback((status) => {
    switch (status) {
      case "pass":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <FaCheckCircle /> Pass
          </span>
        );
      case "fail":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <FaTimesCircle /> Fail
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <FaExclamationTriangle /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            Pending
          </span>
        );
    }
  }, []);

  // Calculate total checkpoints in a section
  const getSectionTotalCheckpoints = useCallback((section) => {
    if (!section.stages) return 0;
    return section.stages.reduce(
      (total, stage) => total + (stage.checkPoints?.length || 0),
      0,
    );
  }, []);

  // Calculate summary
  const getSummary = useCallback(() => {
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0;
    sections.forEach((section) => {
      section.stages?.forEach((stage) => {
        stage.checkPoints?.forEach((cp) => {
          if (cp.status === "pass") pass++;
          else if (cp.status === "fail") fail++;
          else if (cp.status === "warning") warning++;
          else pending++;
        });
      });
    });
    return {
      pass,
      fail,
      warning,
      pending,
      total: pass + fail + warning + pending,
    };
  }, [sections]);

  const summary = getSummary();

  // ========== FIXED SAVE FUNCTION ==========
  const handleSave = async (asDraft = true) => {
    // Validation
    if (!serialNo.trim()) {
      toast.error("Please enter a Serial Number");
      return;
    }

    if (!infoData.modelName) {
      toast.error("Please wait for model to be fetched or select a model");
      return;
    }

    // Additional validation
    if (!auditData.templateId) {
      toast.error("Template is required");
      return;
    }

    if (!auditData.reportName?.trim()) {
      toast.error("Report name is required");
      return;
    }

    setSaving(true);
    try {
      const currentSummary = getSummary();

      // Prepare infoData with all required fields
      const finalInfoData = {
        ...infoData,
        serialNo: serialNo.trim(),
        serial: serialNo.trim(),
        shift: infoData.shift || currentShift.value,
        date: infoData.date || currentDate,
      };

      // ✅ FIXED: Send camelCase keys to match backend expectations
      const auditPayload = {
        templateId: parseInt(auditData.templateId, 10), // Ensure integer
        templateName: auditData.templateName,
        reportName: auditData.reportName,
        formatNo: auditData.formatNo || null,
        revNo: auditData.revNo || null,
        revDate: auditData.revDate || null,
        notes: auditData.notes || null,
        status: asDraft ? "draft" : "submitted",
        infoData: finalInfoData,
        sections: sections,
        signatures: signatures, // ✅ Now handled by backend
        columns: template?.columns || [],
        infoFields: template?.infoFields || [],
        headerConfig: template?.headerConfig || {},
      };

      console.log("Saving audit payload:", auditPayload);

      let result;
      if (id) {
        result = await updateAudit(id, auditPayload);
        console.log("Update result:", result);
      } else {
        result = await createAudit(auditPayload);
        console.log("Create result:", result);
      }

      toast.success(
        asDraft ? "Audit saved as draft!" : "Audit submitted successfully!",
      );

      // Small delay before navigation to ensure state is updated
      setTimeout(() => {
        navigate("/auditreport/audits");
      }, 500);
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.message || "Error saving audit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Get field icon
  const getFieldIcon = useCallback((fieldId) => {
    switch (fieldId) {
      case "modelName":
        return <BiSolidFactory className="text-lg text-indigo-600" />;
      case "serialNo":
      case "serial":
        return <FaBarcode className="text-lg text-purple-600" />;
      case "date":
        return <FaCalendarAlt className="text-lg text-red-500" />;
      case "shift":
        return <FaClock className="text-lg text-orange-500" />;
      case "eid":
        return <FaIdBadge className="text-lg text-teal-600" />;
      default:
        return <FaClipboardCheck className="text-lg text-gray-500" />;
    }
  }, []);

  // Render info field input (keeping your existing implementation)
  const renderInfoFieldInput = useCallback(
    (field) => {
      const value = infoData[field.id] || "";

      if (showPreview) {
        if (field.id === "date") {
          return (
            <span className="font-semibold text-gray-800">
              {formatDateForDisplay(value) || "-"}
            </span>
          );
        }
        return (
          <span className="font-semibold text-gray-800">{value || "-"}</span>
        );
      }

      // Handle serial number field
      if (field.id === "serialNo" || field.id === "serial") {
        return (
          <div className="relative">
            <input
              type="text"
              value={serialNo}
              onChange={(e) => handleSerialChange(e.target.value)}
              placeholder={`Enter ${field.name}`}
              className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none pr-8"
            />
            {(isLoadingModels || isFetchingModels) && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
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

      // Handle model name field
      if (field.id === "modelName") {
        return (
          <div className="relative">
            {modelVariants && modelVariants.length > 1 ? (
              <>
                <select
                  value={infoData.modelCode || ""}
                  onChange={(e) => handleModelSelect(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                >
                  <option value="">Select Model</option>
                  {modelVariants.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                {infoData.modelCode && (
                  <span className="text-xs text-red-600 mt-1 block font-medium">
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
                      ? "Loading..."
                      : !serialNo
                        ? "Enter serial first"
                        : "No model found"
                  }
                  className={`w-full font-semibold bg-gray-100 border-b border-gray-300 outline-none rounded px-2 py-1 ${
                    infoData.modelName ? "text-gray-800" : "text-gray-400"
                  }`}
                />
                {isLoadingModels || isFetchingModels ? (
                  <span className="text-xs text-red-600 mt-1 block font-medium">
                    Fetching model data...
                  </span>
                ) : !serialNo ? (
                  <span className="text-xs text-red-600 mt-1 block font-medium">
                    ⚠ Please enter serial number to auto-fetch model
                  </span>
                ) : !infoData.modelName && debouncedSerial ? (
                  <span className="text-xs text-red-600 mt-1 block font-medium">
                    ✗ No model found for this serial number
                  </span>
                ) : infoData.modelName ? (
                  <span className="text-xs text-red-600 mt-1 block font-medium">
                    ✓ Model Code: {infoData.modelCode || "N/A"}
                  </span>
                ) : (
                  <span className="text-xs text-red-600 mt-1 block font-medium">
                    ⚠ Waiting for serial number input...
                  </span>
                )}
              </>
            )}
          </div>
        );
      }

      // Handle shift field
      if (field.id === "shift") {
        return (
          <div className="relative">
            <input
              type="text"
              value={value || currentShift.value}
              readOnly
              className="w-full font-semibold text-gray-800 bg-orange-50 border-b border-orange-300 outline-none rounded px-2 py-1 cursor-not-allowed"
            />
            <span className="text-xs text-orange-600 mt-1 block">
              <FaClock className="inline text-xs mr-1" />
              Auto-detected: {currentShift.label}
            </span>
          </div>
        );
      }

      // Handle date field
      if (field.id === "date") {
        return (
          <div className="relative">
            <input
              type="text"
              value={formatDateForDisplay(value || currentDate)}
              readOnly
              className="w-full font-semibold text-gray-800 bg-red-50 border-b border-red-300 outline-none rounded px-2 py-1 cursor-not-allowed"
            />
            <span className="text-xs text-red-600 mt-1 block">
              <FaCalendarAlt className="inline text-xs mr-1" />
              Auto-detected: Today's Date
            </span>
          </div>
        );
      }

      // Default field types
      switch (field.type) {
        case "date":
          return (
            <input
              type="date"
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
            />
          );
        case "select":
          return (
            <select
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
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
              className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
            />
          );
        case "time":
          return (
            <input
              type="time"
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
            />
          );
        default:
          return (
            <input
              type="text"
              value={value}
              onChange={(e) => handleInfoChange(field.id, e.target.value)}
              placeholder={`Enter ${field.name}`}
              className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
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

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audit...</p>
        </div>
      </div>
    );
  }

  // No template selected
  if (!template && !id) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            No Template Selected
          </h2>
          <button
            onClick={() => navigate("/auditreport/templates")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Select a Template
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-gray-100/90 backdrop-blur border-b border-gray-200 shadow-sm p-4">
          <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/auditreport/audits")}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all"
              >
                <FaArrowLeft /> Back
              </button>
              <h1 className="text-xl font-bold text-gray-800">
                New Audit Entry
              </h1>
              {auditData.status && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    auditData.status === "draft"
                      ? "bg-gray-200 text-gray-700"
                      : auditData.status === "submitted"
                        ? "bg-blue-100 text-blue-700"
                        : auditData.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {auditData.status.charAt(0).toUpperCase() +
                    auditData.status.slice(1)}
                </span>
              )}
              {/* Current Date Indicator */}
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                <FaCalendarAlt /> {formatDateForDisplay(currentDate)}
              </span>
              {/* Current Shift Indicator */}
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
                <FaClock /> {currentShift.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  showPreview
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-gray-600 hover:bg-gray-700 text-white"
                }`}
              >
                {showPreview ? <FaEdit /> : <FaEye />}
                {showPreview ? "Edit Mode" : "Preview"}
              </button>

              <button
                onClick={() => handleSave(true)}
                disabled={saving || isLoadingModels}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FaSave /> Save Draft
                  </>
                )}
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving || isLoadingModels}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
              >
                <FaPaperPlane /> Submit
              </button>
            </div>
          </div>
        </div>

        {/* Main Report Container */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden border-2 border-gray-300 mt-4">
          {/* Header Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-gray-300">
            <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <HiClipboardDocumentCheck className="text-4xl text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {auditData.reportName || "Audit Report"}
                </h1>
                <p className="text-blue-200 text-sm mt-2">
                  Template: {auditData.templateName}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 divide-y divide-gray-300">
              {template?.headerConfig?.showFormatNo !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdFormatListNumbered className="text-xl text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">
                      Format No
                    </span>
                    <span className="font-semibold text-gray-800">
                      {auditData.formatNo || "-"}
                    </span>
                  </div>
                </div>
              )}
              {template?.headerConfig?.showRevNo !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdUpdate className="text-xl text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">Rev. No</span>
                    <span className="font-semibold text-gray-800">
                      {auditData.revNo || "-"}
                    </span>
                  </div>
                </div>
              )}
              {template?.headerConfig?.showRevDate !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdDateRange className="text-xl text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">
                      Rev. Date
                    </span>
                    <span className="font-semibold text-gray-800">
                      {formatDateForDisplay(auditData?.revDate) || "-"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Section - Dynamic Fields from Template */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b-2 border-gray-300 bg-gray-50">
            {template?.infoFields
              ?.filter((field) => field.visible)
              .map((field, index, arr) => (
                <div
                  key={field.id}
                  className={`p-4 ${
                    index < arr.length - 1
                      ? "border-r border-b md:border-b-0"
                      : ""
                  } border-gray-300`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getFieldIcon(field.id)}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {field.name}
                      {field.required && (
                        <span className="text-red-500">*</span>
                      )}
                    </span>
                  </div>
                  {renderInfoFieldInput(field)}
                </div>
              ))}
          </div>

          {/* Notes Section */}
          <div className="p-4 border-b-2 border-gray-300 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <FaStickyNote className="text-lg text-yellow-600" />
              <span className="font-semibold text-gray-700">Notes:</span>
            </div>
            {showPreview ? (
              <p className="text-gray-700 leading-relaxed pl-6">
                {auditData.notes || "No notes added."}
              </p>
            ) : (
              <textarea
                placeholder="Enter notes here..."
                value={auditData.notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                rows={3}
                className="w-full text-gray-700 bg-transparent border border-gray-300 rounded-lg p-2 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none resize-none"
              />
            )}
          </div>

          {/* Main Table Section */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-3 py-3 text-left font-semibold border-r border-gray-600 text-sm ${column.width} ${
                        column.entryField ? "bg-blue-900" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {column.name}
                        {column.entryField && (
                          <span className="text-xs text-blue-300 ml-1">
                            (Entry)
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => {
                  const sectionTotalRows = getSectionTotalCheckpoints(section);
                  let sectionRowRendered = false;

                  return section.stages?.map((stage) => {
                    let stageRowRendered = false;

                    return stage.checkPoints?.map(
                      (checkpoint, checkpointIndex) => {
                        const showSectionCell =
                          !sectionRowRendered && checkpointIndex === 0;
                        const showStageCell =
                          !stageRowRendered && checkpointIndex === 0;

                        if (showSectionCell && checkpointIndex === 0) {
                          sectionRowRendered = true;
                        }
                        if (showStageCell) stageRowRendered = true;

                        return (
                          <tr
                            key={`${section.id}-${stage.id}-${checkpoint.id}`}
                            className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                              checkpoint.status === "pass"
                                ? "bg-green-50"
                                : checkpoint.status === "fail"
                                  ? "bg-red-50"
                                  : checkpoint.status === "warning"
                                    ? "bg-yellow-50"
                                    : ""
                            }`}
                          >
                            {visibleColumns.map((column) => {
                              if (column.id === "section") {
                                if (
                                  showSectionCell &&
                                  section.stages.indexOf(stage) === 0
                                ) {
                                  return (
                                    <td
                                      key={column.id}
                                      className="px-3 py-2 font-bold bg-gray-100 border-r border-gray-300 text-center align-middle"
                                      rowSpan={sectionTotalRows}
                                    >
                                      <span className="text-red-700 text-sm font-semibold">
                                        {section.sectionName || "-"}
                                      </span>
                                    </td>
                                  );
                                }
                                return null;
                              }

                              if (column.id === "stage") {
                                if (showStageCell) {
                                  return (
                                    <td
                                      key={column.id}
                                      className="px-3 py-2 font-bold bg-indigo-50 border-r border-gray-300 text-center align-middle"
                                      rowSpan={stage.checkPoints.length}
                                    >
                                      <span className="text-indigo-700 text-sm font-semibold">
                                        {stage.stageName || "-"}
                                      </span>
                                    </td>
                                  );
                                }
                                return null;
                              }

                              if (column.id === "status") {
                                return (
                                  <td
                                    key={column.id}
                                    className="px-3 py-2 border-r border-gray-200 bg-blue-50"
                                  >
                                    {showPreview ? (
                                      getStatusBadge(checkpoint.status)
                                    ) : (
                                      <select
                                        value={checkpoint.status || "pending"}
                                        onChange={(e) =>
                                          handleEntryFieldChange(
                                            section.id,
                                            stage.id,
                                            checkpoint.id,
                                            "status",
                                            e.target.value,
                                          )
                                        }
                                        className={`w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-2 ${
                                          checkpoint.status === "pass"
                                            ? "bg-green-100 border-green-300 text-green-700 focus:ring-green-500"
                                            : checkpoint.status === "fail"
                                              ? "bg-red-100 border-red-300 text-red-700 focus:ring-red-500"
                                              : checkpoint.status === "warning"
                                                ? "bg-yellow-100 border-yellow-300 text-yellow-700 focus:ring-yellow-500"
                                                : "bg-gray-100 border-gray-300 text-gray-700 focus:ring-gray-500"
                                        }`}
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="pass">Pass</option>
                                        <option value="fail">Fail</option>
                                        <option value="warning">Warning</option>
                                      </select>
                                    )}
                                  </td>
                                );
                              }

                              if (column.entryField) {
                                return (
                                  <td
                                    key={column.id}
                                    className="px-3 py-2 border-r border-gray-200 bg-blue-50"
                                  >
                                    {showPreview ? (
                                      <span className="text-gray-700 text-sm">
                                        {checkpoint[column.id] || "-"}
                                      </span>
                                    ) : (
                                      <input
                                        type={
                                          column.type === "number"
                                            ? "number"
                                            : "text"
                                        }
                                        placeholder={`Enter ${column.name}`}
                                        value={checkpoint[column.id] || ""}
                                        onChange={(e) =>
                                          handleEntryFieldChange(
                                            section.id,
                                            stage.id,
                                            checkpoint.id,
                                            column.id,
                                            e.target.value,
                                          )
                                        }
                                        className="w-full text-sm text-gray-700 bg-white border border-blue-300 rounded px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                      />
                                    )}
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={column.id}
                                  className="px-3 py-2 border-r border-gray-200"
                                >
                                  <span className="text-gray-700 text-sm">
                                    {checkpoint[column.id] || "-"}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      },
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="p-4 bg-gray-100 border-t-2 border-gray-300">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FaClipboardCheck className="text-blue-600" />
              Audit Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm border">
                <div className="text-2xl font-bold text-gray-700">
                  {summary.total}
                </div>
                <span className="text-xs text-gray-500">Total Checks</span>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center shadow-sm border border-green-200">
                <div className="flex items-center justify-center gap-1 text-green-700 font-bold text-2xl">
                  <FaCheckCircle className="text-lg" />
                  {summary.pass}
                </div>
                <span className="text-xs text-green-600">Passed</span>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center shadow-sm border border-yellow-200">
                <div className="flex items-center justify-center gap-1 text-yellow-700 font-bold text-2xl">
                  <FaExclamationTriangle className="text-lg" />
                  {summary.warning}
                </div>
                <span className="text-xs text-yellow-600">Warnings</span>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm border border-red-200">
                <div className="flex items-center justify-center gap-1 text-red-700 font-bold text-2xl">
                  <FaTimesCircle className="text-lg" />
                  {summary.fail}
                </div>
                <span className="text-xs text-red-600">Failed</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-gray-500">
                  {summary.pending}
                </div>
                <span className="text-xs text-gray-500">Pending</span>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-t-2 border-gray-300">
            {/* Auditor Signature */}
            <div className="p-6 border-r border-b md:border-b-0 border-gray-300">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <FaUserCheck className="text-xl text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">
                  Auditor Signature
                </span>
              </div>
              {showPreview ? (
                <div className="text-center">
                  <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4">
                    <span className="text-gray-800 font-medium">
                      {signatures.auditor?.name || ""}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDateForDisplay(signatures.auditor?.date) || "Date"}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter name"
                      value={signatures.auditor?.name || ""}
                      onChange={(e) =>
                        handleSignatureChange("auditor", "name", e.target.value)
                      }
                      className="w-full text-sm text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={signatures.auditor?.date || ""}
                      onChange={(e) =>
                        handleSignatureChange("auditor", "date", e.target.value)
                      }
                      className="w-full text-sm text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Approved By */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <FaUserShield className="text-xl text-purple-600" />
                <span className="text-sm font-semibold text-gray-700">
                  Approved By
                </span>
              </div>
              {showPreview ? (
                <div className="text-center">
                  <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4">
                    <span className="text-gray-800 font-medium">
                      {signatures.approver?.name || ""}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDateForDisplay(signatures.approver?.date) || "Date"}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter name"
                      value={signatures.approver?.name || ""}
                      onChange={(e) =>
                        handleSignatureChange(
                          "approver",
                          "name",
                          e.target.value,
                        )
                      }
                      className="w-full text-sm text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={signatures.approver?.date || ""}
                      onChange={(e) =>
                        handleSignatureChange(
                          "approver",
                          "date",
                          e.target.value,
                        )
                      }
                      className="w-full text-sm text-gray-700 bg-white border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-gray-500 text-sm">
          <p>
            This document is confidential and intended for internal use only.
          </p>
          <p>
            Generated on {formatDateForDisplay(currentDate)} |{" "}
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuditEntry;
