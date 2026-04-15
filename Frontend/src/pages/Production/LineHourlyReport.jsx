import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from "chart.js";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets.js";
import { CATEGORY_MAPPINGS } from "../../utils/mapCategories.js";
import HourlyWidget from "../../components/lineHourly/HourlyWidget.jsx";
import {
  Factory,
  Truck,
  Settings,
  Search,
  Download,
  Calendar,
  History,
  Moon,
  Sun,
  Gauge,
  Loader2,
  RefreshCw,
  Zap,
  Wind,
} from "lucide-react";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
);

// ── Utilities ──────────────────────────────────────────────────────────────────
const normaliseDateTime = (dt) => (dt ? dt.replace("T", " ") : "");
const pad = (n) => String(n).padStart(2, "0");
const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const mapCategory = (data, mappings = CATEGORY_MAPPINGS) => {
  if (!data?.length) return [];
  const norm = (s) => s.replace(/\s+/g, " ").trim().toUpperCase();
  const grouped = {};
  for (const item of data) {
    if (!item?.category) continue;
    const key = mappings[norm(item.category)] || item.category.trim();
    grouped[key]
      ? (grouped[key].TotalCount += item.TotalCount || 0)
      : (grouped[key] = { category: key, TotalCount: item.TotalCount || 0 });
  }
  return Object.values(grouped).sort((a, b) => b.TotalCount - a.TotalCount);
};

// ── Constants ──────────────────────────────────────────────────────────────────
const LINE_TABS = [
  { value: "final_line", label: "Final", icon: Factory },
  { value: "final_loading", label: "Loading", icon: Truck },
  { value: "post_Foaming", label: "Post Foaming", icon: Wind },
  { value: "Foaming", label: "Foaming", icon: Settings },
];

const EMPTY = {
  finalFreezerLoading: [],
  finalChocLoading: [],
  finalSUSLoading: [],
  finalCategoryLoading: [],
  visiLoading: [],
  finalFreezer: [],
  finalChoc: [],
  finalSUS: [],
  finalCategory: [],
  visiFinal: [],
  postFreezer: [],
  manualPost: [],
  postSUS: [],
  postCategory: [],
  visiPost: [],
  foamA: [],
  foamB: [],
  foamCategory: [],
  finalFreezerLoadingModel: [],
  finalChocLoadingModel: [],
  finalSUSLoadingModel: [],
  visiLoadingModel: [],
  finalFreezerModel: [],
  finalChocModel: [],
  finalSUSModel: [],
  visiFinalModel: [],
  postFreezerModel: [],
  manualPostModel: [],
  postSUSModel: [],
  visiPostModel: [],
  foamAModel: [],
  foamBModel: [],
};

const CHART = {
  sky: "rgba(14,165,233,0.72)",
  amber: "rgba(245,158,11,0.72)",
  slate: "rgba(100,116,139,0.65)",
  teal: "rgba(20,184,166,0.70)",
};

