import { useEffect, useState, useMemo } from "react";
import {
  Upload,
  FileUp,
  Pencil,
  Trash2,
  FileText,
  Download,
  Search,
  BarChart2,
  LayoutGrid,
  Table2,
  CheckCircle,
  Clock,
  Layers,
  Calendar,
  RefreshCw,
  CloudUpload,
  AlertTriangle,
  PackageOpen,
  X,
  Filter,
} from "lucide-react";
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

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS = [
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
];

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR - 2021 + 2 },
  (_, i) => 2021 + i,
);

// ── Freq Badge ─────────────────────────────────────────────────────────────────
const FreqBadge = ({ freq }) => {
  const styles = {
    Monthly: "bg-indigo-50 text-indigo-700 border-indigo-200",
    Quarterly: "bg-amber-50 text-amber-700 border-amber-200",
    Yearly: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[freq] || "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {freq || "—"}
    </span>
  );
};

// ── Field Label ────────────────────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
    {children}
  </label>
);

// ── Input styles ───────────────────────────────────────────────────────────────
const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300";

// ── File Card ──────────────────────────────────────────────────────────────────
const FileCard = ({ file, onEdit, onDownload, onDelete }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-red-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {file.modelName}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">#{file.srNo}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(file)}
          title="Edit"
          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDownload(file)}
          title="Download"
          className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
        >
          <Download className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(file)}
          title="Delete"
          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
    <div className="px-4 py-3 space-y-2 flex-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 flex items-center gap-1 font-mono">
          <Calendar className="w-3 h-3 text-slate-300" /> {file.month}{" "}
          {file.year}
        </span>
        <FreqBadge freq={file.testFrequency} />
      </div>
      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
        {file.description || "No description provided"}
      </p>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-slate-400 truncate max-w-[60%] font-mono">
          {file.fileName}
        </p>
        <p className="text-[10px] text-slate-400">
          {file.uploadAt
            ? new Date(file.uploadAt).toLocaleDateString("en-IN")
            : "—"}
        </p>
      </div>
    </div>
    <div className="px-4 py-2.5 bg-blue-50 rounded-b-xl border-t border-blue-100">
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 text-xs flex items-center justify-center gap-1.5 font-semibold"
      >
        <FileText className="w-3 h-3 text-red-400" /> View PDF
      </a>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const UploadBISReport = () => {
  const [loading, setLoading] = useState(false);
  const [modelName, setModelName] = useState("");
  const [testFrequency, setTestFrequency] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [viewMode, setViewMode] = useState("card");
  const [activeTab, setActiveTab] = useState("upload");
  const [searchParams, setSearchParams] = useState({ term: "", field: "all" });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToUpdate, setItemToUpdate] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFields, setUpdateFields] = useState({
    srNo: "",
    modelName: "",
    year: "",
    month: "",
    testFrequency: "",
    description: "",
    selectedFile: null,
  });

  // ── Derived ──────────────────────────────────────────────────────────────
  const filteredFiles = useMemo(() => {
    const { term = "", field = "all" } = searchParams;
    if (!term.trim()) return uploadedFiles;
    const lowerTerm = term.toLowerCase();
    const s = (v) => (v ? v.toString().toLowerCase() : "");
    return uploadedFiles.filter((f) => {
      if (field !== "all") return s(f[field]).includes(lowerTerm);
      return [
        "modelName",
        "year",
        "month",
        "testFrequency",
        "description",
        "fileName",
      ].some((k) => s(f[k]).includes(lowerTerm));
    });
  }, [uploadedFiles, searchParams]);

  const stats = useMemo(() => {
    const freqCounts = uploadedFiles.reduce((acc, f) => {
      acc[f.testFrequency] = (acc[f.testFrequency] || 0) + 1;
      return acc;
    }, {});
    const yearCounts = uploadedFiles.reduce((acc, f) => {
      acc[f.year] = (acc[f.year] || 0) + 1;
      return acc;
    }, {});
    return {
      totalFiles: uploadedFiles.length,
      uniqueModels: new Set(uploadedFiles.map((f) => f.modelName)).size,
      freqCounts,
      byYear: Object.entries(yearCounts)
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => a.year - b.year),
      byFreq: Object.entries(freqCounts).map(([name, value]) => ({
        name,
        value,
      })),
      byMonth: MONTHS.map((m) => ({
        month: m.slice(0, 3),
        count: uploadedFiles.filter((f) => f.month === m).length,
      })),
    };
  }, [uploadedFiles]);

  // ── API ───────────────────────────────────────────────────────────────────
  const fetchUploadedFiles = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-files`);
      setUploadedFiles(res?.data?.files || []);
    } catch {
      toast.error("Failed to fetch uploaded files");
    }
  };
  useEffect(() => {
    fetchUploadedFiles();
  }, []);

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

  const handleUpload = async () => {
    if (!modelName.trim()) return toast.error("Model Name is required");
    if (!year.trim()) return toast.error("Year is required");
    if (!month.trim()) return toast.error("Month is required");
    if (!testFrequency.trim()) return toast.error("Test Frequency is required");
    if (!description.trim()) return toast.error("Description is required");
    if (!selectedFile) return toast.error("Please select a PDF file");

    const formData = new FormData();
    ["modelName", "year", "month", "testFrequency", "description"].forEach(
      (k) => formData.append(k, eval(k).trim()),
    );
    formData.append("file", selectedFile);

    try {
      setLoading(true);
      const res = await axios.post(
        `${baseURL}quality/upload-bis-pdf`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (res?.data?.success) {
        toast.success("BIS Report uploaded successfully");
        setModelName("");
        setYear("");
        setMonth("");
        setTestFrequency("");
        setDescription("");
        setSelectedFile(null);
        fetchUploadedFiles();
        setActiveTab("reports");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload BIS Report");
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
    const u = updateFields;
    if (!u.modelName?.trim()) return toast.error("Model Name is required");
    if (!u.year?.toString().trim()) return toast.error("Year is required");
    if (!u.month?.trim()) return toast.error("Month is required");
    if (!u.testFrequency?.trim())
      return toast.error("Test Frequency is required");
    if (!u.description?.trim()) return toast.error("Description is required");

    const formData = new FormData();
    ["modelName", "year", "month", "testFrequency", "description"].forEach(
      (k) => formData.append(k, u[k]?.toString().trim()),
    );
    if (u.selectedFile) formData.append("file", u.selectedFile);

    try {
      setLoading(true);
      const res = await axios.put(
        `${baseURL}quality/update-bis-file/${itemToUpdate.srNo}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (res?.data?.success) {
        toast.success(res.data.message || "BIS Report updated successfully");
        fetchUploadedFiles();
        setShowUpdateModal(false);
      }
    } catch (err) {
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
        { params: { filename: fileName } },
      );
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

  const TABS = [
    { key: "upload", label: "Upload Report", icon: CloudUpload },
    { key: "reports", label: "All Reports", icon: Table2 },
    { key: "analytics", label: "Analytics", icon: BarChart2 },
  ];

  const tooltipStyle = {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 12,
  };

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            BIS Report Manager
          </h1>
          <p className="text-[11px] text-slate-400">
            Upload, manage & analyse BIS test reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.totalFiles > 0 && (
            <>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-blue-700">
                  {stats.totalFiles}
                </span>
                <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
                  Total Reports
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-violet-700">
                  {stats.uniqueModels}
                </span>
                <span className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">
                  Models
                </span>
              </div>
            </>
          )}
          <button
            onClick={fetchUploadedFiles}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          {[
            {
              icon: FileText,
              label: "Total Reports",
              value: stats.totalFiles,
              cls: "bg-blue-50 border-blue-100",
              txt: "text-blue-700",
              sub: "text-blue-500",
            },
            {
              icon: Layers,
              label: "Unique Models",
              value: stats.uniqueModels,
              cls: "bg-violet-50 border-violet-100",
              txt: "text-violet-700",
              sub: "text-violet-500",
            },
            {
              icon: CheckCircle,
              label: "Monthly Reports",
              value: stats.freqCounts.Monthly || 0,
              cls: "bg-emerald-50 border-emerald-100",
              txt: "text-emerald-700",
              sub: "text-emerald-500",
            },
            {
              icon: Clock,
              label: "Quarterly Reports",
              value: stats.freqCounts.Quarterly || 0,
              cls: "bg-amber-50 border-amber-100",
              txt: "text-amber-700",
              sub: "text-amber-500",
            },
          ].map(({ icon: Icon, label, value, cls, txt, sub }) => (
            <div
              key={label}
              className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${cls}`}
            >
              <span className={`text-2xl font-bold font-mono ${txt}`}>
                {value}
              </span>
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${sub}`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── TAB BAR ── */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === key
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB: UPLOAD
        ══════════════════════════════════════════════════════ */}
        {activeTab === "upload" && (
          <div className="grid lg:grid-cols-2 xl:grid-cols-5 gap-4">
            {/* Form */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 xl:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Model Details
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <FieldLabel>Model Name *</FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. ABC123456"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Year *</FieldLabel>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select Year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Month *</FieldLabel>
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select Month</option>
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel>Test Frequency *</FieldLabel>
                  <div className="flex gap-2">
                    {["Monthly", "Quarterly", "Yearly"].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTestFrequency(f)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                          testFrequency === f
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-slate-200 text-slate-600 hover:border-blue-300 bg-slate-50"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel>Description *</FieldLabel>
                  <textarea
                    placeholder="Briefly describe this test report…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col xl:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <CloudUpload className="w-3.5 h-3.5 text-blue-500" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Upload PDF
                </p>
              </div>
              <label
                htmlFor="file-upload"
                className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all min-h-[200px] ${
                  selectedFile
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
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
                    <FileText className="w-10 h-10 text-red-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-blue-700 break-all">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <span className="mt-2 inline-block text-[11px] text-blue-600 underline">
                      Change file
                    </span>
                  </div>
                ) : (
                  <div className="text-center p-6">
                    <CloudUpload className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">
                      Click to select a PDF
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Max size: 10 MB
                    </p>
                  </div>
                )}
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="mt-2 text-[11px] text-red-500 hover:underline flex items-center gap-1 justify-center"
                >
                  <Trash2 className="w-3 h-3" /> Remove file
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={loading || !selectedFile}
                className={`mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  loading || !selectedFile
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                <Upload className="w-4 h-4" />
                {loading ? "Uploading…" : "Upload Report"}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: REPORTS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "reports" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search reports…"
                    value={searchParams.term}
                    onChange={(e) =>
                      setSearchParams((p) => ({ ...p, term: e.target.value }))
                    }
                    className="w-full h-9 pl-8 pr-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <select
                  value={searchParams.field}
                  onChange={(e) =>
                    setSearchParams((p) => ({ ...p, field: e.target.value }))
                  }
                  className="h-9 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
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
                <span className="text-[11px] text-slate-400">
                  {filteredFiles.length} of {uploadedFiles.length} records
                </span>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { mode: "card", Icon: LayoutGrid },
                    { mode: "table", Icon: Table2 },
                  ].map(({ mode, Icon }) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1.5 flex items-center ${viewMode === mode ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Empty */}
            {filteredFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <PackageOpen
                  className="w-10 h-10 opacity-20"
                  strokeWidth={1.2}
                />
                <p className="text-sm text-slate-500 font-medium">
                  {searchParams.term
                    ? `No files match "${searchParams.term}"`
                    : "No BIS Reports uploaded yet"}
                </p>
                {!searchParams.term && (
                  <p className="text-xs text-slate-400">
                    Use the Upload tab to add your first report
                  </p>
                )}
              </div>
            )}

            {/* Card view */}
            {viewMode === "card" && filteredFiles.length > 0 && (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
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

            {/* Table view */}
            {viewMode === "table" && filteredFiles.length > 0 && (
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "Sr No",
                        "Model Name",
                        "Year",
                        "Month",
                        "Frequency",
                        "Description",
                        "File",
                        "Uploaded",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-left"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => (
                      <tr
                        key={file.srNo}
                        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                      >
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 font-mono">
                          {file.srNo}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800 max-w-[160px] truncate">
                          {file.modelName}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600 font-mono">
                          {file.year}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600">
                          {file.month}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100">
                          <FreqBadge freq={file.testFrequency} />
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 max-w-[200px] truncate">
                          {file.description}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3 text-red-500" />
                            <span className="truncate max-w-[120px]">
                              {file.fileName}
                            </span>
                          </a>
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 whitespace-nowrap">
                          {file.uploadAt
                            ? new Date(file.uploadAt).toLocaleDateString(
                                "en-IN",
                              )
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdate(file)}
                              className="p-1.5 rounded text-blue-500 hover:bg-blue-50"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDownload(file)}
                              className="p-1.5 rounded text-emerald-500 hover:bg-emerald-50"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file)}
                              className="p-1.5 rounded text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
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

        {/* ══════════════════════════════════════════════════════
            TAB: ANALYTICS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "analytics" &&
          (uploadedFiles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <BarChart2 className="w-12 h-12 opacity-20" strokeWidth={1.2} />
              <p className="text-sm text-slate-500">
                No data available for analytics yet.
              </p>
              <p className="text-xs text-slate-400">
                Upload some BIS reports to see charts.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* By Year */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      Reports by Year
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={stats.byYear}
                      margin={{ top: 4, right: 12, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [v, "Reports"]}
                      />
                      <Bar
                        dataKey="count"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* By Frequency */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      Test Frequency
                    </span>
                  </div>
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
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {stats.byFreq.map((_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v, n) => [v, n]}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-400 text-center pt-16">
                      No frequency data
                    </p>
                  )}
                </div>

                {/* By Month */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:col-span-2 xl:col-span-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      Reports by Month
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={stats.byMonth}
                      margin={{ top: 4, right: 12, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [v, "Reports"]}
                      />
                      <Bar
                        dataKey="count"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Model Summary Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Model-wise Summary
                  </span>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        {[
                          "Model Name",
                          "Total Reports",
                          "Years Covered",
                          "Frequencies",
                          "Latest Upload",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-left"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        uploadedFiles.reduce((acc, f) => {
                          const key = f.modelName;
                          if (!acc[key])
                            acc[key] = {
                              count: 0,
                              years: new Set(),
                              freqs: new Set(),
                              latest: null,
                            };
                          acc[key].count++;
                          acc[key].years.add(f.year);
                          acc[key].freqs.add(f.testFrequency);
                          const d = f.uploadAt ? new Date(f.uploadAt) : null;
                          if (d && (!acc[key].latest || d > acc[key].latest))
                            acc[key].latest = d;
                          return acc;
                        }, {}),
                      ).map(([model, data]) => (
                        <tr
                          key={model}
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        >
                          <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800">
                            {model}
                          </td>
                          <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600 text-center">
                            {data.count}
                          </td>
                          <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 font-mono">
                            {[...data.years].sort().join(", ")}
                          </td>
                          <td className="px-3 py-2.5 border-b border-slate-100">
                            <div className="flex flex-wrap gap-1">
                              {[...data.freqs].map((f) => (
                                <FreqBadge key={f} freq={f} />
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400">
                            {data.latest
                              ? data.latest.toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* ── UPDATE MODAL ── */}
      {showUpdateModal && (
        <PopupModal
          title="Update BIS Report"
          description=""
          confirmText={loading ? "Updating…" : "Save Changes"}
          cancelText="Cancel"
          modalId="update-modal"
          onConfirm={confirmUpdate}
          onCancel={() => setShowUpdateModal(false)}
          icon={<Pencil className="w-8 h-8 text-blue-500 mx-auto" />}
          confirmButtonColor="bg-blue-600 hover:bg-blue-700"
          modalClassName="w-[95%] max-w-3xl"
        >
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-left">
            {/* File upload */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileUp className="w-3.5 h-3.5 text-blue-500" /> Replace PDF
                (optional)
              </p>
              <label
                htmlFor="update-file-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl min-h-[140px] cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-all"
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
                <CloudUpload className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">
                  {updateFields.selectedFile
                    ? updateFields.selectedFile.name
                    : "Click to upload new PDF"}
                </p>
              </label>
              {!updateFields.selectedFile && itemToUpdate?.fileName && (
                <div className="mt-3 p-2 bg-emerald-50 rounded-lg text-center">
                  <p className="text-[11px] text-emerald-700">
                    Current: {itemToUpdate.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Kept if no new file selected
                  </p>
                </div>
              )}
              {updateFields.selectedFile && (
                <button
                  type="button"
                  onClick={() =>
                    setUpdateFields((p) => ({ ...p, selectedFile: null }))
                  }
                  className="mt-2 text-[11px] text-red-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove new file
                </button>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <FieldLabel>Model Name</FieldLabel>
                  <input
                    type="text"
                    value={updateFields.modelName}
                    onChange={(e) =>
                      setUpdateFields((p) => ({
                        ...p,
                        modelName: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <FieldLabel>Sr No</FieldLabel>
                  <div className="h-9 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500">
                    {updateFields.srNo}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Year",
                    key: "year",
                    options: ["", ...YEARS].map((y) => ({
                      value: String(y),
                      label: y || "Select",
                    })),
                  },
                  {
                    label: "Month",
                    key: "month",
                    options: ["", ...MONTHS].map((m) => ({
                      value: m,
                      label: m || "Select",
                    })),
                  },
                  {
                    label: "Frequency",
                    key: "testFrequency",
                    options: [
                      { value: "", label: "Select" },
                      ...["Monthly", "Quarterly", "Yearly"].map((v) => ({
                        value: v,
                        label: v,
                      })),
                    ],
                  },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <FieldLabel>{label}</FieldLabel>
                    <select
                      value={updateFields[key]}
                      onChange={(e) =>
                        setUpdateFields((p) => ({
                          ...p,
                          [key]: e.target.value,
                        }))
                      }
                      className={inputCls}
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={updateFields.description}
                  onChange={(e) =>
                    setUpdateFields((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>
        </PopupModal>
      )}

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <PopupModal
          title="Delete Report"
          description={`Are you sure you want to delete "${itemToDelete?.modelName} – ${itemToDelete?.month} ${itemToDelete?.year}"? This action cannot be undone.`}
          confirmText={loading ? "Deleting…" : "Yes, Delete"}
          cancelText="Cancel"
          modalId="delete-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={<AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />}
          confirmButtonColor="bg-red-600 hover:bg-red-700"
        />
      )}
    </div>
  );
};

export default UploadBISReport;
