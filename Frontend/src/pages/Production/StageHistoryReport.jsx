import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import Button from "../../components/common/Button";
import { useState } from "react";
import axios from "axios";
import Loader from "../../components/common/Loader";
import ExportButton from "../../components/common/ExportButton";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

function StageHistoryReport() {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [stageHistoryData, setStageHistoryData] = useState([]);
  const [productName, setProductName] = useState("");

  const fetchStageHistoryData = async () => {
    if (!serialNumber) {
      toast.error("Please select Serial Number.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}prod/stage-history`, {
        params: { serialNumber },
      });
      const data = res.data?.result?.recordsets[0] || [];
      setStageHistoryData(data);
      if (data.length > 0 && data[0].MaterialName) {
        setProductName(data[0].MaterialName);
      } else {
        setProductName("");
      }
    } catch (error) {
      console.error("Failed to fetch fetch Stage History data:", error);
      toast.error("Failed to fetch fetch Stage History data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Stage History Report" align="center" />

      {/* Filters Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
        {/* First Row */}
        <div className="flex flex-wrap items-center gap-4">
          <InputField
            label="Serial Number"
            type="text"
            placeholder="Enter details"
            className="w-64"
            name="serialNumber"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
          <div className="flex items-center justify-center gap-4">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={() => fetchStageHistoryData()}
              disabled={loading}
            >
              Query
            </Button>
            {stageHistoryData && stageHistoryData.length > 0 && (
              <ExportButton
                data={stageHistoryData}
                filename="Stage_History_Report"
              />
            )}
          </div>
          {/* Product Name */}
          <div className="mt-4 text-left font-bold text-lg">
            Product Name: <span className="text-blue-700">{productName}</span>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Table 1 */}
            {loading ? (
              <Loader />
            ) : (
              <div className="w-full max-h-[600px] overflow-x-auto">
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border min-w-[120px]">PSNO</th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Station_Code
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">Name</th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Activity On
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">Alias</th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Customer QR
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        V Serial
                      </th>
                      {/* <th className="px-1 py-1 border min-w-[120px]">Alias 1</th> */}
                      <th className="px-1 py-1 border min-w-[120px]">Serial</th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Activity Type
                      </th>
                      {/* <th className="px-1 py-1 border min-w-[120px]">Type</th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {stageHistoryData.length > 0 ? (
                      stageHistoryData.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{item.PSNO}</td>
                          <td className="px-1 py-1 border">
                            {item.StationCode}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.StationName}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.ActivityOn &&
                              item.ActivityOn.replace("T", " ").replace(
                                "Z",
                                ""
                              )}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.BarcodeAlias}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.CustomerQR}
                          </td>
                          <td className="px-1 py-1 border">{item.VSerial}</td>
                          {/* <td className="px-1 py-1 border">{item.Alias 1}</td> */}
                          <td className="px-1 py-1 border">{item.Serial}</td>
                          <td className="px-1 py-1 border">
                            {item.ActivityType}
                          </td>
                          {/* <td className="px-1 py-1 border">N/A</td> */}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StageHistoryReport;