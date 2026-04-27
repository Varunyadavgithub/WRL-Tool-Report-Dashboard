import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import DateTimePicker from "../../components/ui/DateTimePicker";
import { baseURL } from "../../assets/assets";
import Loader from "../../components/ui/Loader";
import { formatISODateString } from "../../utils/dateUtils";
import { FaFileAlt, FaSearch, FaUsers, FaPaperPlane } from "react-icons/fa";

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState([]);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchParams, setSearchParams] = useState({ term: "", field: "all" });

  const formatDate = (date) => {
    const pad = (n) => (n < 10 ? "0" + n : n);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const fetchVisitorData = async (start, end, setLoader) => {
    try {
      setLoader(true);
      setVisitors([]);
      const res = await axios.get(`${baseURL}visitor/repot`, {
        params: { startTime: start, endTime: end },
      });
      if (res?.data?.success) setVisitors(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch visitor data:", error);
      toast.error("Failed to fetch visitor data.");
    } finally {
      setLoader(false);
    }
  };

  const fetchYdayVisitorData = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1);
    fetchVisitorData(
      formatDate(yesterday8AM),
      formatDate(today8AM),
      setYdayLoading,
    );
  };

  const fetchTdayVisitorData = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    fetchVisitorData(formatDate(today8AM), formatDate(now), setTodayLoading);
  };

  const fetchMTDVisitorData = () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    );
    fetchVisitorData(
      formatDate(startOfMonth),
      formatDate(now),
      setMonthLoading,
    );
  };

  const fetchVisitors = async () => {
    if (!startTime || !endTime)
      return toast.error("Please select the Time Range.");
    await fetchVisitorData(startTime, endTime, setLoading);
  };

  const filteredReports = visitors.filter((item) => {
    const { term, field } = searchParams;
    if (!term) return true;
    const lowerTerm = term.toLowerCase();
    const safeLower = (value) => (value ? value.toLowerCase() : "");

    switch (field) {
      case "name":
        return safeLower(item.visitor_name).includes(lowerTerm);
      case "contactno":
        return safeLower(item.contact_no).includes(lowerTerm);
      case "email":
        return safeLower(item.email).includes(lowerTerm);
      case "company":
        return safeLower(item.company).includes(lowerTerm);
      case "purpose":
        return safeLower(item.purpose_of_visit).includes(lowerTerm);
      default:
        return (
          safeLower(item.visitor_name).includes(lowerTerm) ||
          safeLower(item.contact_no).includes(lowerTerm) ||
          safeLower(item.email).includes(lowerTerm) ||
          safeLower(item.company).includes(lowerTerm) ||
          safeLower(item.purpose_of_visit).includes(lowerTerm)
        );
    }
  });

  const handleSendReport = async () => {
    if (!filteredReports.length) return toast.error("No report data to send.");
    try {
      const res = await axios.post(`${baseURL}visitor/send-report`, {
        visitors: filteredReports,
      });
      res?.data?.success
        ? toast.success("Report sent successfully!")
        : toast.error(res?.data?.message || "Failed to send report.");
    } catch (error) {
      console.error("Failed to send report:", error);
      toast.error("Failed to send report.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 max-w-full">
      {/* Page Title */}
      <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
        Visitors Reports
      </h1>

      {/* ==================== Filters Section ==================== */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">
          Filters & Quick Actions
        </h3>

        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          {/* Date Range & Query */}
          <div className="flex flex-wrap gap-4 items-end">
            <DateTimePicker
              label="Start Time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <DateTimePicker
              label="End Time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <button
              onClick={fetchVisitors}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-blue-600 transition cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <Loader />
              ) : (
                <>
                  <FaSearch className="text-xs" /> Query
                </>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                placeholder="Search visitor..."
                className="w-full border border-gray-300 rounded-lg p-2 text-sm 
                  bg-white text-gray-800
                  placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={searchParams.term}
                onChange={(e) =>
                  setSearchParams((prev) => ({
                    ...prev,
                    term: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Field
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2 text-sm 
                  bg-white text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={searchParams.field}
                onChange={(e) =>
                  setSearchParams((prev) => ({
                    ...prev,
                    field: e.target.value,
                  }))
                }
              >
                <option value="all">All Fields</option>
                <option value="name">Name</option>
                <option value="contactno">Contact No.</option>
                <option value="email">Email</option>
                <option value="company">Company</option>
                <option value="purpose">Purpose</option>
              </select>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2 items-end">
            <button
              onClick={fetchYdayVisitorData}
              className="px-4 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition cursor-pointer"
            >
              {ydayLoading ? <Loader /> : "YDAY"}
            </button>
            <button
              onClick={fetchTdayVisitorData}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-blue-600 transition cursor-pointer"
            >
              {todayLoading ? <Loader /> : "TDAY"}
            </button>
            <button
              onClick={fetchMTDVisitorData}
              className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-green-600 transition cursor-pointer"
            >
              {monthLoading ? <Loader /> : "MTD"}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== Visitors Table ==================== */}
      <div className="bg-white shadow-md rounded-lg p-6">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-500">
              <FaUsers className="text-white text-lg" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Results</p>
              <h2 className="text-2xl font-bold text-gray-800">
                {filteredReports.length}
              </h2>
            </div>
          </div>

          <button
            onClick={handleSendReport}
            className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-purple-600 transition cursor-pointer flex items-center gap-2"
          >
            <FaPaperPlane className="text-xs" /> Send Report
          </button>
        </div>

        {/* Full-Width Table */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead className="bg-gray-100">
              <tr>
                {[
                  { label: "Sr.", width: "w-[3%]" },
                  { label: "Type", width: "w-[5%]" },
                  { label: "Name", width: "w-[7%]" },
                  { label: "Contact", width: "w-[6%]" },
                  { label: "Email", width: "w-[7%]" },
                  { label: "Company", width: "w-[5%]" },
                  { label: "Address", width: "w-[6%]" },
                  { label: "State", width: "w-[5%]" },
                  { label: "City", width: "w-[4%]" },
                  { label: "ID Type", width: "w-[5%]" },
                  { label: "ID No", width: "w-[5%]" },
                  { label: "Vehicle", width: "w-[5%]" },
                  { label: "Employee", width: "w-[6%]" },
                  { label: "Dept.", width: "w-[5%]" },
                  { label: "Check In", width: "w-[6%]" },
                  { label: "Check Out", width: "w-[6%]" },
                  { label: "Duration", width: "w-[4%]" },
                  { label: "Visits", width: "w-[3%]" },
                  { label: "Purpose", width: "w-[5%]" },
                  { label: "Token", width: "w-[3%]" },
                ].map((col, idx) => (
                  <th
                    key={idx}
                    className={`${col.width} p-2 border-b border-gray-200 text-center font-semibold text-gray-600 wrap-break-word`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredReports.length > 0 ? (
                filteredReports.map((v, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50 transition border-b border-gray-100"
                  >
                    <td className="p-2 text-center text-gray-700">{i + 1}</td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.visit_type || "—"}
                    </td>
                    <td className="p-2 text-center font-medium text-gray-800 wrap-break-word">
                      {v.visitor_name || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.contact_no || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.email || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.company || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.address || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.state || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.city || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.identity_type || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.identity_no || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.vehicle_details || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.employee_name || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.department_name || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {formatISODateString(v.check_in_time) || "—"}
                    </td>
                    <td className="p-2 text-center wrap-break-word">
                      {v.check_out_time ? (
                        <span className="text-gray-700">
                          {formatISODateString(v.check_out_time)}
                        </span>
                      ) : (
                        <span className="text-green-600 font-bold">
                          Currently In
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.visit_duration || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700">
                      {v.no_of_visit || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.purpose_of_visit || "—"}
                    </td>
                    <td className="p-2 text-center text-gray-700 wrap-break-word">
                      {v.token || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={20} className="text-center py-12">
                    <FaFileAlt className="text-5xl text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No visitors found.</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Try adjusting your filters or date range
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
