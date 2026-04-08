import { useEffect, useState, useCallback, useMemo } from "react";
import Title from "../../components/ui/Title";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import axios from "axios";
import Loader from "../../components/ui/Loader";
import toast from "react-hot-toast";
import { CATEGORY_MAPPINGS } from "../../utils/mapCategories.js";
import { baseURL } from "../../assets/assets.js";
import {
  useGetModelVariantsQuery,
  useGetStagesQuery,
  useGetProductionLineQuery,
} from "../../redux/api/commonApi.js";
import {
  FiSearch,
  FiRefreshCw,
  FiClock,
  FiCalendar,
  FiBarChart2,
  FiList,
  FiTag,
  FiPackage,
  FiZap,
  FiAlignJustify,
  FiChevronDown,
  FiActivity,
  FiCpu,
  FiFilter,
} from "react-icons/fi";
import { MdOutlineFactory } from "react-icons/md";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─── Utilities ────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  const pad = (n) => (n < 10 ? "0" + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getShiftRange = (offsetDays = 0) => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + offsetDays);
  start.setHours(8, 0, 0, 0);
  const end = offsetDays === 0 ? now : new Date(start);
  if (offsetDays !== 0) {
    end.setDate(start.getDate() + 1);
    end.setHours(8, 0, 0, 0);
  }
  return { start: formatDate(start), end: formatDate(end) };
};

const mapCategory = async (data, mappings = CATEGORY_MAPPINGS) => {
  if (!data) return [];
  const normalize = (str) => str.replace(/\s+/g, " ").trim().toUpperCase();
  const dataArray = Array.isArray(data) ? data : [data];
  const grouped = {};
  dataArray.forEach((item) => {
    const mappedItem = { ...item };
    if (mappedItem?.category || mappedItem?.TIMEHOUR !== undefined) {
      const normalizedCategory = normalize(mappedItem.category || "");
      const finalCategory =
        mappings[normalizedCategory] ||
        mappedItem.category?.trim() ||
        "UNKNOWN";
      const timeHour = mappedItem.TIMEHOUR || 0;
      const groupKey = `${finalCategory}_${timeHour}`;
      if (grouped[groupKey]) {
        grouped[groupKey].COUNT += mappedItem.COUNT || 0;
      } else {
        grouped[groupKey] = {
          category: finalCategory,
          TIMEHOUR: timeHour,
          COUNT: mappedItem.COUNT || 0,
        };
      }
    }
  });
  return Object.values(grouped);
};

// ─── API Layer ─────────────────────────────────────────────────────────────────

const API_ENDPOINTS = {
  summary: "prod/hourly-summary",
  modelCount: "prod/hourly-model-count",
  categoryCount: "prod/hourly-category-count",
};

const fetchHourly = async (endpoint, params) => {
  const res = await axios.get(`${baseURL}${endpoint}`, { params });
  if (!res?.data?.success) throw new Error("Request failed");
  return res.data.data;
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
    {Icon && <Icon size={14} className="text-blue-500 flex-shrink-0" />}
    <div className="flex items-center gap-3">
      <h3 className="text-xs font-semibold text-slate-700 tracking-wide">
        {title}
      </h3>
      {subtitle && (
        <span className="text-xs text-slate-400 hidden sm:block">
          {subtitle}
        </span>
      )}
    </div>
  </div>
);

const StatCard = ({
  label,
  value,
  color = "text-blue-600",
  icon: Icon,
  bg = "from-blue-50 to-blue-100/60",
  border = "border-blue-200",
}) => (
  <div
    className={`bg-gradient-to-br ${bg} rounded-xl px-5 py-4 flex flex-col items-center gap-1 border ${border} flex-1 min-w-[130px]`}
  >
    {Icon && <Icon size={18} className={`${color} mb-0.5`} />}
    <span className={`text-3xl font-bold ${color} tabular-nums`}>{value}</span>
    <span className="text-xs text-slate-500 text-center font-medium leading-tight">
      {label}
    </span>
  </div>
);

const EmptyRow = ({ colSpan }) => (
  <tr>
    <td
      colSpan={colSpan}
      className="text-center py-10 text-slate-400 text-xs italic"
    >
      <div className="flex flex-col items-center gap-2 opacity-60">
        <FiAlignJustify size={20} />
        No data available. Run a query to see results.
      </div>
    </td>
  </tr>
);

