import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Loader2,
  RefreshCw,
  Play,
  Pause,
  X,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Package,
  Truck,
  BarChart2,
  Activity,
  Settings,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { baseURL } from "../../assets/assets";

/* ── Page imports ── */
import FgPacking from "./Area/FgPacking";
import FgLoading from "./Area/FgLoading";
import Hourly from "./Area/Hourly";
import Quality from "./Area/Quality";
import Loss from "./Area/Loss";

/* ── Constants ── */
const PAGE_DURATION_MS = 30_000;
const TOTAL_PAGES = 5;

const PAGES_META = [
  { key: "fgPacking",  label: "FG Packing", Icon: Package,       accentHex: "#1e40af" },
  { key: "fgLoading",  label: "FG Loading", Icon: Truck,          accentHex: "#0f766e" },
  { key: "hourly",     label: "Hourly",      Icon: BarChart2,      accentHex: "#7c3aed" },
  { key: "quality",    label: "Quality",     Icon: CheckCircle,    accentHex: "#15803d" },
  { key: "loss",       label: "Loss",        Icon: AlertTriangle,  accentHex: "#b45309" },
];

const GAUGE_COLORS = [
  "#dc2626","#e53e3e","#ea580c","#f97316","#fb923c",
  "#f59e0b","#eab308","#bef264","#86efac","#4ade80",
  "#22c55e","#16a34a","#15803d","#166534",
];

/* ── Helpers ── */
const pad = (n) => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// BUG FIX: Previously spread all config fields as individual params which sent
// redundant/unused fields. Now only pass what the backend actually needs.
const buildParams = (cfg, shiftDate, shift) => ({
  configId:  cfg?.id,
  shiftDate,
  shift,
});

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ── GaugeCanvas ── */
// BUG FIX: Extracted draw logic into a stable function to avoid stale closure
// issues and reduce repeated inline object creation on every render.
const GaugeCanvas = ({ value = 0, label = "", sublabel = "" }) => {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height;
    const cx = W / 2, cy = H - 16;
    const R = Math.min(cx - 12, cy - 8);

    ctx.clearRect(0, 0, W, H);

    // Gauge arc segments
    const seg = Math.PI / GAUGE_COLORS.length;
    GAUGE_COLORS.forEach((col, i) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, Math.PI + i * seg, Math.PI + (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    });

    // Rim
    ctx.beginPath();
    ctx.arc(cx, cy, R - 2, Math.PI, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.stroke();

    // Center fill
    ctx.beginPath();
    ctx.arc(cx, cy, R - 22, 0, Math.PI * 2);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Tick marks + labels
    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI + (i / 10) * Math.PI;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(cx + cos * (R - 22), cy + sin * (R - 22));
      ctx.lineTo(cx + cos * (R - 5),  cy + sin * (R - 5));
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 9px 'Courier New', monospace";
        ctx.fillText(String(i * 100), cx + cos * (R - 34), cy + sin * (R - 34));
      }
    }

    // Labels
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(label, cx, cy - 48);
    ctx.font = "9px system-ui";
    ctx.fillStyle = "#64748b";
    ctx.fillText(sublabel, cx, cy - 32);

    // Needle — BUG FIX: clamped to [0, 1000] range
    const clamped = Math.min(Math.max(Number(value) || 0, 0), 1000);
    const angle = Math.PI + (clamped / 1000) * Math.PI;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-(R - 26), 0);
    ctx.lineTo(10, -5);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fillStyle = "#1e40af";
    ctx.fill();
    ctx.restore();

    // Pivot
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#475569";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#f1f5f9";
    ctx.fill();
  }, [value, label, sublabel]);

  return <canvas ref={ref} width={280} height={160} className="block max-w-full" />;
};

