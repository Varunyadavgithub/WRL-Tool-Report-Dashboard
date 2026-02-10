import { useEffect, useState } from "react";
import Title from "../../components/ui/Title";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import {
  FaCloudUploadAlt,
  FaFileUpload,
  FaEdit,
  FaTrash,
  FaFilePdf,
  FaDownload,
} from "react-icons/fa";
import { AiOutlineFile } from "react-icons/ai";
import toast from "react-hot-toast";
import axios from "axios";
import { Link } from "react-router-dom";
import PopupModal from "../../components/ui/PopupModal";
import { MdDeleteForever } from "react-icons/md";
import { baseURL } from "../../assets/assets";

const UploadBISReport = () => {
  const [loading, setLoading] = useState(false);
  const [modelName, setModelName] = useState("");
  const [testFrequency, setTestFrequency] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToUpdate, setItemToUpdate] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFields, setUpdateFields] = useState({
    modelName: "",
    year: "",
    month: "",
    testFrequency: "",
    description: "",
    selectedFile: "",
  });
  const [searchParams, setSearchParams] = useState({
    term: "",
    field: "all",
  });

  const filteredFiles = uploadedFiles.filter((file) => {
    const { term = "", field = "" } = searchParams || {};
    if (!term) return true;

    const lowerTerm = term.toLowerCase();

    const safeLower = (value) => (value ? value.toString().toLowerCase() : "");

    const modelName = safeLower(file.modelName);
    const year = safeLower(file.year);
    const month = safeLower(file.month);
    const testFrequency = safeLower(file.testFrequency);
    const description = safeLower(file.description);
    const fileName = safeLower(file.fileName);

    switch (field) {
      case "modelName":
        return modelName.includes(lowerTerm);

      case "year":
        return year.includes(lowerTerm);

      case "month":
        return month.includes(lowerTerm);

      case "testFrequency":
        return testFrequency.includes(lowerTerm);

      case "description":
        return description.includes(lowerTerm);

      case "fileName":
        return fileName.includes(lowerTerm);

      default:
        return (
          modelName.includes(lowerTerm) ||
          year.includes(lowerTerm) ||
          month.includes(lowerTerm) ||
          testFrequency.includes(lowerTerm) ||
          description.includes(lowerTerm) ||
          fileName.includes(lowerTerm)
        );
    }
  });

  const fetchUploadedFiles = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-files`);
      setUploadedFiles(res?.data?.files);
    } catch (error) {
      toast.error("Failed to fetch uploaded files");
    }
  };

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please upload only PDF files");
        return;
      }
      if (file.size > maxSize) {
        toast.error("File size should be less than 5MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!modelName.trim()) {
      toast.error("Model Name is required");
      return;
    }

    if (!year.trim()) {
      toast.error("Year is required");
      return;
    }

    if (!month.trim()) {
      toast.error("Month is required");
      return;
    }

    if (!testFrequency.trim()) {
      toast.error("Test Frequency is required");
      return;
    }

    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a PDF file");
      return;
    }

    const formData = new FormData();
    formData.append("modelName", modelName.trim());
    formData.append("year", year.trim());
    formData.append("month", month.trim());
    formData.append("testFrequency", testFrequency.trim());
    formData.append("description", description.trim());
    formData.append("file", selectedFile);

    try {
      setLoading(true);

      const res = await axios.post(
        `${baseURL}quality/upload-bis-pdf`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      if (res?.data?.success) {
        toast.success("BIS Report uploaded successfully");
      }

      setModelName("");
      setYear("");
      setMonth("");
      setTestFrequency("");
      setDescription("");
      setSelectedFile(null);
      fetchUploadedFiles();
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to upload BIS Report";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (item) => {
    setItemToUpdate(item);
    setUpdateFields({
      srNo: item.srNo,
      modelName: item.modelName,
      year: item.year,
      month: item.month,
      testFrequency: item.testFrequency,
      description: item.description,
      selectedFile: null,
    });
    setShowUpdateModal(true);
  };

  const confirmUpdate = async () => {
    // Validation
    if (!updateFields.modelName || !updateFields.modelName.trim()) {
      toast.error("Model Name is required");
      return;
    }

    if (!updateFields.year || !updateFields.year.toString().trim()) {
      toast.error("Year is required");
      return;
    }

    if (!updateFields.month || !updateFields.month.trim()) {
      toast.error("Month is required");
      return;
    }

    if (!updateFields.testFrequency || !updateFields.testFrequency.trim()) {
      toast.error("Test Frequency is required");
      return;
    }

    if (!updateFields.description || !updateFields.description.trim()) {
      toast.error("Description is required");
      return;
    }

    const formData = new FormData();
    formData.append("modelName", updateFields.modelName.trim());
    formData.append("year", updateFields.year.toString().trim());
    formData.append("month", updateFields.month.trim());
    formData.append("testFrequency", updateFields.testFrequency.trim());
    formData.append("description", updateFields.description.trim());

    // ✅ Only append file if user selected a NEW file
    if (updateFields.selectedFile) {
      formData.append("file", updateFields.selectedFile);
    }

    try {
      setLoading(true);
      const { srNo } = itemToUpdate;

      const res = await axios.put(
        `${baseURL}quality/update-bis-file/${srNo}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (res?.data?.success) {
        toast.success(res.data.message || "BIS Report updated successfully");
        fetchUploadedFiles();
        setShowUpdateModal(false);

        // Reset update fields
        setUpdateFields({
          srNo: "",
          modelName: "",
          year: "",
          month: "",
          testFrequency: "",
          description: "",
          selectedFile: null,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update BIS Report");
    } finally {
      setLoading(false);
    }
  };

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

  const handleDeleteFile = (file) => {
    setItemToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);

      const { srNo, fileName } = itemToDelete;
      const res = await axios.delete(
        `${baseURL}quality/delete-bis-file/${srNo}`,
        {
          params: {
            filename: fileName,
          },
        },
      );

      if (res?.data?.success) {
        toast.success("File deleted successfully");
        fetchUploadedFiles();
      }

      setShowDeleteModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete File.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="container mx-auto max-w-4xl">
        <Title
          title="Upload BIS Report"
          align="center"
          className="mb-8 text-3xl font-bold text-gray-800"
        />

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Model Details Section */}
          <div className="bg-white shadow-lg rounded-xl border border-purple-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <FaCloudUploadAlt className="mr-2 text-purple-600" />
              Model Details
            </h2>

            <div className="space-y-4">
              {/* Row 1 */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label
                    htmlFor="modelName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Model Name
                  </label>
                  <InputField
                    id="modelName"
                    type="text"
                    placeholder="Enter Model Name"
                    className="w-full"
                    name="modelName"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label
                    htmlFor="year"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Year
                  </label>
                  <select
                    id="year"
                    className="w-full border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    name="year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="">Select Year</option>
                    {Array.from(
                      { length: new Date().getFullYear() - 2021 + 1 },
                      (_, index) => 2021 + index,
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label
                    htmlFor="month"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Month
                  </label>

                  <select
                    id="month"
                    className="w-full border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    name="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    <option value="">Select Month</option>
                    {[
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Test Frequency */}
              <div>
                <label
                  htmlFor="testFrequency"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Test Frequency
                </label>
                <select
                  id="testFrequency"
                  name="testFrequency"
                  className="w-full border border-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={testFrequency}
                  onChange={(e) => setTestFrequency(e.target.value)}
                >
                  <option value="">Select Frequency</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Enter Description"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition duration-300"
                  rows="4"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="bg-white shadow-lg rounded-xl border border-purple-100 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <FaFileUpload className="mr-2 text-blue-600" />
              Upload File
            </h2>

            <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="file-upload"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <FaCloudUploadAlt className="text-5xl text-purple-500 mb-4" />
                <p className="text-gray-600">
                  {selectedFile
                    ? `Selected: ${selectedFile.name}`
                    : "Click to upload PDF"}
                </p>
              </label>
            </div>
            {selectedFile && (
              <div className="mt-4 text-sm text-gray-600">
                <p>File: {selectedFile.name}</p>
                <p>Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
              </div>
            )}

            <div className="mt-6 flex justify-center">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-purple-600"}
                textColor="text-white"
                className={`px-8 py-3 rounded-lg hover:shadow-lg transition duration-300 ${
                  loading
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-purple-700"
                }`}
                onClick={handleUpload}
                disabled={loading || !selectedFile}
              >
                {loading ? "Uploading..." : "Upload Report"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Files Section */}
      <div className="bg-white shadow-lg rounded-xl border border-purple-100 p-6 mt-4">
        <div className="flex gap-4 items-center justify-center py-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center justify-center">
            <FaFilePdf className="mr-2 text-red-600" />
            Uploaded Files
          </h2>
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
              <option value="month">Month</option>
              <option value="testFrequency">Test Frequency</option>
              <option value="description">Description</option>
              <option value="fileName">File Name</option>
            </select>
          </div>
        </div>

        {uploadedFiles.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <FaFilePdf className="mx-auto text-6xl text-gray-300 mb-4" />

            <p className="text-gray-500 text-lg">
              {searchParams.term
                ? `No files found matching "${searchParams.term}"`
                : "No files uploaded yet"}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.srNo}
                className="bg-white border border-purple-100 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex items-center">
                    <h3 className="font-semibold text-gray-800 truncate max-w-[200px]">
                      {file.srNo}
                    </h3>
                  </div>
                  <div className="flex items-center">
                    <FaFilePdf className="text-red-500 mr-2 text-2xl" />
                    <h3 className="font-semibold text-gray-800 truncate max-w-[200px]">
                      {file.modelName}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUpdate(file)}
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1 rounded-full transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="text-blue-500 hover:text-blue-700 flex items-center cursor-pointer"
                    >
                      <FaDownload />
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-full transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-4 gap-4 text-xs text-gray-600">
                    <div className="mb-2">
                      <label className="text-xs text-gray-500 block mb-1">
                        Description
                      </label>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {file.description || "No description provided"}
                      </p>
                    </div>
                    <div className="mb-2">
                      <label className="text-xs text-gray-500 block mb-1">
                        Test Frequency
                      </label>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {file.testFrequency || "No Test Frequency provided"}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Year</span>
                      <p className="truncate">{file.year}</p>
                    </div>
                    <div>
                      <span className="font-medium">Month</span>
                      <p className="truncate">{file.month}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">File Name:</span>
                      <p className="truncate">{file.fileName}</p>
                    </div>

                    <div>
                      <span className="font-medium">Uploaded At:</span>
                      <p>{new Date(file.uploadAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-2 text-center">
                  <Link
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-800 text-sm flex items-center justify-center cursor-pointer"
                  >
                    <FaFilePdf className="mr-2" /> View PDF
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUpdateModal && (
        <PopupModal
          title="Update BIS Report"
          description=""
          confirmText="Update"
          cancelText="Cancel"
          modalId="update-modal"
          onConfirm={confirmUpdate}
          onCancel={() => setShowUpdateModal(false)}
          icon={
            <FaEdit className="text-blue-500 w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
          }
          confirmButtonColor="bg-blue-600 hover:bg-blue-700"
          modalClassName="w-[95%] max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl"
        >
          <div className="mt-4 text-left">
            {/* Main Grid - Side by side on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {/* Left Column - Upload Box */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center">
                  <FaFileUpload className="mr-2 text-blue-600" />
                  Upload File
                </h2>

                <div className="border-2 border-dashed border-purple-300 dark:border-purple-500 rounded-lg p-4 sm:p-5 text-center bg-white dark:bg-gray-700">
                  <input
                    type="file"
                    id="update-file-upload"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      const maxSize = 10 * 1024 * 1024;

                      if (file) {
                        if (file.type !== "application/pdf") {
                          toast.error("Please upload only PDF files");
                          return;
                        }
                        if (file.size > maxSize) {
                          toast.error("File size should be less than 10MB");
                          return;
                        }
                        setUpdateFields((prev) => ({
                          ...prev,
                          selectedFile: file,
                        }));
                      }
                    }}
                    className="hidden"
                  />

                  <label
                    htmlFor="update-file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <FaCloudUploadAlt className="text-4xl sm:text-5xl text-purple-500 mb-2 sm:mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {updateFields.selectedFile
                        ? `New: ${updateFields.selectedFile.name}`
                        : "Click to upload new PDF (Optional)"}
                    </p>
                  </label>

                  {/* Current File Info */}
                  {!updateFields.selectedFile && itemToUpdate?.fileName && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/30 rounded-lg flex flex-col items-center justify-center text-center">
                      <p className="text-xs sm:text-sm text-green-700 dark:text-green-400 break-all flex items-center gap-1">
                        <AiOutlineFile /> Current: {itemToUpdate.fileName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        (Kept if no new file uploaded)
                      </p>
                    </div>
                  )}

                  {/* New File Info */}
                  {updateFields.selectedFile && (
                    <div className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      <p className="break-all">
                        New: {updateFields.selectedFile.name}
                      </p>
                      <p>
                        Size:{" "}
                        {(updateFields.selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setUpdateFields((prev) => ({
                            ...prev,
                            selectedFile: null,
                          }))
                        }
                        className="text-red-500 text-xs mt-2 hover:underline inline-flex items-center gap-1"
                      >
                        <FaTrash className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Form Fields */}
              <div className="space-y-3">
                {/* Row 1: Model Name & Sr No */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                      Model Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Model Name"
                      value={updateFields.modelName}
                      onChange={(e) =>
                        setUpdateFields({
                          ...updateFields,
                          modelName: e.target.value,
                        })
                      }
                      className="w-full h-10 px-3 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                      Sr No
                    </label>
                    <div className="h-10 px-3 flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {updateFields.srNo}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Year, Month, Frequency */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                      Year
                    </label>
                    <select
                      value={updateFields.year}
                      onChange={(e) =>
                        setUpdateFields({
                          ...updateFields,
                          year: String(e.target.value),
                        })
                      }
                      className="w-full h-10 px-2 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      {Array.from(
                        { length: new Date().getFullYear() - 2021 + 1 },
                        (_, i) => 2021 + i,
                      ).map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                      Month
                    </label>
                    <select
                      value={updateFields.month}
                      onChange={(e) =>
                        setUpdateFields({
                          ...updateFields,
                          month: e.target.value,
                        })
                      }
                      className="w-full h-10 px-2 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      {[
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                      Frequency
                    </label>
                    <select
                      value={updateFields.testFrequency}
                      onChange={(e) =>
                        setUpdateFields({
                          ...updateFields,
                          testFrequency: e.target.value,
                        })
                      }
                      className="w-full h-10 px-2 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                    Description
                  </label>
                  <textarea
                    placeholder="Enter Description"
                    value={updateFields.description}
                    onChange={(e) =>
                      setUpdateFields({
                        ...updateFields,
                        description: e.target.value,
                      })
                    }
                    className="w-full p-2.5 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows="4"
                  />
                </div>
              </div>
            </div>
          </div>
        </PopupModal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <PopupModal
          title="Delete Confirmation"
          description="Are you sure you want to delete this item?"
          confirmText="Yes, Delete"
          cancelText="Cancel"
          modalId="delete-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={<MdDeleteForever className="text-red-500 w-12 h-12 mx-auto" />}
        />
      )}
    </div>
  );
};

export default UploadBISReport;
