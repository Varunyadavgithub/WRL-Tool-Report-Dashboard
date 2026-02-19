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
} from "../../redux/api/commonApi.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─── Utilities ────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  const pad = (n) => (n < 10 ? "0" + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
const TableHeader = ({ title, subtitle }) => (
  <div className="px-3 py-2 bg-gray-200 border-b border-gray-200 flex gap-4">
    <h3 className="text-sm font-semibold text-black">{title}</h3>
    {subtitle && <p className="text-xs text-black mt-0.5">{subtitle}</p>}
  </div>
);

const StatCard = ({ label, value, color = "text-blue-700" }) => (
  <div className="bg-white rounded-lg px-4 py-3 flex flex-col items-center shadow-sm border border-purple-200 min-w-[120px]">
    <span className={`text-2xl font-bold ${color}`}>{value}</span>
    <span className="text-xs text-gray-500 mt-0.5 text-center font-medium">
      {label}
    </span>
  </div>
);

const EmptyRow = ({ colSpan }) => (
  <tr>
    <td
      colSpan={colSpan}
      className="text-center py-8 text-gray-400 text-xs italic"
    >
      No data available. Please run a query.
    </td>
  </tr>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const HourlyReport = () => {
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
  const [lineType, setLineType] = useState("1");

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

  useEffect(() => {
    if (modelsError) toast.error("Failed to load model variants");
    if (stagesError) toast.error("Failed to load stages");
  }, [modelsError, stagesError]);

  if (modelsLoading || stagesLoading) return <Loader />;

  // ─── Data Fetching ───────────────────────────────────────────────────────────

  const buildParams = useCallback(
    (startDate, endDate) => {
      const params = { stationCode, startDate, endDate };
      if (selectedModel?.value && selectedModel.value !== "0")
        params.model = selectedModel.value;
      if (lineType) params.line = lineType;
      return params;
    },
    [stationCode, selectedModel, lineType],
  );

  const fetchAllData = useCallback(
    async (startDate, endDate, setLoadingFn) => {
      if (!stationCode) {
        toast.error("Please select a Station Code.");
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
        setHourData(summary);
        setHourlyModelCount(modelCount);
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
      toast.error("Please select Station Code and Time Range.");
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
    const interval = setInterval(handleQuery, 300000);
    return () => clearInterval(interval);
  }, [autoRefresh, handleQuery]);

  // ─── Derived / Memoized Values ───────────────────────────────────────────────

  const totalCount = useMemo(
    () => hourData.reduce((sum, item) => sum + item.COUNT, 0),
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
    if (!hourData || hourData.length === 0)
      return { chartData: null, chartOptions: null };

    const chartData = {
      labels: hourData.map((item) => `${item.TIMEHOUR}:00`),
      datasets: [
        {
          label: "Production Count",
          data: hourData.map((item) => item.COUNT || 0),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderRadius: 5,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        onComplete: (animationContext) => {
          const chart = animationContext.chart;
          const ctx = chart.ctx;
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#000";
          ctx.textAlign = "center";
          chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar, index) => {
              const value = dataset.data[index];
              if (value !== null && value !== undefined)
                ctx.fillText(value, bar.x, bar.y - 6);
            });
          });
        },
      },
      plugins: { legend: { display: true }, tooltip: { enabled: true } },
      scales: {
        x: {
          title: {
            display: true,
            text: "Hour",
            font: { size: 14, weight: "bold" },
            color: "#333",
          },
          ticks: { font: { size: 11 }, color: "#666" },
        },
        y: {
          beginAtZero: true,
          max: Math.max(...hourData.map((item) => item.COUNT || 0), 10) + 10,
          title: {
            display: true,
            text: "Count",
            font: { size: 14, weight: "bold" },
            color: "#333",
          },
          ticks: { font: { size: 11 }, color: "#666" },
        },
      },
    };

    return { chartData, chartOptions };
  }, [hourData]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isAnyLoading = loading || ydayLoading || todayLoading;

  return (
    <div className="p-4 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Hourly Production Report" align="center" />

      {/* ── Filter Panel ── */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Filters */}
        <div className="lg:col-span-2 bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl">
          <h2 className="text-sm font-bold text-purple-800 uppercase tracking-widest mb-3">
            Filters
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SelectField
              label="Model Variant"
              value={selectedModel?.value || ""}
              options={modelVariants}
              onChange={(e) => {
                const selected = modelVariants.find(
                  (opt) => opt.value === e.target.value,
                );
                setSelectedModel(selected || null);
              }}
            />
            <SelectField
              label="Stage Name"
              name="stationCode"
              value={stationCode}
              options={stages}
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

          {/* Controls Row */}
          <div className="flex flex-wrap items-center gap-6 mt-4 pt-3 border-t border-purple-300">
            {/* Line Type */}
            <div>
              <p className="text-xs font-semibold text-purple-800 mb-1">
                Production Line
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="lineType"
                    value="1"
                    checked={lineType === "1"}
                    onChange={(e) => setLineType(e.target.value)}
                  />
                  Freezer Line
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="lineType"
                    value="2"
                    checked={lineType === "2"}
                    onChange={(e) => setLineType(e.target.value)}
                  />
                  Chocolate Line
                </label>
              </div>
            </div>

            {/* Auto Refresh */}
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
              />
              Auto Refresh (5 min)
            </label>

            {/* Query Button */}
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor="text-white"
              className={`font-semibold px-6 ${loading ? "cursor-not-allowed" : ""}`}
              onClick={handleQuery}
              disabled={loading}
            >
              {loading ? "Loading..." : "Query"}
            </Button>
          </div>
        </div>

        {/* Right panel: Stats + Quick Filters */}
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl flex-1">
            <h2 className="text-sm font-bold text-purple-800 uppercase tracking-widest mb-3">
              Summary
            </h2>
            <div className="flex gap-3 flex-wrap">
              <StatCard
                label="Total Production Count"
                value={totalCount}
                color="text-blue-700"
              />
              <StatCard
                label="Total Unique Models"
                value={totalModels}
                color="text-purple-700"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl">
            <h2 className="text-sm font-bold text-purple-800 uppercase tracking-widest mb-3">
              Quick Filters
            </h2>
            <div className="flex gap-3 items-center">
              <Button
                bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
                textColor="text-black"
                className={`font-semibold ${ydayLoading ? "cursor-not-allowed" : "cursor-pointer"}`}
                onClick={handleYesterday}
                disabled={ydayLoading}
              >
                {ydayLoading ? "Loading..." : "Yesterday"}
              </Button>
              <Button
                bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
                textColor="text-white"
                className={`font-semibold ${todayLoading ? "cursor-not-allowed" : "cursor-pointer"}`}
                onClick={handleToday}
                disabled={todayLoading}
              >
                {todayLoading ? "Loading..." : "Today"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Data Panel ── */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        {isAnyLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* ── LEFT COLUMN ── */}
            <div className="flex flex-col gap-4">
              {/* Table 1 – Hourly Production Summary */}
              <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden flex flex-col">
                <TableHeader
                  title="Hourly Production Summary"
                  subtitle="Total units produced and distinct models run per hour"
                />
                <div className="overflow-auto max-h-64">
                  <table className="min-w-full border-collapse text-xs text-left">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Hour
                        </th>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Time (Hour)
                        </th>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Production Count
                        </th>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          No. of Models
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourData.length > 0 ? (
                        hourData.map((item, index) => (
                          <tr
                            key={index}
                            className={`hover:bg-blue-50 text-center ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            <td className="px-3 py-1.5 border border-gray-200 font-medium text-gray-600">
                              {item.HOUR_NUMBER}
                            </td>
                            <td className="px-3 py-1.5 border border-gray-200">
                              {item.TIMEHOUR}:00
                            </td>
                            <td className="px-3 py-1.5 border border-gray-200 font-semibold text-blue-700">
                              {item.COUNT}
                            </td>
                            <td className="px-3 py-1.5 border border-gray-200 font-semibold text-purple-700">
                              {getModelCountForHour(item.TIMEHOUR)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <EmptyRow colSpan={4} />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden flex flex-col">
                <TableHeader
                  title="Hourly Production Trend"
                  subtitle="Bar chart showing production count per hour"
                />
                <div className="p-4 h-64">
                  {chartData ? (
                    <Bar data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs italic">
                      No chart data available.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="flex flex-col gap-4">
              {/* Table 2 – Model-wise Hourly Count */}
              <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden flex flex-col">
                <TableHeader
                  title="Model-wise Hourly Breakdown"
                  subtitle="Number of units produced per model variant in each hour"
                />
                <div className="overflow-auto max-h-64">
                  <table className="min-w-full border-collapse text-xs text-left">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Time (Hour)
                        </th>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Model Name
                        </th>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyModelCount.length > 0 ? (
                        hourlyModelCount.map((item, index) => (
                          <tr
                            key={index}
                            className={`hover:bg-blue-50 text-center ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            <td className="px-3 py-1.5 border border-gray-200">
                              {item.TIMEHOUR}:00
                            </td>
                            <td className="px-3 py-1.5 border border-gray-200 text-left font-medium">
                              {item.Material_Name}
                            </td>
                            <td className="px-3 py-1.5 border border-gray-200 font-semibold text-blue-700">
                              {item.COUNT}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <EmptyRow colSpan={3} />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 3 – Category-wise Hourly Count */}
              <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden flex flex-col">
                <TableHeader
                  title="Category-wise Hourly Breakdown"
                  subtitle="Number of units produced per product category in each hour"
                />
                <div className="overflow-auto max-h-64">
                  <table className="min-w-full border-collapse text-xs text-left">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Time (Hour)
                        </th>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Category
                        </th>
                        <th className="px-3 py-2 border border-gray-200 font-semibold text-center">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyCategoryCount.length > 0 ? (
                        hourlyCategoryCount.map((item, index) => (
                          <tr
                            key={index}
                            className={`hover:bg-blue-50 text-center ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            <td className="px-3 py-1.5 border border-gray-200">
                              {item.TIMEHOUR}:00
                            </td>
                            <td className="px-3 py-1.5 border border-gray-200 text-left font-medium">
                              {item.category}
                            </td>
                            <td className="px-3 py-1.5 border border-gray-200 font-semibold text-blue-700">
                              {item.COUNT}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <EmptyRow colSpan={3} />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HourlyReport;
