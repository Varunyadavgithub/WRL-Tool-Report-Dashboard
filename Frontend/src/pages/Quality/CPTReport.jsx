import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExportButton from "../../components/ui/ExportButton";
import Loader from "../../components/ui/Loader";
import Pagination from "../../components/ui/Pagination";
import DateTimePicker from "../../components/ui/DateTimePicker";
import { baseURL } from "../../assets/assets";
import {
  Zap,
  Search,
  RefreshCw,
  RotateCcw,
  Calendar,
  Clock,
  Filter,
  ChevronRight,
  Download,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Barcode,
  MapPin,
  Settings,
  Database,
  Hash,
  Thermometer,
  BatteryFull,
  Lightbulb,
  Gauge,
  Activity,
  AlertTriangle,
  PackageOpen,
  Loader2,
  CalendarDays,
  CalendarRange,
  Plug,
  FileText,
} from "lucide-react";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const AREA_LABELS = { 5: "Other", 6: "SUS", 8: "Choc", 9: "VISI Cooler" };

const TABLE_COLUMNS = [
  { icon: Hash, label: "#" },
  { icon: Database, label: "Result ID" },
  { icon: Clock, label: "Date / Time" },
  { icon: Barcode, label: "Barcode" },
  { icon: Settings, label: "Model" },
  { icon: Clock, label: "Runtime" },
  { icon: Thermometer, label: "Temp (°C)" },
  { icon: Zap, label: "Current (A)" },
  { icon: BatteryFull, label: "Voltage (V)" },
  { icon: Lightbulb, label: "Power (W)" },
  { icon: Gauge, label: "Performance" },
  { icon: Activity, label: "Status" },
  { icon: AlertTriangle, label: "Fault Info" },
  { icon: MapPin, label: "Area" },
];

const QUICK_FILTERS = [
  { key: "yesterday", label: "Yesterday", color: "amber" },
  { key: "today", label: "Today", color: "blue" },
  { key: "thisMonth", label: "Month to Date", color: "emerald" },
];

const FILTER_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  thisMonth: "This Month",
  custom: "Custom Range",
};