// ── How tall one data-row is (px) — tune once to match HourlyWidget ──
const ROW_H = 34;
const WIDGET_CHROME = 120;
const MAX_VISIBLE_ROWS = 13;
const WIDGET_MIN_H = WIDGET_CHROME + ROW_H * MAX_VISIBLE_ROWS;

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Main Component ─────────────────────────────────────────────────────────────
const LineHourlyReport = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineType, setLineType] = useState("final_line");
  const [apiData, setApiData] = useState(EMPTY);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown] = useState(300);

  const refreshRef = useRef(null);
  const cdRef = useRef(null);
  const paramsRef = useRef({ StartTime: "", EndTime: "" });
  const lineTypeRef = useRef(lineType);
  useEffect(() => {
    lineTypeRef.current = lineType;
  }, [lineType]);

  const API = `${baseURL}prod`;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchForType = useCallback(
    async (lt, params) => {
      const get = (path) => axios.get(`${API}/${path}`, { params });
      const safe = (r) =>
        r.status === "fulfilled" && r.value?.data?.success
          ? r.value.data.data || []
          : [];

      if (lt === "final_loading") {
        const [r1, r2, r3, r4, r5, m1, m2, m3, m4] = await Promise.allSettled([
          get("final-loading-hp-frz"),
          get("final-loading-hp-choc"),
          get("final-loading-hp-sus"),
          get("final-loading-hp-cat"),
          get("visi-loading-hp"),
          get("final-loading-hp-frz-model"),
          get("final-loading-hp-choc-model"),
          get("final-loading-hp-sus-model"),
          get("final-loading-hp-visi-model"),
        ]);
        return {
          finalFreezerLoading: safe(r1),
          finalChocLoading: safe(r2),
          finalSUSLoading: safe(r3),
          finalCategoryLoading: mapCategory(safe(r4)),
          visiLoading: safe(r5),
          finalFreezerLoadingModel: safe(m1),
          finalChocLoadingModel: safe(m2),
          finalSUSLoadingModel: safe(m3),
          visiLoadingModel: safe(m4),
        };
      }
      if (lt === "final_line") {
        const [r1, r2, r3, r4, r5, m1, m2, m3, m4] = await Promise.allSettled([
          get("final-hp-frz"),
          get("final-hp-choc"),
          get("final-hp-sus"),
          get("final-hp-cat"),
          get("visi-final-hp"),
          get("final-hp-frz-model"),
          get("final-hp-choc-model"),
          get("final-hp-sus-model"),
          get("visi-final-hp-model"),
        ]);
        return {
          finalFreezer: safe(r1),
          finalChoc: safe(r2),
          finalSUS: safe(r3),
          finalCategory: mapCategory(safe(r4)),
          visiFinal: safe(r5),
          finalFreezerModel: safe(m1),
          finalChocModel: safe(m2),
          finalSUSModel: safe(m3),
          visiFinalModel: safe(m4),
        };
      }
      if (lt === "post_Foaming") {
        const [r1, r2, r3, r4, r5, m1, m2, m3, m4] = await Promise.allSettled([
          get("post-hp-frz"),
          get("manual-post-hp"),
          get("post-hp-sus"),
          get("post-hp-cat"),
          get("visi-post-hp"),
          get("post-hp-frz-model"),
          get("manual-post-hp-model"),
          get("post-hp-sus-model"),
          get("visi-post-hp-model"),
        ]);
        return {
          postFreezer: safe(r1),
          manualPost: safe(r2),
          postSUS: safe(r3),
          postCategory: mapCategory(safe(r4)),
          visiPost: safe(r5),
          postFreezerModel: safe(m1),
          manualPostModel: safe(m2),
          postSUSModel: safe(m3),
          visiPostModel: safe(m4),
        };
      }
      if (lt === "Foaming") {
        const [r1, r2, r3, m1, m2] = await Promise.allSettled([
          get("Foaming-hp-fom-a"),
          get("Foaming-hp-fom-b"),
          get("Foaming-hp-fom-cat"),
          get("Foaming-hp-fom-a-model"),
          get("Foaming-hp-fom-b-model"),
        ]);
        return {
          foamA: safe(r1),
          foamB: safe(r2),
          foamCategory: mapCategory(safe(r3)),
          foamAModel: safe(m1),
          foamBModel: safe(m2),
        };
      }
      return {};
    },
    [API],
  );

  const runFetch = useCallback(
    async (params, lt) => {
      setLoading(true);
      setApiData(EMPTY);
      try {
        const updates = await fetchForType(lt, params);
        setApiData((prev) => ({ ...prev, ...updates }));
        setLastFetched(new Date());
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    },
    [fetchForType],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Select a time range first.");
      return;
    }
    const p = {
      StartTime: normaliseDateTime(startTime),
      EndTime: normaliseDateTime(endTime),
    };
    paramsRef.current = p;
    runFetch(p, lineType);
  };

  const handleToday = () => {
    const now = new Date(),
      s = new Date(now);
    s.setHours(8, 0, 0, 0);
    const p = { StartTime: formatDate(s), EndTime: formatDate(now) };
    paramsRef.current = p;
    runFetch(p, lineType);
  };
  
  const handleYesterday = () => {
    const e = new Date();
    e.setHours(8, 0, 0, 0);
    const s = new Date(e);
    s.setDate(s.getDate() - 1);
    const p = { StartTime: formatDate(s), EndTime: formatDate(e) };
    paramsRef.current = p;
    runFetch(p, lineType);
  };

  // ── Auto-refresh ───────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(refreshRef.current);
    clearInterval(cdRef.current);
    if (!autoRefresh) return;
    setCountdown(300);
    cdRef.current = setInterval(
      () => setCountdown((c) => (c <= 1 ? 300 : c - 1)),
      1000,
    );
    refreshRef.current = setInterval(() => {
      const p = paramsRef.current;
      if (p.StartTime && p.EndTime) {
        runFetch(p, lineTypeRef.current);
        setCountdown(300);
      }
    }, 300_000);
    return () => {
      clearInterval(refreshRef.current);
      clearInterval(cdRef.current);
    };
  }, [autoRefresh, runFetch]);

  // ── Derived: stat cards + grand total ─────────────────────────────────────
  const { summaryCards, grandTotal } = useMemo(() => {
    const d = apiData;
    let cards = [];
    if (lineType === "final_line") {
      const frz = d.finalFreezer.reduce((s, r) => s + (r.COUNT || 0), 0);
      const choc = d.finalChoc.reduce((s, r) => s + (r.COUNT || 0), 0);
      const sus = d.finalSUS.reduce((s, r) => s + (r.COUNT || 0), 0);
      const visi = d.visiFinal.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Freezer", value: frz, color: "blue" },
        { label: "Choc", value: choc, color: "amber" },
        { label: "SUS", value: sus, color: "violet" },
        { label: "VISI", value: visi, color: "emerald" },
        {
          label: "Grand Total",
          value: frz + choc + sus + visi,
          highlight: true,
        },
      ];
    } else if (lineType === "final_loading") {
      const frz = d.finalFreezerLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      const choc = d.finalChocLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      const sus = d.finalSUSLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      const visi = d.visiLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Frz Load", value: frz, color: "blue" },
        { label: "Choc Load", value: choc, color: "amber" },
        { label: "SUS Load", value: sus, color: "violet" },
        { label: "VISI Load", value: visi, color: "emerald" },
        {
          label: "Grand Total",
          value: frz + choc + sus + visi,
          highlight: true,
        },
      ];
    } else if (lineType === "post_Foaming") {
      const pf = d.postFreezer.reduce(
        (s, r) => s + (r.GroupA_Count || 0) + (r.CHOC_Count || 0),
        0,
      );
      const mp = d.manualPost.reduce(
        (s, r) => s + (r.GroupB_Count || 0) + (r.FOW_Count || 0),
        0,
      );
      const sus = d.postSUS.reduce((s, r) => s + (r.COUNT || 0), 0);
      const visi = d.visiPost.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Post Frz", value: pf, color: "blue" },
        { label: "Manual", value: mp, color: "amber" },
        { label: "Post SUS", value: sus, color: "violet" },
        { label: "VISI", value: visi, color: "emerald" },
        {
          label: "Grand Total",
          value: pf + mp + sus + visi,
          highlight: true,
        },
      ];
    } else if (lineType === "Foaming") {
      const a = d.foamA.reduce((s, r) => s + (r.COUNT || 0), 0);
      const b = d.foamB.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Station A", value: a, color: "blue" },
        { label: "Station B", value: b, color: "amber" },
        { label: "Grand Total", value: a + b, highlight: true },
      ];
    }
    return {
      summaryCards: cards,
      grandTotal: cards.find((c) => c.highlight)?.value || 0,
    };
  }, [apiData, lineType]);

  // ── Derived: insights ──────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!grandTotal) return null;
    const d = apiData;
    const hourMap = {};
    const addRows = (arr, keys = ["COUNT"]) => {
      for (const r of arr) {
        const h = r.TIMEHOUR ?? -1;
        if (h < 0) continue;
        hourMap[h] =
          (hourMap[h] || 0) + keys.reduce((s, k) => s + (r[k] || 0), 0);
      }
    };
    if (lineType === "final_line") {
      addRows(d.finalFreezer);
      addRows(d.finalChoc);
      addRows(d.finalSUS);
      addRows(d.visiFinal);
    } else if (lineType === "final_loading") {
      addRows(d.finalFreezerLoading);
      addRows(d.finalChocLoading);
      addRows(d.finalSUSLoading);
      addRows(d.visiLoading);
    } else if (lineType === "post_Foaming") {
      addRows(d.postFreezer, ["GroupA_Count", "CHOC_Count"]);
      addRows(d.manualPost, ["GroupB_Count", "FOW_Count"]);
      addRows(d.postSUS);
      addRows(d.visiPost);
    } else if (lineType === "Foaming") {
      addRows(d.foamA);
      addRows(d.foamB);
    }
    const hours = Object.entries(hourMap);
    if (!hours.length) return null;
    const avg = Math.round(grandTotal / hours.length);
    const peakEntry = hours.reduce((m, e) => (e[1] > m[1] ? e : m), hours[0]);
    let day = 0,
      night = 0;
    for (const [h, v] of hours) {
      const n = Number(h);
      if (n >= 8 && n < 20) day += v;
      else night += v;
    }
    const dayPct = grandTotal > 0 ? Math.round((day / grandTotal) * 100) : 0;
    return {
      avg,
      peakHour: peakEntry[0],
      peakCount: peakEntry[1],
      dayPct,
    };
  }, [apiData, lineType, grandTotal]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportAll = () => {
    const d = apiData;
    let rows = [];
    const hr = (arr, label, keys = ["COUNT"]) =>
      arr.map((r) => [
        label,
        r.HOUR_NUMBER || r.HourNumber || "—",
        `${r.TIMEHOUR ?? ""}:00`,
        ...keys.map((k) => r[k] || 0),
      ]);
    const cat = (arr, label) =>
      arr.map((r) => [label, "—", r.category, r.TotalCount || 0]);
    if (lineType === "final_line") {
      rows = [
        ...hr(d.finalFreezer, "Freezer"),
        ...hr(d.finalChoc, "Choc"),
        ...hr(d.finalSUS, "SUS"),
        ...hr(d.visiFinal, "VISI"),
        ...cat(d.finalCategory, "Category"),
      ];
    } else if (lineType === "final_loading") {
      rows = [
        ...hr(d.finalFreezerLoading, "Frz Load"),
        ...hr(d.finalChocLoading, "Choc Load"),
        ...hr(d.finalSUSLoading, "SUS Load"),
        ...hr(d.visiLoading, "VISI Load"),
        ...cat(d.finalCategoryLoading, "Category"),
      ];
    } else if (lineType === "post_Foaming") {
      rows = [
        ...d.postFreezer.map((r) => [
          "Post Frz",
          r.HourNumber || "—",
          `${r.TIMEHOUR ?? 0}:00`,
          r.GroupA_Count || 0,
          r.CHOC_Count || 0,
        ]),
        ...d.manualPost.map((r) => [
          "Manual",
          r.HourNumber || "—",
          `${r.TIMEHOUR ?? 0}:00`,
          r.GroupB_Count || 0,
          r.FOW_Count || 0,
        ]),
        ...hr(d.postSUS, "SUS"),
        ...hr(d.visiPost, "VISI"),
        ...cat(d.postCategory, "Category"),
      ];
    } else if (lineType === "Foaming") {
      rows = [
        ...hr(d.foamA, "Foam A"),
        ...hr(d.foamB, "Foam B"),
        ...cat(d.foamCategory, "Category"),
      ];
    }
    if (!rows.length) {
      toast.error("No data to export.");
      return;
    }
    const csv = [
      ["Section", "Hour#", "Time/Category", "Count A", "Count B"],
      ...rows,
    ]
      .map((r) => r.join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `LineHourly_${lineType}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Widget configs ─────────────────────────────────────────────────────────
  const widgetConfig = useMemo(() => {
    const d = apiData;
    const { sky, amber, slate, teal } = CHART;
    const configs = {
      final_line: [
        {
          title: "Final Freezer",
          data: d.finalFreezer,
          modelData: d.finalFreezerModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Final Choc",
          data: d.finalChoc,
          modelData: d.finalChocModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "Final SUS",
          data: d.finalSUS,
          modelData: d.finalSUSModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: "VISI Cooler",
          data: d.visiFinal,
          modelData: d.visiFinalModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "Category Breakdown",
          data: d.finalCategory,
          modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],
      final_loading: [
        {
          title: "Freezer Loading",
          data: d.finalFreezerLoading,
          modelData: d.finalFreezerLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Choc Loading",
          data: d.finalChocLoading,
          modelData: d.finalChocLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "SUS Loading",
          data: d.finalSUSLoading,
          modelData: d.finalSUSLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: "VISI Loading",
          data: d.visiLoading,
          modelData: d.visiLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "Category Breakdown",
          data: d.finalCategoryLoading,
          modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],
      post_Foaming: [
        {
          title: "Post Foam Frz",
          data: d.postFreezer,
          modelData: d.postFreezerModel,
          datasets: [
            { key: "GroupA_Count", label: "Group A", color: sky },
            { key: "CHOC_Count", label: "CHOC", color: amber },
          ],
        },
        {
          title: "Manual Post",
          data: d.manualPost,
          modelData: d.manualPostModel,
          datasets: [
            { key: "GroupB_Count", label: "Group B", color: sky },
            { key: "FOW_Count", label: "FOW", color: amber },
          ],
        },
        {
          title: "Post SUS",
          data: d.postSUS,
          modelData: d.postSUSModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: "VISI Post",
          data: d.visiPost,
          modelData: d.visiPostModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "Category Breakdown",
          data: d.postCategory,
          modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],
      Foaming: [
        {
          title: "Station A",
          data: d.foamA,
          modelData: d.foamAModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Station B",
          data: d.foamB,
          modelData: d.foamBModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "Category Breakdown",
          data: d.foamCategory,
          modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],
    };
    return configs[lineType] || [];
  }, [apiData, lineType]);

  const is5 = widgetConfig.length === 5;

  // ── Stat card color map ────────────────────────────────────────────────────
  const cardColorMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    violet: "bg-violet-50 border-violet-100 text-violet-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — always pinned at top, never scrolls ── */}
      <div className="shrink-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Line Hourly Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Production monitoring · Real-time output analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <>
              <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-medium">
                <Zap className="w-3 h-3" /> Peak {insights.peakHour}:00 ·{" "}
                {insights.peakCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                <Gauge className="w-3 h-3" /> {insights.avg.toLocaleString()}/hr
                avg
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
                <Sun className="w-3 h-3 text-yellow-500" /> {insights.dayPct}%
                <Moon className="w-3 h-3 text-violet-500 ml-1" />{" "}
                {100 - insights.dayPct}%
              </span>
            </>
          )}
          {autoRefresh && (
            <span className="flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-medium animate-pulse">
              <RefreshCw className="w-3 h-3" /> {countdown}s
            </span>
          )}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {grandTotal.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Grand Total
            </span>
          </div>
          {lastFetched && (
            <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-[80px]">
              <span className="text-[11px] font-mono text-slate-600 font-semibold">
                {lastFetched.toLocaleTimeString()}
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                Last Fetch
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE BODY — everything below the header scrolls ── */}
      <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-3">
        {/* ── TOOLBAR CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            {/* Datetime inputs */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 w-44"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 w-44"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-0.5">
              <button
                onClick={handleYesterday}
                disabled={loading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <History className="w-4 h-4" />
                )}
                Yesterday
              </button>
              <button
                onClick={handleToday}
                disabled={loading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                Today
              </button>
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
                {loading ? "Loading…" : "Query"}
              </button>
              <button
                onClick={exportAll}
                disabled={loading || !grandTotal}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  loading || !grandTotal
                    ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-slate-200 shrink-0" />

            {/* Line tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {LINE_TABS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setLineType(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    lineType === value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/70"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Auto refresh toggle */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">
                Auto (5m)
              </span>
              <div
                onClick={() => setAutoRefresh((p) => !p)}
                className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors ${
                  autoRefresh ? "bg-blue-500" : "bg-slate-300"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    autoRefresh ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ROW ── */}
        {summaryCards.length > 0 && (
          <div className="flex gap-2 shrink-0">
            {summaryCards.map((card, i) =>
              card.highlight ? (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 min-w-[120px]"
                >
                  <span className="text-slate-400 text-xs font-medium truncate">
                    {card.label}
                  </span>
                  <span className="font-mono font-bold text-white text-sm ml-auto shrink-0">
                    {card.value.toLocaleString()}
                  </span>
                </div>
              ) : (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border flex-1 min-w-0 ${
                    cardColorMap[card.color] ||
                    "bg-white border-slate-200 text-slate-700"
                  }`}
                >
                  <span className="text-xs font-medium truncate opacity-80">
                    {card.label}
                  </span>
                  <span className="font-mono font-bold text-sm ml-auto shrink-0">
                    {card.value.toLocaleString()}
                  </span>
                </div>
              ),
            )}
          </div>
        )}

        {/* ── WIDGET GRID ──
            • Each widget has minHeight so H1–H13 show without scroll
            • If data > 13 rows, the widget's internal table scrolls
            • The whole body panel scrolls if grid is taller than viewport
        ── */}
        <div className="shrink-0">
          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gridTemplateRows: is5
                  ? `repeat(2, minmax(${WIDGET_MIN_H}px, auto))`
                  : `minmax(${WIDGET_MIN_H}px, auto)`,
                gap: 10,
              }}
            >
              {Array.from({ length: is5 ? 5 : 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 animate-pulse overflow-hidden"
                  style={{
                    gridColumn: is5 && i === 4 ? "span 2" : undefined,
                    minHeight: WIDGET_MIN_H,
                  }}
                >
                  <div className="h-9 bg-slate-50 border-b border-slate-100" />
                  <div className="p-3 space-y-2">
                    {[70, 85, 60, 75].map((w, j) => (
                      <div
                        key={j}
                        className="h-3 bg-slate-100 rounded"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gridTemplateRows: is5
                  ? `repeat(2, minmax(${WIDGET_MIN_H}px, auto))`
                  : `minmax(${WIDGET_MIN_H}px, auto)`,
                gap: 10,
              }}
            >
              {widgetConfig.map((wc, i) => {
                let gridColumn = undefined;
                if (is5 && i === 3) gridColumn = "1";
                if (is5 && i === 4) gridColumn = "2 / span 2";
                return (
                  <div
                    key={i}
                    style={{
                      gridColumn,
                      minHeight: WIDGET_MIN_H,
                    }}
                  >
                    <HourlyWidget
                      title={wc.title}
                      data={wc.data}
                      modelData={wc.modelData}
                      datasets={wc.datasets}
                      isCategoryChart={!!wc.isCategoryChart}
                      icon={wc.icon}
                      maxVisibleRows={MAX_VISIBLE_ROWS}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LineHourlyReport;
