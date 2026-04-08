import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import ExportButton from "../../components/ui/ExportButton";

import {
  FiSearch,
  FiCalendar,
  FiFilter,
  FiRefreshCw,
  FiDownload,
  FiInbox,
  FiHash,
  FiUser,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiUnlock,
  FiList,
  FiBarChart2,
  FiX,
  FiLoader,
  FiChevronDown,
} from "react-icons/fi";

// ── helpers ──────────────────────────────────────────────────────────────────
const pad = (n) => (n < 10 ? "0" + n : n);
const fmt = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const fmtDisplay = (isoStr) =>
  isoStr ? isoStr.replace("T", " ").replace("Z", "").slice(0, 16) : "—";

const STATE_OPTIONS = [
  { label: "Hold", value: "hold" },
  { label: "Release", value: "release" },
  { label: "All", value: "all" },
];

const GROUP_OPTIONS = [
  { label: "ModelNo", value: "ModelNo" },
  { label: "FGSerialNo", value: "FGSerialNo" },
  { label: "HoldReason", value: "HoldReason" },
  { label: "CorrectiveAction", value: "CorrectiveAction" },
  { label: "HoldBy", value: "HoldBy" },
  { label: "Status", value: "Status" },
];

// ── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const isHold = status === "Hold";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        isHold
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      }`}
    >
      {isHold ? <FiLock size={10} /> : <FiUnlock size={10} />}
      {status}
    </span>
  );
};

// ── Quick Filter Button ───────────────────────────────────────────────────────
const QuickBtn = ({ label, onClick, loading, color }) => {
  const colors = {
    yellow: "bg-amber-500 hover:bg-amber-400 shadow-amber-200",
    blue: "bg-blue-500 hover:bg-blue-400 shadow-blue-200",
    green: "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-5 py-2 rounded-lg text-white text-sm font-bold tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2 ${colors[color]}`}
    >
      {loading ? <FiLoader size={13} className="animate-spin" /> : <FiClock size={13} />}
      {label}
    </button>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const HoldCabinateDetails = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [state, setState] = useState(STATE_OPTIONS[0]);
  const [holdCabinetDetails, setHoldCabinetDetails] = useState([]);
  const [groupBy, setGroupBy] = useState(GROUP_OPTIONS[0]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("table"); // "table" | "summary"

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── fetch helper ─────────────────────────────────────────────────────────
  const fetchData = async (startDate, endDate, loaderFn) => {
    if (!state) return toast.error("Please select a state.");
    loaderFn(true);
    setHoldCabinetDetails([]);
    setTotalCount(0);
    try {
      const res = await axios.get(`${baseURL}quality/hold-cabinet-details`, {
        params: { status: state.value, startDate, endDate },
      });
      if (res?.data?.success) {
        setHoldCabinetDetails(res.data.data);
        setTotalCount(res.data.totalCount);
      }
    } catch {
      toast.error("Failed to fetch Hold Cabinet Details.");
    } finally {
      loaderFn(false);
    }
  };

  const handleQuery = () => {
    if (!startTime || !endTime)
      return toast.error("Please select Start and End time.");
    fetchData(startTime, endTime, setLoading);
  };

  const handleYesterday = () => {
    const now = new Date();
    const today8 = new Date(now); today8.setHours(8, 0, 0, 0);
    const yest8 = new Date(today8); yest8.setDate(today8.getDate() - 1);
    fetchData(fmt(yest8), fmt(today8), setYdayLoading);
  };

  const handleToday = () => {
    const now = new Date();
    const today8 = new Date(now); today8.setHours(8, 0, 0, 0);
    fetchData(fmt(today8), fmt(now), setTodayLoading);
  };

  const handleMTD = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    fetchData(fmt(start), fmt(now), setMonthLoading);
  };

  const handleClear = () => {
    setStartTime("");
    setEndTime("");
    setState(STATE_OPTIONS[0]);
    setHoldCabinetDetails([]);
    setGroupBy(GROUP_OPTIONS[0]);
    setSearchTerm("");
    setTotalCount(0);
  };

  // ── filtered rows ─────────────────────────────────────────────────────────
  const filteredData = debouncedSearch
    ? holdCabinetDetails.filter((item) =>
        [item.ModelNo, item.FGSerialNo, item.HoldReason, item.HoldBy]
          .some((v) => v?.toLowerCase().includes(debouncedSearch.toLowerCase()))
      )
    : holdCabinetDetails;

  // ── grouped summary ────────────────────────────────────────────────────────
  const groupedData = () => {
    if (!holdCabinetDetails.length) return [];
    const map = holdCabinetDetails.reduce((acc, item) => {
      const key = item[groupBy.value] || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(map)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  };

  const anyLoading = loading || ydayLoading || todayLoading || monthLoading;

  return (
    <div
      className="min-h-screen bg-gray-50 text-gray-800 p-5"
      style={{ fontFamily: "'DM Mono', 'Courier New', monospace" }}
    >
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs tracking-[0.3em] text-gray-400 uppercase mb-1">
            Quality · Dispatch Control
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <FiList className="text-blue-500" size={22} />
            Hold Cabinet Details
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">Total Records</p>
          <p className="text-2xl font-bold text-blue-600">{totalCount}</p>
        </div>
      </div>

      {/* ── Filter + Quick Filter Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Date + State Filters */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
            <FiFilter size={12} /> Filters
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            {/* Start Time */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiCalendar size={11} /> Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            {/* End Time */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiCalendar size={11} /> End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            {/* State */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiFilter size={11} /> Status
              </label>
              <div className="relative">
                <select
                  value={state.value}
                  onChange={(e) =>
                    setState(STATE_OPTIONS.find((s) => s.value === e.target.value))
                  }
                  className="w-full appearance-none px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all pr-8"
                >
                  {STATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              </div>
            </div>
          </div>

          {/* Search + Actions */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiSearch size={11} /> Search
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  placeholder="Model, Serial, Reason, HoldBy…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleQuery}
              disabled={anyLoading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200"
            >
              {loading ? <FiLoader size={13} className="animate-spin" /> : <FiSearch size={13} />}
              Query
            </button>

            <ExportButton data={holdCabinetDetails} filename="hold_cabinet_details" />

            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-300 text-gray-400 hover:text-red-500 text-sm transition-all flex items-center gap-1.5"
            >
              <FiX size={13} /> Clear
            </button>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
            <FiClock size={12} /> Quick Filters
          </p>
          <div className="flex flex-col gap-2.5">
            <QuickBtn label="Yesterday" onClick={handleYesterday} loading={ydayLoading} color="yellow" />
            <QuickBtn label="Today" onClick={handleToday} loading={todayLoading} color="blue" />
            <QuickBtn label="Month to Date" onClick={handleMTD} loading={monthLoading} color="green" />
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        <button
          onClick={() => setActiveTab("table")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === "table"
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "text-gray-400 hover:text-gray-700"
          }`}
        >
          <FiList size={14} /> Detail View
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === "summary"
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "text-gray-400 hover:text-gray-700"
          }`}
        >
          <FiBarChart2 size={14} /> Summary
        </button>
        {filteredData.length > 0 && (
          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-200">
            {filteredData.length} rows
          </span>
        )}
      </div>

      {/* ── Detail Table ── */}
      {activeTab === "table" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs tracking-widest text-gray-400 uppercase flex items-center gap-2">
              <FiList size={12} /> Records
            </p>
            {filteredData.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-200">
                {filteredData.length} of {totalCount}
              </span>
            )}
          </div>

          <div className="max-h-[540px] overflow-auto">
            {anyLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
                <FiLoader size={20} className="animate-spin text-blue-500" />
                <span className="text-sm">Loading records…</span>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-300 select-none">
                <FiInbox size={40} />
                <p className="text-sm text-gray-400">No records found</p>
                <p className="text-xs text-gray-300">Apply filters and click Query</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><FiHash size={10} /> #</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Model No.</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">FG Serial No.</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><FiAlertTriangle size={10} /> Hold Reason</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><FiCalendar size={10} /> Hold Date</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><FiUser size={10} /> Hold By</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><FiClock size={10} /> Days on Hold</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Corrective Action</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Released On</th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1"><FiUser size={10} /> Released By</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">{item.ModelNo}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                          {item.FGSerialNo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[160px] truncate" title={item.HoldReason}>
                        {item.HoldReason}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDisplay(item.HoldDate)}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{item.HoldBy}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md font-semibold text-xs ${
                          item.DaysOnHold > 7
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : item.DaysOnHold > 3
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}>
                          {item.DaysOnHold}d
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[160px] truncate" title={item.CorrectiveAction}>
                        {item.CorrectiveAction}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDisplay(item.ReleasedOn)}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{item.ReleasedBy || "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={item.Status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Summary Tab ── */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Group selector */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm lg:col-span-1">
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
              <FiBarChart2 size={12} /> Group By
            </p>
            <div className="flex flex-col gap-2">
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGroupBy(opt)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all flex items-center justify-between ${
                    groupBy.value === opt.value
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {opt.label}
                  {groupBy.value === opt.value && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md">
                      {groupedData().length} groups
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <ExportButton
                data={groupedData()}
                filename="hold_cabinet_summary"
              />
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:col-span-2">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs tracking-widest text-gray-400 uppercase flex items-center gap-2">
                <FiBarChart2 size={12} /> {groupBy.label} Breakdown
              </p>
              {groupedData().length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-200">
                  {groupedData().length} groups
                </span>
              )}
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              {groupedData().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300 select-none">
                  <FiInbox size={36} />
                  <p className="text-sm text-gray-400">No data to group</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-5 py-3 text-left font-medium w-10">
                        <FiHash size={11} />
                      </th>
                      <th className="px-5 py-3 text-left font-medium">{groupBy.label}</th>
                      <th className="px-5 py-3 text-right font-medium">Count</th>
                      <th className="px-5 py-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData().map((item, i) => {
                      const pct = totalCount
                        ? Math.round((item.count / totalCount) * 100)
                        : 0;
                      return (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-1.5 rounded-full bg-blue-400"
                                style={{ width: `${Math.max(pct, 4)}%`, maxWidth: "100px" }}
                              />
                              <span className="text-gray-700 text-xs font-medium truncate max-w-[200px]" title={item.key}>
                                {item.key}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="font-bold text-gray-900">{item.count}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-xs text-gray-500">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HoldCabinateDetails;