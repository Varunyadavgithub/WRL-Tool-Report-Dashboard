import { useEffect, useState } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import DateTimePicker from "../../components/common/DateTimePicker";
import axios from "axios";
import Loader from "../../components/common/Loader";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const DispatchPerformanceReport = () => {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [dispatchType, setDispatchType] = useState("vehicleUph");
  const [dispatchData, setDispatchData] = useState([]);
  const [dispatchSummaryData, setDispatchSummaryData] = useState([]);

  const handleQuery = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    setLoading(true);
    try {
      const params = {
        startDate: startTime,
        endDate: endTime,
      };

      if (dispatchType === "vehicleUph") {
        const res = await axios.get(`${baseURL}dispatch/vehicle-uph`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/vehicle-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "modelUph") {
        const res = await axios.get(`${baseURL}dispatch/model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/model-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "categoryUph") {
        const res = await axios.get(`${baseURL}dispatch/category-model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/category-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else {
        toast.error("Please select the Report Type.");
        return;
      }
    } catch (error) {
      console.error("Failed to fetch Dispatch Performance Report:", error);
      toast.error(
        "Failed to fetch Dispatch Performance Report data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Quick Filters
  const handleYesterdayQuery = async () => {
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

      setDispatchData([]);
      setDispatchSummaryData([]);
      setDispatchData([]);
      setDispatchSummaryData([]);
      setDispatchData([]);
      setDispatchSummaryData([]);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (dispatchType === "vehicleUph") {
        const res = await axios.get(`${baseURL}dispatch/vehicle-uph`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/vehicle-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "modelUph") {
        const res = await axios.get(`${baseURL}dispatch/model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/model-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "categoryUph") {
        const res = await axios.get(`${baseURL}dispatch/category-model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/category-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else {
        toast.error("Please select the Report Type.");
        return;
      }
    } catch (error) {
      console.error(
        "Failed to fetch Yesterday Dispatch Performance Report:",
        error
      );
      toast.error(
        "Failed to fetch Yesterday Dispatch Performance Report data. Please try again."
      );
    } finally {
      setYdayLoading(false);
    }
  };

  const handleTodayQuery = async () => {
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

      setDispatchData([]);
      setDispatchSummaryData([]);
      setDispatchData([]);
      setDispatchSummaryData([]);
      setDispatchData([]);
      setDispatchSummaryData([]);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (dispatchType === "vehicleUph") {
        const res = await axios.get(`${baseURL}dispatch/vehicle-uph`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/vehicle-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "modelUph") {
        const res = await axios.get(`${baseURL}dispatch/model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/model-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "categoryUph") {
        const res = await axios.get(`${baseURL}dispatch/category-model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/category-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else {
        toast.error("Please select the Report Type.");
        return;
      }
    } catch (error) {
      console.error(
        "Failed to fetch Today Dispatch Performance Report:",
        error
      );
      toast.error(
        "Failed to fetch Today Dispatch Performance Report data. Please try again."
      );
    } finally {
      setTodayLoading(false);
    }
  };

  const handleMonthQuery = async () => {
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

      setDispatchData([]);
      setDispatchSummaryData([]);
      setDispatchData([]);
      setDispatchSummaryData([]);
      setDispatchData([]);
      setDispatchSummaryData([]);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (dispatchType === "vehicleUph") {
        const res = await axios.get(`${baseURL}dispatch/vehicle-uph`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/vehicle-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "modelUph") {
        const res = await axios.get(`${baseURL}dispatch/model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/model-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else if (dispatchType === "categoryUph") {
        const res = await axios.get(`${baseURL}dispatch/category-model-count`, {
          params,
        });
        setDispatchData(res.data);

        const summRes = await axios.get(`${baseURL}dispatch/category-summary`, {
          params,
        });
        setDispatchSummaryData(summRes.data);
      } else {
        toast.error("Please select the Report Type.");
        return;
      }
    } catch (error) {
      console.error(
        "Failed to fetch this Month Dispatch Performance Report:",
        error
      );
      toast.error(
        "Failed to fetch this Month Dispatch Performance Report data. Please try again."
      );
    } finally {
      setMonthLoading(false);
    }
  };

  useEffect(() => {
    setDispatchData([]);
    setDispatchSummaryData([]);
  }, [dispatchType]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Performance Report" align="center" />

      {/* Filters */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl items-center justify-center">
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
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-col flex-wrap items-center gap-4">
            <div className="flex gap-4">
              <div>
                <div className="flex flex-col gap-1">
                  <label>
                    <input
                      type="radio"
                      name="dispatchType"
                      value="vehicleUph"
                      checked={dispatchType === "vehicleUph"}
                      onChange={(e) => setDispatchType(e.target.value)}
                    />
                    Vehicle Loading UPH
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="dispatchType"
                      value="modelUph"
                      checked={dispatchType === "modelUph"}
                      onChange={(e) => setDispatchType(e.target.value)}
                    />
                    Model UPH
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="dispatchType"
                      value="categoryUph"
                      checked={dispatchType === "categoryUph"}
                      onChange={(e) => setDispatchType(e.target.value)}
                    />
                    Category UPH
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-4">
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
              </div>
            </div>
            {/* Count */}
            <div className="mt-4 text-left font-bold text-lg">
              COUNT:{" "}
              <span className="text-blue-700">
                {dispatchSummaryData.length || "0"}
              </span>
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

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-col md:flex-row items-start gap-1">
            {/* Left Side - Detailed Table */}
            <div className="w-full md:flex-1">
              {loading ? (
                <Loader />
              ) : (
                <div className="mt-6">
                  {dispatchType === "vehicleUph" && (
                    <DispatchVehicleUph data={dispatchData} />
                  )}
                  {dispatchType === "modelUph" && (
                    <DispatchModelUph data={dispatchData} />
                  )}
                  {dispatchType === "categoryUph" && (
                    <DispatchCategoryUph data={dispatchData} />
                  )}
                </div>
              )}
            </div>

            {/* Right Side - Controls and Summary */}
            <div className="w-full md:w-[30%] flex flex-col gap-2 overflow-x-hidden">
              {/* Summary Table */}
              <div className="w-full max-h-[500px] overflow-x-auto">
                {loading ? (
                  <Loader />
                ) : (
                  <div className="mt-6">
                    {dispatchType === "vehicleUph" && (
                      <DispatchSummaryVehicleUph data={dispatchSummaryData} />
                    )}
                    {dispatchType === "modelUph" && (
                      <DispatchSummaryModelUph data={dispatchSummaryData} />
                    )}
                    {dispatchType === "categoryUph" && (
                      <DispatchSummaryCategoryUph data={dispatchSummaryData} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DispatchVehicleUph = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">Hour Number</th>
            <th className="px-1 py-1 border min-w-[120px]">Time Hour</th>
            <th className="px-1 py-1 border min-w-[120px]">Count</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.HOUR_NUMBER}</td>
                <td className="px-1 py-1 border">{row.TIMEHOUR}</td>
                <td className="px-1 py-1 border">{row.COUNT}</td>
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

const DispatchModelUph = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">HOUR NUMBER</th>
            <th className="px-1 py-1 border min-w-[120px]">TIME HOUR</th>
            <th className="px-1 py-1 border min-w-[120px]">COUNT</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.HOUR_NUMBER}</td>
                <td className="px-1 py-1 border">{row.TIMEHOUR}</td>
                <td className="px-1 py-1 border">{row.COUNT}</td>
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

const DispatchCategoryUph = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 sticky top-0 z-10 text-center">
          <tr>
            <th className="px-1 py-1 border min-w-[120px]">HOUR NUMBER</th>
            <th className="px-1 py-1 border min-w-[120px]">TIME HOUR</th>
            <th className="px-1 py-1 border min-w-[120px]">COUNT</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.HOUR_NUMBER}</td>
                <td className="px-1 py-1 border">{row.TIMEHOUR}</td>
                <td className="px-1 py-1 border">{row.COUNT}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// <------- Summay Table ------->

const DispatchSummaryVehicleUph = ({ data }) => {
  return (
    <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
      <thead className="bg-gray-200 sticky top-0 z-10 text-center">
        <tr>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Hour Number
          </th>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Time Hour
          </th>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Session ID
          </th>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Model Count
          </th>
        </tr>
      </thead>
      <tbody>
        {data && data.length > 0 ? (
          data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-100 text-center">
              <td className="px-1 py-1 border">{row.HOUR_NUMBER}</td>
              <td className="px-1 py-1 border">{row.TIMEHOUR}</td>
              <td className="px-1 py-1 border">{row.session_ID}</td>
              <td className="px-1 py-1 border">{row.Model_Count}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8} className="text-center py-4">
              No data found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

const DispatchSummaryModelUph = ({ data }) => {
  return (
    <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
      <thead className="bg-gray-200 sticky top-0 z-10 text-center">
        <tr>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Time Hour
          </th>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Model Name
          </th>

          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Count
          </th>
        </tr>
      </thead>
      <tbody>
        {data && data.length > 0 ? (
          data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-100 text-center">
              <td className="px-1 py-1 border">{row.TIMEHOUR}</td>
              <td className="px-1 py-1 border">{row.ModelName}</td>
              <td className="px-1 py-1 border">{row.COUNT}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8} className="text-center py-4">
              No data found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

const DispatchSummaryCategoryUph = ({ data }) => {
  return (
    <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
      <thead className="bg-gray-200 sticky top-0 z-10 text-center">
        <tr>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Model Name
          </th>
          <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
            Count
          </th>
        </tr>
      </thead>
      <tbody>
        {data && data.length > 0 ? (
          data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-100 text-center">
              <td className="px-1 py-1 border">{row.ModelName}</td>
              <td className="px-1 py-1 border">{row.COUNT}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8} className="text-center py-4">
              No data found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default DispatchPerformanceReport;