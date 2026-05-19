import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEdit,
  FaSync,
  FaSearch,
  FaFilter,
  FaChevronDown,
  FaClipboardList,
  FaClock,
  FaUserCheck,
  FaExclamationTriangle,
  FaFileAlt,
  FaLayerGroup,
  FaThLarge,
  FaList,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { MdOutlineFactCheck } from "react-icons/md";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ROLES } from "../../../config/routes.config";

const APPROVAL_STATUS_LABELS = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  undefined: "Not Set",
};

const APPROVAL_STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-300",
  approved: "bg-green-100 text-green-700 border-green-300",
  rejected: "bg-red-100 text-red-700 border-red-300",
  undefined: "bg-slate-100 text-slate-700 border-slate-300",
};

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

const getTotalCheckpoints = (template) => {
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

const TemplateApproval = () => {
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);
  const { templates, loadTemplates, updateTemplate } = useAuditData();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const canApprove = [
    ROLES.SUPER_ADMIN,
    ROLES.QUALITY_MANAGER,
  ].includes(user?.roleName);

  const isAdmin = user?.roleName === ROLES.SUPER_ADMIN;

  // Drafts are private — only the creator and super admin can see them.
  // All other statuses (pending, approved, rejected, not-set) are visible to approvers.
  const visibleTemplates = useMemo(() => {
    const myId = user?.name || user?.usercode;
    return templates.filter((t) => {
      if (t.approvalStatus === "draft") {
        return isAdmin || (myId && t.createdBy === myId);
      }
      return true;
    });
  }, [templates, isAdmin, user]);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        await loadTemplates();
      } catch (err) {
        toast.error("Failed to load templates: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTemplates();
      toast.success("Refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleApprove = async (template) => {
    try {
      await updateTemplate(template.id, {
        approvalStatus: "approved",
        approvedBy: user?.name || user?.usercode || user?.roleName,
        approvedAt: new Date().toISOString(),
      });
      toast.success(`"${template.name}" approved`);
      await loadTemplates();
    } catch (err) {
      toast.error("Approval failed: " + err.message);
    }
  };

  const handleRejectClick = (template) => {
    setSelectedTemplate(template);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedTemplate || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setRejecting(true);
    try {
      await updateTemplate(selectedTemplate.id, {
        approvalStatus: "rejected",
        rejectionReason: rejectReason.trim(),
      });
      toast.success(`"${selectedTemplate.name}" rejected`);
      setShowRejectModal(false);
      setSelectedTemplate(null);
      setRejectReason("");
      await loadTemplates();
    } catch (err) {
      toast.error("Rejection failed: " + err.message);
    } finally {
      setRejecting(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    let filtered = visibleTemplates;

    if (filterStatus === "pending") {
      filtered = filtered.filter((t) => t.approvalStatus === "pending_approval" || !t.approvalStatus);
    } else if (filterStatus === "approved") {
      filtered = filtered.filter((t) => t.approvalStatus === "approved");
    } else if (filterStatus === "rejected") {
      filtered = filtered.filter((t) => t.approvalStatus === "rejected");
    } else if (filterStatus === "draft") {
      filtered = filtered.filter((t) => t.approvalStatus === "draft");
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [visibleTemplates, filterStatus, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-gray-700">Loading Templates...</p>
        </div>
      </div>
    );
  }

  if (!canApprove) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <FaExclamationTriangle className="text-6xl text-amber-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HiClipboardDocumentCheck className="text-2xl text-indigo-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-800">Template Approval</h1>
                <p className="text-xs text-gray-500 mt-0.5">Review and approve pending templates</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                <FaSync size={11} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="w-full px-6 py-4 bg-white border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "All", count: visibleTemplates.length, icon: FaFileAlt, color: "bg-slate-50 text-slate-700 border-slate-200" },
            { label: "Not Set", count: visibleTemplates.filter((t) => !t.approvalStatus).length, icon: FaExclamationTriangle, color: "bg-slate-50 text-slate-700 border-slate-300" },
            { label: "My Drafts", count: visibleTemplates.filter((t) => t.approvalStatus === "draft").length, icon: FaClipboardList, color: "bg-gray-50 text-gray-700 border-gray-300" },
            { label: "Pending", count: visibleTemplates.filter((t) => t.approvalStatus === "pending_approval").length, icon: FaClock, color: "bg-amber-50 text-amber-700 border-amber-300" },
            { label: "Approved", count: visibleTemplates.filter((t) => t.approvalStatus === "approved").length, icon: FaCheckCircle, color: "bg-green-50 text-green-700 border-green-300" },
          ].map((stat) => (
            <div key={stat.label} className={`flex items-center gap-3 p-3 rounded-lg border ${stat.color}`}>
              <stat.icon className="text-lg flex-shrink-0" />
              <div>
                <div className="text-xl font-bold">{stat.count}</div>
                <div className="text-xs font-medium mt-0.5">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="w-full px-6 py-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="all">All Templates</option>
              <option value="pending">Pending (incl. Not Set)</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"}`}
            >
              <FaThLarge size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"}`}
            >
              <FaList size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Template Grid/List */}
      <div className="w-full px-6 pb-6">
        {filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <MdOutlineFactCheck className="text-5xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No templates found</h3>
            <p className="text-gray-500 text-sm">
              {filterStatus === "pending" ? "No pending templates to review" : "Try adjusting your filters"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow transition-all overflow-hidden">
                <div className="bg-gradient-to-br from-slate-800 to-indigo-900 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2 bg-white/10 rounded-lg flex-shrink-0">
                      <HiClipboardDocumentCheck className="text-xl text-white" />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold border ${
                        APPROVAL_STATUS_COLORS[template.approvalStatus] || APPROVAL_STATUS_COLORS.undefined
                      }`}>
                        {APPROVAL_STATUS_LABELS[template.approvalStatus] || "Not Set"}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-white text-base mt-3 leading-tight line-clamp-2">
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-indigo-200 text-xs mt-1.5 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Category</span>
                    <span className="font-medium text-gray-800 capitalize">{template.category || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Requester</span>
                    <span className="font-medium text-gray-800">{template.createdBy || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Approved By</span>
                    <span className="font-medium text-gray-800">{template.approvedBy || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Checkpoints</span>
                    <span className="font-medium text-gray-800">{getTotalCheckpoints(template)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Updated</span>
                    <span className="font-medium text-gray-800">{relativeTime(template.updatedAt)}</span>
                  </div>
                  {template.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-2">
                      <div className="text-[10px] font-semibold text-red-700 mb-0.5">Rejection Reason</div>
                      <div className="text-xs text-red-600">{template.rejectionReason}</div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/auditreport/templates/${template.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium transition-all"
                    >
                      <FaEye size={11} /> View
                    </button>
                    {template.approvalStatus === "approved" && (
                      <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold">
                        <FaCheckCircle size={11} /> Approved
                      </div>
                    )}
                    {template.approvalStatus === "rejected" && (
                      <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold">
                        <FaTimesCircle size={11} /> Rejected
                      </div>
                    )}
                    {(template.approvalStatus === "pending_approval" || !template.approvalStatus) && (
                      <>
                        <button
                          onClick={() => handleApprove(template)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-all shadow-sm shadow-green-200"
                        >
                          <FaCheckCircle size={11} /> Approve
                        </button>
                        <button
                          onClick={() => handleRejectClick(template)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-all shadow-sm shadow-red-200"
                        >
                          <FaTimesCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Template</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Created By</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Approved By</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Checkpoints</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <div className="font-medium text-gray-800 text-sm">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-gray-500 line-clamp-1">{template.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-600 capitalize">{template.category || "—"}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${APPROVAL_STATUS_COLORS[template.approvalStatus] || APPROVAL_STATUS_COLORS.undefined}`}>
                        {APPROVAL_STATUS_LABELS[template.approvalStatus] || "Not Set"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-600">{template.createdBy || "—"}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-600">{template.approvedBy || "—"}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-gray-600">{getTotalCheckpoints(template)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-gray-500">{relativeTime(template.updatedAt)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/auditreport/templates/${template.id}`)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-all"
                          title="View Details"
                        >
                          <FaEye size={12} />
                        </button>
                        {template.approvalStatus === "approved" && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-[10px] font-semibold">
                            <FaCheckCircle size={10} /> Approved
                          </span>
                        )}
                        {template.approvalStatus === "rejected" && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-[10px] font-semibold">
                            <FaTimesCircle size={10} /> Rejected
                          </span>
                        )}
                        {(template.approvalStatus === "pending_approval" || !template.approvalStatus) && (
                          <>
                            <button
                              onClick={() => handleApprove(template)}
                              className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-md transition-all"
                              title="Approve"
                            >
                              <FaCheckCircle size={12} />
                            </button>
                            <button
                              onClick={() => handleRejectClick(template)}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-md transition-all"
                              title="Reject"
                            >
                              <FaTimesCircle size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaTimesCircle /> Reject Template
              </h3>
              <p className="text-red-200 text-xs mt-1">
                Please provide a reason for rejection
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Template: {selectedTemplate?.name}
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejecting}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-200"
                >
                  {rejecting ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateApproval;
