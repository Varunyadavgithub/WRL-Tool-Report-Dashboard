import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Tag,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Activity,
  BarChart3,
  Scan,
  Hash,
  Box,
  QrCode,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Download,
  Filter,
  AlertTriangle,
  Shield,
  Zap,
  FileText,
  Eye,
  RotateCcw,
  Loader2,
  PackageOpen,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { baseURL } from "../../assets/assets";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "update", label: "Update Tag", icon: Tag },
  { id: "log", label: "Activity Log", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const UPDATE_OPTIONS = [
  {
    label: "Asset Number",
    value: "newassetnumber",
    icon: Hash,
    desc: "Change asset tag",
    activeClass: "border-blue-500 bg-blue-50",
    textClass: "text-blue-600",
    iconBg: "bg-blue-100 border-blue-200",
  },
  {
    label: "Customer QR",
    value: "newcustomerqr",
    icon: QrCode,
    desc: "Change QR code",
    activeClass: "border-emerald-500 bg-emerald-50",
    textClass: "text-emerald-600",
    iconBg: "bg-emerald-100 border-emerald-200",
  },
];

const LOG_FILTERS = [
  { id: "all", label: "All" },
  { id: "asset", label: "Asset" },
  { id: "customerqr", label: "Cust. QR" },
  { id: "success", label: "Success" },
  { id: "failed", label: "Failed" },
];

const PAGE_SIZE = 15;

const CHART_COLORS = {
  green: "#059669",
  red: "#DC2626",
  blue: "#2563EB",
  purple: "#7C3AED",
  amber: "#D97706",
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

const formatDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDateShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const exportToCsv = (data, filename) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((r) => headers.map((h) => `"${r[h] ?? ""}"`).join(","));
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, borderColor, sub, trend }) => (
  <div
    className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]"
    style={{ borderTopWidth: 3, borderTopColor: borderColor }}
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${borderColor}18`, color: borderColor }}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
      {sub && (
        <div className="flex items-center gap-1 mt-0.5">
          {trend === "up" && (
            <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
          )}
          {trend === "down" && (
            <TrendingDown className="w-2.5 h-2.5 text-rose-500" />
          )}
          <span className="text-[10px] text-slate-400">{sub}</span>
        </div>
      )}
    </div>
  </div>
);

// ─── Badge ─────────────────────────────────────────────────────────────────────

const TypeBadge = ({ type }) => {
  const isAsset = type === "asset";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border ${
        isAsset
          ? "bg-blue-50 text-blue-600 border-blue-200"
          : "bg-emerald-50 text-emerald-600 border-emerald-200"
      }`}
    >
      {isAsset ? <Hash className="w-2 h-2" /> : <QrCode className="w-2 h-2" />}
      {isAsset ? "Asset No." : "Customer QR"}
    </span>
  );
};

// ─── Status Pill ───────────────────────────────────────────────────────────────

