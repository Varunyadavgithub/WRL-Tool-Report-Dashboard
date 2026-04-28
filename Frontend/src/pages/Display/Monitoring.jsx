import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import ReactSpeedometer from "react-d3-speedometer";
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
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

import ProductionDisplay1 from "./Area/ProductionDisplay1";
import ProductionDisplay2 from "./Area/ProductionDisplay2";
import Hourly from "./Area/Hourly";
import Quality from "./Area/Quality";
import Loss from "./Area/Loss";

const PAGE_DURATION_MS = 30_000;
const TOTAL_PAGES = 5;

const PAGES_META = [
  {
    key: "productionDisplay1",
    label: "Production Display 1",
    Icon: Package,
    accentHex: "#1e40af",
  },
  {
    key: "productionDisplay2",
    label: "Production Display 2",
    Icon: Truck,
    accentHex: "#0f766e",
  },
  { key: "hourly", label: "Hourly", Icon: BarChart2, accentHex: "#7c3aed" },
  { key: "quality", label: "Quality", Icon: CheckCircle, accentHex: "#15803d" },
  { key: "loss", label: "Loss", Icon: AlertTriangle, accentHex: "#b45309" },
];

const pad = (n) => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const buildParams = (cfg, shiftDate, shift) => ({
  configId: cfg?.id,
  shiftDate,
  shift,
});

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ── DonutCanvas ── */
const DonutCanvas = ({
  pct = 0,
  size = 120,
  fillColor = "#22c55e",
  trackColor = "#e2e8f0",
}) => {
  const clamped = Math.min(Math.max(Number(pct) || 0, 0), 100);
  const remaining = 100 - clamped;

  const data = useMemo(
    () => ({
      datasets: [
        {
          data: [clamped, remaining],
          backgroundColor: [fillColor, trackColor],
          hoverBackgroundColor: [fillColor, trackColor],
          borderWidth: 0,
          cutout: "75%",
          borderRadius: clamped > 0 && clamped < 100 ? 8 : 0,
          spacing: 2,
        },
      ],
    }),
    [clamped, remaining, fillColor, trackColor],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: {
        animateRotate: true,
        duration: 1400,
        easing: "easeInOutQuart",
      },
      hover: { mode: null },
      rotation: -90,
      circumference: 360,
    }),
    [],
  );

  return (
    <div
      className="relative w-full flex items-center justify-center"
      style={{ maxWidth: size, maxHeight: size }}
    >
      <Doughnut data={data} options={options} />
    </div>
  );
};

