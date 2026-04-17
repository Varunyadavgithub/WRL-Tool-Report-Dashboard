import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import DateTimePicker from "../../components/ui/DateTimePicker";
import SelectField from "../../components/ui/SelectField";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import Loader from "../../components/ui/Loader";
import {
  Filter,
  ChevronRight,
  Search,
  X,
  Zap,
  Clock,
  ArrowUp,
  ArrowDown,
  Table2,
  BarChart3,
  CheckCircle2,
  XCircle,
  PackageOpen,
  Loader2,
  Target,
  FileText,
  Thermometer,
  Activity,
  Zap as ZapIcon,
  Factory,
  ClipboardList,
  Percent,
  Gauge,
  Trophy,
  Minus,
  TrendingUp,
  TrendingDown,
  Shield,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const METRIC_GROUPS = [
  {
    key: "temp",
    label: "Temperature",
    icon: Thermometer,
    color: "#ef4444",
    minKey: "minTemp",
    maxKey: "maxTemp",
    actualKey: "ActualTemp",
  },
  {
    key: "current",
    label: "Current",
    icon: Activity,
    color: "#f59e0b",
    minKey: "minCurrent",
    maxKey: "maxCurrent",
    actualKey: "ActualCurrent",
  },
  {
    key: "power",
    label: "Power",
    icon: ZapIcon,
    color: "#6366f1",
    minKey: "minPower",
    maxKey: "maxPower",
    actualKey: "ActualPower",
  },
];

// ─── Utilities ─────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const normalizeArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

// ─── Spinner ───────────────────────────────────────────────────────────────────

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── StatusPill ────────────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const isPass = status === "Pass";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
        isPass
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-rose-50 text-rose-800 border-rose-200"
      }`}
    >
      {isPass ? (
        <CheckCircle2 className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5" />
      )}
      {status}
    </span>
  );
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({ icon: Icon, label, value, borderColor, sub }) => (
  <div
    className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]"
    style={{ borderTopWidth: 3, borderTopColor: borderColor }}
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${borderColor}18`, color: borderColor }}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ─── MetricCell ────────────────────────────────────────────────────────────────

const MetricCell = ({ actual, min, max }) => {
  const numActual = parseFloat(actual);
  const numMin = parseFloat(min);
  const numMax = parseFloat(max);
  const inRange =
    !isNaN(numActual) &&
    !isNaN(numMin) &&
    !isNaN(numMax) &&
    numActual >= numMin &&
    numActual <= numMax;

  return (
    <span
      className={`font-semibold ${
        isNaN(numActual)
          ? "text-slate-400"
          : inRange
            ? "text-emerald-600"
            : "text-rose-600"
      }`}
    >
      {actual ?? "—"}
    </span>
  );
};

// ─── Summary Panel ─────────────────────────────────────────────────────────────

