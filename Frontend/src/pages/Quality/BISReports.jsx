import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FaFilePdf, FaDownload } from "react-icons/fa";
import Title from "../../components/common/Title";
import { baseURL } from "../../assets/assets";

const BISReports = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    term: "",
    field: "all",
  });
  const [selectedPDF, setSelectedPDF] = useState(null);

  // Fetch uploaded files
  const fetchUploadedFiles = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-files`);
      setUploadedFiles(res?.data?.files || []);
    } catch (error) {
      toast.error("Failed to fetch uploaded files");
    } finally {
      setLoading(false);
    }
  };

  // Download file handler
  const handleDownload = async (file) => {
    try {
      const response = await axios({
        url: `${baseURL}quality/download-bis-file/${file.srNo}`,
        method: "GET",
        responseType: "blob",
        params: {
          filename: file.fileName,
        },
      });
      // Create a blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.fileName); // or use the original filename
      document.body.appendChild(link);
      link.click();

      // Clean up
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("File download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  // View PDF in new tab
  // const handleViewPDF = (file) => {
  //   try {
  //     if (!file || !file.url) {
  //       toast.error("Invalid file or file URL");
  //       return;
  //     }

  //     setSelectedPDF(file);
  //   } catch (error) {
  //     console.error("Error viewing PDF:", error);
  //     toast.error("Failed to open PDF");
  //   }
  // };

  // Search functionality
  const filteredFiles = uploadedFiles.filter((file) => {
    const { term, field } = searchParams;

    if (!term) return true;

    const lowerTerm = term.toLowerCase();
    const safeLower = (value) => (value ? value.toLowerCase() : "");

    switch (field) {
      case "modelName":
        return safeLower(file.modelName).includes(lowerTerm);

      case "year":
        return safeLower(file.year).includes(lowerTerm);

      case "description":
        return safeLower(file.description).includes(lowerTerm);

      case "fileName":
        return safeLower(file.fileName).includes(lowerTerm);

      default:
        return (
          safeLower(file.modelName).includes(lowerTerm) ||
          safeLower(file.year).includes(lowerTerm) ||
          safeLower(file.description).includes(lowerTerm) ||
          safeLower(file.fileName).includes(lowerTerm)
        );
    }
  });

  // Fetch files on component mount
  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <Title
        title="BIS Report"
        align="center"
        className="mb-8 text-3xl font-bold text-gray-800"
      />
      <div className="p-4 bg-gray-100 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FaFilePdf className="mr-3 text-red-500" />
          BIS Reports
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
            <option value="description">Description</option>
            <option value="fileName">File Name</option>
          </select>
        </div>
        {/* Pagination (Optional) could be added here */}
        <div className="p-4 bg-gray-100 text-right">
          <p className="text-sm text-gray-600">
            Total Reports: {filteredFiles.length}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-8">
          <p>Loading reports...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-8">
          <p>No reports found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">Sr. No.</th>
                <th className="px-4 py-3 text-left">Model Name</th>
                <th className="px-4 py-3 text-left">Year</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3">Test Frequency</th>
                <th className="px-4 py-3 text-left">File Name</th>
                <th className="px-4 py-3 text-left">Uploaded At</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file, index) => (
                <tr
                  key={index}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold">{file.modelName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {file.year}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {file.description}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    "Coming Soon..."
                  </td>
                  <td className="px-4 py-3 text-sm">{file.fileName}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(file.uploadAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 flex items-center justify-center">
                    <button
                      onClick={() => handleDownload(file)}
                      className="text-green-500 hover:text-green-700 cursor-pointer"
                      title="Download"
                    >
                      <FaDownload />
                    </button>
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

export default BISReports;