/* ── LiveClock ── */
const LiveClock = ({ shift, shiftDate, accentHex }) => {
  const [tick, setTick] = useState(() => new Date());

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
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ background: accentHex }}
    >
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
    <div
      className="h-full"
      style={{ width: `${progress}%`, background: accentHex }}
    />
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
const MetricTable = ({ rows, accentHex }) => (
  <table className="w-full border-separate border-spacing-0 text-xs">
    <thead>
      <tr>
        {[
          ["45%", "Metric", "left"],
          ["10%", "Unit", "center"],
          ["22%", "Target", "center"],
          ["23%", "Actual", "center"],
        ].map(([w, lbl, align]) => (
          <th
            key={lbl}
            className="px-2.5 py-2 text-white font-bold border border-white/20"
            style={{
              background: accentHex,
              textAlign: align,
              width: w,
              fontSize: 11,
            }}
          >
            {lbl}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => {
        const actualColor =
          r.highlight === "yellow"
            ? "#f59e0b"
            : r.green
              ? "#15803d"
              : "#0f172a";
        const mergeColumns = r.target == null;
        return (
          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
            <td className="px-2.5 py-1.5 border border-slate-100 text-slate-700 font-semibold">
              {r.label}
            </td>
            <td className="px-2.5 py-1.5 border border-slate-100 text-slate-400 text-center text-[11px]">
              {r.unit}
            </td>
            {mergeColumns ? (
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
const GaugePanel = memo(
  ({ value, maxValue = 1000, label, sublabel, accentHex }) => {
    const clamped = Math.min(Math.max(Number(value) || 0, 0), maxValue);
    const containerRef = useRef(null);
    const [dims, setDims] = useState({ width: 400, height: 220 });

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const measure = () => {
        const { width, height } = el.getBoundingClientRect();
        if (width > 0 && height > 0) {
          const maxW = Math.floor(width - 16);
          const maxH = Math.floor(height - 100);
          const finalW = Math.max(200, Math.min(maxW, maxH * 2));
          const finalH = Math.floor(finalW / 2);
          if (finalW > 100 && finalH > 50)
            setDims({ width: finalW, height: finalH });
        }
      };
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      measure();
      return () => ro.disconnect();
    }, []);

    const pct = maxValue > 0 ? (clamped / maxValue) * 100 : 0;
    const statusColor =
      pct >= 80 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#dc2626";
    const statusLabel =
      pct >= 80 ? "On Track" : pct >= 50 ? "Warning" : "Critical";

    return (
      <div
        ref={containerRef}
        className="flex flex-col items-center justify-center w-full h-full relative"
      >
        <div
          className="absolute inset-0 opacity-[0.04] rounded-2xl"
          style={{
            background: `radial-gradient(circle at 50% 60%, ${accentHex}, transparent 70%)`,
          }}
        />
        {(label || sublabel) && (
          <div className="text-center mb-2 z-10">
            {label && (
              <p
                className="text-lg font-extrabold uppercase tracking-[0.2em] font-mono"
                style={{ color: accentHex }}
              >
                {label}
              </p>
            )}
            {sublabel && (
              <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
            )}
          </div>
        )}
        <div className="z-10">
          <ReactSpeedometer
            value={clamped}
            minValue={0}
            maxValue={maxValue}
            width={dims.width}
            height={dims.height}
            segments={10}
            segmentColors={[
              "#dc2626",
              "#ea580c",
              "#f97316",
              "#fb923c",
              "#f59e0b",
              "#eab308",
              "#bef264",
              "#86efac",
              "#4ade80",
              "#16a34a",
            ]}
            needleColor={accentHex}
            needleTransitionDuration={2000}
            needleTransition="easeQuadInOut"
            currentValueText=""
            textColor="#1e293b"
            valueTextFontSize="0px"
            labelFontSize="12px"
            ringWidth={35}
            paddingVertical={4}
            forceRender={false}
          />
        </div>
        <div className="z-10 flex flex-col items-center -mt-2">
          <div
            className="px-10 py-3 rounded-2xl text-white font-black text-4xl font-mono tracking-[0.15em] shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${accentHex}, ${accentHex}dd)`,
              boxShadow: `0 8px 30px ${accentHex}40`,
            }}
          >
            {Number(clamped)}
          </div>
          <div
            className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full border-[1.5px]"
            style={{
              borderColor: `${statusColor}44`,
              background: `${statusColor}10`,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: statusColor }}
            />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: statusColor }}
            >
              {statusLabel}
            </span>
            <span className="text-xs font-mono text-slate-400">
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.value === next.value &&
    prev.maxValue === next.maxValue &&
    prev.label === next.label &&
    prev.sublabel === next.sublabel &&
    prev.accentHex === next.accentHex,
);
GaugePanel.displayName = "GaugePanel";

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
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border-[1.5px] transition-all ${active ? "border-current" : "border-transparent"}`}
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

/* ══════════════════════════════════════════════
   MAIN COMPONENT — No standalone UI.
   Always redirects to management if not launched.
   Only renders fullscreen kiosk when launched.
══════════════════════════════════════════════ */
const EMPTY_DATA = {
  productionDisplay1: {},
  productionDisplay2: {},
  hourly: {},
  quality: {},
  loss: {},
};

const Monitoring = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams();

  const routerState = location.state || {};
  const launchedConfig = routerState.config || null;
  const launchedDate = routerState.shiftDate || todayISO();
  const launchedShift = routerState.shift || "A";
  const isLaunched = !!routerState.autoLoad;

  /* Redirect immediately if not launched properly */
  useEffect(() => {
    if (!isLaunched || !launchedConfig) {
      navigate("/display/management", { replace: true });
    }
  }, [isLaunched, launchedConfig, navigate]);

  const [shiftDate, setShiftDate] = useState(launchedDate);
  const [shift, setShift] = useState(launchedShift);
  const [allData, setAllData] = useState(EMPTY_DATA);
  const [currentPage, setCurrentPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lastFetched, setLastFetched] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
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
    setAllData(EMPTY_DATA);
    const params = buildParams(cfg, dateParam, shiftParam);
    const endpoints = {
      productionDisplay1: `${baseURL}dashboard/production-display-1`,
      productionDisplay2: `${baseURL}dashboard/production-display-2`,
      hourly: `${baseURL}dashboard/hourly`,
      quality: `${baseURL}dashboard/quality`,
      loss: `${baseURL}dashboard/loss`,
    };
    try {
      const results = await Promise.allSettled(
        Object.entries(endpoints).map(([key, url]) =>
          axios
            .get(url, { params })
            .then((res) => ({ key, data: res.data?.data ?? res.data })),
        ),
      );
      const merged = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") merged[r.value.key] = r.value.data;
      });
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === TOTAL_PAGES) {
        toast.error("All endpoints failed. Check server connection.");
      } else {
        if (failed > 0)
          toast(`${failed} endpoint(s) had errors.`, { icon: "⚠️" });
        else toast.success("Dashboard loaded successfully.");
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
  }, []);

  useEffect(() => {
    if (isLaunched && launchedConfig)
      fetchData(launchedDate, launchedShift, launchedConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = useCallback(
    () => fetchData(shiftDate, shift, launchedConfig),
    [fetchData, shiftDate, shift, launchedConfig],
  );

  const goTo = useCallback((i) => {
    setCurrentPage(i);
    setProgress(0);
  }, []);
  const goPrev = useCallback(() => {
    setCurrentPage((p) => (p - 1 + TOTAL_PAGES) % TOTAL_PAGES);
    setProgress(0);
  }, []);
  const goNext = useCallback(() => {
    setCurrentPage((p) => (p + 1) % TOTAL_PAGES);
    setProgress(0);
  }, []);

  const handleShiftSwitch = useCallback(
    (s, cfg) => {
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
    },
    [fetchData],
  );

  /* If not launched, render nothing (redirect handles it) */
  if (!isLaunched || !launchedConfig) return null;

  const commonProps = { progress, shift, shiftDate, config: launchedConfig };

  const pages = [
    <ProductionDisplay1
      key="pd1"
      apiData={allData.productionDisplay1}
      {...commonProps}
    />,
    <ProductionDisplay2
      key="pd2"
      apiData={allData.productionDisplay2}
      {...commonProps}
    />,
    <Hourly key="hourly" apiData={allData.hourly} {...commonProps} />,
    <Quality key="quality" apiData={allData.quality} {...commonProps} />,
    <Loss key="loss" apiData={allData.loss} {...commonProps} />,
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Top bar */}
      <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
        <span className="font-extrabold text-[13px] text-slate-900 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          {launchedConfig.dashboardName}
        </span>
        <div className="w-px h-5 bg-slate-100" />
        {["A", "B"].map((s) => (
          <button
            key={s}
            onClick={() => handleShiftSwitch(s, launchedConfig)}
            className={`px-3 py-1 rounded-lg text-xs font-bold border-[1.5px] transition-all ${shift === s ? (s === "A" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-amber-50 text-amber-700 border-amber-300") : "bg-slate-50 text-slate-400 border-slate-100"}`}
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-700 hover:bg-blue-800 text-white shadow-sm shadow-blue-200"}`}
        >
          {loading ? (
            <Spinner cls="w-3 h-3" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
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
            onClick={() => navigate("/display/management")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 border-[1.5px] border-red-300 transition-all hover:bg-red-100"
          >
            <X className="w-3 h-3" /> Exit
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white gap-3.5">
          <Spinner cls="w-8 h-8 text-indigo-500" />
          <p className="text-sm text-slate-400">Fetching shift data...!!!</p>
        </div>
      )}

      {/* Dashboard pages */}
      {!loading && lastFetched && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            {pages.map((page, i) => (
              <div
                key={i}
                className="h-full"
                style={{
                  display: i === currentPage ? "flex" : "none",
                  flexDirection: "column",
                }}
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

      {/* Waiting for first fetch */}
      {!loading && !lastFetched && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white gap-3.5">
          <Spinner cls="w-8 h-8 text-indigo-500" />
          <p className="text-sm text-slate-400">Initializing dashboard…</p>
        </div>
      )}
    </div>
  );
};

export {
  PageHeader,
  TimerBar,
  GaugePanel,
  MetricTable,
  StatCard,
  DonutCanvas,
  Spinner,
};
export default Monitoring;
