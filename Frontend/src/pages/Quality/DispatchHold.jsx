import axios from "axios";
import { useState, useRef } from "react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { useSelector } from "react-redux";
import { getFormattedISTDate } from "../../utils/dateUtils";
import { baseURL } from "../../assets/assets";

import {
  FiLock,
  FiUnlock,
  FiPlus,
  FiUploadCloud,
  FiTrash2,
  FiX,
  FiAlertTriangle,
  FiTool,
  FiClipboard,
  FiLoader,
  FiAlertCircle,
  FiCheckCircle,
  FiInbox,
  FiHash,
  FiCpu,
} from "react-icons/fi";   // ✅ correct

import { FaBarcode } from "react-icons/fa";

// ── Skipped Modal ────────────────────────────────────────────────────────────
const SkippedModal = ({ skipped, mode, onClose }) => {
  if (!skipped || skipped.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <FiAlertCircle className="text-orange-500" size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {skipped.length} Serial{skipped.length > 1 ? "s" : ""} Skipped
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                These could not be {mode === "hold" ? "held" : "released"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <FiX size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          <div className="space-y-2">
            {skipped.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
              >
                <div className="w-6 h-6 rounded-md bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiAlertTriangle className="text-orange-500" size={12} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-gray-800 truncate">
                    {item.fgNo}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
          <p className="text-xs text-gray-400">
            Successfully processed serials have been removed from the queue.
          </p>
          <button
            onClick={onClose}
            className="ml-4 px-5 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-all flex-shrink-0"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
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
  const [skippedModal, setSkippedModal] = useState(null); // { skipped[], mode }
  const fileInputRef = useRef(null);

  const isHold = status === "hold";

  // ── helpers ────────────────────────────────────────────────────────────────
  const isDuplicate = (serial) =>
    fgData.some((item) => item.assemblySerial.toLowerCase() === serial.toLowerCase());

  const mergeRows = (incoming) => {
    const skipped = [];
    const fresh = [];
    for (const row of incoming) {
      if (isDuplicate(row.assemblySerial)) skipped.push(row.assemblySerial);
      else fresh.push(row);
    }
    if (skipped.length)
      toast.error(`Skipped ${skipped.length} duplicate(s): ${skipped.join(", ")}`);
    return fresh;
  };

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleAddFg = async () => {
    const serial = assemblySerial.trim();
    if (!serial) return toast.error("Enter a FG Serial Number");
    if (isDuplicate(serial)) return toast.error(`"${serial}" is already in the list`);

    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/model-name`, {
        params: { AssemblySerial: serial },
      });
      const fetchedModelName = res?.data?.combinedserial;
      if (!fetchedModelName) return toast.error("Model not found for this serial");

      const newIndex = fgData.length;
      setFgData((prev) => [...prev, { modelName: fetchedModelName, assemblySerial: serial }]);
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
        if (modelName && assemblySerial) incoming.push({ modelName, assemblySerial });
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
      if (held.length) toast.success(`${held.length} serial(s) held successfully`);
      if (skipped.length) setSkippedModal({ skipped, mode: "hold" });
      setFgData((prev) => prev.filter((item) => !held.includes(item.assemblySerial)));
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
      if (released.length) toast.success(`${released.length} serial(s) released`);
      if (skipped.length) setSkippedModal({ skipped, mode: "release" });
      setFgData((prev) => prev.filter((item) => !released.includes(item.assemblySerial)));
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

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-gray-50 text-gray-800 p-5"
      style={{ fontFamily: "'DM Mono', 'Courier New', monospace" }}
    >
      {/* Skipped Modal */}
      {skippedModal && (
        <SkippedModal
          skipped={skippedModal.skipped}
          mode={skippedModal.mode}
          onClose={() => setSkippedModal(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs tracking-[0.3em] text-gray-400 uppercase mb-1">
            Quality · Dispatch Control
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            {isHold
              ? <FiLock className="text-amber-500" size={22} />
              : <FiUnlock className="text-emerald-500" size={22} />
            }
            Dispatch Hold
          </h1>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isHold ? "bg-amber-400" : "bg-emerald-400"}`} />
            <span className={`text-xs font-semibold ${isHold ? "text-amber-500" : "text-emerald-500"}`}>
              {isHold ? "HOLD MODE" : "RELEASE MODE"}
            </span>
          </div>
          <p className="text-xs text-gray-400">{fgData.length} serial(s) queued</p>
        </div>
      </div>

      {/* ── Status Toggle ── */}
      <div className="mb-5 inline-flex p-1 rounded-xl bg-white border border-gray-200 shadow-sm">
        <button
          onClick={() => setStatus("hold")}
          className={`px-6 py-2 rounded-lg text-sm font-bold tracking-wide uppercase transition-all duration-200 flex items-center gap-2 ${
            isHold
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <FiLock size={14} /> Hold
        </button>
        <button
          onClick={() => setStatus("release")}
          className={`px-6 py-2 rounded-lg text-sm font-bold tracking-wide uppercase transition-all duration-200 flex items-center gap-2 ${
            !isHold
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <FiUnlock size={14} /> Release
        </button>
      </div>

      {/* ── Input Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">

        {/* Manual Input Panel */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
            <FiClipboard size={12} />
            Add Serial Manually
          </p>

          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <FaBarcode
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={15}
              />
              <input
                type="text"
                placeholder="FG Serial Number…"
                value={assemblySerial}
                onChange={(e) => setAssemblySerial(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleAddFg()}
                disabled={loading}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleAddFg}
              disabled={loading || !assemblySerial.trim()}
              className="px-4 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-700 active:scale-95 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
            >
              <FiPlus size={15} /> Add
            </button>
          </div>

          <div>
            <label className="text-xs tracking-widest text-gray-400 uppercase mb-2 flex items-center gap-1.5">
              {isHold
                ? <><FiAlertTriangle size={11} className="text-amber-500" /> Defect Name</>
                : <><FiTool size={11} className="text-emerald-500" /> Action Plan</>
              }
            </label>
            <input
              type="text"
              placeholder={isHold ? "Describe the defect…" : "Describe the corrective action…"}
              value={isHold ? defectName : actionPlan}
              onChange={(e) =>
                isHold ? setDefectName(e.target.value) : setActionPlan(e.target.value)
              }
              disabled={loading}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* File Upload Panel */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 flex flex-col shadow-sm">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
            <FiUploadCloud size={12} />
            Bulk Upload
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
                ? "border-amber-400 bg-amber-50 scale-[1.01]"
                : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files[0]; if (f) processFile(f); }}
            />
            <FiInbox
              size={28}
              className={`transition-colors ${dragOver ? "text-amber-400" : "text-gray-300"}`}
            />
            <p className="text-xs text-gray-500 font-medium">
              {dragOver ? "Drop to upload" : "Drop .xlsx or click to browse"}
            </p>
          </div>

          <p className="text-xs text-gray-400 mt-3 text-center flex items-center justify-center gap-1">
            <FiCpu size={10} /> Col A = Model &nbsp;·&nbsp; Col B = Serial
          </p>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="flex items-center justify-between mb-4 bg-white border border-gray-200 rounded-xl px-5 py-3 gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 flex items-center gap-1.5">
            <FiHash size={13} className="text-gray-400" />
            <span className="text-gray-900 font-bold text-base">{fgData.length}</span>
            {" "}serial{fgData.length !== 1 ? "s" : ""} queued
          </span>
          {fgData.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors border border-gray-200 hover:border-red-300 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <FiX size={11} /> Clear all
            </button>
          )}
        </div>

        <button
          onClick={isHold ? handleHold : handleRelease}
          disabled={loading || fgData.length === 0}
          className={`px-7 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
            isHold
              ? "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/25"
              : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25"
          }`}
        >
          {loading ? (
            <>
              <FiLoader size={15} className="animate-spin" />
              Processing…
            </>
          ) : isHold ? (
            <><FiLock size={15} /> Submit Hold</>
          ) : (
            <><FiUnlock size={15} /> Submit Release</>
          )}
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs tracking-widest text-gray-400 uppercase flex items-center gap-2">
            <FiClipboard size={12} /> Queued Serials
          </p>
          {fgData.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-200">
              {fgData.length} items
            </span>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {fgData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 select-none gap-2">
              <FiInbox size={40} className="text-gray-200" />
              <p className="text-sm text-gray-400 font-medium">No serials queued yet</p>
              <p className="text-xs text-gray-300">Add manually or upload an Excel file</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-3 text-left w-10 font-medium">
                    <FiHash size={11} />
                  </th>
                  <th className="px-5 py-3 text-left font-medium flex items-center gap-1.5">
                    <FiCpu size={11} /> Model Name
                  </th>
                  <th className="px-5 py-3 text-left font-medium">
                    <span className="flex items-center gap-1.5">
                      <FaBarcode size={11} /> FG Serial No.
                    </span>
                  </th>
                  <th className="px-5 py-3 text-center w-14 font-medium">Del</th>
                </tr>
              </thead>
              <tbody>
                {fgData.map((item, index) => (
                  <tr
                    key={item.assemblySerial}
                    className={`border-t border-gray-100 transition-all duration-500 ${
                      newRowIndex === index
                        ? "bg-amber-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-5 py-3 text-gray-400 text-xs">{index + 1}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{item.modelName}</td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md tracking-wide">
                        {item.assemblySerial}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleRemoveRow(index)}
                        className="w-7 h-7 flex items-center justify-center mx-auto text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove"
                      >
                        <FiTrash2 size={13} />
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
  );
};

export default DispatchHold;