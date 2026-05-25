import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FaSearch,
  FaArrowLeft,
  FaSync,
  FaBarcode,
  FaChartBar,
  FaExclamationTriangle,
  FaClipboardList,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaExternalLinkAlt,
  FaIndustry,
  FaClipboardCheck,
  FaClock,
  FaFileAlt,
  FaEdit,
  FaTools,
} from "react-icons/fa";
import { MdPendingActions } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import useAuditData from "../../../hooks/useAuditData";
import { useLazyGetModelVariantsByAssemblyQuery } from "../../../redux/api/commonApi";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (val) => {
  if (val === null || val === undefined) return "—";
  const n = parseFloat(val);
  if (n > 100) return <span className="font-bold text-red-600">{n}%</span>;
  if (n >= 80) return <span className="font-bold text-emerald-600">{n}%</span>;
  if (n > 0) return <span className="font-bold text-amber-500">{n}%</span>;
  return <span className="font-bold text-gray-400">0%</span>;
};

const STATUS_CFG = {
  draft: {
    cls: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <FaClipboardList size={9} />,
  },
  submitted: {
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <FaHourglassHalf size={9} />,
  },
  approved: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <FaCheckCircle size={9} />,
  },
  rejected: {
    cls: "bg-red-50 text-red-600 border-red-200",
    icon: <FaTimesCircle size={9} />,
  },
  rework: {
    cls: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <FaTools size={9} />,
  },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status?.toLowerCase()] || STATUS_CFG.draft;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${cfg.cls}`}
    >
      {cfg.icon} {status || "draft"}
    </span>
  );
};

const timeAgo = (dateStr) => {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// ── Main Component ────────────────────────────────────────────────────────────

const SerialScan = () => {
  const navigate = useNavigate();
  const { templates, loadTemplates, fetchAuditModelSummary, loadAudits } = useAuditData();
  const { user } = useSelector((store) => store.auth);

  const [serialNumber, setSerialNumber] = useState("");
  const [scanning, setScanning] = useState(false);
  const [fetchModelBySerial] = useLazyGetModelVariantsByAssemblyQuery();
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recentAudits, setRecentAudits] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [myDrafts, setMyDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [reworkAudits, setReworkAudits] = useState([]);
  const [reworkLoading, setReworkLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // ── Load ─────────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setSummaryLoading(true);
    setRecentLoading(true);
    setDraftsLoading(true);
    setReworkLoading(true);
    try {
      const [summaryRes, auditsRes, draftsRes, reworkRes] = await Promise.all([
        fetchAuditModelSummary({}),
        loadAudits({ limit: 10, page: 1 }),
        loadAudits({ status: "draft", limit: 50, page: 1 }),
        loadAudits({ status: "rework", limit: 50, page: 1 }),
      ]);
      loadTemplates({ isActive: true });
      setSummary(summaryRes.data || []);
      setRecentAudits(auditsRes.data || []);

      const userCode = user?.userCode || user?.usercode || user?.name;
      const ownDrafts = (draftsRes.data || []).filter(
        (a) => !userCode || a.createdBy === userCode,
      );
      setMyDrafts(ownDrafts);

      setReworkAudits(reworkRes.data || []);
      setLastRefreshed(new Date());
    } catch (err) {
      toast.error("Failed to load data: " + err.message);
    } finally {
      setSummaryLoading(false);
      setRecentLoading(false);
      setDraftsLoading(false);
      setReworkLoading(false);
    }
  }, [fetchAuditModelSummary, loadAudits, loadTemplates, user]);

  useEffect(() => {
    loadAll();
  }, []);

  // ── Serial scan ──────────────────────────────────────────────────────────────
  // Two serial formats:
  //   Dash format : "D525H223-DAINGMXXWH-XX6" → model = first segment "D525H223"
  //   Barcode     : "42533260508831"           → DB lookup → m.Name from Material table

  const handleSerialSubmit = async () => {
    const serial = serialNumber.trim();
    if (!serial) return;

    console.log("━━━━━━━━━━━━ Serial Scan ━━━━━━━━━━━━");
    console.log("📥 Scanned serial:", serial);

    setScanning(true);
    try {
      let modelCode;

      if (serial.includes("-")) {
        modelCode = serial.split("-")[0].toUpperCase();
        console.log("🔀 Format: dash-serial → extracted model code:", modelCode);
      } else {
        console.log("🔢 Format: barcode → calling DB lookup...");
        const result = await fetchModelBySerial(serial).unwrap();
        console.log("📦 DB lookup result:", result);
        if (!result || result.length === 0) {
          console.warn("⚠️ No product found in DB for serial:", serial);
          toast.error(`No product found for serial: ${serial}`);
          return;
        }
        modelCode = result[0].label.split("-")[0].toUpperCase();
        console.log("✅ Model code from DB (m.Name → first segment):", result[0].label, "→", modelCode);
      }

      console.log("🔍 Looking for template matching model:", modelCode);
      console.log("📋 All loaded templates:", templates.map((t) => ({
        id: t.id,
        name: t.name,
        approvalStatus: t.approvalStatus,
        isActive: t.isActive,
        models: t.models,
      })));

      const isApproved = (t) =>
        t.isActive !== false && t.approvalStatus === "approved";

      const approvedTemplates = templates.filter(isApproved);
      console.log("✔️ Approved templates:", approvedTemplates.map((t) => ({ id: t.id, name: t.name, models: t.models })));

      const byModelsArray = templates.find(
        (t) => isApproved(t) && t.models?.length > 0 && t.models.includes(modelCode),
      );
      console.log("🔎 Match via models[] array:", byModelsArray ? byModelsArray.name : "none");

      const byTemplateName = templates.find(
        (t) => isApproved(t) && t.name.toUpperCase().startsWith(modelCode.toUpperCase()),
      );
      console.log("🔎 Match via template name startsWith:", byTemplateName ? byTemplateName.name : "none");

      const matched = byModelsArray || byTemplateName;
      console.log("🏆 Final match:", matched ? `${matched.name} (id: ${matched.id})` : "NO MATCH");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      if (matched) {
        toast.success(`Template found: ${matched.name}`);
        navigate(`/auditreport/audits/new?template=${matched.id}&serial=${serial}`);
        setSerialNumber("");
      } else {
        toast.error(`No approved template found for model: ${modelCode}`);
      }
    } catch (err) {
      console.error("❌ Serial scan error:", err);
      toast.error("Failed to look up serial. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  // ── Derived totals ─────────────────────────────────────────────────────────

  const totals = summary.reduce(
    (acc, r) => ({
      production: acc.production + r.production,
      auditRequired: acc.auditRequired + r.auditRequired,
      auditDone: acc.auditDone + r.auditDone,
      pending: acc.pending + r.pending,
    }),
    { production: 0, auditRequired: 0, auditDone: 0, pending: 0 },
  );
  const totalPct =
    totals.auditRequired > 0
      ? parseFloat(((totals.auditDone * 100) / totals.auditRequired).toFixed(1))
      : 0;

  const isLoading = summaryLoading || recentLoading;

  // ── Render ─────────────────────────────────────────────────────────────────
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/auditreport/templates")}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500"
          >
            <FaArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <HiClipboardDocumentCheck className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900 leading-none">
                Serial Scan
              </h1>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Audit Entry Portal
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[10px] text-gray-400 hidden sm:block">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-500 rounded-xl text-xs font-semibold transition disabled:opacity-40"
          >
            <FaSync size={11} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* ── Top row: scan card + stats ───────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Scan card */}
          <div className="relative overflow-hidden bg-white border border-indigo-100 rounded-2xl shadow-sm p-5 flex-1">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none">
              <FaBarcode size={140} className="text-indigo-600" />
            </div>
            <div className="relative">
              <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                Scan to Begin
              </p>
              <h2 className="text-gray-800 text-lg font-black mb-3">
                Enter Serial Number
              </h2>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FaBarcode
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300"
                    size={14}
                  />
                  <input
                    type="text"
                    placeholder="e.g. D525H223-DAINGMXXWH-XX6"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSerialSubmit()}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm font-medium transition"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSerialSubmit}
                  disabled={!serialNumber.trim() || scanning}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm transition shadow-sm shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                >
                  {scanning ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Looking up…
                    </>
                  ) : (
                    <>
                      <FaSearch size={12} /> Find &amp; Start
                    </>
                  )}
                </button>
              </div>
              <p className="text-gray-400 text-[11px] mt-2">
                Matches serial to an approved template and opens the audit form
                automatically.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:w-auto">
            {[
              {
                label: "Production",
                value: totals.production,
                color: "text-blue-600",
                bg: "bg-blue-50",
                border: "border-blue-100",
                iconCls: "text-blue-400",
                Icon: FaIndustry,
              },
              {
                label: "Audit Required",
                value: totals.auditRequired,
                color: "text-violet-600",
                bg: "bg-violet-50",
                border: "border-violet-100",
                iconCls: "text-violet-400",
                Icon: FaClipboardList,
              },
              {
                label: "Audit Done",
                value: totals.auditDone,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
                border: "border-emerald-100",
                iconCls: "text-emerald-400",
                Icon: FaClipboardCheck,
              },
              {
                label: "Pending",
                value: totals.pending,
                color: totals.pending > 0 ? "text-red-600" : "text-gray-400",
                bg: totals.pending > 0 ? "bg-red-50" : "bg-gray-50",
                border:
                  totals.pending > 0 ? "border-red-100" : "border-gray-100",
                iconCls: totals.pending > 0 ? "text-red-400" : "text-gray-300",
                Icon: MdPendingActions,
              },
            ].map(({ label, value, color, bg, border, iconCls, Icon }) => (
              <div
                key={label}
                className={`${bg} border ${border} rounded-2xl px-4 py-3 min-w-[120px]`}
              >
                <Icon className={`${iconCls} text-lg mb-1`} />
                <p className="text-[11px] text-gray-500 font-semibold">
                  {label}
                </p>
                <p className={`text-2xl font-black ${color}`}>
                  {summaryLoading ? "—" : value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom grid: Model Summary | Recent Audits | My Drafts | Rework ─── */}
        <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-1 gap-4 min-w-[1100px]">
          {/* ── Model Summary ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <FaChartBar className="text-blue-600" size={12} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">
                    Model Summary
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Current shift · {summary.length} models
                  </p>
                </div>
              </div>
              {!summaryLoading && summary.length > 0 && (
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full ${totalPct >= 80 ? "bg-emerald-100 text-emerald-700" : totalPct > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {totalPct}% overall
                </span>
              )}
            </div>

            {summaryLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : summary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <FaExclamationTriangle className="text-3xl text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-400">
                  No production data for this shift
                </p>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-indigo-50 border-b border-indigo-100">
                      {[
                        "#",
                        "Model",
                        "Prod.",
                        "Required",
                        "Done",
                        "Pending",
                        "%",
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500 ${i > 1 ? "text-center" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summary.map((row, idx) => (
                      <tr
                        key={row.modelName}
                        className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                      >
                        <td className="px-4 py-2.5 text-[11px] text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 font-black text-gray-800 text-xs">
                          {row.modelName}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-blue-600 text-xs">
                          {row.production}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-gray-700 text-xs">
                          {row.auditRequired}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs">
                          <span
                            className={`font-bold ${row.auditDone > 0 ? "text-emerald-600" : "text-gray-400"}`}
                          >
                            {row.auditDone}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs">
                          <span
                            className={`font-bold ${row.pending > 0 ? "text-red-500" : "text-emerald-500"}`}
                          >
                            {row.pending > 0 ? row.pending : "0"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs">
                          {pct(row.percentage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50/60 border-t-2 border-indigo-100">
                      <td className="px-4 py-3" colSpan={2}>
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider">
                          Total
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-black text-blue-700 text-xs">
                        {totals.production}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-gray-800 text-xs">
                        {totals.auditRequired}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-emerald-700 text-xs">
                        {totals.auditDone}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <span
                          className={`font-black ${totals.pending > 0 ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {totals.pending}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {pct(totalPct)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Recent Audits ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-50 rounded-lg">
                  <FaClipboardList className="text-violet-600" size={12} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">
                    Recent Audits
                  </h3>
                  <p className="text-[10px] text-gray-400">Last 10 entries</p>
                </div>
              </div>
              {recentAudits.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold border border-violet-200">
                  {recentAudits.length} records
                </span>
              )}
            </div>

            {recentLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-violet-100 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : recentAudits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <FaClipboardList className="text-3xl text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-400">
                  No audits found
                </p>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-violet-50 border-b border-violet-100">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        #
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        Audit Code
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        Template
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        Report
                      </th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        By
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentAudits.map((audit, idx) => (
                      <tr
                        key={audit.id}
                        onClick={() => navigate(`/auditreport/audits/${audit.id}`)}
                        className={`hover:bg-violet-50/30 transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                      >
                        <td className="px-4 py-2.5 text-[11px] text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-black text-gray-800 text-xs whitespace-nowrap">
                            {audit.auditCode || `#${audit.id}`}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[140px]">
                          <span
                            className="text-xs text-gray-700 font-semibold truncate block"
                            title={audit.templateName}
                          >
                            {audit.templateName || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[120px]">
                          <span
                            className="text-xs text-gray-500 truncate block"
                            title={audit.reportName}
                          >
                            {audit.reportName || "—"}
                          </span>
                          {audit.formatNo && (
                            <span className="text-[10px] text-gray-400">
                              {audit.formatNo}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <StatusBadge status={audit.status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                          {audit.submittedBy || audit.createdBy || "—"}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-600">
                            {fmtDate(audit.createdAt)}
                          </span>
                          <br />
                          <span className="text-[10px] text-gray-400">
                            {timeAgo(audit.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── My Drafts ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-amber-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 rounded-lg">
                  <FaFileAlt className="text-amber-500 text-sm" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">My Drafts</h3>
                  <p className="text-[10px] text-gray-400">Your saved draft audits</p>
                </div>
              </div>
              {myDrafts.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold border border-amber-200">
                  {myDrafts.length} draft{myDrafts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {draftsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-amber-100 border-t-amber-400 rounded-full animate-spin" />
              </div>
            ) : myDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <FaFileAlt className="text-3xl text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-400">No drafts yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Saved drafts from serial scan will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-auto flex-1 divide-y divide-gray-50">
                {myDrafts.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-amber-50/40 transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : ""}`}
                  >
                    <div className="p-1.5 bg-amber-50 rounded-lg flex-shrink-0 mt-0.5">
                      <FaFileAlt className="text-amber-400 text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-black text-gray-800 truncate">
                          {draft.auditCode || `#${draft.id}`}
                        </p>
                        <StatusBadge status={draft.status} />
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {draft.templateName || "—"}
                      </p>
                      {(draft.infoData?.serialNo || draft.infoData?.serial) && (
                        <p className="text-[10px] text-indigo-600 font-mono mt-0.5">
                          {draft.infoData?.serialNo || draft.infoData?.serial}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {timeAgo(draft.updatedAt || draft.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/auditreport/audits/${draft.id}`)}
                      className="p-1.5 hover:bg-amber-100 rounded-lg transition text-amber-500 hover:text-amber-700 flex-shrink-0 mt-0.5"
                      title="Continue draft"
                    >
                      <FaEdit size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Rework ─────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-orange-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-50 rounded-lg">
                  <FaTools className="text-orange-500 text-sm" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-800">Rework</h3>
                  <p className="text-[10px] text-gray-400">Audits returned for correction</p>
                </div>
              </div>
              {reworkAudits.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold border border-orange-200">
                  {reworkAudits.length} pending
                </span>
              )}
            </div>

            {reworkLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-orange-100 border-t-orange-400 rounded-full animate-spin" />
              </div>
            ) : reworkAudits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <FaCheckCircle className="text-3xl text-emerald-200 mb-3" />
                <p className="text-sm font-semibold text-emerald-500">All clear!</p>
                <p className="text-xs text-gray-400 mt-1">
                  No audits pending rework.
                </p>
              </div>
            ) : (
              <div className="overflow-auto flex-1 divide-y divide-gray-50">
                {reworkAudits.map((audit, idx) => (
                  <div
                    key={audit.id}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-orange-50/40 transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : ""}`}
                  >
                    <div className="p-1.5 bg-orange-50 rounded-lg flex-shrink-0 mt-0.5">
                      <FaTools className="text-orange-400 text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-black text-gray-800 truncate">
                          {audit.auditCode || `#${audit.id}`}
                        </p>
                        <StatusBadge status={audit.status} />
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {audit.templateName || "—"}
                      </p>
                      {audit.approvalComments && (
                        <p className="text-[10px] text-orange-600 mt-0.5 truncate" title={audit.approvalComments}>
                          ↩ {audit.approvalComments}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {timeAgo(audit.updatedAt || audit.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/auditreport/audits/${audit.id}`)}
                      className="p-1.5 hover:bg-orange-100 rounded-lg transition text-orange-500 hover:text-orange-700 flex-shrink-0 mt-0.5"
                      title="Fix & resubmit"
                    >
                      <FaEdit size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        </div>
      </div>
    </div>
  );
};

export default SerialScan;
