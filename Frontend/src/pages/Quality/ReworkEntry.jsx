import Button from "../../components/common/Button";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import { useState } from "react";

const ReworkEntry = () => {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");

  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("");

  const handleQuery = async () => {
    if (!serialNumber) return alert("Please enter Serial Number");

    setLoading(true);

    try {
      // MOCK API CALL (replace with your real endpoint)
      const response = await fetch(
        `/api/get-product-details?serial=${serialNumber}`
      );

      const data = await response.json();

      // Set the values into fields
      setModelName(data.modelName || "");
      setCategory(data.category || "");

      console.log("Fetched:", data);
    } catch (error) {
      console.error(error);
      alert("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentShift = () => {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();

    return totalMinutes >= 480 && totalMinutes < 1200
      ? { label: "Shift 1", value: "shift 1" }
      : { label: "Shift 2", value: "shift 2" };
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Rework Entry" align="center" />

      {/* Filters Section */}
      <div className="">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-6 rounded-xl max-w-4xl w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Serial Number */}
            <InputField
              label="Serial No."
              type="text"
              placeholder="Enter serial number"
              className="w-full"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />

            {/* Go Button */}
            <div className="flex items-center md:justify-start justify-center">
              <Button
                onClick={handleQuery}
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor="text-white"
                className={`font-semibold px-6 ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                {loading ? "Loading..." : "Go"}
              </Button>
            </div>

            {/* Model & Category Auto-filled */}
            <div className="grid grid-cols-1 gap-4">
              <InputField
                label="Model Name"
                type="text"
                placeholder="Model Name"
                className="w-full"
                value={modelName}
                readOnly
              />

              <InputField
                label="Category"
                type="text"
                placeholder="Category"
                className="w-full"
                value={category}
                readOnly
              />
            </div>

            {/* Remaining Fields */}
            <InputField label="Defect" type="text" placeholder="Enter Defect" />
            <InputField label="Part" type="text" placeholder="Part" />
            <InputField
              label="Root Cause"
              type="text"
              placeholder="Root Cause"
            />

            <InputField
              label="Current Shift"
              type="text"
              value={getCurrentShift().label}
              readOnly
            />

            <InputField
              label="Fail Category"
              type="text"
              placeholder="Fail Category"
            />
            <InputField label="Origin" type="text" placeholder="Origin" />
            <InputField
              label="Containment Action"
              type="text"
              placeholder="Containment Action"
            />

            {/* Add to Rework Button */}
            <div className="flex items-center md:justify-start justify-center mt-4">
              <Button
                onClick={() => console.log("Add to Rework Clicked")}
                bgColor="bg-green-500"
                textColor="text-white"
                className="font-semibold px-6"
              >
                Add to Rework
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReworkEntry;
