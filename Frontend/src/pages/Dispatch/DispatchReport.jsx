import { useState } from "react";
import axios from "axios";
import Title from "../../components/common/Title";
import SelectField from "../../components/common/SelectField";
import DateTimePicker from "../../components/common/DateTimePicker";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import toast from "react-hot-toast";
import ExportButton from "../../components/common/ExportButton";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const DispatchReport = () => {
  const dispatchStageOptions = [
    { label: "FG Unloading", value: "fgunloading" },
    { label: "FG Inventory", value: "fginventory" },
    { label: "FG Dispatch", value: "fgdispatch" },
  ];

  const Status = [
    { label: "Completed", value: "completed" },
    { label: "Open", value: "open" },
  ];
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedStage, setSelectedStageOptions] = useState(
    dispatchStageOptions[0]
  );
  const [status, setStatus] = useState(Status[0]);
  const [fgUnloadingData, setFgUnloadingData] = useState([]);
  const [fgDispatchData, setFgDispatchData] = useState([]);
  const [pageUnloading, setPageUnloading] = useState(1);
  const [pageDispatch, setPageDispatch] = useState(1);
  const [totalUnloadingPages, setTotalUnloadingPages] = useState(1);
  const [totalDispatchPages, setTotalDispatchPages] = useState(1);
  const [limit] = useState(1000);
  const [totalFgUnloadingDataCount, setTotalFgUnloadingDataCount] = useState(0);
  const [totalFgDispatchDataCount, setTotalFgDispatchDataCount] = useState(0);

  const fetchFgUnloadingData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}dispatch/fg-unloading`, {
        params: {
          startDate: startTime,
          endDate: endTime,
          page: pageNumber,
          limit,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData(res?.data?.data);
        setTotalFgUnloadingDataCount(res?.data?.totalCount);
        setTotalUnloadingPages(Math.ceil(res?.data?.totalCount / limit));
        setPageUnloading(pageNumber);
      }
    } catch (error) {
      console.error("Failed to fetch Fg Unloading Data:", error);
      toast.error("Failed to fetch Fg Unloading Data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFgDispatchData = async (pageNumber = 1) => {
    if (!startTime || !endTime || !status) {
      toast.error("Please select Time Range and Status.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}dispatch/fg-dispatch`, {
        params: {
          startDate: startTime,
          endDate: endTime,
          status: status.value,
          page: pageNumber,
          limit,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData(res?.data?.data);
        setTotalFgDispatchDataCount(res?.data?.totalCount);
        setTotalDispatchPages(Math.ceil(res?.data?.totalCount / limit));
        setPageDispatch(pageNumber);
      }
    } catch (error) {
      console.error("Failed to fetch Fg Dispatch Data:", error);
      toast.error("Failed to fetch Fg Dispatch Data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Filters
  const fetchYesterdayFgUnloadingData = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);

    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1); // Go to yesterday 8 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(yesterday8AM);
    const formattedEnd = formatDate(today8AM);

    try {
      setYdayLoading(true);

      setFgUnloadingData([]);
      setTotalFgUnloadingDataCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-unloading`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData(res?.data?.data);
        setTotalFgUnloadingDataCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday Fg Unloading Data:", error);
      toast.error(
        "Failed to fetch Yesterday Fg Unloading Data. Please try again."
      );
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchYesterdayFgDispatchData = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);

    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1); // Go to yesterday 8 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(yesterday8AM);
    const formattedEnd = formatDate(today8AM);

    try {
      setYdayLoading(true);

      setFgDispatchData([]);
      setTotalFgDispatchDataCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-dispatch`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
          status: status.value,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData(res?.data?.data);
        setTotalFgDispatchDataCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday Fg Dispatch Data:", error);
      toast.error(
        "Failed to fetch Yesterday Fg Dispatch Data. Please try again."
      );
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodayFgUnloadingData = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0); // Set to today 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(today8AM);
    const formattedEnd = formatDate(now); // Now = current time
    try {
      setTodayLoading(true);

      setFgUnloadingData([]);
      setTotalFgUnloadingDataCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-unloading`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData(res?.data?.data);
        setTotalFgUnloadingDataCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Today Fg Unloading Data:", error);
      toast.error("Failed to fetch Today Fg Unloading Data. Please try again.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchTodayFgDispatchData = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0); // Set to today 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(today8AM);
    const formattedEnd = formatDate(now); // Now = current time

    try {
      setTodayLoading(true);

      setFgDispatchData([]);
      setTotalFgDispatchDataCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-dispatch`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
          status: status.value,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData(res?.data?.data);
        setTotalFgDispatchDataCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Today Fg Dispatch Data:", error);
      toast.error("Failed to fetch Today Fg Dispatch Data. Please try again.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchMTDFgUnloadingData = async () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0
    ); // 1st day at 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(startOfMonth);
    const formattedEnd = formatDate(now);
    try {
      setMonthLoading(true);

      setFgUnloadingData([]);
      setTotalFgUnloadingDataCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-unloading`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData(res?.data?.data);
        setTotalFgUnloadingDataCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch this Month Fg Unloading Data:", error);
      toast.error(
        "Failed to fetch this Month Fg Unloading Data. Please try again."
      );
    } finally {
      setMonthLoading(false);
    }
  };

  const fetchMTDFgDispatchData = async () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0
    ); // 1st day at 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(startOfMonth);
    const formattedEnd = formatDate(now);
    try {
      setMonthLoading(true);

      setFgDispatchData([]);
      setTotalFgDispatchDataCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-dispatch`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
          status: status.value,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData(res?.data?.data);
        setTotalFgDispatchDataCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch this Month Fg Dispatch Data:", error);
      toast.error(
        "Failed to fetch this Month Fg Dispatch Data. Please try again."
      );
    } finally {
      setMonthLoading(false);
    }
  };

  const handleQuery = () => {
    if (selectedStage.value === "fgunloading") {
      fetchFgUnloadingData(1);
    } else if (selectedStage.value === "fgdispatch") {
      fetchFgDispatchData(1);
    }
  };

  const handleYesterdayQuery = () => {
    if (selectedStage.value === "fgunloading") {
      fetchYesterdayFgUnloadingData();
    } else if (selectedStage.value === "fgdispatch") {
      fetchYesterdayFgDispatchData();
    }
  };

  const handleTodayQuery = () => {
    if (selectedStage.value === "fgunloading") {
      fetchTodayFgUnloadingData();
    } else if (selectedStage.value === "fgdispatch") {
      fetchTodayFgDispatchData();
    }
  };

  const handleMonthQuery = () => {
    if (selectedStage.value === "fgunloading") {
      fetchMTDFgUnloadingData();
    } else if (selectedStage.value === "fgdispatch") {
      fetchMTDFgDispatchData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Title title="Dispatch Report" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl items-center">
          <DateTimePicker
            label="Start Time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <DateTimePicker
            label="End Time"
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <SelectField
            label="Dispatch Stage"
            options={dispatchStageOptions}
            value={selectedStage?.value || ""}
            onChange={(e) => {
              const selected = dispatchStageOptions.find(
                (opt) => opt.value === e.target.value
              );
              if (selected) {
                setSelectedStageOptions(selected);
              }
            }}
          />
          {selectedStage.value === "fgdispatch" && (
            <SelectField
              label="Status"
              options={Status}
              value={status.value}
              onChange={(e) => {
                const selected = Status.find(
                  (item) => item.value === e.target.value
                );
                setStatus(selected);
              }}
              className="max-w-32"
            />
          )}
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={handleQuery}
                  disabled={loading}
                >
                  Query
                </Button>
                <ExportButton />
              </div>
              <div className="text-left font-bold text-lg">
                COUNT:{" "}
                <span className="text-blue-700">
                  {selectedStage.value === "fgunloading"
                    ? `${totalFgUnloadingDataCount}`
                    : selectedStage.value === "fgdispatch"
                    ? `${totalFgDispatchDataCount}`
                    : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Quick Filters
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
              textColor={ydayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                ydayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => handleYesterdayQuery()}
              disabled={ydayLoading}
            >
              YDAY
            </Button>
            <Button
              bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
              textColor={todayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                todayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => handleTodayQuery()}
              disabled={todayLoading}
            >
              TDAY
            </Button>
            <Button
              bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
              textColor={monthLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                monthLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => handleMonthQuery()}
              disabled={monthLoading}
            >
              MTD
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        {selectedStage.value === "fgunloading" && (
          <>
            <PaginationControls
              page={pageUnloading}
              totalPages={totalUnloadingPages}
              onPageChange={fetchFgUnloadingData}
            />
          </>
        )}
        {selectedStage.value === "fgdispatch" && (
          <>
            <PaginationControls
              page={pageDispatch}
              totalPages={totalDispatchPages}
              onPageChange={fetchFgDispatchData}
            />
          </>
        )}
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="flex flex-wrap items-center gap-4">
            {loading ? (
              <Loader />
            ) : selectedStage.value === "fgunloading" ? (
              <FgUnloadingTable data={fgUnloadingData} />
            ) : selectedStage.value === "fgdispatch" ? (
              <FgDispatchTable data={fgDispatchData} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const FgUnloadingTable = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">Model Name</th>
            <th className="px-1 py-1 border min-w-[120px]">FG Serial No.</th>
            <th className="px-1 py-1 border min-w-[120px]">Asset Code</th>
            <th className="px-1 py-1 border min-w-[120px]">Batch Code</th>
            <th className="px-1 py-1 border min-w-[120px]">Scanner No.</th>
            <th className="px-1 py-1 border min-w-[120px]">Date Time</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.ModelName}</td>
                <td className="px-1 py-1 border">{row.FGSerialNo}</td>
                <td className="px-1 py-1 border">{row.AssetCode}</td>
                <td className="px-1 py-1 border">{row.BatchCode}</td>
                <td className="px-1 py-1 border">{row.ScannerNo}</td>
                <td className="px-1 py-1 border">
                  {row.DateTime &&
                    row.DateTime.replace("T", " ").replace("Z", "")}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const FgDispatchTable = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">Model Name</th>
            <th className="px-1 py-1 border min-w-[120px]">FG Serial No.</th>
            <th className="px-1 py-1 border min-w-[120px]">Asset Code</th>
            <th className="px-1 py-1 border min-w-[120px]">Session ID</th>
            <th className="px-1 py-1 border min-w-[120px]">Added On</th>
            <th className="px-1 py-1 border min-w-[120px]">Added By</th>
            <th className="px-1 py-1 border min-w-[120px]">Document ID</th>
            <th className="px-1 py-1 border min-w-[120px]">Model Code</th>
            <th className="px-1 py-1 border min-w-[120px]">Dock No</th>
            <th className="px-1 py-1 border min-w-[120px]">Vehicle No</th>
            <th className="px-1 py-1 border min-w-[120px]">Generated By</th>
            <th className="px-1 py-1 border min-w-[120px]">Scan ID</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.ModelName}</td>
                <td className="px-1 py-1 border">{row.FGSerialNo}</td>
                <td className="px-1 py-1 border">{row.AssetCode}</td>
                <td className="px-1 py-1 border">{row.Session_ID}</td>
                <td className="px-1 py-1 border">
                  {row.AddedOn &&
                    row.AddedOn.replace("T", " ").replace("Z", "")}
                </td>
                <td className="px-1 py-1 border">{row.AddedBy}</td>
                <td className="px-1 py-1 border">{row.Document_ID}</td>
                <td className="px-1 py-1 border">{row.ModelCode}</td>
                <td className="px-1 py-1 border">{row.DockNo}</td>
                <td className="px-1 py-1 border">{row.Vehicle_No}</td>
                <td className="px-1 py-1 border">{row.Generated_By}</td>
                <td className="px-1 py-1 border">{row.Scan_ID}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={12} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ========== Pagination Controls ==========
const PaginationControls = ({ page, totalPages, onPageChange }) => {
  const isPrevDisabled = page <= 1;
  const isNextDisabled = page >= totalPages;

  return (
    <div className="flex justify-center items-center gap-4 my-4">
      <Button
        onClick={() => onPageChange(page - 1)}
        disabled={isPrevDisabled}
        bgColor={isPrevDisabled ? "bg-gray-400" : "bg-blue-500"}
        textColor="text-white"
      >
        Previous
      </Button>
      <span className="font-semibold">
        Page {page} of {totalPages}
      </span>
      <Button
        onClick={() => onPageChange(page + 1)}
        disabled={isNextDisabled}
        bgColor={isNextDisabled ? "bg-gray-400" : "bg-blue-500"}
        textColor="text-white"
      >
        Next
      </Button>
    </div>
  );
};

export default DispatchReport;
