import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExportButton from "../../components/ui/ExportButton";
import Loader from "../../components/ui/Loader";
import Pagination from "../../components/ui/Pagination";
import { baseURL } from "../../assets/assets";
import {
  FaThermometerHalf,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaSearch,
  FaSyncAlt,
  FaBatteryFull,
  FaLightbulb,
  FaArrowUp,
  FaArrowDown,
  FaBarcode,
  FaMapMarkerAlt,
  FaCog,
  FaDatabase,
  FaTimes,
  FaCheck,
  FaCalendarWeek,
  FaHistory,
  FaFilter,
} from "react-icons/fa";
import {
  BsLightningChargeFill,
  BsSpeedometer2,
  BsCalendar2Day,
  BsCalendar2Week,
  BsCalendar2Month,
  BsCalendar3,
  BsThermometerHalf,
} from "react-icons/bs";
import {
  MdElectricBolt,
  MdDateRange,
  MdAccessTime,
  MdToday,
  MdCalendarMonth,
} from "react-icons/md";
import { HiStatusOnline, HiDatabase } from "react-icons/hi";
import { IoSpeedometer, IoCalendarOutline } from "react-icons/io5";
import { RiCalendarEventLine } from "react-icons/ri";
import { TbReportAnalytics, TbCalendarStats } from "react-icons/tb";
import { AiOutlineFieldNumber } from "react-icons/ai";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";

// --- Helpers ------------------------------------------------------------------

// Convert datetime-local value ? "YYYY-MM-DD HH:mm:ss" for the API
const toAPIDateTime = (datetimeLocalValue) => {
  if (!datetimeLocalValue) return "";
  const dt = new Date(datetimeLocalValue);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
};

// Build datetime-local string for ranges NOT in dateUtils (isEndOfDay ? 23:59)
const buildDatetimeLocal = (date, isEndOfDay = false) => {
  const pad = (n) => String(n).padStart(2, "0");
  const h = isEndOfDay ? "23" : "00";
  const m = isEndOfDay ? "59" : "00";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${h}:${m}`;
};

const AREA_LABELS = { 5: "Other", 6: "SUS", 8: "Choc", 9: "VISI Cooler" };

const QuickFilterBtn = ({
  filterType,
  label,
  icon: Icon,
  activeFilter,
  onClick,
  loading,
}) => {
  const isActive = activeFilter === filterType;
  return (
    <button
      onClick={() => onClick(filterType)}
      disabled={loading}
      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 border
        ${
          isActive
            ? "bg-slate-800 text-white border-slate-800 shadow-md scale-105"
            : "bg-white text-gray-600 border-gray-200 hover:border-slate-400 hover:bg-slate-50"
        }
        ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <Icon className={isActive ? "text-white" : "text-gray-400"} />
      {label}
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const isPass = status === "PASS";
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 tracking-wide
      ${isPass ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-100 text-red-700 ring-1 ring-red-200"}`}
    >
      {isPass ? (
        <FaCheck className="w-2.5 h-2.5" />
      ) : (
        <FaTimes className="w-2.5 h-2.5" />
      )}
      {status}
    </span>
  );
};

const MinMaxCell = ({ max, min }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="flex items-center gap-1 text-rose-500 text-xs font-medium">
      <FaArrowUp className="text-[9px]" />
      {max ?? "—"}
    </span>
    <span className="flex items-center gap-1 text-sky-500 text-xs font-medium">
      <FaArrowDown className="text-[9px]" />
      {min ?? "—"}
    </span>
  </div>
);

