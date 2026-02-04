import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";

// Redux
import {
  useGetEstReportQuery,
  useGetEstReportSummaryQuery,
  useGetDistinctModelsQuery,
  useGetDistinctOperatorsQuery,
  useLazyGetEstReportQuickFilterQuery,
  useLazyGetExportDataQuery,
} from "../../redux/api/estReportApi";
import {
  setFilters,
  resetFilters,
  setSelectedRecord,
  setActiveQuickFilter,
  setDateRange,
} from "../../redux/estReportSlice";

// Utils
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";
import { exportToXls } from "../../utils/exportToXls.js";

// React Icons
import {
  FaBolt,
  FaShieldAlt,
  FaTint,
  FaBatteryFull,
  FaCheckCircle,
  FaTimesCircle,
  FaPlug,
  FaChartBar,
  FaTable,
  FaUser,
  FaCalendarAlt,
  FaBarcode,
  FaCubes,
  FaDownload,
  FaSync,
} from "react-icons/fa";
import {
  MdElectricalServices,
  MdOutlineSpeed,
  MdFilterAlt,
} from "react-icons/md";
import { HiLightningBolt, HiOutlineDocumentReport } from "react-icons/hi";
import { BiSearchAlt, BiTime } from "react-icons/bi";
import { BsLightningChargeFill, BsSpeedometer2 } from "react-icons/bs";
import { RiFlashlightFill } from "react-icons/ri";
import { TbWaveSine, TbReportAnalytics } from "react-icons/tb";
import { IoMdStats } from "react-icons/io";
import { GiElectric } from "react-icons/gi";
import { AiOutlineThunderbolt, AiFillThunderbolt } from "react-icons/ai";
import { VscCircuitBoard } from "react-icons/vsc";

// Detail Modal Component
import ESTDetailModal from "../../components/ESTDetailModal";

