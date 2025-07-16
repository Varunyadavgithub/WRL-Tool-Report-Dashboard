import { useState } from "react";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import axios from "axios";
import toast from "react-hot-toast";
import SelectField from "../../components/common/SelectField";
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
    if (!assemblyNumber && !fgSerialNumber) {
      toast.error("Assembly Number and FGSerialNumber fields are required");
      return;
    }
    try {
      setLoading(true);

      const payload = {
        assemblyNumber,
        fgSerialNumber,
        newAssetNumber,
      };

      const res = await axios.put(`${baseURL}quality/new-asset-tag`, payload);
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error("Failed to update New Asset Number.");
      }
    } catch (error) {
      console.error("Failed to update the New Asset Number Data:", error);
      toast.error("Failed to update the New Asset Number Data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNewCustomerQr = async () => {
    if (!newCustomerQr) {
      toast.error("New Customer QR is required");
      return;
    }
    if (!assemblyNumber && !fgSerialNumber) {
      toast.error("Assembly Number and FGSerialNumber fields are required");
      return;
    }
    try {
      setLoading(true);

      const payload = {
        assemblyNumber,
        fgSerialNumber,
        newCustomerQr,
      };

      const res = await axios.put(`${baseURL}quality/new-customer-qr`, payload);
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error("Failed to update New Customer QR.");
      }
    } catch (error) {
      console.error("Failed to update the New Customer QR data:", error);
      toast.error("Failed to update the New Customer QR data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Tag Update" align="center" />

      {/* Filters */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 max-w-fit rounded-md">
        <div className="">
          <fieldset className="border border-black p-4 rounded-md">
            <legend className="font-semibold text-gray-700 px-2">
              Asset Tag Update
            </legend>
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-center gap-4">
                  <InputField
                    label="Assembly Number"
                    type="text"
                    placeholder="Enter Assembly Number"
                    className="max-w-4xl"
                    name="assemblyNumber"
                    value={assemblyNumber}
                    onChange={(e) => {
                      setAssemblyNumber(e.target.value);
                    }}
                  />
                  <div>
                    <Button
                      bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                      textColor={loading ? "text-white" : "text-black"}
                      className={`font-semibold ${
                        loading ? "cursor-not-allowed" : ""
                      }`}
                      onClick={() => fetchAssetDetails()}
                      disabled={loading}
                    >
                      Query
                    </Button>
                  </div>
                </div>

                <SelectField
                  label="Select to Update"
                  options={updateOption}
                  value={selectedToUpdate?.value || ""}
                  onChange={(e) => {
                    const selected = updateOption.find(
                      (opt) => opt.value === e.target.value
                    );
                    if (selected) {
                      setSelectedToUpdate(selected);
                    }
                  }}
                  className="max-w-2xl"
                />
                {selectedToUpdate?.value === "newassetnumber" ? (
                  <div className="flex items-center justify-center gap-4">
                    <InputField
                      label="New Asset No."
                      type="text"
                      placeholder="Enter New Asset No."
                      className="max-w-4xl"
                      name="newAssetNumber"
                      value={newAssetNumber}
                      onChange={(e) => setNewAssetNumber(e.target.value)}
                    />
                    <div>
                      <Button
                        bgColor={loading ? "bg-gray-400" : "bg-green-600"}
                        textColor={loading ? "text-white" : "text-black"}
                        className={`font-semibold ${
                          loading ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                        onClick={() => handleUpdateNewAsset()}
                        disabled={loading}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <InputField
                      label="New Customer QR"
                      type="text"
                      placeholder="Enter New Customer QR"
                      className="max-w-4xl"
                      name="newCustomerQr"
                      value={newCustomerQr}
                      onChange={(e) => setNewCustomerQr(e.target.value)}
                    />
                    <div>
                      <Button
                        bgColor={loading ? "bg-gray-400" : "bg-green-600"}
                        textColor={loading ? "text-white" : "text-black"}
                        className={`font-semibold ${
                          loading ? "cursor-not-allowed" : ""
                        }`}
                        onClick={() => handleUpdateNewCustomerQr()}
                        disabled={loading}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center gap-4">
                <h1 className="font-semibold text-xl">
                  Asset No.{" "}
                  <span className="text-blue-700 text-md">
                    {assetNumber || 0}
                  </span>
                </h1>

                <h1 className="font-semibold text-xl">
                  FG Sr.No.{" "}
                  <span className="text-blue-700 text-md">
                    {fgSerialNumber || 0}
                  </span>
                </h1>
                <h1 className="font-semibold text-xl">
                  Model Name{" "}
                  <span className="text-blue-700 text-md">
                    {modelName || 0}
                  </span>
                </h1>
                <h1 className="font-semibold text-xl">
                  Customer QR{" "}
                  <span className="text-blue-700 text-md">{serial2 || 0}</span>
                </h1>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
};

export default TagUpdate;
