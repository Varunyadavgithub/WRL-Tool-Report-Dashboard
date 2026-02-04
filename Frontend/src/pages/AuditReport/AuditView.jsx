import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  FaEdit,
  FaCheck,
  FaBan,
  FaHistory,
  FaBarcode,
  FaUserCheck,
  FaUserTie,
  FaUserShield,
  FaPrint,
} from "react-icons/fa";
import { MdFormatListNumbered, MdUpdate, MdDateRange } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../hooks/useAuditData";
import toast from "react-hot-toast";

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

// Format datetime for display
const formatDateTimeForDisplay = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "-";
  }
};

const AuditView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    getAuditById,
    approveAudit,
    rejectAudit,
    getAuditHistory,
    loading,
    error,
  } = useAuditData();

  const [audit, setAudit] = useState(null);
  const [template, setTemplate] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState("approve");
  const [approverName, setApproverName] = useState("");
  const [approvalComments, setApprovalComments] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load audit data
  useEffect(() => {
    const loadAudit = async () => {
      if (id) {
        setInitialLoading(true);
        try {
          const auditData = await getAuditById(id);
          if (auditData) {
            setAudit(auditData);
            setTemplate({
              columns: auditData.columns || [],
              infoFields: auditData.infoFields || [],
              headerConfig: auditData.headerConfig || {},
            });
          }
        } catch (err) {
          toast.error(`Failed to load audit: ${err.message}`);
          navigate("/auditreport/audits");
        } finally {
          setInitialLoading(false);
        }
      }
    };
    loadAudit();
  }, [id, getAuditById, navigate]);

  // Load audit history
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await getAuditHistory(id);
      setAuditHistory(history || []);
      setShowHistoryModal(true);
    } catch (err) {
      toast.error(`Failed to load audit history: ${err.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open approval modal
  const openApprovalModal = (action) => {
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  // Handle approval/rejection
  const handleApproval = async () => {
    if (!approverName.trim()) {
      toast.error("Please enter approver name");
      return;
    }

    if (approvalAction === "reject" && !approvalComments.trim()) {
      toast.error("Please enter rejection reason");
      return;
    }

    setActionLoading(true);
    try {
      let updatedAudit;
      const approvalData = {
        approverName: approverName,
        comments: approvalComments,
      };

      if (approvalAction === "approve") {
        updatedAudit = await approveAudit(id, approvalData);
      } else {
        updatedAudit = await rejectAudit(id, approvalData);
      }

      setAudit(updatedAudit);
      setShowApprovalModal(false);
      setApproverName("");
      setApprovalComments("");
      toast.success(
        `Audit ${approvalAction === "approve" ? "approved" : "rejected"} successfully!`,
      );
    } catch (err) {
      toast.error(`Failed to ${approvalAction} audit: ` + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
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

  // Get status badge for checkpoints
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

  // Get audit status badge
  const getAuditStatusBadge = useCallback((status) => {
    switch (status) {
      case "draft":
        return (
          <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
            Draft
          </span>
        );
      case "submitted":
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            Submitted
          </span>
        );
      case "approved":
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            Rejected
          </span>
        );
      default:
        return null;
    }
  }, []);

  // Calculate total checkpoints in a section (handles stages structure)
  const getSectionTotalCheckpoints = useCallback((section) => {
    // New structure with stages
    if (section.stages && Array.isArray(section.stages)) {
      return section.stages.reduce(
        (total, stage) => total + (stage.checkPoints?.length || 0),
        0,
      );
    }
    // Old flat structure
    return section.checkPoints?.length || 0;
  }, []);

  // Calculate summary (handles both old and new structure) - FIXED
  const getSummary = useCallback(() => {
    // 🔍 DEBUG
    console.log("🔍 getSummary called, audit:", {
      hasSummary: !!audit?.summary,
      summaryType: typeof audit?.summary,
      summary: audit?.summary,
      hasSections: !!audit?.sections,
      sectionsType: typeof audit?.sections,
      sectionsLength: audit?.sections?.length,
    });

    // Try pre-calculated summary first
    if (audit?.summary) {
      let summary = audit.summary;

      // Handle string summary
      if (typeof summary === "string") {
        try {
          summary = JSON.parse(summary);
        } catch (e) {
          console.warn("Failed to parse summary string");
          summary = null;
        }
      }

      if (summary && typeof summary === "object") {
        const result = {
          pass: summary.pass ?? summary.Pass ?? 0,
          fail: summary.fail ?? summary.Fail ?? 0,
          warning: summary.warning ?? summary.Warning ?? 0,
          pending: summary.pending ?? summary.Pending ?? 0,
          total: summary.total ?? summary.Total ?? 0,
        };
        console.log("✅ Using pre-calculated summary:", result);
        return result;
      }
    }

    console.log("⚠️ Calculating from sections...");

    // Calculate from sections
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0;

    let sections = audit?.sections;

    // Handle string sections
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch (e) {
        sections = [];
      }
    }

    if (!sections || !Array.isArray(sections)) {
      console.log("❌ No valid sections array");
      return { pass: 0, fail: 0, warning: 0, pending: 0, total: 0 };
    }

    console.log("📊 Processing", sections.length, "sections");

    sections.forEach((section, sIdx) => {
      if (!section) return;

      // Handle new structure with stages
      if (section.stages && Array.isArray(section.stages)) {
        console.log(`  Section ${sIdx}: has ${section.stages.length} stages`);

        section.stages.forEach((stage, stIdx) => {
          if (stage?.checkPoints && Array.isArray(stage.checkPoints)) {
            console.log(
              `    Stage ${stIdx}: has ${stage.checkPoints.length} checkpoints`,
            );

            stage.checkPoints.forEach((cp) => {
              if (!cp) return;
              const status = (cp.status || "pending").toLowerCase();
              if (status === "pass") pass++;
              else if (status === "fail") fail++;
              else if (status === "warning") warning++;
              else pending++;
            });
          }
        });
      }
      // Handle old flat structure
      else if (section.checkPoints && Array.isArray(section.checkPoints)) {
        console.log(
          `  Section ${sIdx}: has ${section.checkPoints.length} direct checkpoints`,
        );

        section.checkPoints.forEach((cp) => {
          if (!cp) return;
          const status = (cp.status || "pending").toLowerCase();
          if (status === "pass") pass++;
          else if (status === "fail") fail++;
          else if (status === "warning") warning++;
          else pending++;
        });
      }
    });

    const result = {
      pass,
      fail,
      warning,
      pending,
      total: pass + fail + warning + pending,
    };

    console.log("📊 Calculated summary:", result);
    return result;
  }, [audit]);

  // Get info field value with fallback
  const getInfoFieldValue = useCallback(
    (fieldId) => {
      if (!audit?.infoData) return "-";

      // Check direct field id
      if (audit.infoData[fieldId]) {
        return audit.infoData[fieldId];
      }

      // Check alternate field names
      const alternates = {
        serialNo: ["serial", "serialNumber", "serialNo"],
        modelName: ["model", "modelName", "modelVariant"],
        date: ["auditDate", "date", "reportDate"],
        shift: ["shift", "shiftName"],
        eid: ["eid", "employeeId", "auditorId"],
      };

      if (alternates[fieldId]) {
        for (const alt of alternates[fieldId]) {
          if (audit.infoData[alt]) {
            return audit.infoData[alt];
          }
        }
      }

      return "-";
    },
    [audit],
  );

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading audit...</p>
        </div>
      </div>
    );
  }

  // Audit not found
  if (!audit) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Audit Not Found
          </h2>
          <button
            onClick={() => navigate("/auditreport/audits")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Audits
          </button>
        </div>
      </div>
    );
  }

  const summary = getSummary();
  const visibleColumns = template?.columns?.filter((col) => col.visible) || [];
  const signatures = audit.signatures || {};

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 print:bg-white print:p-0">
      <div className="mx-auto">
        {/* Sticky Header - Hide on print */}
        <div className="sticky top-0 z-40 bg-gray-100/90 backdrop-blur border-b border-gray-200 shadow-sm p-4 print:hidden">
          <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/auditreport/audits")}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all"
              >
                <FaArrowLeft /> Back
              </button>
              <h1 className="text-xl font-bold text-gray-800">View Audit</h1>
              {getAuditStatusBadge(audit.status)}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all text-sm"
              >
                <FaPrint /> Print
              </button>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
              >
                <FaHistory /> History
              </button>

              {audit.status !== "approved" && (
                <button
                  onClick={() => navigate(`/auditreport/audits/${id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-sm"
                >
                  <FaEdit /> Edit
                </button>
              )}
              {audit.status === "submitted" && (
                <>
                  <button
                    onClick={() => openApprovalModal("approve")}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-sm"
                  >
                    <FaCheck /> Approve
                  </button>
                  <button
                    onClick={() => openApprovalModal("reject")}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all text-sm"
                  >
                    <FaBan /> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Approval Info Banner */}
        {(audit.status === "approved" || audit.status === "rejected") &&
          audit.approvedBy && (
            <div
              className={`mb-4 p-4 rounded-lg print:mb-2 ${
                audit.status === "approved"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {audit.status === "approved" ? (
                  <FaCheckCircle className="text-green-600" />
                ) : (
                  <FaTimesCircle className="text-red-600" />
                )}
                <span
                  className={`font-medium ${
                    audit.status === "approved"
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {audit.status === "approved" ? "Approved" : "Rejected"} by{" "}
                  {audit.approvedBy}
                </span>
                {audit.approvedAt && (
                  <span className="text-gray-500 text-sm">
                    on {formatDateTimeForDisplay(audit.approvedAt)}
                  </span>
                )}
              </div>
              {audit.approvalComments && (
                <p className="mt-2 text-gray-600 text-sm pl-6">
                  <strong>Comments:</strong> {audit.approvalComments}
                </p>
              )}
            </div>
          )}

        {/* Main Report Container */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden border-2 border-gray-300 print:shadow-none print:border">
          {/* Header Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-gray-300">
            {/* Left - Report Name */}
            <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 p-6 print:bg-blue-600">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <HiClipboardDocumentCheck className="text-4xl text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {audit.reportName || "Audit Report"}
                </h1>
                <p className="text-blue-200 text-sm mt-2">
                  Template: {audit.templateName}
                </p>
                {audit.auditCode && (
                  <p className="text-blue-200 text-xs mt-1">
                    Code: {audit.auditCode}
                  </p>
                )}
              </div>
            </div>

            {/* Right - Format Info */}
            <div className="bg-gray-50 divide-y divide-gray-300">
              {template?.headerConfig?.showFormatNo !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdFormatListNumbered className="text-xl text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">
                      Format No
                    </span>
                    <span className="font-semibold text-gray-800">
                      {audit.formatNo || "-"}
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
                      {audit.revNo || "-"}
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
                      {formatDateForDisplay(audit.revDate)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Section - Dynamic Fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b-2 border-gray-300 bg-gray-50">
            {template?.infoFields
              ?.filter((field) => field.visible)
              .map((field, index, arr) => (
                <div
                  key={field.id}
                  className={`p-4 ${
                    index < arr.length - 1 ? "border-r border-gray-300" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getFieldIcon(field.id)}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {field.name}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-800 block">
                    {field.id === "date"
                      ? formatDateForDisplay(getInfoFieldValue(field.id))
                      : getInfoFieldValue(field.id)}
                  </span>
                  {/* Show model code if available */}
                  {field.id === "modelName" && audit.infoData?.modelCode && (
                    <span className="text-xs text-red-600 block mt-1">
                      Code: {audit.infoData.modelCode}
                    </span>
                  )}
                </div>
              ))}
          </div>

          {/* Additional Info Data (not in template fields) */}
          {audit.infoData && Object.keys(audit.infoData).length > 0 && (
            <div className="p-4 border-b-2 border-gray-300 bg-blue-50">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">
                Additional Information:
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {Object.entries(audit.infoData).map(([key, value]) => {
                  // Skip fields already shown in template
                  const templateFieldIds =
                    template?.infoFields?.map((f) => f.id) || [];
                  if (templateFieldIds.includes(key)) return null;
                  if (!value) return null;

                  return (
                    <div key={key} className="bg-white p-2 rounded border">
                      <span className="text-xs text-gray-500 uppercase block">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="font-medium text-gray-800">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="p-4 border-b-2 border-gray-300 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <FaStickyNote className="text-lg text-yellow-600" />
              <span className="font-semibold text-gray-700">Notes:</span>
            </div>
            <p className="text-gray-700 leading-relaxed pl-6">
              {audit.notes || "No notes added."}
            </p>
          </div>

          {/* Main Table Section - Handles both old and new structure */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white print:bg-gray-700">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-3 py-3 text-left font-semibold border-r border-gray-600 text-sm ${column.width || ""}`}
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.sections?.map((section) => {
                  // Check if using new stages structure
                  const hasStages =
                    section.stages && Array.isArray(section.stages);
                  const sectionTotalRows = getSectionTotalCheckpoints(section);
                  let sectionRowRendered = false;

                  if (hasStages) {
                    // NEW STRUCTURE: sections -> stages -> checkPoints
                    return section.stages.map((stage) => {
                      let stageRowRendered = false;

                      return stage.checkPoints?.map(
                        (checkpoint, checkpointIndex) => {
                          const showSectionCell =
                            !sectionRowRendered && checkpointIndex === 0;
                          const showStageCell =
                            !stageRowRendered && checkpointIndex === 0;

                          if (
                            showSectionCell &&
                            section.stages.indexOf(stage) === 0
                          ) {
                            sectionRowRendered = true;
                          }
                          if (showStageCell) stageRowRendered = true;

                          return (
                            <tr
                              key={`${section.id}-${stage.id}-${checkpoint.id}-${checkpointIndex}`}
                              className={`border-b border-gray-200 ${
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
                                // Section column with rowSpan
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

                                // Stage column with rowSpan
                                if (column.id === "stage") {
                                  if (showStageCell) {
                                    return (
                                      <td
                                        key={column.id}
                                        className="px-3 py-2 font-bold bg-indigo-50 border-r border-gray-300 text-center align-middle"
                                        rowSpan={stage.checkPoints?.length || 1}
                                      >
                                        <span className="text-indigo-700 text-sm font-semibold">
                                          {stage.stageName || "-"}
                                        </span>
                                      </td>
                                    );
                                  }
                                  return null;
                                }

                                // Status column
                                if (column.id === "status") {
                                  return (
                                    <td
                                      key={column.id}
                                      className="px-3 py-2 border-r border-gray-200"
                                    >
                                      {getStatusBadge(checkpoint.status)}
                                    </td>
                                  );
                                }

                                // Other columns
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
                  } else {
                    // OLD STRUCTURE: sections -> checkPoints (flat)
                    return section.checkPoints?.map(
                      (checkpoint, checkpointIndex) => (
                        <tr
                          key={`${section.id}-${checkpoint.id}-${checkpointIndex}`}
                          className={`border-b border-gray-200 ${
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
                            // Section column with rowSpan
                            if (column.id === "section") {
                              if (checkpointIndex === 0) {
                                return (
                                  <td
                                    key={column.id}
                                    className="px-3 py-2 font-bold bg-gray-100 border-r border-gray-300 align-middle text-center"
                                    rowSpan={section.checkPoints?.length || 1}
                                  >
                                    <span className="text-gray-700 text-sm">
                                      {section.sectionName || "-"}
                                    </span>
                                  </td>
                                );
                              }
                              return null;
                            }

                            // Status column
                            if (column.id === "status") {
                              return (
                                <td
                                  key={column.id}
                                  className="px-3 py-2 border-r border-gray-200"
                                >
                                  {getStatusBadge(checkpoint.status)}
                                </td>
                              );
                            }

                            // Other columns
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
                      ),
                    );
                  }
                })}

                {/* Empty state */}
                {(!audit.sections || audit.sections.length === 0) && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No checkpoint data available
                    </td>
                  </tr>
                )}
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

            {/* Pass Rate */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Pass Rate</span>
                <span className="font-medium text-gray-800">
                  {summary.total > 0
                    ? Math.round((summary.pass / summary.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${
                      summary.total > 0
                        ? (summary.pass / summary.total) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Signature Section - Now displays saved signatures */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-t-2 border-gray-300">
            {/* Auditor Signature */}
            <div className="p-6 border-r border-b md:border-b-0 border-gray-300">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <FaUserCheck className="text-xl text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">
                  Auditor Signature
                </span>
              </div>
              <div className="text-center">
                <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4 min-h-[40px] flex items-end justify-center">
                  <span className="text-gray-800 font-medium">
                    {signatures.auditor?.name || audit.createdBy || ""}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {signatures.auditor?.date
                    ? formatDateForDisplay(signatures.auditor.date)
                    : audit.createdAt
                      ? formatDateForDisplay(audit.createdAt)
                      : "Date"}
                </span>
              </div>
            </div>

            {/* Approved By */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <FaUserShield className="text-xl text-purple-600" />
                <span className="text-sm font-semibold text-gray-700">
                  Approved By
                </span>
              </div>
              <div className="text-center">
                {audit.approvedBy || signatures.approver?.name ? (
                  <>
                    <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4 min-h-[40px] flex items-end justify-center">
                      <span className="text-gray-800 font-medium">
                        {audit.approvedBy || signatures.approver?.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {audit.approvedAt
                        ? formatDateForDisplay(audit.approvedAt)
                        : signatures.approver?.date
                          ? formatDateForDisplay(signatures.approver.date)
                          : "Date"}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 pb-4 min-h-[40px]"></div>
                    <span className="text-xs text-gray-500">Name & Date</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="mt-4 bg-white rounded-lg shadow-md p-4 print:shadow-none print:border">
          <h4 className="font-medium text-gray-700 mb-2">Audit Metadata</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block">Audit Code:</span>
              <span className="text-gray-700 font-medium">
                {audit.auditCode || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Created By:</span>
              <span className="text-gray-700 font-medium">
                {audit.createdBy || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Created At:</span>
              <span className="text-gray-700">
                {formatDateTimeForDisplay(audit.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Last Updated:</span>
              <span className="text-gray-700">
                {formatDateTimeForDisplay(audit.updatedAt)}
              </span>
            </div>
            {audit.submittedBy && (
              <div>
                <span className="text-gray-500 block">Submitted By:</span>
                <span className="text-gray-700 font-medium">
                  {audit.submittedBy}
                </span>
              </div>
            )}
            {audit.submittedAt && (
              <div>
                <span className="text-gray-500 block">Submitted At:</span>
                <span className="text-gray-700">
                  {formatDateTimeForDisplay(audit.submittedAt)}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-500 block">Template ID:</span>
              <span className="text-gray-700">{audit.templateId}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Audit ID:</span>
              <span className="text-gray-700">{audit.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-gray-500 text-sm print:mt-2">
          <p>
            This document is confidential and intended for internal use only.
          </p>
          <p>
            Generated on {formatDateForDisplay(new Date().toISOString())} |{" "}
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div
              className={`p-4 text-white ${
                approvalAction === "approve" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              <h3 className="text-lg font-bold">
                {approvalAction === "approve"
                  ? "Approve Audit"
                  : "Reject Audit"}
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments{" "}
                  {approvalAction === "reject" && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={
                    approvalAction === "reject"
                      ? "Enter rejection reason..."
                      : "Enter any comments (optional)..."
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setApproverName("");
                  setApprovalComments("");
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproval}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 ${
                  approvalAction === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : approvalAction === "approve" ? (
                  "Approve"
                ) : (
                  "Reject"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 bg-purple-600 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaHistory /> Audit History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-purple-700 rounded text-white text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {auditHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No history records found.
                </p>
              ) : (
                <div className="space-y-4">
                  {auditHistory.map((record, index) => (
                    <div
                      key={record.Id || index}
                      className="border-l-4 border-purple-500 pl-4 py-2 bg-gray-50 rounded-r"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span
                            className={`font-semibold capitalize px-2 py-0.5 rounded text-sm ${
                              record.Action === "created"
                                ? "bg-green-100 text-green-700"
                                : record.Action === "updated"
                                  ? "bg-blue-100 text-blue-700"
                                  : record.Action === "submitted"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : record.Action === "approved"
                                      ? "bg-green-100 text-green-700"
                                      : record.Action === "rejected"
                                        ? "bg-red-100 text-red-700"
                                        : record.Action === "deleted"
                                          ? "bg-gray-100 text-gray-700"
                                          : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {record.Action}
                          </span>
                          <span className="text-gray-500 ml-2 text-sm">
                            by {record.ActionBy}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDateTimeForDisplay(record.ActionAt)}
                        </span>
                      </div>
                      {record.Comments && (
                        <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border">
                          <strong>Comment:</strong> {record.Comments}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditView;
