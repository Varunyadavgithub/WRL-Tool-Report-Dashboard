import { useState, useMemo } from "react";
import {
  FaFilePdf, FaTimesCircle, FaChartPie,
  FaSearch, FaIndustry, FaCalendarAlt, FaBoxes, FaFilter, FaFileDownload, FaFileExcel,
} from "react-icons/fa";
import { MdOutlinePendingActions, MdVerified } from "react-icons/md";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { fileBaseURL } from "../../../assets/assets";
import { exportRowsToPDF, exportRowsToExcel } from "../../../utils/reportExport";
import Pagination from "../../../components/ui/Pagination";
import { StatCard, ChartTooltip, COMPLIANCE_STATUS_STYLES, useSortableTable, usePagedSlice, MultiSelectDropdown, CURRENT_YEAR } from "./shared";

const PIE_COLORS = { "Test Completed": "#10b981", "Test Failed": "#ef4444", "Test Pending": "#f59e0b" };

const EXPORT_COLUMNS = [
  { label: "Model Name", align: "left", value: (r) => r.ModelName },
  { label: "Year", align: "left", value: (r) => r.Year },
  { label: "Month", align: "left", value: (r) => r.Month ?? "" },
  { label: "Production", align: "right", value: (r) => r.Prod_Count ?? 0 },
  { label: "Status", align: "left", value: (r) => r.Status },
  { label: "Description", align: "left", value: (r) => r.Description ?? "" },
];