const ESTReport = () => {
  const dispatch = useDispatch();

  // Redux state
  const { filters, selectedRecord, isDetailModalOpen, activeQuickFilter } =
    useSelector((state) => state.estReport);

  // Local state for date inputs
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [shouldFetch, setShouldFetch] = useState(false);

  // RTK Query hooks
  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
    refetch: refetchReport,
  } = useGetEstReportQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
      operator: filters.operator,
      result: filters.result,
      testType: filters.testType,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: summaryData, isLoading: summaryLoading } =
    useGetEstReportSummaryQuery(
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
      },
      { skip: !filters.startDate || !filters.endDate },
    );

  const { data: modelsData } = useGetDistinctModelsQuery();
  const { data: operatorsData } = useGetDistinctOperatorsQuery();

  // Lazy queries for quick filters
  const [triggerQuickFilter, { isLoading: quickFilterLoading }] =
    useLazyGetEstReportQuickFilterQuery();

  const [triggerExport, { isLoading: exportLoading }] =
    useLazyGetExportDataQuery();

  // Test type options
  const testTypeOptions = [
    { label: "All Tests", value: "all" },
    { label: "ECT Test", value: "ect" },
    { label: "HV Test", value: "hv" },
    { label: "IR Test", value: "ir" },
    { label: "LCT Test", value: "lct" },
  ];

  // Result options
  const resultOptions = [
    { label: "All Results", value: "" },
    { label: "Pass", value: "Pass" },
    { label: "Fail", value: "Fail" },
  ];

  // Models options from API
  const modelOptions = [
    { label: "All Models", value: "" },
    ...(modelsData?.data || []),
  ];

  // Operators options from API
  const operatorOptions = [
    { label: "All Operators", value: "" },
    ...(operatorsData?.data || []),
  ];

  // Handle Query button click
  const handleQuery = () => {
    if (!startTime || !endTime) {
      alert("Please select both start and end date/time");
      return;
    }
    dispatch(
      setDateRange({
        startDate: new Date(startTime).toISOString(),
        endDate: new Date(endTime).toISOString(),
      }),
    );
    dispatch(setActiveQuickFilter(null));
  };

  // Handle Quick Filter clicks
  const handleQuickFilter = async (filterType) => {
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

    dispatch(setDateRange(dateRange));
    dispatch(setActiveQuickFilter(filterType));

    // Update local date inputs
    setStartTime(formatDateTimeLocal(dateRange.startDate));
    setEndTime(formatDateTimeLocal(dateRange.endDate));
  };

  // Handle Export
  const handleExport = async () => {
    try {
      const result = await triggerExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
        operator: filters.operator,
        result: filters.result,
      }).unwrap();

      if (result?.data) {
        exportToXls(result.data, "EST_Report.xlsx");
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data");
    }
  };

  // Handle row click
  const handleRowClick = (record) => {
    dispatch(setSelectedRecord(record));
  };

  // Status Badge Component
  const StatusBadge = ({ status, size = "md" }) => {
    const isPass = status === "Pass" || status === 1;
    const sizeClasses =
      size === "lg" ? "px-4 py-2 text-lg gap-2" : "px-2 py-1 text-xs gap-1";
    const iconSize = size === "lg" ? 20 : 12;

    return (
      <span
        className={`${sizeClasses} rounded-full font-bold flex items-center ${
          isPass
            ? "bg-green-100 text-green-700 border border-green-400"
            : "bg-red-100 text-red-700 border border-red-400"
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

  // Gauge Component
  const GaugeIndicator = ({ value, max, label, color = "blue" }) => {
    const numValue = parseFloat(value) || 0;
    const numMax = parseFloat(max) || 100;
    const percentage = Math.min((numValue / numMax) * 100, 100);

    const colorMap = {
      blue: "#3b82f6",
      green: "#22c55e",
      yellow: "#eab308",
      purple: "#a855f7",
      cyan: "#06b6d4",
      orange: "#f97316",
    };

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="32"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="40"
              cy="40"
              r="32"
              stroke={colorMap[color]}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${percentage * 2.01} 201`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-700">
              {value || "N/A"}
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-500 mt-1">{label}</span>
      </div>
    );
  };

  // Test Card Component
  const TestCard = ({
    title,
    icon: Icon,
    status,
    children,
    color = "blue",
  }) => {
    const isPass = status === "Pass";
    const borderColor = isPass ? "border-green-400" : "border-red-400";
    const headerBg = isPass ? "bg-green-50" : "bg-red-50";

    const iconColorMap = {
      blue: "text-blue-500",
      green: "text-green-500",
      yellow: "text-yellow-500",
      purple: "text-purple-500",
      orange: "text-orange-500",
      cyan: "text-cyan-500",
    };

    return (
      <div
        className={`bg-white rounded-xl border-2 ${borderColor} shadow-lg overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1`}
      >
        <div
          className={`${headerBg} px-4 py-3 flex items-center justify-between border-b`}
        >
          <div className="flex items-center gap-2">
            <Icon className={`text-2xl ${iconColorMap[color]}`} />
            <h3 className="font-bold text-gray-800">{title}</h3>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="p-4">{children}</div>
      </div>
    );
  };

  // Parameter Row Component
  const ParamRow = ({ label, setValue, readValue, icon: Icon }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="text-gray-400" size={14} />}
        <span className="text-sm text-gray-600 font-medium">{label}</span>
      </div>
      <div className="flex gap-4">
        <div className="text-center">
          <span className="text-xs text-gray-400 block">Set</span>
          <span className="text-sm font-semibold text-blue-600">
            {setValue || "N/A"}
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs text-gray-400 block">Read</span>
          <span className="text-sm font-semibold text-green-600">
            {readValue || "N/A"}
          </span>
        </div>
      </div>
    </div>
  );

  // Info Card Component
  const InfoCard = ({ icon: Icon, label, value, color = "gray" }) => {
    const colorMap = {
      gray: "text-gray-500",
      blue: "text-blue-500",
      purple: "text-purple-500",
      green: "text-green-500",
    };

    return (
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <Icon className={colorMap[color]} size={12} />
          {label}
        </span>
        <p className="text-lg font-semibold text-gray-800">{value}</p>
      </div>
    );
  };

  // Test configurations for overview
  const testConfigs = [
    {
      name: "ECT",
      icon: FaPlug,
      color: "blue",
      bgColor: "bg-blue-500",
    },
    {
      name: "HV",
      icon: HiLightningBolt,
      color: "yellow",
      bgColor: "bg-yellow-500",
    },
    {
      name: "IR",
      icon: FaShieldAlt,
      color: "purple",
      bgColor: "bg-purple-500",
    },
    {
      name: "LCT",
      icon: FaTint,
      color: "cyan",
      bgColor: "bg-cyan-500",
    },
    {
      name: "Wattage",
      icon: FaBatteryFull,
      color: "green",
      bgColor: "bg-green-500",
    },
  ];

  const estData = reportData?.data || [];
  const currentData = estData[0];
  const totalCount = reportData?.pagination?.totalRecords || estData.length;
  const summary = summaryData?.data;

  const isLoading = reportLoading || reportFetching;

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <GiElectric className="text-4xl text-purple-600" />
        <Title title="EST Report Dashboard" align="center" />
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap gap-4 items-start mb-6">
        {/* Box 1: Main Filters */}
        <div className="bg-white border border-purple-200 p-6 rounded-xl shadow-md flex-1 min-w-[400px]">
          <h2 className="text-lg font-semibold text-purple-700 mb-4 flex items-center gap-2">
            <BiSearchAlt className="text-xl" />
            Search Filters
          </h2>
          <div className="flex flex-wrap gap-4">
            {/* Test Type */}
            <div className="flex items-center gap-2">
              <MdFilterAlt className="text-purple-500" />
              <SelectField
                label="Test Type"
                options={testTypeOptions}
                value={filters.testType}
                onChange={(e) =>
                  dispatch(setFilters({ testType: e.target.value }))
                }
                className="w-40"
              />
            </div>

            {/* Model */}
            <SelectField
              label="Model"
              options={modelOptions}
              value={filters.model}
              onChange={(e) => dispatch(setFilters({ model: e.target.value }))}
              className="w-48"
            />

            {/* Operator */}
            <SelectField
              label="Operator"
              options={operatorOptions}
              value={filters.operator}
              onChange={(e) =>
                dispatch(setFilters({ operator: e.target.value }))
              }
              className="w-40"
            />

            {/* Result */}
            <SelectField
              label="Result"
              options={resultOptions}
              value={filters.result}
              onChange={(e) => dispatch(setFilters({ result: e.target.value }))}
              className="w-32"
            />
          </div>

          {/* Date Pickers */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-purple-500" />
              <DateTimePicker
                label="Start Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-52"
              />
            </div>
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-purple-500" />
              <DateTimePicker
                label="End Time"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-52"
              />
            </div>
          </div>
        </div>

        {/* Box 2: Actions */}
        <div className="bg-white border border-purple-200 p-4 rounded-xl shadow-md">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleQuery}
                bgColor={
                  isLoading
                    ? "bg-gray-400"
                    : "bg-gradient-to-r from-blue-500 to-purple-500"
                }
                textColor="text-white"
                className="font-semibold px-6 flex items-center gap-2"
                disabled={isLoading}
              >
                <BiSearchAlt />
                {isLoading ? "Loading..." : "Query"}
              </Button>

              <Button
                onClick={() => refetchReport()}
                bgColor="bg-gray-200"
                textColor="text-gray-700"
                className="p-2"
                disabled={isLoading}
              >
                <FaSync className={isLoading ? "animate-spin" : ""} />
              </Button>

              {estData.length > 0 && (
                <Button
                  onClick={handleExport}
                  bgColor="bg-green-500"
                  textColor="text-white"
                  className="font-semibold flex items-center gap-2"
                  disabled={exportLoading}
                >
                  <FaDownload />
                  {exportLoading ? "Exporting..." : "Export"}
                </Button>
              )}
            </div>

            <div className="bg-purple-100 px-4 py-2 rounded-lg flex items-center gap-2">
              <IoMdStats className="text-purple-600" />
              <span className="font-bold text-purple-800">
                Records: <span className="text-2xl">{totalCount}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Box 3: Quick Filters */}
        <div className="bg-white border border-purple-200 p-4 rounded-xl shadow-md">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 text-center flex items-center justify-center gap-2">
            <BsLightningChargeFill className="text-yellow-500" />
            Quick Filters
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={() => handleQuickFilter("yesterday")}
              bgColor={
                activeQuickFilter === "yesterday"
                  ? "bg-yellow-600"
                  : "bg-yellow-400 hover:bg-yellow-500"
              }
              textColor="text-gray-800"
              className="font-semibold text-sm flex items-center gap-1"
              disabled={quickFilterLoading}
            >
              <BiTime />
              YDAY
            </Button>
            <Button
              onClick={() => handleQuickFilter("today")}
              bgColor={
                activeQuickFilter === "today"
                  ? "bg-blue-600"
                  : "bg-blue-400 hover:bg-blue-500"
              }
              textColor="text-white"
              className="font-semibold text-sm flex items-center gap-1"
              disabled={quickFilterLoading}
            >
              <FaCalendarAlt />
              TODAY
            </Button>
            <Button
              onClick={() => handleQuickFilter("mtd")}
              bgColor={
                activeQuickFilter === "mtd"
                  ? "bg-green-600"
                  : "bg-green-400 hover:bg-green-500"
              }
              textColor="text-white"
              className="font-semibold text-sm flex items-center gap-1"
              disabled={quickFilterLoading}
            >
              <TbReportAnalytics />
              MTD
            </Button>
          </div>
        </div>
      </div>

      {isLoading && <Loader />}

      {!isLoading && estData.length > 0 && (
        <>
          {/* Header Info Card */}
          {currentData && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-purple-500">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex flex-wrap gap-8">
                  <InfoCard
                    icon={HiOutlineDocumentReport}
                    label="Reference No"
                    value={`#${currentData.RefNo}`}
                    color="purple"
                  />
                  <InfoCard
                    icon={FaCubes}
                    label="Model"
                    value={currentData.model_no}
                    color="blue"
                  />
                  <InfoCard
                    icon={FaBarcode}
                    label="Serial No"
                    value={currentData.serial_no}
                    color="gray"
                  />
                  <InfoCard
                    icon={FaCalendarAlt}
                    label="Date & Time"
                    value={
                      currentData.date_time &&
                      currentData.date_time.replace("T", " ").replace("Z", "")
                    }
                    color="green"
                  />
                  <InfoCard
                    icon={FaUser}
                    label="Operator"
                    value={currentData.operator}
                    color="purple"
                  />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <VscCircuitBoard className="text-purple-500" />
                    Overall Result
                  </span>
                  <StatusBadge status={currentData.result} size="lg" />
                </div>
              </div>
            </div>
          )}

          {/* Summary Statistics */}
          {summary && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FaChartBar className="text-purple-500" />
                Test Results Overview
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {testConfigs.map((test) => {
                  const Icon = test.icon;
                  const testKey = test.name.toLowerCase();
                  const testStats = summary[testKey] || { pass: 0, fail: 0 };
                  const isPass = testStats.fail === 0;

                  return (
                    <div
                      key={test.name}
                      className={`relative p-4 rounded-xl ${
                        isPass
                          ? "bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300"
                          : "bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300"
                      } text-center transition-all hover:scale-105 hover:shadow-lg cursor-pointer`}
                    >
                      <div
                        className={`w-12 h-12 mx-auto mb-2 rounded-full ${test.bgColor} flex items-center justify-center`}
                      >
                        <Icon className="text-white text-xl" />
                      </div>
                      <h3 className="font-bold text-gray-800">{test.name}</h3>
                      <div className="mt-2 text-xs">
                        <span className="text-green-600 font-bold">
                          {testStats.pass} Pass
                        </span>
                        {" / "}
                        <span className="text-red-600 font-bold">
                          {testStats.fail} Fail
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {testStats.passRate}% Pass Rate
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary Stats Card */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3">
                  <VscCircuitBoard className="text-3xl" />
                  <div>
                    <p className="text-sm opacity-80">Total Tests</p>
                    <p className="text-3xl font-bold">{summary.total.tests}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3">
                  <FaCheckCircle className="text-3xl" />
                  <div>
                    <p className="text-sm opacity-80">Passed</p>
                    <p className="text-3xl font-bold">{summary.total.pass}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3">
                  <FaTimesCircle className="text-3xl" />
                  <div>
                    <p className="text-sm opacity-80">Failed</p>
                    <p className="text-3xl font-bold">{summary.total.fail}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3">
                  <IoMdStats className="text-3xl" />
                  <div>
                    <p className="text-sm opacity-80">Pass Rate</p>
                    <p className="text-3xl font-bold">
                      {summary.total.passRate}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FaTable className="text-purple-500" />
              Test Records ({estData.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                  <tr>
                    <th className="px-3 py-3 rounded-tl-lg">
                      <div className="flex items-center gap-1">
                        <HiOutlineDocumentReport />
                        Ref No
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaCubes />
                        Model
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaBarcode />
                        Serial
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaCalendarAlt />
                        Date/Time
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaUser />
                        Operator
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaPlug />
                        ECT
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <HiLightningBolt />
                        HV
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaShieldAlt />
                        IR
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaTint />
                        LCT
                      </div>
                    </th>
                    <th className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <FaBatteryFull />
                        Wattage
                      </div>
                    </th>
                    <th className="px-3 py-3 rounded-tr-lg">
                      <div className="flex items-center gap-1">
                        <VscCircuitBoard />
                        Result
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {estData.map((item, index) => (
                    <tr
                      key={item.RefNo || index}
                      className="hover:bg-purple-50 border-b border-gray-100 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(item)}
                    >
                      <td className="px-3 py-3 font-mono font-semibold">
                        {item.RefNo}
                      </td>
                      <td className="px-3 py-3 font-semibold text-blue-600">
                        {item.model_no}
                      </td>
                      <td className="px-3 py-3 font-mono text-gray-600">
                        {item.serial_no}
                      </td>
                      <td className="px-3 py-3">
                        {item.date_time &&
                          item.date_time.replace("T", " ").replace("Z", "")}
                      </td>
                      <td className="px-3 py-3">
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">
                          {item.operator}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.ect_result} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.hv_result} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.ir_result} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.lct_ln_result} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {item.set_wattage_lower} - {item.set_wattage_upper}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {estData.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500">
                  No data found. Please adjust your filters and try again.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!isLoading && estData.length === 0 && filters.startDate && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <GiElectric className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            No Records Found
          </h3>
          <p className="text-gray-500">
            No EST records found for the selected date range and filters.
          </p>
        </div>
      )}

      {!filters.startDate && !filters.endDate && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <BiSearchAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Select Date Range
          </h3>
          <p className="text-gray-500">
            Please select a date range or use quick filters to view EST report
            data.
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedRecord && <ESTDetailModal />}
    </div>
  );
};

export default ESTReport;
