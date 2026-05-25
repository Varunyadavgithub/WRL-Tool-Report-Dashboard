import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import {
  FaCheckCircle, FaTimesCircle, FaClock, FaSearch, FaSync,
  FaFilter, FaUserTie, FaCalendarAlt, FaBuilding,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";
import { ROLES } from "../../config/routes.config";

const LEAVE_TYPE_CFG = {
  CO: { color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  CL: { color: "bg-blue-100 text-blue-700 border-blue-200"      },
  SL: { color: "bg-amber-100 text-amber-700 border-amber-200"   },
  PL: { color: "bg-purple-100 text-purple-700 border-purple-200"},
};

const STATUS_CFG = {
  pending:   { label: "Pending",   bg: "bg-amber-100",  text: "text-amber-700"  },
  approved:  { label: "Approved",  bg: "bg-green-100",  text: "text-green-700"  },
  rejected:  { label: "Rejected",  bg: "bg-red-100",    text: "text-red-600"    },
  cancelled: { label: "Cancelled", bg: "bg-gray-100",   text: "text-gray-500"   },
};

const LeaveApproval = () => {
  const { user } = useSelector((store) => store.auth);
  const approverName = user?.name || user?.userCode || "Manager";

  const canApprove = [
    ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR,
    ROLES.PRODUCTION_MANAGER, ROLES.QUALITY_MANAGER,
  ].includes(user?.roleName);

  const [leaves,      setLeaves]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [search,       setSearch]       = useState("");
  const [total,        setTotal]        = useState(0);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null); // leave object
  const [rejectReason, setRejectReason] = useState("");
  const [actioning,    setActioning]    = useState(null);

  const fetchLeaves = useCallback(async (status = filterStatus) => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (status !== "all") params.status = status;
      const res = await axios.get(`${baseURL}manpower/leave/all`, { params });
      setLeaves(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error("Failed to load leaves");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchLeaves(filterStatus); }, [filterStatus]);

  const handleApprove = async (leave) => {
    setActioning(leave.Id);
    try {
      await axios.put(`${baseURL}manpower/leave/${leave.Id}/approve`, { approvedBy: approverName });
      toast.success(`Leave approved for ${leave.EmpName}`);
      fetchLeaves(filterStatus);
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed");
    } finally {
      setActioning(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) { toast.error("Enter rejection reason"); return; }
    setActioning(rejectModal.Id);
    try {
      await axios.put(`${baseURL}manpower/leave/${rejectModal.Id}/reject`, {
        rejectionReason: rejectReason.trim(),
        rejectedBy: approverName,
      });
      toast.success(`Leave rejected for ${rejectModal.EmpName}`);
      setRejectModal(null);
      setRejectReason("");
      fetchLeaves(filterStatus);
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed");
    } finally {
      setActioning(null);
    }
  };

  // Filter by search
  const filtered = leaves.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.EmpCode?.toLowerCase().includes(q) ||
      l.EmpName?.toLowerCase().includes(q) ||
      l.Department?.toLowerCase().includes(q)
    );
  });

  // Stats counts
  const counts = {
    all:       leaves.length,
    pending:   leaves.filter((l) => l.Status === "pending").length,
    approved:  leaves.filter((l) => l.Status === "approved").length,
    rejected:  leaves.filter((l) => l.Status === "rejected").length,
    cancelled: leaves.filter((l) => l.Status === "cancelled").length,
  };

  if (!canApprove) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center p-10">
        <div>
          <FaTimesCircle className="text-5xl text-red-300 mx-auto mb-4" />
          <h2 className="text-xl font-black text-gray-700">Access Denied</h2>
          <p className="text-gray-400 text-sm mt-2">Only Managers, HR, and Admins can access the Leave Approval page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-base font-black flex items-center gap-2"><FaTimesCircle /> Reject Leave</h3>
              <p className="text-red-200 text-xs mt-1">{rejectModal.EmpName} · {rejectModal.LeaveType} · {String(rejectModal.FromDate).slice(0,10)} → {String(rejectModal.ToDate).slice(0,10)}</p>
            </div>
            <div className="p-5">
              <label className="block text-xs font-bold text-gray-600 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this leave is being rejected…" rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setRejectModal(null); setRejectReason(""); }}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition">
                  Cancel
                </button>
                <button onClick={handleRejectSubmit} disabled={!rejectReason.trim() || actioning === rejectModal.Id}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-50">
                  {actioning === rejectModal.Id ? "Rejecting…" : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl"><FaUserTie className="text-amber-600 text-lg" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">Leave Approval</h1>
              <p className="text-xs text-gray-400 mt-0.5">Review and action employee leave requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold">Approver: <span className="text-indigo-600">{approverName}</span></span>
            <button onClick={() => fetchLeaves(filterStatus)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded-xl text-xs font-semibold transition">
              <FaSync size={10} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">

        {/* Status filter tabs + search */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            {[
              { key: "pending",   label: "Pending",   color: "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400"  },
              { key: "approved",  label: "Approved",  color: "bg-green-50 text-green-700 border-green-200 hover:border-green-400"  },
              { key: "rejected",  label: "Rejected",  color: "bg-red-50 text-red-600 border-red-200 hover:border-red-400"          },
              { key: "cancelled", label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400"      },
              { key: "all",       label: "All",       color: "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400"  },
            ].map(({ key, label, color }) => (
              <button key={key} onClick={() => setFilterStatus(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition
                  ${color} ${filterStatus === key ? "ring-2 ring-offset-1 ring-indigo-400 shadow-sm" : ""}`}>
                {label}
                <span className="font-black">{counts[key] ?? 0}</span>
              </button>
            ))}
            <div className="relative ml-auto min-w-[200px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={11} />
              <input type="text" placeholder="Search employee, dept…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
            <MdOutlineFactCheck className="text-5xl text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-400">No leave requests found</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">Showing <span className="font-bold text-gray-700">{filtered.length}</span> requests</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {["Emp Code","Name","Department","Type","From","To","Days","Reason","Status","Applied","Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((l, i) => {
                    const stCfg   = STATUS_CFG[l.Status] || STATUS_CFG.pending;
                    const typeCfg = LEAVE_TYPE_CFG[l.LeaveType];
                    const isPending = l.Status === "pending";
                    return (
                      <tr key={l.Id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-indigo-50/20 transition-colors`}>
                        <td className="px-4 py-3 font-mono text-gray-700 font-semibold">{l.EmpCode}</td>
                        <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">{l.EmpName || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{l.Department || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full border ${typeCfg?.color || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {l.LeaveType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{String(l.FromDate).slice(0,10)}</td>
                        <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{String(l.ToDate).slice(0,10)}</td>
                        <td className="px-4 py-3 font-bold text-center text-gray-700">{l.TotalDays}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                          <p className="truncate" title={l.Reason}>{l.Reason || "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${stCfg.bg} ${stCfg.text}`}>
                            {stCfg.label}
                          </span>
                          {l.Status === "rejected" && l.RejectionReason && (
                            <p className="text-[9px] text-red-500 mt-0.5 max-w-[100px] truncate" title={l.RejectionReason}>{l.RejectionReason}</p>
                          )}
                          {l.Status === "approved" && l.ApprovedBy && (
                            <p className="text-[9px] text-green-600 mt-0.5">by {l.ApprovedBy}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {l.AppliedAt ? new Date(l.AppliedAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isPending ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleApprove(l)} disabled={actioning === l.Id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-bold transition disabled:opacity-50 border border-green-200">
                                {actioning === l.Id
                                  ? <div className="w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                                  : <FaCheckCircle size={10} />}
                                Approve
                              </button>
                              <button onClick={() => { setRejectModal(l); setRejectReason(""); }} disabled={actioning === l.Id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold transition disabled:opacity-50 border border-red-100">
                                <FaTimesCircle size={10} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveApproval;
