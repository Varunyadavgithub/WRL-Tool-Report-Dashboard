import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

import { FiSend, FiTrash2, FiClipboard } from "react-icons/fi";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdOutlineWarehouse } from "react-icons/md";

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <AiOutlineLoading3Quarters size={size} className="animate-spin inline-block" />
);

const fixedHeaders = [
  "GATE ENTRY NUMBER",
  "GATE ENTRY DATE",
  "PO NUMBER",
  "LINE ITEM",
  "PO DATE",
  "INVOICE VALUE",
  "BASIC RATE",
  "HSN CODE AS PER INVOICE",
  "GRN:103",
  "GRN:101 /105",
  "SUPPLIER CODE",
  "SUPPLIER NAME",
  "INVOICE NO.",
  "INVOICE DATE",
  "ITEM CODE",
  "DESCRIPTION OF THE GOODS",
  "UOM",
  "INVOICE QTY.",
  "RECEIVED QTY.",
  "DISCREPANCY",
  "MATERIAL GROUP",
  "VEHICLE NO.",
  "DELIVERY TYPE",
  "VEHICLE NAME",
  "VEHICLE TYPE",
  "FUEL TYPE",
  "TOTAL CARRYING CAPACITY OF THE VEHICLE",
  "REMARKS",
];

const GateEntry = () => {
  const [pasteData, setPasteData] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleParseData = async () => {
    if (!pasteData) {
      toast.error("Please paste Gate Entry data first.");
      return;
    }

    setLoading(true);

    try {
      const lines = pasteData
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");

      const parsedRows = lines.map((line) => line.split("\t"));
      setRows(parsedRows);

      const res = await axios.post(`${baseURL}dispatch/material-gate-entry`, {
        data: parsedRows,
      });

      if (res?.data?.success) {
        toast.success(res.data.message || "Gate Entry report sent successfully!");
      } else {
        toast.error(res?.data?.message || "Failed to send Gate Entry report.");
      }
    } catch (error) {
      console.error("Error sending Gate Entry report:", error);
      toast.error("Failed to send Gate Entry report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPasteData("");
    setRows([]);
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
          <MdOutlineWarehouse size={22} />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">
            Gate Entry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Paste inbound material gate-entry rows to preview and email the team
          </p>
        </div>
        {rows.length > 0 && (
          <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full tabular-nums">
            {rows.length.toLocaleString()} rows
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 py-5 flex flex-col gap-4">
        {/* ── Paste Card ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <FiClipboard size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Paste Excel Rows
            </span>
          </div>
          <textarea
            className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50 disabled:text-slate-400"
            rows={8}
            placeholder="Paste your Excel data rows here (without headers)"
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            disabled={loading}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleParseData}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? <Spinner size={14} /> : <FiSend size={14} />}
              {loading ? "Sending…" : "Send Email"}
            </button>
            <button
              onClick={handleClear}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiTrash2 size={14} /> Clear
            </button>
          </div>
        </div>

        {/* ── Preview Table ── */}
        {rows.length > 0 && (
          <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
              <MdOutlineWarehouse size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Preview
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                  <tr>
                    {fixedHeaders.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      {fixedHeaders.map((_, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3 py-2 text-slate-600 whitespace-pre-wrap"
                        >
                          {row[cIdx] || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length === 0 && !loading && (
          <div className="flex-1 min-h-0 bg-white border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center">
            <MdOutlineWarehouse size={36} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm font-semibold text-slate-300">No data pasted yet</p>
            <p className="text-xs text-slate-300 mt-1">
              Paste your Excel data above and click "Send Email" to preview and distribute it
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GateEntry;
