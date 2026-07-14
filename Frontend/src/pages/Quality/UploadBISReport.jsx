import { useEffect, useState, useMemo, useRef } from "react";
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
  FileSearch,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  Zap,
  Tag,
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
  ReferenceLine,
  LabelList,
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

// Categorical (identity) — Declared vs Measured are two distinct series, not
// a good/bad pair, so they take fixed categorical slots, not status colors.
const ENERGY_SERIES_COLORS = { declared: "#6366f1", measured: "#8b5cf6" };

// Status (state) — reserved meaning, always paired with a label. PASS/FAIL
// and the deviation-vs-threshold check both encode good/bad, so both wear
// these same two tokens rather than a generic categorical color.
const STATUS_COLORS = { good: "#10b981", critical: "#ef4444" };

// The BIS pass rule printed on the report itself: declared must not exceed
// measured by more than this — used to color the deviation chart.
const DEVIATION_THRESHOLD_PCT = 10;

// Cosmetic-only step list shown while the upload request is in flight —
// extraction genuinely happens server-side in that one request/response
// (OCR for scanned PDFs can take several seconds), but the client has no
// real progress signal mid-request, so these advance on a fixed timer and
// hold at the last step until the response actually comes back.
const SCAN_STEPS = [
  "Uploading PDF…",
  "Scanning document pages…",
  "Locating Energy Consumption Test section…",
  "Reading declared annual energy…",
  "Reading measured annual energy…",
  "Calculating deviation…",
  "Determining pass/fail result…",
];
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

