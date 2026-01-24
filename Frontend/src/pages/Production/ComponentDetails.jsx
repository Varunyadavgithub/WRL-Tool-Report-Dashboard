import axios from "axios";
import { useState } from "react";
import toast from "react-hot-toast";
import Title from "../../components/ui/Title";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import ExportButton from "../../components/ui/ExportButton";
import Loader from "../../components/ui/Loader";
import { baseURL } from "../../assets/assets";

const ComponentDetails = () => {
  const [loading, setLoading] = useState(false);
  const [componentIdentifier, setComponentIdentifier] = useState("");
  const [componentDetailsData, setComponentDetailsData] = useState([]);

  const fetchComponentDetailsData = async () => {
    if (!componentIdentifier) {
      toast.error("Please enter the Serial Number or FG Number.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}prod/component-details`, {
        params: { componentIdentifier },
      });

      if (res?.data?.success) {
        const data = res?.data?.data || [];
        setComponentDetailsData(data);
      }
    } catch (error) {
      console.error("Failed to fetch Component Details Data:", error);
      toast.error("Failed to fetch Component Details Data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Component Details" align="center" />

      {/* Filters Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 max-w-fit rounded-xl">
        <div className="flex flex-wrap items-center gap-4">
          <InputField
            label="Serial Number / FG No."
            type="text"
            placeholder="Enter details"
            className="w-64"
            name="componentIdentifier "
            value={componentIdentifier}
            onChange={(e) => setComponentIdentifier(e.target.value)}
          />
          <div className="flex items-center justify-center gap-4">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={() => fetchComponentDetailsData()}
              disabled={loading}
            >
              Query
            </Button>
            {componentDetailsData && componentDetailsData.length > 0 && (
              <ExportButton
                data={componentDetailsData}
                filename="Component_Details_Report"
              />
            )}
          </div>

          <div className="mt-4 text-left font-bold text-lg">
            COUNT:{" "}
            <span className="text-blue-700">
              {componentDetailsData.length || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-md p-4">
          {loading ? (
            <Loader />
          ) : (
            <div className="max-h-[600px] overflow-x-auto">
              <table className=" border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Model Name
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Reference Barcode
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Component Serial Number
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Component Name
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Component Type
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Supplier Name
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      FG Sr. No
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">PSNo</th>
                    <th className="px-1 py-1 border min-w-[120px]">Alias</th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      ScannedOn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {componentDetailsData.length > 0 ? (
                    componentDetailsData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{item.Model_Name}</td>
                        <td className="px-1 py-1 border">
                          {item.Reference_Barcode}
                        </td>
                        <td className="px-1 py-1 border">
                          {item.Component_Serial_Number}
                        </td>
                        <td className="px-1 py-1 border">
                          {item.Component_Name}
                        </td>
                        <td className="px-1 py-1 border">
                          {item.Component_Type}
                        </td>
                        <td className="px-1 py-1 border">
                          {item.Supplier_Name}
                        </td>
                        <td className="px-1 py-1 border">{item.Fg_Sr_No}</td>
                        <td className="px-1 py-1 border">{item.PSNo}</td>
                        <td className="px-1 py-1 border">{item.Alias}</td>
                        <td className="px-1 py-1 border">
                          {item.ScannedOn &&
                            item.ScannedOn.replace("T", " ").replace("Z", "")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-4">
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
  );
};

export default ComponentDetails;
