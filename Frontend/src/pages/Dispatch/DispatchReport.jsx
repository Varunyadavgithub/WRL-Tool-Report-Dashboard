import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import DateTimePicker from "../../components/ui/DateTimePicker";
import SelectField from "../../components/ui/SelectField";
import ExportButton from "../../components/ui/ExportButton";

import { FiSearch, FiXCircle, FiTruck } from "react-icons/fi";
import { BsCalendarDay, BsCalendarCheck, BsCalendarRange } from "react-icons/bs";
import { TbFilterOff, TbNotes } from "react-icons/tb";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { RiBarChartBoxLine } from "react-icons/ri";
import { MdOutlineLocalShipping } from "react-icons/md";
import { HiOutlineIdentification } from "react-icons/hi";

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <AiOutlineLoading3Quarters
    size={size}
    className="animate-spin text-blue-400 inline-block"
  />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-50 border-blue-200 text-blue-500 [&_span]:text-blue-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-500 [&_span]:text-emerald-700",
  };
  return (
    <div className={`flex flex-col gap-0.5 px-5 py-3 rounded-xl border ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-widest font-semibold">{label}</p>
      <span className="text-2xl font-black tabular-nums">{value ?? "—"}</span>
    </div>
  );
};

const DispatchReport = () => {
  const Status = [
    { label: "Completed", value: "completed" },
    { label: "Open", value: "open" },
  ];

  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState(Status[0]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [fgDispatchData, setFgDispatchData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSessionID, setSelectedSessionID] = useState(null);

  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const fetchFgDispatchData = async (pageNumber = 1) => {
    if (!startTime || !endTime || !status) {
      toast.error("Please select Time Range and Status.");
      return;
    }
    try {
      setLoading(true);
      if (pageNumber === 1) {
        setFgDispatchData([]);
        setTotalCount(0);
      }
      const res = await axios.get(`${baseURL}dispatch/fg-dispatch`, {
        params: {
          startDate: startTime,
          endDate: endTime,
          status: status.value,
          page: pageNumber,
          limit,
        },
      });
      if (res?.data?.success) {
        setFgDispatchData((prev) =>
          pageNumber === 1 ? res.data.data : [...prev, ...res.data.data]
        );
        if (pageNumber === 1) setTotalCount(res.data.totalCount);
        setHasMore(res.data.data.length === limit);
      }
    } catch {
      toast.error("Failed to fetch FG Dispatch data.");
    } finally {
      setLoading(false);
    }
  };

  const aggregateFgDispatchData = () => {
    const agg = {};
    fgDispatchData.forEach(({ Session_ID }) => {
      if (!Session_ID) return;
      if (!agg[Session_ID]) agg[Session_ID] = { count: 1 };
      else agg[Session_ID].count += 1;
    });
    return Object.entries(agg).map(([Session_ID, d]) => ({
      Session_ID,
      TotalCount: d.count,
    }));
  };

  useEffect(() => {
    if (page === 1) return;
    fetchFgDispatchData(page);
  }, [page]);

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const runQuickFilter = async (type) => {
    const now = new Date();
    const today8 = new Date(now);
    today8.setHours(8, 0, 0, 0);

    let start, end;
    if (type === "yday") {
      const y8 = new Date(today8);
      y8.setDate(y8.getDate() - 1);
      start = fmt(y8);
      end = fmt(today8);
    } else if (type === "tday") {
      start = fmt(today8);
      end = fmt(now);
    } else {
      const som = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
      start = fmt(som);
      end = fmt(now);
    }

    const setters = { yday: setYdayLoading, tday: setTodayLoading, mtd: setMonthLoading };
    try {
      setters[type](true);
      setFgDispatchData([]);
      setTotalCount(0);
      setSelectedSessionID(null);
      const res = await axios.get(`${baseURL}dispatch/quick-fg-dispatch`, {
        params: { startDate: start, endDate: end, status: status.value },
      });
      if (res?.data?.success) {
        setFgDispatchData(res.data.data);
        setTotalCount(res.data.totalCount);
      }
    } catch {
      toast.error(`Failed to fetch ${type.toUpperCase()} data.`);
    } finally {
      setters[type](false);
    }
  };

  const handleQuery = () => {
    setPage(1);
    setSelectedSessionID(null);
    fetchFgDispatchData(1);
  };

  const anyLoading = ydayLoading || todayLoading || monthLoading;

  const filteredData = selectedSessionID
    ? fgDispatchData.filter((i) => i.Session_ID === selectedSessionID)
    : fgDispatchData;

  const aggregated = aggregateFgDispatchData();

  const isCompleted = status.value === "completed";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600">
          <MdOutlineLocalShipping size={22} />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-800 leading-none">
            Dispatch Report
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">FG dispatch tracking by session</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {totalCount > 0 && (
            <StatCard label="Total Records" value={totalCount} color={isCompleted ? "green" : "blue"} />
          )}
          {/* Status Badge */}
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${
              isCompleted
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-amber-50 text-amber-600 border-amber-200"
            }`}
          >
            {status.label}
          </span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* ── Filter Bar ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
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
            <div className="min-w-[130px]">
              <SelectField
                label="Status"
                options={Status}
                value={status.value}
                onChange={(e) => {
                  const selected = Status.find((s) => s.value === e.target.value);
                  setStatus(selected);
                }}
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

            {fgDispatchData.length > 0 && <ExportButton data={fgDispatchData} />}

            {/* Divider */}
            <div className="hidden md:block w-px h-9 bg-slate-200 mx-1" />

            {/* Quick Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Quick
              </span>
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
        </div>

        {/* ── Active Session Filter Banner ── */}
        {selectedSessionID && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-semibold">
            <HiOutlineIdentification size={16} />
            Filtering by session:&nbsp;
            <span className="font-black font-mono">{selectedSessionID}</span>
            <span className="mx-1 text-blue-300">|</span>
            <span className="text-blue-500 font-medium">{filteredData.length} records shown</span>
            <button
              onClick={() => setSelectedSessionID(null)}
              className="ml-auto flex items-center gap-1 text-xs text-blue-400 hover:text-blue-800 font-bold transition-colors cursor-pointer"
            >
              <TbFilterOff size={14} /> Clear
            </button>
          </div>
        )}

        {/* ── Tables Row ── */}
        <div className="flex gap-4 items-start">
          {/* Dispatch Records Table */}
          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <FiTruck size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Dispatch Records
              </span>
              {filteredData.length > 0 && (
                <span className="ml-auto bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                  {filteredData.length.toLocaleString()}
                </span>
              )}
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                  <tr>
                    {[
                      "#",
                      "Model Name",
                      "FG Serial No.",
                      "Asset Code",
                      "Session ID",
                      "Added On",
                      "Added By",
                      "Document ID",
                      "Model Code",
                      "Dock No.",
                      "Vehicle No.",
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
                  {filteredData.map((item, index) => {
                    const isLast = index === filteredData.length - 1;
                    return (
                      <tr
                        key={index}
                        ref={isLast ? lastRowRef : null}
                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-3 py-2 text-slate-300 tabular-nums select-none">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                          {item.ModelName}
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-mono whitespace-nowrap">
                          {item.FGSerialNo}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">
                          {item.AssetCode}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`font-mono font-semibold ${
                              selectedSessionID === item.Session_ID
                                ? "text-blue-600"
                                : "text-slate-600"
                            }`}
                          >
                            {item.Session_ID}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono">
                          {item.AddedOn?.replace("T", " ").replace("Z", "")}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {item.AddedBy}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono">
                          {item.Document_ID}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {item.ModelCode}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {item.DockNo}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {item.Vehicle_No}
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && fgDispatchData.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-20 text-center">
                        <FiTruck size={36} className="mx-auto mb-3 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-300">No records found</p>
                        <p className="text-xs text-slate-300 mt-1">
                          Select a time range, status, and click Query
                        </p>
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

          {/* Session Summary Panel */}
          <div className="w-[240px] flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <RiBarChartBoxLine size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                By Session
              </span>
              {aggregated.length > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  {selectedSessionID && (
                    <button
                      onClick={() => setSelectedSessionID(null)}
                      title="Clear filter"
                      className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <FiXCircle size={14} />
                    </button>
                  )}
                  <ExportButton
                    fetchData={aggregateFgDispatchData}
                    filename="Dispatch_Report"
                  />
                </div>
              )}
            </div>
            <div className="max-h-[560px] overflow-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 text-sm">
                  <Spinner size={22} />
                  <span>Calculating…</span>
                </div>
              ) : aggregated.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-white border-b border-slate-100">
                    <tr>
                      {["Session ID", "Qty"].map((h) => (
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
                    {aggregated.map((item, index) => {
                      const isSelected = selectedSessionID === item.Session_ID;
                      return (
                        <tr
                          key={index}
                          onClick={() =>
                            setSelectedSessionID(isSelected ? null : item.Session_ID)
                          }
                          className={`border-b border-slate-50 cursor-pointer transition-all ${
                            isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <td
                            className={`px-3 py-2.5 font-mono font-semibold whitespace-nowrap ${
                              isSelected ? "text-blue-700" : "text-slate-600"
                            }`}
                          >
                            {isSelected && (
                              <span className="inline-block w-1 h-1 rounded-full bg-blue-400 mr-1.5 mb-0.5" />
                            )}
                            {item.Session_ID}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-xs font-black tabular-nums ${
                                isSelected
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.TotalCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-200">
                  <TbNotes size={36} className="mb-3" />
                  <p className="text-sm font-semibold text-slate-300">No summary yet</p>
                  <p className="text-xs text-slate-300 mt-1">Run a query to see sessions</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchReport;