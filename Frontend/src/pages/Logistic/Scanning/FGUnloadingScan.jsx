import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { baseURL } from "../../../assets/assets";
import ScanErrorDialog from "../../../components/Logistic/ScanErrorDialog";

import { FiCheckCircle, FiPackage, FiHash } from "react-icons/fi";
import { MdOutlineInventory2, MdQrCodeScanner } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

const Spinner = ({ size = 16 }) => (
  <AiOutlineLoading3Quarters size={size} className="animate-spin inline-block" />
);

const StatCard = ({ label, value, tone = "amber" }) => {
  const tones = {
    amber: "bg-amber-50 border-amber-200 text-amber-500 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-500 text-emerald-700",
    red: "bg-red-50 border-red-200 text-red-500 text-red-700",
  };
  const [bg, border, label_, value_] = tones[tone].split(" ");
  return (
    <div className={`flex flex-col gap-0.5 px-5 py-3 rounded-xl ${bg} border ${border}`}>
      <span className={`text-[10px] uppercase tracking-widest font-semibold ${label_}`}>{label}</span>
      <span className={`text-2xl font-black tabular-nums ${value_}`}>{value ?? "—"}</span>
    </div>
  );
};

const FGUnloadingScan = () => {
  const [scannerNo, setScannerNo] = useState(() => localStorage.getItem("unloadingScannerNo") || "");
  const [rawBarcode, setRawBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [banner, setBanner] = useState(null); // success detail card: { title, detail }
  const [errorDialog, setErrorDialog] = useState(null); // blocking error message
  const [scannedCount, setScannedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [recentScans, setRecentScans] = useState([]);

  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem("unloadingScannerNo", scannerNo);
  }, [scannerNo]);

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleScan = async (e) => {
    e.preventDefault();
    const value = rawBarcode.trim();
    if (!value || scanning) return;

    setScanning(true);
    try {
      const res = await axios.post(`${baseURL}dispatch/unloading/scan`, {
        rawBarcode: value,
        scannerNo: scannerNo.trim() || null,
      });

      const data = res.data.data;
      setBanner({ title: "FG Unloading Completed", detail: data });
      setScannedCount((c) => c + 1);
      setRecentScans((prev) => [
        { ...data, time: new Date().toLocaleTimeString(), status: "Valid" },
        ...prev,
      ].slice(0, 50));
    } catch (err) {
      const res = err?.response?.data;
      const message = res?.message || "Failed to scan FG.";
      setErrorDialog(message);
      setRejectedCount((c) => c + 1);
      setRecentScans((prev) => [
        { fgSerialNo: value, time: new Date().toLocaleTimeString(), status: message },
        ...prev,
      ].slice(0, 50));
    } finally {
      setRawBarcode("");
      setScanning(false);
      focusInput();
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
          <MdOutlineInventory2 size={22} />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">FG Unloading</h1>
          <p className="text-xs text-slate-400 mt-0.5">Scan FG labels to record dispatch unloading</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatCard label="Scanned" value={scannedCount} tone="emerald" />
          <StatCard label="Rejected" value={rejectedCount} tone="red" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 py-5 flex flex-col gap-4">
        {/* Scan bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Scanner No.
              </label>
              <input
                type="text"
                value={scannerNo}
                onChange={(e) => setScannerNo(e.target.value)}
                placeholder="e.g. AS1"
                className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <form onSubmit={handleScan} className="flex-1 min-w-[280px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Scan FG Label
              </label>
              <div className="relative">
                <MdQrCodeScanner className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  value={rawBarcode}
                  onChange={(e) => setRawBarcode(e.target.value)}
                  onBlur={focusInput}
                  disabled={scanning}
                  autoComplete="off"
                  placeholder="Scan or focus here…"
                  className="w-full pl-11 pr-4 py-3.5 border-2 border-amber-200 rounded-xl text-base font-mono text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:opacity-50"
                />
                {scanning && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500">
                    <Spinner size={18} />
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Result banner (success only — errors show as a blocking dialog) */}
        {banner && (
          <div className="shrink-0 rounded-2xl border-2 p-5 flex items-center gap-4 bg-emerald-50 border-emerald-300">
            <FiCheckCircle size={40} className="text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xl font-black text-emerald-700">✓ {banner.title}</p>
              {banner.detail && (
                <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                  <span><span className="text-slate-400">Model:</span> <b>{banner.detail.modelName}</b></span>
                  <span><span className="text-slate-400">FG Serial:</span> <b className="font-mono">{banner.detail.fgSerialNo}</b></span>
                  <span><span className="text-slate-400">Asset Code:</span> <b className="font-mono">{banner.detail.assetCode}</b></span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent scans */}
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50 shrink-0">
            <FiPackage size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Recent Scans (this session)</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                <tr>
                  {["#", "Model Name", "FG Serial No.", "Asset Code", "Status", "Time"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentScans.map((item, index) => (
                  <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-slate-300 tabular-nums select-none">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{item.modelName ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{item.fgSerialNo}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">{item.assetCode ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        item.status === "Valid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono">{item.time}</td>
                  </tr>
                ))}
                {recentScans.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <FiHash size={36} className="mx-auto mb-3 text-slate-200" />
                      <p className="text-sm font-semibold text-slate-300">No scans yet</p>
                      <p className="text-xs text-slate-300 mt-1">Scan an FG label to begin</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ScanErrorDialog
        message={errorDialog}
        onClose={() => {
          setErrorDialog(null);
          focusInput();
        }}
      />
    </div>
  );
};

export default FGUnloadingScan;
