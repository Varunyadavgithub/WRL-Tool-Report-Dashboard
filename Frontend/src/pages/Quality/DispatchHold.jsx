import { useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { useSelector } from "react-redux";
import { getFormattedISTDate } from "../../utils/dateUtils";
import { baseURL } from "../../assets/assets";
import {
  Lock,
  Unlock,
  Plus,
  UploadCloud,
  Trash2,
  X,
  AlertTriangle,
  Wrench,
  ClipboardList,
  Loader2,
  AlertCircle,
  Inbox,
  Hash,
  Cpu,
  ScanBarcode,
  ChevronRight,
  PackageOpen,
  Shield,
  Table2,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MODE_CONFIG = {
  hold: {
    color: "amber",
    icon: Lock,
    label: "HOLD MODE",
    btnBg: "bg-amber-500 hover:bg-amber-600 shadow-amber-200",
    badgeBg: "bg-amber-50 border-amber-200 text-amber-700",
    dotColor: "bg-amber-400",
    inputLabel: "Defect Name",
    inputPlaceholder: "Describe the defect...",
    submitLabel: "Submit Hold",
  },
  release: {
    color: "emerald",
    icon: Unlock,
    label: "RELEASE MODE",
    btnBg: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200",
    badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
    dotColor: "bg-emerald-400",
    inputLabel: "Action Plan",
    inputPlaceholder: "Describe the corrective action...",
    submitLabel: "Submit Release",
  },
};

// ─── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, borderColor }) => (
  <div
    className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]"
    style={{ borderTopWidth: 3, borderTopColor: borderColor }}
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${borderColor}18`, color: borderColor }}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  </div>
);

// ─── Skipped Modal ─────────────────────────────────────────────────────────────

const SkippedModal = ({ skipped, mode, onClose }) => {
  if (!skipped || skipped.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {skipped.length} Serial{skipped.length > 1 ? "s" : ""} Skipped
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                These could not be {mode === "hold" ? "held" : "released"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-72 overflow-y-auto">
          <div className="space-y-2">
            {skipped.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-slate-800 truncate">
                    {item.fgNo}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {item.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <p className="text-[11px] text-slate-400">
            Successfully processed serials have been removed from the queue.
          </p>
          <button
            onClick={onClose}
            className="ml-4 px-5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 transition-all flex-shrink-0"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const DispatchHold = () => {
  const { user } = useSelector((store) => store.auth);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("hold");
  const [assemblySerial, setAssemblySerial] = useState("");
  const [fgData, setFgData] = useState([]);
  const [defectName, setDefectName] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [newRowIndex, setNewRowIndex] = useState(null);
  const [skippedModal, setSkippedModal] = useState(null);
  const fileInputRef = useRef(null);

  const isHold = status === "hold";
  const cfg = MODE_CONFIG[status];
  const ModeIcon = cfg.icon;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const isDuplicate = (serial) =>
    fgData.some(
      (item) => item.assemblySerial.toLowerCase() === serial.toLowerCase(),
    );

  const mergeRows = (incoming) => {
    const skipped = [];
    const fresh = [];
    for (const row of incoming) {
      if (isDuplicate(row.assemblySerial)) skipped.push(row.assemblySerial);
      else fresh.push(row);
    }
    if (skipped.length)
      toast.error(
        `Skipped ${skipped.length} duplicate(s): ${skipped.join(", ")}`,
      );
    return fresh;
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleAddFg = async () => {
    const serial = assemblySerial.trim();
    if (!serial) return toast.error("Enter a FG Serial Number");
    if (isDuplicate(serial))
      return toast.error(`"${serial}" is already in the list`);

    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/model-name`, {
        params: { AssemblySerial: serial },
      });
      const fetchedModelName = res?.data?.combinedserial;
      if (!fetchedModelName)
        return toast.error("Model not found for this serial");

      const newIndex = fgData.length;
      setFgData((prev) => [
        ...prev,
        { modelName: fetchedModelName, assemblySerial: serial },
      ]);
      setNewRowIndex(newIndex);
      setTimeout(() => setNewRowIndex(null), 800);
      setAssemblySerial("");
      toast.success("FG added");
    } catch {
      toast.error("Error fetching model name");
    } finally {
      setLoading(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      const incoming = [];
      worksheet.eachRow((row) => {
        const modelName = row.getCell(1).value?.toString().trim();
        const assemblySerial = row.getCell(2).value?.toString().trim();
        if (modelName && assemblySerial)
          incoming.push({ modelName, assemblySerial });
      });
      if (!incoming.length) return toast.error("No valid data found in file");
      const fresh = mergeRows(incoming);
      if (fresh.length) {
        setFgData((prev) => [...prev, ...fresh]);
        toast.success(`${fresh.length} serial(s) loaded`);
      }
    } catch {
      toast.error("Failed to read Excel file");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleHold = async () => {
    if (!defectName.trim()) return toast.error("Enter a Defect Name");
    if (!fgData.length) return toast.error("No FG serials queued");
    setLoading(true);
    try {
      const payload = fgData.map((item) => ({
        modelName: item.modelName,
        fgNo: item.assemblySerial,
        userName: user.usercode || "defaultUser",
        dispatchStatus: "hold",
        defect: defectName,
        formattedDate: getFormattedISTDate(),
      }));
      const res = await axios.post(`${baseURL}quality/hold`, payload);
      const { held = [], skipped = [] } = res.data;
      if (held.length)
        toast.success(`${held.length} serial(s) held successfully`);
      if (skipped.length) setSkippedModal({ skipped, mode: "hold" });
      setFgData((prev) =>
        prev.filter((item) => !held.includes(item.assemblySerial)),
      );
      if (!skipped.length) setDefectName("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Hold request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!actionPlan.trim()) return toast.error("Enter an Action Plan");
    if (!fgData.length) return toast.error("No FG serials queued");
    setLoading(true);
    try {
      const payload = fgData.map((item) => ({
        fgNo: item.assemblySerial,
        releaseUserCode: user.usercode || "defaultUser",
        dispatchStatus: "release",
        action: actionPlan,
        formattedDate: getFormattedISTDate(),
      }));
      const res = await axios.post(`${baseURL}quality/release`, payload);
      const { released = [], skipped = [] } = res.data;
      if (released.length)
        toast.success(`${released.length} serial(s) released`);
      if (skipped.length) setSkippedModal({ skipped, mode: "release" });
      setFgData((prev) =>
        prev.filter((item) => !released.includes(item.assemblySerial)),
      );
      if (!skipped.length) setActionPlan("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Release request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRow = (index) =>
    setFgData((prev) => prev.filter((_, i) => i !== index));

  const handleClear = () => {
    setAssemblySerial("");
    setFgData([]);
    setDefectName("");
    setActionPlan("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Skipped Modal */}
      {skippedModal && (
        <SkippedModal
          skipped={skippedModal.skipped}
          mode={skippedModal.mode}
          onClose={() => setSkippedModal(null)}
        />
      )}

      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight flex items-center gap-2">
            Dispatch Hold
          </h1>
          <p className="text-[11px] text-slate-400">
            Quality · Dispatch Control
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Badge */}
          <span
            className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${cfg.badgeBg}`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${cfg.dotColor}`}
            />
            {cfg.label}
          </span>

          {/* Queue Count */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {fgData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Queued
            </span>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── STATUS TOGGLE ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Shield className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Mode Selection
            </p>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-slate-50 border border-slate-200">
            <button
              onClick={() => setStatus("hold")}
              className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${
                isHold
                  ? "bg-amber-500 text-white shadow-sm shadow-amber-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Hold
            </button>
            <button
              onClick={() => setStatus("release")}
              className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${
                !isHold
                  ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Unlock className="w-3.5 h-3.5" /> Release
            </button>
          </div>
        </div>

        {/* ── INPUT GRID ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 shrink-0">
          {/* Manual Input Panel */}
          <div className="xl:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <ClipboardList className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Add Serial Manually
              </p>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="FG Serial Number..."
                  value={assemblySerial}
                  onChange={(e) => setAssemblySerial(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !loading && handleAddFg()
                  }
                  disabled={loading}
                  className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleAddFg}
                disabled={loading || !assemblySerial.trim()}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  loading || !assemblySerial.trim()
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-slate-900 hover:bg-slate-700 text-white shadow-sm"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Add
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                {isHold ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    {cfg.inputLabel}
                  </>
                ) : (
                  <>
                    <Wrench className="w-3 h-3 text-emerald-500" />
                    {cfg.inputLabel}
                  </>
                )}
              </label>
              <input
                type="text"
                placeholder={cfg.inputPlaceholder}
                value={isHold ? defectName : actionPlan}
                onChange={(e) =>
                  isHold
                    ? setDefectName(e.target.value)
                    : setActionPlan(e.target.value)
                }
                disabled={loading}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* File Upload Panel */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
            <div className="flex items-center gap-1.5 mb-3">
              <UploadCloud className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Bulk Upload
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) processFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 min-h-[110px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-200 gap-2 ${
                dragOver
                  ? "border-blue-400 bg-blue-50 scale-[1.01]"
                  : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) processFile(f);
                }}
              />
              <Inbox
                className={`w-7 h-7 transition-colors ${dragOver ? "text-blue-400" : "text-slate-300"}`}
              />
              <p className="text-xs text-slate-500 font-medium">
                {dragOver ? "Drop to upload" : "Drop .xlsx or click to browse"}
              </p>
            </div>

            <p className="text-[10px] text-slate-400 mt-3 text-center flex items-center justify-center gap-1">
              <Cpu className="w-2.5 h-2.5" /> Col A = Model · Col B = Serial
            </p>
          </div>
        </div>

        {/* ── ACTION BAR ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-bold text-base">
                {fgData.length}
              </span>{" "}
              serial{fgData.length !== 1 ? "s" : ""} queued
            </span>
            {fgData.length > 0 && (
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 rounded-lg transition-all"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          <button
            onClick={isHold ? handleHold : handleRelease}
            disabled={loading || fgData.length === 0}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm ${cfg.btnBg}`}
          >
            {loading ? (
              <>
                <Spinner cls="w-4 h-4" /> Processing...
              </>
            ) : (
              <>
                <ModeIcon className="w-4 h-4" /> {cfg.submitLabel}
              </>
            )}
          </button>
        </div>

        {/* ── QUEUED SERIALS TABLE — flex-1 fills remaining ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[350px]">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
            <Table2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Queued Serials
            </span>
            {fgData.length > 0 && (
              <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                {fgData.length} items
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {fgData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                  <PackageOpen
                    className="w-6 h-6 text-blue-400"
                    strokeWidth={1.2}
                  />
                </div>
                <h3 className="text-sm font-semibold text-slate-600">
                  No serials queued yet
                </h3>
                <p className="text-xs text-slate-400 max-w-sm text-center">
                  Add manually or upload an Excel file to get started.
                </p>
              </div>
            ) : (
              <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    <th className="px-4 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap w-12">
                      <Hash className="w-3 h-3 mx-auto text-slate-400" />
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Cpu className="w-3 h-3 text-slate-400" /> Model Name
                      </span>
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <ScanBarcode className="w-3 h-3 text-slate-400" /> FG
                        Serial No
                      </span>
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap w-16">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fgData.map((item, index) => (
                    <tr
                      key={item.assemblySerial}
                      className={`transition-all duration-500 ${
                        newRowIndex === index
                          ? isHold
                            ? "bg-amber-50"
                            : "bg-emerald-50"
                          : "hover:bg-blue-50/60 even:bg-slate-50/40"
                      }`}
                    >
                      <td className="px-4 py-2.5 border-b border-slate-100 text-center font-bold text-blue-600">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2.5 border-b border-slate-100 font-bold text-slate-800">
                        {item.modelName}
                      </td>
                      <td className="px-4 py-2.5 border-b border-slate-100">
                        <span
                          className={`inline-flex items-center font-mono text-[11px] px-2.5 py-1 rounded-md tracking-wide border font-semibold ${
                            isHold
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {item.assemblySerial}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-slate-100 text-center">
                        <button
                          onClick={() => handleRemoveRow(index)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold hover:bg-rose-100 transition-colors mx-auto"
                          title="Remove"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchHold;
