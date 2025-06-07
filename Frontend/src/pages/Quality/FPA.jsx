import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import Button from "../../components/common/Button";
import SelectField from "../../components/common/SelectField";
import Loader from "../../components/common/Loader";
import { getFormattedISTDate } from "../../utils/dateUtils";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const FPA = () => {
  const DefectCategory = [
    { label: "Minor", value: "minor" },
    { label: "Major", value: "major" },
    { label: "Critical", value: "critical" },
  ];

  const [loading, setLoading] = useState(false);
  const [barcodeNumber, setBarcodeNumber] = useState("");
  const [addManually, setAddManually] = useState(false);
  const [manualCategory, setManualCategory] = useState("");
  const [fpaDefectCategory, setFpaDefectCategory] = useState([]);
  const [selectedFpaDefectCategory, setSelectedFpaDefectCategory] =
    useState(null);
  const [fpaCountData, setFpaCountData] = useState([]);
  const [assetDetails, setAssetDetails] = useState([]);
  const [fpqiDetails, setFpqiDetails] = useState([]);
  const [fpaDefect, setFpaDefect] = useState([]);

  const [remark, setRemark] = useState("");
  const [country, setCountry] = useState("India");
  const [selectedDefectCategory, setSelectedDefectCategory] = useState(
    DefectCategory[0]
  );

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

  const getFPACountData = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${baseURL}quality/fpa-count`);
      setFpaCountData(res?.data);
    } catch (error) {
      console.error("Failed to fetch production data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAssetDetails = async () => {
    if (!barcodeNumber) {
      toast.error("Please select Barcode Number");
      return;
    }

    try {
      setLoading(true);
      const params = {
        AssemblySerial: barcodeNumber,
      };

      const res = await axios.get(`${baseURL}quality/asset-details`, {
        params,
      });
      setAssetDetails(res?.data);
    } catch (error) {
      console.error("Failed to fetch production data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFPQIDetails = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/fpqi-details`);
      setFpqiDetails(res?.data);
    } catch (error) {
      console.error("Failed to fetch production data:", error);
    }
  };

  const getFpaDefect = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/fpa-defect`);
      setFpaDefect(res?.data);
    } catch (error) {
      console.error("Failed to fetch production data:", error);
    }
  };

  const getFpaDefectCategory = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/fpa-defect-category`);
      const formatted = res?.data.map((item) => ({
        label: item.Name,
        value: item.Code.toString(),
      }));
      setFpaDefectCategory(formatted);
    } catch (error) {
      console.error("Failed to fetch production data:", error);
    }
  };

  const handleAddDefect = async () => {
    if (!assetDetails.FGNo || !assetDetails.ModelName) {
      toast.error("Asset details not available. Please scan a barcode.");
      return;
    }

    if (!selectedDefectCategory?.value) {
      toast.error("Please select a defect category.");
      return;
    }

    const defectToAdd = addManually
      ? manualCategory?.trim()
      : selectedFpaDefectCategory.label;

    if (!defectToAdd || defectToAdd.length === 0) {
      toast.error("Please select or enter a defect.");
      return;
    }

    try {
      setLoading(true);

      const dynamicShift = getCurrentShift();

      const payload = {
        model: assetDetails.ModelName,
        shift: dynamicShift.value,
        FGSerialNumber: assetDetails.FGNo,
        Category: selectedDefectCategory.value,
        AddDefect: defectToAdd,
        Remark: remark,
        currentDateTime: getFormattedISTDate(),
        country,
      };

      const res = await axios.post(`${baseURL}quality/add-fpa-defect`, payload);

      console.log(res);

      if (res?.data?.success) {
        toast.success(res?.data?.message || "Defect added successfully!");
        setRemark("");
        setManualCategory("");
        setSelectedFpaDefectCategory(null);
        setAddManually(false);
        getFpaDefect(); // Refresh defect table
        getFPACountData(); // Refresh count data
        getFPQIDetails(); // Refresh FPQI values
      }
    } catch (error) {
      console.error("Add Defect Error:", error.response?.data || error.message);
      toast.error("An error occurred while adding the defect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getFPQIDetails();
    getFpaDefect();
    getFPACountData();
    getFpaDefectCategory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="FPA" align="center" />

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
                value={barcodeNumber}
                onChange={(e) => setBarcodeNumber(e.target.value)}
              />
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={getAssetDetails}
                disabled={loading}
              >
                Search
              </Button>
              <h1 className="font-semibold text-xl mt-2">
                No of Sample Inspected:{" "}
                <span className="text-blue-700 text-md">
                  {fpqiDetails.TotalFGSRNo || "0"}
                </span>
              </h1>
            </div>

            {/* Info Section */}
            <div className="flex flex-col gap-3">
              <h1 className="font-semibold text-md">
                FG No:{" "}
                <span className="text-blue-700 text-sm">
                  {assetDetails.FGNo || 0}
                </span>
              </h1>
              <h1 className="font-semibold text-md">
                Asset No:{" "}
                <span className="text-blue-700 text-sm">
                  {assetDetails.AssetNo || 0}
                </span>
              </h1>
              <h1 className="font-semibold text-md">
                Model Name:{" "}
                <span className="text-blue-700 text-sm">
                  {assetDetails.ModelName || 0}
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Right Card */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md w-full lg:max-w-xs flex flex-col items-center justify-center gap-4">
          <h1 className="font-bold text-2xl">FPQI</h1>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold text-md">
                No. of Criticals:{" "}
                <span className="text-blue-700 text-sm">
                  {fpqiDetails.NoOfCritical || "0"}
                </span>
              </h1>
              <h1 className="font-semibold text-md">
                No. of Majors:{" "}
                <span className="text-blue-700 text-sm">
                  {fpqiDetails.NoOfMajor || "0"}
                </span>
              </h1>
              <h1 className="font-semibold text-md">
                No. of Miniors:{" "}
                <span className="text-blue-700 text-sm">
                  {fpqiDetails.NoOfMinor || "0"}
                </span>
              </h1>
            </div>
            <div className="text-center">
              <h1 className="font-semibold text-lg">
                FPQI Value:{" "}
                <span className="text-green-700">
                  {fpqiDetails.FPQI
                    ? Number(fpqiDetails.FPQI).toFixed(2)
                    : "0.00"}{" "}
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
            <SelectField
              label="Category"
              options={DefectCategory}
              value={selectedDefectCategory.value || ""}
              onChange={(e) => {
                const selected = DefectCategory.find(
                  (item) => item.value === e.target.value
                );
                setSelectedDefectCategory(selected);
              }}
              className="w-60"
            />
            <InputField
              label="Country"
              type="text"
              placeholder="Enter Country"
              className="max-w-40"
              name="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <InputField
              label="Current Shift"
              type="text"
              value={getCurrentShift().label}
              readOnly
              className="max-w-65"
            />

            <div className="flex flex-col gap-2 w-72">
              {/* Radio Button Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="addManually"
                  checked={addManually}
                  onChange={() => setAddManually(!addManually)}
                  className="cursor-pointer"
                />
                <label
                  htmlFor="addManually"
                  className="cursor-pointer font-medium"
                >
                  Add Defect Manually
                </label>
              </div>

              {/* Conditional Rendering */}
              {addManually ? (
                <InputField
                  label="Manual Defect Category"
                  type="text"
                  placeholder="Enter defect category"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                />
              ) : (
                <SelectField
                  label="Select Defect Category"
                  options={fpaDefectCategory}
                  value={selectedFpaDefectCategory?.value || ""}
                  onChange={(e) => {
                    const selected = fpaDefectCategory.find(
                      (option) => option.value === e.target.value
                    );
                    setSelectedFpaDefectCategory(selected);
                  }}
                />
              )}
            </div>

            <InputField
              label="Remark"
              type="text"
              placeholder="Enter Remark"
              className="w-64"
              name="remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />

            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold h-fit mt-6 ${
                loading ? "cursor-not-allowed" : ""
              }`}
              onClick={handleAddDefect}
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
                        <th className="px-1 py-1 border">Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fpaDefect && fpaDefect.length > 0 ? (
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
                      )}
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
                        <th className="px-1 py-1 border">Model Count</th>
                        <th className="px-1 py-1 border">FPA</th>
                        <th className="px-1 py-1 border">Sample Inspected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fpaCountData && fpaCountData.length > 0 ? (
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
                      )}
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

export default FPA;
