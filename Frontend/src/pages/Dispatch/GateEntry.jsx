import { useState } from "react";
import Button from "../../components/common/Button";
import ExportButton from "../../components/common/ExportButton";
import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import DateTimePicker from "../../components/common/DateTimePicker";

const GateEntry = () => {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const handleClearFilters = () => {};

  const handleQuery = () => {
    console.log("Clicked");
  };
  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Gate Entry" align="center" />

      {/* Filters */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md gap-6">
        <div className="flex gap-2">
          {/* Column 1 */}
          <div>
            <fieldset className="border border-black p-4 rounded-md">
              <legend className="font-semibold text-gray-700 px-2">
                Gate Entry Details
              </legend>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-4">
                  <InputField
                    label="Entry No."
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="vehicleNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Entry Date"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="UOM"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Received QTY"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Material Group"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="HSN"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Discrepency"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-4">
            <fieldset className="border border-black p-4 rounded-md">
              <legend className="font-semibold text-gray-700 px-2">
                PO Details
              </legend>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-4">
                  <InputField
                    label="PO No."
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="vehicleNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="PO Date"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Basic Rate"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
            <div className="flex gap-2 items-center justify-center">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={console.log("Clicked Add")}
                disabled={loading}
              >
                Add
              </Button>
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-green-600"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={console.log("Clicked Settings")}
                disabled={loading}
              >
                Settings
              </Button>
            </div>
          </div>
          {/* Column 3 */}
          <div className="flex flex-col gap-4">
            <fieldset className="border border-black p-4 rounded-md">
              <legend className="font-semibold text-gray-700 px-2">
                Supplier Details
              </legend>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-4">
                  <InputField
                    label="Supplier Name"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="vehicleNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Supplier Code"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-center">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={console.log("Clicked Save")}
                disabled={loading}
              >
                Save
              </Button>
            </div>
          </div>
          {/* Column 4 */}
          <div>
            <fieldset className="border border-black p-4 rounded-md">
              <legend className="font-semibold text-gray-700 px-2">
                GRN Details
              </legend>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-4">
                  <InputField
                    label="GRN 103"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="vehicleNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="GRN 101/105"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>
          {/* Column 5 */}
          <div>
            <fieldset className="border border-black p-4 rounded-md">
              <legend className="font-semibold text-gray-700 px-2">
                Invoice Details
              </legend>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-4">
                  <InputField
                    label="Invoice No."
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="vehicleNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Invoice Date"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Item Code"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Invoice QTY"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Line Item"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Value"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Description"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          {/* Column 6 */}
          <div>
            <fieldset className="border border-black p-4 rounded-md">
              <legend className="font-semibold text-gray-700 px-2">
                Vehicle Details
              </legend>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-4">
                  <InputField
                    label="Vehicle No."
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="vehicleNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Vehicle in Time"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Vehicle Name"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Vehicle Type"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Carry Capacity"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Fuel Type"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                  <InputField
                    label="Remarks"
                    type="text"
                    placeholder="Enter details"
                    className="w-full text-md"
                    name="lrNo"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>
        </div>
      </div>

      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md gap-6 mt-2">
        <fieldset className="border border-black p-4 rounded-md">
          <legend className="font-semibold text-gray-700 px-2">
            Gate Entry Details
          </legend>
          <div>
            <div className="flex gap-2">
              <div>
                <InputField
                  label="Vehicle No."
                  type="text"
                  placeholder="Enter details"
                  className="w-full text-md"
                  name="vehicleNo"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-2">
                  <Button
                    bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                    textColor={loading ? "text-white" : "text-black"}
                    className={`font-semibold ${
                      loading ? "cursor-not-allowed" : ""
                    }`}
                    onClick={console.log("clicked")}
                    disabled={loading}
                  >
                    Query
                  </Button>
                  <ExportButton />
                </div>
                <div className="text-left font-bold text-lg">
                  COUNT: <span className="text-blue-700">000</span>
                </div>
              </div>
            </div>
            <div>
              <fieldset className="border border-black p-4 rounded-md">
                <legend className="font-semibold text-gray-700 px-2">
                  Search by Date
                </legend>
                <div>
                  <div className="flex gap-2">
                    <DateTimePicker
                      label="Start Time"
                      name="startTime"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                    <DateTimePicker
                      label="End Time"
                      name="endTime"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          </div>
        </fieldset>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md"></div>
    </div>
  );
};

export default GateEntry;