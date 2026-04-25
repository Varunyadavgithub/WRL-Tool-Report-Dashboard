import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";
import {
  Search,
  Loader2,
  PackageOpen,
  Calendar,
  Filter,
  X,
  Clock,
  List,
  BarChart3,
  Users,
  User,
  MapPin,
  Layers,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Activity,
  Hash,
  ChevronDown,
  Inbox,
  Zap,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────────
const pad = (n) => (n < 10 ? "0" + n : n);
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDisplay = (v) =>
  v ? String(v).replace("T", " ").replace("Z", "").slice(0, 16) : "—";

const SCAN_OPTIONS = [
  { label: "All Workmen", value: "all" },
  { label: "Currently Inside", value: "inside" },
  { label: "Checked Out", value: "out" },
];

const SUMMARY_GROUP_OPTIONS = [
  { label: "Contractor", value: "Contractor" },
  { label: "Department", value: "Department" },
  { label: "Shift", value: "Shift" },
];

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ── Quick filter button ── */
const QuickBtn = ({ label, sublabel, loading, onClick, colorClass }) => (
  <button
    disabled={loading}
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center gap-0.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
      loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : colorClass
    }`}
  >
    {loading ? (
      <span className="flex items-center gap-2">
        <Spinner /> Loading…
      </span>
    ) : (
      <>
        <span className="text-[15px] font-bold tracking-widest">{label}</span>
        <span className="text-[10px] opacity-75 font-normal">{sublabel}</span>
      </>
    )}
  </button>
);

/* ── Status Badge ── */
const StatusBadge = ({ outTime }) => {
  const inside = !outTime;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
        inside
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-slate-100 text-slate-500 border border-slate-200"
      }`}
    >
      {inside ? (
        <>
          <CheckCircle2 className="w-2.5 h-2.5" /> Inside
        </>
      ) : (
        <>
          <AlertCircle className="w-2.5 h-2.5" /> Out
        </>
      )}
    </span>
  );
};

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const ManpowerReport = () => {
  /* ── Loading states ── */
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  /* ── Filter state ── */
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [scanFilter, setScanFilter] = useState(SCAN_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  /* ── Data state ── */
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState("table");
  const [groupBy, setGroupBy] = useState(SUMMARY_GROUP_OPTIONS[0]);

  /* ── Debounced search ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  /* ── Fetch ── */
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
    if (!startTime || !endTime)
      return toast.error("Please select Start and End time.");
    fetchData(startTime, endTime, setLoading);
  };

  const handleYesterday = () => {
    const now = new Date();
    const t8 = new Date(now);
    t8.setHours(7, 0, 0, 0);
    const y8 = new Date(t8);
    y8.setDate(t8.getDate() - 1);
    fetchData(fmt(y8), fmt(t8), setYdayLoading);
  };

  const handleToday = () => {
    const now = new Date();
    const t8 = new Date(now);
    t8.setHours(7, 0, 0, 0);
    fetchData(fmt(t8), fmt(now), setTodayLoading);
  };

  const handleMTD = () => {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    fetchData(fmt(s), fmt(now), setMonthLoading);
  };

  const handleClear = () => {
    setStartTime("");
    setEndTime("");
    setData([]);
    setScanFilter(SCAN_OPTIONS[0]);
    setSearchTerm("");
    setGroupBy(SUMMARY_GROUP_OPTIONS[0]);
  };

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const total = data.length;
    const inside = data.filter((r) => !r["Out Date Time"]).length;
    const checkedOut = total - inside;
    const contractors = new Set(data.map((r) => r.Contractor).filter(Boolean))
      .size;
    const departments = new Set(data.map((r) => r.Department).filter(Boolean))
      .size;
    const shifts = new Set(data.map((r) => r.Shift).filter(Boolean)).size;
    return { total, inside, checkedOut, contractors, departments, shifts };
  }, [data]);

  /* ── Filtered data ── */
  const filteredData = useMemo(() => {
    let d = data;
    if (scanFilter.value === "inside") d = d.filter((r) => !r["Out Date Time"]);
    else if (scanFilter.value === "out")
      d = d.filter((r) => r["Out Date Time"]);

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      d = d.filter((r) =>
        [r.Contractor, r["Workmen Name"], r.Department, r.Shift].some((v) =>
          v?.toString().toLowerCase().includes(s),
        ),
      );
    }
    return d;
  }, [data, scanFilter, debouncedSearch]);

  /* ── Grouped summary ── */
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

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page sub-header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Manpower Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Security · Workmen tracking · Contractor management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {stats.total}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total
            </span>
          </div>
          {stats.total > 0 && (
            <>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {stats.inside}
                </span>
                <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                  Inside
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-slate-600">
                  {stats.checkedOut}
                </span>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                  Out
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-amber-700">
                  {stats.contractors}
                </span>
                <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">
                  Contractors
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-violet-700">
                  {stats.departments}
                </span>
                <span className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">
                  Departments
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Filters + Quick filters row ── */}
        <div className="flex gap-3 shrink-0">
          {/* Filters card */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Filters
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[185px] flex-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1 block">
                  <Calendar className="w-3 h-3" /> Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
                />
              </div>
              <div className="min-w-[185px] flex-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1 block">
                  <Calendar className="w-3 h-3" /> End Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
                />
              </div>
              <div className="min-w-[170px] flex-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1 block">
                  <Filter className="w-3 h-3" /> Status
                </label>
                <div className="relative">
                  <select
                    value={scanFilter.value}
                    onChange={(e) =>
                      setScanFilter(
                        SCAN_OPTIONS.find((o) => o.value === e.target.value),
                      )
                    }
                    className="w-full appearance-none px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors pr-8"
                  >
                    {SCAN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-3.5 h-3.5" />
                </div>
              </div>
              <div className="min-w-[180px] flex-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1 block">
                  <Search className="w-3 h-3" /> Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Contractor, Workmen, Dept…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-lg text-sm placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pb-0.5 shrink-0">
                <button
                  onClick={handleQuery}
                  disabled={anyLoading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    anyLoading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                  }`}
                >
                  {loading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? "Fetching…" : "Query"}
                </button>
                {filteredData.length > 0 && (
                  <ExportButton
                    data={filteredData}
                    filename="manpower_report"
                  />
                )}
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 text-sm transition-all"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
            </div>
          </div>

          {/* Quick filters card */}
          <div className="w-60 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
              Quick Filters
            </p>
            <p className="text-[10px] text-slate-400 mb-3">
              Pre-defined time ranges.
            </p>
            <div className="flex flex-col gap-2">
              <QuickBtn
                label="YESTERDAY"
                sublabel="Prev day 07:00 → today 07:00"
                loading={ydayLoading}
                onClick={handleYesterday}
                colorClass="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              />
              <QuickBtn
                label="TODAY"
                sublabel="07:00 → now"
                loading={todayLoading}
                onClick={handleToday}
                colorClass="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              />
              <QuickBtn
                label="MTD"
                sublabel="Month to date"
                loading={monthLoading}
                onClick={handleMTD}
                colorClass="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* ── Presence bar ── */}
        {stats.total > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Presence Overview
              </p>
              <p className="text-[11px] text-slate-400">
                {stats.inside} inside · {stats.checkedOut} checked out
              </p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all duration-700"
                style={{
                  width: `${Math.round((stats.inside / stats.total) * 100)}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Inside ({Math.round((stats.inside / stats.total) * 100)}%)
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />
                Checked Out (
                {Math.round((stats.checkedOut / stats.total) * 100)}%)
              </span>
            </div>
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1 shrink-0">
          {[
            { key: "table", label: "Detail View", icon: List },
            { key: "summary", label: "Summary", icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                activeTab === key
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                  : "bg-white text-slate-400 hover:text-slate-700 border border-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
          {filteredData.length > 0 && (
            <span className="ml-2 text-[11px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 font-medium">
              {filteredData.length} rows
            </span>
          )}
        </div>

        {/* ── Detail Table ── */}
        {activeTab === "table" && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <List className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Records
                </span>
              </div>
              {filteredData.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  {filteredData.length} of {stats.total}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto min-w-0">
              {anyLoading && data.length === 0 ? (
                <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                  <Spinner cls="w-5 h-5" />
                  <span className="text-sm">Loading records…</span>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                  <PackageOpen
                    className="w-12 h-12 opacity-20"
                    strokeWidth={1.2}
                  />
                  <p className="text-sm">No records found</p>
                  <p className="text-xs text-slate-300">
                    Apply filters and click Query
                  </p>
                </div>
              ) : (
                <table className="min-w-[1200px] w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        ["#", Hash],
                        ["Contractor", Briefcase],
                        ["Workmen Name", User],
                        ["Department", MapPin],
                        ["Shift", Layers],
                        ["In Date Time", Calendar],
                        ["Out Date Time", Calendar],
                        ["Status", CheckCircle2],
                      ].map(([h, Icon]) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                        >
                          <span className="flex items-center gap-1">
                            <Icon className="w-2.5 h-2.5" /> {h}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                      >
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                          {i + 1}
                        </td>
                        <td
                          className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 whitespace-nowrap max-w-[180px] truncate"
                          title={row.Contractor}
                        >
                          {row.Contractor || "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-medium">
                            <User className="w-2.5 h-2.5" />{" "}
                            {row["Workmen Name"] || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                          {row.Department ? (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-md">
                              <MapPin className="w-2.5 h-2.5" />{" "}
                              {row.Department}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                          {row.Shift ? (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                              <Layers className="w-2.5 h-2.5" /> {row.Shift}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                          {fmtDisplay(row["In Date Time"])}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                          {fmtDisplay(row["Out Date Time"])}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
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
          <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
            {/* Group By panel */}
            <div className="w-64 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <BarChart3 className="w-3 h-3" /> Group By
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3 flex-1">
                {SUMMARY_GROUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-all flex items-center justify-between ${
                      groupBy.value === opt.value
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {opt.label}
                    {groupBy.value === opt.value && (
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">
                        {groupedData.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-slate-100 shrink-0">
                {groupedData.length > 0 && (
                  <ExportButton
                    data={groupedData}
                    filename="manpower_summary"
                  />
                )}
              </div>
            </div>

            {/* Breakdown table */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    {groupBy.label} Breakdown
                  </span>
                </div>
                {groupedData.length > 0 && (
                  <span className="text-[11px] text-slate-400">
                    {groupedData.length} groups
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto min-w-0">
                {groupedData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                    <PackageOpen
                      className="w-12 h-12 opacity-20"
                      strokeWidth={1.2}
                    />
                    <p className="text-sm">No data to group</p>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 w-10">
                          <Hash className="w-3 h-3" />
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200">
                          {groupBy.label}
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-right">
                          Total
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-right">
                          Inside
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-right">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedData.map((item, i) => {
                        const pct = stats.total
                          ? Math.round((item.total / stats.total) * 100)
                          : 0;
                        const insPct = item.total
                          ? Math.round((item.inside / item.total) * 100)
                          : 0;
                        return (
                          <tr
                            key={i}
                            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                          >
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400">
                              {i + 1}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-1.5 rounded-full bg-blue-400"
                                  style={{
                                    width: `${Math.max(pct, 4)}%`,
                                    maxWidth: "100px",
                                  }}
                                />
                                <span
                                  className="text-slate-700 font-medium truncate max-w-[200px]"
                                  title={item.key}
                                >
                                  {item.key}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-right font-bold text-slate-800">
                              {item.total}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-right">
                              <span
                                className={`font-semibold ${
                                  insPct === 100
                                    ? "text-emerald-600"
                                    : insPct > 50
                                      ? "text-amber-500"
                                      : "text-red-500"
                                }`}
                              >
                                {item.inside} ({insPct}%)
                              </span>
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-right text-slate-500">
                              {pct}%
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
    </div>
  );
};

export default ManpowerReport;
