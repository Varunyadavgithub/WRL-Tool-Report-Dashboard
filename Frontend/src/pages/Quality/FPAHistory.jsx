import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Loader from "../../components/ui/Loader";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import FpaModelDetailModal from "../../components/FpaModelDetailModal";
import FpaDefectDetailModal from "../../components/FpaDefectDetailModal";
import FpaSerialSearchModal from "../../components/FpaSerialSearchModal";
import Title from "../../components/ui/Title";
import toast from "react-hot-toast";

import {
  useGetFpaHistoryQuery,
  useLazyGetFpaBySerialQuery,
} from "../../redux/api/fpaReportApi";
import {
  setFpaDateRange,
  setFpaQuickFilter,
  resetFpaFilters,
  openModelModal,
  openSerialModal,
} from "../../redux/fpaReportSlice";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
} from "../../utils/dateUtils";

import {
  HiOutlineClipboardList,
  HiOutlineSearch,
  HiOutlineDocumentReport,
} from "react-icons/hi";
import { FiRefreshCw } from "react-icons/fi";
import {
  FaSearch,
  FaRedo,
  FaCalendarAlt,
  FaArrowRight,
  FaBarcode,
} from "react-icons/fa";

const FpaHistory = () => {
  const dispatch = useDispatch();

  const fpaState = useSelector((state) => state.fpaReport);
  const filters = fpaState?.filters || { startDate: "", endDate: "" };
  const activeQuickFilter = fpaState?.activeQuickFilter || null;
  const isModelModalOpen = fpaState?.isModelModalOpen || false;
  const selectedModel = fpaState?.selectedModel || null;
  const isDefectModalOpen = fpaState?.isDefectModalOpen || false;
  const selectedFGSRNo = fpaState?.selectedFGSRNo || null;
  const isSerialModalOpen = fpaState?.isSerialModalOpen || false;

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [serialSearch, setSerialSearch] = useState("");
  const [serialLoading, setSerialLoading] = useState(false);

  const {
    data: historyData,
    isLoading: historyLoading,
    isFetching: historyFetching,
    refetch: refetchHistory,
  } = useGetFpaHistoryQuery(
    { startDate: filters.startDate, endDate: filters.endDate },
    { skip: !filters.startDate || !filters.endDate },
  );

  const [triggerSerialSearch] = useLazyGetFpaBySerialQuery();

  /* ===================== HANDLERS ===================== */
  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select both start and end date/time");
      return;
    }
    dispatch(
      setFpaDateRange({
        startDate: new Date(startTime).toISOString(),
        endDate: new Date(endTime).toISOString(),
      }),
    );
    dispatch(setFpaQuickFilter(null));
  };

  const handleQuickFilter = (type) => {
    let range;
    switch (type) {
      case "today":
        range = getTodayRange();
        break;
      case "yesterday":
        range = getYesterdayRange();
        break;
      case "mtd":
        range = getMTDRange();
        break;
      default:
        return;
    }
    dispatch(
      setFpaDateRange({
        startDate: range.startDate,
        endDate: range.endDate,
      }),
    );
    dispatch(setFpaQuickFilter(type));
    setStartTime(range.startLocal);
    setEndTime(range.endLocal);
  };

  const handleResetFilters = () => {
    dispatch(resetFpaFilters());
    setStartTime("");
    setEndTime("");
    setSerialSearch("");
  };

  const handleModelClick = (modelName) => {
    dispatch(openModelModal(modelName));
  };

  /**
   * Simplified Serial Search:
   * 1. Call GET /api/fpa/serial/:fgsrNo
   * 2. Get back { modelName, data: [single record] }
   * 3. Open serial modal with that data
   * No date range needed!
   */
  const handleSerialSearch = async () => {
    const trimmed = serialSearch.trim();
    if (!trimmed) {
      toast.error("Please enter a serial number (FGSRNo)");
      return;
    }

    setSerialLoading(true);

    try {
      const result = await triggerSerialSearch({ fgsrNo: trimmed }).unwrap();

      if (result?.success && result?.data) {
        dispatch(
          openSerialModal({
            modelName: result.modelName,
            data: result.data,
          }),
        );
        toast.success(`Found model: ${result.modelName}`);
      }
    } catch (error) {
      toast.error(
        error?.data?.message || "No record found for this serial number",
      );
    } finally {
      setSerialLoading(false);
    }
  };

  const handleSerialKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSerialSearch();
    }
  };

  const fpaData = historyData?.data || [];
  const isLoading = historyLoading || historyFetching;

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Title title="FPA Report Dashboard" align="center" />

      {/* Serial Number Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Search by Serial Number (FGSRNo)
            </label>
            <div className="relative">
              <FaBarcode
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={14}
              />
              <input
                type="text"
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                onKeyDown={handleSerialKeyDown}
                placeholder="Enter FGSRNo e.g. 42623260200240"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                disabled={serialLoading}
              />
            </div>
          </div>
          <Button
            onClick={handleSerialSearch}
            bgColor={
              serialLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }
            textColor="text-white"
            className={`px-4 py-[9px] text-sm flex items-center gap-1.5 ${
              serialLoading ? "cursor-not-allowed" : ""
            }`}
            disabled={serialLoading}
          >
            <FaSearch size={12} />
            {serialLoading ? "Searching..." : "Search"}
          </Button>
          {serialSearch && (
            <Button
              onClick={() => setSerialSearch("")}
              bgColor="bg-gray-100 hover:bg-gray-200"
              textColor="text-gray-600"
              className="px-3 py-[9px] text-sm"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <DateTimePicker
              label="Start Date/Time"
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <DateTimePicker
              label="End Date/Time"
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div className="md:col-span-3 flex items-end gap-2">
            <Button
              onClick={handleQuery}
              bgColor={
                isLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
              }
              textColor="text-white"
              className={`px-4 py-[9px] text-sm flex items-center gap-1.5 ${
                isLoading ? "cursor-not-allowed" : ""
              }`}
              disabled={isLoading}
            >
              <FaSearch size={12} />
              {isLoading ? "Loading..." : "Search"}
            </Button>
            <Button
              onClick={() => refetchHistory()}
              bgColor="bg-gray-100 hover:bg-gray-200"
              textColor="text-gray-600"
              className="px-3 py-[9px] text-sm"
              disabled={isLoading}
            >
              <FiRefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
              />
            </Button>
            <Button
              onClick={handleResetFilters}
              bgColor="bg-gray-100 hover:bg-gray-200"
              textColor="text-gray-600"
              className="px-3 py-[9px] text-sm flex items-center gap-1.5"
            >
              <FaRedo size={11} />
              Reset
            </Button>
          </div>

          <div className="md:col-span-3 flex items-end gap-2">
            {["today", "yesterday", "mtd"].map((type) => (
              <Button
                key={type}
                onClick={() => handleQuickFilter(type)}
                bgColor={
                  activeQuickFilter === type
                    ? "bg-blue-600"
                    : "bg-gray-100 hover:bg-gray-200"
                }
                textColor={
                  activeQuickFilter === type ? "text-white" : "text-gray-700"
                }
                className={`px-3 py-[9px] text-sm ${
                  isLoading ? "cursor-not-allowed" : ""
                }`}
                disabled={isLoading}
              >
                {type === "mtd"
                  ? "MTD"
                  : type === "yesterday"
                    ? "YDAY"
                    : "Today"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <Loader />}

      {/* Data Table */}
      {!isLoading && fpaData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <HiOutlineDocumentReport className="text-blue-600" size={20} />
              FPA Inspection Summary
            </h2>
            <span className="text-sm text-gray-500">
              {fpaData.length} models
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Model Name</th>
                  <th className="px-4 py-3 text-center">Production</th>
                  <th className="px-4 py-3 text-center">FPA Req.</th>
                  <th className="px-4 py-3 text-center">Inspected</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Critical</th>
                  <th className="px-4 py-3 text-center">Major</th>
                  <th className="px-4 py-3 text-center">Minor</th>
                  <th className="px-4 py-3 text-center">FPQI</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fpaData.map((item, index) => {
                  const done = item.SampleInspected >= item.FPA;
                  const fpqi =
                    item.FPQI !== null ? parseFloat(item.FPQI) : null;
                  const hasInspection = item.SampleInspected > 0;

                  return (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[280px] truncate">
                        {item.ModelName}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {item.ModelCount}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {item.FPA}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {item.SampleInspected}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            done
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {done ? "Done" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            item.Critical > 0 ? "text-red-600" : "text-gray-400"
                          }`}
                        >
                          {item.Critical}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            item.Major > 0 ? "text-orange-600" : "text-gray-400"
                          }`}
                        >
                          {item.Major}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-semibold ${
                            item.Minor > 0 ? "text-yellow-600" : "text-gray-400"
                          }`}
                        >
                          {item.Minor}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fpqi !== null ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              fpqi > 5
                                ? "bg-red-50 text-red-700"
                                : fpqi > 2
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-green-50 text-green-700"
                            }`}
                          >
                            {fpqi.toFixed(3)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            Not Inspected
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasInspection ? (
                          <button
                            onClick={() => handleModelClick(item.ModelName)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            View <FaArrowRight size={10} />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No Data</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty — No Data */}
      {!isLoading && fpaData.length === 0 && filters.startDate && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
          <HiOutlineClipboardList className="text-gray-300 text-5xl mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-1">
            No Records Found
          </h3>
          <p className="text-sm text-gray-500">
            No FPA records found for the selected date range.
          </p>
        </div>
      )}

      {/* Empty — No Filters */}
      {!filters.startDate && !filters.endDate && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
          <HiOutlineSearch className="text-gray-300 text-5xl mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-1">
            Select Date Range
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Select a date range or use quick filters to view data.
          </p>
          <Button
            onClick={() => handleQuickFilter("today")}
            bgColor="bg-blue-600 hover:bg-blue-700"
            textColor="text-white"
            className="px-5 py-2 inline-flex items-center gap-2"
          >
            <FaCalendarAlt size={12} />
            View Today's Data
          </Button>
        </div>
      )}

      {/* Serial Search Modal — separate from model modal */}
      {isSerialModalOpen && <FpaSerialSearchModal />}

      {/* Model Modal — for dashboard "View" clicks */}
      {isModelModalOpen && selectedModel && (
        <FpaModelDetailModal
          modelName={selectedModel}
          startDate={filters.startDate}
          endDate={filters.endDate}
        />
      )}

      {/* Defect Modal */}
      {isDefectModalOpen && selectedFGSRNo && <FpaDefectDetailModal />}
    </div>
  );
};

export default FpaHistory;
