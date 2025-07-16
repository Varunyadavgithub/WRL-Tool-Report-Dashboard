import axios from "axios";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Title from "../../components/common/Title";
import { FaClockRotateLeft, FaDownload } from "react-icons/fa6";
import { baseURL } from "../../assets/assets";

const BISStatus = () => {
  const [bisStatus, setBisStatus] = useState({
    status: [],
    files: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    term: "",
    field: "all",
  });

  // Fetch BIS Status and Files
  const fetchBisStatus = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-status`);

      if (res?.data?.success) {
        const statusData = res.data.status || [];
        setBisStatus({
          status: statusData,
          files: res.data.files || [],
        });
      } else {
        toast.error("Failed to fetch BIS Status");
      }
    } catch (error) {
      console.error("Error fetching BIS status:", error);
      toast.error("Failed to fetch BIS Status");
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const filteredReport = (() => {
    if (!bisStatus.status || bisStatus.status.length === 0) {
      return [];
    }

    return bisStatus.status.filter((report) => {
      const { term, field } = searchParams;

      if (!term) return true;

      const lowercaseTerm = term.toLowerCase();
      const modelName = (report.ModelName || "").toLowerCase();
      const year = report.Year ? report.Year.toString().toLowerCase() : "";
      const prodCount = report.Prod_Count
        ? report.Prod_Count.toString().toLowerCase()
        : "";
      const status = (report.Status || "").toLowerCase();

      switch (field) {
        case "modelName":
          return modelName.includes(lowercaseTerm);

        case "year":
          return year.includes(lowercaseTerm);

        case "productionCount":
          return prodCount.includes(lowercaseTerm);

        case "status":
          return status.includes(lowercaseTerm);

        default:
          return (
            modelName.includes(lowercaseTerm) ||
            year.includes(lowercaseTerm) ||
            prodCount.includes(lowercaseTerm) ||
            status.includes(lowercaseTerm)
          );
      }
    });
  })();

  const testCompletedCount = filteredReport.filter(
    (report) => report.Status === "Test Completed"
  ).length;

  const testPendingCount = filteredReport.filter(
    (report) => report.Status !== "Test Completed"
  ).length;

  // Download file handler
  const handleDownload = async (report) => {
    // Find the corresponding file for the report
    const matchedFile = bisStatus.files.find(
      (file) =>
        file.modelName === report.ModelName &&
        file.year === report.Year.toString()
    );

    if (!matchedFile) {
      toast.error("No file found for this report");
      return;
    }

    try {
      const response = await axios({
        url: `${baseURL}quality/download-bis-file/${matchedFile.srNo}`,
        method: "GET",
        responseType: "blob",
        params: {
          filename: matchedFile.fileName,
        },
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", matchedFile.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("File download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

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
        <div className="flex flex-col p-4 bg-gray-100 text-right">
          <p className="text-sm text-gray-600">
            Total Reports: {filteredReport.length}
          </p>
          <div className="flex gap-4">
            <p className="text-sm text-green-600">
              Test Completed: {testCompletedCount}
            </p>
            <p className="text-sm text-yellow-600">
              Test Pending: {testPendingCount}
            </p>
          </div>
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
              {filteredReport.map((report, index) => {
                // Find the corresponding file for this report
                const matchedFile = bisStatus.files.find(
                  (file) =>
                    file.modelName === report.ModelName &&
                    file.year === report.Year.toString()
                );
                return (
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
                      className={`px-4 py-3 text-sm flex items-center justify-between ${
                        report.Status === "Test Completed"
                          ? "bg-green-50 text-green-800 border-l-4 border-green-500"
                          : "bg-yellow-50 text-yellow-800 border-l-4 border-yellow-500"
                      }`}
                    >
                      <span className="font-medium">{report.Status}</span>
                      {report.Status === "Test Completed" && matchedFile && (
                        <button
                          onClick={() => handleDownload(report)}
                          className="text-green-600 hover:bg-green-100 p-2 rounded-full transition-all duration-300 ease-in-out hover:scale-110"
                          title="Download"
                        >
                          <FaDownload className="w-5 h-5 cursor-pointer" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BISStatus;
