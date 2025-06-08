import { useEffect, useState } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import DateTimePicker from "../../components/common/DateTimePicker";
import axios from "axios";
import Loader from "../../components/common/Loader";
import ExportButton from "../../components/common/ExportButton";
import toast from "react-hot-toast";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const DispatchPerformanceReport = () => {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    setDispatchData([]);
    setDispatchSummaryData([]);
  }, [dispatchType]);

  const handleClearFilters = () => {
    setStartTime("");
    setEndTime("");
    setDispatchType("vehicleUph");
    setDispatchData([]);
    setDispatchSummaryData([]);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Performance Report" align="center" />

      {/* Filters */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 max-w-4xl items-center justify-center">
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
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md mt-6">
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
                <ExportButton />
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
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
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
              {/* Filter + Export Buttons */}
              <div className="flex flex-wrap gap-2 items-center justify-center my-4">
                <Button
                  bgColor="bg-white"
                  textColor="text-black"
                  className="border border-gray-400 hover:bg-gray-100 px-3 py-1"
                  onClick={handleClearFilters}
                >
                  Clear Filter
                </Button>
                <ExportButton />
              </div>

              {/* Summary Table */}
              <div className="w-full max-h-[500px] overflow-x-auto">
                {loading ? (
                  <Loader />
                ) : (
                  <>
                    {dispatchType === "vehicleUph" && (
                      <DispatchSummaryVehicleUph data={dispatchSummaryData} />
                    )}
                    {dispatchType === "modelUph" && (
                      <DispatchSummaryModelUph data={dispatchSummaryData} />
                    )}
                    {dispatchType === "categoryUph" && (
                      <DispatchSummaryCategoryUph data={dispatchSummaryData} />
                    )}
                  </>
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
            <th className="px-1 py-1 border min-w-[120px]">COUNT</th>
            <th className="px-1 py-1 border min-w-[120px]">HOUR NUMBER</th>
            <th className="px-1 py-1 border min-w-[120px]">TIME HOUR</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.COUNT}</td>
                <td className="px-1 py-1 border">{row.HOUR_NUMBER}</td>
                <td className="px-1 py-1 border">{row.TIMEHOUR}</td>{" "}
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
