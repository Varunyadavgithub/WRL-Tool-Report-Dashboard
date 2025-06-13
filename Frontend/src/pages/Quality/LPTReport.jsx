import { useState } from "react";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import Title from "../../components/common/Title";
import DateTimePicker from "../../components/common/DateTimePicker";

const LPTReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reportType, setReportType] = useState("lptReport");
  const [reportData, setReportData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState("");

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="LPT Report" align="center" />

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
        </div>

        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="flex flex-col gap-1">
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="lptReport"
                    checked={reportType === "lptReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  LPT Report
                </label>
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="dailyLptReport"
                    checked={reportType === "dailyLptReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  Daily LPT Report
                </label>
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="monthlyLptReport"
                    checked={reportType === "monthlyLptReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  Monthly LPT Report
                </label>
                <label>
                  <input
                    type="radio"
                    name="reportType"
                    value="yearlyLptReport"
                    checked={reportType === "yearlyLptReport"}
                    onChange={(e) => setReportType(e.target.value)}
                  />
                  Yearly LPT Report
                </label>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={console.log("Handle Query")}
                  disabled={loading}
                >
                  Query
                </Button>
                {reportData && reportData.length > 0 && (
                  <ExportButton data={reportData} filename="LPT_Report" />
                )}
              </div>
              <div className="text-left font-bold text-lg">
                COUNT: <span className="text-blue-700">0 </span>
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
              onClick={() => console.log("YDAY")}
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
              onClick={() => console.log("TDAY")}
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
              onClick={() => console.log("MTD")}
              disabled={monthLoading}
            >
              MTD
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-col md:flex-row items-start gap-1">
            {/* Left Side */}
            <div className="w-full md:flex-1 flex flex-col gap-2">
              {/* Left Side Table */}
              {loading ? (
                <Loader />
              ) : (
                <div className="w-full max-h-[600px] overflow-x-auto">
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                      <tr>
                        <th className="px-1 py-1 border">Sr.No.</th>
                        <th className="px-1 py-1 border">Date Time</th>
                        <th className="px-1 py-1 border">Shift</th>
                        <th className="px-1 py-1 border">Model</th>
                        <th className="px-1 py-1 border">Assembly No.</th>
                        <th className="px-1 py-1 border">Set Temp</th>
                        <th className="px-1 py-1 border">Actual Temp</th>
                        <th className="px-1 py-1 border">Set Current</th>
                        <th className="px-1 py-1 border">Actual Current</th>
                        <th className="px-1 py-1 border">Set Power</th>
                        <th className="px-1 py-1 border">Actual Power</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* {fpaDefect && fpaDefect.length > 0 ? (
                        fpaDefect.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-100 text-center"
                          >
                            <td className="px-1 py-1 border">{item.SRNo}</td>
                            <td className="px-1 py-1 border">
                              {item.Date &&
                                item.Date.replace("T", " ").replace("Z", "")}
                            </td>
                            <td className="px-1 py-1 border">{item.Model}</td>
                            <td className="px-1 py-1 border">{item.Shift}</td>

                            <td className="px-1 py-1 border">{item.FGSRNo}</td>
                            <td className="px-1 py-1 border">
                              {item.Category}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.AddDefect}
                            </td>
                            <td className="px-1 py-1 border">{item.Remark}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-4">
                            No data found.
                          </td>
                        </tr>
                      )} */}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPTReport;
