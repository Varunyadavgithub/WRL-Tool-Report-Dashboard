import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination.jsx";
import {
  useGetEstReportQuery,
  useGetEstReportSummaryQuery,
  useGetDistinctModelsQuery,
  useGetDistinctOperatorsQuery,
  useLazyGetExportDataQuery,
} from "../../redux/api/estReportApi";
import {
  setFilters,
  resetFilters,
  setSelectedRecord,
  setActiveQuickFilter,
  setDateRange,
  setPage,
  setLimit,
  setPagination,
} from "../../redux/slices/estReportSlice.js";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";
import { exportToXls } from "../../utils/exportToXls.js";

import {
  FaShieldAlt,
  FaTint,
  FaBatteryFull,
  FaCheckCircle,
  FaTimesCircle,
  FaPlug,
  FaTable,
  FaUser,
  FaCalendarAlt,
  FaBarcode,
  FaCubes,
  FaDownload,
  FaSync,
  FaRedo,
  FaFilter,
  FaChevronRight,
} from "react-icons/fa";
import { MdFilterAlt, MdElectricBolt } from "react-icons/md";
import { HiLightningBolt, HiOutlineDocumentReport } from "react-icons/hi";
import { BiSearchAlt, BiTime } from "react-icons/bi";
import { BsLightningChargeFill, BsGraphUp } from "react-icons/bs";
import { IoMdStats } from "react-icons/io";
import { GiElectric } from "react-icons/gi";
import { VscCircuitBoard } from "react-icons/vsc";
import { RiDashboardLine } from "react-icons/ri";
import { AiOutlineClockCircle } from "react-icons/ai";
import { PiWarningCircleBold } from "react-icons/pi";

import ESTDetailModal from "../../components/ESTDetailModal";

