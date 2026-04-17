import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import ExportButton from "../../components/ui/ExportButton";
import {
  Search,
  Calendar,
  Filter,
  Clock,
  Lock,
  Unlock,
  List,
  BarChart3,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Hash,
  User,
  AlertTriangle,
  Zap,
  Table2,
  PackageOpen,
  ClipboardList,
  Shield,
  Target,
  Boxes,
  Factory,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATE_OPTIONS = [
  { label: "Hold", value: "hold" },
  { label: "Release", value: "release" },
  { label: "All", value: "all" },
];

const GROUP_OPTIONS = [
  { label: "Model No", value: "ModelNo" },
  { label: "FG Serial No", value: "FGSerialNo" },
  { label: "Hold Reason", value: "HoldReason" },
  { label: "Corrective Action", value: "CorrectiveAction" },
  { label: "Hold By", value: "HoldBy" },
  { label: "Status", value: "Status" },
];

const DAYS_HOLD_CONFIG = {
  high: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
  medium: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
  },
  low: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fmtDisplay = (isoStr) =>
  isoStr ? isoStr.replace("T", " ").replace("Z", "").slice(0, 16) : "—";

const getDaysConfig = (days) => {
  if (days > 7) return DAYS_HOLD_CONFIG.high;
  if (days > 3) return DAYS_HOLD_CONFIG.medium;
  return DAYS_HOLD_CONFIG.low;
};

// ─── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, borderColor, sub }) => (
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
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ─── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const isHold = status === "Hold";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
        isHold
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200"
      }`}
    >
      {isHold ? (
        <Lock className="w-2.5 h-2.5" />
      ) : (
        <Unlock className="w-2.5 h-2.5" />
      )}
      {status}
    </span>
  );
};

// ─── Days Badge ────────────────────────────────────────────────────────────────

const DaysBadge = ({ days }) => {
  const cfg = getDaysConfig(days);
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md font-semibold text-xs border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {days}d
    </span>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────

const EmptyState = ({ message, sub }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-2">
    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
      <PackageOpen className="w-6 h-6 text-blue-400" strokeWidth={1.2} />
    </div>
    <h3 className="text-sm font-semibold text-slate-600">
      {message || "No records found"}
    </h3>
    <p className="text-xs text-slate-400 max-w-sm text-center">
      {sub || "Apply filters and click Query to load data."}
    </p>
  </div>
);

// ─── Summary Panel ─────────────────────────────────────────────────────────────

const SummaryStats = ({ data, totalCount }) => {
  if (!data || data.length === 0) return null;

  const holdCount = data.filter((r) => r.Status === "Hold").length;
  const releaseCount = data.filter((r) => r.Status === "Release").length;
  const uniqueModels = new Set(data.map((r) => r.ModelNo)).size;
  const uniqueSerials = new Set(data.map((r) => r.FGSerialNo)).size;
  const avgDays =
    data.length > 0
      ? (
          data.reduce((s, r) => s + (r.DaysOnHold || 0), 0) / data.length
        ).toFixed(1)
      : "0";
  const maxDays = Math.max(...data.map((r) => r.DaysOnHold || 0), 0);

  return (
    <div>
      <div className="flex flex-wrap gap-2.5 mb-3">
        <KpiCard
          icon={ClipboardList}
          label="Total Records"
          value={totalCount}
          borderColor="#6366f1"
        />
        <KpiCard
          icon={Lock}
          label="On Hold"
          value={holdCount}
          borderColor="#f59e0b"
        />
        <KpiCard
          icon={Unlock}
          label="Released"
          value={releaseCount}
          borderColor="#10b981"
        />
        <KpiCard
          icon={Factory}
          label="Unique Models"
          value={uniqueModels}
          borderColor="#8b5cf6"
        />
        <KpiCard
          icon={Boxes}
          label="Unique Serials"
          value={uniqueSerials}
          borderColor="#3b82f6"
        />
        <KpiCard
          icon={Clock}
          label="Avg Days on Hold"
          value={avgDays}
          borderColor="#ef4444"
          sub={`Max: ${maxDays}d`}
        />
      </div>

      {/* Hold/Release Bar */}
      {data.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Status Breakdown
          </div>
          <div className="flex h-5 rounded-lg overflow-hidden gap-0.5">
            {holdCount > 0 && (
              <div
                className="bg-amber-500 flex items-center justify-center"
                style={{ flex: holdCount }}
              >
                <span className="text-[9px] text-white font-bold">
                  {((holdCount / data.length) * 100).toFixed(0)}% Hold
                </span>
              </div>
            )}
            {releaseCount > 0 && (
              <div
                className="bg-emerald-500 flex items-center justify-center"
                style={{ flex: releaseCount }}
              >
                <span className="text-[9px] text-white font-bold">
                  {((releaseCount / data.length) * 100).toFixed(0)}% Released
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-[11px] text-slate-500">
            <span>
              <span className="text-amber-500 font-bold">●</span> Hold{" "}
              {holdCount}
            </span>
            <span>
              <span className="text-emerald-500 font-bold">●</span> Released{" "}
              {releaseCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Detail Table ──────────────────────────────────────────────────────────────

const DetailTable = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Spinner cls="w-5 h-5 text-blue-600" />
        <span className="text-sm text-slate-400">Loading records...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {[
              { label: "Sr. No.", icon: null },
              { label: "Model No", icon: null },
              { label: "FG Serial No", icon: null },
              { label: "Hold Reason", icon: AlertTriangle },
              { label: "Hold Date", icon: Calendar },
              { label: "Hold By", icon: User },
              { label: "Days on Hold", icon: Clock },
              { label: "Corrective Action", icon: null },
              { label: "Released On", icon: null },
              { label: "Released By", icon: User },
              { label: "Status", icon: null },
            ].map(({ label, icon: Icon }) => (
              <th
                key={label}
                className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center"
              >
                <span className="inline-flex items-center gap-1">
                  {Icon && <Icon className="w-2.5 h-2.5 text-slate-400" />}
                  {label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={i}
              className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
            >
              <td className="px-3 py-2.5 border-b border-slate-100 font-bold text-blue-600">
                {i + 1}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100 font-bold text-slate-800 whitespace-nowrap">
                {item.ModelNo}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100">
                <span className="inline-flex items-center font-mono text-[11px] px-2.5 py-0.5 rounded-md tracking-wide border font-semibold bg-amber-50 text-amber-700 border-amber-200">
                  {item.FGSerialNo}
                </span>
              </td>
              <td
                className="px-3 py-2.5 border-b border-slate-100 text-left max-w-[180px] truncate text-slate-600"
                title={item.HoldReason}
              >
                {item.HoldReason}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                {fmtDisplay(item.HoldDate)}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                {item.HoldBy}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100">
                <DaysBadge days={item.DaysOnHold} />
              </td>
              <td
                className="px-3 py-2.5 border-b border-slate-100 text-left max-w-[180px] truncate text-slate-600"
                title={item.CorrectiveAction}
              >
                {item.CorrectiveAction || "—"}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                {fmtDisplay(item.ReleasedOn)}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                {item.ReleasedBy || "—"}
              </td>
              <td className="px-3 py-2.5 border-b border-slate-100">
                <StatusBadge status={item.Status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Summary Group Table ───────────────────────────────────────────────────────

const GroupSummaryTable = ({ grouped, groupLabel, totalCount }) => {
  if (!grouped || grouped.length === 0) {
    return <EmptyState message="No data to group" sub="Load data first." />;
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap w-12">
              Sr. No.
            </th>
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap">
              {groupLabel}
            </th>
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap">
              Count
            </th>
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((item, i) => {
            const pct = totalCount
              ? Math.round((item.count / totalCount) * 100)
              : 0;
            return (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
              >
                <td className="px-3 py-2.5 border-b border-slate-100 text-center font-bold text-blue-600">
                  {i + 1}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-20 shrink-0">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0
                            ? "bg-blue-500"
                            : i === 1
                              ? "bg-violet-500"
                              : "bg-slate-400"
                        }`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span
                      className="text-xs text-slate-700 font-medium truncate max-w-[200px]"
                      title={item.key}
                    >
                      {item.key}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center font-bold text-slate-900">
                  {item.count}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    {pct}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const HoldCabinateDetails = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [state, setState] = useState(STATE_OPTIONS[0]);
  const [holdCabinetDetails, setHoldCabinetDetails] = useState([]);
  const [groupBy, setGroupBy] = useState(GROUP_OPTIONS[0]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("table");
  const [lastFetched, setLastFetched] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (startDate, endDate) => {
      if (!state) return toast.error("Please select a state.");
      setLoading(true);
      setHoldCabinetDetails([]);
      setTotalCount(0);
      try {
        const res = await axios.get(`${baseURL}quality/hold-cabinet-details`, {
          params: { status: state.value, startDate, endDate },
        });
        if (res?.data?.success) {
          setHoldCabinetDetails(res.data.data);
          setTotalCount(res.data.totalCount);
          setLastFetched(new Date());
          if (res.data.data.length === 0) toast.success("No records found.");
          else toast.success(`Loaded ${res.data.data.length} records`);
        }
      } catch {
        toast.error("Failed to fetch Hold Cabinet Details.");
      } finally {
        setLoading(false);
      }
    },
    [state],
  );

  const handleQuery = () => {
    if (!startTime || !endTime)
      return toast.error("Please select Start and End time.");
    fetchData(startTime, endTime);
  };

  const handleYesterday = () => {
    const now = new Date();
    const today8 = new Date(now);
    today8.setHours(8, 0, 0, 0);
    const yest8 = new Date(today8);
    yest8.setDate(today8.getDate() - 1);
    fetchData(formatDate(yest8), formatDate(today8));
  };

  const handleToday = () => {
    const now = new Date();
    const today8 = new Date(now);
    today8.setHours(8, 0, 0, 0);
    fetchData(formatDate(today8), formatDate(now));
  };

  const handleMTD = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    fetchData(formatDate(start), formatDate(now));
  };

  const handleClear = () => {
    setStartTime("");
    setEndTime("");
    setState(STATE_OPTIONS[0]);
    setHoldCabinetDetails([]);
    setGroupBy(GROUP_OPTIONS[0]);
    setSearchTerm("");
    setTotalCount(0);
    setLastFetched(null);
  };

  // ─── Filtered & Grouped ──────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    if (!debouncedSearch) return holdCabinetDetails;
    const q = debouncedSearch.toLowerCase();
    return holdCabinetDetails.filter((item) =>
      [
        item.ModelNo,
        item.FGSerialNo,
        item.HoldReason,
        item.HoldBy,
        item.CorrectiveAction,
        item.Status,
      ].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [holdCabinetDetails, debouncedSearch]);

  const groupedData = useMemo(() => {
    if (!holdCabinetDetails.length) return [];
    const map = holdCabinetDetails.reduce((acc, item) => {
      const key = item[groupBy.value] || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(map)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }, [holdCabinetDetails, groupBy]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight flex items-center gap-2">
            Hold Cabinet Details
          </h1>
          <p className="text-[11px] text-slate-400">
            Quality · Dispatch Control
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
              <Clock className="w-3 h-3" />
              {lastFetched.toLocaleTimeString()}
            </span>
          )}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalCount}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-amber-700">
              {holdCabinetDetails.filter((r) => r.Status === "Hold").length} On
              Hold
            </span>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
            {/* Left: Controls */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Start Time */}
                <div className="min-w-[170px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                {/* End Time */}
                <div className="min-w-[170px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                {/* Status */}
                <div className="min-w-[140px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={state.value}
                      onChange={(e) =>
                        setState(
                          STATE_OPTIONS.find((s) => s.value === e.target.value),
                        )
                      }
                      className="w-full appearance-none px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all pr-8"
                    >
                      {STATE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {/* Search */}
                <div className="min-w-[170px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Model, Serial, Reason..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleQuery}
                  disabled={loading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? "Loading..." : "Query"}
                </button>

                {holdCabinetDetails.length > 0 && (
                  <ExportButton
                    data={holdCabinetDetails}
                    filename="hold_cabinet_details"
                  />
                )}

                <button
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>

            {/* Right: Quick Filters */}
            <div className="border-l border-slate-100 pl-5 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Quick Select
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleYesterday}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  Yesterday
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={handleToday}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  Today
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={handleMTD}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  Month to Date
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING STATE ── */}
        {loading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching records...</p>
          </div>
        )}

        {/* ── DATA PANELS ── */}
        {!loading && holdCabinetDetails.length > 0 && (
          <>
            {/* Summary Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Summary
                </span>
              </div>
              <SummaryStats data={holdCabinetDetails} totalCount={totalCount} />
            </div>

            {/* Tab Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5 flex items-center gap-1 shrink-0 w-fit">
              <button
                onClick={() => setActiveTab("table")}
                className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTab === "table"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <List className="w-3.5 h-3.5" /> Detail View
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTab === "summary"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Group Summary
              </button>
              <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                {filteredData.length} rows
              </span>
            </div>

            {/* ── Detail Table Tab ── */}
            {activeTab === "table" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <Table2 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Records
                  </span>
                  <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                    {filteredData.length} of {totalCount}
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-1 overflow-hidden">
                  <DetailTable data={filteredData} loading={false} />
                </div>
              </div>
            )}

            {/* ── Summary Tab ── */}
            {activeTab === "summary" && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 flex-1">
                {/* Group Selector */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 xl:col-span-1">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      Group By
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {GROUP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setGroupBy(opt)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between border ${
                          groupBy.value === opt.value
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                        }`}
                      >
                        {opt.label}
                        {groupBy.value === opt.value && (
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">
                            {groupedData.length} groups
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <ExportButton
                      data={groupedData}
                      filename="hold_cabinet_summary"
                    />
                  </div>
                </div>

                {/* Summary Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col xl:col-span-2 min-h-[400px]">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                    <Table2 className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      {groupBy.label} Breakdown
                    </span>
                    {groupedData.length > 0 && (
                      <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                        {groupedData.length} groups
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1 overflow-hidden">
                    <GroupSummaryTable
                      grouped={groupedData}
                      groupLabel={groupBy.label}
                      totalCount={totalCount}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Empty State ── */}
        {!loading && holdCabinetDetails.length === 0 && (
          <EmptyState
            message="No Data Found"
            sub="Adjust your filters and click Query to load Hold Cabinet data."
          />
        )}
      </div>
    </div>
  );
};

export default HoldCabinateDetails;
