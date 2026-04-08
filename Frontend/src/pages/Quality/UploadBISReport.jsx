import { useEffect, useState, useMemo } from "react";
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
  FaSearch,
  FaFilter,
  FaChartBar,
  FaThLarge,
  FaTable,
  FaCheckCircle,
  FaClock,
  FaLayerGroup,
  FaCalendarAlt,
  FaSyncAlt,
} from "react-icons/fa";
import {
  MdDeleteForever,
  MdOutlineCloudUpload,
  MdInsertDriveFile,
} from "react-icons/md";
import { AiOutlineFile, AiOutlineBarChart } from "react-icons/ai";
import { BiStats } from "react-icons/bi";
import toast from "react-hot-toast";
import axios from "axios";
import PopupModal from "../../components/ui/PopupModal";
import { baseURL } from "../../assets/assets";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const FREQ_COLORS = {
  Monthly: "#6366f1",
  Quarterly: "#f59e0b",
  Yearly: "#10b981",
};

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2021 + 2 }, (_, i) => 2021 + i);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
      <Icon className="text-white text-xl" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Badge ────────────────────────────────────────────────────────────────────
const FreqBadge = ({ freq }) => {
  const styles = {
    Monthly: "bg-indigo-100 text-indigo-700",
    Quarterly: "bg-amber-100 text-amber-700",
    Yearly: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[freq] || "bg-gray-100 text-gray-600"}`}>
      {freq || "—"}
    </span>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ searchTerm }) => (
  <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
    <FaFilePdf className="mx-auto text-5xl text-gray-300 mb-3" />
    <p className="text-gray-500 font-medium">
      {searchTerm ? `No files match "${searchTerm}"` : "No BIS Reports uploaded yet"}
    </p>
    {!searchTerm && (
      <p className="text-sm text-gray-400 mt-1">
        Use the form above to upload your first report
      </p>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const UploadBISReport = () => {
  // Upload form state
  const [loading, setLoading] = useState(false);
  const [modelName, setModelName] = useState("");
  const [testFrequency, setTestFrequency] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  // Data state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [viewMode, setViewMode] = useState("card");
  const [activeTab, setActiveTab] = useState("upload");

  // Search state
  const [searchParams, setSearchParams] = useState({ term: "", field: "all" });

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToUpdate, setItemToUpdate] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFields, setUpdateFields] = useState({
    srNo: "", modelName: "", year: "", month: "",
    testFrequency: "", description: "", selectedFile: null,
  });

  // ── Derived / computed data ──────────────────────────────────────────────
  const filteredFiles = useMemo(() => {
    const { term = "", field = "all" } = searchParams;
    if (!term.trim()) return uploadedFiles;
    const lowerTerm = term.toLowerCase();
    const s = (v) => (v ? v.toString().toLowerCase() : "");
    return uploadedFiles.filter((f) => {
      switch (field) {
        case "modelName":     return s(f.modelName).includes(lowerTerm);
        case "year":          return s(f.year).includes(lowerTerm);
        case "month":         return s(f.month).includes(lowerTerm);
        case "testFrequency": return s(f.testFrequency).includes(lowerTerm);
        case "description":   return s(f.description).includes(lowerTerm);
        case "fileName":      return s(f.fileName).includes(lowerTerm);
        default:
          return (
            s(f.modelName).includes(lowerTerm) ||
            s(f.year).includes(lowerTerm) ||
            s(f.month).includes(lowerTerm) ||
            s(f.testFrequency).includes(lowerTerm) ||
            s(f.description).includes(lowerTerm) ||
            s(f.fileName).includes(lowerTerm)
          );
      }
    });
  }, [uploadedFiles, searchParams]);

  // Analytics data
  const stats = useMemo(() => {
    const totalFiles = uploadedFiles.length;
    const uniqueModels = new Set(uploadedFiles.map((f) => f.modelName)).size;
    const freqCounts = uploadedFiles.reduce((acc, f) => {
      acc[f.testFrequency] = (acc[f.testFrequency] || 0) + 1;
      return acc;
    }, {});
    const yearCounts = uploadedFiles.reduce((acc, f) => {
      acc[f.year] = (acc[f.year] || 0) + 1;
      return acc;
    }, {});

    const byYear = Object.entries(yearCounts)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);

    const byFreq = Object.entries(freqCounts).map(([name, value]) => ({ name, value }));

    const byMonth = MONTHS.map((m) => ({
      month: m.slice(0, 3),
      count: uploadedFiles.filter((f) => f.month === m).length,
    }));

    return { totalFiles, uniqueModels, freqCounts, byYear, byFreq, byMonth };
  }, [uploadedFiles]);

  // ── API calls ────────────────────────────────────────────────────────────
  const fetchUploadedFiles = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-files`);
      setUploadedFiles(res?.data?.files || []);
    } catch {
      toast.error("Failed to fetch uploaded files");
    }
  };

  useEffect(() => { fetchUploadedFiles(); }, []);

  // ── File validation helper ───────────────────────────────────────────────
  const validatePdf = (file) => {
    if (!file) return false;
    if (file.type !== "application/pdf") {
      toast.error("Please upload only PDF files");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10 MB");
      return false;
    }
    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && validatePdf(file)) setSelectedFile(file);
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!modelName.trim())     return toast.error("Model Name is required");
    if (!year.trim())          return toast.error("Year is required");
    if (!month.trim())         return toast.error("Month is required");
    if (!testFrequency.trim()) return toast.error("Test Frequency is required");
    if (!description.trim())   return toast.error("Description is required");
    if (!selectedFile)         return toast.error("Please select a PDF file");

    const formData = new FormData();
    formData.append("modelName", modelName.trim());
    formData.append("year", year.trim());
    formData.append("month", month.trim());
    formData.append("testFrequency", testFrequency.trim());
    formData.append("description", description.trim());
    formData.append("file", selectedFile);

    try {
      setLoading(true);
      const res = await axios.post(`${baseURL}quality/upload-bis-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res?.data?.success) {
        toast.success("BIS Report uploaded successfully");
        setModelName(""); setYear(""); setMonth("");
        setTestFrequency(""); setDescription(""); setSelectedFile(null);
        fetchUploadedFiles();
        setActiveTab("reports");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload BIS Report");
    } finally {
      setLoading(false);
    }
  };

  // ── Update ───────────────────────────────────────────────────────────────
  const handleUpdate = (item) => {
    setItemToUpdate(item);
    setUpdateFields({
      srNo: item.srNo, modelName: item.modelName, year: item.year,
      month: item.month, testFrequency: item.testFrequency,
      description: item.description, selectedFile: null,
    });
    setShowUpdateModal(true);
  };

  const confirmUpdate = async () => {
    const u = updateFields;
    if (!u.modelName?.trim())       return toast.error("Model Name is required");
    if (!u.year?.toString().trim()) return toast.error("Year is required");
    if (!u.month?.trim())           return toast.error("Month is required");
    if (!u.testFrequency?.trim())   return toast.error("Test Frequency is required");
    if (!u.description?.trim())     return toast.error("Description is required");

    const formData = new FormData();
    formData.append("modelName", u.modelName.trim());
    formData.append("year", u.year.toString().trim());
    formData.append("month", u.month.trim());
    formData.append("testFrequency", u.testFrequency.trim());
    formData.append("description", u.description.trim());
    if (u.selectedFile) formData.append("file", u.selectedFile);

    try {
      setLoading(true);
      const res = await axios.put(
        `${baseURL}quality/update-bis-file/${itemToUpdate.srNo}`, formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (res?.data?.success) {
        toast.success(res.data.message || "BIS Report updated successfully");
        fetchUploadedFiles();
        setShowUpdateModal(false);
        setUpdateFields({ srNo: "", modelName: "", year: "", month: "", testFrequency: "", description: "", selectedFile: null });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update BIS Report");
    } finally {
      setLoading(false);
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = async (file) => {
    try {
      const response = await axios({
        url: `${baseURL}quality/download-bis-file/${file.srNo}`,
        method: "GET",
        responseType: "blob",
        params: { filename: file.fileName },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download file");
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDeleteFile = (file) => { setItemToDelete(file); setShowDeleteModal(true); };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      const { srNo, fileName } = itemToDelete;
      const res = await axios.delete(`${baseURL}quality/delete-bis-file/${srNo}`, {
        params: { filename: fileName },
      });
      if (res?.data?.success) {
        toast.success("File deleted successfully");
        fetchUploadedFiles();
      }
      setShowDeleteModal(false);
    } catch {
      toast.error("Failed to delete file");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 w-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
            <FaFilePdf className="text-white text-base" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">BIS Report Manager</h1>
            <p className="text-xs text-gray-500">Upload, manage & analyse BIS test reports</p>
          </div>
        </div>
        <button
          onClick={fetchUploadedFiles}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <FaSyncAlt /> Refresh
        </button>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="px-6 py-5 w-full">

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 w-full">
          <StatCard icon={FaFilePdf}     label="Total Reports"     value={stats.totalFiles}              color="bg-indigo-500" />
          <StatCard icon={FaLayerGroup}  label="Unique Models"     value={stats.uniqueModels}            color="bg-violet-500" />
          <StatCard icon={FaCheckCircle} label="Monthly Reports"   value={stats.freqCounts.Monthly   || 0} color="bg-emerald-500" />
          <StatCard icon={FaClock}       label="Quarterly Reports" value={stats.freqCounts.Quarterly || 0} color="bg-amber-500" />
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {[
            { key: "upload",    label: "Upload Report", icon: FaCloudUploadAlt },
            { key: "reports",   label: "All Reports",   icon: FaTable },
            { key: "analytics", label: "Analytics",     icon: AiOutlineBarChart },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB: UPLOAD
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "upload" && (
          <div className="grid lg:grid-cols-2 xl:grid-cols-5 gap-6 w-full">

            {/* Form — wider on xl+ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 xl:col-span-3">
              <h2 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <FaLayerGroup className="text-indigo-500" /> Model Details
              </h2>

              <div className="space-y-4">
                {/* Model Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Model Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. ABC123456"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                  />
                </div>

                {/* Year + Month */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Year *</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                    >
                      <option value="">Select Year</option>
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Month *</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                    >
                      <option value="">Select Month</option>
                      {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {/* Test Frequency */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Test Frequency *</label>
                  <div className="flex gap-2">
                    {["Monthly", "Quarterly", "Yearly"].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTestFrequency(f)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                          testFrequency === f
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-gray-200 text-gray-600 hover:border-indigo-400 bg-gray-50"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Description *</label>
                  <textarea
                    placeholder="Briefly describe this test report..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* File Upload — narrower on xl+ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col xl:col-span-2">
              <h2 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <MdOutlineCloudUpload className="text-indigo-500 text-xl" /> Upload PDF
              </h2>

              {/* Drop Zone */}
              <label
                htmlFor="file-upload"
                className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all min-h-[200px] ${
                  selectedFile
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="text-center p-4">
                    <FaFilePdf className="text-5xl text-indigo-500 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-indigo-700 break-all">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <span className="mt-2 inline-block text-xs text-indigo-600 underline">Change file</span>
                  </div>
                ) : (
                  <div className="text-center p-6">
                    <MdOutlineCloudUpload className="text-6xl text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">Click to select a PDF</p>
                    <p className="text-xs text-gray-400 mt-1">Max size: 10 MB</p>
                  </div>
                )}
              </label>

              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="mt-3 text-xs text-red-500 hover:underline flex items-center gap-1 justify-center"
                >
                  <FaTrash className="w-3 h-3" /> Remove file
                </button>
              )}

              <button
                onClick={handleUpload}
                disabled={loading || !selectedFile}
                className={`mt-5 w-full py-3 rounded-xl font-semibold text-white text-sm transition-all flex items-center justify-center gap-2 ${
                  loading || !selectedFile
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg"
                }`}
              >
                <FaCloudUploadAlt />
                {loading ? "Uploading…" : "Upload Report"}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: REPORTS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "reports" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 w-full">

            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    type="text"
                    placeholder="Search reports…"
                    value={searchParams.term}
                    onChange={(e) => setSearchParams((p) => ({ ...p, term: e.target.value }))}
                    className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <select
                  value={searchParams.field}
                  onChange={(e) => setSearchParams((p) => ({ ...p, field: e.target.value }))}
                  className="h-9 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="all">All Fields</option>
                  <option value="modelName">Model Name</option>
                  <option value="year">Year</option>
                  <option value="month">Month</option>
                  <option value="testFrequency">Frequency</option>
                  <option value="description">Description</option>
                  <option value="fileName">File Name</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {filteredFiles.length} of {uploadedFiles.length} records
                </span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setViewMode("card")}
                    className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === "card" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                  >
                    <FaThLarge />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === "table" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                  >
                    <FaTable />
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {filteredFiles.length === 0 && (
              <EmptyState searchTerm={searchParams.term} />
            )}

            {/* Card View — responsive: 2 cols md, 3 cols xl, 4 cols 2xl */}
            {viewMode === "card" && filteredFiles.length > 0 && (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredFiles.map((file) => (
                  <FileCard
                    key={file.srNo}
                    file={file}
                    onEdit={handleUpdate}
                    onDownload={handleDownload}
                    onDelete={handleDeleteFile}
                  />
                ))}
              </div>
            )}

            {/* Table View — full width */}
            {viewMode === "table" && filteredFiles.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-100 w-full">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      {["Sr No","Model Name","Year","Month","Frequency","Description","File","Uploaded","Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredFiles.map((file) => (
                      <tr key={file.srNo} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{file.srNo}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">{file.modelName}</td>
                        <td className="px-4 py-3 text-gray-600">{file.year}</td>
                        <td className="px-4 py-3 text-gray-600">{file.month}</td>
                        <td className="px-4 py-3"><FreqBadge freq={file.testFrequency} /></td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{file.description}</td>
                        <td className="px-4 py-3">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline text-xs flex items-center gap-1"
                          >
                            <FaFilePdf className="text-red-500" />
                            <span className="truncate max-w-[120px]">{file.fileName}</span>
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {file.uploadAt ? new Date(file.uploadAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleUpdate(file)}      className="text-blue-500  hover:text-blue-700  p-1 rounded hover:bg-blue-50"  title="Edit"><FaEdit /></button>
                            <button onClick={() => handleDownload(file)}    className="text-green-500 hover:text-green-700 p-1 rounded hover:bg-green-50" title="Download"><FaDownload /></button>
                            <button onClick={() => handleDeleteFile(file)}  className="text-red-500   hover:text-red-700   p-1 rounded hover:bg-red-50"   title="Delete"><FaTrash /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <div className="space-y-6 w-full">
            {uploadedFiles.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <AiOutlineBarChart className="text-5xl text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No data available for analytics yet.</p>
                <p className="text-sm text-gray-400 mt-1">Upload some BIS reports to see charts.</p>
              </div>
            ) : (
              <>
                {/* Top row — 3 columns on xl+ */}
                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6 w-full">

                  {/* Reports by Year */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <FaChartBar className="text-indigo-500" /> Reports Uploaded by Year
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.byYear} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                          formatter={(v) => [v, "Reports"]}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Test Frequency Distribution */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <BiStats className="text-violet-500" /> Test Frequency Distribution
                    </h3>
                    {stats.byFreq.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={stats.byFreq}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {stats.byFreq.map((entry, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                            formatter={(v, n) => [v, n]}
                          />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-gray-400 text-center pt-16">No frequency data</p>
                    )}
                  </div>

                  {/* Reports by Month — full width on lg, 1 col on xl (3rd column) */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-2 xl:col-span-1">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <FaCalendarAlt className="text-emerald-500" /> Reports by Month
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.byMonth} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                          formatter={(v) => [v, "Reports"]}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Model Summary Table — full width */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 w-full">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <FaLayerGroup className="text-amber-500" /> Model-wise Summary
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Model Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Total Reports</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Years Covered</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Frequencies</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Latest Upload</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.entries(
                          uploadedFiles.reduce((acc, f) => {
                            const key = f.modelName;
                            if (!acc[key]) acc[key] = { count: 0, years: new Set(), freqs: new Set(), latest: null };
                            acc[key].count++;
                            acc[key].years.add(f.year);
                            acc[key].freqs.add(f.testFrequency);
                            const d = f.uploadAt ? new Date(f.uploadAt) : null;
                            if (d && (!acc[key].latest || d > acc[key].latest)) acc[key].latest = d;
                            return acc;
                          }, {})
                        ).map(([model, data]) => (
                          <tr key={model} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{model}</td>
                            <td className="px-4 py-3 text-gray-600">{data.count}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{[...data.years].sort().join(", ")}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {[...data.freqs].map((f) => <FreqBadge key={f} freq={f} />)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {data.latest ? data.latest.toLocaleDateString("en-IN") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          UPDATE MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showUpdateModal && (
        <PopupModal
          title="Update BIS Report"
          description=""
          confirmText={loading ? "Updating…" : "Save Changes"}
          cancelText="Cancel"
          modalId="update-modal"
          onConfirm={confirmUpdate}
          onCancel={() => setShowUpdateModal(false)}
          icon={<FaEdit className="text-blue-500 w-8 h-8 mx-auto" />}
          confirmButtonColor="bg-indigo-600 hover:bg-indigo-700"
          modalClassName="w-[95%] max-w-3xl"
        >
          <div className="mt-4 grid md:grid-cols-2 gap-5 text-left">

            {/* Left – File upload */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FaFileUpload className="text-indigo-500" /> Replace PDF (optional)
              </p>
              <label
                htmlFor="update-file-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl min-h-[140px] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-all"
              >
                <input
                  type="file"
                  id="update-file-upload"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && validatePdf(file))
                      setUpdateFields((p) => ({ ...p, selectedFile: file }));
                  }}
                  className="hidden"
                />
                <FaCloudUploadAlt className="text-4xl text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  {updateFields.selectedFile
                    ? updateFields.selectedFile.name
                    : "Click to upload new PDF"}
                </p>
              </label>

              {!updateFields.selectedFile && itemToUpdate?.fileName && (
                <div className="mt-3 p-2 bg-green-50 rounded-lg text-center">
                  <p className="text-xs text-green-700 flex items-center justify-center gap-1">
                    <MdInsertDriveFile /> Current: {itemToUpdate.fileName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Kept if no new file selected</p>
                </div>
              )}
              {updateFields.selectedFile && (
                <button
                  type="button"
                  onClick={() => setUpdateFields((p) => ({ ...p, selectedFile: null }))}
                  className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <FaTrash className="w-3 h-3" /> Remove new file
                </button>
              )}
            </div>

            {/* Right – Fields */}
            <div className="space-y-3">
              {/* Sr No + Model Name */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Model Name</label>
                  <input
                    type="text"
                    value={updateFields.modelName}
                    onChange={(e) => setUpdateFields((p) => ({ ...p, modelName: e.target.value }))}
                    className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sr No</label>
                  <div className="h-9 px-3 flex items-center bg-gray-100 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600">
                    {updateFields.srNo}
                  </div>
                </div>
              </div>

              {/* Year + Month + Frequency */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Year",
                    key: "year",
                    options: ["", ...YEARS].map((y) => ({ value: String(y), label: y || "Select" })),
                  },
                  {
                    label: "Month",
                    key: "month",
                    options: ["", ...MONTHS].map((m) => ({ value: m, label: m || "Select" })),
                  },
                  {
                    label: "Frequency",
                    key: "testFrequency",
                    options: [
                      { value: "", label: "Select" },
                      { value: "Monthly", label: "Monthly" },
                      { value: "Quarterly", label: "Quarterly" },
                      { value: "Yearly", label: "Yearly" },
                    ],
                  },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <select
                      value={updateFields[key]}
                      onChange={(e) => setUpdateFields((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full h-9 px-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={updateFields.description}
                  onChange={(e) => setUpdateFields((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
            </div>
          </div>
        </PopupModal>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DELETE MODAL
      ════════════════════════════════════════════════════════════════ */}
      {showDeleteModal && (
        <PopupModal
          title="Delete Report"
          description={`Are you sure you want to delete "${itemToDelete?.modelName} – ${itemToDelete?.month} ${itemToDelete?.year}"? This action cannot be undone.`}
          confirmText={loading ? "Deleting…" : "Yes, Delete"}
          cancelText="Cancel"
          modalId="delete-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={<MdDeleteForever className="text-red-500 w-12 h-12 mx-auto" />}
          confirmButtonColor="bg-red-600 hover:bg-red-700"
        />
      )}
    </div>
  );
};

// ─── File Card ────────────────────────────────────────────────────────────────
const FileCard = ({ file, onEdit, onDownload, onDelete }) => (
  <div className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">

    {/* Card Header */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
      <div className="flex items-center gap-2 min-w-0">
        <FaFilePdf className="text-red-500 text-lg flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{file.modelName}</p>
          <p className="text-xs text-gray-400 font-mono">#{file.srNo}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={() => onEdit(file)}     className="p-1.5 rounded-lg text-blue-500  hover:bg-blue-50  transition-colors" title="Edit"><FaEdit     className="text-xs" /></button>
        <button onClick={() => onDownload(file)} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 transition-colors" title="Download"><FaDownload className="text-xs" /></button>
        <button onClick={() => onDelete(file)}   className="p-1.5 rounded-lg text-red-500   hover:bg-red-50   transition-colors" title="Delete"><FaTrash    className="text-xs" /></button>
      </div>
    </div>

    {/* Card Body */}
    <div className="px-4 py-3 space-y-2 flex-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 flex items-center gap-1">
          <FaCalendarAlt className="text-gray-300" /> {file.month} {file.year}
        </span>
        <FreqBadge freq={file.testFrequency} />
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
        {file.description || "No description provided"}
      </p>
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400 truncate max-w-[60%]">{file.fileName}</p>
        <p className="text-xs text-gray-400">
          {file.uploadAt ? new Date(file.uploadAt).toLocaleDateString("en-IN") : "—"}
        </p>
      </div>
    </div>

    {/* Card Footer */}
    <div className="px-4 py-2.5 bg-indigo-50 rounded-b-xl">
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center justify-center gap-1.5 font-medium"
      >
        <FaFilePdf className="text-red-400" /> View PDF
      </a>
    </div>
  </div>
);

export default UploadBISReport;