const DEFAULT_STATS = {
  avgRuntime: 0,
  avgTemp: 0,
  avgPower: 0,
  passRate: 0,
  faultCount: 0,
  passCount: 0,
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

const toAPIDateTime = (datetimeLocalValue) => {
  if (!datetimeLocalValue) return "";
  const dt = new Date(datetimeLocalValue);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
};

// ─── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── EmptyState ────────────────────────────────────────────────────────────────
const EmptyState = ({ colSpan, onTodayClick }) => (
  <tr>
    <td colSpan={colSpan} className="py-16 text-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <PackageOpen className="w-10 h-10 opacity-20" strokeWidth={1.2} />
        <p className="text-xs font-semibold text-slate-500">
          No data available
        </p>
        <p className="text-xs">
          Use quick filters or set a custom date & time range
        </p>
        {onTodayClick && (
          <button
            onClick={onTodayClick}
            className="mt-1 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm shadow-blue-200 flex items-center gap-1.5"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Today's Data
          </button>
        )}
      </div>
    </td>
  </tr>
);

// ─── StatusBadge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const isPass = status === "PASS";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-semibold text-xs ${
        isPass
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-rose-50 text-rose-700 border border-rose-200"
      }`}
    >
      {isPass ? (
        <CheckCircle2 className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5" />
      )}
      {status}
    </span>
  );
};

// ─── MinMaxCell ────────────────────────────────────────────────────────────────
const MinMaxCell = ({ max, min }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="flex items-center gap-1 text-rose-500 text-xs font-medium">
      <ArrowUp className="w-2.5 h-2.5" />
      {max ?? "—"}
    </span>
    <span className="flex items-center gap-1 text-sky-500 text-xs font-medium">
      <ArrowDown className="w-2.5 h-2.5" />
      {min ?? "—"}
    </span>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const CPTReport = () => {
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reportData, setReportData] = useState([]);
  const [activeFilter, setActiveFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit, setLimit] = useState(50);
  const [stats, setStats] = useState(DEFAULT_STATS);

  // ── Quick filter date resolver ─────────────────────────────────────────────
  const getQuickFilterDates = (filterType) => {
    switch (filterType) {
      case "today": {
        const { startDate, endDate } = getTodayRange();
        return {
          start: formatDateTimeLocal(startDate),
          end: formatDateTimeLocal(endDate),
        };
      }
      case "yesterday": {
        const { startDate, endDate } = getYesterdayRange();
        return {
          start: formatDateTimeLocal(startDate),
          end: formatDateTimeLocal(endDate),
        };
      }
      case "thisMonth": {
        const { startDate, endDate } = getMTDRange();
        return {
          start: formatDateTimeLocal(startDate),
          end: formatDateTimeLocal(endDate),
        };
      }
      default:
        return null;
    }
  };

  // ── Stats calculator ───────────────────────────────────────────────────────
  const calculateStats = (data) => {
    if (!data?.length) {
      setStats(DEFAULT_STATS);
      return;
    }
    const n = data.length;
    const avgRuntime =
      data.reduce((a, i) => a + (parseFloat(i.RUNTIME_MINUTES) || 0), 0) / n;
    const avgTemp =
      data.reduce(
        (a, i) =>
          a +
          ((parseFloat(i.MAX_TEMPERATURE) || 0) +
            (parseFloat(i.MIN_TEMPERATURE) || 0)) /
            2,
        0,
      ) / n;
    const avgPower =
      data.reduce(
        (a, i) =>
          a +
          ((parseFloat(i.MAX_POWER) || 0) + (parseFloat(i.MIN_POWER) || 0)) / 2,
        0,
      ) / n;
    const passCount = data.filter((i) => i.PERFORMANCE === "PASS").length;
    setStats({
      avgRuntime: avgRuntime.toFixed(1),
      avgTemp: avgTemp.toFixed(1),
      avgPower: avgPower.toFixed(1),
      passRate: ((passCount / n) * 100).toFixed(1),
      faultCount: n - passCount,
      passCount,
    });
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDataWithDates = async (
    start,
    end,
    page = 1,
    pageLimit = limit,
  ) => {
    if (!start || !end) {
      toast.error("Please select a date & time range.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/cpt-report`, {
        params: {
          startDate: toAPIDateTime(start),
          endDate: toAPIDateTime(end),
          page,
          limit: pageLimit,
        },
      });
      if (res?.data?.success) {
        setReportData(res.data.data);
        setCurrentPage(res.data.pagination?.currentPage || 1);
        setTotalPages(res.data.pagination?.totalPages || 0);
        setTotalRecords(res.data.pagination?.totalRecords || 0);
        calculateStats(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch CPT Report:", error);
      toast.error("Failed to fetch CPT Report.");
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleQuickFilter = (filterType) => {
    const dates = getQuickFilterDates(filterType);
    if (!dates) return;
    setStartTime(dates.start);
    setEndTime(dates.end);
    setActiveFilter(filterType);
    fetchDataWithDates(dates.start, dates.end, 1, limit);
  };

  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select both start and end date/time.");
      return;
    }
    setCurrentPage(1);
    setActiveFilter("custom");
    fetchDataWithDates(startTime, endTime, 1, limit);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchDataWithDates(startTime, endTime, page, limit);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setCurrentPage(1);
    fetchDataWithDates(startTime, endTime, 1, newLimit);
  };

  const handleClear = () => {
    setStartTime("");
    setEndTime("");
    setReportData([]);
    setCurrentPage(1);
    setTotalPages(0);
    setTotalRecords(0);
    setActiveFilter("");
    setStats(DEFAULT_STATS);
  };

  const handleExportAll = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select a date & time range.");
      return [];
    }
    setExportLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/cpt-report`, {
        params: {
          startDate: toAPIDateTime(startTime),
          endDate: toAPIDateTime(endTime),
          page: 1,
          limit: 100000,
        },
      });
      return res?.data?.success && res?.data?.data?.length > 0
        ? res.data.data
        : [];
    } catch {
      toast.error("Failed to export CPT Report.");
      return [];
    } finally {
      setExportLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasData = reportData.length > 0;
  const passRateNum = parseFloat(stats.passRate);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            CPT Performance Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Cooling Performance Testing — Quality Analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeFilter && (
            <span className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              <Filter className="w-3 h-3" />
              {FILTER_LABELS[activeFilter] || activeFilter}
            </span>
          )}

          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalRecords.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>

          {hasData && (
            <div
              className={`flex flex-col items-center px-4 py-1.5 rounded-lg border min-w-[90px] ${
                passRateNum >= 95
                  ? "bg-emerald-50 border-emerald-100"
                  : passRateNum >= 80
                    ? "bg-amber-50 border-amber-100"
                    : "bg-rose-50 border-rose-100"
              }`}
            >
              <span
                className={`text-xl font-bold font-mono ${
                  passRateNum >= 95
                    ? "text-emerald-700"
                    : passRateNum >= 80
                      ? "text-amber-700"
                      : "text-rose-700"
                }`}
              >
                {stats.passRate}%
              </span>
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  passRateNum >= 95
                    ? "text-emerald-500"
                    : passRateNum >= 80
                      ? "text-amber-500"
                      : "text-rose-500"
                }`}
              >
                Pass Rate
              </span>
            </div>
          )}

          {hasData && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-violet-700">
                {stats.avgRuntime}
                <span className="text-[10px] font-medium ml-0.5">m</span>
              </span>
              <span className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">
                Avg Runtime
              </span>
            </div>
          )}

          {hasData && stats.faultCount > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-rose-50 border border-rose-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-rose-700">
                {stats.faultCount}
              </span>
              <span className="text-[10px] text-rose-500 font-medium uppercase tracking-wide">
                Faults
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters & Date Range
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
            {/* Left: controls */}
            <div className="space-y-3">
              {/* Date pickers + actions */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="Start Time"
                    name="startTime"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setActiveFilter("custom");
                    }}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="End Time"
                    name="endTime"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setActiveFilter("custom");
                    }}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pb-0.5 shrink-0">
                  <button
                    onClick={handleQuery}
                    disabled={loading || !startTime || !endTime}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                      loading || !startTime || !endTime
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                    }`}
                  >
                    {loading ? (
                      <Spinner cls="w-4 h-4" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {loading ? "Loading…" : "Query"}
                  </button>

                  <button
                    onClick={handleClear}
                    title="Clear All"
                    className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {hasData && (
                    <ExportButton
                      data={reportData}
                      filename="CPT_Report"
                      fetchAllData={handleExportAll}
                      totalRecords={totalRecords}
                      isLoading={exportLoading}
                    />
                  )}
                </div>
              </div>

              {/* Active range badge */}
              {startTime && endTime && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 w-fit">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400">Range:</span>
                  <span className="text-[11px] font-semibold text-slate-700">
                    {new Date(startTime).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-[11px] text-slate-400">→</span>
                  <span className="text-[11px] font-semibold text-slate-700">
                    {new Date(endTime).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Quick Filters (same as EST) */}
            <div className="border-l border-slate-100 pl-5 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Quick Select
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {QUICK_FILTERS.map(({ key, label, color }) => {
                  const active = activeFilter === key;
                  const colorMap = {
                    amber: active
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100",
                    blue: active
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100",
                    emerald: active
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100",
                  };
                  return (
                    <button
                      key={key}
                      onClick={() => handleQuickFilter(key)}
                      disabled={loading}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${colorMap[color]} ${
                        loading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {label}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING STATE ── */}
        {loading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching CPT records…</p>
          </div>
        )}

        {/* ── DATA TABLE ── */}
        {!loading && hasData && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Table header bar */}
            <div className="border-b border-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Detailed Test Results
                </span>
                {activeFilter && (
                  <span className="ml-1 px-2 py-0.5 bg-slate-800 text-white text-[11px] font-semibold rounded-full flex items-center gap-1">
                    <CalendarRange className="w-2.5 h-2.5 text-amber-400" />
                    {FILTER_LABELS[activeFilter]}
                  </span>
                )}
                <span className="ml-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                  {totalRecords.toLocaleString()} records
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Page{" "}
                <span className="font-semibold text-slate-600">
                  {currentPage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-600">
                  {totalPages}
                </span>
                {" · "}Showing{" "}
                <span className="font-semibold text-slate-600">
                  {reportData.length}
                </span>{" "}
                records
              </div>
            </div>

            {/* Pagination top */}
            {totalRecords > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 shrink-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  limit={limit}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  isLoading={loading}
                />
              </div>
            )}

            {/* Table */}
            <div className="overflow-auto">
              <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {TABLE_COLUMNS.map(({ icon: Icon, label }) => (
                      <th
                        key={label}
                        className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3 opacity-50" />
                          {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item, index) => (
                    <tr
                      key={item.Result_ID ?? index}
                      className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                    >
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400">
                        {(currentPage - 1) * limit + index + 1}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                          #{item.Result_ID}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                        <div className="text-slate-700 font-semibold flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5 text-slate-300" />
                          {item.DATE}
                        </div>
                        <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-300" />
                          {item.TIME}
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1 w-fit">
                          <Barcode className="w-2.5 h-2.5 text-slate-400" />
                          {item.BARCODE}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <div className="font-semibold text-slate-800">
                          {item.MODEL}
                        </div>
                        <div className="text-slate-400">{item.MODELNAME}</div>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg font-bold inline-flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-emerald-400" />
                          {item.RUNTIME_MINUTES}m
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <MinMaxCell
                          max={item.MAX_TEMPERATURE}
                          min={item.MIN_TEMPERATURE}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <MinMaxCell
                          max={item.MAX_CURRENT}
                          min={item.MIN_CURRENT}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <MinMaxCell
                          max={item.MAX_VOLTAGE}
                          min={item.MIN_VOLTAGE}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <MinMaxCell max={item.MAX_POWER} min={item.MIN_POWER} />
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <span className="font-bold text-slate-600 flex items-center justify-center gap-1">
                          <Gauge className="w-3 h-3 text-violet-400" />
                          {item.PERFORMANCE}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 text-center">
                        <StatusBadge status={item.PERFORMANCE} />
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <span className="text-slate-500">
                          {item.FaultName || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        <span className="bg-violet-50 text-violet-700 border border-violet-200 px-2 py-1 rounded-lg font-semibold flex items-center gap-1 w-fit">
                          <MapPin className="w-2.5 h-2.5" />
                          {AREA_LABELS[item.AREA_ID] ?? `Area ${item.AREA_ID}`}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {reportData.length === 0 && (
                    <EmptyState
                      colSpan={14}
                      onTodayClick={() => handleQuickFilter("today")}
                    />
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination bottom */}
            {totalRecords > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 shrink-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  limit={limit}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  isLoading={loading}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Empty: no filters set ── */}
        {!loading && !hasData && !activeFilter && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">
              Select a Date Range
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Use the quick select or set a custom date & time range to load CPT
              report data.
            </p>
          </div>
        )}

        {/* ── Empty: filters applied, no results ── */}
        {!loading && !hasData && activeFilter && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle
              className="w-10 h-10 text-slate-300"
              strokeWidth={1.2}
            />
            <h3 className="text-sm font-semibold text-slate-600">
              No Records Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              No CPT records matched the selected date range. Try adjusting your
              filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CPTReport;
