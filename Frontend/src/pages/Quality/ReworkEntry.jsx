import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "../../components/common/Button";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import { baseURL } from "../../assets/assets.js";

const ReworkEntry = () => {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");

  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("");

  // ===== Rework IN states =====
  const [defect, setDefect] = useState("");
  const [part, setPart] = useState("");

  // ===== Rework OUT states =====
  const [rootCause, setRootCause] = useState("");
  const [failCategory, setFailCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [containmentAction, setContainmentAction] = useState("");

  /* =========================================================
     RESET HELPERS (BEST PRACTICE)
  ========================================================= */
  const resetReworkInFields = () => {
    setDefect("");
    setPart("");
  };

  const resetReworkOutFields = () => {
    setRootCause("");
    setFailCategory("");
    setOrigin("");
    setContainmentAction("");
  };

  const resetAllFields = () => {
    setSerialNumber("");
    setModelName("");
    setCategory("");
    resetReworkInFields();
    resetReworkOutFields();
  };

  /* =========================================================
     FETCH MODEL & CATEGORY
  ========================================================= */
  const handleQuery = async () => {
    if (!serialNumber) {
      toast.error("Please enter Serial Number");
      return;
    }

    try {
      setLoading(true);

      const { data } = await axios.get(
        `${baseURL}quality/rework-entry/details`,
        { params: { AssemblySerial: serialNumber } }
      );

      if (!data.modelName || !data.category) {
        toast.error("No data found for this Serial Number");
        setModelName("");
        setCategory("");
        return;
      }

      setModelName(data.modelName);
      setCategory(data.category);
      toast.success("Rework Entry details fetched");
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch Rework Entry details");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     SHIFT
  ========================================================= */
  const getCurrentShift = () => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= 480 && mins < 1200 ? "Shift 1" : "Shift 2";
  };

  /* =========================================================
     REWORK IN
  ========================================================= */
  const handleReworkIn = async () => {
    if (!serialNumber || !modelName || !category) {
      toast.error("Please fetch Rework Entry details first");
      return;
    }

    if (!defect || !part) {
      toast.error("Please fill Defect and Part");
      return;
    }

    try {
      const payload = {
        AssemblySerial: serialNumber,
        ModelName: modelName,
        Category: category,
        Defect: defect,
        Part: part,
        Shift: getCurrentShift(),
      };

      const { data } = await axios.post(`${baseURL}quality/rework-in`, payload);

      toast.success(data.message);

      // ✅ Clear only IN fields
      resetReworkInFields();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Rework IN failed");
    }
  };

  /* =========================================================
     REWORK OUT
  ========================================================= */
  const handleReworkOut = async () => {
    if (!serialNumber) {
      toast.error("Please enter Serial Number");
      return;
    }

    if (!rootCause || !failCategory || !origin || !containmentAction) {
      toast.error("Please fill all Rework OUT fields");
      return;
    }

    try {
      const payload = {
        AssemblySerial: serialNumber,
        RootCause: rootCause,
        FailCategory: failCategory,
        Origin: origin,
        ContainmentAction: containmentAction,
      };

      const { data } = await axios.post(
        `${baseURL}quality/rework-out`,
        payload
      );

      toast.success(data.message);

      // ✅ Clear everything after OUT
      resetAllFields();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Rework OUT failed");
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Rework Entry" align="center" />

      {/* ================= REWORK ENTRY ================= */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Rework Entry</h2>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <InputField
            label="Serial No."
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />

          <Button
            onClick={handleQuery}
            bgColor="bg-blue-500"
            textColor="text-white"
            disabled={loading}
          >
            {loading ? "Loading..." : "Go"}
          </Button>

          <InputField label="Model Name" value={modelName} readOnly />
          <InputField label="Category" value={category} readOnly />
        </div>
      </div>

      {/* ================= IN & OUT ================= */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* ================= REWORK IN ================= */}
        <div className="md:w-1/2 bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Rework In</h2>

          <div className="space-y-4">
            <InputField
              label="Defect"
              value={defect}
              onChange={(e) => setDefect(e.target.value)}
            />

            <InputField
              label="Part"
              value={part}
              onChange={(e) => setPart(e.target.value)}
            />

            <InputField
              label="Current Shift"
              value={getCurrentShift()}
              readOnly
            />

            <Button
              onClick={handleReworkIn}
              bgColor="bg-indigo-500"
              textColor="text-white"
            >
              IN
            </Button>
          </div>
        </div>

        {/* ================= REWORK OUT ================= */}
        <div className="md:w-1/2 bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Rework Out</h2>

          <div className="space-y-4">
            <InputField
              label="Root Cause"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
            />

            <InputField
              label="Fail Category"
              value={failCategory}
              onChange={(e) => setFailCategory(e.target.value)}
            />

            <InputField
              label="Origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />

            <InputField
              label="Containment Action"
              value={containmentAction}
              onChange={(e) => setContainmentAction(e.target.value)}
            />

            <Button
              onClick={handleReworkOut}
              bgColor="bg-green-500"
              textColor="text-white"
            >
              OUT
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReworkEntry;