/* ── DonutCanvas ── */
const DonutCanvas = ({
  pct = 0,
  size = 120,
  fillColor = "#22c55e",
  trackColor = "#e2e8f0",
}) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const cx = c.width / 2, cy = c.height / 2;
    const r = Math.min(cx, cy) - 12;
    ctx.clearRect(0, 0, c.width, c.height);

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 12;
    ctx.strokeStyle = trackColor;
    ctx.stroke();

    // BUG FIX: Guard against pct <= 0 to avoid drawing a full circle artifact
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.min(pct, 100) / 100) * Math.PI * 2);
      ctx.lineWidth = 12;
      ctx.strokeStyle = fillColor;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }, [pct, fillColor, trackColor]);

  return <canvas ref={ref} width={size} height={size} />;
};

/* ── LiveClock ── */
const LiveClock = ({ shift, shiftDate, accentHex }) => {
  const [tick, setTick] = useState(() => new Date()); // BUG FIX: lazy init avoids stale first render

  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = `${pad(tick.getHours())}:${pad(tick.getMinutes())}:${pad(tick.getSeconds())}`;

  return (
    <div className="flex items-center gap-5 px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-xs shrink-0">
      <span className="flex items-center gap-1.5 text-slate-500">
        <Activity className="w-3 h-3" style={{ color: accentHex }} />
        Shift{" "}
        <strong className="text-slate-900 ml-0.5">
          {shift ? `SHIFT ${shift}` : "—"}
        </strong>
      </span>
      <span className="flex items-center gap-1.5 text-slate-500">
        <Calendar className="w-3 h-3" style={{ color: accentHex }} />
        <strong className="text-slate-900">{shiftDate || "—"}</strong>
      </span>
      <span className="flex items-center gap-1.5 text-slate-500">
        <Clock className="w-3 h-3" style={{ color: accentHex }} />
        <strong className="text-slate-900 font-mono">{timeStr}</strong>
      </span>
      <span className="ml-auto text-slate-400 text-[11px]">
        {shift ? (shift === "A" ? "08:00 – 20:00" : "20:00 – 08:00") : "—"}
      </span>
    </div>
  );
};

/* ── PageHeader ── */
const PageHeader = ({ title, shift, shiftDate, accentHex }) => (
  <div className="shrink-0">
    <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: accentHex }}>
      <span className="flex-1 text-center font-extrabold text-[15px] text-white tracking-widest uppercase font-mono">
        {title}
      </span>
    </div>
    <LiveClock shift={shift} shiftDate={shiftDate} accentHex={accentHex} />
  </div>
);

/* ── TimerBar ── */
const TimerBar = ({ progress, accentHex }) => (
  <div className="h-[3px] bg-slate-100 shrink-0">
    <div className="h-full" style={{ width: `${progress}%`, background: accentHex }} />
  </div>
);