const LptSummary = ({ data }) => {
  if (!data || data.length === 0) return null;

  const totalRecords = data.length;
  const uniqueAssembly = new Set(data.map((r) => r.AssemblyNo)).size;
  const uniqueModels = new Set(data.map((r) => r.ModelName)).size;
  const passCount = data.filter((r) => r.Performance === "Pass").length;
  const failCount = totalRecords - passCount;
  const passRate =
    totalRecords > 0 ? ((passCount / totalRecords) * 100).toFixed(1) : "0";

  return (
    <div>
      <div className="flex flex-wrap gap-2.5 mb-3">
        <KpiCard
          icon={ClipboardList}
          label="Total Records"
          value={totalRecords}
          borderColor="#6366f1"
        />
        <KpiCard
          icon={Factory}
          label="Unique Assemblies"
          value={uniqueAssembly}
          borderColor="#8b5cf6"
        />
        <KpiCard
          icon={FileText}
          label="Models Tested"
          value={uniqueModels}
          borderColor="#3b82f6"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Passed"
          value={passCount}
          borderColor="#10b981"
        />
        <KpiCard
          icon={XCircle}
          label="Failed"
          value={failCount}
          borderColor="#ef4444"
        />
        <KpiCard
          icon={Trophy}
          label="Pass Rate"
          value={`${passRate}%`}
          borderColor="#10b981"
          sub={`${passCount} pass / ${failCount} fail`}
        />
      </div>

      {/* Pass/Fail Bar */}
      {totalRecords > 0 && (
        <div className="mb-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Performance Breakdown
          </div>
          <div className="flex h-5 rounded-lg overflow-hidden gap-0.5">
            {passCount > 0 && (
              <div
                className="bg-emerald-500 flex items-center justify-center"
                style={{ flex: passCount }}
              >
                <span className="text-[9px] text-white font-bold">
                  {passRate}% Pass
                </span>
              </div>
            )}
            {failCount > 0 && (
              <div
                className="bg-rose-500 flex items-center justify-center"
                style={{ flex: failCount }}
              >
                <span className="text-[9px] text-white font-bold">
                  {((failCount / totalRecords) * 100).toFixed(1)}% Fail
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-[11px] text-slate-500">
            <span>
              <span className="text-emerald-500 font-bold">●</span> Pass{" "}
              {passCount}
            </span>
            <span>
              <span className="text-rose-500 font-bold">●</span> Fail{" "}
              {failCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Model Performance Panel ──────────────────────────────────────────────────

const ModelPerformancePanel = ({ data }) => {
  if (!data || data.length === 0) return null;

  const models = {};
  data.forEach((r) => {
    if (!r.ModelName) return;
    if (!models[r.ModelName])
      models[r.ModelName] = { pass: 0, fail: 0, total: 0 };
    models[r.ModelName].total++;
    if (r.Performance === "Pass") models[r.ModelName].pass++;
    else models[r.ModelName].fail++;
  });

  const rows = Object.entries(models)
    .map(([model, d]) => ({
      model,
      ...d,
      passRate: d.total > 0 ? ((d.pass / d.total) * 100).toFixed(1) : "0",
    }))
    .sort((a, b) => parseFloat(b.passRate) - parseFloat(a.passRate));

  if (rows.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Model Performance
        </span>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              {["Model", "Total", "Pass", "Fail", "Pass Rate"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
              >
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.model}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-blue-600">
                  {row.total}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-emerald-600">
                  {row.pass}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 ${row.fail > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}
                >
                  {row.fail}
                </td>
                <td className="px-3 py-2 border-b border-slate-100">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      parseFloat(row.passRate) >= 95
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : parseFloat(row.passRate) >= 80
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {row.passRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Shift Analysis Panel ─────────────────────────────────────────────────────

const ShiftAnalysisPanel = ({ data }) => {
  if (!data || data.length === 0) return null;

  const shifts = {};
  data.forEach((r) => {
    if (!r.Shift) return;
    if (!shifts[r.Shift]) shifts[r.Shift] = { pass: 0, fail: 0, total: 0 };
    shifts[r.Shift].total++;
    if (r.Performance === "Pass") shifts[r.Shift].pass++;
    else shifts[r.Shift].fail++;
  });

  const rows = Object.entries(shifts).map(([shift, d]) => ({
    shift,
    ...d,
    passRate: d.total > 0 ? ((d.pass / d.total) * 100).toFixed(1) : "0",
  }));

  if (rows.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Shift Analysis
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {rows.map((row, i) => {
          const rate = parseFloat(row.passRate);
          return (
            <div
              key={i}
              className={`flex-1 min-w-[160px] rounded-xl px-4 py-3 border ${
                rate >= 95
                  ? "bg-emerald-50 border-emerald-200"
                  : rate >= 80
                    ? "bg-amber-50 border-amber-200"
                    : "bg-rose-50 border-rose-200"
              }`}
            >
              <div className="font-bold text-slate-900 text-sm mb-1">
                {row.shift}
              </div>
              <div className="text-[11px] text-slate-500 mb-1.5">
                {row.total} tested
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  rate >= 95
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : rate >= 80
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                {row.passRate}% Pass
              </span>
              <div className="flex gap-2 mt-1.5 text-[10px] text-slate-500">
                <span className="text-emerald-500">P:{row.pass}</span>
                <span className="text-rose-500">F:{row.fail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
      <Search className="w-6 h-6 text-blue-400" />
    </div>
    <h3 className="text-sm font-semibold text-slate-600">No Data Found</h3>
    <p className="text-xs text-slate-400 max-w-sm text-center">
      Adjust your filters and click Query to load LPT report data.
    </p>
  </div>
);

// ─── Table Empty ───────────────────────────────────────────────────────────────

const TableEmpty = () => (
  <tr>
    <td colSpan={20} className="py-10 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">No data available.</p>
      </div>
    </td>
  </tr>
);

// ─── LPT Report Table ─────────────────────────────────────────────────────────

const LptReportTable = ({ data }) => {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [perfFilter, setPerfFilter] = useState("All");

  const filtered = useMemo(() => {
    if (perfFilter === "All") return data;
    return data.filter((r) => r.Performance === perfFilter);
  }, [data, perfFilter]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key],
        bv = b[sort.key];
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sort]);

  const toggleSort = (key) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));

  if (!data || data.length === 0) return <TableEmpty />;

  const PERF_FILTERS = [
    { key: "All", color: "blue" },
    { key: "Pass", color: "emerald" },
    { key: "Fail", color: "rose" },
  ];

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500">
          Filter:
        </span>
        {PERF_FILTERS.map(({ key, color }) => {
          const active = perfFilter === key;
          const count =
            key === "All"
              ? data.length
              : data.filter((r) => r.Performance === key).length;
          return (
            <button
              key={key}
              onClick={() => setPerfFilter(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                active
                  ? `bg-${color}-600 text-white border-${color}-600 shadow-sm`
                  : `bg-${color}-50 text-${color}-700 border-${color}-200 hover:bg-${color}-100`
              }`}
            >
              {key} ({count})
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-400">
          Showing {sorted.length} of {data.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[50vh]">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              {[
                { label: "Sr No", key: "SrNo" },
                { label: "Date & Time", key: "DateTime" },
                { label: "Shift", key: "Shift" },
                { label: "Model", key: "ModelName" },
                { label: "Assembly No", key: "AssemblyNo" },
              ].map(({ label, key }) => (
                <th
                  key={label}
                  onClick={() => toggleSort(key)}
                  className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center cursor-pointer hover:text-blue-600"
                  rowSpan={2}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sort.key === key &&
                      (sort.dir === "asc" ? (
                        <ArrowUp className="w-2.5 h-2.5" />
                      ) : (
                        <ArrowDown className="w-2.5 h-2.5" />
                      ))}
                  </span>
                </th>
              ))}
              {METRIC_GROUPS.map((g) => (
                <th
                  key={g.key}
                  colSpan={3}
                  className="px-3 py-2 font-semibold border-b border-slate-200 text-center whitespace-nowrap"
                  style={{ color: g.color }}
                >
                  <span className="inline-flex items-center gap-1">
                    <g.icon className="w-3 h-3" />
                    {g.label}
                  </span>
                </th>
              ))}
              <th
                className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("Performance")}
                rowSpan={2}
              >
                <span className="inline-flex items-center gap-1">
                  Performance
                  {sort.key === "Performance" &&
                    (sort.dir === "asc" ? (
                      <ArrowUp className="w-2.5 h-2.5" />
                    ) : (
                      <ArrowDown className="w-2.5 h-2.5" />
                    ))}
                </span>
              </th>
            </tr>
            <tr className="bg-slate-50">
              {METRIC_GROUPS.map((g) =>
                ["Min", "Max", "Actual"].map((sub) => (
                  <th
                    key={`${g.key}-${sub}`}
                    className="px-3 py-2 font-medium text-slate-500 border-b border-slate-200 text-center whitespace-nowrap text-[10px] uppercase tracking-wide"
                  >
                    {sub}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
              >
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600">
                  {row.SrNo}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                  {row.DateTime
                    ? row.DateTime.replace("T", " ")
                        .replace("Z", "")
                        .slice(0, 19)
                    : "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
                  {row.Shift}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.ModelName}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-700">
                  {row.AssemblyNo}
                </td>
                {METRIC_GROUPS.map((g) => (
                  <>
                    <td
                      key={`${g.key}-min-${i}`}
                      className="px-3 py-2 border-b border-slate-100 text-slate-500"
                    >
                      {row[g.minKey] ?? "—"}
                    </td>
                    <td
                      key={`${g.key}-max-${i}`}
                      className="px-3 py-2 border-b border-slate-100 text-slate-500"
                    >
                      {row[g.maxKey] ?? "—"}
                    </td>
                    <td
                      key={`${g.key}-actual-${i}`}
                      className="px-3 py-2 border-b border-slate-100"
                    >
                      <MetricCell
                        actual={row[g.actualKey]}
                        min={row[g.minKey]}
                        max={row[g.maxKey]}
                      />
                    </td>
                  </>
                ))}
                <td className="px-3 py-2 border-b border-slate-100">
                  <StatusPill status={row.Performance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const LPTReport = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState("");
  const [lastFetched, setLastFetched] = useState(null);

  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  useEffect(() => {
    const t = setTimeout(() => setDetails(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchReport = useCallback(async (params) => {
    const res = await axios.get(`${baseURL}quality/lpt-report`, { params });
    if (res?.data?.success) return res.data.data || [];
    return [];
  }, []);

  const runQuery = useCallback(
    async (params) => {
      setLoading(true);
      setReportData([]);
      try {
        const data = await fetchReport(params);
        setReportData(data);
        setLastFetched(new Date());
        if (data.length === 0) toast.success("No records found.");
        else toast.success(`Loaded ${data.length} records`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch LPT Report.");
      } finally {
        setLoading(false);
      }
    },
    [fetchReport],
  );

  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select a time range.");
      return;
    }
    const params = { startDate: startTime, endDate: endTime };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
    runQuery(params);
  };

  const handleYesterdayQuery = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1);
    const params = {
      startDate: formatDate(yesterday8AM),
      endDate: formatDate(today8AM),
    };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
    runQuery(params);
  };

  const handleTodayQuery = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const params = {
      startDate: formatDate(today8AM),
      endDate: formatDate(now),
    };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
    runQuery(params);
  };

  const handleMTDQuery = () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    );
    const params = {
      startDate: formatDate(startOfMonth),
      endDate: formatDate(now),
    };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
    runQuery(params);
  };

  const filteredData = useMemo(() => {
    if (!Array.isArray(reportData)) return reportData;
    if (!details) return reportData;
    const q = details.toLowerCase();
    return reportData.filter(
      (item) =>
        item.ModelName?.toLowerCase().includes(q) ||
        item.AssemblyNo?.toLowerCase().includes(q) ||
        item.Shift?.toLowerCase().includes(q) ||
        item.Performance?.toLowerCase().includes(q),
    );
  }, [reportData, details]);

  if (variantsLoading) return <Loader />;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            LPT Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Life Performance Test · Quality Intelligence Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
              <Clock className="w-3 h-3" />
              {lastFetched.toLocaleTimeString()}
            </span>
          )}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {filteredData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-100">
            <Target className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-bold text-violet-700">
              Samples: {new Set(reportData.map((r) => r.AssemblyNo)).size}
            </span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
            {/* Left: controls */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="Start Time"
                    name="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="End Time"
                    name="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <SelectField
                    label="Model Variant"
                    options={[{ value: "", label: "All Models" }, ...variants]}
                    value={selectedModelVariant?.value || ""}
                    onChange={(e) =>
                      setSelectedModelVariant(
                        variants.find((o) => o.value === e.target.value) ||
                          null,
                      )
                    }
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Model, Assembly No..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pb-0.5 shrink-0">
                  <button
                    onClick={handleQuery}
                    disabled={loading}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                      loading
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                    }`}
                  >
                    {loading ? (
                      <Spinner cls="w-4 h-4" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {loading ? "Loading..." : "Query"}
                  </button>
                  {reportData.length > 0 && (
                    <ExportButton data={reportData} filename="LPT_Report" />
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Filters */}
            <div className="border-l border-slate-100 pl-5 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Quick Select
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleYesterdayQuery}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  Yesterday
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={handleTodayQuery}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  Today
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={handleMTDQuery}
                  disabled={loading}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    loading
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  Month to Date
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING STATE ── */}
        {loading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching report data...</p>
          </div>
        )}

        {/* ── DATA PANELS ── */}
        {!loading && reportData.length > 0 && (
          <>
            {/* Summary Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Summary
                </span>
              </div>
              <LptSummary data={filteredData} />
            </div>

            {/* Analysis Panels */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <ModelPerformancePanel data={filteredData} />
              <ShiftAnalysisPanel data={filteredData} />
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <Table2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Data Table
                </span>
                <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                  {filteredData.length} rows
                </span>
              </div>
              <div className="p-4">
                <LptReportTable data={filteredData} />
              </div>
            </div>
          </>
        )}

        {/* ── Empty State ── */}
        {!loading && reportData.length === 0 && <EmptyState />}
      </div>
    </div>
  );
};

export default LPTReport;