const StatusPill = ({ success }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
      success
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-rose-50 text-rose-700 border-rose-200"
    }`}
  >
    {success ? (
      <CheckCircle2 className="w-2.5 h-2.5" />
    ) : (
      <XCircle className="w-2.5 h-2.5" />
    )}
    {success ? "Success" : "Failed"}
  </span>
);

// ─── Detail Card ───────────────────────────────────────────────────────────────

const DetailCard = ({
  assetNumber,
  fgSerialNumber,
  modelName,
  serial2,
  loading,
}) => {
  const fields = [
    {
      label: "FG Serial No.",
      value: fgSerialNumber,
      icon: Hash,
      color: "#2563EB",
    },
    { label: "Asset Number", value: assetNumber, icon: Tag, color: "#7C3AED" },
    { label: "Model Name", value: modelName, icon: Box, color: "#D97706" },
    { label: "Customer QR", value: serial2, icon: QrCode, color: "#059669" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest">
          Asset Details
        </span>
      </div>
      <div>
        {fields.map(({ label, value, icon: Icon, color }, i) => (
          <div
            key={label}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i < fields.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="text-xs text-slate-500 flex items-center gap-2">
              <Icon className="w-3 h-3 text-slate-400" /> {label}
            </span>
            <span
              className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-md max-w-[170px] truncate"
              style={{
                color: loading ? "#94a3b8" : value ? color : "#94a3b8",
                backgroundColor: loading
                  ? "#f1f5f9"
                  : value
                    ? `${color}12`
                    : "#f1f5f9",
              }}
            >
              {loading ? "..." : value || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs shadow-lg">
      <p className="text-slate-500 font-semibold mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Section Header ────────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, iconColor, title, subtitle, action }) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
    <div>
      <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
        <Icon
          className="w-3.5 h-3.5"
          style={{ color: iconColor || "#3b82f6" }}
        />
        {title}
      </p>
      {subtitle && (
        <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
      )}
    </div>
    {action}
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const TagUpdate = () => {
  const [activeTab, setActiveTab] = useState("update");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const [assemblyNumber, setAssemblyNumber] = useState("");
  const [fgSerialNumber, setFgSerialNumber] = useState("");
  const [assetNumber, setAssetNumber] = useState("");
  const [modelName, setModelName] = useState("");
  const [serial2, setSerial2] = useState("");
  const [newAssetNumber, setNewAssetNumber] = useState("");
  const [newCustomerQr, setNewCustomerQr] = useState("");
  const [selectedToUpdate, setSelectedToUpdate] = useState(UPDATE_OPTIONS[0]);

  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const assemblyRef = useRef(null);

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.success).length,
    failed: logs.filter((l) => !l.success).length,
    assetUpdates: logs.filter((l) => l.updateType === "asset").length,
    qrUpdates: logs.filter((l) => l.updateType === "customerqr").length,
    successRate: logs.length
      ? Math.round((logs.filter((l) => l.success).length / logs.length) * 100)
      : 0,
  };

  const dailyData = (() => {
    const map = {};
    logs.forEach((log) => {
      const date = formatDateShort(log.createdAt);
      if (!map[date])
        map[date] = { date, success: 0, failed: 0, asset: 0, qr: 0 };
      if (log.success) map[date].success++;
      else map[date].failed++;
      if (log.updateType === "asset") map[date].asset++;
      else map[date].qr++;
    });
    return Object.values(map).slice(-12);
  })();

  const pieData = [
    { name: "Success", value: stats.success, color: CHART_COLORS.green },
    { name: "Failed", value: stats.failed, color: CHART_COLORS.red },
  ];

  const todayStats = (() => {
    const today = new Date().toDateString();
    const tl = logs.filter(
      (l) => new Date(l.createdAt).toDateString() === today,
    );
    return {
      total: tl.length,
      success: tl.filter((l) => l.success).length,
      failed: tl.filter((l) => !l.success).length,
    };
  })();

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/tag-update-logs`);
      setLogs(res.data?.logs || []);
    } catch {
      toast.error("Failed to load activity logs.");
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "log" || activeTab === "analytics") fetchLogs();
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (activeTab === "update")
      setTimeout(() => assemblyRef.current?.focus(), 100);
  }, [activeTab]);

  const fetchAssetDetails = async () => {
    const trimmed = assemblyNumber.trim();
    if (!trimmed) return toast.error("Assembly Number is required");
    setFetched(false);
    setFgSerialNumber("");
    setAssetNumber("");
    setModelName("");
    setSerial2("");
    setNewAssetNumber("");
    setNewCustomerQr("");
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/asset-tag-details`, {
        params: { assemblyNumber: trimmed },
      });
      if (!res.data?.FGNo)
        return toast.error("No asset found for this Assembly Number.");
      setFgSerialNumber(res.data.FGNo);
      setAssetNumber(res.data.AssetNo);
      setModelName(res.data.ModelName);
      setSerial2(res.data.Serial2);
      setFetched(true);
      toast.success("Asset details loaded successfully.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to fetch asset details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAssemblyNumber("");
    setFgSerialNumber("");
    setAssetNumber("");
    setModelName("");
    setSerial2("");
    setNewAssetNumber("");
    setNewCustomerQr("");
    setFetched(false);
    setTimeout(() => assemblyRef.current?.focus(), 50);
  };

  const validateBeforeUpdate = () => {
    if (!fetched || !assemblyNumber || !fgSerialNumber) {
      toast.error("Please query an Assembly Number first.");
      return false;
    }
    return true;
  };

  const handleUpdateNewAsset = async () => {
    if (!validateBeforeUpdate()) return;
    const trimmed = newAssetNumber.trim();
    if (!trimmed) return toast.error("New Asset Number is required");
    try {
      setLoading(true);
      const res = await axios.put(`${baseURL}quality/new-asset-tag`, {
        assemblyNumber: assemblyNumber.trim(),
        fgSerialNumber: fgSerialNumber.trim(),
        newAssetNumber: trimmed,
      });
      if (res.data.success) {
        toast.success(res.data.message || "Asset tag updated!");
        setAssetNumber(trimmed);
        setNewAssetNumber("");
        fetchLogs();
      } else toast.error(res.data.message || "Update failed.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update Asset Number.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNewCustomerQr = async () => {
    if (!validateBeforeUpdate()) return;
    const trimmed = newCustomerQr.trim();
    if (!trimmed) return toast.error("New Customer QR is required");
    try {
      setLoading(true);
      const res = await axios.put(`${baseURL}quality/new-customer-qr`, {
        assemblyNumber: assemblyNumber.trim(),
        fgSerialNumber: fgSerialNumber.trim(),
        newCustomerQr: trimmed,
      });
      if (res.data.success) {
        toast.success(res.data.message || "Customer QR updated!");
        setSerial2(trimmed);
        setNewCustomerQr("");
        fetchLogs();
      } else toast.error(res.data.message || "Update failed.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update Customer QR.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Log filtering ──────────────────────────────────────────────────────────

  const filteredLogs = logs.filter((log) => {
    const matchFilter =
      logFilter === "all" ||
      (logFilter === "success" && log.success) ||
      (logFilter === "failed" && !log.success) ||
      (logFilter === "asset" && log.updateType === "asset") ||
      (logFilter === "customerqr" && log.updateType === "customerqr");
    const s = logSearch.toLowerCase();
    const matchSearch =
      !s ||
      log.assemblyNumber?.toLowerCase().includes(s) ||
      log.updatedBy?.toLowerCase().includes(s) ||
      log.oldValue?.toLowerCase().includes(s) ||
      log.newValue?.toLowerCase().includes(s);
    return matchFilter && matchSearch;
  });

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const pagedLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  useEffect(() => setCurrentPage(1), [logFilter, logSearch]);

  const paginationPages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(
      (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
    )
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Tag Update
          </h1>
          <p className="text-[11px] text-slate-400">Asset & QR Management</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden p-1 gap-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Live pills */}
        <div className="flex items-center gap-2">
          {[
            {
              label: "Total",
              val: stats.total,
              cls: "bg-blue-50 border-blue-100 text-blue-700",
            },
            {
              label: "Success",
              val: stats.success,
              cls: "bg-emerald-50 border-emerald-100 text-emerald-700",
            },
            {
              label: "Failed",
              val: stats.failed,
              cls: "bg-rose-50 border-rose-100 text-rose-700",
            },
          ].map(({ label, val, cls }) => (
            <div
              key={label}
              className={`flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg border ${cls}`}
            >
              <span className="text-lg font-bold font-mono">{val}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ══════════════════════ UPDATE TAB ══════════════════════ */}
        {activeTab === "update" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_300px] gap-3 items-start">
            {/* Col 1: Query */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <SectionHeader
                icon={Scan}
                iconColor="#3b82f6"
                title="Query Assembly"
                subtitle="Scan or enter to fetch asset details"
                action={
                  fetched && (
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Reset
                    </button>
                  )
                }
              />
              <div className="p-4 flex flex-col gap-4">
                {/* Assembly Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Assembly Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Scan className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        ref={assemblyRef}
                        type="text"
                        placeholder="Scan or type Assembly Number..."
                        value={assemblyNumber}
                        onChange={(e) => {
                          setAssemblyNumber(e.target.value);
                          setFetched(false);
                        }}
                        onKeyDown={(e) =>
                          e.key === "Enter" && fetchAssetDetails()
                        }
                        className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    <button
                      onClick={fetchAssetDetails}
                      disabled={loading}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        loading
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                      }`}
                    >
                      {loading ? (
                        <Spinner cls="w-3.5 h-3.5" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      {loading ? "Querying..." : "Query"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-400" /> Press Enter
                    to query instantly
                  </p>
                </div>

                {/* Status Messages */}
                {!fetched && !loading && assemblyNumber && (
                  <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-800">
                      Click <strong>Query</strong> or press{" "}
                      <strong>Enter</strong> to load asset details.
                    </span>
                  </div>
                )}

                {fetched && (
                  <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800">
                        Asset loaded — ready to update
                      </p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">
                        Select what to update in the next panel
                      </p>
                    </div>
                  </div>
                )}

                {/* Tips */}
                <div className="bg-slate-50 rounded-xl p-3.5 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Tips
                  </p>
                  {[
                    {
                      icon: Scan,
                      text: "Use a barcode scanner for instant input",
                    },
                    {
                      icon: Shield,
                      text: "Duplicate values are auto-checked before saving",
                    },
                    {
                      icon: Activity,
                      text: "All changes are logged with timestamp & user",
                    },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Icon className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-[11px] text-slate-500">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Col 2: Update */}
            <div
              className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-opacity duration-300 ${
                fetched ? "opacity-100" : "opacity-40 pointer-events-none"
              }`}
            >
              <SectionHeader
                icon={Tag}
                iconColor="#7c3aed"
                title="Apply Update"
                subtitle={
                  fetched
                    ? "Choose field and enter new value"
                    : "Query an assembly first"
                }
              />
              <div className="p-4 flex flex-col gap-4">
                {/* Radio Options */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Update Field
                  </label>
                  <div className="flex gap-2.5">
                    {UPDATE_OPTIONS.map((opt) => {
                      const active = selectedToUpdate.value === opt.value;
                      const Icon = opt.icon;
                      return (
                        <label
                          key={opt.value}
                          className={`flex-1 flex items-center gap-2.5 border-2 rounded-xl px-3.5 py-3 cursor-pointer transition-all ${
                            active
                              ? opt.activeClass
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="radio"
                            name="updateType"
                            value={opt.value}
                            checked={active}
                            onChange={() => setSelectedToUpdate(opt)}
                            className="hidden"
                          />
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                              active
                                ? opt.iconBg
                                : "bg-slate-100 border-slate-200"
                            }`}
                          >
                            <Icon
                              className={`w-3.5 h-3.5 ${active ? opt.textClass : "text-slate-400"}`}
                            />
                          </div>
                          <div>
                            <p
                              className={`text-xs font-bold ${active ? opt.textClass : "text-slate-600"}`}
                            >
                              {opt.label}
                            </p>
                            <p
                              className={`text-[10px] ${active ? opt.textClass : "text-slate-400"}`}
                            >
                              {opt.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Current Value */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <span className="text-xs text-slate-500 flex items-center gap-2">
                    <Eye className="w-3 h-3 text-slate-400" /> Current value
                  </span>
                  <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    {selectedToUpdate.value === "newassetnumber"
                      ? assetNumber || "—"
                      : serial2 || "—"}
                  </span>
                </div>

                {/* New Value */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {selectedToUpdate.value === "newassetnumber"
                      ? "New Asset Number"
                      : "New Customer QR"}
                    <span className="text-rose-500"> *</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      {selectedToUpdate.value === "newassetnumber" ? (
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <QrCode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      )}
                      <input
                        type="text"
                        placeholder={
                          selectedToUpdate.value === "newassetnumber"
                            ? "Enter new asset number..."
                            : "Scan new QR code..."
                        }
                        value={
                          selectedToUpdate.value === "newassetnumber"
                            ? newAssetNumber
                            : newCustomerQr
                        }
                        onChange={(e) =>
                          selectedToUpdate.value === "newassetnumber"
                            ? setNewAssetNumber(e.target.value)
                            : setNewCustomerQr(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            selectedToUpdate.value === "newassetnumber"
                              ? handleUpdateNewAsset()
                              : handleUpdateNewCustomerQr();
                        }}
                        disabled={!fetched}
                        className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
                      />
                    </div>
                    <button
                      onClick={
                        selectedToUpdate.value === "newassetnumber"
                          ? handleUpdateNewAsset
                          : handleUpdateNewCustomerQr
                      }
                      disabled={loading || !fetched}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        loading || !fetched
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
                      }`}
                    >
                      {loading ? (
                        <Spinner cls="w-3.5 h-3.5" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      {loading ? "Updating..." : "Update"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-400" /> Press Enter
                    to apply
                  </p>
                </div>
              </div>
            </div>

            {/* Col 3: Detail + Stats */}
            <div className="flex flex-col gap-3">
              <DetailCard
                assetNumber={assetNumber}
                fgSerialNumber={fgSerialNumber}
                modelName={modelName}
                serial2={serial2}
                loading={loading && !fetched}
              />

              {fetched && (
                <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl border border-emerald-200 p-3.5 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">
                      Asset ready
                    </p>
                    <p className="text-[11px] text-emerald-600">
                      Fill in the new value and click Update
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                  <FileText className="w-3 h-3 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Today's Stats
                  </span>
                </div>
                <div>
                  {[
                    {
                      label: "Updates today",
                      val: todayStats.total,
                      cls: "text-blue-600",
                    },
                    {
                      label: "Success today",
                      val: todayStats.success,
                      cls: "text-emerald-600",
                    },
                    {
                      label: "Failed today",
                      val: todayStats.failed,
                      cls: "text-rose-600",
                    },
                  ].map(({ label, val, cls }, i, arr) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        i < arr.length - 1 ? "border-b border-slate-100" : ""
                      }`}
                    >
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className={`text-sm font-extrabold ${cls}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ LOG TAB ══════════════════════ */}
        {activeTab === "log" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
            {/* Log Header */}
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-500" /> Activity
                    Log
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {filteredLogs.length} entries · all tag update operations
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input
                      placeholder="Search assembly, user, value..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-7 pr-7 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-56"
                    />
                    {logSearch && (
                      <button
                        onClick={() => setLogSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                  {/* Filter Buttons */}
                  {LOG_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setLogFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                        logFilter === f.id
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      exportToCsv(filteredLogs, "tag-update-log.csv")
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                  >
                    <Download className="w-3 h-3" /> Export
                  </button>
                  <button
                    onClick={fetchLogs}
                    disabled={logLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${logLoading ? "animate-spin" : ""}`}
                    />{" "}
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Log Body */}
            <div className="flex-1 overflow-auto">
              {logLoading ? (
                <div className="flex items-center justify-center py-20 gap-3">
                  <Spinner cls="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-slate-400">
                    Loading activity logs...
                  </span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                    <PackageOpen
                      className="w-6 h-6 text-blue-400"
                      strokeWidth={1.2}
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-600">
                    {logSearch || logFilter !== "all"
                      ? "No entries match the current filter."
                      : "No log entries yet."}
                  </h3>
                </div>
              ) : (
                <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "#",
                        "Date & Time",
                        "Assembly No.",
                        "Type",
                        "Old Value",
                        "New Value",
                        "Updated By",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLogs.map((log, i) => (
                      <tr
                        key={log.id || i}
                        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
                      >
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400">
                          {(currentPage - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            {formatDateTime(log.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 font-mono font-bold text-blue-600">
                          {log.assemblyNumber}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100">
                          <TypeBadge type={log.updateType} />
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400 max-w-[140px] truncate">
                          {log.oldValue || "—"}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 font-mono font-bold text-emerald-600 max-w-[140px] truncate">
                          {log.newValue || "—"}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[9px] font-extrabold text-blue-600 shrink-0">
                              {(log.updatedBy || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-600">
                              {log.updatedBy || "System"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100">
                          <StatusPill success={log.success} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {filteredLogs.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400">
                  Showing{" "}
                  {Math.min(
                    (currentPage - 1) * PAGE_SIZE + 1,
                    filteredLogs.length,
                  )}
                  –{Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of{" "}
                  {filteredLogs.length}
                </span>
                <div className="flex gap-1">
                  {paginationPages.map((p, i) =>
                    p === "..." ? (
                      <span
                        key={`e${i}`}
                        className="px-1 text-xs text-slate-400"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold border transition-all ${
                          currentPage === p
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ ANALYTICS TAB ══════════════════════ */}
        {activeTab === "analytics" && (
          <div className="flex flex-col gap-3">
            {/* KPI Row */}
            <div className="flex flex-wrap gap-2.5">
              <KpiCard
                icon={BarChart3}
                label="Total Updates"
                value={stats.total}
                borderColor="#2563EB"
                sub="All time"
              />
              <KpiCard
                icon={CheckCircle2}
                label="Successful"
                value={stats.success}
                borderColor="#059669"
                sub={`${stats.successRate}% rate`}
                trend="up"
              />
              <KpiCard
                icon={XCircle}
                label="Failed"
                value={stats.failed}
                borderColor="#DC2626"
                sub="Review needed"
                trend={stats.failed > 0 ? "down" : null}
              />
              <KpiCard
                icon={Hash}
                label="Asset Updates"
                value={stats.assetUpdates}
                borderColor="#D97706"
              />
              <KpiCard
                icon={QrCode}
                label="QR Updates"
                value={stats.qrUpdates}
                borderColor="#7C3AED"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3">
              {/* Area Chart */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <SectionHeader
                  icon={TrendingUp}
                  iconColor="#2563EB"
                  title="Daily Update Trend"
                  subtitle="Success vs Failed over last 12 days"
                />
                <div className="p-4 h-[280px]">
                  {dailyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={dailyData}
                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor={CHART_COLORS.green}
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="100%"
                              stopColor={CHART_COLORS.green}
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor={CHART_COLORS.red}
                              stopOpacity={0.15}
                            />
                            <stop
                              offset="100%"
                              stopColor={CHART_COLORS.red}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          dataKey="success"
                          name="Success"
                          stroke={CHART_COLORS.green}
                          strokeWidth={2}
                          fill="url(#gS)"
                          dot={{
                            fill: CHART_COLORS.green,
                            r: 3,
                            strokeWidth: 0,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="failed"
                          name="Failed"
                          stroke={CHART_COLORS.red}
                          strokeWidth={2}
                          fill="url(#gF)"
                          dot={{ fill: CHART_COLORS.red, r: 3, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Right: Donut + Type bars */}
              <div className="flex flex-col gap-3">
                {/* Donut */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <SectionHeader
                    icon={Shield}
                    iconColor="#059669"
                    title="Success Rate"
                  />
                  <div className="p-4">
                    {stats.total === 0 ? (
                      <div className="h-28 flex items-center justify-center text-slate-400 text-xs">
                        No data
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width={110} height={110}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={32}
                              outerRadius={50}
                              dataKey="value"
                              startAngle={90}
                              endAngle={-270}
                            >
                              {pieData.map((e, i) => (
                                <Cell key={i} fill={e.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1">
                          <p className="text-3xl font-extrabold text-emerald-600 leading-none tracking-tight">
                            {stats.successRate}%
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 mb-2.5">
                            Overall success rate
                          </p>
                          {pieData.map((d) => (
                            <div
                              key={d.name}
                              className="flex items-center gap-2 mb-1"
                            >
                              <div
                                className="w-2 h-2 rounded-sm shrink-0"
                                style={{ background: d.color }}
                              />
                              <span className="text-xs text-slate-500">
                                {d.name}:{" "}
                                <strong className="text-slate-800">
                                  {d.value}
                                </strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Type bars */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <SectionHeader
                    icon={Filter}
                    iconColor="#7C3AED"
                    title="By Update Type"
                  />
                  <div className="p-4 flex flex-col gap-3.5">
                    {stats.total === 0 ? (
                      <div className="h-16 flex items-center justify-center text-slate-400 text-xs">
                        No data
                      </div>
                    ) : (
                      [
                        {
                          label: "Asset Number",
                          val: stats.assetUpdates,
                          color: CHART_COLORS.blue,
                        },
                        {
                          label: "Customer QR",
                          val: stats.qrUpdates,
                          color: CHART_COLORS.purple,
                        },
                      ].map(({ label, val, color }) => {
                        const pct = stats.total
                          ? Math.round((val / stats.total) * 100)
                          : 0;
                        return (
                          <div key={label}>
                            <div className="flex justify-between mb-1.5">
                              <span className="text-xs text-slate-500 font-medium">
                                {label}
                              </span>
                              <span
                                className="text-xs font-bold"
                                style={{ color }}
                              >
                                {val}{" "}
                                <span className="text-slate-400 font-normal">
                                  ({pct}%)
                                </span>
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: color }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-3">
              {/* Bar Chart */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <SectionHeader
                  icon={BarChart3}
                  iconColor="#7C3AED"
                  title="Asset vs QR per Day"
                  subtitle="Grouped daily breakdown by update type"
                />
                <div className="p-4 h-[280px]">
                  {dailyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      No data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyData}
                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                        barSize={14}
                        barGap={4}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="asset"
                          name="Asset No."
                          fill={CHART_COLORS.blue}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="qr"
                          name="Customer QR"
                          fill={CHART_COLORS.purple}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <SectionHeader
                  icon={Clock}
                  iconColor="#D97706"
                  title="Recent Activity"
                  subtitle={`Last ${Math.min(logs.length, 10)} operations`}
                />
                <div className="flex-1 overflow-auto max-h-[320px]">
                  {logLoading ? (
                    <div className="flex items-center justify-center py-12 gap-3">
                      <Spinner cls="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-slate-400">Loading...</span>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-xs text-slate-400">
                      No activity yet.
                    </div>
                  ) : (
                    logs.slice(0, 10).map((log, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                          i < 9 ? "border-b border-slate-100" : ""
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            log.success ? "bg-emerald-100" : "bg-rose-100"
                          }`}
                        >
                          {log.success ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-blue-600 font-mono truncate">
                              {log.assemblyNumber}
                            </span>
                            <TypeBadge type={log.updateType} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <User className="w-2.5 h-2.5 text-slate-400" />
                            <span className="text-[11px] text-slate-500">
                              {log.updatedBy}
                            </span>
                            <span className="text-[10px] text-slate-300">
                              ·
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {formatDateTime(log.createdAt)}
                            </span>
                          </div>
                          {log.newValue && (
                            <div className="flex items-center gap-1 mt-1">
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                              <span className="text-[11px] text-emerald-600 font-mono font-semibold truncate max-w-[200px]" />

                              {log.newValue && (
                                <div className="flex items-center gap-1 mt-1">
                                  <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                  <span className="text-[11px] text-emerald-600 font-mono font-semibold truncate max-w-[200px]">
                                    {log.newValue}
                                  </span>
                                </div>
                              )}
                              {!log.success && log.failReason && (
                                <div className="flex items-center gap-1 mt-1">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                                  <span className="text-[10px] text-rose-500">
                                    {log.failReason}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagUpdate;
