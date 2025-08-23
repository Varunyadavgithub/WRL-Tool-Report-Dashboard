import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExportButton from "../../components/common/ExportButton";
import Loader from "../../components/common/Loader";
import { baseURL } from "../../assets/assets";

const MFTReport = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reportData, setReportData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const handleQuery = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    setLoading(true);
    try {
      const formattedStartDate = new Date(startTime)
        .toISOString()
        .split("T")[0];
      const formattedEndDate = new Date(endTime).toISOString().split("T")[0];

      const params = {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      };

      const res = await axios.get(`${baseURL}quality/mft-report`, {
        params,
      });

      if (res?.data?.success) {
        setReportData(res?.data?.data);
        setTotalCount(res?.data?.data?.length);
      }
    } catch (error) {
      console.error("Failed to fetch MFT Report:", error);
      toast.error("Failed to fetch MFT Report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="MFT Reports" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl items-center">
          <div className="flex flex-col gap-1 font-playfair">
            <label className="font-semibold text-md">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="border px-2 py-1 rounded-md"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-md">End Date</label>
            <input
              type="date"
              name="endDate"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="border px-2 py-1 rounded-md"
            />
          </div>
        </div>

        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap gap-2">
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
                {reportData && reportData.length > 0 && (
                  <ExportButton data={reportData} filename="MFT_Report" />
                )}
              </div>
              <div className="text-left font-bold text-lg">
                COUNT:{" "}
                <span className="text-blue-700">{totalCount || "0"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex flex-col items-center mb-4">
          <span className="text-xl font-semibold">Summary</span>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-wrap gap-1">
            <div className="w-full md:flex-1">
              <div className="w-full overflow-x-auto">
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border max-w-[100px]">Sr.No.</th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Result ID
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">Date</th>
                      <th className="px-1 py-1 border min-w-[100px]">Time</th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Barcode
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">Model</th>
                      <th className="px-1 py-1 border max-w-[100px]">
                        Model Name
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Runtime Minutes
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Max Temp.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Min Temp.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Max Curr.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Min Curr.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Max Volt.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Min Volt.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Max Pow.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Min Pow.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Performance
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Fault Code
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Fault Name
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Area ID
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{index + 1}</td>
                        <td className="px-1 py-1 border">{item.Result_ID}</td>
                        <td className="px-1 py-1 border">{item.DATE}</td>
                        <td className="px-1 py-1 border">{item.TIME}</td>
                        <td className="px-1 py-1 border">{item.BARCODE}</td>
                        <td className="px-1 py-1 border">{item.MODEL}</td>
                        <td className="px-1 py-1 border">{item.MODELNAME}</td>
                        <td className="px-1 py-1 border">
                          {item.RUNTIME_MINUTES}
                        </td>
                        <td className="px-1 py-1 border">
                          {item.MAX_TEMPERATURE}
                        </td>
                        <td className="px-1 py-1 border">
                          {item.MIN_TEMPERATURE}
                        </td>
                        <td className="px-1 py-1 border">{item.MAX_CURRENT}</td>
                        <td className="px-1 py-1 border">{item.MIN_CURRENT}</td>
                        <td className="px-1 py-1 border">{item.MAX_VOLTAGE}</td>
                        <td className="px-1 py-1 border">{item.MIN_VOLTAGE}</td>
                        <td className="px-1 py-1 border">{item.MAX_POWER}</td>
                        <td className="px-1 py-1 border">{item.MIN_POWER}</td>
                        <td className="px-1 py-1 border">{item.PERFORMANCE}</td>
                        <td className="px-1 py-1 border">{item.FaultCode}</td>
                        <td className="px-1 py-1 border">{item.FaultName}</td>
                        <td className="px-1 py-1 border">{item.AREA_ID}</td>
                      </tr>
                    ))}
                    {!loading && reportData.length === 0 && (
                      <tr>
                        <td colSpan={20} className="text-center py-4">
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {loading && <Loader />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MFTReport;
