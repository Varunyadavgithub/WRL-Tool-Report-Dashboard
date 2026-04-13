import { useEffect, useState, useCallback, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
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
  Search,
  RefreshCw,
  Clock,
  Calendar,
  BarChart2,
  List,
  Tag,
  Cpu,
  Filter,
  ToggleLeft,
  ToggleRight,
  Loader2,
  PackageOpen,
  Factory,
} from "lucide-react";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────

const LINE_STAGE_MAPPING = {
  "Freezer Line": {
    "FG Label": { linecodes: [12501], stationCodes: [1220010] },
    MFT: { linecodes: [12501], stationCodes: [1220014] },
    EST: { linecodes: [12501], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12501], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12501], stationCodes: [1220005] },
    "Post Foaming": {
      linecodes: [12301, 12302],
      stationCodes: [1220003, 1220004],
    },
    Foaming: { linecodes: [12301, 12302], stationCodes: [1220001, 1220002] },
  },
  "Chocolate Line": {
    "FG Label": { linecodes: [12305], stationCodes: [1220010] },
    MFT: { linecodes: [12305], stationCodes: [1220014] },
    EST: { linecodes: [12305], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12305], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12305], stationCodes: [1220005] },
    "Post Foaming": { linecodes: [12305], stationCodes: [1230007] },
    Foaming: { linecodes: [12305], stationCodes: [] },
  },
  "VISI Cooler Line": {
    "FG Label": { linecodes: [12605], stationCodes: [1220010] },
    MFT: { linecodes: [12605], stationCodes: [1220014] },
    EST: { linecodes: [12605], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12605], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12605], stationCodes: [1220005] },
    "Post Comp Scan": { linecodes: [12605], stationCodes: [1240003] },
    "Post Foaming": { linecodes: [12605], stationCodes: [1230012] },
    Foaming: { linecodes: [12605], stationCodes: [] },
  },
  "SUS Line": {
    "FG Label": { linecodes: [12304], stationCodes: [1230017] },
    MFT: { linecodes: [12304], stationCodes: [1230028] },
    EST: { linecodes: [12304], stationCodes: [1230015] },
    "Gas Charging": { linecodes: [12304], stationCodes: [1260010] },
    "Comp Scan 1": { linecodes: [12304], stationCodes: [1230013] },
    "Comp Scan 2": { linecodes: [12304], stationCodes: [1230014] },
    "Post Foaming": { linecodes: [12304], stationCodes: [1230012] },
    Foaming: { linecodes: [12304], stationCodes: [] },
  },
};

const SIMPLE_LINE_OPTIONS = Object.keys(LINE_STAGE_MAPPING).map((l) => ({
  value: l,
  label: l,
}));

// ─── Utilities ─────────────────────────────────────────────────────────────────

const pad = (n) => (n < 10 ? "0" + n : n);
const formatDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

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

