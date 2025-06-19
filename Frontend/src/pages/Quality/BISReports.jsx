import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FaFilePdf, FaDownload, FaEye, FaTrash } from "react-icons/fa";
import Title from "../../components/common/Title";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const BISReports = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
        url: `${baseURL}quality/download-bis-file/${file.fileName}`,
        method: "GET",
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.fileName);
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

  // View PDF in new tab
  const handleViewPDF = (file) => {
    window.open(`${baseURL}uploads-bis-pdf/${file.fileName}`, "_blank");
  };

  // Search functionality
  const filteredFiles = uploadedFiles.filter(
    (file) =>
      file.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <input
          type="text"
          placeholder="Search reports..."
          className="px-3 py-2 border rounded-md w-64"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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
                <th className="px-4 py-3 text-left">File Name</th>
                <th className="px-4 py-3 text-left">Uploaded At</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file, index) => (
                <tr
                  key={file.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold">{file.modelName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{file.year}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {file.description}
                  </td>
                  <td className="px-4 py-3 text-sm">{file.fileName}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(file.uploadAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 flex justify-center space-x-2">
                    <button
                      onClick={() => handleViewPDF(file)}
                      className="text-blue-500 hover:text-blue-700"
                      title="View PDF"
                    >
                      <FaEye />
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="text-green-500 hover:text-green-700"
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