// Merged BISReports' "Overview" + "BIS Status" tabs — production-linked
// compliance tracking (which models have a BIS test on file for the units
// actually produced), independent from the Reports tab's raw file list.
const BISComplianceTab = ({ status }) => {
  const [search, setSearch] = useState({ term: "", field: "all" });
  const [statusFilter, setStatusFilter] = useState("all");
  // Multi-select, defaulting to the current year — [] means "all years".
  const [yearFilter, setYearFilter] = useState([String(CURRENT_YEAR)]);
  const [limit, setLimit] = useState(25);

  // Year dropdown options stay static (every year ever seen), independent
  // of the current selection, so narrowing the filter doesn't also shrink
  // the list of years you could pick.
  const years = useMemo(() => [...new Set(status.map((s) => String(s.Year)))].sort(), [status]);

  const filteredStatus = useMemo(() => {
    return status.filter((s) => {
      const matchYear = yearFilter.length === 0 || yearFilter.includes(String(s.Year));
      const matchStatus = statusFilter === "all" || s.Status === statusFilter;
      const { term, field } = search;
      if (!term) return matchYear && matchStatus;
      const t = term.toLowerCase();
      const hit = field === "all"
        ? String(s.ModelName || "").toLowerCase().includes(t) ||
          String(s.Year || "").toLowerCase().includes(t) ||
          String(s.Status || "").toLowerCase().includes(t)
        : String(s[field] || "").toLowerCase().includes(t);
      return matchYear && matchStatus && hit;
    });
  }, [status, search, statusFilter, yearFilter]);

  // Stat cards / charts now reflect the same filters (year, status, search)
  // as the table below, instead of always summarizing the full dataset.
  const completedCount = filteredStatus.filter((s) => s.Status === "Test Completed").length;
  const failedCount = filteredStatus.filter((s) => s.Status === "Test Failed").length;
  const pendingCount = filteredStatus.filter((s) => s.Status === "Test Pending").length;
  const totalProd = filteredStatus.reduce((acc, s) => acc + (s.Prod_Count || 0), 0);
  const passRate = ((completedCount / (filteredStatus.length || 1)) * 100).toFixed(1);

  const pieData = [
    { name: "Test Completed", value: completedCount },
    { name: "Test Failed", value: failedCount },
    { name: "Test Pending", value: pendingCount },
  ].filter((d) => d.value > 0);

  const barByYear = useMemo(() => {
    const map = {};
    filteredStatus.forEach((s) => {
      const y = String(s.Year);
      if (!map[y]) map[y] = { year: y, Completed: 0, Failed: 0, Pending: 0, Production: 0 };
      if (s.Status === "Test Completed") map[y].Completed++;
      else if (s.Status === "Test Failed") map[y].Failed++;
      else map[y].Pending++;
      map[y].Production += s.Prod_Count || 0;
    });
    return Object.values(map).sort((a, b) => a.year.localeCompare(b.year));
  }, [filteredStatus]);

  const topModels = useMemo(
    () => [...filteredStatus].sort((a, b) => (b.Prod_Count || 0) - (a.Prod_Count || 0)).slice(0, 10)
      .map((s) => ({ model: s.ModelName?.substring(0, 12), count: s.Prod_Count || 0 })),
    [filteredStatus],
  );

  const { sorted: sortedStatus, sortConfig, toggle } = useSortableTable(filteredStatus);
  const { page, setPage, totalPages, slice: pagedStatus } = usePagedSlice(sortedStatus, limit);

  const sortIcon = (key) => (sortConfig.key !== key ? "" : sortConfig.dir === "asc" ? " ▲" : " ▼");
  const exportTitle = "BIS Compliance Status";
  const exportSubtitle = `${filteredStatus.length} record(s)${yearFilter.length ? ` · Year ${yearFilter.join(", ")}` : ""}${statusFilter !== "all" ? ` · ${statusFilter}` : ""}`;

  return (
    <div className="space-y-4">
      {/* stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard icon={FaFilePdf} label="Tracked Model-Years" value={filteredStatus.length} accent="#64748b" sub="Production-linked" />
        <StatCard icon={MdVerified} label="Test Completed" value={completedCount} accent="#10b981" sub={`${passRate}% of tracked`} />
        <StatCard icon={FaTimesCircle} label="Test Failed" value={failedCount} accent="#ef4444" sub="Needs re-test" />
        <StatCard icon={MdOutlinePendingActions} label="Test Pending" value={pendingCount} accent="#f59e0b" sub="Awaiting certification" />
        <StatCard icon={FaBoxes} label="Total Production" value={totalProd.toLocaleString()} accent="#6366f1" sub="Units across all years" />
      </div>

      {/* charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
            <FaChartPie className="inline mr-2 text-indigo-500" /> Test Status Split
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                {pieData.map((d, i) => <Cell key={i} fill={PIE_COLORS[d.name]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs font-semibold text-slate-600">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-slate-500 mt-1">
            Pass Rate: <span className="font-black text-emerald-600">{passRate}%</span>
          </p>
        </div>

        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
            <FaCalendarAlt className="inline mr-2 text-blue-500" /> Completed / Failed / Pending by Year
          </h3>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={barByYear} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs font-semibold text-slate-600">{v}</span>} />
              <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
            <FaIndustry className="inline mr-2 text-purple-500" /> Production Count by Year
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={barByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="Production" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-black text-slate-700 mb-4 uppercase tracking-wider">
            <FaBoxes className="inline mr-2 text-red-500" /> Top 10 Models by Production
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topModels} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="model" tick={{ fontSize: 9 }} width={90} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* status table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search model, year, status…"
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 w-64 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={search.term}
            onChange={(e) => setSearch((p) => ({ ...p, term: e.target.value }))}
          />
        </div>
        <div className="relative">
          <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <select
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Test Completed">Test Completed</option>
            <option value="Test Failed">Test Failed</option>
            <option value="Test Pending">Test Pending</option>
          </select>
        </div>
        <MultiSelectDropdown label="Year" options={years} selected={yearFilter} onChange={setYearFilter} placeholder="All years" />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportRowsToPDF({ rows: filteredStatus, columns: EXPORT_COLUMNS, title: exportTitle, subtitle: exportSubtitle, filename: "bis-compliance-status.pdf" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-600 transition-all"
            title="Export PDF"
          >
            <FaFileDownload />
          </button>
          <button
            onClick={() => exportRowsToExcel({ rows: filteredStatus, columns: EXPORT_COLUMNS, title: exportTitle, subtitle: exportSubtitle, filename: "bis-compliance-status.xls" })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 transition-all"
            title="Export Excel"
          >
            <FaFileExcel />
          </button>
          <span className="text-xs font-semibold text-slate-400">{filteredStatus.length} records</span>
        </div>
      </div>

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
                    onClick={() => key && toggle(key)}
                    className={`px-4 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider ${key ? "cursor-pointer hover:text-slate-700" : ""}`}
                  >
                    {label}{key && sortIcon(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedStatus.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 font-medium">No records match your filters</td></tr>
              ) : (
                pagedStatus.map((item, i) => {
                  const sc = COMPLIANCE_STATUS_STYLES[item.Status] || COMPLIANCE_STATUS_STYLES["Test Pending"];
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-semibold text-xs">{(page - 1) * limit + i + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.ModelName}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{item.Year}</td>
                      <td className="px-4 py-3 text-slate-500">{item.Month || "—"}</td>
                      <td className="px-4 py-3"><span className="font-black text-indigo-700">{(item.Prod_Count || 0).toLocaleString()}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {item.Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{item.Description || "—"}</td>
                      <td className="px-4 py-3">
                        {item.FileName ? (
                          <a href={`${fileBaseURL}${item.fileUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 font-semibold text-xs">
                            <FaFilePdf /> View
                          </a>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} totalRecords={filteredStatus.length} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />
    </div>
  );
};

export default BISComplianceTab;
