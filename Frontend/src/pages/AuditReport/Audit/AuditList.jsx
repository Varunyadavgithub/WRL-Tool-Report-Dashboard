import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  FaSortUp,
  FaSortDown,
  FaSort,
  FaThLarge,
  FaList,
  FaDownload,
  FaCheckSquare,
  FaRegSquare,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaShieldAlt,
  FaBan,
} from "react-icons/fa";
import { BiSolidFactory } from "react-icons/bi";
import { MdOutlineFilterAltOff } from "react-icons/md";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";

// ==================== CONSTANTS ====================
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const STATUS_CONFIG = {
  submitted: {
    label: "Submitted",
    icon: FaPaperPlane,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  approved: {
    label: "Approved",
    icon: FaCheckCircle,
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
  },
  rejected: {
    label: "Rejected",
    icon: FaTimesCircle,
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
};

// ==================== UTILS ====================
const formatDateForDisplay = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  } catch {
    return "-";
  }
};

const relativeTime = (dateString) => {
  if (!dateString) return "";
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDateForDisplay(dateString);
  } catch {
    return "";
  }
};

const exportToCSV = (rows, filename = "audits.csv") => {
  const headers = [
    "Report Name",
    "Audit Code",
    "Template",
    "Serial No",
    "Model",
    "Date",
    "Shift",
    "Status",
    "Pass",
    "Fail",
    "Warning",
    "N/A",
    "Pending",
    "Total",
    "Pass Rate %",
  ];
  const csvRows = [
    headers,
    ...rows.map((r) => [
      r.reportName || "",
      r.auditCode || "",
      r.templateName || "",
      r.serialNo || "",
      r.modelName || "",
      r.auditDate || "",
      r.shift || "",
      r.status || "",
      r.summary.pass,
      r.summary.fail,
      r.summary.warning,
      r.summary.na,
      r.summary.pending,
      r.summary.total,
      r.summary.total > 0
        ? Math.round((r.summary.pass / r.summary.total) * 100)
        : 0,
    ]),
  ];
  const csv = csvRows
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
};

// ==================== SUB-COMPONENTS ====================

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  if (!cfg)
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
        {status || "Unknown"}
      </span>
    );
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon size={9} /> {cfg.label}
    </span>
  );
};

const SortIcon = ({ col, sortCol, sortDir }) => {
  if (sortCol !== col)
    return <FaSort size={10} className="text-slate-400 opacity-50" />;
  return sortDir === "asc" ? (
    <FaSortUp size={10} className="text-indigo-300" />
  ) : (
    <FaSortDown size={10} className="text-indigo-300" />
  );
};

const MiniBar = ({ pass, fail, warning, na, total }) => {
  if (!total) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
      {pass > 0 && (
        <div
          className="bg-green-400 h-full"
          style={{ width: `${(pass / total) * 100}%` }}
        />
      )}
      {warning > 0 && (
        <div
          className="bg-amber-400 h-full"
          style={{ width: `${(warning / total) * 100}%` }}
        />
      )}
      {fail > 0 && (
        <div
          className="bg-red-400   h-full"
          style={{ width: `${(fail / total) * 100}%` }}
        />
      )}
      {na > 0 && (
        <div
          className="bg-blue-300  h-full"
          style={{ width: `${(na / total) * 100}%` }}
        />
      )}
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  sub,
  loading,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div
      className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}
    >
      <Icon className={`${iconColor} text-xl`} />
    </div>
    <div className="min-w-0">
      {loading ? (
        <div className="h-7 w-12 bg-gray-100 rounded animate-pulse mb-1" />
      ) : (
        <div className="text-2xl font-black text-gray-800 leading-none">
          {value}
        </div>
      )}
      <div className="text-xs text-gray-500 font-medium mt-1">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ==================== MAIN COMPONENT ====================
