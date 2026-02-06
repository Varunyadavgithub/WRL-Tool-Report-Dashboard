import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExportButton from "../../components/ui/ExportButton";
import Loader from "../../components/ui/Loader";
import Pagination from "../../components/ui/Pagination";
import { baseURL } from "../../assets/assets";

// React Icons imports
import {
  FaBolt,
  FaChartBar,
  FaThermometerHalf,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaSearch,
  FaSyncAlt,
  FaClipboardList,
  FaChartPie,
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
  FaCalendarDay,
  FaCalendarWeek,
  FaHistory,
} from "react-icons/fa";
import {
  BsLightningChargeFill,
  BsThermometerHigh,
  BsSpeedometer2,
  BsClockHistory,
  BsCalendar2Day,
  BsCalendar2Week,
  BsCalendar2Month,
  BsCalendar3,
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
import { RiDashboardFill, RiCalendarEventLine } from "react-icons/ri";
import { TbReportAnalytics, TbCalendarStats } from "react-icons/tb";
import { GiPowerLightning } from "react-icons/gi";
import { AiOutlineFieldNumber, AiFillThunderbolt } from "react-icons/ai";
import { BiTargetLock } from "react-icons/bi";

const CPTReport = () => {
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reportData, setReportData] = useState([]);
  const [activeFilter, setActiveFilter] = useState("");

  // Pagination states
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
  });

  // Helper function to format date to YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Quick filter functions
  const getQuickFilterDates = (filterType) => {
    const today = new Date();
    let start, end;

    switch (filterType) {
      case "today":
        start = new Date(today);
        end = new Date(today);
        break;

      case "yesterday":
        start = new Date(today);
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        break;

      case "thisWeek":
        start = new Date(today);
        const dayOfWeek = start.getDay();
        const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
        start.setDate(diff);
        end = new Date(today);
        break;

      case "lastWeek":
        start = new Date(today);
        const currentDayOfWeek = start.getDay();
        const diffToLastMonday =
          start.getDate() -
          currentDayOfWeek -
          6 +
          (currentDayOfWeek === 0 ? -7 : 0);
        start.setDate(diffToLastMonday);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        break;

      case "thisMonth":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today);
        break;

      case "lastMonth":
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;

      case "last7Days":
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        end = new Date(today);
        break;

      case "last30Days":
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        end = new Date(today);
        break;

      case "last90Days":
        start = new Date(today);
        start.setDate(start.getDate() - 89);
        end = new Date(today);
        break;

      default:
        return null;
    }

    return {
      start: formatDate(start),
      end: formatDate(end),
    };
  };

  const handleQuickFilter = (filterType) => {
    const dates = getQuickFilterDates(filterType);
    if (dates) {
      setStartTime(dates.start);
      setEndTime(dates.end);
      setActiveFilter(filterType);
      // Auto-query when quick filter is selected
      fetchDataWithDates(dates.start, dates.end, 1, limit);
    }
  };

  const calculateStats = (data) => {
    if (!data || data.length === 0) {
      setStats({
        avgRuntime: 0,
        avgTemp: 0,
        avgPower: 0,
        passRate: 0,
        faultCount: 0,
      });
      return;
    }

    const avgRuntime =
      data.reduce(
        (acc, item) => acc + (parseFloat(item.RUNTIME_MINUTES) || 0),
        0,
      ) / data.length;
    const avgTemp =
      data.reduce(
        (acc, item) =>
          acc +
          ((parseFloat(item.MAX_TEMPERATURE) || 0) +
            (parseFloat(item.MIN_TEMPERATURE) || 0)) /
            2,
        0,
      ) / data.length;
    const avgPower =
      data.reduce(
        (acc, item) =>
          acc +
          ((parseFloat(item.MAX_POWER) || 0) +
            (parseFloat(item.MIN_POWER) || 0)) /
            2,
        0,
      ) / data.length;
    const passCount = data.filter((item) => item.PERFORMANCE === "PASS").length;
    const passRate = (passCount / data.length) * 100;
    const faultCount = data.filter(
      (item) => item.PERFORMANCE === "FAIL",
    ).length;

    setStats({
      avgRuntime: avgRuntime.toFixed(2),
      avgTemp: avgTemp.toFixed(2),
      avgPower: avgPower.toFixed(2),
      passRate: passRate.toFixed(1),
      faultCount,
    });
  };

  const fetchDataWithDates = async (
    start,
    end,
    page = 1,
    pageLimit = limit,
  ) => {
    if (!start || !end) {
      toast.error("Please select Time Range.");
      return;
    }
    setLoading(true);
    try {
      const formattedStartDate = new Date(start).toISOString().split("T")[0];
      const formattedEndDate = new Date(end).toISOString().split("T")[0];

      const params = {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        page,
        limit: pageLimit,
      };

      const res = await axios.get(`${baseURL}quality/cpt-report`, {
        params,
      });

      if (res?.data?.success) {
        setReportData(res?.data?.data);
        setCurrentPage(res?.data?.pagination?.currentPage || 1);
        setTotalPages(res?.data?.pagination?.totalPages || 0);
        setTotalRecords(res?.data?.pagination?.totalRecords || 0);
        calculateStats(res?.data?.data);
      }
    } catch (error) {
      console.error("Failed to fetch CPT Report:", error);
      toast.error("Failed to fetch CPT Report.");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (page = 1, pageLimit = limit) => {
    fetchDataWithDates(startTime, endTime, page, pageLimit);
  };

  const handleQuery = () => {
    setCurrentPage(1);
    setActiveFilter("custom");
    fetchData(1, limit);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchData(page, limit);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setCurrentPage(1);
    fetchData(1, newLimit);
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
    });
  };

  // Handle manual date change - clear active filter
  const handleStartDateChange = (e) => {
    setStartTime(e.target.value);
    setActiveFilter("custom");
  };

  const handleEndDateChange = (e) => {
    setEndTime(e.target.value);
    setActiveFilter("custom");
  };

  // Export all data (without pagination)
  const handleExportAll = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    setExportLoading(true);
    try {
      const formattedStartDate = new Date(startTime)
        .toISOString()
        .split("T")[0];
      const formattedEndDate = new Date(endTime).toISOString().split("T")[0];

      const params = {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        page: 1,
        limit: 100000,
      };

      const res = await axios.get(`${baseURL}quality/cpt-report`, {
        params,
      });

      if (res?.data?.success && res?.data?.data?.length > 0) {
        return res.data.data;
      }
      return [];
    } catch (error) {
      console.error("Failed to export CPT Report:", error);
      toast.error("Failed to export CPT Report.");
      return [];
    } finally {
      setExportLoading(false);
    }
  };

  // Quick Filter Button Component
  const QuickFilterButton = ({ filterType, label, icon: Icon, color }) => {
    const isActive = activeFilter === filterType;
    return (
      <button
        onClick={() => handleQuickFilter(filterType)}
        disabled={loading}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 border ${
          isActive
            ? `${color} text-white shadow-lg scale-105`
            : `bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50`
        } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <Icon className={isActive ? "text-white" : "text-gray-500"} />
        {label}
      </button>
    );
  };

  // Status indicator component
  const StatusBadge = ({ status }) => {
    const isPass = status === "PASS";
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
          isPass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {isPass ? (
          <FaCheck className="w-3 h-3" />
        ) : (
          <FaTimes className="w-3 h-3" />
        )}
        {status}
      </span>
    );
  };

  // Stat Card Component
  const StatCard = ({
    title,
    value,
    unit,
    icon: Icon,
    color,
    bgColor,
    iconBg,
  }) => (
    <div
      className={`${bgColor} rounded-xl p-4 shadow-lg border-l-4 ${color} transform hover:scale-105 transition-all duration-300`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800">
            {value}
            <span className="text-sm font-normal text-gray-500 ml-1">
              {unit}
            </span>
          </p>
        </div>
        <div className={`p-3 rounded-full ${iconBg}`}>
          <Icon className={`text-2xl ${color.replace("border-", "text-")}`} />
        </div>
      </div>
    </div>
  );

  // Get filter label for display
  const getFilterLabel = () => {
    const labels = {
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
    return labels[activeFilter] || "";
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="bg-white/20 p-3 rounded-xl">
                <BsLightningChargeFill className="text-2xl" />
              </span>
              CPT Performance Report
            </h1>
            <p className="text-indigo-100 mt-2 flex items-center gap-2">
              <RiDashboardFill className="text-lg" />
              Comprehensive Power Testing & Analysis Dashboard
            </p>
          </div>
          <div className="text-right text-white">
            <p className="text-sm opacity-75 flex items-center gap-1 justify-end">
              <MdDateRange />
              Report Generated
            </p>
            <p className="font-semibold">{new Date().toLocaleDateString()}</p>
            {activeFilter && (
              <p className="text-xs mt-1 bg-white/20 px-2 py-1 rounded-full inline-flex items-center gap-1">
                <TbCalendarStats />
                {getFilterLabel()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Filters Section */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-purple-100 text-purple-600 p-2 rounded-lg">
            <TbCalendarStats className="text-xl" />
          </span>
          <h2 className="text-lg font-semibold text-gray-800">Quick Filters</h2>
          {activeFilter && activeFilter !== "custom" && (
            <span className="ml-auto text-sm text-gray-500 flex items-center gap-1">
              <FaCheckCircle className="text-green-500" />
              Active: {getFilterLabel()}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickFilterButton
            filterType="today"
            label="Today"
            icon={MdToday}
            color="bg-gradient-to-r from-blue-500 to-blue-600"
          />
          <QuickFilterButton
            filterType="yesterday"
            label="Yesterday"
            icon={BsCalendar2Day}
            color="bg-gradient-to-r from-indigo-500 to-indigo-600"
          />
          <QuickFilterButton
            filterType="thisWeek"
            label="This Week"
            icon={BsCalendar2Week}
            color="bg-gradient-to-r from-purple-500 to-purple-600"
          />
          <QuickFilterButton
            filterType="lastWeek"
            label="Last Week"
            icon={FaCalendarWeek}
            color="bg-gradient-to-r from-violet-500 to-violet-600"
          />
          <QuickFilterButton
            filterType="thisMonth"
            label="This Month"
            icon={MdCalendarMonth}
            color="bg-gradient-to-r from-pink-500 to-pink-600"
          />
          <QuickFilterButton
            filterType="lastMonth"
            label="Last Month"
            icon={BsCalendar2Month}
            color="bg-gradient-to-r from-rose-500 to-rose-600"
          />

          <div className="w-px bg-gray-300 mx-2 hidden md:block" />

          <QuickFilterButton
            filterType="last7Days"
            label="Last 7 Days"
            icon={BsCalendar3}
            color="bg-gradient-to-r from-teal-500 to-teal-600"
          />
          <QuickFilterButton
            filterType="last30Days"
            label="Last 30 Days"
            icon={RiCalendarEventLine}
            color="bg-gradient-to-r from-cyan-500 to-cyan-600"
          />
          <QuickFilterButton
            filterType="last90Days"
            label="Last 90 Days"
            icon={FaHistory}
            color="bg-gradient-to-r from-emerald-500 to-emerald-600"
          />
        </div>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Date Range Card */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
              <FaCalendarAlt className="text-xl" />
            </span>
            <h2 className="text-lg font-semibold text-gray-800">
              Custom Date Range
            </h2>
            {activeFilter === "custom" && (
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">
                Custom
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-700 text-sm flex items-center gap-2">
                <MdDateRange className="text-indigo-500" />
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={startTime}
                onChange={handleStartDateChange}
                className="border-2 border-gray-200 px-4 py-3 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-gray-700 text-sm flex items-center gap-2">
                <MdDateRange className="text-indigo-500" />
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={endTime}
                onChange={handleEndDateChange}
                className="border-2 border-gray-200 px-4 py-3 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
              />
            </div>
          </div>

          {/* Selected Date Range Display */}
          {startTime && endTime && (
            <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-indigo-700 flex items-center gap-2">
                <IoCalendarOutline className="text-lg" />
                <span className="font-medium">Selected Range:</span>
                {new Date(startTime).toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                <span className="mx-2">→</span>
                {new Date(endTime).toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        {/* Actions Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-green-100 text-green-600 p-2 rounded-lg">
              <BiTargetLock className="text-xl" />
            </span>
            <h2 className="text-lg font-semibold text-gray-800">Actions</h2>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleQuery}
              disabled={loading || !startTime || !endTime}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 ${
                loading || !startTime || !endTime
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg hover:shadow-xl"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <FaSearch /> Query Data
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              className="w-full py-3 px-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <FaSyncAlt /> Clear All
            </button>
            {reportData && reportData.length > 0 && (
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
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Total Records"
          value={totalRecords}
          unit="units"
          icon={FaChartBar}
          color="border-blue-500"
          bgColor="bg-white"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Avg Runtime"
          value={stats.avgRuntime}
          unit="min"
          icon={BsClockHistory}
          color="border-green-500"
          bgColor="bg-white"
          iconBg="bg-green-100"
        />
        <StatCard
          title="Avg Temperature"
          value={stats.avgTemp}
          unit="°C"
          icon={FaThermometerHalf}
          color="border-orange-500"
          bgColor="bg-white"
          iconBg="bg-orange-100"
        />
        <StatCard
          title="Avg Power"
          value={stats.avgPower}
          unit="W"
          icon={AiFillThunderbolt}
          color="border-yellow-500"
          bgColor="bg-white"
          iconBg="bg-yellow-100"
        />
        <StatCard
          title="Pass Rate"
          value={stats.passRate}
          unit="%"
          icon={FaCheckCircle}
          color="border-emerald-500"
          bgColor="bg-white"
          iconBg="bg-emerald-100"
        />
        <StatCard
          title="Fault Count"
          value={stats.faultCount}
          unit="units"
          icon={FaExclamationTriangle}
          color="border-red-500"
          bgColor="bg-white"
          iconBg="bg-red-100"
        />
      </div>

      {/* Performance Gauge Section */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Temperature Gauge */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-orange-100 p-2 rounded-lg text-orange-500">
                <BsThermometerHigh className="text-xl" />
              </span>
              Temperature Range
            </h3>
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  <FaArrowDown /> Min
                </span>
                <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                  <FaArrowUp /> Max
                </span>
              </div>
              <div className="overflow-hidden h-4 text-xs flex rounded-full bg-gradient-to-r from-blue-200 via-green-200 to-red-200">
                <div
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-red-500"
                  style={{ width: "70%" }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <FaThermometerHalf className="text-orange-500" />
                  {stats.avgTemp}°C Avg
                </span>
              </div>
            </div>
          </div>

          {/* Power Consumption */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-yellow-100 p-2 rounded-lg text-yellow-500">
                <GiPowerLightning className="text-xl" />
              </span>
              Power Consumption
            </h3>
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    className="text-gray-200"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                  <circle
                    className="text-yellow-500"
                    strokeWidth="10"
                    strokeDasharray={`${stats.passRate * 2.51} 251`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <FaBolt className="text-yellow-500 text-xl mb-1" />
                  <span className="text-xl font-bold text-gray-800">
                    {stats.avgPower}W
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pass/Fail Ratio */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-indigo-100 p-2 rounded-lg text-indigo-500">
                <FaChartPie className="text-xl" />
              </span>
              Pass/Fail Ratio
            </h3>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2 relative">
                  <FaCheckCircle className="absolute -top-1 -right-1 text-green-500 text-lg" />
                  <span className="text-2xl font-bold text-green-600">
                    {
                      reportData.filter((item) => item.PERFORMANCE === "PASS")
                        .length
                    }
                  </span>
                </div>
                <span className="text-sm text-gray-600 font-medium">Pass</span>
              </div>
              <div className="text-3xl text-gray-300">/</div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2 relative">
                  <FaExclamationTriangle className="absolute -top-1 -right-1 text-red-500 text-lg" />
                  <span className="text-2xl font-bold text-red-600">
                    {stats.faultCount}
                  </span>
                </div>
                <span className="text-sm text-gray-600 font-medium">Fail</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FaClipboardList />
              Detailed Test Results
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              {activeFilter && (
                <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                  <TbCalendarStats />
                  {getFilterLabel()}
                </span>
              )}
              <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                <HiDatabase />
                {totalRecords} Total Records
              </span>
              {totalRecords > 0 && (
                <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-sm">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                  <div className="flex items-center gap-1">
                    <AiOutlineFieldNumber className="text-gray-500" />#
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                  <div className="flex items-center gap-1">
                    <FaDatabase className="text-indigo-500" />
                    Result ID
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                  <div className="flex items-center gap-1">
                    <MdAccessTime className="text-blue-500" />
                    Date/Time
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                  <div className="flex items-center gap-1">
                    <FaBarcode className="text-gray-500" />
                    Barcode
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                  <div className="flex items-center gap-1">
                    <FaCog className="text-gray-500" />
                    Model
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                  <div className="flex items-center justify-center gap-1">
                    <FaClock className="text-green-500" />
                    Runtime
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                  <div className="flex items-center justify-center gap-1">
                    <FaThermometerHalf className="text-orange-500" />
                    Temp (°C)
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                  <div className="flex items-center justify-center gap-1">
                    <MdElectricBolt className="text-blue-500" />
                    Current (A)
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                  <div className="flex items-center justify-center gap-1">
                    <FaBatteryFull className="text-yellow-500" />
                    Voltage (V)
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                  <div className="flex items-center justify-center gap-1">
                    <FaLightbulb className="text-amber-500" />
                    Power (W)
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                  <div className="flex items-center justify-center gap-1">
                    <BsSpeedometer2 className="text-purple-500" />
                    Performance
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border-b">
                  <div className="flex items-center justify-center gap-1">
                    <HiStatusOnline className="text-green-500" />
                    Status
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                  <div className="flex items-center gap-1">
                    <FaExclamationTriangle className="text-red-500" />
                    Fault Info
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b">
                  <div className="flex items-center gap-1">
                    <FaMapMarkerAlt className="text-purple-500" />
                    Area
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.map((item, index) => (
                <tr
                  key={item.Result_ID || index}
                  className="hover:bg-indigo-50 transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-gray-600">
                    {(currentPage - 1) * limit + index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-indigo-600 font-medium">
                      {item.Result_ID}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800 flex items-center gap-1">
                      <FaCalendarAlt className="text-gray-400 text-xs" />
                      {item.DATE}
                    </div>
                    <div className="text-gray-500 text-xs flex items-center gap-1">
                      <MdAccessTime className="text-gray-400" />
                      {item.TIME}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 px-2 py-1 rounded font-mono text-xs flex items-center gap-1 w-fit">
                      <FaBarcode className="text-gray-400" />
                      {item.BARCODE}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">
                      {item.MODEL}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {item.MODELNAME}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                      <FaClock className="text-blue-500" />
                      {item.RUNTIME_MINUTES}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center justify-center gap-1 text-red-500">
                        <FaArrowUp /> {item.MAX_TEMPERATURE}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-blue-500">
                        <FaArrowDown /> {item.MIN_TEMPERATURE}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center justify-center gap-1 text-red-500">
                        <FaArrowUp /> {item.MAX_CURRENT}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-blue-500">
                        <FaArrowDown /> {item.MIN_CURRENT}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center justify-center gap-1 text-red-500">
                        <FaArrowUp /> {item.MAX_VOLTAGE}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-blue-500">
                        <FaArrowDown /> {item.MIN_VOLTAGE}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-xs space-y-1">
                      <div className="flex items-center justify-center gap-1 text-red-500">
                        <FaArrowUp /> {item.MAX_POWER}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-blue-500">
                        <FaArrowDown /> {item.MIN_POWER}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-gray-800 flex items-center justify-center gap-1">
                      <IoSpeedometer className="text-purple-500" />
                      {item.PERFORMANCE}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={item.PERFORMANCE} />
                  </td>
                  <td className="px-4 py-3">
                    {item.FaultCode &&
                    item.FaultCode !== "0" &&
                    item.FaultCode !== "" ? (
                      <div>
                        <span className="text-red-600 font-mono text-xs flex items-center gap-1">
                          <FaExclamationTriangle />#{item.FaultCode}
                        </span>
                        <div className="text-gray-500 text-xs">
                          {item.FaultName}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1">
                        <FaCheckCircle className="text-green-400" />-
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs inline-flex items-center gap-1">
                      <FaMapMarkerAlt />
                      {item.AREA_ID}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && reportData.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-gray-100 p-6 rounded-full">
                        <TbReportAnalytics className="text-6xl text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">
                        No data found
                      </p>
                      <p className="text-gray-400 text-sm flex items-center gap-2">
                        <FaCalendarAlt />
                        Use quick filters or select a date range to view results
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleQuickFilter("today")}
                          className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors flex items-center gap-2"
                        >
                          <MdToday /> View Today's Data
                        </button>
                        <button
                          onClick={() => handleQuickFilter("thisWeek")}
                          className="px-4 py-2 bg-purple-100 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors flex items-center gap-2"
                        >
                          <BsCalendar2Week /> View This Week
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader />
            </div>
          )}
        </div>

        {/* Pagination Component */}
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
