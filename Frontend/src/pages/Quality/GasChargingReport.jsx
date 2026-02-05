import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

// Components
import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import GasChargingDetailModal from "../../components/GasChargingDetailModal";

// Redux
import {
  useGetGasChargingReportQuery,
  useGetGasChargingSummaryQuery,
  useGetGasChargingFaultsQuery,
  useGetGasChargingModelsQuery,
  useGetGasChargingMachinesQuery,
  useGetGasChargingRefrigerantsQuery,
  useLazyGetGasChargingExportQuery,
} from "../../redux/api/gasChargingApi";

import {
  setGasChargingFilters,
  resetGasChargingFilters,
  setGasChargingSelectedRecord,
  setGasChargingQuickFilter,
  setGasChargingDateRange,
  setGasChargingPage,
  setGasChargingLimit,
  setGasChargingPagination,
} from "../../redux/gasChargingSlice";

// Utils
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";
import { exportToXls } from "../../utils/exportToXls";

// Icons
import {
  FaCheckCircle,
  FaTimesCircle,
  FaChartBar,
  FaTable,
  FaCalendarAlt,
  FaBarcode,
  FaCubes,
  FaDownload,
  FaSync,
  FaRedo,
  FaWeight,
  FaIndustry,
  FaExclamationTriangle,
  FaThermometerHalf,
  FaClock,
  FaSearch,
} from "react-icons/fa";
import { MdFilterAlt, MdOutlineAir } from "react-icons/md";
import { BiSearchAlt, BiTime } from "react-icons/bi";
import { BsLightningChargeFill, BsDropletFill } from "react-icons/bs";
import { TbReportAnalytics, TbGasStation } from "react-icons/tb";
import { IoMdStats } from "react-icons/io";
import { GiGasPump } from "react-icons/gi";
import { HiOutlineDocumentReport } from "react-icons/hi";

// Default state values
const defaultFilters = {
  startDate: "",
  endDate: "",
  model: "",
  performance: "",
  refrigerant: "",
  machine: "",
};

const defaultPagination = {
  page: 1,
  limit: 50,
  totalPages: 1,
  totalRecords: 0,
};

