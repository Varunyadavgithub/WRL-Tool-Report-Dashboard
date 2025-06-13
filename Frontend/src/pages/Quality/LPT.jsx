import { useEffect, useState } from "react";
import Button from "../../components/common/Button";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import Loader from "../../components/common/Loader";
import SelectField from "../../components/common/SelectField";
import { WiThermometer } from "react-icons/wi";
import { FaBolt } from "react-icons/fa";
import { MdPowerSettingsNew } from "react-icons/md";
import toast from "react-hot-toast";
import axios from "axios";
import { getFormattedISTDate } from "../../utils/dateUtils.js";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const LPT = () => {
  const [loading, setLoading] = useState(false);
  const [barcodeNumber, setBarcodeNumber] = useState("");
  const [assetDetails, setAssetDetails] = useState([]);
  const [setTemp, setSetTemp] = useState("");
  const [actualTemp, setActualTemp] = useState("");
  const [setCurrent, setSetCurrent] = useState("");
  const [actualCurrent, setActualCurrent] = useState("");
  const [setPower, setSetPower] = useState("");
  const [actualPower, setActualPower] = useState("");
  const [addManually, setAddManually] = useState(false);
  const [manualCategory, setManualCategory] = useState("");
  const [lptDefectCategory, setLptDefectCategory] = useState([]);
  const [selectedLptDefectCategory, setSelectedLptDefectCategory] =
    useState(null);
  const [remark, setRemark] = useState("");
  const [lptDefectReport, setLptDefectReport] = useState([]);
  const [lptDefectCount, setLptDefectCount] = useState([]);

  const getLptDefectReport = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${baseURL}quality/lpt-defect-report`);
      setLptDefectReport(res?.data);
    } catch (error) {
      console.error("Failed to fetch Lpt Defect data:", error);
      toast.error("Failed to fetch Lpt Defect data.");
    } finally {
      setLoading(false);
    }
  };

  const getLptDefectCount = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${baseURL}quality/lpt-defect-count`);
      setLptDefectCount(res?.data);
    } catch (error) {
      console.error("Failed to fetch Lpt Defect data:", error);
      toast.error("Failed to fetch Lpt Defect data.");
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
      const res = await axios.get(`${baseURL}quality/lpt-asset-details`, {
        params,
      });
      setAssetDetails(res?.data);
    } catch (error) {
      console.error("Failed to fetch Asset Details data:", error);
      toast.error("Failed to fetch Asset Details data.");
    } finally {
      setLoading(false);
    }
  };

  const getLptDefectCategory = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/lpt-defect-category`);
      const formatted = res?.data.map((item) => ({
        label: item.Name,
        value: item.Code.toString(),
      }));
      setLptDefectCategory(formatted);
    } catch (error) {
      console.error("Failed to fetch Lpt Defect Category data:", error);
      toast.error("Failed to fetch Lpt Defect Category data.");
    }
  };

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

  const handleAddDefect = async () => {
    if (!assetDetails.ModelName) {
      toast.error("Asset details not available. Please scan a barcode.");
      return;
    }

    // if (!selectedLptDefectCategory?.value) {
    //   toast.error("Please select a defect category.");
    //   return;
    // }

    const defectToAdd = addManually
      ? manualCategory?.trim()
      : selectedLptDefectCategory.label;

    if (!defectToAdd || defectToAdd.length === 0) {
      toast.error("Please select or enter a defect.");
      return;
    }

    try {
      setLoading(true);

      const dynamicShift = getCurrentShift();

      const payload = {
        AssemblyNo: barcodeNumber,
        ModelName: assetDetails.ModelName,
        SetTemp: setTemp,
        ActualTemp: actualTemp,
        SetCurrent: setCurrent,
        ActualCurrent: actualCurrent,
        SetPower: setPower,
        ActualPower: actualPower,
        shift: dynamicShift.value,
        AddDefect: defectToAdd,
        Remark: remark,
        currentDateTime: getFormattedISTDate(),
      };

      const res = await axios.post(`${baseURL}quality/add-lpt-defect`, payload);

      if (res?.data?.success) {
        toast.success(res?.data?.message || "Defect added successfully!");
        setRemark("");
        setManualCategory("");
        setSelectedLptDefectCategory(null);
        setAddManually(false);
        getLptDefectReport();
      }
    } catch (error) {
      console.error("Add Defect Error:", error.response?.data || error.message);
      toast.error("An error occurred while adding the defect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLptDefectCount();
    getLptDefectReport();
    getLptDefectCategory();
  }, []);

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
                value={barcodeNumber}
                onChange={(e) => setBarcodeNumber(e.target.value)}
              />
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={() => getAssetDetails()}
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
                  {assetDetails.ModelName || "N/A"}
                </span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          {/* Control Section */}
          <div className="flex flex-wrap gap-4 items-start justify-start bg-gradient-to-r from-purple-100 via-white to-purple-100 p-4 rounded-xl shadow-md mb-4">
            {/* Temperature Block */}
            <div className="flex flex-col gap-4 p-5 bg-red-50 shadow-md border border-red-200 rounded-xl min-w-[220px]">
              <h1 className="text-lg font-bold text-center text-red-700 flex items-center justify-center gap-2">
                <WiThermometer className="text-2xl" />
                Temperature
              </h1>
              <div className="flex gap-2">
                <InputField
                  label="Set Temp"
                  type="text"
                  value={setTemp}
                  onChange={(e) => setSetTemp(e.target.value)}
                  className="w-32"
                />
                <InputField
                  label="Actual Temp"
                  type="text"
                  value={actualTemp}
                  onChange={(e) => setActualTemp(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>

            {/* Current Block */}
            <div className="flex flex-col gap-4 p-5 bg-blue-50 shadow-md border border-blue-200 rounded-xl min-w-[220px]">
              <h1 className="text-lg font-bold text-center text-blue-700 flex items-center justify-center gap-2">
                <FaBolt className="text-xl" />
                Current
              </h1>
              <div className="flex gap-2">
                <InputField
                  label="Set Current"
                  type="text"
                  value={setCurrent}
                  onChange={(e) => setSetCurrent(e.target.value)}
                  className="w-32"
                />
                <InputField
                  label="Actual Current"
                  type="text"
                  value={actualCurrent}
                  onChange={(e) => setActualCurrent(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>

            {/* Power Block */}
            <div className="flex flex-col gap-4 p-5 bg-yellow-50 shadow-md border border-yellow-200 rounded-xl min-w-[220px]">
              <h1 className="text-lg font-bold text-center text-yellow-700 flex items-center justify-center gap-2">
                <MdPowerSettingsNew className="text-xl" />
                Power
              </h1>
              <div className="flex gap-2">
                <InputField
                  label="Set Power"
                  type="text"
                  value={setPower}
                  onChange={(e) => setSetPower(e.target.value)}
                  className="w-32"
                />
                <InputField
                  label="Actual Power"
                  type="text"
                  value={actualPower}
                  onChange={(e) => setActualPower(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>

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
                  options={lptDefectCategory}
                  value={selectedLptDefectCategory?.value || ""}
                  onChange={(e) => {
                    const selected = lptDefectCategory.find(
                      (option) => option.value === e.target.value
                    );
                    setSelectedLptDefectCategory(selected);
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

            <div className="flex flex-col gap-2 items-center justify-center">
              <InputField
                label="Current Shift"
                type="text"
                value={getCurrentShift().label}
                readOnly
                className="w-32"
              />
              <div>
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-indigo-600"}
                  textColor="text-white"
                  className={`font-semibold px-6 py-3 rounded-lg shadow-md mt-6 transition duration-300 hover:bg-indigo-700 ${
                    loading ? "cursor-not-allowed opacity-60" : ""
                  }`}
                  onClick={() => handleAddDefect()}
                  disabled={loading}
                >
                  Add Defect
                </Button>
              </div>
            </div>
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
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Sr. No.
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Date
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Model
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Shift
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Assembly No.
                        </th>
                        <th className="px-1 py-1 border" colSpan={2}>
                          Temperature
                        </th>
                        <th className="px-1 py-1 border" colSpan={2}>
                          Current
                        </th>
                        <th className="px-1 py-1 border" colSpan={2}>
                          Power
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Add Defect
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Remark
                        </th>
                      </tr>
                      <tr>
                        <th className="px-1 py-1 border">Set Temp</th>
                        <th className="px-1 py-1 border">Actual Temp</th>
                        <th className="px-1 py-1 border">Set Current</th>
                        <th className="px-1 py-1 border">Actual Current</th>
                        <th className="px-1 py-1 border">Set Power</th>
                        <th className="px-1 py-1 border">Actual Power</th>
                      </tr>
                    </thead>
                    <tbody className="text-center">
                      {lptDefectReport && lptDefectReport.length > 0 ? (
                        lptDefectReport.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-100">
                            <td className="px-1 py-1 border">{index + 1}</td>
                            <td className="px-1 py-1 border">
                              {item.DateTime &&
                                item.DateTime.replace("T", " ").replace(
                                  "Z",
                                  ""
                                )}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ModelName}
                            </td>
                            <td className="px-1 py-1 border">{item.Shift}</td>
                            <td className="px-1 py-1 border">
                              {item.AssemblyNo}
                            </td>
                            <td className="px-1 py-1 border">{item.SetTemp}</td>
                            <td className="px-1 py-1 border">
                              {item.ActualTemp}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.SetCurrent}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ActualCurrent}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.SetPower}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ActualPower}
                            </td>
                            <td className="px-1 py-1 border">{item.Defect}</td>
                            <td className="px-1 py-1 border">{item.Remark}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="text-center py-4">
                            No LPT defect data found.
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
                        <th className="px-1 py-1 border">Production Count</th>
                        <th className="px-1 py-1 border">LPT</th>
                        <th className="px-1 py-1 border">Sample Tested</th>
                        <th className="px-1 py-1 border">Test Pending</th>
                        <th className="px-1 py-1 border">LPT %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lptDefectCount && lptDefectCount.length > 0 ? (
                        lptDefectCount.map((item, index) => (
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
                            <td className="px-1 py-1 border">{item.LPT}</td>
                            <td className="px-1 py-1 border">
                              {item.SampleInspected}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.PendingSample}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.LPT_Percentage}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-4">
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

export default LPT;
