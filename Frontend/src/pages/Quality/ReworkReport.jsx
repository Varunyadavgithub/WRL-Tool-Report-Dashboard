import Title from "../../components/common/Title";
import Loader from "../../components/common/Loader";
import { useState } from "react";
import SelectField from "../../components/common/SelectField";
import DateTimePicker from "../../components/common/DateTimePicker";
import Button from "../../components/common/Button";
import ExportButton from "../../components/common/ExportButton";

const ReworkReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const stageOption = [
    { label: "Post Foaming", value: "post-foaming" },
    { label: "Gas Charging", value: "gas-charging" },
    { label: "EST", value: "est" },
    { label: "HLD", value: "hld" },
    { label: "Final Inspection", value: "final-inspection" },
  ];
  const [selecedStage, setSelectedStage] = useState(stageOption[0]);
  const [totalReworkData, setTotalReworkData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [lineType, setLineType] = useState("1");

  const handleQuery = () => {
    console.log("Handle Query Clicked.");
  };

  const fetchExportData = async () => {
    console.log("Fetch Export data clicked.");
  };
  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Rework Report" align="center" />

      {/* Filters Section */}
      <div className="flex gap-4 items-start">
        {/* Box 1: Main Filters */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-6 rounded-xl w-full max-w-[650px]">
          {/* Row 1: Stage + Line Type */}
          <div className="flex flex-wrap gap-8 items-start">
            <SelectField
              label="Stage"
              options={stageOption}
              value={selecedStage?.value || ""}
              onChange={(e) =>
                setSelectedStage(
                  stageOption.find((opt) => opt.value === e.target.value) ||
                    null
                )
              }
              className="w-64"
            />

            {/* Line Type */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-purple-700">
                Line Type
              </span>

              {[
                { value: "1", label: "Freezer Line" },
                { value: "2", label: "Chocolate Line" },
                { value: "3", label: "SUS Line" },
              ].map((item) => (
                <label key={item.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="lineType"
                    value={item.value}
                    checked={lineType === item.value}
                    onChange={(e) => setLineType(e.target.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {/* Row 2: Date Pickers */}
          <div className="flex flex-wrap gap-8 mt-6">
            <DateTimePicker
              label="Start Time"
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-64"
            />

            <DateTimePicker
              label="End Time"
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-64"
            />
          </div>
        </div>

        {/* Box 2: Query + Count */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl h-fit">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleQuery}
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                Query
              </Button>

              {totalReworkData.length > 0 && (
                <ExportButton
                  fetchData={fetchExportData}
                  filename="Total_Production_Report"
                />
              )}
            </div>

            <div className="mt-2 font-bold text-lg text-center">
              COUNT: <span className="text-blue-700">{totalCount}</span>
            </div>
          </div>
        </div>

        {/* Box 3: Quick Filters */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl h-fit">
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
              disabled={ydayLoading}
            >
              YDAY
            </Button>
            {ydayLoading && <Loader />}

            <Button
              bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
              textColor={todayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                todayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              disabled={todayLoading}
            >
              TDAY
            </Button>
            {todayLoading && <Loader />}

            <Button
              bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
              textColor={monthLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                monthLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              disabled={monthLoading}
            >
              MTD
            </Button>
            {monthLoading && <Loader />}
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
                        Model Name
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Category
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">Defect</th>
                      <th className="px-1 py-1 border min-w-[100px]">Part</th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Root Cause
                      </th>
                      <th className="px-1 py-1 border max-w-[100px]">Date</th>
                      <th className="px-1 py-1 border min-w-[100px]">Shift</th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Fail Category
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">Origin</th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Containment Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* {reportData.map((item, index) => (
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
                    )} */}
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

export default ReworkReport;