// --- Status Badge --------------------------------------------------------------
const StatusBadge = ({ status, size = "md" }) => {
  const isPass = status === "Pass" || status === 1;
  const base = "inline-flex items-center gap-1 rounded font-semibold";
  const sizes = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  };
  const iconSize = size === "lg" ? 14 : 10;
  return (
    <span
      className={`${base} ${sizes[size]} ${
        isPass
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-rose-50 text-rose-700 border border-rose-200"
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

// --- Main Component ------------------------------------------------------------
const ESTReport = () => {
  const dispatch = useDispatch();
  const {
    filters,
    selectedRecord,
    isDetailModalOpen,
    activeQuickFilter,
    pagination,
  } = useSelector((state) => state.estReport);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // -- API Hooks --------------------------------------------------------------
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
      page: pagination.page,
      limit: pagination.limit,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: summaryData } = useGetEstReportSummaryQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: modelsData } = useGetDistinctModelsQuery();
  const { data: operatorsData } = useGetDistinctOperatorsQuery();
  const [triggerExport, { isLoading: exportLoading }] =
    useLazyGetExportDataQuery();

  // -- Sync pagination from API response -------------------------------------
  useEffect(() => {
    if (reportData?.pagination) {
      dispatch(
        setPagination({
          totalPages: reportData.pagination.totalPages || 1,
          totalRecords: reportData.pagination.totalRecords || 0,
        }),
      );
    }
  }, [reportData, dispatch]);

  // -- Options ----------------------------------------------------------------
  const testTypeOptions = [
    { label: "All Tests", value: "all" },
    { label: "ECT", value: "ect" },
    { label: "HV", value: "hv" },
    { label: "IR", value: "ir" },
    { label: "LCT", value: "lct" },
  ];

  const resultOptions = [
    { label: "All Results", value: "" },
    { label: "Pass", value: "Pass" },
    { label: "Fail", value: "Fail" },
  ];

  const modelOptions = [
    { label: "All Models", value: "" },
    ...(modelsData?.data || []),
  ];

  const operatorOptions = [
    { label: "All Operators", value: "" },
    ...(operatorsData?.data || []),
  ];

  // -- Handlers --------------------------------------------------------------
  const handleQuery = () => {
    if (!startTime || !endTime) {
      alert("Please select both start and end date/time.");
      return;
    }
    dispatch(setPage(1)); // reset to page 1 on new query
    dispatch(
      setDateRange({
        startDate: new Date(startTime).toISOString(),
        endDate: new Date(endTime).toISOString(),
      }),
    );
    dispatch(setActiveQuickFilter(null));
  };

  const handleQuickFilter = (filterType) => {
    const rangeMap = {
      today: getTodayRange,
      yesterday: getYesterdayRange,
      mtd: getMTDRange,
    };
    const dateRange = rangeMap[filterType]?.();
    if (!dateRange) return;

    dispatch(setPage(1));
    dispatch(setDateRange(dateRange));
    dispatch(setActiveQuickFilter(filterType));
    setStartTime(formatDateTimeLocal(dateRange.startDate));
    setEndTime(formatDateTimeLocal(dateRange.endDate));
  };

  const handleExport = async () => {
    try {
      const result = await triggerExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
        operator: filters.operator,
        result: filters.result,
      }).unwrap();
      if (result?.data) exportToXls(result.data, "EST_Report.xlsx");
    } catch {
      alert("Export failed. Please try again.");
    }
  };

  const handleResetFilters = () => {
    dispatch(resetFilters());
    setStartTime("");
    setEndTime("");
  };

  const handlePageChange = (p) => dispatch(setPage(p));
  const handleLimitChange = (l) => dispatch(setLimit(l));

  // -- Derived state ----------------------------------------------------------
  const estData = reportData?.data || [];
  const summary = summaryData?.data;
  const isLoading = reportLoading || reportFetching;
  const hasData = estData.length > 0;
  const hasFilters = filters.startDate && filters.endDate;

  const passRate = summary ? parseFloat(summary.total.passRate) : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* -- Top Header -- */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center shadow">
          <GiElectric className="text-white text-lg" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">
            EST Report Dashboard
          </h1>
          <p className="text-xs text-slate-400">
            Electrical Safety Testing — Quality Analytics
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <AiOutlineClockCircle />
          <span>Live Data</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 max-w-[1600px] mx-auto">
        {/* -- Filter Panel -- */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-700 px-5 py-3 flex items-center gap-2">
            <FaFilter className="text-slate-300 text-sm" />
            <span className="text-sm font-semibold text-white">
              Filters & Date Range
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
            {/* Left: filter controls */}
            <div className="space-y-4">
              {/* Row 1: dropdowns */}
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[140px]">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Test Type
                  </label>
                  <SelectField
                    options={testTypeOptions}
                    value={filters.testType}
                    onChange={(e) =>
                      dispatch(setFilters({ testType: e.target.value }))
                    }
                  />
                </div>
                <div className="min-w-[160px]">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Model
                  </label>
                  <SelectField
                    options={modelOptions}
                    value={filters.model}
                    onChange={(e) =>
                      dispatch(setFilters({ model: e.target.value }))
                    }
                  />
                </div>
                <div className="min-w-[140px]">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Operator
                  </label>
                  <SelectField
                    options={operatorOptions}
                    value={filters.operator}
                    onChange={(e) =>
                      dispatch(setFilters({ operator: e.target.value }))
                    }
                  />
                </div>
                <div className="min-w-[120px]">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Result
                  </label>
                  <SelectField
                    options={resultOptions}
                    value={filters.result}
                    onChange={(e) =>
                      dispatch(setFilters({ result: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Row 2: date pickers */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[200px]">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <FaCalendarAlt size={9} /> Start Time
                  </label>
                  <DateTimePicker
                    name="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="min-w-[200px]">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <FaCalendarAlt size={9} /> End Time
                  </label>
                  <DateTimePicker
                    name="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 items-end pb-0.5">
                  <button
                    onClick={handleQuery}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    <BiSearchAlt />
                    {isLoading ? "Loading…" : "Query"}
                  </button>
                  <button
                    onClick={() => refetchReport()}
                    disabled={isLoading}
                    title="Refresh"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  >
                    <FaSync
                      className={isLoading ? "animate-spin" : ""}
                      size={14}
                    />
                  </button>
                  <button
                    onClick={handleResetFilters}
                    title="Reset Filters"
                    className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-lg transition-colors"
                  >
                    <FaRedo size={14} />
                  </button>
                  {hasData && (
                    <button
                      onClick={handleExport}
                      disabled={exportLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <FaDownload size={12} />
                      {exportLoading ? "Exporting…" : "Export"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Filters */}
            <div className="border-l border-slate-100 pl-5 flex flex-col justify-center gap-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <BsLightningChargeFill className="text-amber-400" /> Quick
                Select
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { key: "yesterday", label: "Yesterday", color: "amber" },
                  { key: "today", label: "Today", color: "indigo" },
                  { key: "mtd", label: "Month to Date", color: "emerald" },
                ].map(({ key, label, color }) => {
                  const active = activeQuickFilter === key;
                  const styles = {
                    amber: active
                      ? "bg-amber-500 text-white"
                      : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100",
                    indigo: active
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100",
                    emerald: active
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100",
                  };
                  return (
                    <button
                      key={key}
                      onClick={() => handleQuickFilter(key)}
                      disabled={isLoading}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${styles[color]}`}
                    >
                      {label}
                      <FaChevronRight size={9} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* -- Loader -- */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader />
          </div>
        )}

        {/* -- Data Table -- */}
        {!isLoading && hasData && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Table header bar */}
            <div className="border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FaTable className="text-indigo-500" />
                <span className="font-semibold text-slate-700 text-sm">
                  Test Records
                </span>
                <span className="ml-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                  {pagination.totalRecords.toLocaleString()} total
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Page{" "}
                <span className="font-semibold text-slate-700">
                  {pagination.page}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {pagination.totalPages}
                </span>
                {" · "}Showing{" "}
                <span className="font-semibold text-slate-700">
                  {estData.length}
                </span>{" "}
                records
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalRecords > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200">
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700 text-slate-200 text-xs uppercase tracking-wide">
                    {[
                      { icon: HiOutlineDocumentReport, label: "Ref No" },
                      { icon: FaCubes, label: "Model" },
                      { icon: FaBarcode, label: "Serial" },
                      { icon: FaCalendarAlt, label: "Date / Time" },
                      { icon: FaUser, label: "Operator" },
                      { icon: FaPlug, label: "ECT" },
                      { icon: HiLightningBolt, label: "HV" },
                      { icon: FaShieldAlt, label: "IR" },
                      { icon: FaTint, label: "LCT" },
                      { icon: FaBatteryFull, label: "Wattage" },
                      { icon: VscCircuitBoard, label: "Result" },
                    ].map(({ icon: Icon, label }) => (
                      <th
                        key={label}
                        className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon className="opacity-70" /> {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estData.map((item, index) => (
                    <tr
                      key={item.RefNo || index}
                      onClick={() => dispatch(setSelectedRecord(item))}
                      className="hover:bg-indigo-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600 group-hover:text-indigo-700">
                        #{item.RefNo}
                      </td>
                      <td className="px-4 py-3 font-semibold text-indigo-600 text-xs">
                        {item.model_no}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.serial_no}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {item.date_time?.replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded text-xs font-medium">
                          <FaUser size={8} /> {item.operator}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            item.ect_result == null ? "PASS" : item.ect_result
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.hv_result} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.ir_result} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.lct_ln_result} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                          {item.set_wattage_lower}–{item.set_wattage_upper}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -- Empty States -- */}
        {!isLoading && hasFilters && !hasData && (
          <div className="bg-white border border-slate-200 rounded-xl p-14 text-center shadow-sm">
            <PiWarningCircleBold className="text-5xl text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-600 mb-1">
              No Records Found
            </h3>
            <p className="text-sm text-slate-400">
              No EST records matched the selected filters. Try adjusting the
              date range or filters.
            </p>
          </div>
        )}

        {!hasFilters && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-14 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BiSearchAlt className="text-2xl text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-600 mb-1">
              Select a Date Range
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Use the filters above or click a Quick Select option to load EST
              report data.
            </p>
            <div className="flex justify-center gap-2 mt-5">
              {["Yesterday", "Today", "MTD"].map((q, i) => (
                <button
                  key={q}
                  onClick={() =>
                    handleQuickFilter(["yesterday", "today", "mtd"][i])
                  }
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* -- Detail Modal -- */}
      {isDetailModalOpen && selectedRecord && <ESTDetailModal />}
    </div>
  );
};

export default ESTReport;
