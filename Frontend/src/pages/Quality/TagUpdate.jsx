import { useState } from "react";
import InputField from "../../components/ui/InputField";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import axios from "axios";
import toast from "react-hot-toast";
import SelectField from "../../components/ui/SelectField";
import { baseURL } from "../../assets/assets";

const TagUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [assemblyNumber, setAssemblyNumber] = useState("");
  const [fgSerialNumber, setFgSerialNumber] = useState("");
  const [assetNumber, setAssetNumber] = useState("");
  const [modelName, setModelName] = useState("");
  const [serial2, setSerial2] = useState("");
  const [newAssetNumber, setNewAssetNumber] = useState("");
  const [newCustomerQr, setNewCustomerQr] = useState("");

  const updateOption = [
    { label: "New Asset No.", value: "newassetnumber" },
    { label: "New Customer QR", value: "newcustomerqr" },
  ];
  const [selectedToUpdate, setSelectedToUpdate] = useState(updateOption[0]);

  const fetchAssetDetails = async () => {
    if (!assemblyNumber) {
      toast.error("Assembly Number is required");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.get(`${baseURL}quality/asset-tag-details`, {
        params: { assemblyNumber },
      });

      setFgSerialNumber(res?.data?.FGNo);
      setAssetNumber(res?.data?.AssetNo);
      setModelName(res?.data?.ModelName);
      setSerial2(res?.data?.Serial2);
    } catch (error) {
      console.error("Failed to fetch Asset Details data:", error);
      toast.error("Failed to fetch Asset Details data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNewAsset = async () => {
    if (!newAssetNumber) {
      toast.error("New Asset Number is required");
      return;
    }

    if (!assemblyNumber || !fgSerialNumber) {
      toast.error("Assembly Number and FGSerialNumber fields are required");
      return;
    }

    try {
      setLoading(true);

      const payload = { assemblyNumber, fgSerialNumber, newAssetNumber };

      const res = await axios.put(`${baseURL}quality/new-asset-tag`, payload);

      // Use backend message for both success and failure
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message || "Failed to update New Asset Number.");
      }
    } catch (error) {
      console.error("Failed to update the New Asset Number Data:", error);
      // Show backend message if available
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to update the New Asset Number Data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNewCustomerQr = async () => {
    if (!newCustomerQr) {
      toast.error("New Customer QR is required");
      return;
    }

    if (!assemblyNumber || !fgSerialNumber) {
      toast.error("Assembly Number and FGSerialNumber fields are required");
      return;
    }

    try {
      setLoading(true);

      const payload = { assemblyNumber, fgSerialNumber, newCustomerQr };

      const res = await axios.put(`${baseURL}quality/new-customer-qr`, payload);

      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message || "Failed to update New Customer QR.");
      }
    } catch (error) {
      console.error("Failed to update the New Customer QR data:", error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to update the New Customer QR data.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Tag Update" align="center" />

      {/* ================= TAG UPDATE ================= */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-lg max-w-fit mx-auto">
        <fieldset className="border border-black p-4 rounded-md">
          <legend className="font-semibold text-gray-700 px-2">
            Tag Update
          </legend>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: INPUTS */}
            <div className="flex flex-col gap-6">
              {/* Assembly Number */}
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <InputField
                  label="Assembly Number"
                  type="text"
                  placeholder="Enter Assembly Number"
                  name="assemblyNumber"
                  value={assemblyNumber}
                  onChange={(e) => setAssemblyNumber(e.target.value)}
                  className="w-full max-w-md"
                />

                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor="text-black"
                  className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
                  onClick={fetchAssetDetails}
                  disabled={loading}
                >
                  Query
                </Button>
              </div>

              {/* Update Selector */}
              <SelectField
                label="Select to Update"
                options={updateOption}
                value={selectedToUpdate?.value || ""}
                onChange={(e) => {
                  const selected = updateOption.find(
                    (opt) => opt.value === e.target.value,
                  );
                  if (selected) setSelectedToUpdate(selected);
                }}
                className="w-full max-w-md"
              />

              {/* Conditional Update Fields */}
              {selectedToUpdate?.value === "newassetnumber" ? (
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <InputField
                    label="New Asset No."
                    type="text"
                    placeholder="Enter New Asset No."
                    name="newAssetNumber"
                    value={newAssetNumber}
                    onChange={(e) => setNewAssetNumber(e.target.value)}
                    className="w-full max-w-md"
                  />

                  <Button
                    bgColor={loading ? "bg-gray-400" : "bg-green-600"}
                    textColor="text-black"
                    className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
                    onClick={handleUpdateNewAsset}
                    disabled={loading}
                  >
                    Update
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <InputField
                    label="New Customer QR"
                    type="text"
                    placeholder="Enter New Customer QR"
                    name="newCustomerQr"
                    value={newCustomerQr}
                    onChange={(e) => setNewCustomerQr(e.target.value)}
                    className="w-full max-w-md"
                  />

                  <Button
                    bgColor={loading ? "bg-gray-400" : "bg-green-600"}
                    textColor="text-black"
                    className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
                    onClick={handleUpdateNewCustomerQr}
                    disabled={loading}
                  >
                    Update
                  </Button>
                </div>
              )}
            </div>

            {/* RIGHT: DETAILS */}
            <div className="flex flex-col justify-center gap-4 bg-white border rounded-lg p-4">
              {[
                { label: "Asset No.", value: assetNumber },
                { label: "FG Sr. No.", value: fgSerialNumber },
                { label: "Model Name", value: modelName },
                { label: "Customer QR", value: serial2 },
              ].map(({ label, value }) => (
                <div key={label} className="text-lg font-semibold">
                  {label}{" "}
                  <span className="text-blue-700 font-medium">
                    {value || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
};

export default TagUpdate;
