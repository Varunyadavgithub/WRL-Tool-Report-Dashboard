import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import {
  FaCalendarAlt, FaSearch, FaPlus, FaTrash, FaCheckCircle,
  FaTimesCircle, FaClock, FaFileAlt, FaUser,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";

const LEAVE_TYPES = [
  { value: "CO", label: "CO – Compensatory Off",  color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "CL", label: "CL – Casual Leave",      color: "bg-blue-100 text-blue-700 border-blue-200"    },
  { value: "SL", label: "SL – Sick Leave",         color: "bg-amber-100 text-amber-700 border-amber-200"  },
  { value: "PL", label: "PL – Privilege Leave",    color: "bg-purple-100 text-purple-700 border-purple-200"},
];

const STATUS_CFG = {
  pending:   { label: "Pending",   bg: "bg-amber-100",  text: "text-amber-700",  icon: FaClock        },
  approved:  { label: "Approved",  bg: "bg-green-100",  text: "text-green-700",  icon: FaCheckCircle  },
  rejected:  { label: "Rejected",  bg: "bg-red-100",    text: "text-red-700",    icon: FaTimesCircle  },
  cancelled: { label: "Cancelled", bg: "bg-gray-100",   text: "text-gray-500",   icon: FaTimesCircle  },
};

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const calcWorkingDays = (from, to) => {
  if (!from || !to) return 0;
  let count = 0;
  const cur = new Date(from + "T00:00:00");
  const end = new Date(to   + "T00:00:00");
  while (cur <= end) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1); }
  return count;
};

const LeaveTypeBadge = ({ type }) => {
  const cfg = LEAVE_TYPES.find((t) => t.value === type);
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {type}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
};