// ── Energy Result ──────────────────────────────────────────────────────────────
// Declared vs measured annual energy consumption + PASS/FAIL, auto-extracted
// from the uploaded PDF at upload time. Any of these can be null when the
// PDF layout didn't match the expected report format — render "—" then.
const EnergyResult = ({ file, compact }) => {
  const hasEnergy = file.declaredAnnualEnergy != null && file.measuredAnnualEnergy != null;
  const hasResult = !!file.testResult;
  if (!hasEnergy && !hasResult) return compact ? <span className="text-slate-300">—</span> : null;

  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-center justify-between gap-2 text-[10px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5"}>
      <span className="text-slate-500 font-mono">
        {hasEnergy ? `${file.declaredAnnualEnergy} → ${file.measuredAnnualEnergy} kWh` : "—"}
        {file.energyDeviationPercent != null && (
          <span className={file.energyDeviationPercent <= 0 ? "text-emerald-600" : "text-amber-600"}>
            {" "}
            ({file.energyDeviationPercent > 0 ? "+" : ""}
            {file.energyDeviationPercent}%)
          </span>
        )}
      </span>
      {hasResult && (
        <span
          className={`shrink-0 font-bold px-1.5 py-0.5 rounded-full text-[9px] ${
            file.testResult === "PASS"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {file.testResult}
        </span>
      )}
    </div>
  );
};

// ── Multi-select Dropdown ──────────────────────────────────────────────────────
// Generic checklist dropdown — used for both the Model and Year energy filters.
const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder = "All" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
  const clearAll = () => onChange([]);
  const allSelected = selected.length === options.length && options.length > 0;

  return (
    <div className="relative min-w-[170px]" ref={ref}>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-white text-xs font-semibold text-slate-700 hover:border-blue-300 transition-all ${
          selected.length > 0 ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected.length > 0 && <Tag className="w-3 h-3 text-blue-500 shrink-0" />}
          <span className="truncate">
            {selected.length === 0
              ? placeholder
              : selected.length === 1
                ? selected[0]
                : `${selected.length} selected`}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <button
              type="button"
              onClick={() => (allSelected ? clearAll() : onChange([...options]))}
              className="text-[10px] font-semibold text-blue-600 hover:underline"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            {selected.length > 0 && (
              <span className="text-[10px] text-slate-400">{selected.length} selected</span>
            )}
          </div>
          <div className="py-1 max-h-52 overflow-auto">
            {options.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 text-center">No options</p>
            ) : (
              options.map((opt) => {
                const active = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                      active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        active ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"
                      }`}
                    >
                      {active && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    {opt}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Scanning Modal ─────────────────────────────────────────────────────────────
// Shown while the upload (file save + PDF extraction) request is in flight.
const ScanningModal = ({ step }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex flex-col items-center text-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
          <FileSearch className="w-7 h-7 text-blue-600 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Reading your BIS report…</h3>
        <p className="text-[11px] text-slate-400 mt-1">
          Scanned PDFs can take a few extra seconds
        </p>
      </div>
      <div className="space-y-2.5">
        {SCAN_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={label}
              className={`flex items-center gap-2.5 text-xs transition-opacity ${i > step ? "opacity-35" : "opacity-100"}`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : active ? (
                <span className="w-4 h-4 shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              ) : (
                <span className="w-4 h-4 shrink-0 rounded-full border-2 border-slate-200" />
              )}
              <span className={done ? "text-slate-400" : active ? "text-slate-800 font-semibold" : "text-slate-400"}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ── Field Label ────────────────────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
    {children}
  </label>
);

// ── Input styles ───────────────────────────────────────────────────────────────
const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";

// ── Confirm Energy Modal ──────────────────────────────────────────────────────
// Lets the user review what was auto-extracted from the PDF (OCR on scanned
// reports isn't perfect) and fix any field before it's treated as final.
const ConfirmEnergyModal = ({ data, onChange, onConfirm, onCancel, saving }) => {
  const allBlank =
    data.declaredAnnualEnergy === "" &&
    data.measuredAnnualEnergy === "" &&
    data.energyDeviationPercent === "" &&
    !data.testResult;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center gap-2.5">
          <Sparkles className="w-4 h-4" />
          <div>
            <h3 className="text-sm font-black">Confirm Extracted Values</h3>
            <p className="text-[11px] text-blue-100 mt-0.5">
              Review what we read from the PDF — edit anything that's wrong.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {allBlank && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Nothing could be read automatically from this PDF. You can fill the values in
              manually below, or leave them blank.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Declared Annual Energy (kWh)</FieldLabel>
              <input
                type="number"
                step="any"
                value={data.declaredAnnualEnergy}
                onChange={(e) => onChange({ ...data, declaredAnnualEnergy: e.target.value })}
                className={inputCls}
                placeholder="e.g. 1066"
              />
            </div>
            <div>
              <FieldLabel>Measured Annual Energy (kWh)</FieldLabel>
              <input
                type="number"
                step="any"
                value={data.measuredAnnualEnergy}
                onChange={(e) => onChange({ ...data, measuredAnnualEnergy: e.target.value })}
                className={inputCls}
                placeholder="e.g. 1061.519"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Deviation (%)</FieldLabel>
              <input
                type="number"
                step="any"
                value={data.energyDeviationPercent}
                onChange={(e) => onChange({ ...data, energyDeviationPercent: e.target.value })}
                className={inputCls}
                placeholder="e.g. -0.42"
              />
            </div>
            <div>
              <FieldLabel>Result</FieldLabel>
              <div className="flex gap-2">
                {["PASS", "FAIL"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onChange({ ...data, testResult: r })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      data.testResult === r
                        ? r === "PASS"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-red-600 text-white border-red-600"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 bg-slate-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-all"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? "Saving…" : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── File Card ──────────────────────────────────────────────────────────────────
const FileCard = ({ file, onEdit, onDownload, onDelete, onFetchData }) => (
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
          onClick={() => onFetchData(file)}
          title="Fetch data from PDF"
          className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 transition-colors"
        >
          <FileSearch className="w-3 h-3" />
        </button>
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
      <EnergyResult file={file} />
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

  // ── Post-upload: scanning animation + extracted-value confirmation ────────
  const [showScanningModal, setShowScanningModal] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [confirmData, setConfirmData] = useState(null); // { srNo, declaredAnnualEnergy, measuredAnnualEnergy, energyDeviationPercent, testResult } | null
  const [confirmSaving, setConfirmSaving] = useState(false);

  useEffect(() => {
    if (!showScanningModal) {
      setScanStep(0);
      return;
    }
    const timer = setInterval(() => {
      setScanStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1));
    }, 900);
    return () => clearInterval(timer);
  }, [showScanningModal]);

  // ── Energy Analysis tab filters ────────────────────────────────────────────
  const [energyModelFilter, setEnergyModelFilter] = useState([]); // [] = all models
  const [energyYearFilter, setEnergyYearFilter] = useState([]); // [] = all years

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

  // ── Energy Analysis: filter options + filtered set ─────────────────────────
  const energyModelOptions = useMemo(
    () => [...new Set(uploadedFiles.map((f) => f.modelName).filter(Boolean))].sort(),
    [uploadedFiles],
  );
  const energyYearOptions = useMemo(
    () => [...new Set(uploadedFiles.map((f) => String(f.year)).filter(Boolean))].sort(),
    [uploadedFiles],
  );

  const energyFilteredFiles = useMemo(() => {
    return uploadedFiles.filter((f) => {
      const matchModel = energyModelFilter.length === 0 || energyModelFilter.includes(f.modelName);
      const matchYear = energyYearFilter.length === 0 || energyYearFilter.includes(String(f.year));
      return matchModel && matchYear;
    });
  }, [uploadedFiles, energyModelFilter, energyYearFilter]);

  // Cap chart bars so long filter-free lists stay readable — filters narrow it down.
  const CHART_ROW_CAP = 20;

  const energyAnalysis = useMemo(() => {
    const withEnergy = energyFilteredFiles.filter(
      (f) => f.declaredAnnualEnergy != null && f.measuredAnnualEnergy != null,
    );
    const withDeviation = energyFilteredFiles.filter((f) => f.energyDeviationPercent != null);
    const withResult = energyFilteredFiles.filter((f) => f.testResult);

    const modelYearData = [...withEnergy]
      .sort((a, b) => (b.declaredAnnualEnergy || 0) - (a.declaredAnnualEnergy || 0))
      .slice(0, CHART_ROW_CAP)
      .map((f) => ({
        label: `${f.modelName} (${f.year})`,
        declared: f.declaredAnnualEnergy,
        measured: f.measuredAnnualEnergy,
      }));

    const deviationData = [...withDeviation]
      .sort((a, b) => Math.abs(b.energyDeviationPercent) - Math.abs(a.energyDeviationPercent))
      .slice(0, CHART_ROW_CAP)
      .map((f) => ({
        label: `${f.modelName} (${f.year})`,
        deviation: f.energyDeviationPercent,
        breach: Math.abs(f.energyDeviationPercent) > DEVIATION_THRESHOLD_PCT,
      }));

    const yearMap = {};
    withResult.forEach((f) => {
      const y = String(f.year);
      if (!yearMap[y]) yearMap[y] = { year: y, PASS: 0, FAIL: 0 };
      if (f.testResult === "PASS") yearMap[y].PASS++;
      else yearMap[y].FAIL++;
    });
    const yearPassFailData = Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year));

    const modelMap = {};
    withResult.forEach((f) => {
      if (!modelMap[f.modelName]) modelMap[f.modelName] = { model: f.modelName, pass: 0, total: 0 };
      modelMap[f.modelName].total++;
      if (f.testResult === "PASS") modelMap[f.modelName].pass++;
    });
    const modelPassRateData = Object.values(modelMap)
      .map((m) => ({ ...m, passRate: Math.round((m.pass / m.total) * 100) }))
      .sort((a, b) => b.passRate - a.passRate || b.total - a.total)
      .slice(0, CHART_ROW_CAP);

    const passCount = withResult.filter((f) => f.testResult === "PASS").length;
    const failCount = withResult.length - passCount;
    const avgDeviation = withDeviation.length
      ? withDeviation.reduce((sum, f) => sum + f.energyDeviationPercent, 0) / withDeviation.length
      : null;

    return {
      totalFiltered: energyFilteredFiles.length,
      withEnergyCount: withEnergy.length,
      missingCount: energyFilteredFiles.length - withEnergy.length,
      passCount,
      failCount,
      passRate: withResult.length ? Math.round((passCount / withResult.length) * 100) : null,
      avgDeviation,
      modelYearData,
      deviationData,
      yearPassFailData,
      modelPassRateData,
      truncatedModelYear: withEnergy.length > CHART_ROW_CAP,
      truncatedDeviation: withDeviation.length > CHART_ROW_CAP,
    };
  }, [energyFilteredFiles]);

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
      setShowScanningModal(true);
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

        const energyData = res.data.energyData || {};
        setConfirmData({
          srNo: res.data.srNo,
          declaredAnnualEnergy: energyData.declaredAnnualEnergy ?? "",
          measuredAnnualEnergy: energyData.measuredAnnualEnergy ?? "",
          energyDeviationPercent: energyData.energyDeviationPercent ?? "",
          testResult: energyData.testResult || "",
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload BIS Report");
    } finally {
      setLoading(false);
      setShowScanningModal(false);
    }
  };

  const handleConfirmEnergyData = async () => {
    if (!confirmData?.srNo) return;
    try {
      setConfirmSaving(true);
      await axios.put(`${baseURL}quality/bis-energy-data/${confirmData.srNo}`, {
        declaredAnnualEnergy: confirmData.declaredAnnualEnergy,
        measuredAnnualEnergy: confirmData.measuredAnnualEnergy,
        energyDeviationPercent: confirmData.energyDeviationPercent,
        testResult: confirmData.testResult,
      });
      toast.success("Energy data confirmed");
      setConfirmData(null);
      fetchUploadedFiles();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save energy data");
    } finally {
      setConfirmSaving(false);
    }
  };

  // Re-runs extraction against a PDF that's already on the server (records
  // uploaded before this feature existed, or where it found nothing the
  // first time) — same scanning animation + confirm dialog as a fresh upload.
  const handleFetchEnergyData = async (file) => {
    try {
      setShowScanningModal(true);
      const res = await axios.post(`${baseURL}quality/bis-fetch-energy-data/${file.srNo}`);
      if (res?.data?.success) {
        const energyData = res.data.energyData || {};
        setConfirmData({
          srNo: file.srNo,
          declaredAnnualEnergy: energyData.declaredAnnualEnergy ?? "",
          measuredAnnualEnergy: energyData.measuredAnnualEnergy ?? "",
          energyDeviationPercent: energyData.energyDeviationPercent ?? "",
          testResult: energyData.testResult || "",
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to fetch data from PDF");
    } finally {
      setShowScanningModal(false);
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
    { key: "energy", label: "Energy Analysis", icon: Zap },
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
                    className="w-full h-9 pl-8 pr-3 text-xs text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <select
                  value={searchParams.field}
                  onChange={(e) =>
                    setSearchParams((p) => ({ ...p, field: e.target.value }))
                  }
                  className="h-9 px-2 text-xs text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white transition-all"
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
                    onFetchData={handleFetchEnergyData}
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
                        "Energy (Declared → Measured)",
                        "Result",
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
                        <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                          {file.declaredAnnualEnergy != null && file.measuredAnnualEnergy != null ? (
                            <>
                              {file.declaredAnnualEnergy} → {file.measuredAnnualEnergy} kWh
                              {file.energyDeviationPercent != null && (
                                <span className={file.energyDeviationPercent <= 0 ? "text-emerald-600" : "text-amber-600"}>
                                  {" "}
                                  ({file.energyDeviationPercent > 0 ? "+" : ""}
                                  {file.energyDeviationPercent}%)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 border-b border-slate-100">
                          {file.testResult ? (
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                                file.testResult === "PASS"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {file.testResult}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
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
                              onClick={() => handleFetchEnergyData(file)}
                              title="Fetch data from PDF"
                              className="p-1.5 rounded text-violet-500 hover:bg-violet-50"
                            >
                              <FileSearch className="w-3 h-3" />
                            </button>
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
            TAB: ENERGY ANALYSIS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "energy" &&
          (uploadedFiles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Zap className="w-12 h-12 opacity-20" strokeWidth={1.2} />
              <p className="text-sm text-slate-500">
                No data available for energy analysis yet.
              </p>
              <p className="text-xs text-slate-400">
                Upload some BIS reports to see charts.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Filters */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
                <MultiSelectDropdown
                  label="Model"
                  options={energyModelOptions}
                  selected={energyModelFilter}
                  onChange={setEnergyModelFilter}
                  placeholder="All models"
                />
                <MultiSelectDropdown
                  label="Year"
                  options={energyYearOptions}
                  selected={energyYearFilter}
                  onChange={setEnergyYearFilter}
                  placeholder="All years"
                />
                {(energyModelFilter.length > 0 || energyYearFilter.length > 0) && (
                  <button
                    onClick={() => {
                      setEnergyModelFilter([]);
                      setEnergyYearFilter([]);
                    }}
                    className="h-9 text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Clear filters
                  </button>
                )}
                <span className="ml-auto h-9 flex items-center text-[11px] text-slate-400">
                  {energyAnalysis.totalFiltered} record
                  {energyAnalysis.totalFiltered !== 1 ? "s" : ""} matched
                </span>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    icon: Zap,
                    label: "With Energy Data",
                    value: energyAnalysis.withEnergyCount,
                    cls: "bg-indigo-50 border-indigo-100",
                    txt: "text-indigo-700",
                    sub: "text-indigo-500",
                  },
                  {
                    icon: AlertTriangle,
                    label: "Missing Data",
                    value: energyAnalysis.missingCount,
                    cls: "bg-amber-50 border-amber-100",
                    txt: "text-amber-700",
                    sub: "text-amber-500",
                  },
                  {
                    icon: CheckCircle,
                    label: "Pass Rate",
                    value: energyAnalysis.passRate != null ? `${energyAnalysis.passRate}%` : "—",
                    cls: "bg-emerald-50 border-emerald-100",
                    txt: "text-emerald-700",
                    sub: "text-emerald-500",
                  },
                  {
                    icon: BarChart2,
                    label: "Avg. Deviation",
                    value:
                      energyAnalysis.avgDeviation != null
                        ? `${energyAnalysis.avgDeviation > 0 ? "+" : ""}${energyAnalysis.avgDeviation.toFixed(2)}%`
                        : "—",
                    cls: "bg-violet-50 border-violet-100",
                    txt: "text-violet-700",
                    sub: "text-violet-500",
                  },
                ].map(({ icon: Icon, label, value, cls, txt, sub }) => (
                  <div
                    key={label}
                    className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${cls}`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${txt}`} />
                    <span className={`text-2xl font-bold font-mono ${txt}`}>{value}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wide ${sub}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {energyAnalysis.withEnergyCount === 0 && energyAnalysis.passCount + energyAnalysis.failCount === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <FileSearch className="w-10 h-10 opacity-20" />
                  <p className="text-sm text-slate-500">
                    No records with extracted energy data match these filters.
                  </p>
                  <p className="text-xs text-slate-400">
                    Use "Fetch Data" on a report in All Reports to extract it.
                  </p>
                </div>
              ) : (
                <>
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                          Declared vs Measured Annual Energy
                        </span>
                      </div>
                      {energyAnalysis.modelYearData.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-16">No matching records</p>
                      ) : (
                        <>
                          <ResponsiveContainer
                            width="100%"
                            height={Math.max(200, energyAnalysis.modelYearData.length * 32)}
                          >
                            <BarChart
                              data={energyAnalysis.modelYearData}
                              layout="vertical"
                              margin={{ left: 8, right: 16 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 10 }} unit=" kWh" />
                              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={150} />
                              <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={(v, name) => [`${v} kWh`, name === "declared" ? "Declared" : "Measured"]}
                              />
                              <Legend
                                iconType="circle"
                                iconSize={8}
                                formatter={(v) => (
                                  <span className="text-xs font-semibold text-slate-600">
                                    {v === "declared" ? "Declared" : "Measured"}
                                  </span>
                                )}
                              />
                              <Bar dataKey="declared" fill={ENERGY_SERIES_COLORS.declared} radius={[0, 4, 4, 0]} />
                              <Bar dataKey="measured" fill={ENERGY_SERIES_COLORS.measured} radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                          {energyAnalysis.truncatedModelYear && (
                            <p className="text-[10px] text-slate-400 text-center mt-1">
                              Showing top {CHART_ROW_CAP} by declared value — refine filters to see more
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                          Pass / Fail by Year
                        </span>
                      </div>
                      {energyAnalysis.yearPassFailData.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-16">No matching records</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={energyAnalysis.yearPassFailData} barCategoryGap="30%">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend
                              iconType="circle"
                              iconSize={8}
                              formatter={(v) => (
                                <span className="text-xs font-semibold text-slate-600">{v}</span>
                              )}
                            />
                            <Bar dataKey="PASS" fill={STATUS_COLORS.good} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="FAIL" fill={STATUS_COLORS.critical} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                          Declared vs Measured Deviation
                        </span>
                      </div>
                      {energyAnalysis.deviationData.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-16">No matching records</p>
                      ) : (
                        <>
                          <ResponsiveContainer
                            width="100%"
                            height={Math.max(200, energyAnalysis.deviationData.length * 32)}
                          >
                            <BarChart
                              data={energyAnalysis.deviationData}
                              layout="vertical"
                              margin={{ left: 8, right: 24 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={150} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Deviation"]} />
                              <ReferenceLine x={0} stroke="#c3c2b7" />
                              <ReferenceLine
                                x={DEVIATION_THRESHOLD_PCT}
                                stroke={STATUS_COLORS.critical}
                                strokeDasharray="4 4"
                                label={{
                                  value: `${DEVIATION_THRESHOLD_PCT}% limit`,
                                  fontSize: 9,
                                  fill: STATUS_COLORS.critical,
                                  position: "insideTopRight",
                                }}
                              />
                              <Bar dataKey="deviation" radius={[0, 4, 4, 0]}>
                                {energyAnalysis.deviationData.map((d, i) => (
                                  <Cell key={i} fill={d.breach ? STATUS_COLORS.critical : STATUS_COLORS.good} />
                                ))}
                                <LabelList
                                  dataKey="deviation"
                                  position="right"
                                  formatter={(v) => `${v}%`}
                                  style={{ fontSize: 9, fill: "#52514e" }}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          {energyAnalysis.truncatedDeviation && (
                            <p className="text-[10px] text-slate-400 text-center mt-1">
                              Showing top {CHART_ROW_CAP} by |deviation| — refine filters to see more
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                          Pass Rate by Model
                        </span>
                      </div>
                      {energyAnalysis.modelPassRateData.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-16">No matching records</p>
                      ) : (
                        <ResponsiveContainer
                          width="100%"
                          height={Math.max(200, energyAnalysis.modelPassRateData.length * 32)}
                        >
                          <BarChart
                            data={energyAnalysis.modelPassRateData}
                            layout="vertical"
                            margin={{ left: 8, right: 24 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                            <YAxis type="category" dataKey="model" tick={{ fontSize: 10 }} width={150} />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(v, _n, entry) => [
                                `${v}% (${entry.payload.pass}/${entry.payload.total})`,
                                "Pass rate",
                              ]}
                            />
                            <Bar dataKey="passRate" fill={ENERGY_SERIES_COLORS.declared} radius={[0, 4, 4, 0]}>
                              <LabelList
                                dataKey="passRate"
                                position="right"
                                formatter={(v) => `${v}%`}
                                style={{ fontSize: 9, fill: "#52514e" }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

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

      {/* ── SCANNING MODAL (shown while the upload/extraction request is in flight) ── */}
      {showScanningModal && <ScanningModal step={scanStep} />}

      {/* ── CONFIRM EXTRACTED ENERGY DATA ── */}
      {confirmData && (
        <ConfirmEnergyModal
          data={confirmData}
          onChange={setConfirmData}
          onConfirm={handleConfirmEnergyData}
          onCancel={() => setConfirmData(null)}
          saving={confirmSaving}
        />
      )}
    </div>
  );
};

export default UploadBISReport;
