import { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import Title from "../../components/common/Title";
import Loader from "../../components/common/Loader";
import toast from "react-hot-toast";
import { BsEye, BsDownload, BsTrash } from "react-icons/bs";
import { useSelector } from "react-redux";
import PopupModal from "../../components/common/PopupModal";
import { MdDeleteForever } from "react-icons/md";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const FiveDaysPlanning = () => {
  const { user } = useSelector((store) => store.auth);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [activePreviewId, setActivePreviewId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    fetchFilesFromServer();
  }, []);

  const fetchFilesFromServer = async () => {
    try {
      const res = await axios.get(`${baseURL}planing/files`);
      setFiles(res.data.files);
    } catch (error) {
      console.error("Failed to fetch files:", error);
      toast.error("Failed to fetch files:");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(`${baseURL}planing/upload-excel`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setFiles((prev) => [
        { id: Date.now(), filename: res.data.filename, url: res.data.fileUrl },
        ...prev,
      ]);

      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("File upload failed", error);
      toast.error("File upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewFile = async (file) => {
    if (activePreviewId === file.id) {
      setActivePreviewId(null);
      setPreviewData(null);
      return;
    }

    try {
      setLoading(true);
      setActivePreviewId(file.id);
      const response = await axios.get(`http://localhost:3000${file.url}`, {
        responseType: "arraybuffer",
      });

      const workbook = XLSX.read(response.data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: true,
        defval: "",
      });

      setPreviewData(jsonData);
      toast.success("File preview loaded");
    } catch (error) {
      console.error("Preview failed", error);
      toast.error("Preview failed");
      setActivePreviewId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      setLoading(true);
      const filename = file.url.split("/").pop();

      const res = await axios.get(`${baseURL}planing/download/${filename}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data]);
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", file.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("File download failed", error);
      toast.error("File download failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (file) => {
    setItemToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      const filename = itemToDelete.url.split("/").pop();

      await axios.delete(`${baseURL}planing/delete/${filename}`);

      setFiles((prevFiles) =>
        prevFiles.filter((f) => f.id !== itemToDelete.id)
      );

      if (activePreviewId === itemToDelete.id) {
        setActivePreviewId(null);
        setPreviewData(null);
      }
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("File download failed", error);
      toast.error("File delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-auto max-w-full">
      <Title title="Five Days Planning" align="center" />
      {/* Upload Section */}
      {user.role === "admin" && (
        <div className="my-6 flex flex-col items-center gap-4">
          <label className="block text-lg font-semibold">
            Upload Excel File (Authorized User Only)
          </label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="border p-2 rounded bg-white shadow"
          />
        </div>
      )}

      {/* Files List */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <h3 className="text-xl font-bold mb-4 text-center text-purple-900">
          Available Excel Files
        </h3>

        {files.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="bg-white rounded-lg shadow-md p-4 border border-purple-300"
              >
                <h4 className="font-semibold text-gray-800 truncate mb-3">
                  {file.filename}
                </h4>

                <div className="mt-2 flex flex-wrap gap-2">
                  {/* Preview */}
                  <button
                    onClick={() => handlePreviewFile(file)}
                    className={`p-2 rounded transition cursor-pointer ${
                      activePreviewId === file.id
                        ? "bg-gray-300 text-gray-600"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    <BsEye
                      size={18}
                      className={`transition-transform duration-300 ${
                        activePreviewId === file.id ? "scale-x-[-1]" : ""
                      }`}
                    />
                  </button>

                  {/* Download */}
                  <button
                    onClick={() => handleDownloadFile(file)}
                    className="bg-green-600 text-white p-2 rounded hover:bg-green-700 transition cursor-pointer"
                    title="Download"
                  >
                    <BsDownload size={18} />
                  </button>

                  {/* Delete (only for admin) */}
                  {user.role === "admin" && (
                    <button
                      onClick={() => handleDeleteFile(file)}
                      className="bg-red-600 text-white p-2 rounded hover:bg-red-700 transition cursor-pointer"
                      title="Delete"
                    >
                      <BsTrash size={18} />
                    </button>
                  )}
                  {/* Delete Confirmation Modal */}
                  {showDeleteModal && (
                    <PopupModal
                      title="Delete Confirmation"
                      description="Are you sure you want to delete this File?"
                      confirmText="Yes, Delete"
                      cancelText="Cancel"
                      modalId="delete-modal"
                      onConfirm={confirmDelete}
                      onCancel={() => setShowDeleteModal(false)}
                      icon={
                        <MdDeleteForever className="text-red-500 w-12 h-12 mx-auto" />
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-600 text-lg">
            No files uploaded yet.
          </p>
        )}
      </div>
      {loading && <Loader />}

      {/* Preview Table */}
      {previewData && (
        <div className="mt-10 bg-white shadow rounded">
          <h2 className="text-xl font-bold mb-4 text-center text-blue-800">
            Preview Data
          </h2>
          <table className="max-w-4xl border-collapse text-xs text-left text-gray-700">
            <thead className="bg-blue-200 text-gray-900">
              <tr>
                {previewData[0]?.map((cell, index) => (
                  <th key={index} className="border">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {previewData[0].map((_, cellIndex) => (
                    <td key={cellIndex} className="border">
                      {row[cellIndex] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FiveDaysPlanning;
