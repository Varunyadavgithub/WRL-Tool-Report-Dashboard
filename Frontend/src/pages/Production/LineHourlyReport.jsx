/**
 * LineHourlyReport.jsx — with per-hour model breakdown
 *
 * Changes vs previous version:
 *  • EMPTY state gains modelData keys for every widget
 *  • fetchForType fetches model breakdown in parallel with hourly counts
 *  • widgetConfig passes modelData={...} to each HourlyWidget
 *  • HourlyWidget already supports expandable rows via modelData prop — no changes needed there
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Chart as ChartJS, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend, LineElement, PointElement,
} from "chart.js";
import axios from "axios";
import toast from "react-hot-toast";
import {
  MdFactory, MdLocalShipping, MdBubbleChart, MdSettings,
  MdRefresh, MdDownload, MdSearch, MdCalendarToday, MdHistory,
  MdTrendingUp, MdAccessTime, MdNightlight, MdWbSunny,
  MdDashboard, MdBarChart, MdAcUnit, MdBolt, MdSpeed,
} from "react-icons/md";
import { baseURL } from "../../assets/assets.js";
import { CATEGORY_MAPPINGS } from "../../utils/mapCategories.js";
import HourlyWidget from "../../components/lineHourly/HourlyWidget.jsx";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

// ── Utilities ─────────────────────────────────────────────────────────────────
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

// ── Constants ─────────────────────────────────────────────────────────────────
const LINE_TABS = [
  { value: "final_line",    label: "Final Line",  icon: MdFactory },
  { value: "final_loading", label: "Loading",     icon: MdLocalShipping },
  { value: "post_Foaming",  label: "Post Foam",   icon: MdBubbleChart },
  { value: "Foaming",       label: "Foaming",     icon: MdSettings },
];

// All hourly count keys + all model breakdown keys
const EMPTY = {
  // hourly counts
  finalFreezerLoading: [], finalChocLoading: [], finalSUSLoading: [],
  finalCategoryLoading: [], visiLoading: [],
  finalFreezer: [], finalChoc: [], finalSUS: [], finalCategory: [], visiFinal: [],
  postFreezer: [], manualPost: [], postSUS: [], postCategory: [], visiPost: [],
  foamA: [], foamB: [], foamCategory: [],
  // model breakdowns — suffix "Model"
  finalFreezerLoadingModel: [], finalChocLoadingModel: [], finalSUSLoadingModel: [], visiLoadingModel: [],
  finalFreezerModel: [], finalChocModel: [], finalSUSModel: [], visiFinalModel: [],
  postFreezerModel: [], manualPostModel: [], postSUSModel: [], visiPostModel: [],
  foamAModel: [], foamBModel: [],
};

const CHART = {
  sky:   "rgba(14,165,233,0.72)",
  amber: "rgba(245,158,11,0.72)",
  slate: "rgba(100,116,139,0.65)",
  teal:  "rgba(20,184,166,0.70)",
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, highlight }) => {
  const palette = {
    sky:    "bg-sky-50 border-sky-100 text-sky-700",
    amber:  "bg-amber-50 border-amber-100 text-amber-700",
    violet: "bg-violet-50 border-violet-100 text-violet-700",
    teal:   "bg-teal-50 border-teal-100 text-teal-700",
  };
  return (
    <div className={`flex-1 flex items-center gap-2 px-3 rounded-xl border h-9 min-w-0 ${
      highlight
        ? "bg-slate-900 border-slate-800"
        : palette[color] || "bg-white border-slate-200 text-slate-700"
    }`}>
      {Icon && !highlight && <Icon size={13} className="shrink-0 opacity-70" />}
      <span className={`text-xs font-medium truncate ${highlight ? "text-slate-300" : "opacity-80"}`}>
        {label}
      </span>
      <span className={`font-mono font-bold text-sm ml-auto shrink-0 ${highlight ? "text-white" : ""}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const LineHourlyReport = () => {
  const [loading, setLoading]         = useState(false);
  const [startTime, setStartTime]     = useState("");
  const [endTime, setEndTime]         = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineType, setLineType]       = useState("final_line");
  const [apiData, setApiData]         = useState(EMPTY);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown]     = useState(300);

  const refreshRef  = useRef(null);
  const cdRef       = useRef(null);
  const paramsRef   = useRef({ StartTime: "", EndTime: "" });
  const lineTypeRef = useRef(lineType);
  useEffect(() => { lineTypeRef.current = lineType; }, [lineType]);

  const API = `${baseURL}prod`;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchForType = useCallback(async (lt, params) => {
    const get  = (path) => axios.get(`${API}/${path}`, { params });
    const safe = (r) =>
      r.status === "fulfilled" && r.value?.data?.success ? r.value.data.data || [] : [];

    // ── FINAL LOADING ──────────────────────────────────────────────────────
    if (lt === "final_loading") {
      const [r1, r2, r3, r4, r5, m1, m2, m3, m4, m5] = await Promise.allSettled([
        // hourly counts
        get("final-loading-hp-frz"),
        get("final-loading-hp-choc"),
        get("final-loading-hp-sus"),
        get("final-loading-hp-cat"),
        get("visi-loading-hp"),
        // model breakdowns
        get("final-loading-hp-frz-model"),
        get("final-loading-hp-choc-model"),
        get("final-loading-hp-sus-model"),
        get("final-loading-hp-visi-model"),
        // combined model for category widget (optional — uses all stations)
        get("final-loading-model"),
      ]);
      return {
        finalFreezerLoading:      safe(r1),
        finalChocLoading:         safe(r2),
        finalSUSLoading:          safe(r3),
        finalCategoryLoading:     mapCategory(safe(r4)),
        visiLoading:              safe(r5),
        finalFreezerLoadingModel: safe(m1),
        finalChocLoadingModel:    safe(m2),
        finalSUSLoadingModel:     safe(m3),
        visiLoadingModel:         safe(m4),
        // m5 unused — category widget doesn't use model breakdown
      };
    }

    // ── FINAL LINE ─────────────────────────────────────────────────────────
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
        finalFreezer:      safe(r1),
        finalChoc:         safe(r2),
        finalSUS:          safe(r3),
        finalCategory:     mapCategory(safe(r4)),
        visiFinal:         safe(r5),
        finalFreezerModel: safe(m1),
        finalChocModel:    safe(m2),
        finalSUSModel:     safe(m3),
        visiFinalModel:    safe(m4),
      };
    }

    // ── POST FOAMING ───────────────────────────────────────────────────────
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
        postFreezer:     safe(r1),
        manualPost:      safe(r2),
        postSUS:         safe(r3),
        postCategory:    mapCategory(safe(r4)),
        visiPost:        safe(r5),
        postFreezerModel: safe(m1),
        manualPostModel:  safe(m2),
        postSUSModel:     safe(m3),
        visiPostModel:    safe(m4),
      };
    }

    // ── FOAMING ────────────────────────────────────────────────────────────
    if (lt === "Foaming") {
      const [r1, r2, r3, m1, m2] = await Promise.allSettled([
        get("Foaming-hp-fom-a"),
        get("Foaming-hp-fom-b"),
        get("Foaming-hp-fom-cat"),
        get("Foaming-hp-fom-a-model"),
        get("Foaming-hp-fom-b-model"),
      ]);
      return {
        foamA:        safe(r1),
        foamB:        safe(r2),
        foamCategory: mapCategory(safe(r3)),
        foamAModel:   safe(m1),
        foamBModel:   safe(m2),
      };
    }

    return {};
  }, [API]);

  const runFetch = useCallback(async (params, lt) => {
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
  }, [fetchForType]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleQuery = () => {
    if (!startTime || !endTime) { toast.error("Select a time range first."); return; }
    const p = { StartTime: normaliseDateTime(startTime), EndTime: normaliseDateTime(endTime) };
    paramsRef.current = p;
    runFetch(p, lineType);
  };

  const handleToday = () => {
    const now = new Date(), s = new Date(now);
    s.setHours(8, 0, 0, 0);
    const p = { StartTime: formatDate(s), EndTime: formatDate(now) };
    paramsRef.current = p; runFetch(p, lineType);
  };

  const handleYesterday = () => {
    const e = new Date(); e.setHours(8, 0, 0, 0);
    const s = new Date(e); s.setDate(s.getDate() - 1);
    const p = { StartTime: formatDate(s), EndTime: formatDate(e) };
    paramsRef.current = p; runFetch(p, lineType);
  };

  // ── Auto-refresh ───────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(refreshRef.current);
    clearInterval(cdRef.current);
    if (!autoRefresh) return;
    setCountdown(300);
    cdRef.current     = setInterval(() => setCountdown((c) => (c <= 1 ? 300 : c - 1)), 1000);
    refreshRef.current = setInterval(() => {
      const p = paramsRef.current;
      if (p.StartTime && p.EndTime) { runFetch(p, lineTypeRef.current); setCountdown(300); }
    }, 300_000);
    return () => { clearInterval(refreshRef.current); clearInterval(cdRef.current); };
  }, [autoRefresh, runFetch]);

  // ── Derived: stat cards + grand total ─────────────────────────────────────
  const { summaryCards, grandTotal } = useMemo(() => {
    const d = apiData;
    let cards = [];
    if (lineType === "final_line") {
      const frz  = d.finalFreezer.reduce((s, r) => s + (r.COUNT || 0), 0);
      const choc = d.finalChoc.reduce((s, r) => s + (r.COUNT || 0), 0);
      const sus  = d.finalSUS.reduce((s, r) => s + (r.COUNT || 0), 0);
      const visi = d.visiFinal.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Freezer",     value: frz,             icon: MdAcUnit,       color: "sky" },
        { label: "Choc",        value: choc,            icon: MdFactory,      color: "amber" },
        { label: "SUS",         value: sus,             icon: MdSettings,     color: "violet" },
        { label: "VISI",        value: visi,            icon: MdAcUnit,       color: "teal" },
        { label: "Grand Total", value: frz+choc+sus+visi, highlight: true },
      ];
    } else if (lineType === "final_loading") {
      const frz  = d.finalFreezerLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      const choc = d.finalChocLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      const sus  = d.finalSUSLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      const visi = d.visiLoading.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Frz Load",    value: frz,             icon: MdAcUnit,        color: "sky" },
        { label: "Choc Load",   value: choc,            icon: MdLocalShipping, color: "amber" },
        { label: "SUS Load",    value: sus,             icon: MdLocalShipping, color: "violet" },
        { label: "VISI Load",   value: visi,            icon: MdAcUnit,        color: "teal" },
        { label: "Grand Total", value: frz+choc+sus+visi, highlight: true },
      ];
    } else if (lineType === "post_Foaming") {
      const pf   = d.postFreezer.reduce((s, r) => s + (r.GroupA_Count || 0) + (r.CHOC_Count || 0), 0);
      const mp   = d.manualPost.reduce((s, r) => s + (r.GroupB_Count || 0) + (r.FOW_Count || 0), 0);
      const sus  = d.postSUS.reduce((s, r) => s + (r.COUNT || 0), 0);
      const visi = d.visiPost.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Post Frz",    value: pf,              icon: MdBubbleChart, color: "sky" },
        { label: "Manual",      value: mp,              icon: MdBubbleChart, color: "amber" },
        { label: "Post SUS",    value: sus,             icon: MdSettings,    color: "violet" },
        { label: "VISI",        value: visi,            icon: MdAcUnit,      color: "teal" },
        { label: "Grand Total", value: pf+mp+sus+visi,  highlight: true },
      ];
    } else if (lineType === "Foaming") {
      const a = d.foamA.reduce((s, r) => s + (r.COUNT || 0), 0);
      const b = d.foamB.reduce((s, r) => s + (r.COUNT || 0), 0);
      cards = [
        { label: "Station A",   value: a,    icon: MdSettings, color: "sky" },
        { label: "Station B",   value: b,    icon: MdSettings, color: "amber" },
        { label: "Grand Total", value: a+b,  highlight: true },
      ];
    }
    return { summaryCards: cards, grandTotal: cards.find((c) => c.highlight)?.value || 0 };
  }, [apiData, lineType]);

  // ── Derived: header insights ───────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!grandTotal) return null;
    const d = apiData;
    const hourMap = {};
    const addRows = (arr, keys = ["COUNT"]) => {
      for (const r of arr) {
        const h = r.TIMEHOUR ?? -1;
        if (h < 0) continue;
        hourMap[h] = (hourMap[h] || 0) + keys.reduce((s, k) => s + (r[k] || 0), 0);
      }
    };
    if (lineType === "final_line") {
      addRows(d.finalFreezer); addRows(d.finalChoc); addRows(d.finalSUS); addRows(d.visiFinal);
    } else if (lineType === "final_loading") {
      addRows(d.finalFreezerLoading); addRows(d.finalChocLoading);
      addRows(d.finalSUSLoading);     addRows(d.visiLoading);
    } else if (lineType === "post_Foaming") {
      addRows(d.postFreezer, ["GroupA_Count", "CHOC_Count"]);
      addRows(d.manualPost,  ["GroupB_Count", "FOW_Count"]);
      addRows(d.postSUS);    addRows(d.visiPost);
    } else if (lineType === "Foaming") {
      addRows(d.foamA); addRows(d.foamB);
    }
    const hours = Object.entries(hourMap);
    if (!hours.length) return null;
    const avg       = Math.round(grandTotal / hours.length);
    const peakEntry = hours.reduce((m, e) => (e[1] > m[1] ? e : m), hours[0]);
    let day = 0, night = 0;
    for (const [h, v] of hours) {
      const n = Number(h);
      if (n >= 8 && n < 20) day += v; else night += v;
    }
    const dayPct = grandTotal > 0 ? Math.round((day / grandTotal) * 100) : 0;
    return { avg, peakHour: peakEntry[0], peakCount: peakEntry[1], dayPct };
  }, [apiData, lineType, grandTotal]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportAll = () => {
    const d = apiData;
    let rows = [];
    const hr  = (arr, label, keys = ["COUNT"]) =>
      arr.map((r) => [label, r.HOUR_NUMBER || r.HourNumber || "—",
        `${r.TIMEHOUR ?? ""}:00`, ...keys.map((k) => r[k] || 0)]);
    const cat = (arr, label) =>
      arr.map((r) => [label, "—", r.category, r.TotalCount || 0]);
    if (lineType === "final_line") {
      rows = [...hr(d.finalFreezer,"Freezer"), ...hr(d.finalChoc,"Choc"),
              ...hr(d.finalSUS,"SUS"),         ...hr(d.visiFinal,"VISI"),
              ...cat(d.finalCategory,"Category")];
    } else if (lineType === "final_loading") {
      rows = [...hr(d.finalFreezerLoading,"Frz Load"), ...hr(d.finalChocLoading,"Choc Load"),
              ...hr(d.finalSUSLoading,"SUS Load"),     ...hr(d.visiLoading,"VISI Load"),
              ...cat(d.finalCategoryLoading,"Category")];
    } else if (lineType === "post_Foaming") {
      rows = [
        ...d.postFreezer.map((r) => ["Post Frz", r.HourNumber||"—", `${r.TIMEHOUR??0}:00`, r.GroupA_Count||0, r.CHOC_Count||0]),
        ...d.manualPost.map((r)  => ["Manual",   r.HourNumber||"—", `${r.TIMEHOUR??0}:00`, r.GroupB_Count||0, r.FOW_Count||0]),
        ...hr(d.postSUS,"SUS"),   ...hr(d.visiPost,"VISI"),
        ...cat(d.postCategory,"Category"),
      ];
    } else if (lineType === "Foaming") {
      rows = [...hr(d.foamA,"Foam A"), ...hr(d.foamB,"Foam B"), ...cat(d.foamCategory,"Category")];
    }
    if (!rows.length) { toast.error("No data to export."); return; }
    const csv = [["Section","Hour#","Time/Category","Count A","Count B"], ...rows]
      .map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `LineHourly_${lineType}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Widget configs ──────────────────────────────────────────────────────────
  // Each widget now receives modelData — HourlyWidget renders expand buttons per hour row
  const widgetConfig = useMemo(() => {
    const d = apiData;
    const { sky, amber, slate, teal } = CHART;

    const configs = {
      final_line: [
        {
          title: "Final Freezer", icon: MdAcUnit,
          data: d.finalFreezer, modelData: d.finalFreezerModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Final Choc", icon: MdFactory,
          data: d.finalChoc, modelData: d.finalChocModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "Final SUS", icon: MdSettings,
          data: d.finalSUS, modelData: d.finalSUSModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: "VISI Cooler", icon: MdAcUnit,
          data: d.visiFinal, modelData: d.visiFinalModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "Category Breakdown", icon: MdBarChart,
          data: d.finalCategory, modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],

      final_loading: [
        {
          title: "Freezer Loading", icon: MdLocalShipping,
          data: d.finalFreezerLoading, modelData: d.finalFreezerLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Choc Loading", icon: MdLocalShipping,
          data: d.finalChocLoading, modelData: d.finalChocLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "SUS Loading", icon: MdLocalShipping,
          data: d.finalSUSLoading, modelData: d.finalSUSLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: "VISI Loading", icon: MdAcUnit,
          data: d.visiLoading, modelData: d.visiLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "Category Breakdown", icon: MdBarChart,
          data: d.finalCategoryLoading, modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],

      post_Foaming: [
        {
          title: "Post Foam Frz", icon: MdBubbleChart,
          data: d.postFreezer, modelData: d.postFreezerModel,
          datasets: [
            { key: "GroupA_Count", label: "Group A", color: sky },
            { key: "CHOC_Count",   label: "CHOC",    color: amber },
          ],
        },
        {
          title: "Manual Post", icon: MdBubbleChart,
          data: d.manualPost, modelData: d.manualPostModel,
          datasets: [
            { key: "GroupB_Count", label: "Group B", color: sky },
            { key: "FOW_Count",    label: "FOW",     color: amber },
          ],
        },
        {
          title: "Post SUS", icon: MdSettings,
          data: d.postSUS, modelData: d.postSUSModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: "VISI Post", icon: MdAcUnit,
          data: d.visiPost, modelData: d.visiPostModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "Category Breakdown", icon: MdBarChart,
          data: d.postCategory, modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],

      Foaming: [
        {
          title: "Station A", icon: MdSettings,
          data: d.foamA, modelData: d.foamAModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Station B", icon: MdSettings,
          data: d.foamB, modelData: d.foamBModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "Category Breakdown", icon: MdBarChart,
          data: d.foamCategory, modelData: [],
          datasets: [{ key: "TotalCount", label: "Count", color: sky }],
          isCategoryChart: true,
        },
      ],
    };
    return configs[lineType] || [];
  }, [apiData, lineType]);

  const is5 = widgetConfig.length === 5;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden", background:"#eef0f4" }}>

      {/* HEADER */}
      <header style={{ height:44, flexShrink:0 }} className="bg-slate-900 flex items-center px-4 gap-3">
        <MdDashboard size={16} className="text-sky-400 shrink-0" />
        <span className="text-white text-sm font-semibold tracking-tight">Line Hourly Report</span>
        <span className="text-slate-600 text-xs select-none">|</span>
        <span className="text-slate-400 text-xs">Production Monitoring</span>
        <div className="ml-auto flex items-center gap-4 text-xs">
          {lastFetched && (
            <span className="flex items-center gap-1 text-slate-400">
              <MdAccessTime size={11} /> {lastFetched.toLocaleTimeString()}
            </span>
          )}
          {autoRefresh && (
            <span className="flex items-center gap-1 text-sky-400 font-mono">
              <MdRefresh size={11} className="animate-spin" />{countdown}s
            </span>
          )}
          {insights && (
            <>
              <span className="flex items-center gap-1 text-slate-300">
                <MdBolt size={11} className="text-amber-400" />
                Peak {insights.peakHour}:00
                <span className="font-mono text-amber-300 ml-0.5">{insights.peakCount.toLocaleString()}</span>
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <MdSpeed size={11} className="text-emerald-400" />
                Avg <span className="font-mono text-emerald-300 ml-0.5">{insights.avg.toLocaleString()}</span>/hr
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <MdWbSunny size={11} className="text-yellow-400" />
                Day {insights.dayPct}%
                <MdNightlight size={11} className="text-violet-400 ml-1.5" />
                Night {100 - insights.dayPct}%
              </span>
            </>
          )}
          {grandTotal > 0 && (
            <span className="text-white font-mono font-bold">
              {grandTotal.toLocaleString()} <span className="text-slate-400 font-normal">units</span>
            </span>
          )}
        </div>
      </header>

      {/* TOOLBAR */}
      <div style={{ height:52, flexShrink:0 }} className="bg-white border-b border-slate-200 flex items-center px-4 gap-2.5">
        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-slate-50
                     focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 w-40" />
        <span className="text-slate-300 select-none">→</span>
        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-slate-50
                     focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 w-40" />
        <button onClick={handleQuery} disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-40 transition-colors">
          <MdSearch size={13} />{loading ? "Loading…" : "Query"}
        </button>
        <button onClick={handleToday} disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
          <MdCalendarToday size={12} /> Today
        </button>
        <button onClick={handleYesterday} disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
          <MdHistory size={12} /> Yesterday
        </button>
        <button onClick={exportAll} disabled={loading || !grandTotal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
          <MdDownload size={12} /> Export
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />
        <div className="flex gap-0.5 bg-slate-100 rounded-xl p-0.5">
          {LINE_TABS.map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setLineType(value)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                lineType === value ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
              }`}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400">Auto</span>
          <div onClick={() => setAutoRefresh((p) => !p)}
            className={`relative w-8 h-4 rounded-full cursor-pointer transition-colors ${autoRefresh ? "bg-sky-500" : "bg-slate-200"}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${autoRefresh ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      {summaryCards.length > 0 && (
        <div style={{ height:52, flexShrink:0 }} className="flex items-center px-3 gap-2">
          {summaryCards.map((card, i) => <StatCard key={i} {...card} />)}
        </div>
      )}

      {/* WIDGET GRID */}
      <div style={{ flex:1, minHeight:0, padding:"0 10px 10px" }}>
        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
            gridTemplateRows: is5 ? "1fr 1fr" : "1fr", gap:8, height:"100%" }}>
            {Array.from({ length: is5 ? 5 : 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 animate-pulse overflow-hidden"
                style={{ gridColumn: is5 && i === 4 ? "span 2" : undefined }}>
                <div className="h-9 bg-slate-50 border-b border-slate-100" />
                <div className="p-3 space-y-2">
                  {[70,85,60,75].map((w, j) => (
                    <div key={j} className="h-3.5 bg-slate-50 rounded" style={{ width:`${w}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
            gridTemplateRows: is5 ? "1fr 1fr" : "1fr", gap:8, height:"100%" }}>
            {widgetConfig.map((wc, i) => {
              let gridColumn = undefined;
              if (is5 && i === 3) gridColumn = "1";
              if (is5 && i === 4) gridColumn = "2 / span 2";
              return (
                <div key={i} style={{ gridColumn, minHeight:0 }}>
                  <HourlyWidget
                    title={wc.title}
                    data={wc.data}
                    modelData={wc.modelData}
                    datasets={wc.datasets}
                    isCategoryChart={!!wc.isCategoryChart}
                    icon={wc.icon}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LineHourlyReport;