const mapCategory = (data, mappings = CATEGORY_MAPPINGS) => {
  if (!data) return [];
  const normalize = (str) => str.replace(/\s+/g, " ").trim().toUpperCase();
  const dataArray = Array.isArray(data) ? data : [data];
  const grouped = {};
  dataArray.forEach((item) => {
    if (!item?.category && item?.TIMEHOUR === undefined) return;
    const normalizedCategory = normalize(item.category || "");
    const finalCategory =
      mappings[normalizedCategory] || item.category?.trim() || "UNKNOWN";
    const timeHour = item.TIMEHOUR || 0;
    const groupKey = `${finalCategory}_${timeHour}`;
    if (grouped[groupKey]) {
      grouped[groupKey].COUNT += item.COUNT || 0;
    } else {
      grouped[groupKey] = {
        category: finalCategory,
        TIMEHOUR: timeHour,
        COUNT: item.COUNT || 0,
      };
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

// ─── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── EmptyState ────────────────────────────────────────────────────────────────
const EmptyState = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="py-10 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">
          No data available. Run a query to see results.
        </p>
      </div>
    </td>
  </tr>
);

// ─── Main Component ─────────────────────────────────────────────────────────────

const HourlyReport = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [isDetailReport, setIsDetailReport] = useState(false);

  // Detail-mode
  const [stationCode, setStationCode] = useState("");
  const [lineType, setLineType] = useState("");
  const [selectedLine, setSelectedLine] = useState(null);

  // Simple-mode
  const [simpleLine, setSimpleLine] = useState("");
  const [simpleStage, setSimpleStage] = useState("");

  // Shared
  const [selectedModel, setSelectedModel] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Data
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [hourData, setHourData] = useState([]);
  const [hourlyModelCount, setHourlyModelCount] = useState([]);
  const [hourlyCategoryCount, setHourlyCategoryCount] = useState([]);

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

  const simpleStageOptions = useMemo(() => {
    if (!simpleLine || !LINE_STAGE_MAPPING[simpleLine]) return [];
    return Object.keys(LINE_STAGE_MAPPING[simpleLine]).map((s) => ({
      value: s,
      label: s,
    }));
  }, [simpleLine]);

  useEffect(() => {
    setSimpleStage("");
  }, [simpleLine]);

  useEffect(() => {
    if (modelsError) toast.error("Failed to load model variants");
    if (stagesError) toast.error("Failed to load stages");
    if (linesError) toast.error("Failed to load production lines");
  }, [modelsError, stagesError, linesError]);

  const buildParams = useCallback(
    (startDate, endDate) => {
      const params = { startDate, endDate };
      if (isDetailReport) {
        if (!stationCode || !lineType) {
          toast.error("Please select a Stage and Production Line.");
          return null;
        }
        params.stationCode = stationCode;
        params.linecode = lineType;
      } else {
        if (!simpleLine || !simpleStage) {
          toast.error("Please select a Line and Stage.");
          return null;
        }
        const mapping = LINE_STAGE_MAPPING[simpleLine]?.[simpleStage];
        if (!mapping) {
          toast.error("Invalid Line / Stage selection.");
          return null;
        }
        if (!mapping.stationCodes.length || !mapping.linecodes.length) {
          toast.error(
            `No station configured for "${simpleStage}" on "${simpleLine}".`,
          );
          return null;
        }
        params.stationCode = mapping.stationCodes.join(",");
        params.linecode = mapping.linecodes.join(",");
      }
      if (selectedModel?.value && selectedModel.value !== "0")
        params.model = selectedModel.value;
      return params;
    },
    [
      isDetailReport,
      stationCode,
      lineType,
      simpleLine,
      simpleStage,
      selectedModel,
    ],
  );

  const fetchAllData = useCallback(
    async (startDate, endDate, setLoadingFn) => {
      const params = buildParams(startDate, endDate);
      if (!params) return;
      setLoadingFn(true);
      setHourData([]);
      setHourlyModelCount([]);
      setHourlyCategoryCount([]);
      try {
        const [summary, modelCount, categoryCount] = await Promise.all([
          fetchHourly(API_ENDPOINTS.summary, params),
          fetchHourly(API_ENDPOINTS.modelCount, params),
          fetchHourly(API_ENDPOINTS.categoryCount, params),
        ]);
        setHourData(summary ?? []);
        setHourlyModelCount(modelCount ?? []);
        setHourlyCategoryCount(mapCategory(categoryCount));
      } catch (error) {
        toast.error("Error fetching hourly data.");
        console.error(error);
      } finally {
        setLoadingFn(false);
      }
    },
    [buildParams],
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

  // ── Derived ────────────────────────────────────────────────────────────────
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
  const activeLineName = useMemo(() => {
    if (isDetailReport) return selectedLine?.label ?? lineType ?? null;
    if (simpleLine && simpleStage) return `${simpleLine} → ${simpleStage}`;
    return null;
  }, [isDetailReport, selectedLine, lineType, simpleLine, simpleStage]);

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

  const isAnyLoading = loading || ydayLoading || todayLoading;

  if (modelsLoading || stagesLoading || linesLoading) return <Loader />;

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Hourly Production Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Real-time manufacturing output analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {autoRefresh && (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium animate-pulse">
              <RefreshCw className="w-3 h-3" /> Auto-refreshing every 5 min
            </span>
          )}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total Count
            </span>
          </div>
          {totalModels > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {totalModels}
              </span>
              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Unique Models
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 min-h-0">
        {/* ── FILTERS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setIsDetailReport((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
                isDetailReport
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {isDetailReport ? (
                <ToggleRight className="w-3.5 h-3.5" />
              ) : (
                <ToggleLeft className="w-3.5 h-3.5" />
              )}
              {isDetailReport ? "Detail Mode" : "Simple Mode"}
            </button>
            <span className="text-[11px] text-slate-400">
              {isDetailReport
                ? "Manually select station code and production line"
                : "Pick a line and stage — codes resolved automatically"}
            </span>
          </div>

          {/* Selectors row */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[170px] flex-1">
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
            </div>

            {isDetailReport ? (
              <>
                <div className="min-w-[170px] flex-1">
                  <SelectField
                    label="Stage Name"
                    value={stationCode}
                    options={[{ value: "", label: "Select Stage" }, ...stages]}
                    onChange={(e) => setStationCode(e.target.value)}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <SelectField
                    label="Production Line"
                    value={lineType}
                    options={[{ value: "", label: "Select Line" }, ...lines]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLineType(val);
                      setSelectedLine(
                        lines.find((l) => l.value === val) || null,
                      );
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="min-w-[170px] flex-1">
                  <SelectField
                    label="Line"
                    value={simpleLine}
                    options={[
                      { value: "", label: "Select Line" },
                      ...SIMPLE_LINE_OPTIONS,
                    ]}
                    onChange={(e) => setSimpleLine(e.target.value)}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <SelectField
                    label="Stage"
                    value={simpleStage}
                    options={[
                      {
                        value: "",
                        label: simpleLine
                          ? "Select Stage"
                          : "Select a line first",
                      },
                      ...simpleStageOptions,
                    ]}
                    onChange={(e) => setSimpleStage(e.target.value)}
                    disabled={!simpleLine}
                  />
                </div>
              </>
            )}

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

            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-0.5 shrink-0">
              {/* Auto Refresh toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${autoRefresh ? "bg-blue-500" : "bg-slate-300"}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${autoRefresh ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                  Auto (5m)
                </span>
              </label>

              <button
                onClick={handleYesterday}
                disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isAnyLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                }`}
              >
                {ydayLoading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                {ydayLoading ? "Loading…" : "Yesterday"}
              </button>
              <button
                onClick={handleToday}
                disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isAnyLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                }`}
              >
                {todayLoading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                {todayLoading ? "Loading…" : "Today"}
              </button>
              <button
                onClick={handleQuery}
                disabled={isAnyLoading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isAnyLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Loading…" : "Query"}
              </button>
            </div>
          </div>

          {/* Active line badge */}
          {activeLineName && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 w-fit">
              <Factory className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">
                {isDetailReport ? "Line:" : "Selection:"}
              </span>
              <span className="text-[11px] font-semibold text-slate-700">
                {activeLineName}
              </span>
            </div>
          )}
        </div>

        {/* ── DATA PANEL ── */}
        {isAnyLoading ? (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching production data…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {/* ── LEFT COLUMN ── */}
            <div className="flex flex-col gap-3">
              {/* Hourly Summary Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <List className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Hourly Production Summary
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:block">
                    · Units produced & distinct models per hour
                  </span>
                </div>
                <div className="overflow-auto max-h-64">
                  <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        {[
                          "Hour",
                          "Time",
                          "Production Count",
                          "No. of Models",
                        ].map((h) => (
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
                      {hourData.length > 0 ? (
                        hourData.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
                          >
                            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400">
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
                        <EmptyState colSpan={4} />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Hourly Production Trend
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:block">
                    · Output count per hour
                  </span>
                </div>
                <div className="p-4 h-64">
                  {chartData ? (
                    <Bar data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                      <BarChart2
                        className="w-8 h-8 opacity-20"
                        strokeWidth={1.2}
                      />
                      <p className="text-xs">No chart data available.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="flex flex-col gap-3">
              {/* Model-wise Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Model-wise Hourly Breakdown
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:block">
                    · Units per model variant
                  </span>
                </div>
                <div className="overflow-auto max-h-64">
                  <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        {["Time", "Model Name", "Count"].map((h) => (
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
                      {hourlyModelCount.length > 0 ? (
                        hourlyModelCount.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
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
                        <EmptyState colSpan={3} />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category-wise Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Category-wise Hourly Breakdown
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:block">
                    · Units per product category
                  </span>
                </div>
                <div className="overflow-auto max-h-64">
                  <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        {["Time", "Category", "Count"].map((h) => (
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
                      {hourlyCategoryCount.length > 0 ? (
                        hourlyCategoryCount.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
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
                        <EmptyState colSpan={3} />
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