const TableWrapper = ({
  icon,
  title,
  subtitle,
  children,
  maxH = "max-h-64",
}) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
    <SectionHeader icon={icon} title={title} subtitle={subtitle} />
    <div className={`overflow-auto ${maxH}`}>{children}</div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const HourlyReport = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [stationCode, setStationCode] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [hourData, setHourData] = useState([]);
  const [hourlyModelCount, setHourlyModelCount] = useState([]);
  const [hourlyCategoryCount, setHourlyCategoryCount] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null); // FIX: kept as object for label lookup
  const [lineType, setLineType] = useState(""); // FIX: string value sent to API

  // ── RTK Queries ────────────────────────────────────────────────────────────
  const {
    data: modelVariants = [],
    isLoading: modelsLoading,
    error: modelsError,
  } = useGetModelVariantsQuery();

  const {
    data: stages = [],
    isLoading: stagesLoading,
    error: stagesError,
  } = useGetStagesQuery();

  const {
    data: lines = [],
    isLoading: linesLoading,
    error: linesError,
  } = useGetProductionLineQuery();

  // ── Side-effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (modelsError) toast.error("Failed to load model variants");
    if (stagesError) toast.error("Failed to load stages");
    if (linesError) toast.error("Failed to load production lines"); // FIX: corrected typo
  }, [modelsError, stagesError, linesError]);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const buildParams = useCallback(
    (startDate, endDate) => {
      const params = { stationCode, startDate, endDate, linecode: lineType };
      if (selectedModel?.value && selectedModel.value !== "0")
        params.model = selectedModel.value;
      return params;
    },
    [stationCode, selectedModel, lineType],
  );

  const fetchAllData = useCallback(
    async (startDate, endDate, setLoadingFn) => {
      if (!stationCode || !selectedLine) {
        toast.error("Please select a Stage / Station Code / Production Line .");
        return;
      }
      setLoadingFn(true);
      setHourData([]);
      setHourlyModelCount([]);
      setHourlyCategoryCount([]);

      try {
        const params = buildParams(startDate, endDate);
        const [summary, modelCount, categoryCount] = await Promise.all([
          fetchHourly(API_ENDPOINTS.summary, params),
          fetchHourly(API_ENDPOINTS.modelCount, params),
          fetchHourly(API_ENDPOINTS.categoryCount, params),
        ]);
        setHourData(summary ?? []);
        setHourlyModelCount(modelCount ?? []);
        setHourlyCategoryCount(await mapCategory(categoryCount));
      } catch (error) {
        toast.error("Error fetching hourly data.");
        console.error(error);
      } finally {
        setLoadingFn(false);
      }
    },
    [buildParams, stationCode],
  );

  const handleQuery = useCallback(() => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return;
    }
    fetchAllData(startTime, endTime, setLoading);
  }, [startTime, endTime, fetchAllData]);

  const handleYesterday = useCallback(() => {
    const { start, end } = getShiftRange(-1);
    fetchAllData(start, end, setYdayLoading);
  }, [fetchAllData]);

  const handleToday = useCallback(() => {
    const { start, end } = getShiftRange(0);
    fetchAllData(start, end, setTodayLoading);
  }, [fetchAllData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(handleQuery, 300_000);
    return () => clearInterval(interval);
  }, [autoRefresh, handleQuery]);

  // ── Derived / Memoized Values ──────────────────────────────────────────────

  const totalCount = useMemo(
    () => hourData.reduce((sum, item) => sum + (item.COUNT || 0), 0),
    [hourData],
  );

  const totalModels = useMemo(
    () => new Set(hourlyModelCount.map((item) => item.Material_Name)).size,
    [hourlyModelCount],
  );

  const getModelCountForHour = useCallback(
    (timehour) =>
      hourlyModelCount.filter((item) => item.TIMEHOUR === timehour).length,
    [hourlyModelCount],
  );

  const { chartData, chartOptions } = useMemo(() => {
    if (!hourData?.length) return { chartData: null, chartOptions: null };

    const maxVal = Math.max(...hourData.map((d) => d.COUNT || 0), 10);

    return {
      chartData: {
        labels: hourData.map((item) => `${item.TIMEHOUR}:00`),
        datasets: [
          {
            label: "Production Count",
            data: hourData.map((item) => item.COUNT || 0),
            backgroundColor: "rgba(59, 130, 246, 0.18)",
            borderColor: "rgba(37, 99, 235, 1)",
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          onComplete: ({ chart }) => {
            const ctx = chart.ctx;
            ctx.font = "bold 11px sans-serif";
            ctx.fillStyle = "#475569";
            ctx.textAlign = "center";
            chart.data.datasets.forEach((dataset, i) => {
              chart.getDatasetMeta(i).data.forEach((bar, idx) => {
                const val = dataset.data[idx];
                if (val != null) ctx.fillText(val, bar.x, bar.y - 6);
              });
            });
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: "#fff",
            titleColor: "#475569",
            bodyColor: "#1e293b",
            borderColor: "#e2e8f0",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(148,163,184,0.15)" },
            title: {
              display: true,
              text: "Hour",
              font: { size: 12, weight: "bold" },
              color: "#94a3b8",
            },
            ticks: { font: { size: 11 }, color: "#94a3b8" },
          },
          y: {
            beginAtZero: true,
            max: maxVal + Math.ceil(maxVal * 0.15) + 5,
            grid: { color: "rgba(148,163,184,0.15)" },
            title: {
              display: true,
              text: "Count",
              font: { size: 12, weight: "bold" },
              color: "#94a3b8",
            },
            ticks: { font: { size: 11 }, color: "#94a3b8" },
          },
        },
      },
    };
  }, [hourData]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isAnyLoading = loading || ydayLoading || todayLoading;

  if (modelsLoading || stagesLoading || linesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 font-sans">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-blue-600 rounded-xl shadow-md shadow-blue-200">
          <MdOutlineFactory size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            Hourly Production Report
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time manufacturing output analysis
          </p>
        </div>
        {autoRefresh && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full animate-pulse">
            <FiRefreshCw size={11} />
            Auto-refreshing every 5 min
          </div>
        )}
      </div>

      {/* ── Filter + Summary Panel ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Filters Card */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionHeader
            icon={FiFilter}
            title="Filters"
            subtitle="Configure your query parameters"
          />
          <div className="p-4 space-y-4">
            {/* Row 1: Selects */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SelectField
                label="Model Variant"
                value={selectedModel?.value || ""}
                options={[{ value: "", label: "All Models" }, ...modelVariants]}
                onChange={(e) => {
                  const found = modelVariants.find(
                    (o) => o.value === e.target.value,
                  );
                  setSelectedModel(found || null);
                }}
              />
              <SelectField
                label="Stage Name"
                name="stationCode"
                value={stationCode}
                options={[{ value: "", label: "Select Stage" }, ...stages]}
                onChange={(e) => setStationCode(e.target.value)}
              />
              <DateTimePicker
                label="Start Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <DateTimePicker
                label="End Time"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            {/* Row 2: Production Line Select + Controls */}
            <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-slate-100">
              {/* FIX: value uses lineType (string), onChange sets both lineType and selectedLine */}
              <SelectField
                label="Production Line"
                name="lines"
                value={lineType}
                options={[{ value: "", label: "Select Line" }, ...lines]}
                onChange={(e) => {
                  const val = e.target.value;
                  setLineType(val);
                  const found = lines.find((l) => l.value === val);
                  setSelectedLine(found || null);
                }}
              />

              {/* Auto Refresh Toggle */}
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none group">
                <div
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                    autoRefresh ? "bg-blue-500" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      autoRefresh ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-slate-500 font-medium group-hover:text-slate-700 transition-colors text-xs">
                  Auto Refresh (5 min)
                </span>
              </label>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleYesterday}
                  disabled={ydayLoading || isAnyLoading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <FiCalendar size={13} />
                  {ydayLoading ? "Loading..." : "Yesterday"}
                </button>
                <button
                  onClick={handleToday}
                  disabled={todayLoading || isAnyLoading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <FiClock size={13} />
                  {todayLoading ? "Loading..." : "Today"}
                </button>
                <button
                  onClick={handleQuery}
                  disabled={loading || isAnyLoading}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
                >
                  <FiSearch size={13} />
                  {loading ? "Loading..." : "Query"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <SectionHeader
            icon={FiActivity}
            title="Summary"
            subtitle="Current query results"
          />
          <div className="p-4 flex flex-col gap-3 flex-1 justify-center">
            <div className="flex gap-3">
              <StatCard
                label="Total Production Count"
                value={totalCount.toLocaleString()}
                color="text-blue-600"
                icon={FiPackage}
                bg="from-blue-50 to-blue-100/40"
                border="border-blue-200"
              />
              <StatCard
                label="Unique Models"
                value={totalModels}
                color="text-violet-600"
                icon={FiCpu}
                bg="from-violet-50 to-violet-100/40"
                border="border-violet-200"
              />
            </div>
            {/* FIX: use selectedLine?.label from lines array instead of undefined PRODUCTION_LINES */}
            {lineType && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <MdOutlineFactory size={13} className="text-slate-400" />
                <span className="text-xs text-slate-400">Line:</span>
                <span className="text-xs font-semibold text-slate-700">
                  {selectedLine?.label ?? lineType}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Data Panel ── */}
      <div className="bg-white/70 rounded-xl border border-slate-200 p-4 shadow-sm">
        {isAnyLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader />
            <p className="text-xs text-slate-400 animate-pulse">
              Fetching production data…
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* ── LEFT COLUMN ── */}
            <div className="flex flex-col gap-4">
              {/* Table 1 – Hourly Production Summary */}
              <TableWrapper
                icon={FiList}
                title="Hourly Production Summary"
                subtitle="Units produced & distinct models per hour"
              >
                <table className="min-w-full border-collapse text-xs text-left">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {[
                        "Hour",
                        "Time",
                        "Production Count",
                        "No. of Models",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 border-b border-slate-200 font-semibold text-slate-500 text-center whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hourData.length > 0 ? (
                      hourData.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-blue-50/50 text-center transition-colors ${
                            idx % 2 === 0 ? "bg-transparent" : "bg-slate-50/60"
                          }`}
                        >
                          <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-400">
                            {item.HOUR_NUMBER}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
                            {item.TIMEHOUR}:00
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600">
                            {item.COUNT?.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-violet-600">
                            {getModelCountForHour(item.TIMEHOUR)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow colSpan={4} />
                    )}
                  </tbody>
                </table>
              </TableWrapper>

              {/* Bar Chart */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                <SectionHeader
                  icon={FiBarChart2}
                  title="Hourly Production Trend"
                  subtitle="Output count per hour"
                />
                <div className="p-4 h-64">
                  {chartData ? (
                    <Bar data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 text-xs italic opacity-60">
                      <FiBarChart2 size={28} />
                      No chart data available.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="flex flex-col gap-4">
              {/* Table 2 – Model-wise Hourly Count */}
              <TableWrapper
                icon={FiCpu}
                title="Model-wise Hourly Breakdown"
                subtitle="Units per model variant each hour"
              >
                <table className="min-w-full border-collapse text-xs text-left">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {["Time", "Model Name", "Count"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 border-b border-slate-200 font-semibold text-slate-500 text-center whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyModelCount.length > 0 ? (
                      hourlyModelCount.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-blue-50/50 text-center transition-colors ${
                            idx % 2 === 0 ? "bg-transparent" : "bg-slate-50/60"
                          }`}
                        >
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.TIMEHOUR}:00
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-left font-medium text-slate-700">
                            {item.Material_Name}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600">
                            {item.COUNT?.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow colSpan={3} />
                    )}
                  </tbody>
                </table>
              </TableWrapper>

              {/* Table 3 – Category-wise Hourly Count */}
              <TableWrapper
                icon={FiTag}
                title="Category-wise Hourly Breakdown"
                subtitle="Units per product category each hour"
              >
                <table className="min-w-full border-collapse text-xs text-left">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {["Time", "Category", "Count"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 border-b border-slate-200 font-semibold text-slate-500 text-center whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyCategoryCount.length > 0 ? (
                      hourlyCategoryCount.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-blue-50/50 text-center transition-colors ${
                            idx % 2 === 0 ? "bg-transparent" : "bg-slate-50/60"
                          }`}
                        >
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                            {item.TIMEHOUR}:00
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-left font-medium text-slate-700">
                            {item.category}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600">
                            {item.COUNT?.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <EmptyRow colSpan={3} />
                    )}
                  </tbody>
                </table>
              </TableWrapper>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HourlyReport;
