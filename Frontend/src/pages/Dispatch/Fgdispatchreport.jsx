import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch, FiCalendar, FiFilter, FiRefreshCw, FiInbox,
  FiHash, FiAlertTriangle, FiCheckCircle, FiClock, FiList,
  FiBarChart2, FiX, FiLoader, FiChevronDown, FiTruck,
  FiPackage, FiTag, FiZap, FiAnchor, FiMonitor, FiGrid,
  FiActivity, FiMapPin, FiLayers, FiArrowRight,
} from "react-icons/fi";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";

// -- helpers -------------------------------------------------------------------
const pad = (n) => (n < 10 ? "0" + n : n);
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fmtDisplay = (v) =>
  v ? String(v).replace("T", " ").replace("Z", "").slice(0, 16) : "—";

const SCAN_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Label Printed", value: "label" },
  { label: "Auto Scanned", value: "auto" },
  { label: "Missing Label", value: "missing_label" },
  { label: "Missing Auto Scan", value: "missing_auto" },
];

const SUMMARY_GROUP_OPTIONS = [
  { label: "Vehicle No", value: "Vehicle_No" },
  { label: "Dock No", value: "DockNo" },
  { label: "Material Name", value: "MaterialName" },
  { label: "FG Label Printing", value: "FG_LabelPrinting" },
  { label: "FG Auto Scan", value: "FG_Auto_Scan" },
  { label: "Session ID", value: "Session_ID" },
];

// -- Sub-components ------------------------------------------------------------
const ScanBadge = ({ status }) => {
  const ok = status === "SCANNED";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
         : "bg-red-50 text-red-500 border border-red-200"
    }`}>
      {ok ? <FiCheckCircle size={9} /> : <FiX size={9} />}
      {ok ? "Scanned" : "Not Scanned"}
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

// -- Pipeline Step -------------------------------------------------------------
const PipelineBar = ({ label, scanned, total, icon: Icon, color }) => {
  const pct = total ? Math.round((scanned / total) * 100) : 0;
  const barColors = {
    blue:    "bg-blue-500",
    emerald: "bg-emerald-500",
    violet:  "bg-violet-500",
  };
  const textColors = {
    blue:    "text-blue-600",
    emerald: "text-emerald-600",
    violet:  "text-violet-600",
  };
  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={textColors[color]} />
        <p className="text-xs font-semibold text-gray-600 tracking-wide uppercase">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${textColors[color]} mb-1`}>{pct}%</p>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${barColors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">{scanned} / {total} units</p>
    </div>
  );
};

