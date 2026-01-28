import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaIdBadge,
  FaStickyNote,
  FaClipboardCheck,
  FaPrint,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaArrowLeft,
  FaEdit,
  FaCheck,
  FaBan,
  FaHistory,
} from "react-icons/fa";
import { MdFormatListNumbered, MdUpdate, MdDateRange } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../hooks/useAuditData";
import toast from "react-hot-toast";

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
              columns: auditData.columns,
              infoFields: auditData.infoFields,
              headerConfig: auditData.headerConfig,
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
  }, [id]);

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

  // Print function
  const handlePrint = () => {
    window.print();
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
        `Audit ${
          approvalAction === "approve" ? "approved" : "rejected"
        } successfully!`,
      );
    } catch (err) {
      toast.error(`Failed to ${approvalAction} audit: ` + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Get field icon
  const getFieldIcon = (fieldId) => {
    switch (fieldId) {
      case "modelName":
        return <BiSolidFactory className="text-lg text-indigo-600" />;
      case "date":
        return <FaCalendarAlt className="text-lg text-red-500" />;
      case "shift":
        return <FaClock className="text-lg text-orange-500" />;
      case "eid":
        return <FaIdBadge className="text-lg text-teal-600" />;
      default:
        return <FaClipboardCheck className="text-lg text-gray-500" />;
    }
  };

  // Get status badge for checkpoints
  const getStatusBadge = (status) => {
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
  };

  // Get audit status badge
  const getAuditStatusBadge = (status) => {
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
  };

  // Calculate summary
  const getSummary = () => {
    // Use pre-calculated summary if available
    if (audit?.summary) {
      return audit.summary;
    }

    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0;
    audit?.sections?.forEach((section) => {
      section.checkPoints?.forEach((cp) => {
        if (cp.status === "pass") pass++;
        else if (cp.status === "fail") fail++;
        else if (cp.status === "warning") warning++;
        else pending++;
      });
    });
    return {
      pass,
      fail,
      warning,
      pending,
      total: pass + fail + warning + pending,
    };
  };

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

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        {/* Action Buttons */}
        <div className="mb-4 flex flex-wrap justify-between items-center gap-3 print:hidden">
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
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
            >
              <FaHistory /> History
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all text-sm"
            >
              <FaPrint /> Print
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

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 print:hidden">
            {error}
          </div>
        )}

        {/* Approval Info Banner */}
        {(audit.status === "approved" || audit.status === "rejected") &&
          audit.approvedBy && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                audit.status === "approved"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              } print:hidden`}
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
                    on {new Date(audit.approvedAt).toLocaleString()}
                  </span>
                )}
              </div>
              {audit.approvalComments && (
                <p className="mt-2 text-gray-600 text-sm pl-6">
                  {audit.approvalComments}
                </p>
              )}
            </div>
          )}

        {/* Main Report Container */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden border-2 border-gray-300 print:shadow-none print:border print:rounded-none">
          {/* Header Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-gray-300">
            {/* Left - Report Name */}
            <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 p-6 print:bg-blue-700">
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
                      {audit.revDate || "-"}
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
                  <span className="font-semibold text-gray-800">
                    {audit.infoData?.[field.id] || "-"}
                  </span>
                </div>
              ))}
          </div>

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

          {/* Main Table Section */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white print:bg-gray-700">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-3 py-3 text-left font-semibold border-r border-gray-600 text-sm ${column.width}`}
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.sections?.map((section) =>
                  section.checkPoints?.map((checkpoint, checkpointIndex) => (
                    <tr
                      key={`${section.id}-${checkpoint.id}`}
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
                                rowSpan={section.checkPoints.length}
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
                  )),
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

          {/* Signature Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-t-2 border-gray-300">
            <div className="p-6 border-r border-b md:border-b-0 border-gray-300 text-center">
              <span className="text-sm font-medium text-gray-600 block mb-8">
                Auditor Signature
              </span>
              <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2"></div>
              <span className="text-xs text-gray-500">Name & Date</span>
            </div>
            <div className="p-6 border-r border-b md:border-b-0 border-gray-300 text-center">
              <span className="text-sm font-medium text-gray-600 block mb-8">
                Reviewed By
              </span>
              <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2"></div>
              <span className="text-xs text-gray-500">Name & Date</span>
            </div>
            <div className="p-6 text-center">
              <span className="text-sm font-medium text-gray-600 block mb-2">
                Approved By
              </span>
              {audit.approvedBy ? (
                <div className="text-center">
                  <p className="font-semibold text-gray-800">
                    {audit.approvedBy}
                  </p>
                  <p className="text-xs text-gray-500">
                    {audit.approvedAt
                      ? new Date(audit.approvedAt).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2 mt-6"></div>
                  <span className="text-xs text-gray-500">Name & Date</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="mt-4 bg-white rounded-lg shadow-md p-4 print:hidden">
          <h4 className="font-medium text-gray-700 mb-2">Audit Metadata</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Created:</span>
              <span className="ml-2 text-gray-700">
                {audit.createdAt
                  ? new Date(audit.createdAt).toLocaleString()
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Updated:</span>
              <span className="ml-2 text-gray-700">
                {audit.updatedAt
                  ? new Date(audit.updatedAt).toLocaleString()
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Template ID:</span>
              <span className="ml-2 text-gray-700">{audit.templateId}</span>
            </div>
            <div>
              <span className="text-gray-500">Audit ID:</span>
              <span className="ml-2 text-gray-700">{audit.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-gray-500 text-sm print:mt-8">
          <p>
            This document is confidential and intended for internal use only.
          </p>
          <p>
            Generated on {new Date().toLocaleDateString()} |{" "}
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 bg-purple-600 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaHistory /> Audit History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-purple-700 rounded text-white"
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
                      className="border-l-4 border-purple-500 pl-4 py-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-gray-800 capitalize">
                            {record.Action}
                          </span>
                          <span className="text-gray-500 ml-2">
                            by {record.ActionBy}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(record.ActionAt).toLocaleString()}
                        </span>
                      </div>
                      {record.Comments && (
                        <p className="text-sm text-gray-600 mt-1">
                          {record.Comments}
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