/* ── StatCard ── */
const StatCard = ({ label, value, accentHex = "#1e40af", sub }) => (
  <div
    className="relative bg-white rounded-xl p-4 shadow-sm border border-slate-100 overflow-hidden"
    style={{ borderLeft: `4px solid ${accentHex}` }}
  >
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
      {label}
    </p>
    <p className="text-3xl font-black font-mono" style={{ color: accentHex }}>
      {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
    </p>
    {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    <div
      className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-10"
      style={{ background: accentHex }}
    />
  </div>
);

/* ── MetricTable ── */
/* ── MetricTable ── */
const MetricTable = ({ rows, accentHex }) => (
  <table className="w-full border-separate border-spacing-0 text-xs">
    <thead>
      <tr>
        {[
          ["45%", "Metric", "left"],
          ["10%", "Unit",   "center"],
          ["22%", "Target", "center"],
          ["23%", "Actual", "center"],
        ].map(([w, lbl, align]) => (
          <th
            key={lbl}
            className="px-2.5 py-2 text-white font-bold border border-white/20"
            style={{ background: accentHex, textAlign: align, width: w, fontSize: 11 }}
          >
            {lbl}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => {
        const actualColor =
          r.highlight === "yellow" ? "#f59e0b" : r.green ? "#15803d" : "#0f172a";
        const mergeColumns = r.target == null; // ← merge when no target

        return (
          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
            <td className="px-2.5 py-1.5 border border-slate-100 text-slate-700 font-semibold">
              {r.label}
            </td>
            <td className="px-2.5 py-1.5 border border-slate-100 text-slate-400 text-center text-[11px]">
              {r.unit}
            </td>

            {mergeColumns ? (
              // Merged Target + Actual cell — spans 2 columns, shows only actual
              <td
                colSpan={2}
                className="px-2.5 py-1.5 border border-slate-100 font-extrabold text-center"
                style={{ color: actualColor }}
              >
                {r.actual ?? "—"}
              </td>
            ) : (
              <>
                <td
                  className="px-2.5 py-1.5 border border-slate-100 font-bold text-center"
                  style={{ color: accentHex }}
                >
                  {r.target ?? "—"}
                </td>
                <td
                  className="px-2.5 py-1.5 border border-slate-100 font-extrabold text-center"
                  style={{ color: actualColor }}
                >
                  {r.actual ?? "—"}
                </td>
              </>
            )}
          </tr>
        );
      })}
    </tbody>
  </table>
);

/* ── GaugePanel ── */
const GaugePanel = ({ value, label, sublabel, accentHex }) => (
  <div className="w-[280px] shrink-0 flex flex-col items-center justify-center bg-white border-r border-slate-100 px-3 py-4">
    <GaugeCanvas value={value} label={label} sublabel={sublabel} />
    <div
      className="mt-3 px-7 py-1.5 rounded-lg text-white font-extrabold text-2xl font-mono tracking-widest"
      style={{ background: accentHex, boxShadow: `0 4px 14px ${accentHex}44` }}
    >
      {/* BUG FIX: guard against null/undefined value before String() */}
      {String(value ?? 0).padStart(3, "0")}.00
    </div>
  </div>
);

/* ── SidebarPanel ── */
const SidebarPanel = ({
  pct = 0,
  fillColor,
  infoRows = [],
  label = "Consumed Time",
}) => (
  <div className="w-[190px] shrink-0 flex flex-col gap-3 px-3 py-3.5 bg-slate-50 border-r border-slate-100 justify-center">
    <div>
      <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2 text-center">
        {label}
      </p>
      <div className="relative flex justify-center">
        <DonutCanvas pct={pct} size={130} fillColor={fillColor} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-[22px] font-extrabold text-slate-900">
            {/* BUG FIX: coerce pct to number before toFixed, avoids "pct.toFixed is not a function" */}
            {Number(pct || 0).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
    <div className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
      {infoRows.map(([k, v], i) => (
        <div
          key={i}
          className={`flex justify-between py-1 text-[11px] text-slate-400 ${
            i < infoRows.length - 1 ? "border-b border-slate-50" : ""
          }`}
        >
          <span>{k}</span>
          <strong className="text-slate-900">
            {v != null ? (typeof v === "number" ? v.toLocaleString() : v) : "—"}
          </strong>
        </div>
      ))}
    </div>
  </div>
);

/* ── NavDots ── */
const NavDots = ({ currentPage, onGoTo, onPrev, onNext }) => (
  <div className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 bg-white border-t border-slate-100 relative">
    <button
      onClick={onPrev}
      className="absolute left-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
      aria-label="Previous page"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
    </button>
    {PAGES_META.map(({ label, Icon, accentHex }, i) => {
      const active = i === currentPage;
      return (
        <button
          key={i}
          onClick={() => onGoTo(i)}
          aria-label={`Go to ${label}`}
          className="flex flex-col items-center gap-0.5"
        >
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border-[1.5px] transition-all ${
              active ? "border-current" : "border-transparent"
            }`}
            style={{
              background: active ? `${accentHex}15` : "transparent",
              color: active ? accentHex : "#cbd5e1",
            }}
          >
            <Icon className="w-3 h-3" />
            {active && <span className="text-[10px] font-bold">{label}</span>}
          </div>
        </button>
      );
    })}
    <button
      onClick={onNext}
      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
      aria-label="Next page"
    >
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════════════════════ */
const EMPTY_DATA = {
  fgPacking: {},
  fgLoading: {},
  hourly:    {},
  quality:   {},
  loss:      {},
};

const Monitoring = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const routerState    = location.state || {};
  const launchedConfig = routerState.config    || null;
  const launchedDate   = routerState.shiftDate || todayISO();
  const launchedShift  = routerState.shift     || "A";
  const isLaunched     = !!routerState.autoLoad;

  const [shiftDate,    setShiftDate]   = useState(launchedDate);
  const [shift,        setShift]       = useState(launchedShift);
  const [allData,      setAllData]     = useState(EMPTY_DATA);
  const [currentPage,  setCurrentPage] = useState(0);
  const [progress,     setProgress]    = useState(0);
  const [lastFetched,  setLastFetched] = useState(null);
  const [isRunning,    setIsRunning]   = useState(false);
  const [loading,      setLoading]     = useState(false);

  // BUG FIX: Use a ref for the interval so stopping it on page change doesn't
  // create a dependency loop. Previously the effect re-registered on every
  // currentPage change AND on isRunning change, causing double-ticking.
  const intervalRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isRunning) return;

    let elapsed = 0;
    setProgress(0);

    intervalRef.current = setInterval(() => {
      elapsed += 50;
      setProgress(Math.min((elapsed / PAGE_DURATION_MS) * 100, 100));
      if (elapsed >= PAGE_DURATION_MS) {
        elapsed = 0;
        setProgress(0);
        setCurrentPage((p) => (p + 1) % TOTAL_PAGES);
      }
    }, 50);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isRunning, currentPage]);

  // BUG FIX: Accept cfg as parameter so this is safe to call both on mount
  // (with launchedConfig) and later with possibly-changed state.
  const fetchData = useCallback(async (dateParam, shiftParam, cfg) => {
    if (!dateParam) {
      toast.error("Please select a shift date.");
      return;
    }
    if (!cfg?.id) {
      toast.error("No dashboard configuration selected.");
      return;
    }

    setLoading(true);
    setIsRunning(false);
    // BUG FIX: Reset to a stable reference rather than inline object so React
    // can bail out of re-renders early.
    setAllData(EMPTY_DATA);

    const params = buildParams(cfg, dateParam, shiftParam);

    const endpoints = {
      fgPacking: `${baseURL}dashboard/fg-packing`,
      fgLoading: `${baseURL}dashboard/fg-loading`,
      hourly:    `${baseURL}dashboard/hourly`,
      quality:   `${baseURL}dashboard/quality`,
      loss:      `${baseURL}dashboard/loss`,
    };

    try {
      const results = await Promise.allSettled(
        Object.entries(endpoints).map(([key, url]) =>
          axios
            .get(url, { params })
            .then((res) => ({ key, data: res.data?.data ?? res.data }))
        )
      );

      const merged = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") merged[r.value.key] = r.value.data;
      });

      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === TOTAL_PAGES) {
        toast.error("All endpoints failed. Check server connection.");
      } else {
        if (failed > 0) toast(`${failed} endpoint(s) had errors.`, { icon: "⚠️" });
        else toast.success("Dashboard loaded successfully.");

        // BUG FIX: spread EMPTY_DATA first so keys missing from API response
        // still exist in state (prevents child components reading undefined).
        setAllData({ ...EMPTY_DATA, ...merged });
        setLastFetched(new Date());
        setCurrentPage(0);
        setIsRunning(true);
      }
    } catch {
      toast.error("Failed to fetch dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []); // no dependencies — all values are passed as args

  // BUG FIX: Only run auto-load once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isLaunched) fetchData(launchedDate, launchedShift, launchedConfig);
  }, []);

  // BUG FIX: Memoize with correct deps — shiftDate/shift state can differ from
  // what was launched if the user changed them in the top bar.
  const fetchAllData = useCallback(
    () => fetchData(shiftDate, shift, launchedConfig),
    [fetchData, shiftDate, shift, launchedConfig]
  );

  const goTo   = useCallback((i) => { setCurrentPage(i); setProgress(0); }, []);
  const goPrev = useCallback(() => { setCurrentPage((p) => (p - 1 + TOTAL_PAGES) % TOTAL_PAGES); setProgress(0); }, []);
  const goNext = useCallback(() => { setCurrentPage((p) => (p + 1) % TOTAL_PAGES); setProgress(0); }, []);

  // Shift-B date logic: if before 08:00, use yesterday as the shift date.
  const handleShiftSwitch = useCallback((s, cfg) => {
    let dt;
    if (s === "B") {
      const d = new Date();
      if (d.getHours() < 8) d.setDate(d.getDate() - 1);
      dt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    } else {
      dt = todayISO();
    }
    setShift(s);
    setShiftDate(dt);
    fetchData(dt, s, cfg);
  }, [fetchData]);

  const commonProps = { progress, shift, shiftDate, config: launchedConfig };

  // BUG FIX: Render all pages but hide non-active ones with CSS instead of
  // conditionally mounting/unmounting — avoids canvas re-init on every switch.
  const pages = [
    <FgPacking key="fgPacking" apiData={allData.fgPacking} {...commonProps} />,
    <FgLoading key="fgLoading" apiData={allData.fgLoading} {...commonProps} />,
    <Hourly    key="hourly"    apiData={allData.hourly}    {...commonProps} />,
    <Quality   key="quality"   apiData={allData.quality}   {...commonProps} />,
    <Loss      key="loss"      apiData={allData.loss}      {...commonProps} />,
  ];

  /* ── Launched (fullscreen kiosk) mode ── */
  if (isLaunched) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-50 overflow-hidden font-sans">
        {/* Top bar */}
        <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
          {launchedConfig && (
            <span className="font-extrabold text-[13px] text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {launchedConfig.dashboardName}
            </span>
          )}
          <div className="w-px h-5 bg-slate-100" />

          {/* Shift switcher */}
          {["A", "B"].map((s) => (
            <button
              key={s}
              onClick={() => handleShiftSwitch(s, launchedConfig)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border-[1.5px] transition-all ${
                shift === s
                  ? s === "A"
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-amber-50 text-amber-700 border-amber-300"
                  : "bg-slate-50 text-slate-400 border-slate-100"
              }`}
            >
              Shift {s}
            </button>
          ))}

          <input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            className="px-2.5 py-1 border-[1.5px] border-slate-100 rounded-lg text-xs text-slate-900 bg-slate-50 outline-none"
          />

          <button
            onClick={fetchAllData}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              loading
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-blue-700 hover:bg-blue-800 text-white shadow-sm shadow-blue-200"
            }`}
          >
            {loading ? <Spinner cls="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? "Loading…" : "Refresh"}
          </button>

          <div className="ml-auto flex gap-2 items-center">
            {lastFetched && (
              <span className="text-[11px] text-slate-400">
                Updated {lastFetched.toLocaleTimeString()}
              </span>
            )}
            {isRunning ? (
              <button
                onClick={() => setIsRunning(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border-[1.5px] border-amber-300 transition-all hover:bg-amber-100"
              >
                <Pause className="w-3 h-3" /> Pause
              </button>
            ) : (
              lastFetched && (
                <button
                  onClick={() => setIsRunning(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border-[1.5px] border-emerald-300 transition-all hover:bg-emerald-100"
                >
                  <Play className="w-3 h-3" /> Resume
                </button>
              )
            )}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 border-[1.5px] border-red-300 transition-all hover:bg-red-100"
            >
              <X className="w-3 h-3" /> Exit
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white gap-3.5">
            <Spinner cls="w-8 h-8 text-indigo-500" />
            <p className="text-sm text-slate-400">Fetching shift data…</p>
          </div>
        )}

        {/* Dashboard pages */}
        {!loading && lastFetched && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* BUG FIX: Use visibility toggling instead of index access to
                  prevent canvas teardown on each page transition */}
              {pages.map((page, i) => (
                <div
                  key={i}
                  className="h-full"
                  style={{ display: i === currentPage ? "flex" : "none", flexDirection: "column" }}
                >
                  {page}
                </div>
              ))}
            </div>
            <NavDots
              currentPage={currentPage}
              onGoTo={goTo}
              onPrev={goPrev}
              onNext={goNext}
            />
          </div>
        )}

        {/* No data yet (initial load in progress) */}
        {!loading && !lastFetched && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white gap-4">
            <div className="w-[72px] h-[72px] rounded-2xl bg-slate-100 flex items-center justify-center">
              <Settings className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-base font-bold text-slate-500">
              Loading dashboard data…
            </p>
          </div>
        )}
      </div>
    );
  }

  /* ── Embedded / non-kiosk mode ── */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Production Monitoring
          </h1>
          <p className="text-[11px] text-slate-400">Dashboard · Shift performance overview</p>
        </div>
        {lastFetched && (
          <span className="text-[11px] text-slate-400">
            Updated {lastFetched.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Filters
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[180px]">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="w-full px-3 py-2 border-[1.5px] border-slate-200 rounded-lg text-[13px] text-slate-900 bg-slate-50 outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Shift
              </label>
              <div className="flex bg-slate-50 border-[1.5px] border-slate-200 rounded-lg overflow-hidden">
                {["A", "B"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setShift(s)}
                    className={`px-5 py-2 text-[13px] font-bold transition-all border-r border-slate-200 last:border-r-0 ${
                      shift === s
                        ? "bg-blue-700 text-white"
                        : "bg-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Shift {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <button
                onClick={fetchAllData}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {loading ? <Spinner cls="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                {loading ? "Loading…" : "Load Dashboard"}
              </button>
              {isRunning ? (
                <button
                  onClick={() => setIsRunning(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-50 text-amber-700 border-[1.5px] border-amber-300 hover:bg-amber-100 transition-all"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              ) : (
                lastFetched && (
                  <button
                    onClick={() => setIsRunning(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 border-[1.5px] border-emerald-300 hover:bg-emerald-100 transition-all"
                  >
                    <Play className="w-4 h-4" /> Resume
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3.5">
              <Spinner cls="w-8 h-8 text-blue-600" />
              <p className="text-sm text-slate-400">Fetching shift data…</p>
            </div>
          )}
          {!loading && lastFetched && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
                {pages.map((page, i) => (
                  <div
                    key={i}
                    className="h-full"
                    style={{ display: i === currentPage ? "flex" : "none", flexDirection: "column" }}
                  >
                    {page}
                  </div>
                ))}
              </div>
              <NavDots
                currentPage={currentPage}
                onGoTo={goTo}
                onPrev={goPrev}
                onNext={goNext}
              />
            </div>
          )}
          {!loading && !lastFetched && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
              <div className="w-[72px] h-[72px] rounded-2xl bg-slate-100 flex items-center justify-center">
                <Settings className="w-8 h-8 text-slate-300" strokeWidth={1.2} />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-slate-500">No data loaded</p>
                <p className="text-[13px] text-slate-400 mt-1">
                  Select a date and click Load Dashboard to begin
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export {
  PageHeader,
  TimerBar,
  GaugePanel,
  MetricTable,
  StatCard,
  SidebarPanel,
  DonutCanvas,
  NavDots,
  Spinner,
};

export default Monitoring;