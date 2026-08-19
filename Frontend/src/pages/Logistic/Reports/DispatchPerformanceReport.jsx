import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets";
import DateTimePicker from "../../../components/ui/DateTimePicker";

import { FiSearch, FiTable, FiBarChart2 } from "react-icons/fi";
import { BsCalendarDay, BsCalendarCheck, BsCalendarRange } from "react-icons/bs";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdOutlineSpeed } from "react-icons/md";

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <AiOutlineLoading3Quarters size={size} className="animate-spin text-violet-400 inline-block" />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value }) => (
  <div className="flex flex-col gap-0.5 px-5 py-3 rounded-xl bg-violet-50 border border-violet-200">
    <span className="text-[10px] uppercase tracking-widest text-violet-500 font-semibold">{label}</span>
    <span className="text-2xl font-black tabular-nums text-violet-700">{value ?? "—"}</span>
  </div>
);

// ─── Report type config ─────────────────────────────────────────────────────
// All three "detail" endpoints return the same shape (Hour Number / Time Hour /
// Count), so they share one table. The summary endpoints differ in columns.
const REPORT_TYPES = [
  {
    value: "vehicleUph",
    label: "Vehicle Loading UPH",
    detailEndpoint: "dispatch/vehicle-uph",
    summaryEndpoint: "dispatch/vehicle-summary",
    summaryColumns: [
      { header: "Hour Number", key: "HOUR_NUMBER" },
      { header: "Time Hour", key: "TIMEHOUR" },
      { header: "Session ID", key: "session_ID" },
      { header: "Model Count", key: "Model_Count" },
    ],
  },
  {
    value: "modelUph",
    label: "Model UPH",
    detailEndpoint: "dispatch/model-count",
    summaryEndpoint: "dispatch/model-summary",
    summaryColumns: [
      { header: "Time Hour", key: "TIMEHOUR" },
      { header: "Model Name", key: "ModelName" },
      { header: "Count", key: "COUNT" },
    ],
  },
  {
    value: "categoryUph",
    label: "Category UPH",
    detailEndpoint: "dispatch/category-model-count",
    summaryEndpoint: "dispatch/category-summary",
    summaryColumns: [
      { header: "Model Name", key: "ModelName" },
      { header: "Count", key: "COUNT" },
    ],
  },
];

