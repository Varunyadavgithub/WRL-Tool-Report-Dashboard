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
  Factory, Truck, Settings, Search, Download, Calendar, History,
  Loader2, RefreshCw, Zap, Gauge, Wind, Eye, Layers, Thermometer,
} from "lucide-react";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

const normaliseDateTime = (dt) => (dt ? dt.replace("T", " ") : "");
const pad = (n) => String(n).padStart(2, "0");
const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const mapCategory = (data) => {
  if (!data?.length) return [];
  const norm = (s) => s.replace(/\s+/g, " ").trim().toUpperCase();
  const grouped = {};
  for (const item of data) {
    if (!item?.category) continue;
    const key = CATEGORY_MAPPINGS[norm(item.category)] || item.category.trim();
    grouped[key]
      ? (grouped[key].TotalCount += item.TotalCount || 0)
      : (grouped[key] = { category: key, TotalCount: item.TotalCount || 0 });
  }
  return Object.values(grouped).sort((a, b) => b.TotalCount - a.TotalCount);
};

const CHART = {
  sky:    "rgba(14,165,233,0.72)",
  amber:  "rgba(245,158,11,0.72)",
  slate:  "rgba(100,116,139,0.65)",
  teal:   "rgba(20,184,166,0.70)",
  violet: "rgba(139,92,246,0.70)",
};

const MAX_VISIBLE_ROWS = 6;

const LINE_CONFIG = {
  freezer: {
    accent: "blue",
    sections: [
      {
        label: "Final", icon: Factory,
        endpoints: ["final-hp-frz", "final-hp-frz-model"],
        buildWidgets: (r) => [
          { title: "Freezer Final", data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.sky }] },
        ],
      },
      {
        label: "Loading", icon: Truck,
        endpoints: ["final-loading-hp-frz", "final-loading-hp-frz-model"],
        buildWidgets: (r) => [
          { title: "Freezer Loading", data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.sky }] },
        ],
      },
      {
        label: "Post Foaming", icon: Wind,
        endpoints: ["post-hp-GrpA", "post-hp-GrpB", "post-hp-FOW", "post-Grp-A-model", "post-Grp-B-model", "post-FOW-model"],
        buildWidgets: (r) => [
          { title: "Post Foam Group A", data: r[0], modelData: r[3], datasets: [{ key: "COUNT", label: "Count", color: CHART.sky   }] },
          { title: "Post Foam Group B", data: r[1], modelData: r[4], datasets: [{ key: "COUNT", label: "Count", color: CHART.slate }] },
          { title: "FOW Post Foaming",  data: r[2], modelData: r[5], datasets: [{ key: "COUNT", label: "Count", color: CHART.teal  }] },
        ],
      },
      {
        label: "Foaming", icon: Settings,
        endpoints: ["Foaming-hp-fom-a", "Foaming-hp-fom-b", "Foaming-hp-fom-cat", "Foaming-hp-fom-a-model", "Foaming-hp-fom-b-model"],
        buildWidgets: (r) => [
          { title: "Station A",         data: r[0],             modelData: r[3], datasets: [{ key: "COUNT",      label: "Count", color: CHART.sky   }] },
          { title: "Station B",         data: r[1],             modelData: r[4], datasets: [{ key: "COUNT",      label: "Count", color: CHART.amber }] },
          { title: "Category Breakdown",data: mapCategory(r[2]),modelData: [],   datasets: [{ key: "TotalCount", label: "Count", color: CHART.sky   }], isCategoryChart: true },
        ],
      },
    ],
  },
  choc: {
    accent: "amber",
    sections: [
      { label: "Final",       icon: Factory, endpoints: ["final-hp-choc",         "final-hp-choc-model"],        buildWidgets: (r) => [{ title: "Chocolate Final",       data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.amber }] }] },
      { label: "Loading",     icon: Truck,   endpoints: ["final-loading-hp-choc", "final-loading-hp-choc-model"],buildWidgets: (r) => [{ title: "Chocolate Loading",     data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.amber }] }] },
      { label: "Post Foaming",icon: Wind,    endpoints: ["post-hp-Choc",          "post-Choc-model"],            buildWidgets: (r) => [{ title: "CHOC Post Foaming",     data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.amber }] }] },
    ],
  },
  sus: {
    accent: "violet",
    sections: [
      { label: "Final",       icon: Factory, endpoints: ["final-hp-sus",         "final-hp-sus-model"],        buildWidgets: (r) => [{ title: "SUS Final",        data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.violet }] }] },
      { label: "Loading",     icon: Truck,   endpoints: ["final-loading-hp-sus", "final-loading-hp-sus-model"],buildWidgets: (r) => [{ title: "SUS Loading",      data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.violet }] }] },
      { label: "Post Foaming",icon: Wind,    endpoints: ["post-hp-sus",          "post-hp-sus-model"],         buildWidgets: (r) => [{ title: "SUS Post Foaming", data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.violet }] }] },
    ],
  },
  visi: {
    accent: "emerald",
    sections: [
      { label: "Final",       icon: Factory, endpoints: ["visi-final-hp",   "visi-final-hp-model"],          buildWidgets: (r) => [{ title: "VISI Final",        data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.teal }] }] },
      { label: "Loading",     icon: Truck,   endpoints: ["visi-loading-hp", "final-loading-hp-visi-model"],  buildWidgets: (r) => [{ title: "VISI Loading",      data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.teal }] }] },
      { label: "Post Foaming",icon: Wind,    endpoints: ["visi-post-hp",    "visi-post-hp-model"],           buildWidgets: (r) => [{ title: "VISI Post Foaming", data: r[0], modelData: r[1], datasets: [{ key: "COUNT", label: "Count", color: CHART.teal }] }] },
    ],
  },
};

