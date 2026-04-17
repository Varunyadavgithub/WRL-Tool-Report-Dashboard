import { useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import Loader from "../../components/ui/Loader";
import DateTimePicker from "../../components/ui/DateTimePicker";
import FpaModelDetailModal from "../../components/FpaModelDetailModal";
import FpaDefectDetailModal from "../../components/FpaDefectDetailModal";
import toast from "react-hot-toast";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

import { useGetFpaHistoryQuery } from "../../redux/api/fpaReportApi";
import {
  setFpaDateRange,
  setFpaQuickFilter,
  resetFpaFilters,
  openModelModal,
} from "../../redux/slices/fpaReportSlice.js";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
} from "../../utils/dateUtils";

import {
  Factory,
  Filter,
  Search,
  RefreshCw,
  RotateCcw,
  Download,
  Printer,
  Zap,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Gauge,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ClipboardList,
  BadgeCheck,
  FileText,
  PackageOpen,
  Loader2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Eye,
  Siren,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PALETTE = {
  critical: "#dc2626",
  major: "#ea580c",
  minor: "#ca8a04",
  done: "#16a34a",
  pending: "#e11d48",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fpqiStatus = (val) => {
  if (val === null || val === undefined) return null;
  if (val > 5)
    return {
      label: "Poor",
      bg: "bg-rose-100",
      text: "text-rose-700",
      border: "border-rose-200",
    };
  if (val > 2)
    return {
      label: "Fair",
      bg: "bg-amber-100",
      text: "text-amber-700",
      border: "border-amber-200",
    };
  return {
    label: "Good",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-200",
  };
};

const exportToCSV = (data, label = "fpa_report") => {
  if (!data || !data.length) return;
  const headers = [
    "Model Name",
    "Production",
    "FPA Req.",
    "Inspected",
    "Progress %",
    "Status",
    "Critical",
    "Major",
    "Minor",
    "FPQI",
    "Rating",
  ];
  const rows = data.map((r) => {
    const pct =
      r.FPA > 0
        ? Math.min(100, Math.round((r.SampleInspected / r.FPA) * 100))
        : 0;
    const fpqi =
      r.FPQI !== null && r.FPQI !== undefined
        ? parseFloat(r.FPQI).toFixed(3)
        : "N/A";
    const st =
      r.FPQI !== null && r.FPQI !== undefined
        ? fpqiStatus(parseFloat(r.FPQI))?.label || "N/A"
        : "N/A";
    return [
      `"${r.ModelName}"`,
      r.ModelCount || 0,
      r.FPA || 0,
      r.SampleInspected || 0,
      `${pct}%`,
      r.SampleInspected >= r.FPA ? "Done" : "Pending",
      r.Critical || 0,
      r.Major || 0,
      r.Minor || 0,
      fpqi,
      st,
    ];
  });
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${label}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ─── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, colorClass, iconBg }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col gap-1.5 hover:shadow-md transition-all">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
        {label}
      </span>
      <span className={`p-1.5 rounded-lg ${iconBg}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
    </div>
    <div className={`text-2xl font-extrabold tracking-tight ${colorClass}`}>
      {value}
    </div>
    {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
  </div>
);

// ─── Panel ─────────────────────────────────────────────────────────────────────
const Panel = ({ title, icon: Icon, right, children, className = "" }) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
  >
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-blue-500" />}
        {title}
      </h3>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
    {children}
  </div>
);

// ─── Chart Tooltip ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-xs min-w-[150px]">
      <p className="font-bold text-slate-700 mb-2 truncate max-w-[200px]">
        {label}
      </p>
      {payload.map((p) => (
        <div
          key={p.name}
          className="flex items-center justify-between gap-3 py-0.5"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: p.fill || p.color }}
            />
            <span className="text-slate-500 capitalize">{p.name}</span>
          </span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Sort Icon ─────────────────────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field)
    return <Minus className="w-2 h-2 opacity-25 ml-0.5" />;
  return sortDir === "asc" ? (
    <TrendingUp className="w-2.5 h-2.5 text-blue-500 ml-0.5" />
  ) : (
    <TrendingDown className="w-2.5 h-2.5 text-blue-500 ml-0.5" />
  );
};

// ─── Model Alert Card ──────────────────────────────────────────────────────────
const ModelAlertCard = ({ model, index }) => {
  const fpqi = parseFloat(model.FPQI);
  const st = fpqiStatus(fpqi);
  const totalDefects =
    (model.Critical || 0) + (model.Major || 0) + (model.Minor || 0);
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold text-slate-800 truncate"
          title={model.ModelName}
        >
          {model.ModelName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-rose-500 font-bold">
            C:{model.Critical || 0}
          </span>
          <span className="text-[10px] text-orange-500 font-bold">
            M:{model.Major || 0}
          </span>
          <span className="text-[10px] text-yellow-500 font-bold">
            m:{model.Minor || 0}
          </span>
          <span className="text-[10px] text-slate-400">
            | {totalDefects} defects
          </span>
        </div>
      </div>
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${st?.bg} ${st?.text} ${st?.border}`}
      >
        {fpqi.toFixed(2)}
      </span>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const FpaHistory = () => {
  const dispatch = useDispatch();

  // ── Redux state ────────────────────────────────────────────────────────────
  const fpaState = useSelector((s) => s.fpaReport);
  const filters = fpaState?.filters || { startDate: "", endDate: "" };
  const activeQuickFilter = fpaState?.activeQuickFilter || null;
  const isModelModalOpen = fpaState?.isModelModalOpen || false;
  const selectedModel = fpaState?.selectedModel || null;
  const isDefectModalOpen = fpaState?.isDefectModalOpen || false;
  const selectedFGSRNo = fpaState?.selectedFGSRNo || null;

  // ── Local state ────────────────────────────────────────────────────────────
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("ModelCount");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [chartsExpanded, setChartsExpanded] = useState(true);

  const hasFilters = !!(filters.startDate && filters.endDate);

  // ── API ────────────────────────────────────────────────────────────────────
  const {
    data: historyData,
    isLoading: historyLoading,
    isFetching: historyFetching,
    refetch: refetchHistory,
  } = useGetFpaHistoryQuery(
    { startDate: filters.startDate, endDate: filters.endDate },
    { skip: !hasFilters },
  );

  const rawData = historyData?.data || [];

  // ── Derived / filtered / sorted data ───────────────────────────────────────
  const fpaData = useMemo(() => {
    let d = [...rawData];
    if (searchTerm.trim()) {
      d = d.filter((r) =>
        r.ModelName.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    d.sort((a, b) => {
      let av = a[sortField] ?? 0;
      let bv = b[sortField] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return d;
  }, [rawData, searchTerm, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(fpaData.length / pageSize));
  const pagedData = fpaData.slice((page - 1) * pageSize, page * pageSize);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = rawData.length;
    const done = rawData.filter((r) => r.SampleInspected >= r.FPA).length;
    const totalCritical = rawData.reduce((s, r) => s + (r.Critical || 0), 0);
    const totalMajor = rawData.reduce((s, r) => s + (r.Major || 0), 0);
    const totalMinor = rawData.reduce((s, r) => s + (r.Minor || 0), 0);
    const inspected = rawData.filter((r) => r.SampleInspected > 0);
    const avgFPQI = inspected.length
      ? (
          inspected.reduce((s, r) => s + (parseFloat(r.FPQI) || 0), 0) /
          inspected.length
        ).toFixed(3)
      : null;
    const totalProd = rawData.reduce((s, r) => s + (r.ModelCount || 0), 0);
    const totalInsp = rawData.reduce((s, r) => s + (r.SampleInspected || 0), 0);
    const totalFPAReq = rawData.reduce((s, r) => s + (r.FPA || 0), 0);
    return {
      total,
      done,
      pending: total - done,
      totalCritical,
      totalMajor,
      totalMinor,
      avgFPQI,
      totalProd,
      totalInsp,
      totalFPAReq,
    };
  }, [rawData]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const defectBarData = useMemo(
    () =>
      [...rawData]
        .filter((r) => (r.Critical || 0) + (r.Major || 0) + (r.Minor || 0) > 0)
        .sort(
          (a, b) =>
            (b.Critical || 0) +
            (b.Major || 0) +
            (b.Minor || 0) -
            ((a.Critical || 0) + (a.Major || 0) + (a.Minor || 0)),
        )
        .slice(0, 10)
        .map((r) => ({
          name:
            r.ModelName.length > 18
              ? r.ModelName.slice(0, 18) + "…"
              : r.ModelName,
          Critical: r.Critical || 0,
          Major: r.Major || 0,
          Minor: r.Minor || 0,
        })),
    [rawData],
  );

  const prodVsInspData = useMemo(
    () =>
      [...rawData]
        .sort((a, b) => (b.ModelCount || 0) - (a.ModelCount || 0))
        .slice(0, 10)
        .map((r) => ({
          name:
            r.ModelName.length > 16
              ? r.ModelName.slice(0, 16) + "…"
              : r.ModelName,
          Production: r.ModelCount || 0,
          FPA_Req: r.FPA || 0,
          Inspected: r.SampleInspected || 0,
        })),
    [rawData],
  );

  const fpqiRankData = useMemo(
    () =>
      rawData
        .filter(
          (r) =>
            r.FPQI !== null && r.FPQI !== undefined && r.SampleInspected > 0,
        )
        .sort((a, b) => parseFloat(b.FPQI) - parseFloat(a.FPQI))
        .slice(0, 8)
        .map((r) => ({
          name:
            r.ModelName.length > 18
              ? r.ModelName.slice(0, 18) + "…"
              : r.ModelName,
          FPQI: parseFloat(parseFloat(r.FPQI).toFixed(3)),
          fill:
            parseFloat(r.FPQI) > 5
              ? PALETTE.critical
              : parseFloat(r.FPQI) > 2
                ? PALETTE.major
                : PALETTE.done,
        })),
    [rawData],
  );

  const statusPie = useMemo(
    () => [
      { name: "Done", value: kpis.done, color: PALETTE.done },
      { name: "Pending", value: kpis.pending, color: PALETTE.pending },
    ],
    [kpis],
  );

  const defectPie = useMemo(
    () =>
      [
        {
          name: "Critical",
          value: kpis.totalCritical,
          color: PALETTE.critical,
        },
        { name: "Major", value: kpis.totalMajor, color: PALETTE.major },
        { name: "Minor", value: kpis.totalMinor, color: PALETTE.minor },
      ].filter((d) => d.value > 0),
    [kpis],
  );

  const worstModels = useMemo(
    () =>
      rawData
        .filter(
          (r) =>
            r.FPQI !== null && r.FPQI !== undefined && parseFloat(r.FPQI) > 2,
        )
        .sort((a, b) => parseFloat(b.FPQI) - parseFloat(a.FPQI))
        .slice(0, 5),
    [rawData],
  );

  const watchlistData = useMemo(
    () =>
      rawData
        .filter(
          (r) =>
            r.FPQI !== null && r.FPQI !== undefined && parseFloat(r.FPQI) > 2,
        )
        .sort((a, b) => parseFloat(b.FPQI) - parseFloat(a.FPQI)),
    [rawData],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select both start and end date/time");
      return;
    }
    const start = new Date(startTime),
      end = new Date(endTime);
    if (end <= start) {
      toast.error("End date/time must be after start date/time");
      return;
    }
    dispatch(
      setFpaDateRange({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      }),
    );
    dispatch(setFpaQuickFilter(null));
    setPage(1);
  };

  const handleQuickFilter = (type) => {
    const fn = {
      today: getTodayRange,
      yesterday: getYesterdayRange,
      mtd: getMTDRange,
    }[type];
    if (!fn) return;
    const range = fn();
    dispatch(
      setFpaDateRange({ startDate: range.startDate, endDate: range.endDate }),
    );
    dispatch(setFpaQuickFilter(type));
    setStartTime(range.startLocal);
    setEndTime(range.endLocal);
    setPage(1);
  };

  const handleReset = () => {
    dispatch(resetFpaFilters());
    setStartTime("");
    setEndTime("");
    setSearchTerm("");
    setPage(1);
  };

  const handleSort = (field) => {
    if (!field) return;
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleOpenModelModal = (item) => {
    dispatch(openModelModal(item));
  };

  const isLoading = historyLoading || historyFetching;

  const pageNumbers = useMemo(() => {
    const windowSize = Math.min(5, totalPages);
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - windowSize + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  // ── Table columns config ───────────────────────────────────────────────────
  const TABLE_COLS = [
    { field: "ModelName", label: "Model Name", align: "left" },
    { field: "ModelCount", label: "Production", align: "center" },
    { field: "FPA", label: "FPA Req.", align: "center" },
    { field: "SampleInspected", label: "Inspected", align: "center" },
    { field: null, label: "Progress", align: "center" },
    { field: null, label: "Status", align: "center" },
    { field: "Critical", label: "C", align: "center" },
    { field: "Major", label: "M", align: "center" },
    { field: "Minor", label: "m", align: "center" },
    { field: "FPQI", label: "FPQI", align: "center" },
    { field: null, label: "Action", align: "center" },
  ];

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            FPA History Dashboard
          </h1>
          <p className="text-[11px] text-slate-400">
            Final Product Audit · Quality Inspection Centre
          </p>
        </div>

        <div className="flex items-center gap-2">
          {rawData.length > 0 && (
            <>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-medium hover:bg-slate-100 transition-colors"
              >
                <Printer className="w-3 h-3" /> Print
              </button>
              <button
                onClick={() => exportToCSV(rawData)}
                className="flex items-center gap-1.5 text-[11px] text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg font-semibold transition-colors shadow-sm shadow-blue-200"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </>
          )}

          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {rawData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Models
            </span>
          </div>

          {kpis.avgFPQI && (
            <div
              className={`flex flex-col items-center px-4 py-1.5 rounded-lg border min-w-[90px] ${
                parseFloat(kpis.avgFPQI) > 5
                  ? "bg-rose-50 border-rose-100"
                  : parseFloat(kpis.avgFPQI) > 2
                    ? "bg-amber-50 border-amber-100"
                    : "bg-emerald-50 border-emerald-100"
              }`}
            >
              <span
                className={`text-xl font-bold font-mono ${
                  parseFloat(kpis.avgFPQI) > 5
                    ? "text-rose-700"
                    : parseFloat(kpis.avgFPQI) > 2
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}
              >
                {kpis.avgFPQI}
              </span>
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                Avg FPQI
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
              Filters
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
            {/* Left: controls */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[170px] flex-1">
                <DateTimePicker
                  label="Start Date / Time"
                  name="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="min-w-[170px] flex-1">
                <DateTimePicker
                  label="End Date / Time"
                  name="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pb-0.5 shrink-0">
                <button
                  onClick={handleQuery}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isLoading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {isLoading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {isLoading ? "Loading…" : "Search"}
                </button>

                <button
                  onClick={() => hasFilters && refetchHistory()}
                  disabled={isLoading || !hasFilters}
                  title="Refresh"
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </button>

                <button
                  onClick={handleReset}
                  title="Reset Filters"
                  className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
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
                {[
                  { key: "yesterday", label: "Yesterday", color: "amber" },
                  { key: "today", label: "Today", color: "blue" },
                  { key: "mtd", label: "Month to Date", color: "emerald" },
                ].map(({ key, label, color }) => {
                  const active = activeQuickFilter === key;
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
                      onClick={() => !isLoading && handleQuickFilter(key)}
                      disabled={isLoading}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${colorMap[color]} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
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

        {/* ── LOADING ── */}
        {isLoading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching FPA data…</p>
          </div>
        )}

        {/* ── DATA CONTENT ── */}
        {!isLoading && rawData.length > 0 && (
          <>
            {/* ── KPI STRIP ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              <KpiCard
                icon={Factory}
                label="Total Models"
                value={kpis.total}
                colorClass="text-blue-900"
                iconBg="bg-blue-100 text-blue-600"
              />
              <KpiCard
                icon={CheckCircle2}
                label="Completed"
                value={kpis.done}
                sub={`${kpis.total ? Math.round((kpis.done / kpis.total) * 100) : 0}% completion`}
                colorClass="text-emerald-700"
                iconBg="bg-emerald-100 text-emerald-600"
              />
              <KpiCard
                icon={XCircle}
                label="Pending"
                value={kpis.pending}
                sub={`${kpis.total ? Math.round((kpis.pending / kpis.total) * 100) : 0}% remaining`}
                colorClass="text-rose-700"
                iconBg="bg-rose-100 text-rose-600"
              />
              <KpiCard
                icon={Siren}
                label="Critical"
                value={kpis.totalCritical}
                colorClass="text-red-700"
                iconBg="bg-red-100 text-red-600"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Major"
                value={kpis.totalMajor}
                colorClass="text-orange-700"
                iconBg="bg-orange-100 text-orange-600"
              />
              <KpiCard
                icon={Zap}
                label="Minor"
                value={kpis.totalMinor}
                colorClass="text-yellow-700"
                iconBg="bg-yellow-100 text-yellow-600"
              />
              <KpiCard
                icon={Gauge}
                label="Avg FPQI"
                value={kpis.avgFPQI ?? "—"}
                sub={
                  kpis.avgFPQI
                    ? parseFloat(kpis.avgFPQI) > 5
                      ? "Poor range"
                      : parseFloat(kpis.avgFPQI) > 2
                        ? "Fair range"
                        : "Good range"
                    : "No inspections"
                }
                colorClass={
                  !kpis.avgFPQI
                    ? "text-slate-400"
                    : parseFloat(kpis.avgFPQI) > 5
                      ? "text-red-700"
                      : parseFloat(kpis.avgFPQI) > 2
                        ? "text-amber-700"
                        : "text-emerald-700"
                }
                iconBg="bg-violet-100 text-violet-600"
              />
            </div>

            {/* ── SECONDARY STATS ── */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  icon: Factory,
                  label: "Total Production",
                  value: kpis.totalProd.toLocaleString(),
                  iconBg: "bg-blue-50 text-blue-600",
                },
                {
                  icon: BadgeCheck,
                  label: "FPA Required",
                  value: kpis.totalFPAReq.toLocaleString(),
                  iconBg: "bg-teal-50 text-teal-600",
                },
                {
                  icon: FileText,
                  label: "Total Inspected",
                  value: kpis.totalInsp.toLocaleString(),
                  iconBg: "bg-indigo-50 text-indigo-600",
                },
              ].map(({ icon: Icon, label, value, iconBg }) => (
                <div
                  key={label}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3"
                >
                  <span className={`p-2 rounded-lg ${iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      {label}
                    </p>
                    <p className="text-lg font-extrabold text-slate-800">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── CHARTS SECTION ── */}
            <div>
              <button
                onClick={() => setChartsExpanded((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 mb-2 transition-colors print:hidden"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                Charts & Analytics
                {chartsExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {chartsExpanded && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                  {/* Defect Bar Chart */}
                  <Panel
                    title="Top 10 Models by Defect Count"
                    icon={BarChart3}
                    right={
                      <span className="text-[10px] text-slate-400">
                        Critical · Major · Minor
                      </span>
                    }
                    className="xl:col-span-2"
                  >
                    <div className="p-4">
                      {defectBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart
                            data={defectBarData}
                            margin={{
                              top: 4,
                              right: 16,
                              left: -10,
                              bottom: 55,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f1f5f9"
                            />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 9, fill: "#94a3b8" }}
                              angle={-35}
                              textAnchor="end"
                              interval={0}
                            />
                            <YAxis
                              tick={{ fontSize: 9, fill: "#94a3b8" }}
                              allowDecimals={false}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend
                              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                            />
                            <Bar
                              dataKey="Critical"
                              fill={PALETTE.critical}
                              radius={[3, 3, 0, 0]}
                              maxBarSize={24}
                            />
                            <Bar
                              dataKey="Major"
                              fill={PALETTE.major}
                              radius={[3, 3, 0, 0]}
                              maxBarSize={24}
                            />
                            <Bar
                              dataKey="Minor"
                              fill={PALETTE.minor}
                              radius={[3, 3, 0, 0]}
                              maxBarSize={24}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[240px] flex flex-col items-center justify-center gap-2 text-emerald-600">
                          <BadgeCheck className="w-8 h-8 opacity-60" />
                          <span className="text-sm font-semibold">
                            No defects recorded
                          </span>
                        </div>
                      )}
                    </div>
                  </Panel>

                  {/* Right column — pies */}
                  <div className="flex flex-col gap-3">
                    <Panel title="Inspection Status" icon={Shield}>
                      <div className="p-3">
                        <ResponsiveContainer width="100%" height={140}>
                          <PieChart>
                            <Pie
                              data={statusPie}
                              cx="50%"
                              cy="50%"
                              innerRadius={36}
                              outerRadius={58}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {statusPie.map((e, i) => (
                                <Cell key={i} fill={e.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v, n]} />
                            <Legend
                              iconType="circle"
                              iconSize={7}
                              wrapperStyle={{ fontSize: 10 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-1 text-xs">
                          <span className="text-emerald-600 font-bold">
                            {kpis.done} Done
                          </span>
                          <span className="text-rose-600 font-bold">
                            {kpis.pending} Pending
                          </span>
                        </div>
                      </div>
                    </Panel>

                    <Panel title="Defect Distribution" icon={AlertTriangle}>
                      <div className="p-3">
                        {defectPie.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={140}>
                              <PieChart>
                                <Pie
                                  data={defectPie}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={36}
                                  outerRadius={58}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {defectPie.map((e, i) => (
                                    <Cell key={i} fill={e.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v, n) => [v, n]} />
                                <Legend
                                  iconType="circle"
                                  iconSize={7}
                                  wrapperStyle={{ fontSize: 10 }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-3 mt-1 text-xs">
                              <span className="text-red-600 font-bold">
                                {kpis.totalCritical} C
                              </span>
                              <span className="text-orange-600 font-bold">
                                {kpis.totalMajor} M
                              </span>
                              <span className="text-yellow-600 font-bold">
                                {kpis.totalMinor} m
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="h-[140px] flex items-center justify-center text-emerald-600 text-xs font-semibold">
                            No defects recorded
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>

                  {/* Production vs Inspected */}
                  <Panel
                    title="Production vs FPA Required vs Inspected (Top 10)"
                    icon={TrendingUp}
                    right={
                      <span className="text-[10px] text-slate-400">
                        by production volume
                      </span>
                    }
                    className="xl:col-span-2"
                  >
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={prodVsInspData}
                          margin={{ top: 4, right: 16, left: -10, bottom: 55 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f1f5f9"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            allowDecimals={false}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend
                            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                          />
                          <Bar
                            dataKey="Production"
                            fill="#3b82f6"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={20}
                          />
                          <Bar
                            dataKey="FPA_Req"
                            fill="#8b5cf6"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={20}
                          />
                          <Bar
                            dataKey="Inspected"
                            fill="#10b981"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={20}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>

                  {/* FPQI Ranking */}
                  <Panel
                    title="FPQI Ranking (Worst First)"
                    icon={Gauge}
                    right={
                      <span className="text-[10px] text-slate-400">
                        Inspected models only
                      </span>
                    }
                  >
                    <div className="p-4">
                      {fpqiRankData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={fpqiRankData}
                            layout="vertical"
                            margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f1f5f9"
                              horizontal={false}
                            />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 9, fill: "#94a3b8" }}
                              allowDecimals
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={110}
                              tick={{ fontSize: 9, fill: "#94a3b8" }}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar
                              dataKey="FPQI"
                              radius={[0, 3, 3, 0]}
                              maxBarSize={18}
                            >
                              {fpqiRankData.map((e, i) => (
                                <Cell key={i} fill={e.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                          No inspected models yet
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              )}
            </div>

            {/* ── MAIN LAYOUT: Alerts + Table ── */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 items-start">
              {/* Left: Alert cards */}
              <div className="xl:col-span-1 flex flex-col gap-3">
                {worstModels.length > 0 ? (
                  <Panel
                    title="Quality Alerts"
                    icon={AlertTriangle}
                    right={
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                        {worstModels.length}
                      </span>
                    }
                  >
                    <div className="p-3 space-y-2">
                      <p className="text-[10px] text-slate-400 mb-2">
                        Models with FPQI &gt; 2.000
                      </p>
                      {worstModels.map((m, i) => (
                        <ModelAlertCard key={i} model={m} index={i} />
                      ))}
                    </div>
                  </Panel>
                ) : (
                  <Panel title="Quality Status" icon={BadgeCheck}>
                    <div className="p-6 text-center text-emerald-600">
                      <BadgeCheck className="w-8 h-8 mx-auto mb-2 opacity-70" />
                      <p className="text-xs font-bold">
                        All models within acceptable FPQI
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Quality is in good shape!
                      </p>
                    </div>
                  </Panel>
                )}

                {/* Quick Stats */}
                <Panel title="Quick Stats" icon={BarChart3}>
                  <div className="p-3 space-y-3">
                    {[
                      {
                        label: "Overall Completion",
                        value: `${kpis.total ? Math.round((kpis.done / kpis.total) * 100) : 0}%`,
                        pct: kpis.total
                          ? Math.round((kpis.done / kpis.total) * 100)
                          : 0,
                        barColor: "bg-emerald-500",
                      },
                      {
                        label: "Models with Defects",
                        value: `${rawData.filter((r) => (r.Critical || 0) + (r.Major || 0) + (r.Minor || 0) > 0).length}`,
                        pct: kpis.total
                          ? Math.round(
                              (rawData.filter(
                                (r) =>
                                  (r.Critical || 0) +
                                    (r.Major || 0) +
                                    (r.Minor || 0) >
                                  0,
                              ).length /
                                kpis.total) *
                                100,
                            )
                          : 0,
                        barColor: "bg-orange-400",
                      },
                      {
                        label: "Poor FPQI (>5)",
                        value: `${rawData.filter((r) => r.FPQI !== null && r.FPQI !== undefined && parseFloat(r.FPQI) > 5).length}`,
                        pct: kpis.total
                          ? Math.round(
                              (rawData.filter(
                                (r) =>
                                  r.FPQI !== null &&
                                  r.FPQI !== undefined &&
                                  parseFloat(r.FPQI) > 5,
                              ).length /
                                kpis.total) *
                                100,
                            )
                          : 0,
                        barColor: "bg-red-500",
                      },
                    ].map(({ label, value, pct, barColor }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500 font-medium">
                            {label}
                          </span>
                          <span className="font-bold text-slate-700">
                            {value}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* Right: Data Table */}
              <div className="xl:col-span-3">
                <Panel
                  title="FPA Inspection Summary"
                  icon={FileText}
                  right={
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search model…"
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                          }}
                          className="pl-7 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 w-36 bg-slate-50"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">
                          Show:
                        </span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                          }}
                          className="text-[11px] border border-slate-200 rounded-md px-1.5 py-1 bg-slate-50 focus:outline-none"
                        >
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {fpaData.length}/{rawData.length}
                      </span>
                    </div>
                  }
                >
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-100">
                          <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap">
                            Sr. No.
                          </th>
                          {TABLE_COLS.map(({ field, label, align }) => (
                            <th
                              key={label}
                              className={`px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-${align} ${field ? "cursor-pointer hover:text-blue-600 select-none" : ""}`}
                              onClick={() => handleSort(field)}
                            >
                              <span
                                className={`inline-flex items-center gap-0.5 ${align === "center" ? "justify-center" : "justify-start"}`}
                              >
                                {label}
                                {field && (
                                  <SortIcon
                                    field={field}
                                    sortField={sortField}
                                    sortDir={sortDir}
                                  />
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedData.map((item, idx) => {
                          const done = item.SampleInspected >= item.FPA;
                          const fpqi =
                            item.FPQI !== null && item.FPQI !== undefined
                              ? parseFloat(item.FPQI)
                              : null;
                          const hasInsp = item.SampleInspected > 0;
                          const st = fpqiStatus(fpqi);
                          const pct =
                            item.FPA > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (item.SampleInspected / item.FPA) * 100,
                                  ),
                                )
                              : 0;
                          const globalIdx = (page - 1) * pageSize + idx + 1;

                          return (
                            <tr
                              key={item.ModelName + idx}
                              className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                            >
                              <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono text-[10px]">
                                {globalIdx}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 max-w-[220px]">
                                <span
                                  className="font-semibold text-slate-800 truncate block text-[11px]"
                                  title={item.ModelName}
                                >
                                  {item.ModelName}
                                </span>
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-center font-semibold text-slate-700">
                                {item.ModelCount || 0}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-center font-semibold text-slate-700">
                                {item.FPA || 0}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-center font-semibold text-slate-700">
                                {item.SampleInspected || 0}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${done ? "bg-emerald-400" : pct > 50 ? "bg-amber-400" : "bg-rose-400"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-slate-400">
                                    {pct}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${done ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                                >
                                  {done ? (
                                    <CheckCircle2 className="w-2 h-2" />
                                  ) : (
                                    <XCircle className="w-2 h-2" />
                                  )}
                                  {done ? "Done" : "Pending"}
                                </span>
                              </td>
                              <td
                                className={`px-3 py-2 border-b border-slate-100 text-center font-extrabold text-sm ${(item.Critical || 0) > 0 ? "text-red-600" : "text-slate-200"}`}
                              >
                                {item.Critical || 0}
                              </td>
                              <td
                                className={`px-3 py-2 border-b border-slate-100 text-center font-extrabold text-sm ${(item.Major || 0) > 0 ? "text-orange-500" : "text-slate-200"}`}
                              >
                                {item.Major || 0}
                              </td>
                              <td
                                className={`px-3 py-2 border-b border-slate-100 text-center font-extrabold text-sm ${(item.Minor || 0) > 0 ? "text-yellow-500" : "text-slate-200"}`}
                              >
                                {item.Minor || 0}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-center">
                                {fpqi !== null ? (
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-extrabold ${st?.bg} ${st?.text} ${st?.border}`}
                                  >
                                    {fpqi.toFixed(3)}
                                  </span>
                                ) : (
                                  <span className="text-slate-200">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-center">
                                {hasInsp ? (
                                  <button
                                    onClick={() => handleOpenModelModal(item)}
                                    className="text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                                  >
                                    View <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                ) : (
                                  <span className="text-slate-200">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {fpaData.length === 0 && (
                      <div className="p-10 text-center text-slate-400 text-xs">
                        No models match <strong>"{searchTerm}"</strong>
                      </div>
                    )}
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span>
                      Showing{" "}
                      <strong className="text-slate-700">
                        {fpaData.length === 0 ? 0 : (page - 1) * pageSize + 1}–
                        {Math.min(page * pageSize, fpaData.length)}
                      </strong>{" "}
                      of{" "}
                      <strong className="text-slate-700">
                        {fpaData.length}
                      </strong>{" "}
                      models
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-[10px] font-bold text-slate-600"
                      >
                        «
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-slate-600"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      {pageNumbers.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 rounded border text-[10px] font-bold transition-all ${p === page ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 hover:bg-blue-50 text-slate-600"}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-slate-600"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-[10px] font-bold text-slate-600"
                      >
                        »
                      </button>
                    </div>

                    <span className="flex items-center gap-4">
                      <span>
                        Production:{" "}
                        <strong className="text-slate-700">
                          {kpis.totalProd.toLocaleString()}
                        </strong>
                      </span>
                      <span>
                        Inspected:{" "}
                        <strong className="text-slate-700">
                          {kpis.totalInsp.toLocaleString()}
                        </strong>
                      </span>
                    </span>
                  </div>
                </Panel>
              </div>
            </div>

            {/* ── FPQI WATCHLIST ── */}
            <Panel
              title="FPQI Watchlist — Models Needing Attention"
              icon={Gauge}
              right={
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    FPQI &gt; 2.000
                  </span>
                  {watchlistData.length > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {watchlistData.length} models
                    </span>
                  )}
                </div>
              }
            >
              {watchlistData.length > 0 ? (
                <div className="overflow-auto">
                  <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-rose-50/60">
                        {[
                          "Sr. No.",
                          "Model",
                          "Production",
                          "Inspected",
                          "Critical",
                          "Major",
                          "Minor",
                          "FPQI",
                          "Rating",
                          "Action",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 font-semibold text-rose-700 border-b border-rose-100 text-center whitespace-nowrap text-[10px] uppercase tracking-widest"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {watchlistData.map((r, i) => {
                        const st = fpqiStatus(parseFloat(r.FPQI));
                        return (
                          <tr
                            key={r.ModelName + i}
                            className="hover:bg-rose-50/40 transition-colors even:bg-slate-50/40"
                          >
                            <td className="px-4 py-2 border-b border-slate-100 text-slate-400 text-[10px] text-center">
                              {i + 1}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 font-semibold text-slate-800 max-w-[280px] truncate">
                              {r.ModelName}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center text-slate-700">
                              {r.ModelCount || 0}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center text-slate-700">
                              {r.SampleInspected || 0}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center text-red-600 font-extrabold">
                              {r.Critical || 0}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center text-orange-600 font-extrabold">
                              {r.Major || 0}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center text-yellow-600 font-extrabold">
                              {r.Minor || 0}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center font-extrabold text-slate-800">
                              {parseFloat(r.FPQI).toFixed(3)}
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center">
                              <span
                                className={`px-2 py-0.5 rounded border text-[10px] font-bold ${st?.bg} ${st?.text} ${st?.border}`}
                              >
                                {st?.label}
                              </span>
                            </td>
                            <td className="px-4 py-2 border-b border-slate-100 text-center">
                              {r.SampleInspected > 0 ? (
                                <button
                                  onClick={() => handleOpenModelModal(r)}
                                  className="text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                                >
                                  View <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              ) : (
                                <span className="text-slate-200">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center text-emerald-600 flex flex-col items-center gap-2">
                  <BadgeCheck className="w-8 h-8 opacity-60" />
                  <p className="text-sm font-bold">
                    All models have FPQI ≤ 2.000
                  </p>
                  <p className="text-xs text-slate-400">
                    Quality is in good shape!
                  </p>
                </div>
              )}
            </Panel>
          </>
        )}

        {/* ── Empty: no data for range ── */}
        {!isLoading && rawData.length === 0 && hasFilters && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList
              className="w-10 h-10 text-slate-300"
              strokeWidth={1.2}
            />
            <h3 className="text-sm font-semibold text-slate-600">
              No Records Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              No FPA records found for the selected date range.
            </p>
          </div>
        )}

        {/* ── Empty: no filters applied ── */}
        {!hasFilters && !isLoading && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">
              Select a Date Range to Begin
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Use the date pickers above or click a quick shortcut below.
            </p>
            <div className="flex items-center gap-2 mt-1">
              {[
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "mtd", label: "Month to Date" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleQuickFilter(key)}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm shadow-blue-200"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {isModelModalOpen && selectedModel && (
        <FpaModelDetailModal
          modelName={
            typeof selectedModel === "object"
              ? selectedModel.ModelName
              : selectedModel
          }
          modelData={
            typeof selectedModel === "object" ? selectedModel : undefined
          }
          startDate={filters.startDate}
          endDate={filters.endDate}
        />
      )}
      {isDefectModalOpen && selectedFGSRNo && <FpaDefectDetailModal />}
    </div>
  );
};

export default FpaHistory;