// ─── Detail table (shared shape across all report types) ───────────────────
const DetailTable = ({ data }) => (
  <div className="flex-1 overflow-auto">
    <table className="min-w-full text-xs">
      <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <tr>
          {["Hour Number", "Time Hour", "Count"].map((h) => (
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
        {data.map((row, index) => (
          <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <td className="px-3 py-2 text-slate-600 font-mono">{row.HOUR_NUMBER}</td>
            <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">{row.TIMEHOUR}</td>
            <td className="px-3 py-2 font-bold text-violet-600 tabular-nums">{row.COUNT}</td>
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={3} className="py-20 text-center">
              <FiTable size={36} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-semibold text-slate-300">No records found</p>
              <p className="text-xs text-slate-300 mt-1">Select a time range and Report Type, then click Query</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// ─── Summary table (columns driven by the active report type) ──────────────
const SummaryTable = ({ data, columns }) => (
  <div className="flex-1 overflow-auto">
    <table className="min-w-full text-xs">
      <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap"
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                {row[c.key]}
              </td>
            ))}
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="py-20 text-center">
              <FiBarChart2 size={36} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-semibold text-slate-300">No summary yet</p>
              <p className="text-xs text-slate-300 mt-1">Run a query to see the breakdown</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const pad = (n) => (n < 10 ? "0" + n : n);
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const DispatchPerformanceReport = () => {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [dispatchType, setDispatchType] = useState(REPORT_TYPES[0].value);
  const [dispatchData, setDispatchData] = useState([]);
  const [dispatchSummaryData, setDispatchSummaryData] = useState([]);

  const activeReport = REPORT_TYPES.find((r) => r.value === dispatchType);

  const runQuery = async (startDate, endDate, loaderFn) => {
    loaderFn(true);
    setDispatchData([]);
    setDispatchSummaryData([]);
    try {
      const params = { startDate, endDate };
      const [res, summRes] = await Promise.all([
        axios.get(`${baseURL}${activeReport.detailEndpoint}`, { params }),
        axios.get(`${baseURL}${activeReport.summaryEndpoint}`, { params }),
      ]);
      setDispatchData(res?.data?.data || []);
      setDispatchSummaryData(summRes?.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch Dispatch Performance Report:", error);
      toast.error("Failed to fetch Dispatch Performance Report data. Please try again.");
    } finally {
      loaderFn(false);
    }
  };

  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    runQuery(startTime, endTime, setLoading);
  };

  const runQuickFilter = (type) => {
    const now = new Date();
    const today8 = new Date(now);
    today8.setHours(8, 0, 0, 0);

    let start, end, loaderFn;
    if (type === "yday") {
      const y8 = new Date(today8);
      y8.setDate(y8.getDate() - 1);
      start = fmt(y8);
      end = fmt(today8);
      loaderFn = setYdayLoading;
    } else if (type === "tday") {
      start = fmt(today8);
      end = fmt(now);
      loaderFn = setTodayLoading;
    } else {
      const som = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
      start = fmt(som);
      end = fmt(now);
      loaderFn = setMonthLoading;
    }
    runQuery(start, end, loaderFn);
  };

  useEffect(() => {
    setDispatchData([]);
    setDispatchSummaryData([]);
  }, [dispatchType]);

  const anyLoading = ydayLoading || todayLoading || monthLoading;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 text-violet-600">
          <MdOutlineSpeed size={22} />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">
            Dispatch Performance Report
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Units-per-hour throughput by vehicle, model, or category</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {dispatchSummaryData.length > 0 && (
            <StatCard label="Summary Rows" value={dispatchSummaryData.length} />
          )}
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

            <button
              onClick={handleQuery}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? <Spinner size={14} /> : <FiSearch size={14} />}
              Query
            </button>

            {/* Divider */}
            <div className="hidden md:block w-px h-9 bg-slate-200 mx-1" />

            {/* Quick Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick</span>
              {[
                {
                  key: "yday",
                  label: "Yesterday",
                  icon: <BsCalendarDay size={13} />,
                  isLoading: ydayLoading,
                  cls: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700",
                },
                {
                  key: "tday",
                  label: "Today",
                  icon: <BsCalendarCheck size={13} />,
                  isLoading: todayLoading,
                  cls: "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700",
                },
                {
                  key: "mtd",
                  label: "MTD",
                  icon: <BsCalendarRange size={13} />,
                  isLoading: monthLoading,
                  cls: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700",
                },
              ].map(({ key, label, icon, isLoading, cls }) => (
                <button
                  key={key}
                  onClick={() => runQuickFilter(key)}
                  disabled={anyLoading}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${cls}`}
                >
                  {isLoading ? <Spinner size={12} /> : icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Report type */}
          <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Report Type</span>
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt.value}
                onClick={() => setDispatchType(rt.value)}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  dispatchType === rt.value
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tables Row ── */}
        <div className="flex-1 min-h-0 flex gap-4 items-stretch">
          {/* Detail Table */}
          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
              <FiTable size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{activeReport.label}</span>
              {dispatchData.length > 0 && (
                <span className="ml-auto bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                  {dispatchData.length.toLocaleString()}
                </span>
              )}
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-slate-400 text-sm">
                <Spinner /> Loading records…
              </div>
            ) : (
              <DetailTable data={dispatchData} />
            )}
          </div>

          {/* Summary Panel — width scales with column count (Vehicle UPH's
              4 columns incl. long Session ID strings need more room than
              Category UPH's 2) so nothing gets clipped */}
          <div
            className={`${
              activeReport.summaryColumns.length >= 4
                ? "w-[460px]"
                : activeReport.summaryColumns.length === 3
                  ? "w-[340px]"
                  : "w-[240px]"
            } flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col`}
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
              <FiBarChart2 size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Summary</span>
              {dispatchSummaryData.length > 0 && (
                <span className="ml-auto bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                  {dispatchSummaryData.length.toLocaleString()}
                </span>
              )}
            </div>
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
                <Spinner size={22} />
                <span>Calculating…</span>
              </div>
            ) : (
              <SummaryTable data={dispatchSummaryData} columns={activeReport.summaryColumns} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchPerformanceReport;
