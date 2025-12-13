import { useState } from "react";
import Button from "../../components/common/Button";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";

const ReworkEntry = () => {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");

  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("");

  // ================= API CALL =================
  const handleQuery = async () => {
    if (!serialNumber) {
      alert("Please enter Serial Number");
      return;
    }

    setLoading(true);

    try {
      // MOCK API (replace with real API)
      const response = await fetch(
        `/api/get-product-details?serial=${serialNumber}`
      );

      if (!response.ok) throw new Error("API Error");

      const data = await response.json();

      setModelName(data.modelName || "");
      setCategory(data.category || "");
    } catch (error) {
      console.error(error);
      alert("Failed to fetch product details");
    } finally {
      setLoading(false);
    }
  };

  // ================= SHIFT LOGIC =================
  const getCurrentShift = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();

    return minutes >= 480 && minutes < 1200
      ? { label: "Shift 1", value: "shift1" }
      : { label: "Shift 2", value: "shift2" };
  };

  const isEntryDone = modelName && category;

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Rework Entry" align="center" />

      {/* ================= STEP 1 : REWORK ENTRY ================= */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Rework Entry
        </h2>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <InputField
            label="Serial No."
            type="text"
            placeholder="Enter serial number"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />

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

          <InputField
            label="Model Name"
            type="text"
            value={modelName}
            readOnly
          />

          <InputField label="Category" type="text" value={category} readOnly />
        </div>
      </div>

      {/* ================= STEP 2 & 3 ================= */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* ================= REWORK IN ================= */}
        <div className="md:w-1/3 w-full bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Rework In
          </h2>

          <p className="text-sm text-gray-500">
            Product has been validated using the serial number. Model and
            category are fetched automatically.
          </p>

          {isEntryDone && (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="font-medium">Model:</span> {modelName}
              </p>
              <p>
                <span className="font-medium">Category:</span> {category}
              </p>
            </div>
          )}
        </div>

        {/* ================= REWORK OUT ================= */}
        <div
          className={`md:flex-1 w-full bg-white border rounded-lg p-6 ${
            !isEntryDone && "opacity-50 pointer-events-none"
          }`}
        >
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Rework Out
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Defect" placeholder="Enter defect" />
            <InputField label="Part" placeholder="Part" />

            <InputField label="Root Cause" placeholder="Root cause" />
            <InputField
              label="Current Shift"
              value={getCurrentShift().label}
              readOnly
            />

            <InputField label="Fail Category" placeholder="Fail category" />
            <InputField label="Origin" placeholder="Origin" />

            <InputField
              label="Containment Action"
              placeholder="Containment action"
              className="md:col-span-2"
            />

            <div className="md:col-span-2">
              <Button
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
