import Title from "../../components/common/Title";
import Loader from "../../components/common/Loader";
import { useState } from "react";

const ReworkReport = () => {
  const [loading, setLoading] = useState(false);
  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Rework Report" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        {/* <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl items-center">
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
        </div> */}

        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          {/* <div className="flex flex-wrap items-center gap-4">
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
                  <ExportButton data={reportData} filename="CPT_Report" />
                )}
              </div>
              <div className="text-left font-bold text-lg">
                COUNT:{" "}
                <span className="text-blue-700">{totalCount || "0"}</span>
              </div>
            </div>
          </div> */}
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