const GasChargingReport = () => {
  const dispatch = useDispatch();

  // Get state with fallbacks
  const gasChargingState = useSelector((state) => state.gasCharging);
  const filters = gasChargingState?.filters || defaultFilters;
  const pagination = gasChargingState?.pagination || defaultPagination;
  const selectedRecord = gasChargingState?.selectedRecord || null;
  const isDetailModalOpen = gasChargingState?.isDetailModalOpen || false;
  const activeQuickFilter = gasChargingState?.activeQuickFilter || null;

  // Local state
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // API Queries
  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
    refetch: refetchReport,
  } = useGetGasChargingReportQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
      performance: filters.performance,
      refrigerant: filters.refrigerant,
      machine: filters.machine,
      page: pagination.page,
      limit: pagination.limit,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: summaryData } = useGetGasChargingSummaryQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
      machine: filters.machine,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: faultData } = useGetGasChargingFaultsQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: modelsData } = useGetGasChargingModelsQuery();
  const { data: machinesData } = useGetGasChargingMachinesQuery();
  const { data: refrigerantsData } = useGetGasChargingRefrigerantsQuery();

  const [triggerExport, { isLoading: exportLoading }] =
    useLazyGetGasChargingExportQuery();

  // Update pagination from API response
  useEffect(() => {
    if (reportData?.pagination) {
      dispatch(
        setGasChargingPagination({
          totalPages: reportData.pagination.totalPages || 1,
          totalRecords: reportData.pagination.totalRecords || 0,
        }),
      );
    }
  }, [reportData, dispatch]);

  // Filter Options
  const performanceOptions = [
    { label: "All Results", value: "" },
    { label: "Pass", value: "PASS" },
    { label: "Fail", value: "FAIL" },
  ];

  const modelOptions = [
    { label: "All Models", value: "" },
    ...(modelsData?.data?.map((m) => ({ label: m, value: m })) || []),
  ];

  const machineOptions = [
    { label: "All Machines", value: "" },
    ...(machinesData?.data?.map((m) => ({ label: m, value: m })) || []),
  ];

  const refrigerantOptions = [
    { label: "All Refrigerants", value: "" },
    ...(refrigerantsData?.data?.map((r) => ({
      label: r.toUpperCase(),
      value: r,
    })) || []),
  ];

  // Handlers
  const handleQuery = () => {
    if (!startTime || !endTime) {
      alert("Please select both start and end date/time");
      return;
    }
    dispatch(
      setGasChargingDateRange({
        startDate: new Date(startTime).toISOString(),
        endDate: new Date(endTime).toISOString(),
      }),
    );
    dispatch(setGasChargingQuickFilter(null));
  };

  const handleQuickFilter = (filterType) => {
    let dateRange;
    switch (filterType) {
      case "today":
        dateRange = getTodayRange();
        break;
      case "yesterday":
        dateRange = getYesterdayRange();
        break;
      case "mtd":
        dateRange = getMTDRange();
        break;
      default:
        return;
    }
    dispatch(setGasChargingDateRange(dateRange));
    dispatch(setGasChargingQuickFilter(filterType));
    setStartTime(formatDateTimeLocal(dateRange.startDate));
    setEndTime(formatDateTimeLocal(dateRange.endDate));
  };

  const handleExport = async () => {
    try {
      const result = await triggerExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
        performance: filters.performance,
        refrigerant: filters.refrigerant,
        machine: filters.machine,
      }).unwrap();

      if (result?.data) {
        exportToXls(result.data, "Gas_Charging_Report.xlsx");
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data");
    }
  };

  const handleRowClick = (record) => {
    dispatch(setGasChargingSelectedRecord(record));
  };

  const handlePageChange = (newPage) => {
    dispatch(setGasChargingPage(newPage));
  };

  const handleLimitChange = (newLimit) => {
    dispatch(setGasChargingLimit(newLimit));
  };

  const handleResetFilters = () => {
    dispatch(resetGasChargingFilters());
    setStartTime("");
    setEndTime("");
  };

  // Components
  const StatusBadge = ({ status, size = "md" }) => {
    const isPass = status === "PASS" || status === "Pass" || status === 1;
    const sizeClasses =
      size === "lg" ? "px-4 py-2 text-base gap-2" : "px-2 py-1 text-xs gap-1";
    const iconSize = size === "lg" ? 18 : 12;

    return (
      <span
        className={`${sizeClasses} rounded-full font-bold inline-flex items-center ${
          isPass
            ? "bg-green-100 text-green-700 border border-green-300"
            : "bg-red-100 text-red-700 border border-red-300"
        }`}
      >
        {isPass ? (
          <FaCheckCircle size={iconSize} />
        ) : (
          <FaTimesCircle size={iconSize} />
        )}
        {isPass ? "PASS" : "FAIL"}
      </span>
    );
  };

  const SummaryCard = ({ icon: Icon, title, value, subValue, bgGradient }) => (
    <div
      className={`${bgGradient} rounded-xl shadow-lg p-5 text-white transform hover:scale-105 transition-transform`}
    >
      <div className="flex items-center gap-4">
        <div className="bg-white/20 p-3 rounded-full">
          <Icon className="text-2xl" />
        </div>
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subValue && <p className="text-xs opacity-70 mt-1">{subValue}</p>}
        </div>
      </div>
    </div>
  );

  const InfoCard = ({ icon: Icon, label, value, color = "gray" }) => (
    <div className="flex flex-col">
      <span
        className={`text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1`}
      >
        <Icon className={`text-${color}-500`} size={12} />
        {label}
      </span>
      <p className="text-lg font-semibold text-gray-800">{value || "-"}</p>
    </div>
  );

  // Data
  const gasChargingData = reportData?.data || [];
  const currentData = gasChargingData[0];
  const totalCount = pagination.totalRecords;
  const summary = summaryData?.data;
  const faults = faultData?.data || [];
  const isLoading = reportLoading || reportFetching;

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="bg-blue-600 p-3 rounded-full">
          <GiGasPump className="text-3xl text-white" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Gas Charging Report Dashboard
        </h1>
      </div>

      {/* Filters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Main Filters */}
        <div className="lg:col-span-7 bg-white border border-blue-200 p-5 rounded-xl shadow-md">
          <h2 className="text-lg font-semibold text-blue-700 mb-4 flex items-center gap-2">
            <BiSearchAlt className="text-xl" />
            Search Filters
          </h2>

          {/* Filter Fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <SelectField
              label="Model"
              options={modelOptions}
              value={filters.model}
              onChange={(e) =>
                dispatch(setGasChargingFilters({ model: e.target.value }))
              }
            />
            <SelectField
              label="Machine"
              options={machineOptions}
              value={filters.machine}
              onChange={(e) =>
                dispatch(setGasChargingFilters({ machine: e.target.value }))
              }
            />
            <SelectField
              label="Result"
              options={performanceOptions}
              value={filters.performance}
              onChange={(e) =>
                dispatch(setGasChargingFilters({ performance: e.target.value }))
              }
            />
            <SelectField
              label="Refrigerant"
              options={refrigerantOptions}
              value={filters.refrigerant}
              onChange={(e) =>
                dispatch(setGasChargingFilters({ refrigerant: e.target.value }))
              }
            />
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DateTimePicker
              label="Start Date/Time"
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <DateTimePicker
              label="End Date/Time"
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="lg:col-span-3 bg-white border border-blue-200 p-5 rounded-xl shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <MdFilterAlt className="text-xl text-blue-500" />
            Actions
          </h2>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={handleQuery}
              bgColor={
                isLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
              }
              textColor="text-white"
              className="flex-1 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <FaSearch />
              {isLoading ? "Loading..." : "Search"}
            </Button>

            <Button
              onClick={() => refetchReport()}
              bgColor="bg-gray-200 hover:bg-gray-300"
              textColor="text-gray-700"
              className="p-2"
              disabled={isLoading}
              title="Refresh"
            >
              <FaSync className={isLoading ? "animate-spin" : ""} />
            </Button>

            <Button
              onClick={handleResetFilters}
              bgColor="bg-orange-100 hover:bg-orange-200"
              textColor="text-orange-700"
              className="p-2"
              title="Reset"
            >
              <FaRedo />
            </Button>
          </div>

          {gasChargingData.length > 0 && (
            <Button
              onClick={handleExport}
              bgColor="bg-green-600 hover:bg-green-700"
              textColor="text-white"
              className="w-full flex items-center justify-center gap-2"
              disabled={exportLoading}
            >
              <FaDownload />
              {exportLoading ? "Exporting..." : "Export Excel"}
            </Button>
          )}

          <div className="mt-4 bg-blue-50 px-4 py-3 rounded-lg text-center">
            <span className="text-sm text-gray-600">Total Records</span>
            <p className="text-3xl font-bold text-blue-700">{totalCount}</p>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="lg:col-span-2 bg-white border border-blue-200 p-5 rounded-xl shadow-md">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BsLightningChargeFill className="text-yellow-500" />
            Quick Filters
          </h2>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => handleQuickFilter("today")}
              bgColor={
                activeQuickFilter === "today"
                  ? "bg-blue-600"
                  : "bg-blue-100 hover:bg-blue-200"
              }
              textColor={
                activeQuickFilter === "today" ? "text-white" : "text-blue-700"
              }
              className="w-full flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <FaCalendarAlt />
              Today
            </Button>

            <Button
              onClick={() => handleQuickFilter("yesterday")}
              bgColor={
                activeQuickFilter === "yesterday"
                  ? "bg-yellow-600"
                  : "bg-yellow-100 hover:bg-yellow-200"
              }
              textColor={
                activeQuickFilter === "yesterday"
                  ? "text-white"
                  : "text-yellow-700"
              }
              className="w-full flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <BiTime />
              Yesterday
            </Button>

            <Button
              onClick={() => handleQuickFilter("mtd")}
              bgColor={
                activeQuickFilter === "mtd"
                  ? "bg-green-600"
                  : "bg-green-100 hover:bg-green-200"
              }
              textColor={
                activeQuickFilter === "mtd" ? "text-white" : "text-green-700"
              }
              className="w-full flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <TbReportAnalytics />
              MTD
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <Loader />}

      {/* Data Display */}
      {!isLoading && gasChargingData.length > 0 && (
        <>
          {/* Current Record Header */}
          {currentData && (
            <div className="bg-white rounded-xl shadow-lg p-5 mb-6 border-l-4 border-blue-500">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-6">
                  <InfoCard
                    icon={HiOutlineDocumentReport}
                    label="Result ID"
                    value={`#${currentData.Result_ID}`}
                    color="blue"
                  />
                  <InfoCard
                    icon={FaCubes}
                    label="Model"
                    value={currentData.MODEL}
                    color="purple"
                  />
                  <InfoCard
                    icon={FaBarcode}
                    label="Barcode"
                    value={currentData.BARCODE}
                    color="gray"
                  />
                  <InfoCard
                    icon={FaCalendarAlt}
                    label="Date & Time"
                    value={`${currentData.DATE} ${currentData.TIME}`}
                    color="green"
                  />
                  <InfoCard
                    icon={FaIndustry}
                    label="Machine"
                    value={currentData.MACHINE}
                    color="cyan"
                  />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <GiGasPump className="text-blue-500" />
                    Latest Result
                  </span>
                  <StatusBadge status={currentData.PERFORMANCE} size="lg" />
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <SummaryCard
                icon={FaChartBar}
                title="Total Tests"
                value={summary.total || totalCount}
                bgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
              />
              <SummaryCard
                icon={FaCheckCircle}
                title="Passed"
                value={summary.pass || 0}
                subValue={`${summary.passRate || 0}% Pass Rate`}
                bgGradient="bg-gradient-to-br from-green-500 to-emerald-600"
              />
              <SummaryCard
                icon={FaTimesCircle}
                title="Failed"
                value={summary.fail || 0}
                subValue={`${summary.failRate || 0}% Fail Rate`}
                bgGradient="bg-gradient-to-br from-red-500 to-rose-600"
              />
              <SummaryCard
                icon={FaWeight}
                title="Avg Gas Weight"
                value={`${summary.avgGasWeight || 0}g`}
                subValue="Actual charged"
                bgGradient="bg-gradient-to-br from-purple-500 to-violet-600"
              />
              <SummaryCard
                icon={BsDropletFill}
                title="Avg Leak Value"
                value={`${summary.avgLeakValue || 0}`}
                subValue="mbar"
                bgGradient="bg-gradient-to-br from-cyan-500 to-teal-600"
              />
            </div>
          )}

          {/* Process Overview Cards */}
          <div className="bg-white rounded-xl shadow-lg p-5 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaChartBar className="text-blue-500" />
              Process Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gas Charging */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-500 p-2 rounded-full">
                    <TbGasStation className="text-white text-xl" />
                  </div>
                  <h3 className="font-bold text-gray-800">Gas Charging</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Set Weight:</span>
                    <span className="font-bold text-blue-600">
                      {summary?.avgSetWeight || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Actual Weight:</span>
                    <span className="font-bold text-green-600">
                      {summary?.avgActualWeight || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leak Test */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-red-500 p-2 rounded-full">
                    <BsDropletFill className="text-white text-xl" />
                  </div>
                  <h3 className="font-bold text-gray-800">Leak Test</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Set Value:</span>
                    <span className="font-bold text-blue-600">
                      {summary?.avgLeakSetValue || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Test Value:</span>
                    <span className="font-bold text-green-600">
                      {summary?.avgLeakTestValue || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Evacuation */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-purple-500 p-2 rounded-full">
                    <MdOutlineAir className="text-white text-xl" />
                  </div>
                  <h3 className="font-bold text-gray-800">Evacuation</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Set Value:</span>
                    <span className="font-bold text-blue-600">
                      {summary?.avgEvacSetValue || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Actual Value:</span>
                    <span className="font-bold text-green-600">
                      {summary?.avgEvacActualValue || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fault Analysis */}
          {faults.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-5 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FaExclamationTriangle className="text-yellow-500" />
                Fault Analysis
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {faults.map((fault, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">
                          Code: {fault.FaultCode}
                        </p>
                        <p className="font-semibold text-gray-800 text-sm">
                          {fault.FaultName}
                        </p>
                      </div>
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-lg font-bold">
                        {fault.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Table Header */}
            <div className="p-5 border-b flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaTable className="text-blue-500" />
                Charging Records
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  Page{" "}
                  <span className="font-bold text-blue-600">
                    {pagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-blue-600">
                    {pagination.totalPages}
                  </span>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  Showing{" "}
                  <span className="font-bold text-blue-600">
                    {gasChargingData.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-blue-600">
                    {pagination.totalRecords}
                  </span>
                </span>
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalRecords > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-b">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalRecords={pagination.totalRecords}
                  limit={pagination.limit}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <HiOutlineDocumentReport />
                        ID
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaCalendarAlt />
                        Date/Time
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaBarcode />
                        Barcode
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaCubes />
                        Model
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaThermometerHalf />
                        Refrigerant
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaWeight />
                        Set Weight
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaWeight />
                        Actual Weight
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <BsDropletFill />
                        Leak Test
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <MdOutlineAir />
                        Evacuation
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaIndustry />
                        Machine
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <GiGasPump />
                        Result
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gasChargingData.map((item, index) => (
                    <tr
                      key={item.Result_ID || index}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(item)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-gray-700">
                        {item.Result_ID}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.DATE}</span>
                          <span className="text-xs text-gray-500">
                            {item.TIME}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-blue-600 font-semibold">
                        {item.BARCODE}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold">{item.MODEL}</span>
                          <span
                            className="text-xs text-gray-500 truncate max-w-[150px]"
                            title={item.MODELNAME}
                          >
                            {item.MODELNAME}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full text-xs font-semibold uppercase">
                          {item.REFRIGERANT}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">
                        {item.SET_GAS_WEIGHT}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-green-600">
                        {item.ACTUAL_GAS_WEIGHT}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-xs">
                          <span>
                            <span className="text-gray-400">Set:</span>{" "}
                            <span className="text-gray-600">
                              {item.LEAK_SET_VALUE}
                            </span>
                          </span>
                          <span>
                            <span className="text-gray-400">Act:</span>{" "}
                            <span className="text-green-600 font-semibold">
                              {item.LEAK_TEST_VALUE}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-xs">
                          <span>
                            <span className="text-gray-400">Set:</span>{" "}
                            <span className="text-gray-600">
                              {item.SET_EVACUATION_VALUE}
                            </span>
                          </span>
                          <span>
                            <span className="text-gray-400">Act:</span>{" "}
                            <span className="text-purple-600 font-semibold">
                              {item.ACTUAL_EVACUATION_VALUE}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
                          {item.MACHINE}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.PERFORMANCE} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty State - No Data */}
      {!isLoading && gasChargingData.length === 0 && filters.startDate && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <GiGasPump className="text-7xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            No Records Found
          </h3>
          <p className="text-gray-500">
            No gas charging records found for the selected filters.
          </p>
          <Button
            onClick={handleResetFilters}
            bgColor="bg-blue-100 hover:bg-blue-200"
            textColor="text-blue-700"
            className="mt-4"
          >
            Reset Filters
          </Button>
        </div>
      )}

      {/* Empty State - No Filters */}
      {!filters.startDate && !filters.endDate && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <BiSearchAlt className="text-7xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Select Date Range
          </h3>
          <p className="text-gray-500 mb-4">
            Please select a date range or use quick filters to view gas charging
            data.
          </p>
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => handleQuickFilter("today")}
              bgColor="bg-blue-500 hover:bg-blue-600"
              textColor="text-white"
            >
              <FaCalendarAlt className="mr-2" />
              View Today's Data
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedRecord && <GasChargingDetailModal />}
    </div>
  );
};

export default GasChargingReport;