const LINE_DEFS = [
  { value: "freezer", label: "Freezer",   icon: Thermometer },
  { value: "choc",    label: "Chocolate", icon: Layers      },
  { value: "sus",     label: "SUS",       icon: Settings    },
  { value: "visi",    label: "VISI",      icon: Eye         },
];

const ACCENT_ACTIVE = {
  blue:    "bg-blue-600 text-white shadow-sm",
  amber:   "bg-amber-500 text-white shadow-sm",
  violet:  "bg-violet-600 text-white shadow-sm",
  emerald: "bg-emerald-600 text-white shadow-sm",
};

const ACCENT_HEADER = {
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  amber:   "bg-amber-50 text-amber-700 border-amber-200",
  violet:  "bg-violet-50 text-violet-700 border-violet-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;

// ─── Main ──────────────────────────────────────────────────────────────────────
const LineWiseReport = () => {
  const [loading, setLoading]         = useState(false);
  const [startTime, setStartTime]     = useState("");
  const [endTime, setEndTime]         = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [line, setLine]               = useState("freezer");
  const [sectionData, setSectionData] = useState([]);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown]     = useState(300);

  const refreshRef = useRef(null);
  const cdRef      = useRef(null);
  const paramsRef  = useRef({ StartTime: "", EndTime: "" });
  const lineRef    = useRef(line);
  useEffect(() => { lineRef.current = line; }, [line]);

  const API = `${baseURL}prod`;

  const fetchAllSections = useCallback(async (params, ln) => {
    const cfg = LINE_CONFIG[ln];
    return Promise.all(
      cfg.sections.map(async (sec) => {
        const settled = await Promise.allSettled(
          sec.endpoints.map((path) => axios.get(`${API}/${path}`, { params }))
        );
        const raw = settled.map((r) =>
          r.status === "fulfilled" && r.value?.data?.success ? r.value.data.data || [] : []
        );
        return { label: sec.label, icon: sec.icon, widgets: sec.buildWidgets(raw) };
      })
    );
  }, [API]);

  const runFetch = useCallback(async (params, ln) => {
    setLoading(true);
    setSectionData([]);
    try {
      const data = await fetchAllSections(params, ln);
      setSectionData(data);
      setLastFetched(new Date());
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  }, [fetchAllSections]);

  const handleQuery = () => {
    if (!startTime || !endTime) { toast.error("Select a time range first."); return; }
    const p = { StartTime: normaliseDateTime(startTime), EndTime: normaliseDateTime(endTime) };
    paramsRef.current = p;
    runFetch(p, line);
  };

  const handleToday = () => {
    const now = new Date(), s = new Date(now);
    s.setHours(8, 0, 0, 0);
    const p = { StartTime: formatDate(s), EndTime: formatDate(now) };
    paramsRef.current = p;
    runFetch(p, line);
  };

  const handleYesterday = () => {
    const e = new Date(); e.setHours(8, 0, 0, 0);
    const s = new Date(e); s.setDate(s.getDate() - 1);
    const p = { StartTime: formatDate(s), EndTime: formatDate(e) };
    paramsRef.current = p;
    runFetch(p, line);
  };

  const handleLineChange = (newLine) => {
    setLine(newLine);
    setSectionData([]);
    const p = paramsRef.current;
    if (p.StartTime && p.EndTime) runFetch(p, newLine);
  };

  useEffect(() => {
    clearInterval(refreshRef.current);
    clearInterval(cdRef.current);
    if (!autoRefresh) return;
    setCountdown(300);
    cdRef.current = setInterval(() => setCountdown((c) => (c <= 1 ? 300 : c - 1)), 1000);
    refreshRef.current = setInterval(() => {
      const p = paramsRef.current;
      if (p.StartTime && p.EndTime) { runFetch(p, lineRef.current); setCountdown(300); }
    }, 300_000);
    return () => { clearInterval(refreshRef.current); clearInterval(cdRef.current); };
  }, [autoRefresh, runFetch]);

  const grandTotal = useMemo(() =>
    sectionData.flatMap((s) => s.widgets).filter((w) => !w.isCategoryChart)
      .reduce((sum, w) => sum + w.data.reduce((s, r) => s + (r.COUNT || 0), 0), 0),
    [sectionData]
  );

  const insights = useMemo(() => {
    if (!grandTotal) return null;
    const hourMap = {};
    sectionData.flatMap((s) => s.widgets).filter((w) => !w.isCategoryChart).forEach((w) => {
      w.data.forEach((r) => {
        const h = r.TIMEHOUR ?? -1;
        if (h >= 0) hourMap[h] = (hourMap[h] || 0) + (r.COUNT || 0);
      });
    });
    const hours = Object.entries(hourMap);
    if (!hours.length) return null;
    const avg = Math.round(grandTotal / hours.length);
    const peak = hours.reduce((m, e) => (e[1] > m[1] ? e : m), hours[0]);
    return { avg, peakHour: peak[0], peakCount: peak[1] };
  }, [sectionData, grandTotal]);

  const exportAll = () => {
    if (!grandTotal) { toast.error("No data to export."); return; }
    const rows = sectionData.flatMap((sec) =>
      sec.widgets.flatMap((w) =>
        w.isCategoryChart
          ? w.data.map((r) => [sec.label, w.title, "—", r.category, r.TotalCount || 0])
          : w.data.map((r) => [sec.label, w.title, r.HOUR_NUMBER || "—", `${r.TIMEHOUR ?? ""}:00`, r.COUNT || 0])
      )
    );
    const csv = [["Section", "Widget", "Hour#", "Time/Category", "Count"], ...rows]
      .map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `LineWise_${line}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const accent = LINE_CONFIG[line]?.accent || "blue";
  const nSections = LINE_CONFIG[line]?.sections.length || 3;

  /* ── RENDER ── */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">

      {/* ── COMPACT HEADER ── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 shadow-sm flex-wrap">
        {/* Title */}
        <div className="shrink-0">
          <h1 className="text-sm font-bold text-slate-800 leading-tight">Line Wise Hourly Report</h1>
          <p className="text-[10px] text-slate-400 leading-none mt-0.5">All sections · one screen</p>
        </div>

        <div className="w-px h-7 bg-slate-200 shrink-0" />

        {/* Time inputs */}
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 w-40"
        />
        <span className="text-slate-300 text-xs shrink-0">→</span>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 w-40"
        />

        {/* Action buttons */}
        <button onClick={handleYesterday} disabled={loading} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${loading ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 text-white"}`}>
          {loading ? <Spinner cls="w-3 h-3" /> : <History className="w-3 h-3" />} Yesterday
        </button>
        <button onClick={handleToday} disabled={loading} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${loading ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
          {loading ? <Spinner cls="w-3 h-3" /> : <Calendar className="w-3 h-3" />} Today
        </button>
        <button onClick={handleQuery} disabled={loading} className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${loading ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
          {loading ? <Spinner cls="w-3 h-3" /> : <Search className="w-3 h-3" />} {loading ? "Loading…" : "Query"}
        </button>
        <button onClick={exportAll} disabled={loading || !grandTotal} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${loading || !grandTotal ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}>
          <Download className="w-3 h-3" /> Export
        </button>

        <div className="w-px h-7 bg-slate-200 shrink-0" />

        {/* Line selector */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {LINE_DEFS.map(({ value, label, icon: Icon }) => {
            const ac = LINE_CONFIG[value].accent;
            return (
              <button
                key={value}
                onClick={() => handleLineChange(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  line === value ? ACCENT_ACTIVE[ac] : "text-slate-500 hover:text-slate-700 hover:bg-white/70"
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 ml-auto">
          {insights && (
            <>
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> Peak {insights.peakHour}:00 · {insights.peakCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Gauge className="w-2.5 h-2.5" /> {insights.avg.toLocaleString()}/hr
              </span>
            </>
          )}
          {autoRefresh && (
            <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full font-medium animate-pulse flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" /> {countdown}s
            </span>
          )}
          <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 min-w-[70px]">
            <span className="text-base font-bold font-mono text-blue-700 leading-tight">{grandTotal.toLocaleString()}</span>
            <span className="text-[9px] text-blue-400 font-medium uppercase tracking-wide">Total</span>
          </div>
          {lastFetched && (
            <span className="text-[10px] text-slate-500 font-mono">{lastFetched.toLocaleTimeString()}</span>
          )}
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`relative w-8 h-4 rounded-full transition-colors ${autoRefresh ? "bg-blue-500" : "bg-slate-200"}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${autoRefresh ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* ── CONTENT: sections as columns, filling all remaining height ── */}
      <div className="flex-1 min-h-0 p-2 flex gap-2">

        {/* Loading skeleton columns */}
        {loading && LINE_CONFIG[line].sections.map((sec) => (
          <div key={sec.label} className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="h-6 bg-slate-200 rounded-md animate-pulse shrink-0" />
            {Array.from({ length: sec.buildWidgets([]).length || 1 }).map((_, i) => (
              <div key={i} className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 animate-pulse overflow-hidden">
                <div className="h-8 bg-slate-50 border-b border-slate-100" />
                <div className="p-2 space-y-1.5">
                  {[70, 85, 60, 75].map((w, j) => (
                    <div key={j} className="h-2.5 bg-slate-100 rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Actual section columns */}
        {!loading && sectionData.length > 0 && sectionData.map((sec) => {
          const SectionIcon = sec.icon;
          const secTotal = sec.widgets
            .filter((w) => !w.isCategoryChart)
            .reduce((sum, w) => sum + w.data.reduce((s, r) => s + (r.COUNT || 0), 0), 0);

          return (
            <div key={sec.label} className="flex-1 min-w-0 flex flex-col gap-1.5">
              {/* Section label */}
              <div className={`flex items-center justify-between px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-widest shrink-0 ${ACCENT_HEADER[accent]}`}>
                <span className="flex items-center gap-1">
                  <SectionIcon className="w-3 h-3" />
                  {sec.label}
                </span>
                {secTotal > 0 && <span className="font-mono">{secTotal.toLocaleString()}</span>}
              </div>

              {/* Widgets filling the column height equally */}
              {sec.widgets.map((wc, i) => (
                <div key={i} className="flex-1 min-h-0">
                  <HourlyWidget
                    title={wc.title}
                    data={wc.data}
                    modelData={wc.modelData}
                    datasets={wc.datasets}
                    isCategoryChart={!!wc.isCategoryChart}
                    maxVisibleRows={MAX_VISIBLE_ROWS}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {/* Empty state */}
        {!loading && sectionData.length === 0 && (
          <div className="flex-1 bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-3">
            <Factory className="w-8 h-8 text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">Select a line and query</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LineWiseReport;