// --- Main Component -----------------------------------------------------------

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

  const [stats, setStats] = useState({
    avgRuntime: 0,
    avgTemp: 0,
    avgPower: 0,
    passRate: 0,
    faultCount: 0,
    passCount: 0,
  });

  // -- Quick filter date resolver --------------------------------------------
  //
  // Strategy:
  //   today / yesterday / thisMonth  ? use dateUtils (getTodayRange, getYesterdayRange, getMTDRange)
  //                                    then format with the util's formatDateTimeLocal
  //   everything else               ? compute locally with buildDatetimeLocal
  //
  const getQuickFilterDates = (filterType) => {
    const today = new Date();

    switch (filterType) {
      // -- Backed by dateUtils ----------------------------------------------
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
        // getMTDRange ? 1st of current month 00:00 ? today 23:59
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

  // -- Stats -----------------------------------------------------------------
  const calculateStats = (data) => {
    if (!data?.length) {
      setStats({
        avgRuntime: 0,
        avgTemp: 0,
        avgPower: 0,
        passRate: 0,
        faultCount: 0,
        passCount: 0,
      });
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

  // -- Fetch -----------------------------------------------------------------
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

  // -- Event handlers --------------------------------------------------------
  const handleQuickFilter = (filterType) => {
    const dates = getQuickFilterDates(filterType);
    if (!dates) return;
    setStartTime(dates.start);
    setEndTime(dates.end);
    setActiveFilter(filterType);
    fetchDataWithDates(dates.start, dates.end, 1, limit);
  };

  const handleQuery = () => {
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
    setStats({
      avgRuntime: 0,
      avgTemp: 0,
      avgPower: 0,
      passRate: 0,
      faultCount: 0,
      passCount: 0,
    });
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

  // -- Static config ---------------------------------------------------------
  const filterLabels = {
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    lastWeek: "Last Week",
    thisMonth: "This Month",
    lastMonth: "Last Month",
    last7Days: "Last 7 Days",
    last30Days: "Last 30 Days",
    last90Days: "Last 90 Days",
    custom: "Custom Range",
  };

  const quickFilters = [
    { filterType: "today", label: "Today", icon: MdToday },
    { filterType: "yesterday", label: "Yesterday", icon: BsCalendar2Day },
    { filterType: "thisMonth", label: "This Month", icon: MdCalendarMonth },
  ];

  const TABLE_HEADERS = [
    { icon: <AiOutlineFieldNumber className="text-slate-400" />, label: "#" },
    { icon: <FaDatabase className="text-indigo-400" />, label: "Result ID" },
    { icon: <MdAccessTime className="text-blue-400" />, label: "Date / Time" },
    { icon: <FaBarcode className="text-slate-400" />, label: "Barcode" },
    { icon: <FaCog className="text-slate-400" />, label: "Model" },
    { icon: <FaClock className="text-emerald-400" />, label: "Runtime" },
    {
      icon: <FaThermometerHalf className="text-orange-400" />,
      label: "Temp (°C)",
    },
    {
      icon: <MdElectricBolt className="text-blue-400" />,
      label: "Current (A)",
    },
    {
      icon: <FaBatteryFull className="text-yellow-500" />,
      label: "Voltage (V)",
    },
    { icon: <FaLightbulb className="text-amber-400" />, label: "Power (W)" },
    {
      icon: <BsSpeedometer2 className="text-purple-400" />,
      label: "Performance",
    },
    { icon: <HiStatusOnline className="text-emerald-400" />, label: "Status" },
    {
      icon: <FaExclamationTriangle className="text-red-400" />,
      label: "Fault Info",
    },
    { icon: <FaMapMarkerAlt className="text-purple-400" />, label: "Area" },
  ];

  // -- Render ----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-3 rounded-2xl shadow-lg">
            <BsLightningChargeFill className="text-2xl text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              CPT Performance Report
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Cooling Performance Testing
            </p>
          </div>
        </div>
        {totalRecords > 0 && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
            <HiDatabase className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">
              {totalRecords.toLocaleString()} Records
            </span>
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-5">
        {/* Quick Filters */}
        <div className="flex items-center gap-2 mb-3">
          <FaFilter className="text-slate-400 text-sm" />
          <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">
            Quick Filters
          </span>
          {activeFilter && activeFilter !== "custom" && (
            <span className="ml-auto text-xs text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
              <FaCheckCircle /> {filterLabels[activeFilter]}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          {quickFilters.map((f) => (
            <QuickFilterBtn
              key={f.filterType}
              {...f}
              activeFilter={activeFilter}
              onClick={handleQuickFilter}
              loading={loading}
            />
          ))}
        </div>

        {/* Custom Range */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <FaCalendarAlt className="text-slate-400 text-sm" />
            <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">
              Custom Date & Time Range
            </span>
            {activeFilter === "custom" && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                Custom
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
                <MdDateRange className="text-blue-400" /> Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setActiveFilter("custom");
                }}
                className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-xl text-sm focus:border-slate-500 focus:ring-2 focus:ring-slate-100 outline-none transition-all text-slate-700"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
                <MdDateRange className="text-rose-400" /> End Date & Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setActiveFilter("custom");
                }}
                className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-xl text-sm focus:border-slate-500 focus:ring-2 focus:ring-slate-100 outline-none transition-all text-slate-700"
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-3">
              <button
                onClick={handleQuery}
                disabled={loading || !startTime || !endTime}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2
                  ${
                    loading || !startTime || !endTime
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-slate-800 hover:bg-slate-700 shadow-md hover:shadow-lg active:scale-95"
                  }`}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="opacity-25"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>{" "}
                    Loading...
                  </>
                ) : (
                  <>
                    <FaSearch /> Query
                  </>
                )}
              </button>
              <button
                onClick={handleClear}
                className="py-2.5 px-4 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-2 active:scale-95"
              >
                <FaSyncAlt /> Clear
              </button>
              {reportData?.length > 0 && (
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

          {startTime && endTime && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <IoCalendarOutline className="text-slate-400 shrink-0" />
              <span className="font-medium text-slate-600">
                {new Date(startTime).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-slate-400 mx-1">?</span>
              <span className="font-medium text-slate-600">
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
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TbReportAnalytics className="text-slate-500 text-xl" />
            <h2 className="font-bold text-slate-700">Detailed Test Results</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilter && (
              <span className="bg-slate-800 text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                <TbCalendarStats className="text-amber-400" />{" "}
                {filterLabels[activeFilter]}
              </span>
            )}
            {totalRecords > 0 && (
              <>
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-semibold">
                  {totalRecords.toLocaleString()} records
                </span>
                <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                  Page {currentPage}/{totalPages}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {TABLE_HEADERS.map(({ icon, label }, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {icon} {label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.map((item, index) => (
                <tr
                  key={item.Result_ID ?? index}
                  className="hover:bg-blue-50/40 transition-colors duration-100"
                >
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                    {(currentPage - 1) * limit + index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-indigo-600 font-bold text-xs bg-indigo-50 px-2 py-0.5 rounded">
                      #{item.Result_ID}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <FaCalendarAlt className="text-slate-300 text-[9px]" />
                      {item.DATE}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MdAccessTime className="text-slate-300" />
                      {item.TIME}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1 w-fit">
                      <FaBarcode className="text-slate-400 text-[9px]" />
                      {item.BARCODE}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800 text-xs">
                      {item.MODEL}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {item.MODELNAME}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                      <FaClock className="text-emerald-400 text-[9px]" />
                      {item.RUNTIME_MINUTES}m
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MinMaxCell
                      max={item.MAX_TEMPERATURE}
                      min={item.MIN_TEMPERATURE}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MinMaxCell max={item.MAX_CURRENT} min={item.MIN_CURRENT} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MinMaxCell max={item.MAX_VOLTAGE} min={item.MIN_VOLTAGE} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MinMaxCell max={item.MAX_POWER} min={item.MIN_POWER} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-xs text-slate-600 flex items-center justify-center gap-1">
                      <IoSpeedometer className="text-purple-400" />
                      {item.PERFORMANCE}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={item.PERFORMANCE} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-500 text-xs mt-0.5">
                      {item.FaultName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 w-fit">
                      <FaMapMarkerAlt className="text-[9px]" />
                      {AREA_LABELS[item.AREA_ID] ?? `Area ${item.AREA_ID}`}
                    </span>
                  </td>
                </tr>
              ))}

              {!loading && reportData.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-slate-100 p-6 rounded-3xl">
                        <TbReportAnalytics className="text-5xl text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-semibold">
                        No data available
                      </p>
                      <p className="text-slate-400 text-sm">
                        Use quick filters or set a custom date & time range
                      </p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleQuickFilter("today")}
                          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <MdToday /> Today's Data
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader />
            </div>
          )}
        </div>

        {totalRecords > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalRecords}
            limit={limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            isLoading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default CPTReport;
