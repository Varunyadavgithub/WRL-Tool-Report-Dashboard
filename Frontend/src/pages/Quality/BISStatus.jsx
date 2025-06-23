import axios from "axios";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Title from "../../components/common/Title";
import { FaClockRotateLeft } from "react-icons/fa6";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const BISStatus = () => {
  const [bisStatus, setBisStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    term: "",
    field: "all",
  });

  // Fetch uploaded files
  const fetchBisStatus = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-status`);

      if (res?.data?.success) {
        setBisStatus(res?.data?.data || []);
      }
    } catch (error) {
      toast.error("Failed to fetch BIS Status.");
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const filteredReport = bisStatus.filter((report) => {
    const { term, field } = searchParams;

    if (!term) return true;

    switch (field) {
      case "modelName":
        return report.ModelName.toLowerCase().includes(term.toLowerCase());

      case "year":
        return report.Year.toString()
          .toLowerCase()
          .includes(term.toLowerCase());

      case "productionCount":
        return report.Prod_Count.toString()
          .toLowerCase()
          .includes(term.toLowerCase());

      case "status":
        return report.Status.toLowerCase().includes(term.toLowerCase());

      default:
        return (
          report.ModelName.toLowerCase().includes(term.toLowerCase()) ||
          report.Year.toString().toLowerCase().includes(term.toLowerCase()) ||
          report.Prod_Count.toString()
            .toLowerCase()
            .includes(term.toLowerCase()) ||
          report.Status.toLowerCase().includes(term.toLowerCase())
        );
    }
  });

  // Fetch files on component mount
  useEffect(() => {
    fetchBisStatus();
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <Title
        title="BIS Status"
        align="center"
        className="mb-8 text-3xl font-bold text-gray-800"
      />
      <div className="p-4 bg-gray-100 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FaClockRotateLeft className="mr-3 text-red-500" />
          BIS Status
        </h1>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search files..."
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
            className="px-3 py-2 border rounded-md"
            value={searchParams.field}
            onChange={(e) =>
              setSearchParams((prev) => ({
                ...prev,
                field: e.target.value,
              }))
            }
          >
            <option value="all">All Fields</option>
            <option value="modelName">Model Name</option>
            <option value="year">Year</option>
            <option value="productionCount">Production Count</option>
            <option value="status">Status</option>
          </select>
        </div>
        {/* Pagination (Optional) could be added here */}
        <div className="p-4 bg-gray-100 text-right">
          <p className="text-sm text-gray-600">
            Total Reports: {filteredReport.length}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-8">
          <p>Loading reports...</p>
        </div>
      ) : filteredReport.length === 0 ? (
        <div className="text-center py-8">
          <p>No reports found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-200 text-center">
              <tr>
                <th className="px-4 py-3">Sr. No.</th>
                <th className="px-4 py-3">Model Name</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Production Count</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="text-center">
              {filteredReport.map((report, index) => (
                <tr
                  key={index}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold">
                    {report.ModelName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {report.Year}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {report.Prod_Count}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm ${
                      report.Status === "Tested"
                        ? "bg-green-500"
                        : "bg-yellow-300"
                    }`}
                  >
                    {report.Status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BISStatus;