// -- Main Component ------------------------------------------------------------
const FGDispatchReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [data, setData] = useState([]);
  const [scanFilter, setScanFilter] = useState(SCAN_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("table");
  const [groupBy, setGroupBy] = useState(SUMMARY_GROUP_OPTIONS[0]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // -- fetch -----------------------------------------------------------------
  const fetchData = async (startDate, endDate, loaderFn) => {
    loaderFn(true);
    setData([]);
    try {
      const res = await axios.get(`${baseURL}dispatch/fg-dispatch-report`, {
        params: { startDate, endDate },
      });
      if (res?.data?.success) setData(res.data.data);
    } catch {
      toast.error("Failed to fetch FG Dispatch Report.");
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
    const t8 = new Date(now); t8.setHours(8, 0, 0, 0);
    const y8 = new Date(t8); y8.setDate(t8.getDate() - 1);
    fetchData(fmt(y8), fmt(t8), setYdayLoading);
  };

  const handleToday = () => {
    const now = new Date();
    const t8 = new Date(now); t8.setHours(8, 0, 0, 0);
    fetchData(fmt(t8), fmt(now), setTodayLoading);
  };

  const handleMTD = () => {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    fetchData(fmt(s), fmt(now), setMonthLoading);
  };

  const handleClear = () => {
    setStartTime(""); setEndTime(""); setData([]);
    setScanFilter(SCAN_OPTIONS[0]); setSearchTerm("");
    setGroupBy(SUMMARY_GROUP_OPTIONS[0]);
  };

  // -- derived stats ---------------------------------------------------------
  const stats = useMemo(() => {
    const total = data.length;
    const labelScanned = data.filter(r => r.FG_LabelPrinting === "SCANNED").length;
    const autoScanned  = data.filter(r => r.FG_Auto_Scan === "SCANNED").length;
    const vehicles     = new Set(data.map(r => r.Vehicle_No).filter(Boolean)).size;
    const docks        = new Set(data.map(r => r.DockNo).filter(Boolean)).size;
    const sessions     = new Set(data.map(r => r.Session_ID).filter(Boolean)).size;
    return { total, labelScanned, autoScanned, vehicles, docks, sessions };
  }, [data]);

  // -- filter ----------------------------------------------------------------
  const filteredData = useMemo(() => {
    let d = data;
    if (scanFilter.value === "label")         d = d.filter(r => r.FG_LabelPrinting === "SCANNED");
    else if (scanFilter.value === "auto")     d = d.filter(r => r.FG_Auto_Scan === "SCANNED");
    else if (scanFilter.value === "missing_label") d = d.filter(r => r.FG_LabelPrinting !== "SCANNED");
    else if (scanFilter.value === "missing_auto")  d = d.filter(r => r.FG_Auto_Scan !== "SCANNED");

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      d = d.filter(r =>
        [r.FGSerialNo, r.MaterialName, r.Vehicle_No, r.DocNo, r.Session_ID]
          .some(v => v?.toString().toLowerCase().includes(s))
      );
    }
    return d;
  }, [data, scanFilter, debouncedSearch]);

  // -- grouped summary -------------------------------------------------------
  const groupedData = useMemo(() => {
    if (!data.length) return [];
    const map = data.reduce((acc, item) => {
      const key = item[groupBy.value] ?? "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(map)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }, [data, groupBy]);

  const anyLoading = loading || ydayLoading || todayLoading || monthLoading;

  return (
    <div
      className="min-h-screen bg-gray-50 text-gray-800 p-5"
      style={{ fontFamily: "'DM Mono', 'Courier New', monospace" }}
    >
      {/* -- Header -- */}
      <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs tracking-[0.3em] text-gray-400 uppercase mb-1">
            Dispatch · FG Tracking
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <FiTruck className="text-blue-500" size={22} />
            FG Dispatch Report
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">Total Unloaded</p>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </div>
      </div>

      {/* -- Filter Row -- */}
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
              <input type="datetime-local" value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiCalendar size={11} /> End Time
              </label>
              <input type="datetime-local" value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FiFilter size={11} /> Scan Status
              </label>
              <div className="relative">
                <select value={scanFilter.value}
                  onChange={e => setScanFilter(SCAN_OPTIONS.find(o => o.value === e.target.value))}
                  className="w-full appearance-none px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all pr-8">
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
                <input type="text" placeholder="Serial, Material, Vehicle, Doc…"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <FiX size={13} />
                  </button>
                )}
              </div>
            </div>
            <button onClick={handleQuery} disabled={anyLoading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
              {loading ? <FiLoader size={13} className="animate-spin" /> : <FiSearch size={13} />}
              Query
            </button>
            <ExportButton data={filteredData} filename="fg_dispatch_report" />
            <button onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-300 text-gray-400 hover:text-red-500 text-sm transition-all flex items-center gap-1.5">
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

      {/* -- KPI Cards -- */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <StatCard icon={FiPackage}      label="Total Units"    value={stats.total}        color="blue" />
          <StatCard icon={FiTag}          label="Label Printed"  value={stats.labelScanned}
            sub={`${Math.round((stats.labelScanned / stats.total) * 100)}%`} color="violet" />
          <StatCard icon={FiZap}          label="Auto Scanned"   value={stats.autoScanned}
            sub={`${Math.round((stats.autoScanned / stats.total) * 100)}%`}  color="emerald" />
          <StatCard icon={FiTruck}        label="Vehicles"       value={stats.vehicles}     color="amber" />
          <StatCard icon={FiMapPin}       label="Docks Used"     value={stats.docks}        color="red" />
          <StatCard icon={FiLayers}       label="Sessions"       value={stats.sessions}     color="gray" />
        </div>
      )}

      {/* -- Pipeline Progress -- */}
      {stats.total > 0 && (
        <div className="mb-4">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-3 flex items-center gap-2">
            <FiActivity size={12} /> Scanning Pipeline
          </p>
          <div className="flex gap-3 items-stretch">
            <PipelineBar label="FG Label Printing" scanned={stats.labelScanned} total={stats.total} icon={FiTag}     color="blue" />
            <div className="flex items-center text-gray-300 self-center"><FiArrowRight size={18} /></div>
            <PipelineBar label="FG Auto Scan"       scanned={stats.autoScanned}  total={stats.total} icon={FiZap}     color="emerald" />
            <div className="flex items-center text-gray-300 self-center"><FiArrowRight size={18} /></div>
            <PipelineBar label="FG Unloading"       scanned={stats.total}        total={stats.total} icon={FiAnchor}  color="violet" />
          </div>
        </div>
      )}

      {/* -- Tab Bar -- */}
      <div className="flex items-center gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        {[
          { key: "table",   label: "Detail View",  icon: FiList },
          { key: "summary", label: "Summary",      icon: FiBarChart2 },
          { key: "vehicle", label: "By Vehicle",   icon: FiTruck },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              activeTab === key
                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                : "text-gray-400 hover:text-gray-700"
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
        {filteredData.length > 0 && (
          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-200">
            {filteredData.length} rows
          </span>
        )}
      </div>

      {/* -- Detail Table -- */}
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
                      ["#", FiHash], ["FG Serial No", FiPackage], ["Material Name", FiGrid],
                      ["Doc No", FiMonitor], ["Label Print", FiTag], ["Label Date", FiCalendar],
                      ["Auto Scan", FiZap], ["Auto Scan Date", FiCalendar],
                      ["Unloading", FiAnchor], ["Unloading Date", FiCalendar],
                      ["Session ID", FiLayers], ["Vehicle No", FiTruck],
                      ["Dock No", FiMapPin], ["Vehicle Entry", FiClock],
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
                        <span className="font-mono text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                          {row.FGSerialNo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap max-w-[160px] truncate" title={row.MaterialName}>
                        {row.MaterialName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono">{row.DocNo}</td>
                      <td className="px-4 py-2.5"><ScanBadge status={row.FG_LabelPrinting} /></td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDisplay(row.FG_LabelPrinting_Date)}</td>
                      <td className="px-4 py-2.5"><ScanBadge status={row.FG_Auto_Scan} /></td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDisplay(row.FG_Auto_Scan_Date)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <FiCheckCircle size={9} /> Scanned
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDisplay(row.FG_Unloading_Date)}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono">{row.Session_ID || "—"}</td>
                      <td className="px-4 py-2.5">
                        {row.Vehicle_No ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                            <FiTruck size={9} /> {row.Vehicle_No}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.DockNo != null ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-semibold text-xs bg-violet-50 text-violet-600 border border-violet-200">
                            D{row.DockNo}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDisplay(row.Vehicle_Entry_Time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* -- Summary Tab -- */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm lg:col-span-1">
            <p className="text-xs tracking-widest text-gray-400 uppercase mb-4 flex items-center gap-2">
              <FiBarChart2 size={12} /> Group By
            </p>
            <div className="flex flex-col gap-2">
              {SUMMARY_GROUP_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setGroupBy(opt)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all flex items-center justify-between ${
                    groupBy.value === opt.value
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}>
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
              <ExportButton data={groupedData} filename="fg_dispatch_summary" />
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
                      <th className="px-5 py-3 text-right font-medium">Count</th>
                      <th className="px-5 py-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((item, i) => {
                      const pct = stats.total ? Math.round((item.count / stats.total) * 100) : 0;
                      return (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 rounded-full bg-blue-400"
                                style={{ width: `${Math.max(pct, 4)}%`, maxWidth: "100px" }} />
                              <span className="text-gray-700 text-xs font-medium truncate max-w-[200px]" title={item.key}>
                                {item.key}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">{item.count}</td>
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

      {/* -- By Vehicle Tab -- */}
      {activeTab === "vehicle" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs tracking-widest text-gray-400 uppercase flex items-center gap-2">
              <FiTruck size={12} /> Vehicle-wise Dispatch Summary
            </p>
          </div>
          <div className="max-h-[540px] overflow-auto">
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-300 select-none">
                <FiInbox size={40} />
                <p className="text-sm text-gray-400">No data loaded</p>
              </div>
            ) : (() => {
              // Build per-vehicle summary
              const vehicleMap = {};
              data.forEach(r => {
                const v = r.Vehicle_No || "Unknown";
                if (!vehicleMap[v]) vehicleMap[v] = {
                  Vehicle_No: v, Session_ID: r.Session_ID, DockNo: r.DockNo,
                  Vehicle_Entry_Time: r.Vehicle_Entry_Time,
                  total: 0, labelOk: 0, autoOk: 0,
                };
                vehicleMap[v].total++;
                if (r.FG_LabelPrinting === "SCANNED") vehicleMap[v].labelOk++;
                if (r.FG_Auto_Scan === "SCANNED")     vehicleMap[v].autoOk++;
              });
              const rows = Object.values(vehicleMap).sort((a, b) => b.total - a.total);
              return (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                      {["#", "Vehicle No", "Session ID", "Dock", "Entry Time",
                        "Units Unloaded", "Label Printed", "Auto Scanned", "Label %", "Auto %"
                      ].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const lPct = Math.round((r.labelOk / r.total) * 100);
                      const aPct = Math.round((r.autoOk  / r.total) * 100);
                      return (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                              <FiTruck size={9} /> {r.Vehicle_No}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-gray-500">{r.Session_ID || "—"}</td>
                          <td className="px-4 py-2.5 text-center">
                            {r.DockNo != null ? (
                              <span className="inline-block px-2 py-0.5 rounded-md font-semibold text-xs bg-violet-50 text-violet-600 border border-violet-200">
                                D{r.DockNo}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDisplay(r.Vehicle_Entry_Time)}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-blue-600">{r.total}</td>
                          <td className="px-4 py-2.5 text-center text-emerald-600 font-medium">{r.labelOk}</td>
                          <td className="px-4 py-2.5 text-center text-violet-600 font-medium">{r.autoOk}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${lPct}%` }} />
                              </div>
                              <span className={`text-xs font-semibold w-9 text-right ${lPct < 80 ? "text-red-500" : "text-emerald-600"}`}>
                                {lPct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${aPct}%` }} />
                              </div>
                              <span className={`text-xs font-semibold w-9 text-right ${aPct < 80 ? "text-red-500" : "text-emerald-600"}`}>
                                {aPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default FGDispatchReport;