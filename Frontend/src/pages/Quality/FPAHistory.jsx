import { useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import Loader from "../../components/ui/Loader";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import FpaModelDetailModal from "../../components/FpaModelDetailModal";
import FpaDefectDetailModal from "../../components/FpaDefectDetailModal";
import toast from "react-hot-toast";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

import { useGetFpaHistoryQuery } from "../../redux/api/fpaReportApi";
import {
  setFpaDateRange, setFpaQuickFilter, resetFpaFilters, openModelModal,
} from "../../redux/slices/fpaReportSlice.js";
import { getTodayRange, getYesterdayRange, getMTDRange } from "../../utils/dateUtils";

import {
  HiOutlineClipboardList, HiOutlineSearch, HiOutlineDocumentReport,
  HiOutlineBadgeCheck, HiOutlineExclamationCircle, HiOutlineFilter,
  HiOutlineLightningBolt, HiOutlineChartBar, HiOutlinePrinter,
} from "react-icons/hi";
import { FiRefreshCw, FiDownload, FiTrendingUp, FiTrendingDown, FiMinus, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  FaSearch, FaRedo, FaCalendarAlt, FaArrowRight,
  FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaShieldAlt,
} from "react-icons/fa";
import { MdOutlineFactory, MdOutlineSpeed, MdWarning } from "react-icons/md";
import { BiBarChartAlt2 } from "react-icons/bi";
import { RiAlarmWarningLine } from "react-icons/ri";
import { IoMdTrendingUp } from "react-icons/io";

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const PALETTE = {
  critical: "#dc2626",
  major:    "#ea580c",
  minor:    "#ca8a04",
  done:     "#16a34a",
  pending:  "#e11d48",
  navy:     "#1e3a5f",
  slate:    "#64748b",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
const fpqiStatus = (val) => {
  if (val === null || val === undefined) return null;
  if (val > 5) return { label: "Poor",  bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200" };
  if (val > 2) return { label: "Fair",  bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200" };
  return           { label: "Good",  bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" };
};

const exportToCSV = (data, label = "fpa_report") => {
  if (!data.length) return;
  const headers = ["Model Name","Production","FPA Req.","Inspected","% Done","Status","Critical","Major","Minor","FPQI","Rating"];
  const rows = data.map((r) => {
    const pct = r.FPA > 0 ? Math.min(100, Math.round((r.SampleInspected / r.FPA) * 100)) : 0;
    const fpqi = r.FPQI !== null ? parseFloat(r.FPQI).toFixed(3) : "N/A";
    const st = r.FPQI !== null ? fpqiStatus(parseFloat(r.FPQI))?.label : "N/A";
    return [`"${r.ModelName}"`, r.ModelCount, r.FPA, r.SampleInspected, `${pct}%`,
      r.SampleInspected >= r.FPA ? "Done" : "Pending",
      r.Critical, r.Major, r.Minor, fpqi, st];
  });
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${label}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

/* ══════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════ */

/* KPI Card */
const KpiCard = ({ icon: Icon, label, value, sub, colorClass, iconBg }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{label}</span>
      <span className={`p-1.5 rounded-lg ${iconBg}`}><Icon size={14} /></span>
    </div>
    <div className={`text-2xl font-black tracking-tight ${colorClass}`}>{value}</div>
    {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
  </div>
);

/* Section Panel */
const Panel = ({ title, icon: Icon, right, children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
      <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
        {Icon && <Icon size={14} className="text-blue-600" />}
        {title}
      </h3>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
    {children}
  </div>
);

/* Custom Chart Tooltip */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs min-w-[150px]">
      <p className="font-bold text-gray-700 mb-2 truncate max-w-[200px]">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill || p.color }} />
            <span className="text-gray-500 capitalize">{p.name}</span>
          </span>
          <span className="font-bold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* Inline Sort Icon */
const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <FiMinus size={9} className="opacity-25 ml-0.5" />;
  return sortDir === "asc"
    ? <FiTrendingUp size={9} className="text-blue-500 ml-0.5" />
    : <FiTrendingDown size={9} className="text-blue-500 ml-0.5" />;
};

/* Worst-Model Mini Card */
const ModelAlertCard = ({ model, index }) => {
  const fpqi = parseFloat(model.FPQI);
  const st   = fpqiStatus(fpqi);
  const totalDefects = model.Critical + model.Major + model.Minor;
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all">
      <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center flex-shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate" title={model.ModelName}>{model.ModelName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-red-500 font-bold">C:{model.Critical}</span>
          <span className="text-[10px] text-orange-500 font-bold">M:{model.Major}</span>
          <span className="text-[10px] text-yellow-500 font-bold">m:{model.Minor}</span>
          <span className="text-[10px] text-gray-400">| {totalDefects} defects</span>
        </div>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${st?.bg} ${st?.text} ${st?.border} flex-shrink-0`}>
        {fpqi.toFixed(2)}
      </span>
    </div>
  );
};

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
const FpaHistory = () => {
  const dispatch = useDispatch();

  /* ── Redux state ── */
  const fpaState          = useSelector((s) => s.fpaReport);
  const filters           = fpaState?.filters || { startDate: "", endDate: "" };
  const activeQuickFilter = fpaState?.activeQuickFilter || null;
  const isModelModalOpen  = fpaState?.isModelModalOpen  || false;
  const selectedModel     = fpaState?.selectedModel     || null;
  const isDefectModalOpen = fpaState?.isDefectModalOpen || false;
  const selectedFGSRNo    = fpaState?.selectedFGSRNo    || null;

  /* ── Local state ── */
  const [startTime, setStartTime]   = useState("");
  const [endTime, setEndTime]       = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField]   = useState("ModelCount");
  const [sortDir, setSortDir]       = useState("desc");
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(20);
  const [chartsExpanded, setChartsExpanded] = useState(true);

  const hasFilters = !!(filters.startDate && filters.endDate);

  /* ── API ── */
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

  /* ── Derived / filtered / sorted data ── */
  const fpaData = useMemo(() => {
    let d = [...rawData];
    if (searchTerm.trim()) {
      d = d.filter((r) => r.ModelName.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    d.sort((a, b) => {
      let av = a[sortField] ?? 0;
      let bv = b[sortField] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
    return d;
  }, [rawData, searchTerm, sortField, sortDir]);

  /* Paginated slice */
  const totalPages  = Math.max(1, Math.ceil(fpaData.length / pageSize));
  const pagedData   = fpaData.slice((page - 1) * pageSize, page * pageSize);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total         = rawData.length;
    const done          = rawData.filter((r) => r.SampleInspected >= r.FPA).length;
    const totalCritical = rawData.reduce((s, r) => s + (r.Critical || 0), 0);
    const totalMajor    = rawData.reduce((s, r) => s + (r.Major    || 0), 0);
    const totalMinor    = rawData.reduce((s, r) => s + (r.Minor    || 0), 0);
    const inspected     = rawData.filter((r) => r.SampleInspected > 0);
    const avgFPQI       = inspected.length
      ? (inspected.reduce((s, r) => s + (parseFloat(r.FPQI) || 0), 0) / inspected.length).toFixed(3)
      : null;
    const totalProd     = rawData.reduce((s, r) => s + (r.ModelCount || 0), 0);
    const totalInsp     = rawData.reduce((s, r) => s + (r.SampleInspected || 0), 0);
    const totalFPAReq   = rawData.reduce((s, r) => s + (r.FPA || 0), 0);
    return { total, done, pending: total - done, totalCritical, totalMajor, totalMinor, avgFPQI, totalProd, totalInsp, totalFPAReq };
  }, [rawData]);

  /* ── Chart data ── */
  /* Top-10 defect bar chart */
  const defectBarData = useMemo(() =>
    [...rawData]
      .filter((r) => r.Critical + r.Major + r.Minor > 0)
      .sort((a, b) => (b.Critical + b.Major + b.Minor) - (a.Critical + a.Major + a.Minor))
      .slice(0, 10)
      .map((r) => ({
        name: r.ModelName.length > 18 ? r.ModelName.slice(0, 18) + "…" : r.ModelName,
        Critical: r.Critical,
        Major:    r.Major,
        Minor:    r.Minor,
      })),
  [rawData]);

  /* Production vs Inspected (top 10 by production) */
  const prodVsInspData = useMemo(() =>
    [...rawData]
      .sort((a, b) => b.ModelCount - a.ModelCount)
      .slice(0, 10)
      .map((r) => ({
        name:       r.ModelName.length > 16 ? r.ModelName.slice(0, 16) + "…" : r.ModelName,
        Production: r.ModelCount,
        FPA_Req:    r.FPA,
        Inspected:  r.SampleInspected,
      })),
  [rawData]);

  /* FPQI ranking (models with FPQI, sorted worst first, top 8) */
  const fpqiRankData = useMemo(() =>
    rawData
      .filter((r) => r.FPQI !== null && r.SampleInspected > 0)
      .sort((a, b) => parseFloat(b.FPQI) - parseFloat(a.FPQI))
      .slice(0, 8)
      .map((r) => ({
        name:  r.ModelName.length > 18 ? r.ModelName.slice(0, 18) + "…" : r.ModelName,
        FPQI:  parseFloat(parseFloat(r.FPQI).toFixed(3)),
        fill:  parseFloat(r.FPQI) > 5 ? PALETTE.critical : parseFloat(r.FPQI) > 2 ? PALETTE.major : PALETTE.done,
      }))
      .reverse(), // worst at bottom so chart reads top-to-bottom = best-to-worst
  [rawData]);

  /* Pie charts */
  const statusPie  = useMemo(() => [
    { name: "Done",    value: kpis.done,    color: PALETTE.done    },
    { name: "Pending", value: kpis.pending, color: PALETTE.pending },
  ], [kpis]);

  const defectPie = useMemo(() => [
    { name: "Critical", value: kpis.totalCritical, color: PALETTE.critical },
    { name: "Major",    value: kpis.totalMajor,    color: PALETTE.major    },
    { name: "Minor",    value: kpis.totalMinor,    color: PALETTE.minor    },
  ].filter((d) => d.value > 0), [kpis]);

  /* Worst-FPQI models for alert cards */
  const worstModels = useMemo(() =>
    rawData
      .filter((r) => r.FPQI !== null && parseFloat(r.FPQI) > 2)
      .sort((a, b) => parseFloat(b.FPQI) - parseFloat(a.FPQI))
      .slice(0, 5),
  [rawData]);

  /* ── Handlers ── */
  const handleQuery = () => {
    if (!startTime || !endTime) { toast.error("Please select both start and end date/time"); return; }
    const start = new Date(startTime), end = new Date(endTime);
    if (end <= start) { toast.error("End date/time must be after start date/time"); return; }
    dispatch(setFpaDateRange({ startDate: start.toISOString(), endDate: end.toISOString() }));
    dispatch(setFpaQuickFilter(null));
    setPage(1);
  };

  const handleQuickFilter = (type) => {
    const fn = { today: getTodayRange, yesterday: getYesterdayRange, mtd: getMTDRange }[type];
    if (!fn) return;
    const range = fn();
    dispatch(setFpaDateRange({ startDate: range.startDate, endDate: range.endDate }));
    dispatch(setFpaQuickFilter(type));
    setStartTime(range.startLocal);
    setEndTime(range.endLocal);
    setPage(1);
  };

  const handleReset = () => {
    dispatch(resetFpaFilters());
    setStartTime(""); setEndTime(""); setSearchTerm(""); setPage(1);
  };

  const handleSort = (field) => {
    if (!field) return;
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setPage(1);
  };

  const handlePrint = () => window.print();

  const isLoading = historyLoading || historyFetching;

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50/80 font-sans">

      {/* ── PAGE HEADER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-4 shadow-xl print:hidden">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-blue-500/20 border border-blue-400/30 p-2.5 rounded-xl">
              <MdOutlineFactory size={22} className="text-blue-300" />
            </span>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">FPA Report Dashboard</h1>
              <p className="text-blue-300/70 text-[11px] mt-0.5 font-medium">Final Product Audit · Quality Inspection Centre</p>
            </div>
          </div>
          {rawData.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-white/15">
                <HiOutlinePrinter size={13} /> Print
              </button>
              <button onClick={() => exportToCSV(rawData)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                <FiDownload size={13} /> Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 md:px-5 py-4 space-y-4">

        {/* ── FILTERS ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm print:hidden">
          <div className="flex items-center gap-2 mb-3">
            <HiOutlineFilter size={13} className="text-blue-600" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">

            <div className="md:col-span-3">
              <DateTimePicker label="Start Date / Time" name="startTime" value={startTime}
                onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <DateTimePicker label="End Date / Time" name="endTime" value={endTime}
                onChange={(e) => setEndTime(e.target.value)} />
            </div>

            <div className="md:col-span-3 flex items-end gap-2">
              <Button onClick={handleQuery}
                bgColor={isLoading ? "bg-gray-300" : "bg-blue-700 hover:bg-blue-800"}
                textColor="text-white"
                className="px-4 py-[9px] text-sm flex items-center gap-1.5 font-bold rounded-lg flex-1"
                disabled={isLoading}>
                <FaSearch size={10} />
                {isLoading ? "Loading…" : "Search"}
              </Button>
              <button onClick={() => hasFilters && refetchHistory()} disabled={isLoading || !hasFilters}
                title="Refresh"
                className="p-[9px] rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-500 disabled:opacity-40 transition-colors border border-gray-200">
                <FiRefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              </button>
              <Button onClick={handleReset}
                bgColor="bg-gray-100 hover:bg-red-50" textColor="text-gray-500 hover:text-red-600"
                className="px-3 py-[9px] text-sm flex items-center gap-1.5 rounded-lg border border-gray-200">
                <FaRedo size={10} /> Reset
              </Button>
            </div>

            <div className="md:col-span-3 flex items-end gap-2">
              <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap mb-[10px]">Quick:</span>
              {[
                { key: "today",     label: "Today" },
                { key: "yesterday", label: "YDAY"  },
                { key: "mtd",       label: "MTD"   },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => !isLoading && handleQuickFilter(key)} disabled={isLoading}
                  className={`px-3 py-[9px] text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex-1 ${
                    activeQuickFilter === key
                      ? "bg-blue-700 text-white shadow-sm ring-2 ring-blue-300 ring-offset-1"
                      : "bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 border border-gray-200"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── LOADING ── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader />
          </div>
        )}

        {/* ══════════════ DATA CONTENT ══════════════ */}
        {!isLoading && rawData.length > 0 && (
          <>
            {/* ── KPI STRIP ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <KpiCard icon={MdOutlineFactory} label="Total Models" value={kpis.total}
                colorClass="text-blue-900" iconBg="bg-blue-100 text-blue-600" />
              <KpiCard icon={FaCheckCircle} label="Completed"
                value={kpis.done}
                sub={`${kpis.total ? Math.round((kpis.done / kpis.total) * 100) : 0}% completion rate`}
                colorClass="text-emerald-700" iconBg="bg-emerald-100 text-emerald-600" />
              <KpiCard icon={FaTimesCircle} label="Pending"
                value={kpis.pending}
                sub={`${kpis.total ? Math.round((kpis.pending / kpis.total) * 100) : 0}% remaining`}
                colorClass="text-rose-700" iconBg="bg-rose-100 text-rose-600" />
              <KpiCard icon={RiAlarmWarningLine} label="Critical Defects" value={kpis.totalCritical}
                colorClass="text-red-700" iconBg="bg-red-100 text-red-600" />
              <KpiCard icon={FaExclamationTriangle} label="Major Defects" value={kpis.totalMajor}
                colorClass="text-orange-700" iconBg="bg-orange-100 text-orange-600" />
              <KpiCard icon={HiOutlineLightningBolt} label="Minor Defects" value={kpis.totalMinor}
                colorClass="text-yellow-700" iconBg="bg-yellow-100 text-yellow-600" />
              <KpiCard icon={MdOutlineSpeed} label="Avg FPQI"
                value={kpis.avgFPQI ?? "—"}
                sub={kpis.avgFPQI
                  ? (parseFloat(kpis.avgFPQI) > 5 ? "⚠ Poor quality range"
                    : parseFloat(kpis.avgFPQI) > 2 ? "▲ Fair quality range"
                    : "✔ Good quality range")
                  : "No inspections yet"}
                colorClass={
                  kpis.avgFPQI === null ? "text-gray-400"
                  : parseFloat(kpis.avgFPQI) > 5 ? "text-red-700"
                  : parseFloat(kpis.avgFPQI) > 2 ? "text-amber-700"
                  : "text-emerald-700"
                }
                iconBg="bg-purple-100 text-purple-600" />
            </div>

            {/* ── SECONDARY STATS BAR ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                <span className="bg-blue-50 p-2 rounded-lg"><MdOutlineFactory size={18} className="text-blue-600" /></span>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total Production</p>
                  <p className="text-lg font-black text-gray-800">{kpis.totalProd.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                <span className="bg-teal-50 p-2 rounded-lg"><HiOutlineBadgeCheck size={18} className="text-teal-600" /></span>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">FPA Required</p>
                  <p className="text-lg font-black text-gray-800">{kpis.totalFPAReq.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                <span className="bg-indigo-50 p-2 rounded-lg"><HiOutlineDocumentReport size={18} className="text-indigo-600" /></span>
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total Inspected</p>
                  <p className="text-lg font-black text-gray-800">{kpis.totalInsp.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* ══════════ CHARTS SECTION (always visible, collapsible) ══════════ */}
            <div>
              <button onClick={() => setChartsExpanded((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 mb-3 transition-colors print:hidden">
                <BiBarChartAlt2 size={15} className="text-blue-600" />
                Charts & Analytics
                <span className={`ml-1 transition-transform ${chartsExpanded ? "rotate-180" : ""}`}>▲</span>
              </button>

              {chartsExpanded && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                  {/* Defect Bar Chart — spans 2 cols */}
                  <Panel title="Top 10 Models by Defect Count"
                    icon={BiBarChartAlt2}
                    right={<span className="text-[10px] text-gray-400">Critical · Major · Minor</span>}
                    className="xl:col-span-2">
                    <div className="p-4">
                      {defectBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={defectBarData} margin={{ top: 4, right: 16, left: -10, bottom: 55 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} angle={-35} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                            <Bar dataKey="Critical" fill={PALETTE.critical} radius={[3,3,0,0]} maxBarSize={24} />
                            <Bar dataKey="Major"    fill={PALETTE.major}    radius={[3,3,0,0]} maxBarSize={24} />
                            <Bar dataKey="Minor"    fill={PALETTE.minor}    radius={[3,3,0,0]} maxBarSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[240px] flex flex-col items-center justify-center gap-2 text-emerald-600">
                          <HiOutlineBadgeCheck size={32} className="opacity-60" />
                          <span className="text-sm font-semibold">No defects recorded in this period</span>
                        </div>
                      )}
                    </div>
                  </Panel>

                  {/* Right column — 2 pie charts stacked */}
                  <div className="flex flex-col gap-4">
                    <Panel title="Inspection Status" icon={FaShieldAlt}>
                      <div className="p-3">
                        <ResponsiveContainer width="100%" height={140}>
                          <PieChart>
                            <Pie data={statusPie} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
                              paddingAngle={3} dataKey="value">
                              {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v, n]} />
                            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-1 text-xs">
                          <span className="text-emerald-600 font-bold">{kpis.done} Done</span>
                          <span className="text-rose-600 font-bold">{kpis.pending} Pending</span>
                        </div>
                      </div>
                    </Panel>

                    <Panel title="Defect Distribution" icon={HiOutlineExclamationCircle}>
                      <div className="p-3">
                        {defectPie.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={140}>
                              <PieChart>
                                <Pie data={defectPie} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
                                  paddingAngle={3} dataKey="value">
                                  {defectPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Pie>
                                <Tooltip formatter={(v, n) => [v, n]} />
                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-3 mt-1 text-xs">
                              <span className="text-red-600 font-bold">{kpis.totalCritical} C</span>
                              <span className="text-orange-600 font-bold">{kpis.totalMajor} M</span>
                              <span className="text-yellow-600 font-bold">{kpis.totalMinor} m</span>
                            </div>
                          </>
                        ) : (
                          <div className="h-[140px] flex items-center justify-center text-emerald-600 text-xs font-semibold">
                            ✔ No defects recorded
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>

                  {/* Production vs FPA vs Inspected — full width */}
                  <Panel title="Production vs FPA Required vs Inspected (Top 10)"
                    icon={IoMdTrendingUp}
                    right={<span className="text-[10px] text-gray-400">Top 10 by production volume</span>}
                    className="xl:col-span-2">
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={prodVsInspData} margin={{ top: 4, right: 16, left: -10, bottom: 55 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} angle={-35} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                          <Bar dataKey="Production" fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={20} />
                          <Bar dataKey="FPA_Req"    fill="#8b5cf6" radius={[3,3,0,0]} maxBarSize={20} />
                          <Bar dataKey="Inspected"  fill="#10b981" radius={[3,3,0,0]} maxBarSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>

                  {/* FPQI Ranking — right col */}
                  <Panel title="FPQI Ranking (Worst First)" icon={MdOutlineSpeed}
                    right={<span className="text-[10px] text-gray-400">Inspected models only</span>}>
                    <div className="p-4">
                      {fpqiRankData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={fpqiRankData} layout="vertical"
                            margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals />
                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="FPQI" radius={[0,3,3,0]} maxBarSize={18}>
                              {fpqiRankData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[220px] flex items-center justify-center text-gray-400 text-xs">
                          No inspected models yet
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              )}
            </div>

            {/* ══════════ MAIN LAYOUT: Alert Cards + Data Table ══════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">

              {/* ── Left: Alert/Insight cards ── */}
              <div className="xl:col-span-1 flex flex-col gap-4">

                {/* Quality Alert Panel */}
                {worstModels.length > 0 ? (
                  <Panel title="⚠ Quality Alerts" icon={MdWarning}
                    right={<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700`}>{worstModels.length}</span>}>
                    <div className="p-3 space-y-2">
                      <p className="text-[10px] text-gray-400 mb-2">Models with FPQI &gt; 2.000 — needs attention</p>
                      {worstModels.map((m, i) => (
                        <ModelAlertCard key={i} model={m} index={i} />
                      ))}
                    </div>
                  </Panel>
                ) : (
                  <Panel title="Quality Status" icon={HiOutlineBadgeCheck}>
                    <div className="p-6 text-center text-emerald-600">
                      <HiOutlineBadgeCheck size={32} className="mx-auto mb-2 opacity-70" />
                      <p className="text-xs font-bold">All models within acceptable FPQI</p>
                      <p className="text-[10px] text-gray-400 mt-1">Quality is in good shape!</p>
                    </div>
                  </Panel>
                )}

                {/* Quick Stats */}
                <Panel title="Quick Stats" icon={HiOutlineChartBar}>
                  <div className="p-3 space-y-3">
                    {[
                      { label: "Overall Completion",
                        value: `${kpis.total ? Math.round((kpis.done / kpis.total) * 100) : 0}%`,
                        pct: kpis.total ? Math.round((kpis.done / kpis.total) * 100) : 0,
                        barColor: "bg-emerald-500" },
                      { label: "Models with Defects",
                        value: `${rawData.filter((r) => r.Critical + r.Major + r.Minor > 0).length}`,
                        pct: kpis.total ? Math.round((rawData.filter((r) => r.Critical + r.Major + r.Minor > 0).length / kpis.total) * 100) : 0,
                        barColor: "bg-orange-400" },
                      { label: "Poor FPQI (>5)",
                        value: `${rawData.filter((r) => r.FPQI !== null && parseFloat(r.FPQI) > 5).length}`,
                        pct: kpis.total ? Math.round((rawData.filter((r) => r.FPQI !== null && parseFloat(r.FPQI) > 5).length / kpis.total) * 100) : 0,
                        barColor: "bg-red-500" },
                    ].map(({ label, value, pct, barColor }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-gray-500 font-medium">{label}</span>
                          <span className="font-bold text-gray-700">{value}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* ── Right: Data Table ── */}
              <div className="xl:col-span-3">
                <Panel title="FPA Inspection Summary"
                  icon={HiOutlineDocumentReport}
                  right={
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <FaSearch size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search model…" value={searchTerm}
                          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                          className="pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 w-36 bg-gray-50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">Show:</span>
                        <select value={pageSize}
                          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                          className="text-[11px] border border-gray-200 rounded-md px-1.5 py-1 bg-gray-50 focus:outline-none">
                          {PAGE_SIZE_OPTIONS.map((n) => <option key={n}>{n}</option>)}
                        </select>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{fpaData.length}/{rawData.length}</span>
                    </div>
                  }>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-gray-100 text-gray-400 uppercase tracking-widest text-[9px]">
                          <th className="px-3 py-2.5 text-left">#</th>
                          {[
                            { field: "ModelName",       label: "Model Name",  align: "left"   },
                            { field: "ModelCount",       label: "Production",  align: "center" },
                            { field: "FPA",             label: "FPA Req.",    align: "center" },
                            { field: "SampleInspected", label: "Inspected",   align: "center" },
                            { field: null,              label: "Progress",    align: "center" },
                            { field: null,              label: "Status",      align: "center" },
                            { field: "Critical",        label: "C",           align: "center" },
                            { field: "Major",           label: "M",           align: "center" },
                            { field: "Minor",           label: "m",           align: "center" },
                            { field: "FPQI",            label: "FPQI",        align: "center" },
                            { field: null,              label: "Action",      align: "center" },
                          ].map(({ field, label, align }) => (
                            <th key={label}
                              className={`px-3 py-2.5 text-${align} font-bold ${field ? "cursor-pointer hover:text-blue-600 select-none" : ""}`}
                              onClick={() => handleSort(field)}>
                              <span className="inline-flex items-center gap-0.5 justify-center">
                                {label}
                                {field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pagedData.map((item, idx) => {
                          const done  = item.SampleInspected >= item.FPA;
                          const fpqi  = item.FPQI !== null ? parseFloat(item.FPQI) : null;
                          const hasInsp = item.SampleInspected > 0;
                          const st    = fpqiStatus(fpqi);
                          const pct   = item.FPA > 0 ? Math.min(100, Math.round((item.SampleInspected / item.FPA) * 100)) : 0;
                          const globalIdx = (page - 1) * pageSize + idx + 1;

                          return (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                              <td className="px-3 py-2.5 text-gray-300 text-[10px]">{globalIdx}</td>

                              {/* Model Name */}
                              <td className="px-3 py-2.5 max-w-[220px]">
                                <span className="font-semibold text-gray-800 truncate block text-[11px]" title={item.ModelName}>
                                  {item.ModelName}
                                </span>
                              </td>

                              <td className="px-3 py-2.5 text-center font-semibold text-gray-700">{item.ModelCount}</td>
                              <td className="px-3 py-2.5 text-center font-semibold text-gray-700">{item.FPA}</td>
                              <td className="px-3 py-2.5 text-center font-semibold text-gray-700">{item.SampleInspected}</td>

                              {/* Progress Bar */}
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${done ? "bg-emerald-400" : pct > 50 ? "bg-amber-400" : "bg-rose-400"}`}
                                      style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[9px] text-gray-400">{pct}%</span>
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  done ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                  {done ? <FaCheckCircle size={8} /> : <FaTimesCircle size={8} />}
                                  {done ? "Done" : "Pending"}
                                </span>
                              </td>

                              {/* Defects */}
                              <td className="px-3 py-2.5 text-center">
                                <span className={`font-black text-sm ${item.Critical > 0 ? "text-red-600" : "text-gray-200"}`}>
                                  {item.Critical}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`font-black text-sm ${item.Major > 0 ? "text-orange-500" : "text-gray-200"}`}>
                                  {item.Major}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`font-black text-sm ${item.Minor > 0 ? "text-yellow-500" : "text-gray-200"}`}>
                                  {item.Minor}
                                </span>
                              </td>

                              {/* FPQI */}
                              <td className="px-3 py-2.5 text-center">
                                {fpqi !== null ? (
                                  <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-black ${st?.bg} ${st?.text} ${st?.border}`}>
                                    {fpqi.toFixed(3)}
                                  </span>
                                ) : (
                                  <span className="text-gray-200 text-xs">—</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="px-3 py-2.5 text-center">
                                {hasInsp ? (
                                  <button onClick={() => dispatch(openModelModal(item.ModelName))}
                                    className="text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-all">
                                    View <FaArrowRight size={8} />
                                  </button>
                                ) : (
                                  <span className="text-gray-200 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {fpaData.length === 0 && (
                      <div className="p-10 text-center text-gray-400 text-xs">
                        No models match <strong>"{searchTerm}"</strong>
                      </div>
                    )}
                  </div>

                  {/* Table Footer + Pagination */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500">
                    <span>
                      Showing <strong className="text-gray-700">{(page-1)*pageSize+1}–{Math.min(page*pageSize,fpaData.length)}</strong> of <strong className="text-gray-700">{fpaData.length}</strong> models
                    </span>

                    {/* Pagination Controls */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(1)} disabled={page === 1}
                        className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-[10px] font-bold text-gray-600">
                        «
                      </button>
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-gray-600">
                        <FiChevronLeft size={12} />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p = page - 2 + i;
                        p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                        if (p < 1 || p > totalPages) return null;
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className={`w-7 h-7 rounded border text-[10px] font-bold transition-all ${
                              p === page ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 hover:bg-blue-50 text-gray-600"}`}>
                            {p}
                          </button>
                        );
                      })}
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-gray-600">
                        <FiChevronRight size={12} />
                      </button>
                      <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                        className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-blue-50 disabled:opacity-30 text-[10px] font-bold text-gray-600">
                        »
                      </button>
                    </div>

                    <span className="flex items-center gap-4">
                      <span>Production: <strong className="text-gray-700">{kpis.totalProd.toLocaleString()}</strong></span>
                      <span>Inspected: <strong className="text-gray-700">{kpis.totalInsp.toLocaleString()}</strong></span>
                    </span>
                  </div>
                </Panel>
              </div>
            </div>

            {/* ══════════ FPQI WATCHLIST — Full Width ══════════ */}
            <Panel title="FPQI Watchlist — Models Needing Attention"
              icon={MdOutlineSpeed}
              right={
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">FPQI &gt; 2.000</span>
                  {rawData.filter((r) => r.FPQI !== null && parseFloat(r.FPQI) > 2).length > 0 && (
                    <span className="bg-red-100 text-red-700 text-[10px] font-black px-1.5 py-0.5 rounded">
                      {rawData.filter((r) => r.FPQI !== null && parseFloat(r.FPQI) > 2).length} models
                    </span>
                  )}
                </div>
              }>
              {rawData.filter((r) => r.FPQI !== null && parseFloat(r.FPQI) > 2).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-red-50/60 text-red-700 text-left border-b border-red-100 text-[9px] uppercase tracking-widest">
                        <th className="px-4 py-2.5 font-bold">#</th>
                        <th className="px-4 py-2.5 font-bold">Model</th>
                        <th className="px-4 py-2.5 font-bold text-center">Production</th>
                        <th className="px-4 py-2.5 font-bold text-center">Inspected</th>
                        <th className="px-4 py-2.5 font-bold text-center">Critical</th>
                        <th className="px-4 py-2.5 font-bold text-center">Major</th>
                        <th className="px-4 py-2.5 font-bold text-center">Minor</th>
                        <th className="px-4 py-2.5 font-bold text-center">FPQI</th>
                        <th className="px-4 py-2.5 font-bold text-center">Rating</th>
                        <th className="px-4 py-2.5 font-bold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rawData
                        .filter((r) => r.FPQI !== null && parseFloat(r.FPQI) > 2)
                        .sort((a, b) => parseFloat(b.FPQI) - parseFloat(a.FPQI))
                        .map((r, i) => {
                          const st = fpqiStatus(parseFloat(r.FPQI));
                          return (
                            <tr key={i} className="hover:bg-red-50/40 transition-colors">
                              <td className="px-4 py-2.5 text-gray-400 text-[10px]">{i + 1}</td>
                              <td className="px-4 py-2.5 font-semibold text-gray-800 max-w-[280px] truncate">{r.ModelName}</td>
                              <td className="px-4 py-2.5 text-center text-gray-700">{r.ModelCount}</td>
                              <td className="px-4 py-2.5 text-center text-gray-700">{r.SampleInspected}</td>
                              <td className="px-4 py-2.5 text-center text-red-600 font-black">{r.Critical}</td>
                              <td className="px-4 py-2.5 text-center text-orange-600 font-black">{r.Major}</td>
                              <td className="px-4 py-2.5 text-center text-yellow-600 font-black">{r.Minor}</td>
                              <td className="px-4 py-2.5 text-center font-black text-gray-800">{parseFloat(r.FPQI).toFixed(3)}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded border text-[10px] font-black ${st?.bg} ${st?.text} ${st?.border}`}>
                                  {st?.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {r.SampleInspected > 0 && (
                                  <button onClick={() => dispatch(openModelModal(r.ModelName))}
                                    className="text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition-all">
                                    View <FaArrowRight size={8} />
                                  </button>
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
                  <HiOutlineBadgeCheck size={32} className="opacity-60" />
                  <p className="text-sm font-bold">All models have FPQI ≤ 2.000</p>
                  <p className="text-xs text-gray-400">Quality is in good shape!</p>
                </div>
              )}
            </Panel>
          </>
        )}

        {/* ── EMPTY: No data for range ── */}
        {!isLoading && rawData.length === 0 && hasFilters && (
          <div className="bg-white border border-gray-100 rounded-xl p-14 text-center shadow-sm">
            <HiOutlineClipboardList className="text-gray-200 text-6xl mx-auto mb-4" />
            <h3 className="text-base font-bold text-gray-500 mb-1">No Records Found</h3>
            <p className="text-sm text-gray-400">No FPA records found for the selected date range.</p>
          </div>
        )}

        {/* ── EMPTY: No filters applied ── */}
        {!hasFilters && !isLoading && (
          <div className="bg-white border border-gray-100 rounded-xl p-14 text-center shadow-sm">
            <HiOutlineSearch className="text-gray-200 text-6xl mx-auto mb-4" />
            <h3 className="text-base font-bold text-gray-600 mb-2">Select a Date Range to Begin</h3>
            <p className="text-sm text-gray-400 mb-6">Use the date pickers above or click a quick shortcut below.</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {[
                { key: "today",     label: "Today",         icon: FaCalendarAlt },
                { key: "yesterday", label: "Yesterday",     icon: FaCalendarAlt },
                { key: "mtd",       label: "Month to Date", icon: FaCalendarAlt },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => handleQuickFilter(key)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-700 hover:text-white text-blue-700 rounded-xl text-sm font-bold transition-all border border-blue-100">
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {isModelModalOpen && selectedModel && (
        <FpaModelDetailModal modelName={selectedModel} startDate={filters.startDate} endDate={filters.endDate} />
      )}
      {isDefectModalOpen && selectedFGSRNo && <FpaDefectDetailModal />}
    </div>
  );
};

export default FpaHistory;