const AuditList = () => {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const { audits, templates, deleteAudit, loadAudits, loadTemplates, loading } =
    useAuditData();

  // UI state
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // "table" | "card"
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Bulk select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortCol, setSortCol] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Keyboard shortcut: Ctrl+F ? focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Load data on mount
  useEffect(() => {
    const fetchData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([loadAudits(), loadTemplates()]);
      } catch {
        toast.error("Failed to load data");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadAudits(), loadTemplates()]);
      toast.success("Refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // ==================== DATA HELPERS ====================
  const getSummaryFromAudit = useCallback((audit) => {
    const def = { pass: 0, fail: 0, warning: 0, pending: 0, na: 0, total: 0 };
    if (!audit) return def;

    // Try pre-computed summary first
    if (audit.summary) {
      let s = audit.summary;
      if (typeof s === "string") {
        try {
          s = JSON.parse(s);
        } catch {
          s = null;
        }
      }
      if (s && typeof s === "object") {
        const p = Number(s.pass ?? s.Pass ?? 0);
        const f = Number(s.fail ?? s.Fail ?? 0);
        const w = Number(s.warning ?? s.Warning ?? 0);
        const n = Number(s.na ?? s.NA ?? s.na ?? 0);
        const d = Number(s.pending ?? s.Pending ?? 0);
        const t = Number(s.total ?? s.Total ?? p + f + w + n + d);
        return { pass: p, fail: f, warning: w, pending: d, na: n, total: t };
      }
    }

    // Compute from sections
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0,
      na = 0;
    let sections = audit.sections;
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch {
        sections = [];
      }
    }
    if (!Array.isArray(sections)) return def;

    sections.forEach((section) => {
      if (!section) return;
      const cps = section.stages
        ? section.stages.flatMap((st) => st?.checkPoints || [])
        : section.checkPoints || [];
      cps.forEach((cp) => {
        if (!cp) return;
        const st = (cp.status || "").toLowerCase();
        if (st === "pass") pass++;
        else if (st === "fail") fail++;
        else if (st === "warning") warning++;
        else if (st === "na") na++;
        else pending++;
      });
    });
    return {
      pass,
      fail,
      warning,
      pending,
      na,
      total: pass + fail + warning + pending + na,
    };
  }, []);

  const getInfoValue = useCallback((audit, fieldId) => {
    if (!audit) return "";
    let info = audit.infoData;
    if (typeof info === "string") {
      try {
        info = JSON.parse(info);
      } catch {
        info = {};
      }
    }
    if (!info || typeof info !== "object") return "";
    const alts = {
      serialNo: ["serialNo", "serial", "serialNumber", "Serial", "SerialNo"],
      modelName: ["modelName", "model", "modelVariant", "Model", "ModelName"],
      date: ["date", "auditDate", "reportDate", "Date", "AuditDate"],
      shift: ["shift", "shiftName", "Shift", "ShiftName"],
    };
    const keys = alts[fieldId] || [fieldId];
    for (const k of keys) {
      if (info[k]) return info[k];
    }
    return "";
  }, []);

  const getPassRate = (summary) =>
    summary?.total > 0 ? Math.round((summary.pass / summary.total) * 100) : 0;

  const passRateColor = (r) =>
    r >= 90 ? "text-green-600" : r >= 70 ? "text-amber-600" : "text-red-600";

  const passRateBg = (r) =>
    r >= 90 ? "bg-green-500" : r >= 70 ? "bg-amber-500" : "bg-red-500";

  // ==================== ENRICHED ROWS ====================
  const enrichedAudits = useMemo(
    () =>
      (audits || []).map((a) => ({
        ...a,
        summary: getSummaryFromAudit(a),
        serialNo: getInfoValue(a, "serialNo"),
        modelName: getInfoValue(a, "modelName"),
        auditDate: getInfoValue(a, "date") || a.createdAt,
        shift: getInfoValue(a, "shift"),
      })),
    [audits, getSummaryFromAudit, getInfoValue],
  );

  // ==================== FILTER ====================
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return enrichedAudits.filter((a) => {
      if (
        q &&
        ![
          a.reportName,
          a.templateName,
          a.auditCode,
          a.modelName,
          a.serialNo,
          a.createdBy,
        ].some((v) => v && v.toLowerCase().includes(q))
      )
        return false;

      if (filterStatus && a.status !== filterStatus) return false;
      if (filterTemplate && String(a.templateId) !== String(filterTemplate))
        return false;

      if (filterDateFrom || filterDateTo) {
        const d = new Date(a.auditDate);
        if (isNaN(d.getTime())) return false;
        if (filterDateFrom && d < new Date(filterDateFrom)) return false;
        if (filterDateTo && d > new Date(filterDateTo + "T23:59:59"))
          return false;
      }
      return true;
    });
  }, [
    enrichedAudits,
    searchTerm,
    filterStatus,
    filterTemplate,
    filterDateFrom,
    filterDateTo,
  ]);

  // ==================== SORT ====================
  const sorted = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case "reportName":
          av = a.reportName || "";
          bv = b.reportName || "";
          return mult * av.localeCompare(bv);
        case "modelName":
          av = a.modelName || "";
          bv = b.modelName || "";
          return mult * av.localeCompare(bv);
        case "serialNo":
          av = a.serialNo || "";
          bv = b.serialNo || "";
          return mult * av.localeCompare(bv);
        case "status":
          av = a.status || "";
          bv = b.status || "";
          return mult * av.localeCompare(bv);
        case "passRate":
          av = getPassRate(a.summary);
          bv = getPassRate(b.summary);
          return mult * (av - bv);
        case "auditDate":
          av = new Date(a.auditDate || 0);
          bv = new Date(b.auditDate || 0);
          return mult * (av - bv);
        default:
          av = new Date(a.updatedAt || a.createdAt || 0);
          bv = new Date(b.updatedAt || b.createdAt || 0);
          return mult * (av - bv);
      }
    });
  }, [filtered, sortCol, sortDir]);

  // ==================== PAGINATION ====================
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    filterStatus,
    filterTemplate,
    filterDateFrom,
    filterDateTo,
    sortCol,
    sortDir,
  ]);

  // Sync bulk bar
  useEffect(() => {
    setShowBulkBar(selectedIds.size > 0);
  }, [selectedIds]);

  // ==================== STATS ====================
  const stats = useMemo(
    () => ({
      total: audits.length,
      submitted: audits.filter((a) => a.status === "submitted").length,
      approved: audits.filter((a) => a.status === "approved").length,
      rejected: audits.filter((a) => a.status === "rejected").length,
      avgPass: (() => {
        const withData = enrichedAudits.filter((a) => a.summary.total > 0);
        if (!withData.length) return 0;
        return Math.round(
          withData.reduce((sum, a) => sum + getPassRate(a.summary), 0) /
            withData.length,
        );
      })(),
    }),
    [audits, enrichedAudits],
  );

  // ==================== SORT HANDLER ====================
  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  // ==================== BULK SELECT ====================
  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map((a) => a.id)));
  };

  const handleBulkDelete = () => {
    const locked = [...selectedIds].filter((id) => {
      const a = enrichedAudits.find((x) => x.id === id);
      return a?.status === "approved";
    });
    if (locked.length > 0) {
      toast.error(`${locked.length} approved audit(s) cannot be deleted`);
      return;
    }
    setAuditToDelete({ bulk: true, ids: [...selectedIds] });
    setShowDeleteModal(true);
  };

  // ==================== DELETE ====================
  const confirmDelete = (audit) => {
    if (audit.status === "approved") {
      toast.error("Cannot delete an approved audit");
      return;
    }
    setAuditToDelete(audit);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      if (auditToDelete?.bulk) {
        await Promise.all(auditToDelete.ids.map((id) => deleteAudit(id)));
        toast.success(`${auditToDelete.ids.length} audits deleted`);
        setSelectedIds(new Set());
      } else {
        await deleteAudit(auditToDelete.id);
        toast.success("Audit deleted");
      }
      setShowDeleteModal(false);
      setAuditToDelete(null);
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== EXPORT ====================
  const handleExport = () => {
    const rows =
      selectedIds.size > 0
        ? sorted.filter((a) => selectedIds.has(a.id))
        : sorted;
    if (!rows.length) {
      toast.error("No data to export");
      return;
    }
    exportToCSV(rows, `audits-${Date.now()}.csv`);
    toast.success(`Exported ${rows.length} records`);
  };

  const hasFilters =
    searchTerm ||
    filterStatus ||
    filterTemplate ||
    filterDateFrom ||
    filterDateTo;

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("");
    setFilterTemplate("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // ==================== TH COMPONENT ====================
  const Th = ({ col, label, center }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap group ${center ? "text-center" : "text-left"}`}
    >
      <div
        className={`flex items-center gap-1.5 ${center ? "justify-center" : ""}`}
      >
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </div>
    </th>
  );

  // ==================== LOADING STATE ====================
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <div>
            <p className="font-semibold text-gray-700">Loading Audits</p>
            <p className="text-sm text-gray-400 mt-1">Fetching records…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* ==================== DELETE MODAL ==================== */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaTrash size={14} />
                {auditToDelete?.bulk
                  ? `Delete ${auditToDelete.ids.length} Audits`
                  : "Delete Audit"}
              </h3>
              <p className="text-red-200 text-xs mt-1">
                This action is permanent and cannot be undone.
              </p>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-3">
                You are about to permanently delete:
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                {auditToDelete?.bulk ? (
                  <p className="font-semibold text-gray-800">
                    {auditToDelete.ids.length} selected audit records
                  </p>
                ) : (
                  <>
                    <p className="font-semibold text-gray-800">
                      {auditToDelete?.reportName}
                    </p>
                    {auditToDelete?.auditCode && (
                      <p className="text-xs text-gray-400 mt-1">
                        Code: {auditToDelete.auditCode}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">
                <FaExclamationTriangle
                  className="mt-0.5 flex-shrink-0"
                  size={12}
                />
                <p className="text-xs font-medium">
                  All associated data including checkpoint results and images
                  will be permanently removed.
                </p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setAuditToDelete(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Deleting…
                  </>
                ) : (
                  <>
                    <FaTrash size={11} /> Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STICKY HEADER ==================== */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <FaClipboardCheck className="text-xl text-indigo-600" />
              </div>
              <div>
                <h1 className="text-base font-black text-gray-800 leading-none">
                  Audit Records
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sorted.length} of {audits.length} records
                  {hasFilters && (
                    <span className="ml-1 text-indigo-500 font-semibold">
                      · filtered
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick status filters */}
            <div className="hidden md:flex items-center gap-1 ml-2">
              {["", "submitted", "approved", "rejected"].map((s) => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <button
                    key={s || "all"}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      filterStatus === s
                        ? s
                          ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                          : "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {s ? cfg?.label : "All"}
                    <span className="ml-1.5 opacity-60">
                      {s
                        ? audits.filter((a) => a.status === s).length
                        : audits.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "table" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                title="Table view"
              >
                <FaList size={13} />
              </button>
              <button
                onClick={() => setViewMode("card")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "card" ? "bg-white shadow text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}
                title="Card view"
              >
                <FaThLarge size={13} />
              </button>
            </div>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 rounded-xl text-sm font-semibold transition-all"
              title={
                selectedIds.size > 0
                  ? `Export ${selectedIds.size} selected`
                  : "Export all filtered"
              }
            >
              <FaDownload size={12} />
              <span className="hidden sm:inline">Export</span>
              {selectedIds.size > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 rounded-full">
                  {selectedIds.size}
                </span>
              )}
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <FaSync size={12} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">
                {refreshing ? "Refreshing…" : "Refresh"}
              </span>
            </button>

            <button
              onClick={() => navigate("/auditreport/templates")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200"
            >
              <FaPlus size={11} /> New Audit
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-5 space-y-4">
        {/* ==================== STAT CARDS ==================== */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            icon={FaClipboardCheck}
            iconBg="bg-slate-100"
            iconColor="text-slate-600"
            value={stats.total}
            label="Total Audits"
            loading={initialLoading}
          />
          <StatCard
            icon={FaPaperPlane}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            value={stats.submitted}
            label="Submitted"
            loading={initialLoading}
          />
          <StatCard
            icon={FaCheckCircle}
            iconBg="bg-green-50"
            iconColor="text-green-500"
            value={stats.approved}
            label="Approved"
            loading={initialLoading}
          />
          <StatCard
            icon={FaTimesCircle}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            value={stats.rejected}
            label="Rejected"
            loading={initialLoading}
          />
          <StatCard
            icon={FaShieldAlt}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
            value={`${stats.avgPass}%`}
            label="Avg Pass Rate"
            sub="across all audits"
            loading={initialLoading}
          />
        </div>

        {/* ==================== SEARCH + FILTER BAR ==================== */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <FaSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
                size={12}
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search name, code, model, serial… (Ctrl+F)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <FaTimes size={11} />
                </button>
              )}
            </div>

            {/* Advanced filters toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                showFilters || filterTemplate || filterDateFrom || filterDateTo
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              <FaFilter size={11} />
              Filters
              {(filterTemplate || filterDateFrom || filterDateTo) && (
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </button>

            {/* Items per page */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 hidden sm:inline">
                Show
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear all */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-100 font-semibold transition-all"
              >
                <MdOutlineFilterAltOff size={14} /> Clear
              </button>
            )}
          </div>

          {/* Advanced filters row */}
          {showFilters && (
            <div className="px-4 pb-3 pt-0 flex flex-wrap gap-2 items-center border-t border-gray-100 bg-gray-50">
              <select
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value)}
                className="text-xs border border-gray-200 bg-white rounded-xl px-3 py-2 focus:border-indigo-400 outline-none min-w-[160px]"
              >
                <option value="">All Templates</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">From</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="text-xs border border-gray-200 bg-white rounded-xl px-3 py-2 focus:border-indigo-400 outline-none"
                />
                <span className="text-xs text-gray-400">To</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="text-xs border border-gray-200 bg-white rounded-xl px-3 py-2 focus:border-indigo-400 outline-none"
                />
              </div>
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => {
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  <FaTimes size={10} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ==================== BULK ACTION BAR ==================== */}
        {showBulkBar && (
          <div className="bg-indigo-700 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-indigo-300 hover:text-white text-xs underline"
              >
                Deselect all
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition-all"
              >
                <FaDownload size={11} /> Export Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs font-bold transition-all"
              >
                <FaTrash size={11} /> Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* ==================== EMPTY STATE ==================== */}
        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <FaFileAlt className="text-4xl text-gray-200" />
            </div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">
              {hasFilters ? "No matching audits" : "No audits yet"}
            </h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
              {hasFilters
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Create your first audit to get started."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all"
                >
                  <MdOutlineFilterAltOff size={14} /> Clear Filters
                </button>
              )}
              <button
                onClick={() => navigate("/auditreport/templates")}
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200"
              >
                <FaPlus size={12} /> Create Audit
              </button>
            </div>
          </div>
        ) : viewMode === "table" ? (
          /* ==================== TABLE VIEW ==================== */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {/* Bulk select checkbox */}
                    <th className="pl-4 pr-2 py-3 w-10">
                      <button
                        onClick={toggleAll}
                        className="text-slate-400 hover:text-white transition"
                      >
                        {selectedIds.size === paginated.length &&
                        paginated.length > 0 ? (
                          <FaCheckSquare
                            size={14}
                            className="text-indigo-300"
                          />
                        ) : (
                          <FaRegSquare size={14} />
                        )}
                      </button>
                    </th>
                    <Th col="reportName" label="Audit Details" />
                    <Th col="modelName" label="Serial / Model" />
                    <Th col="auditDate" label="Date / Shift" />
                    <Th col="passRate" label="Results" center />
                    <Th col="status" label="Status" center />
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((audit, idx) => {
                    const { summary, serialNo, modelName, auditDate, shift } =
                      audit;
                    const passRate = getPassRate(summary);
                    const isSelected = selectedIds.has(audit.id);

                    return (
                      <tr
                        key={audit.id}
                        className={`transition-colors hover:bg-indigo-50/30 ${isSelected ? "bg-indigo-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                      >
                        {/* Checkbox */}
                        <td className="pl-4 pr-2 py-3">
                          <button
                            onClick={() => toggleSelect(audit.id)}
                            className="text-gray-300 hover:text-indigo-500 transition"
                          >
                            {isSelected ? (
                              <FaCheckSquare
                                size={14}
                                className="text-indigo-500"
                              />
                            ) : (
                              <FaRegSquare size={14} />
                            )}
                          </button>
                        </td>

                        {/* Audit Details */}
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="font-bold text-gray-800 text-sm truncate leading-none">
                            {audit.reportName || "Untitled Audit"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {audit.auditCode && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-md font-bold border border-indigo-100">
                                {audit.auditCode}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 truncate max-w-[130px]">
                              {audit.templateName}
                            </span>
                          </div>
                          {(audit.formatNo || audit.revNo) && (
                            <div className="text-[10px] text-gray-400 mt-1">
                              {audit.formatNo && `Fmt: ${audit.formatNo}`}
                              {audit.formatNo && audit.revNo && " · "}
                              {audit.revNo && `Rev: ${audit.revNo}`}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-300 mt-0.5">
                            {relativeTime(audit.updatedAt || audit.createdAt)}
                          </div>
                        </td>

                        {/* Serial / Model */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <BiSolidFactory className="text-indigo-400 text-sm" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-800 leading-none truncate max-w-[130px]">
                                {modelName || (
                                  <span className="text-gray-300 italic">
                                    Unknown
                                  </span>
                                )}
                              </div>
                              {serialNo && (
                                <div className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                                  <FaBarcode size={9} />
                                  <span className="font-mono">{serialNo}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Date / Shift */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm text-gray-700">
                            <FaCalendarAlt
                              size={10}
                              className="text-red-400 flex-shrink-0"
                            />
                            <span className="text-xs">
                              {formatDateForDisplay(auditDate)}
                            </span>
                          </div>
                          {shift && (
                            <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                              <FaClock size={9} />
                              <span>{shift}</span>
                            </div>
                          )}
                        </td>

                        {/* Results */}
                        <td className="px-4 py-3">
                          {summary.total > 0 ? (
                            <div className="min-w-[120px]">
                              {/* Pass rate */}
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-sm font-black ${passRateColor(passRate)}`}
                                >
                                  {passRate}%
                                </span>
                                <span className="text-xs text-gray-400">
                                  {summary.total} checks
                                </span>
                              </div>
                              <MiniBar {...summary} />
                              {/* Quick counts */}
                              <div className="flex items-center gap-2 mt-1.5 text-xs">
                                <span className="text-green-600 font-semibold flex items-center gap-0.5">
                                  <FaCheckCircle size={9} /> {summary.pass}
                                </span>
                                {summary.warning > 0 && (
                                  <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                                    <FaExclamationTriangle size={9} />{" "}
                                    {summary.warning}
                                  </span>
                                )}
                                <span className="text-red-600 font-semibold flex items-center gap-0.5">
                                  <FaTimesCircle size={9} /> {summary.fail}
                                </span>
                                {summary.na > 0 && (
                                  <span className="text-blue-500 font-semibold flex items-center gap-0.5">
                                    <FaBan size={9} /> {summary.na}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={audit.status} />
                          {audit.approvedBy && (
                            <div className="text-[10px] text-gray-400 mt-1">
                              by {audit.approvedBy}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() =>
                                navigate(`/auditreport/audits/${audit.id}/view`)
                              }
                              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all"
                              title="View"
                            >
                              <FaEye size={12} />
                            </button>
                            {audit.status !== "approved" && (
                              <button
                                onClick={() =>
                                  navigate(`/auditreport/audits/${audit.id}`)
                                }
                                className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 transition-all"
                                title="Edit"
                              >
                                <FaEdit size={12} />
                              </button>
                            )}
                            {audit.status !== "approved" && (
                              <button
                                onClick={() => confirmDelete(audit)}
                                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-all"
                                title="Delete"
                              >
                                <FaTrash size={12} />
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

            {/* Table Footer + Pagination */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-bold text-gray-700">
                  {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, sorted.length)}
                </span>{" "}
                of{" "}
                <span className="font-bold text-gray-700">{sorted.length}</span>
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 disabled:opacity-30 transition-all"
                  >
                    <FaChevronLeft size={11} />
                  </button>
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let p;
                    if (totalPages <= 7) p = i + 1;
                    else if (currentPage <= 4) p = i + 1;
                    else if (currentPage >= totalPages - 3)
                      p = totalPages - 6 + i;
                    else p = currentPage - 3 + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          currentPage === p
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 disabled:opacity-30 transition-all"
                  >
                    <FaChevronRight size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ==================== CARD VIEW ==================== */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginated.map((audit) => {
                const { summary, serialNo, modelName, auditDate, shift } =
                  audit;
                const passRate = getPassRate(summary);
                const isSelected = selectedIds.has(audit.id);
                const statusCfg = STATUS_CONFIG[audit.status] || {};

                return (
                  <div
                    key={audit.id}
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all group flex flex-col ${
                      isSelected
                        ? "border-indigo-400 ring-2 ring-indigo-100"
                        : "border-gray-200 hover:border-indigo-200"
                    }`}
                  >
                    {/* Card top bar */}
                    <div className="px-4 pt-4 flex items-start justify-between">
                      <button
                        onClick={() => toggleSelect(audit.id)}
                        className="text-gray-300 hover:text-indigo-500 transition flex-shrink-0 mt-0.5"
                      >
                        {isSelected ? (
                          <FaCheckSquare
                            size={14}
                            className="text-indigo-500"
                          />
                        ) : (
                          <FaRegSquare size={14} />
                        )}
                      </button>
                      <StatusBadge status={audit.status} />
                    </div>

                    {/* Card body */}
                    <div className="px-4 pb-4 pt-2 flex-1 flex flex-col gap-3">
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">
                          {audit.reportName || "Untitled Audit"}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {audit.auditCode && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-md font-bold">
                              {audit.auditCode}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 truncate">
                            {audit.templateName}
                          </span>
                        </div>
                      </div>

                      {/* Model/Serial */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BiSolidFactory className="text-indigo-400 text-sm" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-700 truncate">
                            {modelName || "—"}
                          </div>
                          {serialNo && (
                            <div className="text-[10px] text-purple-600 flex items-center gap-1">
                              <FaBarcode size={8} />
                              <span className="font-mono">{serialNo}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Date/Shift row */}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FaCalendarAlt size={9} className="text-red-400" />{" "}
                          {formatDateForDisplay(auditDate)}
                        </span>
                        {shift && (
                          <span className="flex items-center gap-1">
                            <FaClock size={9} className="text-amber-400" />{" "}
                            {shift}
                          </span>
                        )}
                      </div>

                      {/* Results */}
                      {summary.total > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-base font-black ${passRateColor(passRate)}`}
                            >
                              {passRate}%
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {summary.total} checks
                            </span>
                          </div>
                          <MiniBar {...summary} />
                          <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                            <span className="text-green-600 font-bold">
                              <FaCheckCircle
                                size={8}
                                className="inline mr-0.5"
                              />
                              {summary.pass}
                            </span>
                            {summary.warning > 0 && (
                              <span className="text-amber-600 font-bold">
                                <FaExclamationTriangle
                                  size={8}
                                  className="inline mr-0.5"
                                />
                                {summary.warning}
                              </span>
                            )}
                            <span className="text-red-600 font-bold">
                              <FaTimesCircle
                                size={8}
                                className="inline mr-0.5"
                              />
                              {summary.fail}
                            </span>
                            {summary.pending > 0 && (
                              <span className="text-gray-400">
                                {summary.pending} pending
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-300 italic">
                          No checkpoint data
                        </div>
                      )}

                      {/* Relative time */}
                      <div className="text-[10px] text-gray-300">
                        {relativeTime(audit.updatedAt || audit.createdAt)}
                      </div>
                    </div>

                    {/* Card footer actions */}
                    <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
                      <button
                        onClick={() =>
                          navigate(`/auditreport/audits/${audit.id}/view`)
                        }
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-semibold transition-colors"
                      >
                        <FaEye size={11} /> View
                      </button>
                      <div className="flex items-center gap-1">
                        {audit.status !== "approved" && (
                          <button
                            onClick={() =>
                              navigate(`/auditreport/audits/${audit.id}`)
                            }
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-500 transition-all"
                            title="Edit"
                          >
                            <FaEdit size={11} />
                          </button>
                        )}
                        {audit.status !== "approved" && (
                          <button
                            onClick={() => confirmDelete(audit)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 transition-all"
                            title="Delete"
                          >
                            <FaTrash size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Card pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3 shadow-sm">
                <span className="text-xs text-gray-500">
                  Page{" "}
                  <span className="font-bold text-gray-700">{currentPage}</span>{" "}
                  of{" "}
                  <span className="font-bold text-gray-700">{totalPages}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-all"
                  >
                    <FaChevronLeft size={10} /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-all"
                  >
                    Next <FaChevronRight size={10} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditList;
