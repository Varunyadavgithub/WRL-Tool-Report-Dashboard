import { useState } from "react";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import { FaSignInAlt, FaSignOutAlt } from "react-icons/fa";
import { MdExitToApp, MdInput } from "react-icons/md";
import axios from "axios";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const VisitorInOut = () => {
  const [loading, setLoading] = useState(false);
  const [passIdIn, setPassIdIn] = useState("");
  const [passIdOut, setPassIdOut] = useState("");
  const [visitorLogs, setVisitorLogs] = useState([]);

  const fetchVisitorLogs = async () => {
    try {
      const res = await axios.get(`${baseURL}visitor/logs`);
      if (res?.data?.success) {
        setVisitorLogs(res?.data?.data);
      }
    } catch (error) {
      console.error("Failed to fetch visitor logs", error);
      toast.error("Failed to fetch visitor logs");
    }
  };

  const handleVisitorAction = async (type) => {
    const passId = type === "in" ? passIdIn : passIdOut;

    if (!passId.trim()) {
      alert("Please scan or enter a Pass ID.");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${baseURL}visitor/${type}`, {
        passId,
      });
      fetchVisitorLogs();
      // Clear the relevant input
      if (type === "in") setPassIdIn("");
      else setPassIdOut("");
    } catch (error) {
      console.error("Visitor action error:", error);
      toast.error(error.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitorLogs();
  }, []);
  const commonBoxStyles =
    "bg-white border border-purple-300 shadow-md rounded-xl p-6 w-full md:w-1/2";

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
              name="passIdIn"
              label="Scan QR Code"
              type="text"
              placeholder="Scan the QR Code"
              value={passIdIn}
              onChange={(e) => setPassIdIn(e.target.value)}
              required
              className="w-full md:w-64"
            />
            <Button
              onClick={() => handleVisitorAction("in")}
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
              name="passIdOut"
              label="Scan QR Code"
              type="text"
              placeholder="Scan the QR Code"
              value={passIdOut}
              onChange={(e) => setPassIdOut(e.target.value)}
              required
              className="w-full md:w-64"
            />
            <Button
              onClick={() => handleVisitorAction("out")}
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
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Visitor Logs
        </h3>
        <table className="min-w-full table-auto border border-gray-200">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-2 border">Visitor</th>
              <th className="px-4 py-2 border">Contact</th>
              <th className="px-4 py-2 border">Department</th>
              <th className="px-4 py-2 border">Visit Type</th>
              <th className="px-4 py-2 border">Check-In</th>
              <th className="px-4 py-2 border">Check-Out</th>
            </tr>
          </thead>
          <tbody>
            {visitorLogs.map((log, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{log.visitor_name}</td>
                <td className="px-4 py-2 border">{log.visitor_contact_no}</td>
                <td className="px-4 py-2 border">{log.department_to_visit}</td>
                <td className="px-4 py-2 border">{log.visit_type}</td>
                <td className="px-4 py-2 border">
                  {log.check_in_time
                    ? new Date(log.check_in_time).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-2 border">
                  {log.check_out_time === null ? (
                    <span className="text-green-600 font-bold">
                      Currently In
                    </span>
                  ) : (
                    new Date(log.check_out_time).toLocaleString()
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VisitorInOut;
