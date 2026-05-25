import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSync,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaClipboardList,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaChartBar,
  FaIndustry,
  FaBan,
  FaArrowRight,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { MdPendingActions } from "react-icons/md";
import useAuditData from "../../hooks/useAuditData";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const relativeTime = (d) => {
  if (!d) return "—";
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const STATUS_CLR = {
  approved:  { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  submitted: { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"    },
  rejected:  { bg: "bg-red-50",      text: "text-red-600",     border: "border-red-200",     dot: "bg-red-500"     },
  rework:    { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500"  },
  draft:     { bg: "bg-gray-100",    text: "text-gray-600",    border: "border-gray-200",    dot: "bg-gray-400"    },
};

// ── Bar component ─────────────────────────────────────────────────────────────

const Bar = ({ value, max, color, label, count }) => {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 flex-shrink-0 text-right">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 flex-shrink-0">{count}</span>
      <span className="text-[10px] text-gray-400 w-8 flex-shrink-0">{w}%</span>
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({ label, value, icon: Icon, iconCls, bg, border, valCls, sub }) => (
  <div className={`${bg} border ${border} rounded-2xl px-5 py-4`}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">{label}</p>
      <Icon className={`${iconCls} text-lg`} />
    </div>
    <p className={`text-3xl font-black ${valCls}`}>{value}</p>
    {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const AuditDashboard = () => {
  const navigate = useNavigate();
  const { loadAudits, fetchAuditModelSummary, fetchAuditStats } = useAuditData();

  const [loading, setLoading]               = useState(true);
  const [lastRefreshed, setLastRefreshed]   = useState(null);

  // Data
  const [stats, setStats]             = useState(null);      // audit status counts
  const [modelSummary, setModelSummary] = useState([]);      // model production/audit data
  const [recentAudits, setRecentAudits] = useState([]);      // last 8 audits
  const [cpAgg, setCpAgg]             = useState({ pass: 0, fail: 0, warning: 0, na: 0, pending: 0, total: 0 });

  // ── Load all data ─────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, modelRes, recentRes, cpRes] = await Promise.all([
        fetchAuditStats(),
        fetchAuditModelSummary({}),
        loadAudits({ limit: 10, page: 1 }),
        loadAudits({ limit: 200, page: 1 }),   // for checkpoint aggregation
      ]);

      setStats(statsRes?.data?.summary || null);
      setModelSummary(modelRes?.data || []);
      setRecentAudits(recentRes?.data || []);

      // Aggregate checkpoint pass/fail/warning from audit summaries
      const agg = { pass: 0, fail: 0, warning: 0, na: 0, pending: 0, total: 0 };
      (cpRes?.data || []).forEach((a) => {
        if (a.summary && typeof a.summary === "object") {
          agg.pass    += a.summary.pass    || 0;
          agg.fail    += a.summary.fail    || 0;
          agg.warning += a.summary.warning || 0;
          agg.na      += a.summary.na      || 0;
          agg.pending += a.summary.pending || 0;
          agg.total   += a.summary.total   || 0;
        }
      });
      setCpAgg(agg);
      setLastRefreshed(new Date());
    } catch (err) {
      toast.error("Failed to load dashboard: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchAuditStats, fetchAuditModelSummary, loadAudits]);

  useEffect(() => { loadDashboard(); }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalAudits    = stats?.TotalAudits    || 0;
  const approvedCount  = stats?.ApprovedCount  || 0;
  const submittedCount = stats?.SubmittedCount || 0;
  const rejectedCount  = stats?.RejectedCount  || 0;
  const draftCount     = Math.max(0, totalAudits - approvedCount - submittedCount - rejectedCount);
  const approvalRate   = pct(approvedCount, totalAudits);

  const cpPassRate = pct(cpAgg.pass, cpAgg.total);

  const modelTotals = modelSummary.reduce(
    (a, r) => ({
      production:    a.production    + r.production,
      auditRequired: a.auditRequired + r.auditRequired,
      auditDone:     a.auditDone     + r.auditDone,
      pending:       a.pending       + r.pending,
    }),
    { production: 0, auditRequired: 0, auditDone: 0, pending: 0 },
  );

  // Top models sorted by fail % (models with known audit data)
  const topPendingModels = [...modelSummary]
    .filter((m) => m.pending > 0)
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 5);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <HiClipboardDocumentCheck className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900 leading-none">Audit Dashboard</h1>
              {lastRefreshed && (
                <p className="text-[10px] text-gray-400 mt-0.5">Updated {lastRefreshed.toLocaleTimeString()}</p>
              )}
            </div>
          </div>
          <button
            onClick={loadDashboard}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-500 rounded-xl text-xs font-semibold transition"
          >
            <FaSync size={11} /> Refresh
          </button>
        </div>
      </div>

      <div className="w-full px-6 py-5 space-y-5">

        {/* ── Row 1: Audit Status KPIs ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Total Audits"    value={totalAudits}    icon={FaClipboardList}  iconCls="text-indigo-400"  bg="bg-indigo-50"  border="border-indigo-100" valCls="text-indigo-700"  sub={`${approvalRate}% approval rate`} />
          <KpiCard label="Approved"        value={approvedCount}  icon={FaCheckCircle}   iconCls="text-emerald-500" bg="bg-emerald-50" border="border-emerald-100" valCls="text-emerald-700" sub="Fully reviewed & signed off" />
          <KpiCard label="Pending Review"  value={submittedCount} icon={FaHourglassHalf} iconCls="text-amber-500"   bg="bg-amber-50"   border="border-amber-100"  valCls="text-amber-700"  sub="Awaiting LQE decision" />
          <KpiCard label="Rejected"        value={rejectedCount}  icon={FaTimesCircle}   iconCls="text-red-400"     bg="bg-red-50"     border="border-red-100"    valCls="text-red-600"    sub="Returned for correction" />
          <KpiCard label="Draft"           value={draftCount}     icon={FaClipboardCheck}iconCls="text-gray-400"    bg="bg-gray-50"    border="border-gray-200"   valCls="text-gray-600"   sub="Not yet submitted" />
          <KpiCard label="Pass Rate (CPs)" value={`${cpPassRate}%`} icon={FaChartBar}   iconCls="text-blue-400"    bg="bg-blue-50"    border="border-blue-100"   valCls="text-blue-700"   sub={`${cpAgg.total.toLocaleString()} total checkpoints`} />
        </div>

        {/* ── Row 2: Checkpoint Breakdown + Audit Status bars ──────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Checkpoint Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg"><FaChartBar className="text-indigo-500 text-sm" /></div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">Checkpoint Results</h3>
                  <p className="text-[10px] text-gray-400">Aggregated from all audits</p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
                {cpAgg.total.toLocaleString()} total
              </span>
            </div>
            <div className="space-y-3">
              <Bar value={cpAgg.pass}    max={cpAgg.total} color="bg-emerald-400" label="Pass"    count={cpAgg.pass} />
              <Bar value={cpAgg.fail}    max={cpAgg.total} color="bg-red-400"     label="Fail"    count={cpAgg.fail} />
              <Bar value={cpAgg.warning} max={cpAgg.total} color="bg-amber-400"   label="Warning" count={cpAgg.warning} />
              <Bar value={cpAgg.na}      max={cpAgg.total} color="bg-blue-300"    label="N/A"     count={cpAgg.na} />
              <Bar value={cpAgg.pending} max={cpAgg.total} color="bg-gray-300"    label="Pending" count={cpAgg.pending} />
            </div>

            {/* Mini pass-rate visual */}
            {cpAgg.total > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Overall checkpoint distribution</span>
                  <span className={`font-bold ${cpPassRate >= 80 ? "text-emerald-600" : cpPassRate >= 60 ? "text-amber-600" : "text-red-500"}`}>
                    {cpPassRate}% pass
                  </span>
                </div>
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-gray-100">
                  {[
                    { val: cpAgg.pass,    cls: "bg-emerald-400" },
                    { val: cpAgg.warning, cls: "bg-amber-400"   },
                    { val: cpAgg.fail,    cls: "bg-red-400"     },
                    { val: cpAgg.na,      cls: "bg-blue-300"    },
                    { val: cpAgg.pending, cls: "bg-gray-300"    },
                  ].map(({ val, cls }, i) => val > 0 && (
                    <div
                      key={i}
                      className={`h-full ${cls} transition-all`}
                      style={{ width: `${pct(val, cpAgg.total)}%` }}
                      title={`${val}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Audit Status Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-amber-50 rounded-lg"><MdPendingActions className="text-amber-500 text-sm" /></div>
              <div>
                <h3 className="text-sm font-black text-gray-800">Audit Status Breakdown</h3>
                <p className="text-[10px] text-gray-400">Distribution across all {totalAudits} audits</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <Bar value={approvedCount}  max={totalAudits} color="bg-emerald-400" label="Approved"  count={approvedCount} />
              <Bar value={submittedCount} max={totalAudits} color="bg-amber-400"   label="Pending"   count={submittedCount} />
              <Bar value={rejectedCount}  max={totalAudits} color="bg-red-400"     label="Rejected"  count={rejectedCount} />
              <Bar value={draftCount}     max={totalAudits} color="bg-gray-300"    label="Draft"     count={draftCount} />
            </div>

            {/* Quick action if there are pending audits */}
            {submittedCount > 0 && (
              <button
                onClick={() => navigate("/auditreport/audit-approval")}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold transition"
              >
                <FaHourglassHalf size={11} />
                {submittedCount} audit{submittedCount !== 1 ? "s" : ""} waiting for approval
                <FaArrowRight size={10} />
              </button>
            )}
          </div>
        </div>

        {/* ── Row 3: Model Summary Table ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 rounded-lg"><FaIndustry className="text-blue-500 text-sm" /></div>
              <div>
                <h3 className="text-sm font-black text-gray-800">Model Summary</h3>
                <p className="text-[10px] text-gray-400">Current shift · {modelSummary.length} models tracked</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {modelTotals.pending > 0 && (
                <span className="text-[10px] font-bold px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full">
                  {modelTotals.pending} pending audits
                </span>
              )}
              <span className={`text-xs font-black px-3 py-1 rounded-full ${pct(modelTotals.auditDone, modelTotals.auditRequired) >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {pct(modelTotals.auditDone, modelTotals.auditRequired)}% complete
              </span>
            </div>
          </div>

          {modelSummary.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
              <FaExclamationTriangle className="text-3xl text-gray-200 mb-3" />
              <p className="text-sm font-semibold">No production data for this shift</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 border-b border-blue-100">
                    {["#", "Model", "Production", "Required", "Done", "Pending", "Completion"].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-blue-500 ${i > 1 ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {modelSummary.map((row, idx) => {
                    const rate = pct(row.auditDone, row.auditRequired);
                    return (
                      <tr key={row.modelName} className={`hover:bg-blue-50/20 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                        <td className="px-4 py-2.5 text-[11px] text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-black text-gray-800 text-xs">{row.modelName}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-blue-600 text-xs">{row.production}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-gray-700 text-xs">{row.auditRequired}</td>
                        <td className="px-4 py-2.5 text-center text-xs">
                          <span className={`font-bold ${row.auditDone > 0 ? "text-emerald-600" : "text-gray-400"}`}>{row.auditDone}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs">
                          <span className={`font-bold ${row.pending > 0 ? "text-red-500" : "text-emerald-500"}`}>{row.pending}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${rate >= 80 ? "bg-emerald-400" : rate > 0 ? "bg-amber-400" : "bg-gray-200"}`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold w-8 flex-shrink-0 ${rate >= 80 ? "text-emerald-600" : rate > 0 ? "text-amber-600" : "text-gray-400"}`}>
                              {rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50/60 border-t-2 border-blue-100">
                    <td className="px-4 py-3" colSpan={2}><span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">Total</span></td>
                    <td className="px-4 py-3 text-center font-black text-blue-700 text-xs">{modelTotals.production}</td>
                    <td className="px-4 py-3 text-center font-black text-gray-800 text-xs">{modelTotals.auditRequired}</td>
                    <td className="px-4 py-3 text-center font-black text-emerald-700 text-xs">{modelTotals.auditDone}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-black text-xs ${modelTotals.pending > 0 ? "text-red-600" : "text-emerald-600"}`}>{modelTotals.pending}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-black ${pct(modelTotals.auditDone, modelTotals.auditRequired) >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                        {pct(modelTotals.auditDone, modelTotals.auditRequired)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Row 4: Top Pending Models + Recent Audits ─────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Top Pending Models */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-red-50 rounded-lg"><FaExclamationTriangle className="text-red-400 text-sm" /></div>
              <div>
                <h3 className="text-sm font-black text-gray-800">Models with Pending Audits</h3>
                <p className="text-[10px] text-gray-400">Requires immediate attention</p>
              </div>
            </div>

            {topPendingModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <FaCheckCircle className="text-3xl text-emerald-200 mb-2" />
                <p className="text-sm font-semibold text-emerald-500">All models are on track!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPendingModels.map((m, idx) => {
                  const rate = pct(m.auditDone, m.auditRequired);
                  return (
                    <div key={m.modelName} className="flex items-center gap-3 p-3 bg-red-50/40 border border-red-100 rounded-xl">
                      <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-black text-gray-800 truncate">{m.modelName}</p>
                          <span className="text-[10px] font-bold text-red-600 ml-2 flex-shrink-0">{m.pending} pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${rate >= 80 ? "bg-emerald-400" : rate > 0 ? "bg-amber-400" : "bg-gray-300"}`} style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{m.auditDone}/{m.auditRequired} done</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Audits */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-50 rounded-lg"><FaClipboardList className="text-violet-500 text-sm" /></div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">Recent Audits</h3>
                  <p className="text-[10px] text-gray-400">Last 10 entries</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold px-2.5 py-1 bg-violet-50 text-violet-600 border border-violet-100 rounded-full">
                  {recentAudits.length} records
                </span>
                <button
                  onClick={() => navigate("/auditreport/audits")}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition"
                >
                  View all <FaArrowRight size={9} />
                </button>
              </div>
            </div>

            {recentAudits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <FaClipboardList className="text-3xl text-gray-200 mb-2" />
                <p className="text-sm font-semibold">No audits yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-violet-50 border-b border-violet-100">
                      {["REPORT", "STATUS", "BY", "CREATED"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-violet-500 text-left"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentAudits.map((audit, idx) => {
                      const clr = STATUS_CLR[audit.status] || STATUS_CLR.draft;
                      return (
                        <tr
                          key={audit.id}
                          onClick={() => navigate(`/auditreport/audits/${audit.id}`)}
                          className={`hover:bg-violet-50/30 transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                        >
                          <td className="px-4 py-2.5 max-w-[140px]">
                            <p className="font-black text-gray-800 truncate">{audit.auditCode || `#${audit.id}`}</p>
                            <p className="text-[10px] text-gray-400 truncate">{audit.templateName || "—"}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${clr.bg} ${clr.text} ${clr.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${clr.dot}`} />
                              {audit.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 font-semibold">{audit.createdBy || "—"}</td>
                          <td className="px-4 py-2.5">
                            <p className="text-gray-600">{fmtDate(audit.createdAt)}</p>
                            <p className="text-[10px] text-gray-400">{relativeTime(audit.createdAt)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuditDashboard;
