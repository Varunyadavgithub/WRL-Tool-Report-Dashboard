import { useState } from "react";
import Title from "../../components/common/Title";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "../../components/common/Button";
import DateTimePicker from "../../components/common/DateTimePicker";
import { baseURL } from "../../assets/assets";

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState([]);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchParams, setSearchParams] = useState({
    term: "",
    field: "all",
  });

  const fetchVisitors = async () => {
    if (!startTime && !endTime) {
      toast.error("Please select the Time Range.");
    }
    try {
      setLoading(true);
      const params = {
        startTime,
        endTime,
      };

      const res = await axios.get(`${baseURL}visitor/repot`, { params });

      if (res?.data?.success) {
        setVisitors(res?.data?.data);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      toast.error("Failed to fetch reports.");
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const filteredReports = visitors.filter((item) => {
    const { term, field } = searchParams;

    if (!term) return true;

    const lowerTerm = term.toLowerCase();
    const safeLower = (value) => (value ? value.toLowerCase() : "");

    switch (field) {
      case "name":
        return safeLower(item.name).includes(lowerTerm);

      case "contactno":
        return safeLower(item.contact_no).includes(lowerTerm);

      case "email":
        return safeLower(item.email).includes(lowerTerm);

      case "company":
        return safeLower(item.company).includes(lowerTerm);

      default:
        return (
          safeLower(item.name).includes(lowerTerm) ||
          safeLower(item.contact_no).includes(lowerTerm) ||
          safeLower(item.email).includes(lowerTerm) ||
          safeLower(item.company).includes(lowerTerm)
        );
    }
  });

  // Send report via email
  const handleSendReport = async () => {
    if (!filteredReports || filteredReports.length === 0) {
      toast.error("No report data to send.");
      return;
    }

    try {
      const res = await axios.post(`${baseURL}visitor/send-report`, {
        visitors: filteredReports,
      });

      if (res?.data?.success) {
        toast.success("Report sent successfully!");
      } else {
        toast.error(res?.data?.message || "Failed to send report.");
      }
    } catch (error) {
      console.error("Failed to send report:", error);
      toast.error("Failed to send report.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Visitors Reports" align="center" />

      {/* Tables Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1 text-center">
            <span className="text-2xl font-bold text-purple-800">
              Visitors Reports Overview
            </span>
          </div>
        </div>

        {/* Filters and Search Section */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl mb-4 flex flex-wrap justify-around items-center">
          <div className="flex flex-wrap items-center justify-center gap-2 bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl w-fit">
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
            <div>
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={fetchVisitors}
                disabled={loading}
              >
                Query
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search visitor..."
              className="px-3 py-2 border rounded-md w-64"
              value={searchParams.term}
              onChange={(e) =>
                setSearchParams((prev) => ({
                  ...prev,
                  term: e.target.value,
                }))
              }
            />

            <select
              className="px-3 py-2 border rounded-md z-50"
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
            </select>
          </div>

          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              Quick Filters
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
                textColor={ydayLoading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  ydayLoading ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                onClick={() => alert("Pending...")}
                disabled={ydayLoading}
              >
                YDAY
              </Button>
              <Button
                bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
                textColor={todayLoading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  todayLoading ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                onClick={() => alert("Pending...")}
                disabled={todayLoading}
              >
                TDAY
              </Button>
              <Button
                bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
                textColor={monthLoading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  monthLoading ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                onClick={() => alert("Pending...")}
                disabled={monthLoading}
              >
                MTD
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-full overflow-x-auto">
              <div className="flex justify-between items-center mb-2 px-6">
                <h3 className="text-xl font-semibold text-purple-700">
                  Visitors
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Total Visitors: {filteredReports.length || "0"}
                  </span>
                  <button
                    className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 text-sm cursor-pointer"
                    onClick={handleSendReport}
                  >
                    Send Report
                  </button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="min-w-full bg-white text-xs text-left table-auto">
                    <thead className="bg-purple-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-center border-b w-[50px]">
                          Sr.No.
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          Visitor Name
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[150px]">
                          Contact No.
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Email
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Company
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Address
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          State
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          City
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Identity Type
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Identity No
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Vehicle Details
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Department
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Employee Name
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Allow In
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Allow Till
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Purpose
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Conditional rendering for users */}
                      {filteredReports && filteredReports.length > 0 ? (
                        filteredReports.map((visitor, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 transition-colors duration-200"
                          >
                            <td className="px-2 py-2 text-center border-b">
                              {index + 1}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.visitor_name}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.contact_no}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.email}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.company}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.address}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.state}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.city}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.identity_type}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.identity_no}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.vehicle_details}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.department_name}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.employee_name}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.check_in_time &&
                                new Date(
                                  visitor.check_in_time
                                ).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 border-b">
                              {visitor.check_out_time === null ? (
                                <span className="text-green-600 font-bold">
                                  Currently In
                                </span>
                              ) : (
                                new Date(
                                  visitor.check_out_time
                                ).toLocaleString()
                              )}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.purpose_of_visit}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={17}
                            className="text-center py-4 text-gray-500"
                          >
                            No visitors found. Add a new visitor to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
