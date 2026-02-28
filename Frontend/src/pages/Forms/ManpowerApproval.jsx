import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

// ─────────────────────────────────────────────────────────────────────────────
// Real API Status values (from actual response):
//   "Pending HOD Approval"
//   "Pending HR Approval"
//   "Pending Plant Head Approval"
//   "Approved"  /  "Final Approved"
//   "Rejected"
//
// Real API individual status fields:
//   HODStatus, HRStatus, PlantHeadStatus  →  "Pending" | "Approved" | "Rejected"
//
// Real API data fields used:
//   Id, RequestCode, DepartmentName, RequiredDate,
//   OvertimeFrom, OvertimeTo, Justification, TotalManpower,
//   Status, HODStatus, HRStatus, PlantHeadStatus,
//   HODRemark, HRRemark, PlantHeadRemark,
//   CreatedBy, CreatedDate, EscalationLevel
// ─────────────────────────────────────────────────────────────────────────────

const ManpowerApproval = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isPast6PM, setIsPast6PM] = useState(false);
  const [search, setSearch] = useState("");

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const userRole = user?.role || "HR";

  useEffect(() => {
    fetchData();
  }, []);

  // ── FETCH ──────────────────────────────────────────────────────────────────
  const fetchData = () => {
    setLoading(true);
    axios
      .get(`${baseURL}manpower/list`)
      .then((res) => setData(res.data.data))
      .catch(() => toast.error("Failed to load requests"))
      .finally(() => setLoading(false));
  };

  // ── SEARCH ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(
      (item) =>
        item.DepartmentName?.toLowerCase().includes(q) ||
        item.RequestCode?.toLowerCase().includes(q),
    );
  }, [search, data]);

  // ── STATS ──────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: data.length,
      pending: data.filter((d) => d.Status?.startsWith("Pending")).length,
      approved: data.filter(
        (d) => d.Status === "Approved" || d.Status === "Final Approved",
      ).length,
      rejected: data.filter((d) => d.Status === "Rejected").length,
    }),
    [data],
  );

  // ── 6PM COUNTDOWN (with next-day rollover) ─────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const sixPM = new Date();
      sixPM.setHours(18, 0, 0, 0);
      if (sixPM <= now) sixPM.setDate(sixPM.getDate() + 1);
      const diff = sixPM - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setIsPast6PM(now.getHours() >= 18);
      setTimeLeft(
        `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── APPROVE / REJECT ───────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    try {
      await axios.post(`${baseURL}manpower/approve`, {
        requestId: id,
        role: userRole,
      });
      toast.success("Approved successfully");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed");
    }
  };

  const handleReject = async (id, remark = "") => {
    try {
      await axios.post(`${baseURL}manpower/reject`, {
        requestId: id,
        role: userRole,
        remark,
      });
      toast.success("Rejected successfully");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed");
    }
  };

  // ── ROLE → can they act on this item? ─────────────────────────────────────
  const canApprove = (item) => {
    if (userRole === "HOD" && item.Status === "Pending HOD Approval")
      return true;
    if (userRole === "HR" && item.Status === "Pending HR Approval") return true;
    if (
      userRole === "PlantHead" &&
      item.Status === "Pending Plant Head Approval"
    )
      return true;
    return false;
  };

  // ── WORKFLOW TRACKER ───────────────────────────────────────────────────────
  // Uses the per-step HODStatus / HRStatus / PlantHeadStatus fields directly.
  const WorkflowTracker = ({ item }) => {
    const steps = [
      {
        label: "HOD",
        stepStatus: item.HODStatus,
        remark: item.HODRemark,
        approvedAt: item.HODApprovedAt,
      },
      {
        label: "HR",
        stepStatus: item.HRStatus,
        remark: item.HRRemark,
        approvedAt: item.HRApprovedAt,
      },
      {
        label: "Plant Head",
        stepStatus: item.PlantHeadStatus,
        remark: item.PlantHeadRemark,
        approvedAt: item.PlantHeadApprovedAt,
      },
    ];

    const getCircleClass = (stepStatus) => {
      if (stepStatus === "Approved")
        return "bg-emerald-500 text-white border-emerald-500";
      if (stepStatus === "Rejected")
        return "bg-rose-500    text-white border-rose-500";
      if (stepStatus === "Pending")
        return "bg-amber-400   text-white border-amber-400";
      return "bg-white text-slate-400 border-slate-300";
    };

    const getLabelClass = (stepStatus) => {
      if (stepStatus === "Approved") return "text-emerald-600";
      if (stepStatus === "Rejected") return "text-rose-500";
      if (stepStatus === "Pending") return "text-amber-600";
      return "text-slate-400";
    };

    const getLineClass = (stepStatus) => {
      if (stepStatus === "Approved") return "bg-emerald-400";
      if (stepStatus === "Rejected") return "bg-rose-300";
      return "bg-slate-200";
    };

    return (
      <div className="flex items-center mt-5">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${getCircleClass(step.stepStatus)}`}
                >
                  {step.stepStatus === "Approved" ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      className="w-3.5 h-3.5"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : step.stepStatus === "Rejected" ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      className="w-3.5 h-3.5"
                    >
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 font-semibold whitespace-nowrap ${getLabelClass(step.stepStatus)}`}
                >
                  {step.label}
                </span>
                {step.approvedAt && (
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">
                    {new Date(step.approvedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                )}
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${getLineClass(step.stepStatus)}`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── STATUS BADGE ───────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const map = {
      "Final Approved": "bg-emerald-100 text-emerald-700 border-emerald-200",
      Approved: "bg-teal-100    text-teal-700    border-teal-200",
      Rejected: "bg-rose-100    text-rose-700    border-rose-200",
      "Pending HOD Approval": "bg-sky-100     text-sky-700     border-sky-200",
      "Pending HR Approval": "bg-amber-100   text-amber-700   border-amber-200",
      "Pending Plant Head Approval":
        "bg-violet-100  text-violet-700  border-violet-200",
    };
    const cls = map[status] || "bg-slate-100 text-slate-600 border-slate-200";
    return (
      <span
        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cls}`}
      >
        {status}
      </span>
    );
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      {/* HEADER */}
      <div className="border-b border-slate-300 pb-6 mb-8 flex flex-wrap justify-between items-end gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
            HR Operations
          </p>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Manpower Approval Control
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as:{" "}
            <span className="font-semibold text-indigo-600">{userRole}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Countdown */}
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 border ${isPast6PM ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-200 text-slate-700"}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="w-4 h-4 shrink-0"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold opacity-60 leading-none mb-0.5">
                {isPast6PM ? "Enforcement Active" : "6PM Cutoff"}
              </p>
              <p className="text-sm font-bold font-mono leading-none">
                {timeLeft}
              </p>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="w-4 h-4"
            >
              <path
                d="M23 4v6h-6M1 20v-6h6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15"
                strokeLinecap="round"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* STATS */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total",
              value: stats.total,
              color: "border-slate-300  bg-white",
            },
            {
              label: "Pending",
              value: stats.pending,
              color: "border-amber-200  bg-amber-50",
            },
            {
              label: "Approved",
              value: stats.approved,
              color: "border-emerald-200 bg-emerald-50",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              color: "border-rose-200   bg-rose-50",
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                {s.label}
              </p>
              <p className="text-3xl font-bold text-slate-800 mt-1">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* SEARCH */}
      <div className="relative mb-6">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Search by department or request code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 shadow-sm transition"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="w-3.5 h-3.5"
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* LOADING */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <p className="text-sm font-medium">Loading requests…</p>
        </div>
      )}

      {/* EMPTY */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
          <p className="text-sm font-semibold text-slate-600">
            No requests found
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs underline underline-offset-2 hover:text-slate-600"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* CARDS */}
      {!loading &&
        filtered.map((item) => (
          <div
            key={item.Id}
            className="bg-white border border-slate-200 mb-5 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* TOP */}
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-bold text-slate-800">
                    {item.DepartmentName}
                  </p>
                  <StatusBadge status={item.Status} />
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {item.RequestCode}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">
                  Required by:{" "}
                  <span className="font-medium text-slate-600">
                    {new Date(item.RequiredDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {item.CreatedBy && (
                    <span className="ml-3 text-slate-400">
                      · Raised by{" "}
                      <span className="text-slate-600 font-medium">
                        {item.CreatedBy}
                      </span>
                    </span>
                  )}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  6PM Escalation
                </p>
                <p
                  className={`font-bold font-mono text-sm mt-0.5 ${isPast6PM ? "text-rose-500" : "text-amber-500"}`}
                >
                  {timeLeft}
                </p>
              </div>
            </div>

            {/* WORKFLOW — uses individual HODStatus / HRStatus / PlantHeadStatus */}
            <WorkflowTracker item={item} />

            {/* METRICS — uses TotalManpower (actual API field) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              {[
                { label: "Total Manpower", value: item.TotalManpower },
                {
                  label: "Overtime From",
                  value: item.OvertimeFrom
                    ? new Date(item.OvertimeFrom).toISOString().slice(11, 16)
                    : "",
                },
                {
                  label: "Overtime To",
                  value: item.OvertimeFrom
                    ? new Date(item.OvertimeTo).toISOString().slice(11, 16)
                    : "",
                },
                { label: "Escalation Lvl", value: item.EscalationLevel },
              ].map((m) => (
                <div
                  key={m.label}
                  className="bg-slate-50 border border-slate-100 p-4 rounded-xl"
                >
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    {m.label}
                  </p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {m.value ?? (
                      <span className="text-slate-300 font-normal text-base">
                        —
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <button
                onClick={() =>
                  window.open(`${baseURL}manpower/pdf/${item.Id}`, "_blank")
                }
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="w-4 h-4"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M10 13h4M10 17h4" strokeLinecap="round" />
                </svg>
                View PDF
              </button>

              {canApprove(item) && (
                <>
                  <button
                    onClick={() => handleApprove(item.Id)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-5 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      className="w-4 h-4"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    APPROVE
                  </button>
                  <button
                    onClick={() => handleReject(item.Id)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 px-5 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      className="w-4 h-4"
                    >
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                    REJECT
                  </button>
                </>
              )}

              <button
                onClick={() =>
                  setExpandedId(expandedId === item.Id ? null : item.Id)
                }
                className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {expandedId === item.Id ? "Hide Details" : "View Full Details"}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  className={`w-4 h-4 transition-transform duration-300 ${expandedId === item.Id ? "rotate-180" : ""}`}
                >
                  <path
                    d="M6 9l6 6 6-6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* EXPANDED DETAILS */}
            {expandedId === item.Id && (
              <div className="mt-4 bg-slate-50 border border-slate-100 p-5 rounded-xl space-y-4">
                {/* Justification */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                    Justification
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {item.Justification || "—"}
                  </p>
                </div>

                {/* Per-approver remarks grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "HOD Remark",
                      value: item.HODRemark,
                      status: item.HODStatus,
                      at: item.HODApprovedAt,
                    },
                    {
                      label: "HR Remark",
                      value: item.HRRemark,
                      status: item.HRStatus,
                      at: item.HRApprovedAt,
                    },
                    {
                      label: "Plant Head Remark",
                      value: item.PlantHeadRemark,
                      status: item.PlantHeadStatus,
                      at: item.PlantHeadApprovedAt,
                    },
                  ].map((r) => (
                    <div
                      key={r.label}
                      className="bg-white border border-slate-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                          {r.label}
                        </p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                        ${
                          r.status === "Approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.status === "Rejected"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                        >
                          {r.status || "Pending"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{r.value || "—"}</p>
                      {r.at && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(r.at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Created info */}
                <div className="flex gap-6 text-sm text-slate-500">
                  {item.CreatedBy && (
                    <span>
                      Created by:{" "}
                      <span className="font-semibold text-slate-700">
                        {item.CreatedBy}
                      </span>
                    </span>
                  )}
                  {item.CreatedDate && (
                    <span>
                      On:{" "}
                      <span className="font-semibold text-slate-700">
                        {new Date(item.CreatedDate).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

      {/* FOOTER */}
      {!loading && data.length > 0 && (
        <p className="text-xs text-slate-400 text-right mt-2 pb-4">
          Showing{" "}
          <span className="font-semibold text-slate-600">
            {filtered.length}
          </span>{" "}
          of <span className="font-semibold text-slate-600">{data.length}</span>{" "}
          requests
        </p>
      )}
    </div>
  );
};

export default ManpowerApproval;
