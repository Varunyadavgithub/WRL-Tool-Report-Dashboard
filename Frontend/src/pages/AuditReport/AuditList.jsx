import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaSearch,
  FaFilter,
  FaFileAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaPaperPlane,
  FaClipboardCheck,
  FaSync,
  FaExclamationTriangle,
  FaBarcode,
  FaCalendarAlt,
} from "react-icons/fa";
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

const AuditList = () => {
  const navigate = useNavigate();
  const {
    audits,
    templates,
    deleteAudit,
    loadAudits,
    loadTemplates,
    loading,
    error,
  } = useAuditData();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load audits and templates on mount
  useEffect(() => {
    const fetchData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([loadAudits(), loadTemplates()]);
      } catch (err) {
        console.error("Failed to load data:", err);
        toast.error("Failed to load data");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadAudits(), loadTemplates()]);
      toast.success("Data refreshed");
    } catch (err) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  // ========== FIXED: Robust summary calculation ==========
  const getSummaryFromAudit = useCallback((audit) => {
    // Default summary
    const defaultSummary = {
      pass: 0,
      fail: 0,
      warning: 0,
      pending: 0,
      total: 0,
    };

    if (!audit) return defaultSummary;

    // Debug log - remove in production
    // console.log("Audit data:", audit.auditCode, { summary: audit.summary, sections: audit.sections });

    // Try to use pre-calculated summary first
    if (audit.summary) {
      const summary = audit.summary;

      // Handle if summary is a string (not parsed)
      let parsedSummary = summary;
      if (typeof summary === "string") {
        try {
          parsedSummary = JSON.parse(summary);
        } catch (e) {
          console.warn("Failed to parse summary string:", e);
          parsedSummary = null;
        }
      }

      if (parsedSummary && typeof parsedSummary === "object") {
        // Handle both lowercase and uppercase keys
        return {
          pass: parsedSummary.pass ?? parsedSummary.Pass ?? 0,
          fail: parsedSummary.fail ?? parsedSummary.Fail ?? 0,
          warning: parsedSummary.warning ?? parsedSummary.Warning ?? 0,
          pending: parsedSummary.pending ?? parsedSummary.Pending ?? 0,
          total: parsedSummary.total ?? parsedSummary.Total ?? 0,
        };
      }
    }

    // Calculate from sections if no valid summary
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0;

    // Handle sections - could be string or array
    let sections = audit.sections;
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch (e) {
        console.warn("Failed to parse sections string:", e);
        sections = [];
      }
    }

    if (!sections || !Array.isArray(sections)) {
      return defaultSummary;
    }

    sections.forEach((section) => {
      if (!section) return;

      // Handle NEW structure: section.stages[].checkPoints[]
      if (section.stages && Array.isArray(section.stages)) {
        section.stages.forEach((stage) => {
          if (stage && stage.checkPoints && Array.isArray(stage.checkPoints)) {
            stage.checkPoints.forEach((cp) => {
              if (!cp) return;
              const status = (cp.status || "").toLowerCase();
              if (status === "pass") pass++;
              else if (status === "fail") fail++;
              else if (status === "warning") warning++;
              else pending++;
            });
          }
        });
      }
      // Handle OLD structure: section.checkPoints[]
      else if (section.checkPoints && Array.isArray(section.checkPoints)) {
        section.checkPoints.forEach((cp) => {
          if (!cp) return;
          const status = (cp.status || "").toLowerCase();
          if (status === "pass") pass++;
          else if (status === "fail") fail++;
          else if (status === "warning") warning++;
          else pending++;
        });
      }
    });

    return {
      pass,
      fail,
      warning,
      pending,
      total: pass + fail + warning + pending,
    };
  }, []);

  // Get info field value with fallback
  const getInfoValue = useCallback((audit, fieldId) => {
    if (!audit) return "-";

    // Handle infoData - could be string or object
    let infoData = audit.infoData;
    if (typeof infoData === "string") {
      try {
        infoData = JSON.parse(infoData);
      } catch (e) {
        infoData = {};
      }
    }

    if (!infoData || typeof infoData !== "object") return "-";

    // Direct field check
    if (infoData[fieldId]) {
      return infoData[fieldId];
    }

    // Check alternate field names
    const alternates = {
      serialNo: ["serial", "serialNumber", "serialNo", "Serial", "SerialNo"],
      modelName: ["model", "modelName", "modelVariant", "Model", "ModelName"],
      date: ["auditDate", "date", "reportDate", "Date", "AuditDate"],
      shift: ["shift", "shiftName", "Shift", "ShiftName"],
    };

    if (alternates[fieldId]) {
      for (const alt of alternates[fieldId]) {
        if (infoData[alt]) {
          return infoData[alt];
        }
      }
    }

    return "-";
  }, []);

  // Calculate pass rate
  const getPassRate = useCallback((summary) => {
    if (!summary || !summary.total || summary.total === 0) return 0;
    return Math.round((summary.pass / summary.total) * 100);
  }, []);

  // Get pass rate color
  const getPassRateColor = useCallback((rate) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  }, []);

  // Get pass rate background
  const getPassRateBgColor = useCallback((rate) => {
    if (rate >= 90) return "bg-green-500";
    if (rate >= 70) return "bg-yellow-500";
    return "bg-red-500";
  }, []);

  // Filter audits
  const filteredAudits = useMemo(() => {
    return audits.filter((audit) => {
      const searchLower = searchTerm.toLowerCase();

      // Get infoData values for search
      const modelName = getInfoValue(audit, "modelName");
      const serialNo = getInfoValue(audit, "serialNo");

      const matchesSearch =
        !searchTerm ||
        audit.reportName?.toLowerCase().includes(searchLower) ||
        audit.templateName?.toLowerCase().includes(searchLower) ||
        audit.auditCode?.toLowerCase().includes(searchLower) ||
        (modelName !== "-" && modelName.toLowerCase().includes(searchLower)) ||
        (serialNo !== "-" && serialNo.toLowerCase().includes(searchLower)) ||
        audit.createdBy?.toLowerCase().includes(searchLower);

      const matchesStatus = !filterStatus || audit.status === filterStatus;
      const matchesTemplate =
        !filterTemplate || String(audit.templateId) === String(filterTemplate);

      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }, [audits, searchTerm, filterStatus, filterTemplate, getInfoValue]);

  // Sort audits by updated date (newest first)
  const sortedAudits = useMemo(() => {
    return [...filteredAudits].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt),
    );
  }, [filteredAudits]);

  // Calculate stats
  const stats = useMemo(
    () => ({
      total: audits.length,
      draft: audits.filter((a) => a.status === "draft").length,
      submitted: audits.filter((a) => a.status === "submitted").length,
      approved: audits.filter((a) => a.status === "approved").length,
      rejected: audits.filter((a) => a.status === "rejected").length,
    }),
    [audits],
  );

  // Handle delete
  const handleDelete = async () => {
    if (auditToDelete) {
      setActionLoading(true);
      try {
        await deleteAudit(auditToDelete.id);
        toast.success("Audit deleted successfully");
        setShowDeleteModal(false);
        setAuditToDelete(null);
      } catch (err) {
        toast.error(`Failed to delete audit: ${err.message}`);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Confirm delete
  const confirmDelete = (audit) => {
    if (audit.status === "approved") {
      toast.error("Cannot delete an approved audit");
      return;
    }
    setAuditToDelete(audit);
    setShowDeleteModal(true);
  };

  // Get status badge
  const getStatusBadge = useCallback((status) => {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            <FaClock size={10} /> Draft
          </span>
        );
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <FaPaperPlane size={10} /> Submitted
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <FaCheckCircle size={10} /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <FaTimesCircle size={10} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            {status || "Unknown"}
          </span>
        );
    }
  }, []);

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-gray-100/90 backdrop-blur border-b border-gray-200 shadow-sm p-4 mb-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FaClipboardCheck className="text-green-600" />
                Audit Records
              </h1>
              <p className="text-gray-600 mt-1">
                View and manage your audit entries ({filteredAudits.length} of{" "}
                {audits.length})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all disabled:opacity-50"
                title="Refresh"
              >
                <FaSync className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "..." : "Refresh"}
              </button>
              <button
                onClick={() => navigate("/auditreport/templates")}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
              >
                <FaPlus /> New Audit
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <div className="text-3xl font-bold text-blue-600">
              {stats.total}
            </div>
            <div className="text-gray-600 text-sm">Total Audits</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-gray-400">
            <div className="text-3xl font-bold text-gray-600">
              {stats.draft}
            </div>
            <div className="text-gray-600 text-sm">Drafts</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-400">
            <div className="text-3xl font-bold text-blue-600">
              {stats.submitted}
            </div>
            <div className="text-gray-600 text-sm">Submitted</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <div className="text-3xl font-bold text-green-600">
              {stats.approved}
            </div>
            <div className="text-gray-600 text-sm">Approved</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
            <div className="text-3xl font-bold text-red-600">
              {stats.rejected}
            </div>
            <div className="text-gray-600 text-sm">Rejected</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, code, model, serial..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FaFilter className="text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Templates</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {(searchTerm || filterStatus || filterTemplate) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("");
                    setFilterTemplate("");
                  }}
                  className="px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Audits List */}
        {sortedAudits.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FaFileAlt className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Audits Found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterStatus || filterTemplate
                ? "No audits match your search criteria."
                : "Get started by creating your first audit."}
            </p>
            <button
              onClick={() => navigate("/auditreport/templates")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
            >
              <FaPlus /> Create Audit
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Audit Details
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      <div className="flex items-center gap-1">
                        <FaBarcode className="text-purple-500" /> Serial / Model
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      <div className="flex items-center gap-1">
                        <FaCalendarAlt className="text-red-500" /> Date / Shift
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Results
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Pass Rate
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedAudits.map((audit) => {
                    // Get summary for this audit
                    const summary = getSummaryFromAudit(audit);
                    const passRate = getPassRate(summary);

                    // Get info values
                    const serialNo = getInfoValue(audit, "serialNo");
                    const modelName = getInfoValue(audit, "modelName");
                    const auditDate = getInfoValue(audit, "date");
                    const shift = getInfoValue(audit, "shift");

                    return (
                      <tr
                        key={audit.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Audit Details */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">
                            {audit.reportName || "Untitled Audit"}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {audit.auditCode && (
                              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded mr-2">
                                {audit.auditCode}
                              </span>
                            )}
                            <span className="text-gray-400">
                              {audit.templateName}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Format: {audit.formatNo || "-"} | Rev:{" "}
                            {audit.revNo || "-"}
                          </div>
                        </td>

                        {/* Serial / Model */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <BiSolidFactory className="text-indigo-500 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-800">
                                {modelName}
                              </div>
                              {serialNo !== "-" && (
                                <div className="text-xs text-purple-600">
                                  SN: {serialNo}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Date / Shift */}
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-800">
                            {auditDate !== "-"
                              ? formatDateForDisplay(auditDate)
                              : formatDateForDisplay(audit.createdAt)}
                          </div>
                          {shift !== "-" && (
                            <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                              <FaClock size={10} /> {shift}
                            </div>
                          )}
                        </td>

                        {/* Results - FIXED */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-3">
                            <div className="text-center" title="Passed">
                              <div className="flex items-center gap-1 text-green-600">
                                <FaCheckCircle size={12} />
                                <span className="font-bold">
                                  {summary.pass}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                Pass
                              </span>
                            </div>
                            <div className="text-center" title="Warnings">
                              <div className="flex items-center gap-1 text-yellow-600">
                                <FaExclamationTriangle size={12} />
                                <span className="font-bold">
                                  {summary.warning}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                Warn
                              </span>
                            </div>
                            <div className="text-center" title="Failed">
                              <div className="flex items-center gap-1 text-red-600">
                                <FaTimesCircle size={12} />
                                <span className="font-bold">
                                  {summary.fail}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                Fail
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Pass Rate - FIXED */}
                        <td className="px-4 py-3 text-center">
                          {summary.total > 0 ? (
                            <div className="flex flex-col items-center">
                              <span
                                className={`text-lg font-bold ${getPassRateColor(passRate)}`}
                              >
                                {passRate}%
                              </span>
                              <div className="w-16 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full transition-all ${getPassRateBgColor(passRate)}`}
                                  style={{
                                    width: `${Math.min(passRate, 100)}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-400 mt-1">
                                {summary.total} checks
                              </span>
                            </div>
                          ) : (
                            <div className="text-center">
                              <span className="text-gray-400 text-sm">-</span>
                              <div className="text-xs text-gray-400">
                                No data
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(audit.status)}
                          {audit.approvedBy && (
                            <div className="text-xs text-gray-400 mt-1">
                              by {audit.approvedBy}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                navigate(`/auditreport/audits/${audit.id}/view`)
                              }
                              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                              title="View Audit"
                            >
                              <FaEye size={14} />
                            </button>
                            {audit.status !== "approved" && (
                              <button
                                onClick={() =>
                                  navigate(`/auditreport/audits/${audit.id}`)
                                }
                                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all"
                                title="Edit Audit"
                              >
                                <FaEdit size={14} />
                              </button>
                            )}
                            {audit.status !== "approved" && (
                              <button
                                onClick={() => confirmDelete(audit)}
                                className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all"
                                title="Delete Audit"
                              >
                                <FaTrash size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Showing {sortedAudits.length} of {audits.length} audits
              {(searchTerm || filterStatus || filterTemplate) && (
                <span className="ml-2 text-blue-600">(filtered)</span>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-4 bg-red-600 text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaTrash /> Confirm Delete
                </h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700">
                  Are you sure you want to delete the audit:
                </p>
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-gray-800">
                    {auditToDelete?.reportName}
                  </p>
                  {auditToDelete?.auditCode && (
                    <p className="text-sm text-gray-500">
                      Code: {auditToDelete.auditCode}
                    </p>
                  )}
                </div>
                <p className="text-red-600 text-sm mt-3 flex items-center gap-1">
                  <FaExclamationTriangle /> This action cannot be undone.
                </p>
              </div>
              <div className="p-4 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAuditToDelete(null);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FaTrash size={12} /> Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditList;
