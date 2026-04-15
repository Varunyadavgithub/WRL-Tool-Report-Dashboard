import { useState } from "react";
import ExcelJS from "exceljs";
import toast from "react-hot-toast";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import InputField from "../../components/ui/InputField";
import {
  Plus,
  RefreshCw,
  Upload,
  Trash2,
  Loader2,
  PackageOpen,
} from "lucide-react";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Main Component ─────────────────────────────────────────────────────────────
const ModelNameUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [assemblySerial, setAssemblySerial] = useState("");
  const [assemblySerialFile, setAssemblySerialFile] = useState("");
  const [fgData, setFgData] = useState([]);

  const handleAddFg = async () => {
    if (!assemblySerial.trim()) {
      toast.error("Please enter FG Serial Number");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setFgData((prev) => [...prev, { assemblySerial }]);
      setAssemblySerial("");
    }, 500);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!assemblySerialFile) {
      toast.error("Please upload a valid Excel file.");
      return;
    }
    setLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target.result;
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        const newFgData = [];
        worksheet.eachRow((row) => {
          const serial = row.getCell(1).value?.toString().trim();
          if (serial) newFgData.push({ assemblySerial: serial });
        });
        if (newFgData.length === 0) {
          toast.error("No valid data found in the file.");
          setLoading(false);
          return;
        }
        setFgData((prev) => [...prev, ...newFgData]);
        toast.success("FG Serial Numbers uploaded successfully.");
      };
      reader.readAsArrayBuffer(assemblySerialFile);
    } catch (err) {
      console.error("Error processing Excel file:", err);
      toast.error("Failed to process the Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateModelName = async () => {
    if (fgData.length === 0) {
      toast.error("Please upload or enter FG Serial Numbers.");
      return;
    }
    setLoading(true);
    const updatedFgData = [...fgData];
    let unupdatedCount = 0;
    for (let i = updatedFgData.length - 1; i >= 0; i--) {
      const fgNo = updatedFgData[i].assemblySerial;
      const modelCode = fgNo.slice(1, 5);
      try {
        const res1 = await axios.get(`${baseURL}prod/get-model-name`, {
          params: { modelCode },
        });
        const modelName = res1?.data?.data;
        if (!modelName || modelName === "~") {
          toast.error(
            `Model fetch failed or already dispatched for FGNo: ${fgNo}`,
          );
          unupdatedCount++;
          continue;
        }
        const res2 = await axios.put(`${baseURL}prod/update-model-name`, {
          fgSerial: fgNo,
          modelName,
        });
        if (res2.data?.success && res2?.data?.data != 0) {
          updatedFgData.splice(i, 1);
        } else {
          toast.error(`Failed to update FGNo: ${fgNo}, Model: ${modelName}`);
          unupdatedCount++;
        }
      } catch (err) {
        console.error(err);
        toast.error(`Error updating FGNo: ${fgNo}`);
        unupdatedCount++;
      }
    }
    setFgData(updatedFgData);
    if (unupdatedCount === 0)
      toast.success("All records updated successfully.");
    else toast.success(`Updated with ${unupdatedCount} failed record(s).`);
    setLoading(false);
  };

  const handleClearFilters = () => {
    setAssemblySerial("");
    setAssemblySerialFile("");
    setFgData([]);
  };

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Model Name Update
          </h1>
          <p className="text-[11px] text-slate-400">
            Update model names for FG serial numbers
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── INPUT CARDS ROW ── */}
        <div className="flex gap-3 shrink-0 flex-wrap">
          {/* Manual entry card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 min-w-[260px]">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Manual Entry
            </p>
            <div className="flex flex-col gap-3">
              <InputField
                label="FG Serial No."
                type="text"
                placeholder="Enter FG Serial No."
                name="assemblySerial"
                value={assemblySerial}
                onChange={(e) => setAssemblySerial(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFg()}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddFg}
                  disabled={loading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? <Spinner /> : <Plus className="w-4 h-4" />}
                  Add FG
                </button>
                <button
                  onClick={handleUpdateModelName}
                  disabled={loading || fgData.length === 0}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading || fgData.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  }`}
                >
                  {loading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
                  Update
                </button>
              </div>
            </div>
          </div>

          {/* File upload card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 min-w-[260px]">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Bulk Upload
            </p>
            <div className="flex flex-col gap-3">
              <InputField
                label="FG Serial No. File"
                type="file"
                name="assemblySerialFile"
                onChange={(e) => setAssemblySerialFile(e.target.files[0])}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? <Spinner /> : <Upload className="w-4 h-4" />}
                  Upload FG
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── SUMMARY TABLE ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Summary
            </span>
            <span className="text-[11px] text-slate-400">
              {fgData.length > 0
                ? `${fgData.length} record${fgData.length !== 1 ? "s" : ""} queued`
                : ""}
            </span>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-xs text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100">
                  {["Sr. No.", "FG Serial No."].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fgData.length > 0 ? (
                  fgData.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                    >
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                        {item.assemblySerial}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <PackageOpen
                          className="w-12 h-12 opacity-20"
                          strokeWidth={1.2}
                        />
                        <p className="text-sm">
                          No FG serials queued. Add manually or upload a file.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelNameUpdate;