const LeaveApplication = () => {
  const today = isoDate(new Date());

  // search state
  const [searchCode, setSearchCode] = useState("");
  const [empInfo,    setEmpInfo]    = useState(null);

  // form state
  const [form, setForm] = useState({
    leaveType: "CL", fromDate: today, toDate: today, reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // history state
  const [leaves,      setLeaves]      = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [cancelId,    setCancelId]    = useState(null);

  const totalDays = calcWorkingDays(form.fromDate, form.toDate);

  const fetchMyLeaves = useCallback(async (code) => {
    if (!code) return;
    setHistLoading(true);
    try {
      const res = await axios.get(`${baseURL}manpower/leave/my`, { params: { empCode: code } });
      setLeaves(res.data.data || []);
    } catch { /* silent */ }
    finally { setHistLoading(false); }
  }, []);

  const handleSearch = async () => {
    if (!searchCode.trim()) { toast.error("Enter employee code"); return; }
    try {
      // fetch last month's attendance to validate the employee exists
      const now  = new Date();
      const from = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const to   = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const res  = await axios.get(`${baseURL}manpower/attendance`, {
        params: { fromDate: from, toDate: to, empCode: searchCode.trim().toUpperCase() },
      });
      const data = res.data.data || [];
      if (data.length > 0) {
        const info = { code: data[0].EmpCode || searchCode, name: data[0].EmployeeName, dept: data[0].Department };
        setEmpInfo(info);
        fetchMyLeaves(info.code);
        toast.success(`Found: ${info.name}`);
      } else {
        toast.error("Employee not found in attendance records");
        setEmpInfo(null);
      }
    } catch (err) {
      toast.error("Search failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!empInfo) { toast.error("Search for an employee first"); return; }
    if (totalDays <= 0) { toast.error("Invalid date range"); return; }
    if (!form.reason.trim()) { toast.error("Please provide a reason"); return; }

    setSubmitting(true);
    try {
      await axios.post(`${baseURL}manpower/leave/apply`, {
        empCode:    empInfo.code,
        empName:    empInfo.name,
        department: empInfo.dept,
        leaveType:  form.leaveType,
        fromDate:   form.fromDate,
        toDate:     form.toDate,
        totalDays,
        reason:     form.reason.trim(),
      });
      toast.success("Leave application submitted successfully!");
      setForm({ leaveType: "CL", fromDate: today, toDate: today, reason: "" });
      fetchMyLeaves(empInfo.code);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!empInfo) return;
    setCancelId(id);
    try {
      await axios.put(`${baseURL}manpower/leave/${id}/cancel`, { empCode: empInfo.code });
      toast.success("Leave cancelled");
      fetchMyLeaves(empInfo.code);
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancel failed");
    } finally {
      setCancelId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl"><FaFileAlt className="text-indigo-600 text-lg" /></div>
          <div>
            <h1 className="text-base font-black text-gray-800 leading-none">Leave Application</h1>
            <p className="text-xs text-gray-400 mt-0.5">Apply for CO, CL, SL, PL leave</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* Search + Apply in one row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Employee lookup */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Employee Lookup</p>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder="e.g. WRLZ0242"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono uppercase"
              />
              <button onClick={handleSearch}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-sm">
                <FaSearch size={11} />
              </button>
            </div>
            {empInfo ? (
              <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-xl p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FaUser className="text-white" />
                  </div>
                  <div>
                    <p className="font-black text-base leading-tight">{empInfo.name}</p>
                    <p className="text-indigo-200 text-xs font-mono mt-0.5">{empInfo.code}</p>
                    {empInfo.dept && <p className="text-indigo-200 text-xs">{empInfo.dept}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-300">
                <FaUser className="text-3xl mx-auto mb-2" />
                <p className="text-xs text-gray-400">Search to load employee</p>
              </div>
            )}

            {/* Leave type legend */}
            <div className="mt-4 space-y-1.5">
              {LEAVE_TYPES.map((t) => (
                <div key={t.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${t.color}`}>
                  <span className="font-black w-6">{t.value}</span>
                  <span>{t.label.split("–")[1].trim()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Application form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:col-span-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Apply for Leave</p>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Leave type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map((t) => (
                    <button type="button" key={t.value}
                      onClick={() => setForm((f) => ({ ...f, leaveType: t.value }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                        form.leaveType === t.value
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                      }`}>
                      <span className="font-black text-base leading-none">{t.value}</span>
                      <span className="text-xs font-medium leading-tight">{t.label.split("–")[1].trim()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
                  <input type="date" value={form.fromDate} min={today}
                    onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value, toDate: e.target.value > f.toDate ? e.target.value : f.toDate }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
                  <input type="date" value={form.toDate} min={form.fromDate}
                    onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
              </div>

              {/* Days count */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${totalDays > 0 ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-200"}`}>
                <span className="text-sm text-gray-600 font-medium">Working Days</span>
                <span className={`text-xl font-black ${totalDays > 0 ? "text-indigo-700" : "text-gray-400"}`}>{totalDays}</span>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Reason <span className="text-red-400">*</span></label>
                <textarea value={form.reason} rows={3}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Briefly explain the reason for leave…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
              </div>

              <button type="submit" disabled={submitting || !empInfo || totalDays <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200 disabled:opacity-50">
                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaPlus size={12} />}
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          </div>
        </div>

        {/* Leave history */}
        {empInfo && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <MdOutlineFactCheck className="text-indigo-400 text-base" />
                Leave History — {empInfo.name}
              </h2>
              <button onClick={() => fetchMyLeaves(empInfo.code)} disabled={histLoading}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold flex items-center gap-1">
                {histLoading ? <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" /> : "↻"} Refresh
              </button>
            </div>

            {histLoading ? (
              <div className="p-10 text-center">
                <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : leaves.length === 0 ? (
              <div className="p-10 text-center text-gray-300">
                <FaCalendarAlt className="text-4xl mx-auto mb-2" />
                <p className="text-sm text-gray-400">No leave applications yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {["#","Type","From","To","Days","Reason","Status","Applied On","Action"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leaves.map((l, i) => (
                      <tr key={l.Id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-indigo-50/20`}>
                        <td className="px-4 py-2.5 text-gray-400 font-mono">{l.Id}</td>
                        <td className="px-4 py-2.5"><LeaveTypeBadge type={l.LeaveType} /></td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{String(l.FromDate).slice(0,10)}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{String(l.ToDate).slice(0,10)}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-700 text-center">{l.TotalDays}</td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate" title={l.Reason}>{l.Reason || "—"}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={l.Status} />
                          {l.Status === "rejected" && l.RejectionReason && (
                            <p className="text-[9px] text-red-500 mt-0.5 max-w-[140px] truncate" title={l.RejectionReason}>
                              {l.RejectionReason}
                            </p>
                          )}
                          {l.Status === "approved" && l.ApprovedBy && (
                            <p className="text-[9px] text-green-600 mt-0.5">by {l.ApprovedBy}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                          {l.AppliedAt ? new Date(l.AppliedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {l.Status === "pending" && (
                            <button onClick={() => handleCancel(l.Id)} disabled={cancelId === l.Id}
                              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold transition disabled:opacity-50 border border-red-100">
                              {cancelId === l.Id
                                ? <div className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                                : <FaTrash size={9} />}
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveApplication;
