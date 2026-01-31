import { useEffect, useState } from "react";
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
} from "react-icons/fa";
import useAuditData from "../../hooks/useAuditData";
import toast from "react-hot-toast";

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

  // Load audits and templates on mount
  useEffect(() => {
    const fetchData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([loadAudits(), loadTemplates()]);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter audits
  const filteredAudits = audits.filter((audit) => {
    const matchesSearch =
      audit.reportName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.auditCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.infoData?.modelName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || audit.status === filterStatus;
    const matchesTemplate =
      !filterTemplate || audit.templateId == filterTemplate;
    return matchesSearch && matchesStatus && matchesTemplate;
  });

  // Handle delete
  const handleDelete = async () => {
    if (auditToDelete) {
      setActionLoading(true);
      try {
        await deleteAudit(auditToDelete.id);
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
  const getStatusBadge = (status) => {
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
            {status}
          </span>
        );
    }
  };

  // Get summary from audit
  const getSummaryFromAudit = (audit) => {
    if (audit.summary) {
      return audit.summary;
    }
    let pass = 0,
      fail = 0,
      warning = 0,
      total = 0;
    audit.sections?.forEach((section) => {
      section.checkPoints?.forEach((cp) => {
        total++;
        if (cp.status === "pass") pass++;
        else if (cp.status === "fail") fail++;
        else if (cp.status === "warning") warning++;
      });
    });
    return { pass, fail, warning, total };
  };

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
        {/* Header */}
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaClipboardCheck className="text-green-600" />
              Audit Records
            </h1>
            <p className="text-gray-600 mt-1">
              View and manage your audit entries
            </p>
          </div>
          <button
            onClick={() => navigate("/auditreport/templates")}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
          >
            <FaPlus /> New Audit
          </button>
        </div>


        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search audits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-3xl font-bold text-blue-600">
              {audits.length}
            </div>
            <div className="text-gray-600 text-sm">Total Audits</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-3xl font-bold text-gray-600">
              {audits.filter((a) => a.status === "draft").length}
            </div>
            <div className="text-gray-600 text-sm">Drafts</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-3xl font-bold text-blue-600">
              {audits.filter((a) => a.status === "submitted").length}
            </div>
            <div className="text-gray-600 text-sm">Submitted</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-3xl font-bold text-green-600">
              {audits.filter((a) => a.status === "approved").length}
            </div>
            <div className="text-gray-600 text-sm">Approved</div>
          </div>
        </div>

        {/* Audits List */}
        {filteredAudits.length === 0 ? (
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
                      Report Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Template
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Model
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      Results
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
                  {filteredAudits
                    .sort(
                      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
                    )
                    .map((audit) => {
                      const summary = getSummaryFromAudit(audit);
                      return (
                        <tr
                          key={audit.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">
                              {audit.reportName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {audit.auditCode && `${audit.auditCode} | `}
                              Format: {audit.formatNo || "-"} | Rev:{" "}
                              {audit.revNo || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {audit.templateName || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {audit.infoData?.modelName || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {audit.infoData?.date || audit.revDate || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <FaCheckCircle size={10} /> {summary.pass || 0}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-yellow-600">
                                ⚠ {summary.warning || 0}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-red-600">
                                <FaTimesCircle size={10} /> {summary.fail || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(audit.status)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() =>
                                  navigate(
                                    `/auditreport/audits/${audit.id}/view`,
                                  )
                                }
                                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                                title="View"
                              >
                                <FaEye size={14} />
                              </button>
                              {audit.status !== "approved" && (
                                <button
                                  onClick={() =>
                                    navigate(`/auditreport/audits/${audit.id}`)
                                  }
                                  className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <FaEdit size={14} />
                                </button>
                              )}
                              {audit.status !== "approved" && (
                                <button
                                  onClick={() => confirmDelete(audit)}
                                  className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all"
                                  title="Delete"
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
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-4 bg-red-600 text-white">
                <h3 className="text-lg font-bold">Confirm Delete</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700">
                  Are you sure you want to delete the audit "
                  <strong>{auditToDelete?.reportName}</strong>"?
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  This action cannot be undone.
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
                    "Delete"
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
