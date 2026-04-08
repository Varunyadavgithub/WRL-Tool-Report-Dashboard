import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FaFilePdf,
  FaDownload,
  FaCheckCircle,
  FaHourglassHalf,
  FaChartPie,
  FaTable,
  FaSearch,
  FaIndustry,
  FaCalendarAlt,
  FaTachometerAlt,
  FaBoxes,
  FaFilter,
  FaSortUp,
  FaSortDown,
  FaSort,
} from "react-icons/fa";
import { MdOutlinePendingActions, MdVerified } from "react-icons/md";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { baseURL } from "../../assets/assets";

/* ─────────────────────────── helpers ─────────────────────────── */

const STATUS_COLORS = {
  "Test Completed": {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    dot: "bg-emerald-500",
  },
  "Test Pending": {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    dot: "bg-amber-500",
  },
};

const PIE_COLORS = ["#10b981", "#f59e0b"];

const TABS = [
  { id: "overview", label: "Overview", icon: FaTachometerAlt },
  { id: "status", label: "BIS Status", icon: FaTable },
  { id: "files", label: "Uploaded Reports", icon: FaFilePdf },
];

const useSortableTable = (data) => {
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });

  const sorted = useMemo(() => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      const cmp =
        typeof aVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sortConfig]);

  const toggle = (key) =>
    setSortConfig((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  const icon = (key) => {
    if (sortConfig.key !== key)
      return <FaSort className="opacity-30 ml-1 inline" />;
    return sortConfig.dir === "asc" ? (
      <FaSortUp className="ml-1 inline text-blue-500" />
    ) : (
      <FaSortDown className="ml-1 inline text-blue-500" />
    );
  };

  return { sorted, toggle, icon };
};

/* ─────────────────────────── stat card ─────────────────────────── */

const StatCard = ({ icon: Icon, label, value, accent, sub }) => (
  <div
    className="relative overflow-hidden rounded-2xl border bg-white shadow-sm p-5 flex gap-4 items-start"
    style={{ borderColor: accent + "33" }}
  >
    <div
      className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg shadow"
      style={{ background: accent }}
    >
      <Icon />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-0.5">
        {label}
      </p>
      <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
    <div
      className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10"
      style={{ background: accent }}
    />
  </div>
);

/* ─────────────────────────── custom tooltip ─────────────────────────── */

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm">
      {label && <p className="font-bold text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

/* ─────────────────────────── main component ─────────────────────────── */

const BISReports = () => {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState({ term: "", field: "all" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-status`);
      setFiles(res?.data?.files || []);
      setStatus(res?.data?.status || []);
    } catch {
      toast.error("Failed to fetch BIS report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ── download ── */
  const handleDownload = async (file) => {
    try {
      const response = await axios({
        url: `${baseURL}quality/download-bis-file/${file.srNo}`,
        method: "GET",
        responseType: "blob",
        params: { filename: file.fileName },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download file");
    }
  };

  /* ── derived data ── */
  const years = useMemo(
    () => [...new Set(status.map((s) => String(s.Year)))].sort(),
    [status]
  );

  const completedCount = status.filter(
    (s) => s.Status === "Test Completed"
  ).length;
  const pendingCount = status.filter(
    (s) => s.Status === "Test Pending"
  ).length;
  const totalProd = status.reduce((acc, s) => acc + (s.Prod_Count || 0), 0);

  const pieData = [
    { name: "Test Completed", value: completedCount },
    { name: "Test Pending", value: pendingCount },
  ];

  const barByYear = useMemo(() => {
    const map = {};
    status.forEach((s) => {
      const y = String(s.Year);
      if (!map[y])
        map[y] = { year: y, Completed: 0, Pending: 0, Production: 0 };
      if (s.Status === "Test Completed") map[y].Completed++;
      else map[y].Pending++;
      map[y].Production += s.Prod_Count || 0;
    });
    return Object.values(map).sort((a, b) => a.year.localeCompare(b.year));
  }, [status]);

  const topModels = useMemo(() => {
    return [...status]
      .sort((a, b) => (b.Prod_Count || 0) - (a.Prod_Count || 0))
      .slice(0, 10)
      .map((s) => ({
        model: s.ModelName?.substring(0, 12),
        count: s.Prod_Count || 0,
      }));
  }, [status]);

  /* ── filtered status ── */
  const filteredStatus = useMemo(() => {
    return status.filter((s) => {
      const matchYear =
        yearFilter === "all" || String(s.Year) === yearFilter;
      const matchStatus =
        statusFilter === "all" || s.Status === statusFilter;
      const { term, field } = search;
      if (!term) return matchYear && matchStatus;
      const t = term.toLowerCase();
      const hit =
        field === "all"
          ? String(s.ModelName || "").toLowerCase().includes(t) ||
            String(s.Year || "").toLowerCase().includes(t) ||
            String(s.Status || "").toLowerCase().includes(t)
          : String(s[field] || "").toLowerCase().includes(t);
      return matchYear && matchStatus && hit;
    });
  }, [status, search, statusFilter, yearFilter]);

  /* ── filtered files ── */
  const filteredFiles = useMemo(() => {
    const { term, field } = search;
    if (!term) return files;
    const t = term.toLowerCase();
    return files.filter((f) => {
      if (field === "all")
        return (
          (f.modelName || "").toLowerCase().includes(t) ||
          String(f.year || "").toLowerCase().includes(t) ||
          (f.fileName || "").toLowerCase().includes(t) ||
          (f.description || "").toLowerCase().includes(t)
        );
      return String(f[field] || "").toLowerCase().includes(t);
    });
  }, [files, search]);

  const {
    sorted: sortedStatus,
    toggle: toggleStatus,
    icon: statusSortIcon,
  } = useSortableTable(filteredStatus);

  const {
    sorted: sortedFiles,
    toggle: toggleFiles,
    icon: filesSortIcon,
  } = useSortableTable(filteredFiles);

  /* ─────────────────────────── render ─────────────────────────── */

  return (
    // KEY FIX: removed max-w-screen-xl, use w-full so it fills the
    // entire space left by the sidebar automatically
    <div className="min-h-screen bg-slate-50 font-sans w-full">

      {/* ── header ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm w-full">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shadow">
              <FaFilePdf className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">
                BIS Report Dashboard
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Bureau of Indian Standards · Compliance Tracker
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── tabs ── */}
        <div className="w-full px-6 flex gap-1 border-t border-slate-100 pt-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-lg transition-all ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <tab.icon className="text-xs" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── body — full width, consistent padding ── */}
      <div className="w-full px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="font-semibold">Loading BIS data…</p>
          </div>
        ) : (
          <>
            {/* ──────────── OVERVIEW TAB ──────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">

                {/* stat cards — 4 equal columns, stretch to fill */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard
                    icon={FaFilePdf}
                    label="Total Reports"
                    value={files.length}
                    accent="#ef4444"
                    sub="Uploaded PDFs"
                  />
                  <StatCard
                    icon={MdVerified}
                    label="Test Completed"
                    value={completedCount}
                    accent="#10b981"
                    sub={`${((completedCount / (status.length || 1)) * 100).toFixed(0)}% of tracked models`}
                  />
                  <StatCard
                    icon={MdOutlinePendingActions}
                    label="Test Pending"
                    value={pendingCount}
                    accent="#f59e0b"
                    sub="Awaiting certification"
                  />
                  <StatCard
                    icon={FaBoxes}
                    label="Total Production"
                    value={totalProd.toLocaleString()}
                    accent="#6366f1"
                    sub="Units across all years"
                  />
                </div>

                {/* charts row 1 — pie takes 1 col, bar takes 2 cols on xl */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {/* pie */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
                      <FaChartPie className="inline mr-2 text-indigo-500" />
                      Test Status Split
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(v) => (
                            <span className="text-xs font-semibold text-slate-600">
                              {v}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-center text-xs text-slate-500 mt-1">
                      Pass Rate:{" "}
                      <span className="font-black text-emerald-600">
                        {((completedCount / (status.length || 1)) * 100).toFixed(1)}%
                      </span>
                    </p>
                  </div>

                  {/* bar by year — spans 2 columns on xl */}
                  <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
                      <FaCalendarAlt className="inline mr-2 text-blue-500" />
                      Completed vs Pending by Year
                    </h3>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={barByYear} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(v) => (
                            <span className="text-xs font-semibold text-slate-600">
                              {v}
                            </span>
                          )}
                        />
                        <Bar
                          dataKey="Completed"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="Pending"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* charts row 2 — equal halves */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* production line */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
                      <FaIndustry className="inline mr-2 text-purple-500" />
                      Production Count by Year
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={barByYear}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="Production"
                          stroke="#6366f1"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#6366f1" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* top 10 models */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
                      <FaBoxes className="inline mr-2 text-red-500" />
                      Top 10 Models by Production
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={topModels}
                        layout="vertical"
                        barCategoryGap="25%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="model"
                          tick={{ fontSize: 9 }}
                          width={90}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="count"
                          fill="#6366f1"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* year-wise summary table — full width */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
                    Year-wise Summary
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {[
                            "Year",
                            "Completed",
                            "Pending",
                            "Total Units",
                            "Pass Rate",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2 text-left text-xs font-black text-slate-400 uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {barByYear.map((row) => (
                          <tr
                            key={row.year}
                            className="border-b border-slate-50 hover:bg-slate-50"
                          >
                            <td className="px-4 py-2.5 font-bold text-slate-800">
                              {row.year}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                <FaCheckCircle className="text-emerald-500" />
                                {row.Completed}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                <FaHourglassHalf className="text-amber-500" />
                                {row.Pending}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-indigo-700">
                              {row.Production.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                  <div
                                    className="bg-emerald-500 h-1.5 rounded-full"
                                    style={{
                                      width: `${(
                                        (row.Completed /
                                          (row.Completed + row.Pending || 1)) *
                                        100
                                      ).toFixed(0)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-slate-600 w-9 text-right">
                                  {(
                                    (row.Completed /
                                      (row.Completed + row.Pending || 1)) *
                                    100
                                  ).toFixed(0)}
                                  %
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ──────────── STATUS TAB ──────────── */}
            {activeTab === "status" && (
              <div className="space-y-4">
                {/* filters bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                      type="text"
                      placeholder="Search model, year, status…"
                      className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={search.term}
                      onChange={(e) =>
                        setSearch((p) => ({ ...p, term: e.target.value }))
                      }
                    />
                  </div>
                  <div className="relative">
                    <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <select
                      className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Test Completed">Test Completed</option>
                      <option value="Test Pending">Test Pending</option>
                    </select>
                  </div>
                  <select
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                  >
                    <option value="all">All Years</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <span className="ml-auto text-xs font-semibold text-slate-400">
                    {filteredStatus.length} records
                  </span>
                </div>

                {/* status table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {[
                            { label: "#", key: null },
                            { label: "Model Name", key: "ModelName" },
                            { label: "Year", key: "Year" },
                            { label: "Month", key: "Month" },
                            { label: "Production", key: "Prod_Count" },
                            { label: "Status", key: "Status" },
                            { label: "Description", key: "Description" },
                            { label: "File", key: null },
                          ].map(({ label, key }) => (
                            <th
                              key={label}
                              onClick={() => key && toggleStatus(key)}
                              className={`px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider ${
                                key
                                  ? "cursor-pointer hover:text-slate-700"
                                  : ""
                              }`}
                            >
                              {label}
                              {key && statusSortIcon(key)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStatus.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="text-center py-12 text-slate-400 font-medium"
                            >
                              No records match your filters
                            </td>
                          </tr>
                        ) : (
                          sortedStatus.map((item, i) => {
                            const sc =
                              STATUS_COLORS[item.Status] ||
                              STATUS_COLORS["Test Pending"];
                            return (
                              <tr
                                key={i}
                                className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                              >
                                <td className="px-4 py-3 text-slate-400 font-semibold text-xs">
                                  {i + 1}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-900">
                                  {item.ModelName}
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-600">
                                  {item.Year}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                  {item.Month || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-black text-indigo-700">
                                    {(item.Prod_Count || 0).toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${sc.bg} ${sc.text} ${sc.border}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}
                                    />
                                    {item.Status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                                  {item.Description || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {item.FileName ? (
                                    <a
                                      href={`${baseURL}${item.fileUrl?.replace(
                                        /^\//,
                                        ""
                                      )}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 font-semibold text-xs"
                                    >
                                      <FaFilePdf />
                                      View
                                    </a>
                                  ) : (
                                    <span className="text-slate-300 text-xs">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ──────────── FILES TAB ──────────── */}
            {activeTab === "files" && (
              <div className="space-y-4">
                {/* search bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                      type="text"
                      placeholder="Search reports…"
                      className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={search.term}
                      onChange={(e) =>
                        setSearch((p) => ({ ...p, term: e.target.value }))
                      }
                    />
                  </div>
                  <select
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={search.field}
                    onChange={(e) =>
                      setSearch((p) => ({ ...p, field: e.target.value }))
                    }
                  >
                    <option value="all">All Fields</option>
                    <option value="modelName">Model Name</option>
                    <option value="year">Year</option>
                    <option value="month">Month</option>
                    <option value="description">Description</option>
                    <option value="fileName">File Name</option>
                  </select>
                  <span className="ml-auto text-xs font-semibold text-slate-400">
                    {filteredFiles.length} reports
                  </span>
                </div>

                {/* files table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {[
                            { label: "#", key: null },
                            { label: "Model Name", key: "modelName" },
                            { label: "Year", key: "year" },
                            { label: "Month", key: "month" },
                            { label: "Test Freq.", key: "testFrequency" },
                            { label: "Description", key: "description" },
                            { label: "File Name", key: "fileName" },
                            { label: "Uploaded At", key: "uploadAt" },
                            { label: "Actions", key: null },
                          ].map(({ label, key }) => (
                            <th
                              key={label}
                              onClick={() => key && toggleFiles(key)}
                              className={`px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider ${
                                key
                                  ? "cursor-pointer hover:text-slate-700"
                                  : ""
                              }`}
                            >
                              {label}
                              {key && filesSortIcon(key)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedFiles.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="text-center py-12 text-slate-400 font-medium"
                            >
                              No reports found
                            </td>
                          </tr>
                        ) : (
                          sortedFiles.map((file, index) => (
                            <tr
                              key={index}
                              className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-3 text-slate-400 font-semibold text-xs">
                                {index + 1}
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-900">
                                {file.modelName}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-600">
                                {file.year}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {file.month || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {file.testFrequency || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                                {file.description || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 text-red-600 font-semibold">
                                  <FaFilePdf className="shrink-0" />
                                  <span className="truncate max-w-[160px]">
                                    {file.fileName}
                                  </span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                {file.uploadAt
                                  ? new Date(file.uploadAt).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )
                                  : "—"}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleDownload(file)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                                  title="Download PDF"
                                >
                                  <FaDownload className="text-xs" />
                                  Download
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BISReports;