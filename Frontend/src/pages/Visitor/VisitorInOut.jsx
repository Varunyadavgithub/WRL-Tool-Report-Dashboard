import { useState } from "react";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import { FaSignInAlt, FaSignOutAlt } from "react-icons/fa";
import { MdExitToApp, MdInput } from "react-icons/md";

const VisitorInOut = () => {
  const [loading, setLoading] = useState(false);

  const commonBoxStyles =
    "bg-white border border-purple-300 shadow-md rounded-xl p-6 w-full md:w-1/2";

  // Sample data (replace with actual fetched data later)
  const [visitorLogs, setVisitorLogs] = useState([
    { name: "John Doe", action: "In", time: "2025-07-09 at 04:00 PM" },
    { name: "Jane Smith", action: "Out", time: "2025-07-09 at 06:30 PM" },
    { name: "Alex Johnson", action: "In", time: "2025-07-09 at 07:00 PM" },
  ]);

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 md:px-8">
      <Title title="Manage Visitor" align="center" />

      {/* Filters Section */}
      <div className="flex flex-col md:flex-row gap-8 mt-10 justify-center items-start">
        {/* Visitor In Box */}
        <div className={commonBoxStyles}>
          <h2 className="text-2xl font-bold text-purple-700 text-center mb-6 flex items-center justify-center">
            <MdInput className="mr-2 text-blue-600" /> Visitor In
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <InputField
              name="Scan QR Code"
              label="Scan QR Code"
              type="text"
              placeholder="Scan the QR Code"
              required
              className="w-full md:w-64"
            />
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-600"}
              textColor="text-white"
              className={`w-full md:w-auto px-6 py-2 rounded-md font-semibold shadow transition-all duration-200 flex items-center justify-center gap-2 ${
                loading ? "cursor-not-allowed" : "hover:bg-blue-700"
              }`}
              disabled={loading}
            >
              <FaSignInAlt /> In
            </Button>
          </div>
        </div>

        {/* Visitor Out Box */}
        <div className={commonBoxStyles}>
          <h2 className="text-2xl font-bold text-purple-700 text-center mb-6 flex items-center justify-center">
            <MdExitToApp className="mr-2 text-red-600" /> Visitor Out
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <InputField
              name="Scan QR Code"
              label="Scan QR Code"
              type="text"
              placeholder="Scan the QR Code"
              required
              className="w-full md:w-64"
            />
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-red-600"}
              textColor="text-white"
              className={`w-full md:w-auto px-6 py-2 rounded-md font-semibold shadow transition-all duration-200 flex items-center justify-center gap-2 ${
                loading ? "cursor-not-allowed" : "hover:bg-red-700"
              }`}
              disabled={loading}
            >
              <FaSignOutAlt /> Out
            </Button>
          </div>
        </div>
      </div>

      {/* Visitor Logs Table */}
      <div className="mt-16 bg-white shadow-md rounded-xl p-6 overflow-x-auto">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Visitor Logs</h3>
        <table className="min-w-full table-auto border border-gray-200">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-2 border">Name</th>
              <th className="px-4 py-2 border">Action</th>
              <th className="px-4 py-2 border">Time</th>
            </tr>
          </thead>
          <tbody>
            {visitorLogs.map((log, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{log.name}</td>
                <td className={`px-4 py-2 border font-medium ${log.action === "In" ? "text-green-600" : "text-red-600"}`}>
                  {log.action}
                </td>
                <td className="px-4 py-2 border">{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VisitorInOut;
