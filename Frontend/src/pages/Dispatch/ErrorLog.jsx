import { useMemo, useState } from "react";
import SelectField from "../../components/ui/SelectField";
import InputField from "../../components/ui/InputField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

import { FiSearch, FiXCircle, FiLayers } from "react-icons/fi";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdOutlineErrorOutline } from "react-icons/md";
import { TbFilterOff } from "react-icons/tb";

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <AiOutlineLoading3Quarters size={size} className="animate-spin inline-block" />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = "rose" }) => {
  const colors = {
    rose: "bg-rose-50 border-rose-200 text-rose-500 [&_span]:text-rose-700",
  };
  return (
    <div className={`flex flex-col gap-0.5 px-5 py-3 rounded-xl border ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-widest font-semibold">{label}</p>
      <span className="text-2xl font-black tabular-nums">{value ?? "—"}</span>
    </div>
  );
};

const groupingOptions = [
  { label: "Session_ID", value: "sessionid" },
  { label: "FGSerialNo", value: "fgserialno" },
  { label: "AssetNo", value: "assetno" },
  { label: "ModelName", value: "modelname" },
  { label: "ModelCode", value: "modelcode" },
  { label: "ErrorMessage", value: "errormessage" },
  { label: "ErrorName", value: "errorname" },
];

const ErrorLog = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errorLogData, setErrorLogData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupingCondition, setGroupingCondition] = useState(groupingOptions[0]);
  const [totalCount, setTotalCount] = useState(0);

  const fetchErrorLogData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}dispatch/error-log`, {
        params: { startDate: startTime, endDate: endTime },
      });

      if (res?.data?.success) {
        setErrorLogData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Error Log data:", error);
      toast.error("Failed to fetch Error Log data.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = () => {
    fetchErrorLogData();
  };

  const handleClearFilters = () => {
    setStartTime("");
    setEndTime("");
    setErrorLogData([]);
    setSearchTerm("");
    setGroupingCondition(groupingOptions[0]);
    setTotalCount(0);
  };

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return errorLogData;
    const q = searchTerm.trim().toLowerCase();
    return errorLogData.filter((item) =>
      [
        item.Session_ID,
        item.FGSerialNo,
        item.AssetNo,
        item.ModelName,
        item.ModelCode,
        item.ErrorMessage,
        item.ErrorName,
      ].some((v) => v?.toString().toLowerCase().includes(q)),
    );
  }, [errorLogData, searchTerm]);

  const groupedData = useMemo(() => {
    if (!filteredData.length || !groupingCondition) return [];
    const grouped = filteredData.reduce((acc, item) => {
      const key = item[groupingCondition.label] || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData, groupingCondition]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 text-rose-600">
          <MdOutlineErrorOutline size={22} />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">
            Dispatch Error Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Failed dispatch scans and their error reasons</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {totalCount > 0 && <StatCard label="Total Errors" value={totalCount} />}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 py-5 flex flex-col gap-4">
        {/* ── Filter Bar ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[170px]">
              <DateTimePicker
                label="Start Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[170px]">
              <DateTimePicker
                label="End Time"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="min-w-[200px]">
              <InputField
                label="Search"
                type="text"
                placeholder="Filter loaded rows…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={handleQuery}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? <Spinner size={14} /> : <FiSearch size={14} />}
              Query
            </button>

            <button
              onClick={handleClearFilters}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TbFilterOff size={14} /> Clear Filter
            </button>
          </div>
        </div>

        {/* ── Tables Row ── */}
        <div className="flex-1 min-h-0 flex gap-4 items-stretch">
          {/* Error Records Table */}
          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
              <FiXCircle size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Error Records
              </span>
              {filteredData.length > 0 && (
                <span className="ml-auto bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                  {filteredData.length.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                  <tr>
                    {[
                      "Session ID",
                      "FG Serial No",
                      "Asset No",
                      "Model Name",
                      "Model Code",
                      "Error Message",
                      "Error Name",
                      "Error On",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, index) => (
                    <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-mono font-semibold text-slate-600 whitespace-nowrap">
                        {item.Session_ID}
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{item.FGSerialNo}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">{item.AssetNo}</td>
                      <td className="px-3 py-2 text-slate-700 font-semibold whitespace-nowrap">{item.ModelName}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{item.ModelCode}</td>
                      <td className="px-3 py-2 text-rose-600 font-medium">{item.ErrorMessage}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{item.ErrorName}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono">
                        {item.ErrorOn?.replace("T", " ").replace("Z", "")}
                      </td>
                    </tr>
                  ))}
                  {!loading && errorLogData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <FiXCircle size={36} className="mx-auto mb-3 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-300">No records found</p>
                        <p className="text-xs text-slate-300 mt-1">Select a time range and click Query</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {loading && (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-sm">
                  <Spinner /> Loading records…
                </div>
              )}
            </div>
          </div>

          {/* Grouped Summary Panel */}
          <div className="w-[260px] flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
              <FiLayers size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Group By</span>
            </div>
            <div className="p-3 border-b border-slate-100 shrink-0">
              <SelectField
                label="Field"
                options={groupingOptions}
                value={groupingCondition.value}
                onChange={(e) => {
                  const selected = groupingOptions.find((item) => item.value === e.target.value);
                  setGroupingCondition(selected);
                }}
              />
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 text-sm">
                  <Spinner size={22} />
                  <span>Calculating…</span>
                </div>
              ) : groupedData.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                    <tr>
                      {[groupingCondition.label, "Count"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((item, index) => (
                      <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-600 whitespace-nowrap truncate max-w-[150px]">
                          {item.key}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-xs font-black tabular-nums bg-rose-100 text-rose-700">
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-200">
                  <FiLayers size={36} className="mb-3" />
                  <p className="text-sm font-semibold text-slate-300">No summary yet</p>
                  <p className="text-xs text-slate-300 mt-1">Run a query to see groups</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorLog;
