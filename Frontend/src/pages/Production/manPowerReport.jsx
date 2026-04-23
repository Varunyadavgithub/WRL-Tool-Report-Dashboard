import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch, FiCalendar, FiFilter, FiInbox,
  FiHash, FiClock, FiList, FiBarChart2,
  FiX, FiLoader, FiChevronDown, FiUsers,
  FiUser, FiMapPin, FiLayers, FiCheckCircle,
  FiAlertCircle, FiBriefcase, FiActivity,
} from "react-icons/fi";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";

// ── helpers ───────────────────────────────────────────────────────────────────
const pad = (n) => (n < 10 ? "0" + n : n);
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fmtDisplay = (v) =>
  v ? String(v).replace("T", " ").replace("Z", "").slice(0, 16) : "—";

const SCAN_OPTIONS = [
  { label: "All Workmen",       value: "all"     },
  { label: "Currently Inside",  value: "inside"  },
  { label: "Checked Out",       value: "out"     },
];

const SUMMARY_GROUP_OPTIONS = [
  { label: "Contractor",  value: "Contractor"  },
  { label: "Department",  value: "Department"  },
  { label: "Shift",       value: "Shift"       },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const StatusBadge = ({ outTime }) => {
  const inside = !outTime;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      inside
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-gray-100 text-gray-500 border border-gray-200"
    }`}>
      {inside
        ? <><FiCheckCircle size={9} /> Inside</>
        : <><FiAlertCircle size={9} /> Checked Out</>
      }
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => {
  const colors = {
    blue:    "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber:   "bg-amber-50 text-amber-600 border-amber-100",
    red:     "bg-red-50 text-red-600 border-red-100",
    violet:  "bg-violet-50 text-violet-600 border-violet-100",
    gray:    "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-start gap-3">
      <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-gray-400 tracking-wide uppercase">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const QuickBtn = ({ label, onClick, loading, color }) => {
  const colors = {
    yellow: "bg-amber-500 hover:bg-amber-400 shadow-amber-200",
    blue:   "bg-blue-500 hover:bg-blue-400 shadow-blue-200",
    green:  "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-5 py-2 rounded-lg text-white text-sm font-bold tracking-wide transition-all active:scale-95 disabled:opacity-50 shadow-md flex items-center gap-2 ${colors[color]}`}
    >
      {loading ? <FiLoader size={13} className="animate-spin" /> : <FiClock size={13} />}
      {label}
    </button>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const ManpowerReport = () => {
  const [loading,      setLoading]      = useState(false);
  const [ydayLoading,  setYdayLoading]  = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [startTime,   setStartTime]   = useState("");
  const [endTime,     setEndTime]     = useState("");
  const [data,        setData]        = useState([]);
  const [scanFilter,  setScanFilter]  = useState(SCAN_OPTIONS[0]);
  const [searchTerm,  setSearchTerm]  = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab,   setActiveTab]   = useState("table");
  const [groupBy,     setGroupBy]     = useState(SUMMARY_GROUP_OPTIONS[0]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async (startDate, endDate, loaderFn) => {
    loaderFn(true);
    setData([]);
    try {
      const res = await axios.get(`${baseURL}prod/manpower-report`, {
        params: { startDate, endDate },
      });
      if (res?.data?.success) setData(res.data.data);
    } catch {
      toast.error("Failed to fetch Manpower Report.");
    } finally {
      loaderFn(false);
    }
  };

  const handleQuery = () => {
    if (!startTime || !endTime) return toast.error("Please select Start and End time.");
    fetchData(startTime, endTime, setLoading);
  };

  const handleYesterday = () => {
    const now = new Date();
    const t8  = new Date(now); t8.setHours(7, 0, 0, 0);
    const y8  = new Date(t8);  y8.setDate(t8.getDate() - 1);
    fetchData(fmt(y8), fmt(t8), setYdayLoading);
  };

  const handleToday = () => {
    const now = new Date();
    const t8  = new Date(now); t8.setHours(7, 0, 0, 0);
    fetchData(fmt(t8), fmt(now), setTodayLoading);
  };

  const handleMTD = () => {
    const now = new Date();
    const s   = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    fetchData(fmt(s), fmt(now), setMonthLoading);
  };

  const handleClear = () => {
    setStartTime(""); setEndTime(""); setData([]);
    setScanFilter(SCAN_OPTIONS[0]); setSearchTerm("");
    setGroupBy(SUMMARY_GROUP_OPTIONS[0]);
  };

  // ── derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total       = data.length;
    const inside      = data.filter(r => !r["Out Date Time"]).length;
    const checkedOut  = total - inside;
    const contractors = new Set(data.map(r => r.Contractor).filter(Boolean)).size;
    const departments = new Set(data.map(r => r.Department).filter(Boolean)).size;
    const shifts      = new Set(data.map(r => r.Shift).filter(Boolean)).size;
    return { total, inside, checkedOut, contractors, departments, shifts };
  }, [data]);

  // ── filter ─────────────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let d = data;
    if      (scanFilter.value === "inside") d = d.filter(r => !r["Out Date Time"]);
    else if (scanFilter.value === "out")    d = d.filter(r =>  r["Out Date Time"]);

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      d = d.filter(r =>
        [r.Contractor, r["Workmen Name"], r.Department, r.Shift]
          .some(v => v?.toString().toLowerCase().includes(s))
      );
    }
    return d;
  }, [data, scanFilter, debouncedSearch]);

  // ── grouped summary ────────────────────────────────────────────────────────
  const groupedData = useMemo(() => {
    if (!data.length) return [];
    const map = data.reduce((acc, item) => {
      const key = item[groupBy.value] ?? "Unknown";
      if (!acc[key]) acc[key] = { key, total: 0, inside: 0 };
      acc[key].total++;
      if (!item["Out Date Time"]) acc[key].inside++;
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [data, groupBy]);

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
            Security · Manpower Tracking
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <FiUsers className="text-blue-500" size={22} />
            Manpower Report
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">Total Workmen</p>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
            <FiFilter size={12} /> Filters
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiCalendar size={11} /> Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiCalendar size={11} /> End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiFilter size={11} /> Status
              </label>
              <div className="relative">
                <select
                  value={scanFilter.value}
                  onChange={e => setScanFilter(SCAN_OPTIONS.find(o => o.value === e.target.value))}
                  className="w-full appearance-none px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all pr-8"
                >
                  {SCAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiSearch size={11} /> Search
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  placeholder="Contractor, Workmen, Dept, Shift…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
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
            <ExportButton data={filteredData} filename="manpower_report" />
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
            <QuickBtn label="Yesterday"     onClick={handleYesterday} loading={ydayLoading}  color="yellow" />
            <QuickBtn label="Today"         onClick={handleToday}     loading={todayLoading} color="blue"   />
            <QuickBtn label="Month to Date" onClick={handleMTD}       loading={monthLoading} color="green"  />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <StatCard icon={FiUsers}     label="Total Workmen"  value={stats.total}        color="blue"    />
          <StatCard icon={FiCheckCircle} label="Inside"       value={stats.inside}
            sub={`${Math.round((stats.inside / stats.total) * 100)}%`}                   color="emerald" />
          <StatCard icon={FiAlertCircle} label="Checked Out"  value={stats.checkedOut}
            sub={`${Math.round((stats.checkedOut / stats.total) * 100)}%`}               color="gray"    />
          <StatCard icon={FiBriefcase} label="Contractors"    value={stats.contractors}  color="amber"   />
          <StatCard icon={FiMapPin}    label="Departments"    value={stats.departments}  color="violet"  />
          <StatCard icon={FiActivity}  label="Shifts"         value={stats.shifts}       color="red"     />
        </div>
      )}

      {/* ── Presence bar ── */}
      {stats.total > 0 && (
        <div className="mb-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs tracking-widest text-gray-400 uppercase flex items-center gap-2">
              <FiActivity size={12} /> Presence Overview
            </p>
            <p className="text-xs text-gray-400">
              {stats.inside} inside · {stats.checkedOut} checked out
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${Math.round((stats.inside / stats.total) * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Inside ({Math.round((stats.inside / stats.total) * 100)}%)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />
              Checked Out ({Math.round((stats.checkedOut / stats.total) * 100)}%)
            </span>
          </div>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        {[
          { key: "table",   label: "Detail View", icon: FiList      },
          { key: "summary", label: "Summary",     icon: FiBarChart2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              activeTab === key
                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
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
                {filteredData.length} of {stats.total}
              </span>
            )}
          </div>
          <div className="max-h-[560px] overflow-auto">
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
                    {[
                      ["#",             FiHash       ],
                      ["Contractor",    FiBriefcase  ],
                      ["Workmen Name",  FiUser       ],
                      ["Department",    FiMapPin     ],
                      ["Shift",         FiLayers     ],
                      ["In Date Time",  FiCalendar   ],
                      ["Out Date Time", FiCalendar   ],
                      ["Status",        FiCheckCircle],
                    ].map(([h, Icon]) => (
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1"><Icon size={10} /> {h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>

                      <td className="px-4 py-2.5">
                        <span className="font-medium text-gray-700 text-xs max-w-[180px] truncate block" title={row.Contractor}>
                          {row.Contractor || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-medium">
                          <FiUser size={9} /> {row["Workmen Name"] || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {row.Department ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-md">
                            <FiMapPin size={9} /> {row.Department}
                          </span>
                        ) : "—"}
                      </td>

                      <td className="px-4 py-2.5 text-gray-500">
                        {row.Shift ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                            <FiLayers size={9} /> {row.Shift}
                          </span>
                        ) : "—"}
                      </td>

                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono">
                        {fmtDisplay(row["In Date Time"])}
                      </td>

                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono">
                        {fmtDisplay(row["Out Date Time"])}
                      </td>

                      <td className="px-4 py-2.5">
                        <StatusBadge outTime={row["Out Date Time"]} />
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
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm lg:col-span-1">
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
              <FiBarChart2 size={12} /> Group By
            </p>
            <div className="flex flex-col gap-2">
              {SUMMARY_GROUP_OPTIONS.map(opt => (
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
                      {groupedData.length} groups
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <ExportButton data={groupedData} filename="manpower_summary" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:col-span-2">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs tracking-widest text-gray-400 uppercase flex items-center gap-2">
                <FiBarChart2 size={12} /> {groupBy.label} Breakdown
              </p>
              {groupedData.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-200">
                  {groupedData.length} groups
                </span>
              )}
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {groupedData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300 select-none">
                  <FiInbox size={36} />
                  <p className="text-sm text-gray-400">No data to group</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-5 py-3 text-left font-medium w-10"><FiHash size={11} /></th>
                      <th className="px-5 py-3 text-left font-medium">{groupBy.label}</th>
                      <th className="px-5 py-3 text-right font-medium">Total</th>
                      <th className="px-5 py-3 text-right font-medium">Inside</th>
                      <th className="px-5 py-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((item, i) => {
                      const pct    = stats.total ? Math.round((item.total  / stats.total) * 100) : 0;
                      const insPct = item.total  ? Math.round((item.inside / item.total)  * 100) : 0;
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
                          <td className="px-5 py-3 text-right font-bold text-gray-900">{item.total}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`text-xs font-semibold ${insPct === 100 ? "text-emerald-600" : insPct > 50 ? "text-amber-500" : "text-red-500"}`}>
                              {item.inside} ({insPct}%)
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-gray-500">{pct}%</td>
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

export default ManpowerReport;