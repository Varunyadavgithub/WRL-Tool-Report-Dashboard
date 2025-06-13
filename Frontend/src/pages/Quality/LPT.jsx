import { useState } from "react";
import Button from "../../components/common/Button";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import Loader from "../../components/common/Loader";
import SelectField from "../../components/common/SelectField";

const LPT = () => {
  const Temperature = [
    { label: "Low (25°C)", value: "25" },
    { label: "Medium (35°C)", value: "35" },
    { label: "High (45°C)", value: "45" },
  ];
  const Current = [
    { label: "Low (5 A)", value: "5" },
    { label: "Medium (10 A)", value: "10" },
    { label: "High (15 A)", value: "15" },
  ];

  const [loading, setLoading] = useState(false);
  const [selectedTemp, setSelectedTemp] = useState(Temperature[0]);
  const [selectedCurr, setSelectedCurr] = useState(Current[0]);

  const getCurrentShift = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Convert current time to minutes since midnight
    const totalMinutes = hours * 60 + minutes;

    // Shift 1: 08:00 (480 minutes) to 20:00 (1200 minutes)
    // Shift 2: 20:01 to 07:59 (the rest of the day)
    if (totalMinutes >= 480 && totalMinutes < 1200) {
      return { label: "Shift 1", value: "shift 1" };
    } else {
      return { label: "Shift 2", value: "shift 2" };
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="LPT" align="center" />

      {/* Filters Section */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Card */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Barcode & Search */}
            <div className="flex flex-col gap-4 items-start">
              <InputField
                label="Scan Barcode"
                type="text"
                placeholder="Enter Barcode Number"
                className="w-56"
                name="barcodeNumber"
              />
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                // onClick={getAssetDetails}
                disabled={loading}
              >
                Search
              </Button>
            </div>

            {/* Info Section */}
            <div className="flex flex-col gap-3">
              <h1 className="font-semibold text-md">
                Model Name:{" "}
                <span className="text-blue-700 text-sm">
                  {/* {assetDetails.ModelName || 0} */} 0
                </span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          {/* Control */}
          <div className="flex flex-wrap gap-4 items-start justify-start bg-gradient-to-r from-purple-100 via-white to-purple-100 p-4 rounded-lg shadow-sm mb-2">
            <InputField
              label="Current Shift"
              type="text"
              value={getCurrentShift().label}
              readOnly
              className="max-w-65"
            />
            <SelectField
              label="Temp"
              options={Temperature}
              value={selectedTemp.value || ""}
              onChange={(e) => {
                const selected = Temperature.find(
                  (item) => item.value === e.target.value
                );
                setSelectedTemp(selected);
              }}
              className="w-60"
            />
            <SelectField
              label="Current"
              options={Current}
              value={selectedCurr.value || ""}
              onChange={(e) => {
                const selected = Current.find(
                  (item) => item.value === e.target.value
                );
                setSelectedCurr(selected);
              }}
              className="w-60"
            />
            <InputField
              label="Set Value"
              type="text"
              //   value={getCurrentShift().label}
              readOnly
              className="max-w-65"
            />
            <InputField
              label="Actual"
              type="text"
              //   value={getCurrentShift().label}
              readOnly
              className="max-w-65"
            />
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold h-fit mt-6 ${
                loading ? "cursor-not-allowed" : ""
              }`}
              onClick={console.log("Handle Add")}
              disabled={loading}
            >
              Add Defect
            </Button>
          </div>

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
                        <th className="px-1 py-1 border">Date</th>
                        <th className="px-1 py-1 border">Model</th>
                        <th className="px-1 py-1 border">Shift</th>
                        <th className="px-1 py-1 border">FG Sr.No</th>
                        <th className="px-1 py-1 border">Category</th>
                        <th className="px-1 py-1 border">Add Defect</th>
                        <th className="px-1 py-1 border">Set Temp</th>
                        <th className="px-1 py-1 border">Remark</th>
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

            {/* Right Side */}
            <div className="w-full md:w-[30%] flex flex-col gap-2 overflow-x-hidden">
              {/* Right Side Table */}
              {loading ? (
                <Loader />
              ) : (
                <div className="w-full max-h-[500px] overflow-x-auto">
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                      <tr>
                        <th className="px-1 py-1 border">Model Name</th>
                        <th className="px-1 py-1 border">Production Count</th>
                        <th className="px-1 py-1 border">LPT</th>
                        <th className="px-1 py-1 border">Sample Tested</th>
                        <th className="px-1 py-1 border">Test Pending</th>
                        <th className="px-1 py-1 border">LPT %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* {fpaCountData && fpaCountData.length > 0 ? (
                        fpaCountData.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-100 text-center"
                          >
                            <td className="px-1 py-1 border">
                              {item.ModelName}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ModelCount}
                            </td>
                            <td className="px-1 py-1 border">{item.FPA}</td>
                            <td className="px-1 py-1 border">
                              {item.SampleInspected}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-4">
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

export default LPT;
