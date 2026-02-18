import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  FiSearch,
  FiRotateCcw,
  FiClock,
  FiStopCircle,
  FiPlay,
  FiActivity,
  FiMapPin,
  FiCalendar,
  FiBarChart2,
  FiList,
} from "react-icons/fi";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdOutlineTableChart } from "react-icons/md";

import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import EmptyState from "../../components/ui/EmptyState";

// ─── Inner Tab Config ───────────────────────────────────────────
const INNER_TABS = [
  {
    key: "summary",
    label: "Summary Report",
    icon: FiBarChart2,
    activeBg: "bg-indigo-50",
    activeBorder: "border-indigo-500",
    activeText: "text-indigo-700",
    iconActive: "text-indigo-600",
    headerGradient: "from-indigo-600 to-purple-600",
  },
  {
    key: "detail",
    label: "Detail Report",
    icon: FiList,
    activeBg: "bg-teal-50",
    activeBorder: "border-teal-500",
    activeText: "text-teal-700",
    iconActive: "text-teal-600",
    headerGradient: "from-teal-600 to-emerald-600",
  },
];

// ─── Format seconds to HH:MM:SS ────────────────────────────────
function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Duration Badge ─────────────────────────────────────────────
function DurationBadge({ duration, seconds }) {
  const isHigh = seconds > 600; // > 10 min
  const isMedium = seconds > 120; // > 2 min

  const color = isHigh
    ? "bg-red-50 text-red-700 border-red-200"
    : isMedium
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${color}`}
    >
      <FiClock size={10} />
      {duration}
    </span>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, subValue, color }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm bg-white
                     ${color.border} hover:shadow-md transition-shadow duration-200`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.bg}`}
      >
        <Icon size={18} className={color.icon} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none">
          {label}
        </p>
        <p className={`text-xl font-bold mt-0.5 ${color.text}`}>{value}</p>
        {subValue && (
          <p className="text-[10px] text-gray-400 mt-0.5">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// ─── Summary Table ──────────────────────────────────────────────
function SummaryTable({ data, tabConfig }) {
  const headers = [
    "Rank",
    "Station Name",
    "Total Stop Time",
    "Total Stops",
    "Avg per Stop",
  ];

  // Calculate totals
  const totalStops = data.reduce(
    (sum, d) => sum + (d.Total_Stop_Count || 0),
    0,
  );
  const totalSeconds = data.reduce((sum, d) => sum + (d.Total_Seconds || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
          <StatCard
            icon={FiMapPin}
            label="Stations Affected"
            value={data.length}
            color={{
              bg: "bg-indigo-50",
              icon: "text-indigo-600",
              text: "text-indigo-700",
              border: "border-indigo-200",
            }}
          />
          <StatCard
            icon={FiStopCircle}
            label="Total Stops"
            value={totalStops}
            color={{
              bg: "bg-red-50",
              icon: "text-red-600",
              text: "text-red-700",
              border: "border-red-200",
            }}
          />
          <StatCard
            icon={FiClock}
            label="Total Stop Time"
            value={formatSeconds(totalSeconds)}
            subValue={`${Math.round(totalSeconds / 60)} minutes`}
            color={{
              bg: "bg-amber-50",
              icon: "text-amber-600",
              text: "text-amber-700",
              border: "border-amber-200",
            }}
          />
          <StatCard
            icon={FiActivity}
            label="Avg per Stop"
            value={
              totalStops > 0
                ? formatSeconds(Math.round(totalSeconds / totalStops))
                : "—"
            }
            color={{
              bg: "bg-teal-50",
              icon: "text-teal-600",
              text: "text-teal-700",
              border: "border-teal-200",
            }}
          />
        </div>
      )}

      {/* Bar Visualization */}
      {data.length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Stop Time Distribution
          </p>
          <div className="flex flex-col gap-2">
            {data.map((item, index) => {
              const maxSeconds = data[0]?.Total_Seconds || 1;
              const percentage = ((item.Total_Seconds || 0) / maxSeconds) * 100;
              const isTop = index === 0;

              return (
                <div key={index} className="flex items-center gap-3">
                  <span
                    className="text-[11px] text-gray-500 font-medium w-[180px] truncate"
                    title={item.Station_Name}
                  >
                    {item.Station_Name}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
                        isTop
                          ? "bg-gradient-to-r from-red-400 to-red-500"
                          : index < 3
                            ? "bg-gradient-to-r from-amber-400 to-amber-500"
                            : "bg-gradient-to-r from-indigo-400 to-indigo-500"
                      }`}
                      style={{ width: `${Math.max(percentage, 8)}%` }}
                    >
                      <span className="text-[10px] text-white font-bold whitespace-nowrap">
                        {item.Total_Stop_Time}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500 font-mono w-[40px] text-right">
                    {item.Total_Stop_Count}×
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[450px] rounded-xl border border-gray-200 shadow-sm">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: "700px" }}
        >
          <colgroup>
            <col style={{ width: "60px" }} />
            <col style={{ width: "250px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "150px" }} />
          </colgroup>
          <thead>
            <tr
              className={`bg-gradient-to-r ${tabConfig.headerGradient} text-white`}
            >
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-center border-r border-white/10 last:border-r-0"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length > 0 ? (
              data.map((item, index) => {
                const isTop = index === 0;
                const rowBg = isTop
                  ? "bg-red-50/40"
                  : index % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50/60";

                const avgSeconds =
                  item.Total_Stop_Count > 0
                    ? Math.round(
                        (item.Total_Seconds || 0) / item.Total_Stop_Count,
                      )
                    : 0;

                return (
                  <tr
                    key={index}
                    className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/50`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          isTop
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-left">
                      <div className="flex items-center gap-2">
                        <FiMapPin
                          size={12}
                          className={isTop ? "text-red-500" : "text-gray-400"}
                        />
                        <span
                          className={`text-xs font-semibold ${isTop ? "text-red-700" : "text-gray-800"}`}
                        >
                          {item.Station_Name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <DurationBadge
                        duration={item.Total_Stop_Time}
                        seconds={item.Total_Seconds}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                          item.Total_Stop_Count > 10
                            ? "bg-red-50 text-red-700 border-red-200"
                            : item.Total_Stop_Count > 5
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                      >
                        <FiStopCircle size={10} />
                        {item.Total_Stop_Count}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-gray-600 font-mono">
                      {formatSeconds(avgSeconds)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length}>
                  <EmptyState message="No stop & loss data found for the selected filters." />
                </td>
              </tr>
            )}
          </tbody>
          {/* Table Footer */}
          {data.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td
                  className="px-4 py-3 text-center text-xs text-gray-600"
                  colSpan={2}
                >
                  TOTAL ({data.length} stations)
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-bold text-gray-700">
                    {formatSeconds(totalSeconds)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs font-bold text-gray-700">
                  {totalStops}
                </td>
                <td className="px-4 py-3 text-center text-xs font-bold text-gray-700 font-mono">
                  {totalStops > 0
                    ? formatSeconds(Math.round(totalSeconds / totalStops))
                    : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Detail Table ───────────────────────────────────────────────
function DetailTable({ data, tabConfig }) {
  const headers = [
    "Sr No",
    "Station Name",
    "Date",
    "Stop Time",
    "Start Time",
    "Duration",
  ];

  return (
    <div className="w-full overflow-x-auto overflow-y-auto max-h-[550px] rounded-xl border border-gray-200 shadow-sm">
      <table
        className="w-full text-sm border-collapse"
        style={{ minWidth: "800px" }}
      >
        <colgroup>
          <col style={{ width: "60px" }} />
          <col style={{ width: "220px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "140px" }} />
        </colgroup>
        <thead>
          <tr
            className={`bg-gradient-to-r ${tabConfig.headerGradient} text-white`}
          >
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-center border-r border-white/10 last:border-r-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.length > 0 ? (
            data.map((item, index) => {
              const seconds = item.Duration_Seconds || 0;
              const isLong = seconds > 600;
              const rowBg = isLong
                ? "bg-red-50/40"
                : index % 2 === 0
                  ? "bg-white"
                  : tabConfig.lightBg || "bg-gray-50/60";

              return (
                <tr
                  key={index}
                  className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/50`}
                >
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-[10px] font-bold text-gray-700">
                      {item.Sr_No || index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-left">
                    <div className="flex items-center gap-2">
                      <FiMapPin
                        size={12}
                        className={isLong ? "text-red-500" : "text-gray-400"}
                      />
                      <span className="text-xs font-semibold text-gray-800">
                        {item.Station_Name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="text-xs text-gray-600 font-medium">
                      {item.Date}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200">
                      <FiStopCircle size={10} />
                      {item.Stop_Time}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <FiPlay size={10} />
                      {item.Start_Time}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <DurationBadge duration={item.Duration} seconds={seconds} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={headers.length}>
                <EmptyState message="No detail data found for the selected filters." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Placeholder ────────────────────────────────────────────────
function QueryPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
        <FiActivity size={36} className="text-indigo-300" />
      </div>
      <p className="text-lg font-bold text-gray-500">Stop & Loss Report</p>
      <p className="text-sm mt-1.5 text-gray-400 text-center">
        Select date range and location, then click{" "}
        <span className="font-semibold text-indigo-500">Query</span> to view the
        report.
      </p>
    </div>
  );
}

function StopLossReport() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState([]);

  const [activeTab, setActiveTab] = useState(INNER_TABS[0].key);
  const [queried, setQueried] = useState(false);

  // ─── Data Cache ─────────────────────────────────────────────
  const [tabCache, setTabCache] = useState({
    summary: { data: [], loading: false, fetched: false },
    detail: { data: [], loading: false, fetched: false },
  });

  // ─── Fetch Locations on Mount ───────────────────────────────
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get(`${baseURL}prod/stop-loss/locations`);
        setLocations(res?.data?.data || []);
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      }
    };
    fetchLocations();
  }, []);

  // ─── Fetch Tab Data ─────────────────────────────────────────
  const fetchTabData = useCallback(
    async (tabKey) => {
      const endpoint =
        tabKey === "summary"
          ? "prod/stop-loss/summary"
          : "prod/stop-loss/detail";

      setTabCache((prev) => ({
        ...prev,
        [tabKey]: { ...prev[tabKey], loading: true },
      }));

      try {
        const res = await axios.get(`${baseURL}${endpoint}`, {
          params: { fromDate, toDate, location },
        });

        const data = res?.data?.data || [];

        setTabCache((prev) => ({
          ...prev,
          [tabKey]: { data, loading: false, fetched: true },
        }));
      } catch (error) {
        console.error(`Failed to fetch ${tabKey}:`, error);
        toast.error(`Failed to fetch ${tabKey} data.`);

        setTabCache((prev) => ({
          ...prev,
          [tabKey]: { ...prev[tabKey], loading: false },
        }));
      }
    },
    [fromDate, toDate, location],
  );

  // ─── Handle Query ───────────────────────────────────────────
  const handleQuery = async () => {
    if (!fromDate || !toDate) {
      toast.error("Please select From Date and To Date.");
      return;
    }
    if (!location) {
      toast.error("Please select a Location.");
      return;
    }

    // Reset cache
    setTabCache({
      summary: { data: [], loading: false, fetched: false },
      detail: { data: [], loading: false, fetched: false },
    });

    setQueried(true);
    await fetchTabData(activeTab);
  };

  // ─── Handle Tab Switch ──────────────────────────────────────
  const handleTabSwitch = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);
      if (queried && !tabCache[tabKey].fetched && !tabCache[tabKey].loading) {
        fetchTabData(tabKey);
      }
    },
    [queried, tabCache, fetchTabData],
  );

  // ─── Handle Reset ───────────────────────────────────────────
  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setLocation("");
    setQueried(false);
    setActiveTab(INNER_TABS[0].key);
    setTabCache({
      summary: { data: [], loading: false, fetched: false },
      detail: { data: [], loading: false, fetched: false },
    });
  };

  const currentCache = tabCache[activeTab];
  const currentTab = INNER_TABS.find((t) => t.key === activeTab);

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Stop Loss Report" align="center" />

      {/* ─── Filters ───────────────────────────────────────── */}
      <div className="w-full rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100 mt-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* From Date */}
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              From Date & Time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                           focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                           focus:bg-white outline-none transition-all duration-200"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          </div>

          {/* To Date */}
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              To Date & Time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                           focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                           focus:bg-white outline-none transition-all duration-200"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* Location */}
          <div className="min-w-[220px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Location
            </label>
            <div className="relative">
              <select
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                           appearance-none cursor-pointer
                           focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                           focus:bg-white outline-none transition-all duration-200"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">Select Location</option>
                {locations.map((loc, i) => (
                  <option key={i} value={loc.Location}>
                    {loc.Location}
                  </option>
                ))}
              </select>
              <FiMapPin
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleQuery}
              disabled={currentCache.loading}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold
                         text-white shadow-sm transition-all duration-200 cursor-pointer
                         ${
                           currentCache.loading
                             ? "bg-gray-400 cursor-not-allowed shadow-none"
                             : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 hover:shadow-md hover:shadow-indigo-200 active:scale-[0.97]"
                         }`}
            >
              {currentCache.loading ? (
                <>
                  <AiOutlineLoading3Quarters
                    size={14}
                    className="animate-spin"
                  />
                  Searching…
                </>
              ) : (
                <>
                  <FiSearch size={14} />
                  Query
                </>
              )}
            </button>

            {queried && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-4 py-2.5 text-sm font-medium text-gray-600
                           hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800
                           transition-all duration-200 active:scale-[0.97] cursor-pointer"
              >
                <FiRotateCcw size={13} />
                Reset
              </button>
            )}
          </div>

          {/* Filter Info Badge */}
          {queried && location && (
            <div
              className="ml-auto flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50
                            border border-indigo-200/60 px-4 py-2.5 shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FiMapPin size={15} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest leading-none">
                  Location
                </p>
                <p className="text-sm font-bold text-indigo-700 mt-0.5">
                  {location}
                </p>
              </div>
              <div className="w-px h-8 bg-indigo-200/60" />
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FiCalendar size={15} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest leading-none">
                  Period
                </p>
                <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                  {fromDate?.replace("T", " ")} → {toDate?.replace("T", " ")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Tabs + Report ─────────────────────────────────── */}
      <div className="w-full rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden mt-5">
        {/* Tab Bar */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4">
          <div className="flex gap-1 pt-2">
            {INNER_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              const cache = tabCache[tab.key];
              const count = cache.fetched ? cache.data.length : null;
              const isLoading = cache.loading;

              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabSwitch(tab.key)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium
                             whitespace-nowrap rounded-t-xl transition-all duration-200 cursor-pointer
                    ${
                      isActive
                        ? `${tab.activeBg} ${tab.activeText} border-t-2 border-x ${tab.activeBorder} border-x-gray-100 -mb-[1px] shadow-sm`
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/70"
                    }`}
                >
                  <span
                    className={`transition-colors ${isActive ? tab.iconActive : "text-gray-400"}`}
                  >
                    {isLoading ? (
                      <AiOutlineLoading3Quarters
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <TabIcon size={16} />
                    )}
                  </span>
                  {tab.label}
                  {count != null && (
                    <span
                      className={`ml-1 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5
                                      rounded-full text-[10px] font-bold transition-colors
                                      ${isActive ? `${tab.activeBg} ${tab.activeText}` : "bg-gray-200 text-gray-500"}`}
                    >
                      {count}
                    </span>
                  )}
                  {cache.fetched && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Export */}
          {queried && currentCache.fetched && currentCache.data.length > 0 && (
            <ExportButton
              data={currentCache.data}
              filename={`Stop_Loss_${activeTab === "summary" ? "Summary" : "Detail"}_Report`}
            />
          )}
        </div>

        {/* Content Area */}
        <div className="p-5">
          {!queried ? (
            <QueryPlaceholder />
          ) : currentCache.loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader />
              <p className="mt-4 text-sm text-gray-400 animate-pulse flex items-center gap-2">
                <AiOutlineLoading3Quarters size={13} className="animate-spin" />
                Fetching {currentTab.label}…
              </p>
            </div>
          ) : currentCache.fetched ? (
            <div className="animate-fadeIn">
              {activeTab === "summary" ? (
                <SummaryTable data={currentCache.data} tabConfig={currentTab} />
              ) : (
                <DetailTable data={currentCache.data} tabConfig={currentTab} />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <AiOutlineLoading3Quarters
                size={24}
                className="animate-spin mb-3"
              />
              <p className="text-sm">Loading {currentTab.label}…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {queried && currentCache.fetched && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <MdOutlineTableChart size={14} />
              Showing{" "}
              <span className="font-bold text-gray-600">
                {currentCache.data.length}
              </span>{" "}
              record{currentCache.data.length !== 1 && "s"}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {Object.values(tabCache).filter((c) => c.fetched).length}/
                {INNER_TABS.length} tabs loaded
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <FiMapPin size={12} />
                {location}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StopLossReport;
