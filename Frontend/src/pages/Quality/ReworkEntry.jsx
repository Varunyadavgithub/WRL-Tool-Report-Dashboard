import Title from "../../components/common/Title";
import { useState } from "react";

const ReworkEntry = () => {
  const [loading, setLoading] = useState(false);
  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Rework Entry" align="center" />

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
    </div>
  );
};

export default ReworkEntry;
