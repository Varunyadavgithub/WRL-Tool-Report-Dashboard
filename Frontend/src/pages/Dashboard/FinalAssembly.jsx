import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import Loader from "../../components/ui/Loader";
import { baseURL } from "../../assets/assets";
import {
  Loader2,
  Search,
  LayoutDashboard,
  RefreshCw,
  Star,
  Zap,
  Pause,
  Play,
  Clock,
  CalendarDays,
  Factory,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  ClipboardList,
  Box,
  Truck,
  Gauge,
  Timer,
  Layers,
  TrendingUp,
  Activity,
  ShieldAlert,
  ShieldCheck,
  PackageOpen,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  ChartTitle,
  Tooltip,
  Legend,
  Filler,
);

// ─── Constants ──────────────────────────────────────────────────────────────────
const PAGE_DURATION_MS = 8000;
const TOTAL_PAGES = 5;

const SHIFT_OPTIONS = [
  { value: "A", label: "Shift A — 08:00 to 20:00" },
  { value: "B", label: "Shift B — 20:00 to 08:00" },
];

const PAGES_META = [
  { key: "fgPacking", label: "FG Packing", icon: Box },
  { key: "fgLoading", label: "FG Loading", icon: Truck },
  { key: "hourly", label: "Hourly", icon: BarChart3 },
  { key: "quality", label: "Quality", icon: CheckCircle2 },
  { key: "loss", label: "Loss", icon: AlertTriangle },
];

const GAUGE_COLORS = [
  "#dc2626",
  "#e53e3e",
  "#ea580c",
  "#f97316",
  "#fb923c",
  "#f59e0b",
  "#eab308",
  "#d4d40a",
  "#bef264",
  "#86efac",
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#15803d",
  "#166534",
  "#14532d",
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── Canvas: Speedometer Gauge ──────────────────────────────────────────────────
const GaugeCanvas = ({ value = 0, label = "", sublabel = "" }) => {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width,
      H = c.height;
    const cx = W / 2,
      cy = H - 8;
    const R = Math.min(cx - 6, cy - 4);

    ctx.clearRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(cx, cy, R + 3, Math.PI, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#374151";
    ctx.stroke();

    const seg = Math.PI / GAUGE_COLORS.length;
    GAUGE_COLORS.forEach((col, i) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, Math.PI + i * seg, Math.PI + (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, R - 22, 0, Math.PI * 2);
    ctx.fillStyle = "#111827";
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI + (i / 10) * Math.PI;
      const sinA = Math.sin(angle),
        cosA = Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(cx + cosA * (R - 22), cy + sinA * (R - 22));
      ctx.lineTo(cx + cosA * (R - 5), cy + sinA * (R - 5));
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "bold 8px monospace";
        ctx.fillText(
          String(i * 100),
          cx + cosA * (R - 34),
          cy + sinA * (R - 34),
        );
      }
    }
    for (let i = 0; i <= 50; i++) {
      if (i % 5 === 0) continue;
      const angle = Math.PI + (i / 50) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(angle) * (R - 9),
        cy + Math.sin(angle) * (R - 9),
      );
      ctx.lineTo(
        cx + Math.cos(angle) * (R - 5),
        cy + Math.sin(angle) * (R - 5),
      );
      ctx.strokeStyle = "#4b5563";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#d1d5db";
    ctx.fillText(label, cx, cy - 44);
    ctx.font = "9px monospace";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(sublabel, cx, cy - 28);

    const clampedVal = Math.min(Math.max(value, 0), 1000);
    const angle = Math.PI + (clampedVal / 1000) * Math.PI;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-(R - 26), 0);
    ctx.lineTo(10, -3.5);
    ctx.lineTo(10, 3.5);
    ctx.closePath();
    ctx.fillStyle = "#f9fafb";
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#6b7280";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#374151";
    ctx.fill();
  }, [value, label, sublabel]);

  return (
    <canvas ref={ref} width={300} height={180} className="block max-w-full" />
  );
};

// ─── Canvas: Donut ──────────────────────────────────────────────────────────────
const DonutCanvas = ({
  pct = 0,
  size = 150,
  fillColor = "#10b981",
  trackColor = "#374151",
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const cx = c.width / 2,
      cy = c.height / 2;
    const r = Math.min(cx, cy) - 12;

    ctx.clearRect(0, 0, c.width, c.height);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 15;
    ctx.strokeStyle = trackColor;
    ctx.stroke();

    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.min(pct, 100) / 100) * Math.PI * 2,
      );
      ctx.lineWidth = 15;
      ctx.strokeStyle = fillColor;
      ctx.lineCap = "butt";
      ctx.stroke();
    }
  }, [pct, fillColor, trackColor]);

  return <canvas ref={ref} width={size} height={size} />;
};

// ─── Live Clock Hook ────────────────────────────────────────────────────────────
const useLiveClock = () => {
  const [tick, setTick] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return `${pad(tick.getHours())}:${pad(tick.getMinutes())}:${pad(tick.getSeconds())}`;
};

// ─── Page Header ────────────────────────────────────────────────────────────────
const PageHeader = ({ title, shift, shiftDate, whiteStyle = false }) => {
  const timeStr = useLiveClock();
  const shiftLabel =
    shift === "A" ? "08:00:00 To 20:00:00" : "20:00:00 To 08:00:00";

  if (whiteStyle) {
    return (
      <div className="shrink-0">
        <div className="bg-white flex items-center gap-3 px-4 py-2 border-b-[3px] border-blue-700">
          <LogoCircle />
          <div className="flex-1 text-center font-extrabold text-xl text-gray-900 uppercase tracking-wide">
            {title}
          </div>
        </div>
        <MetaRow
          shift={shift}
          shiftDate={shiftDate}
          timeStr={timeStr}
          shiftLabel={shiftLabel}
          light
        />
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <div className="bg-gray-800 flex items-center gap-3 px-4 py-2 border-b border-gray-700">
        <LogoCircle />
        <div className="flex-1 text-center font-extrabold text-lg text-white uppercase tracking-wide">
          {title}
        </div>
      </div>
      <MetaRow
        shift={shift}
        shiftDate={shiftDate}
        timeStr={timeStr}
        shiftLabel={shiftLabel}
      />
    </div>
  );
};

const LogoCircle = () => (
  <div className="w-12 h-12 rounded-full shrink-0 bg-gradient-to-br from-amber-200 to-amber-600 border-2 border-amber-700 flex items-center justify-center">
    <span className="text-white font-black text-xl leading-none">W</span>
  </div>
);

const MetaRow = ({ shift, shiftDate, timeStr, shiftLabel, light = false }) => (
  <div
    className={`flex items-center px-4 py-1.5 text-xs gap-10 shrink-0 ${
      light
        ? "bg-blue-50 border-b border-blue-200"
        : "bg-gray-900 border-b border-gray-800"
    }`}
  >
    <span className={light ? "text-gray-500" : "text-gray-500"}>
      Shift:{" "}
      <span className={`font-bold ${light ? "text-gray-900" : "text-white"}`}>
        {shift ? `SHIFT ${shift}` : "—"}
      </span>
    </span>
    <span className={light ? "text-gray-500" : "text-gray-500"}>
      Date:{" "}
      <span className={`font-bold ${light ? "text-gray-900" : "text-white"}`}>
        {shiftDate || "—"}
      </span>
    </span>
    <span className={light ? "text-gray-500" : "text-gray-500"}>
      Time:{" "}
      <span className={`font-bold ${light ? "text-gray-900" : "text-white"}`}>
        {timeStr}
      </span>
    </span>
    <span className={`ml-auto ${light ? "text-gray-500" : "text-gray-500"}`}>
      Shift Duration:{" "}
      <span className={`font-bold ${light ? "text-gray-900" : "text-white"}`}>
        {shift ? shiftLabel : "—"}
      </span>
    </span>
  </div>
);

// ─── Timer Progress Bar ─────────────────────────────────────────────────────────
const TimerBar = ({ progress }) => (
  <div className="h-[3px] bg-gray-800 shrink-0">
    <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
  </div>
);

// ─── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value }) => (
  <div className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-center">
    <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
    <div className="text-[15px] font-bold text-white mt-0.5">
      {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
    </div>
  </div>
);

// ─── Metric Table Row ───────────────────────────────────────────────────────────
const MetricRow = ({ label, unit, target, actual, highlight, odd }) => (
  <tr className={odd ? "bg-[#172030]" : "bg-gray-800"}>
    <td className="px-2.5 py-1.5 border border-gray-700 text-gray-300 font-semibold text-xs">
      {label}
    </td>
    <td className="px-2.5 py-1.5 border border-gray-700 text-gray-500 text-xs text-center">
      {unit}
    </td>
    <td className="px-2.5 py-1.5 border border-gray-700 text-amber-400 font-bold text-xs text-center">
      {target ?? ""}
    </td>
    <td
      className={`px-2.5 py-1.5 border border-gray-700 font-bold text-xs text-center ${
        highlight === "yellow" ? "text-yellow-300" : "text-gray-100"
      }`}
    >
      {actual ?? "—"}
    </td>
  </tr>
);

// ─── Gauge Panel ────────────────────────────────────────────────────────────────
const GaugePanel = ({ value, label, sublabel }) => (
  <div className="w-80 shrink-0 flex flex-col items-center justify-center bg-gray-900 border-r border-gray-700 py-3">
    <GaugeCanvas value={value} label={label} sublabel={sublabel} />
    <div className="mt-2.5 px-6 py-1 bg-gray-800 border-2 border-gray-600 rounded text-white font-bold text-xl font-mono tracking-widest">
      {String(value ?? 0).padStart(3, "0")}.00
    </div>
  </div>
);

// ─── Donut Panel ────────────────────────────────────────────────────────────────
const DonutPanel = ({
  pct = 0,
  fillColor = "#10b981",
  label = "CONSUMED TIME %",
}) => (
  <div>
    <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1.5">
      {label}
    </div>
    <div className="flex items-center">
      <div className="w-[18px] bg-[#1e3a5f] shrink-0 self-stretch" />
      <div className="flex-1 relative flex justify-center">
        <DonutCanvas pct={pct} size={140} fillColor={fillColor} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-xl">
          {Number(pct || 0).toFixed(0)}%
        </div>
      </div>
    </div>
  </div>
);

// ─── Info Box ───────────────────────────────────────────────────────────────────
const InfoBox = ({ rows }) => (
  <div className="bg-[#1e3a5f] border border-[#2a5080] rounded-md px-2.5 py-2">
    {rows.map(([k, v], i) => (
      <div key={i} className="text-[11px] text-blue-300 leading-[1.8]">
        {k}: <b className="text-white">{v ?? "—"}</b>
      </div>
    ))}
  </div>
);

// ─── Left Sidebar ───────────────────────────────────────────────────────────────
const LeftSidebar = ({
  consumedPct = 0,
  fillColor = "#10b981",
  infoRows = [],
}) => (
  <div className="w-[210px] shrink-0 flex flex-col gap-3 p-3 bg-[#1a2740] border-r border-gray-700 justify-center">
    <DonutPanel pct={consumedPct} fillColor={fillColor} />
    <InfoBox rows={infoRows} />
  </div>
);

// ─── Nav Dots ───────────────────────────────────────────────────────────────────
const NavDots = ({ currentPage, onGoTo }) => (
  <div className="shrink-0 flex items-center justify-center gap-3 py-1.5 bg-gray-950 border-t border-gray-800">
    {PAGES_META.map((pg, i) => {
      const Icon = pg.icon;
      return (
        <button
          key={i}
          onClick={() => onGoTo(i)}
          className="bg-transparent border-none cursor-pointer flex flex-col items-center gap-1"
        >
          <div
            className={`flex items-center justify-center rounded-full transition-all duration-300 ${
              i === currentPage
                ? "w-7 h-7 bg-emerald-500"
                : "w-2.5 h-2.5 bg-gray-700"
            }`}
          >
            {i === currentPage && <Icon className="w-3.5 h-3.5 text-white" />}
          </div>
          <span
            className={`text-[9px] font-mono ${
              i === currentPage ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {pg.label}
          </span>
        </button>
      );
    })}
  </div>
);

// ─── Page 1 — FG Packing ────────────────────────────────────────────────────────
const Page1 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const d = apiData;
  const rows = [
    {
      label: "Working Time",
      unit: "Min",
      target: 570,
      actual: d.WorkingTimeMin,
    },
    {
      label: "Line Tact Time",
      unit: "Sec",
      target: d.TactTimeSec,
      actual: d.TactTimeSec,
    },
    {
      label: "Shift Output Target",
      unit: "No's",
      target: d.ShiftOutputTarget,
      actual: d.ShiftOutputTarget,
    },
    {
      label: "Packing Till Now",
      unit: "No's",
      target: d.ProratedTarget,
      actual: d.PackingTillNow,
    },
    { label: "Loss Units", unit: "No's", target: null, actual: d.LossUnits },
    { label: "Loss Time", unit: "Min", target: null, actual: d.LossTime },
    {
      label: "UPH Target",
      unit: "No's",
      target: d.UPHTarget,
      actual: d.ActualUPH,
    },
    {
      label: "Efficiency Till Now",
      unit: "%",
      target: null,
      actual: d.EfficiencyTillNow,
      highlight: "yellow",
    },
    { label: "Performance", unit: "%", target: null, actual: d.PerformancePct },
    { label: "Balance Qty", unit: "No's", target: null, actual: d.BalanceQty },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-gray-900">
      <PageHeader
        title="FINAL AREA PRODUCTION PERFORMANCE"
        shift={shift}
        shiftDate={shiftDate}
      />
      <TimerBar progress={progress} />
      <div className="flex flex-1 min-h-0">
        <GaugePanel
          value={d.GaugeValue ?? 0}
          label="Cabinet Packing"
          sublabel="FG/Shift"
        />
        <div className="flex-1 flex flex-col p-3.5 min-w-0">
          <div className="bg-[#b8cfe8] text-gray-900 font-bold text-sm text-center py-1.5">
            FG PACKING
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-left w-[45%]">
                  Metric
                </th>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-center w-[10%]">
                  Unit
                </th>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-center w-[22%]">
                  Target
                </th>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-center w-[23%]">
                  Actual
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <MetricRow key={i} {...r} odd={i % 2 !== 0} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1 px-2 py-1.5 bg-gray-800 border-t border-gray-700 shrink-0">
        <StatCard label="Monthly Production Qty" value={d.MonthlyPlanQty} />
        <StatCard label="Monthly Achievement" value={d.MonthlyAchieved} />
        <StatCard label="Remaining Qty" value={d.MonthlyRemaining} />
        <StatCard label="Asking Rate" value={d.AskingRate} />
        <StatCard label="Remaining Days" value={d.RemainingDays} />
      </div>
    </div>
  );
};

// ─── Page 2 — FG Loading ────────────────────────────────────────────────────────
const Page2 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const d = apiData;
  const rows = [
    {
      label: "Working Time",
      unit: "Min",
      target: 570,
      actual: d.WorkingTimeMin,
    },
    {
      label: "Shift Output Target",
      unit: "No's",
      target: d.ShiftOutputTarget,
      actual: d.ShiftOutputTarget,
    },
    {
      label: "Loading Till Now",
      unit: "No's",
      target: d.ProratedTarget,
      actual: d.LoadingTillNow,
    },
    { label: "Loss Units", unit: "No's", target: null, actual: d.LossUnits },
    { label: "Loss Time", unit: "Min", target: null, actual: d.LossTime },
    {
      label: "UPH Target",
      unit: "No's",
      target: d.UPHTarget,
      actual: d.ActualUPH,
    },
    {
      label: "Efficiency Till Now",
      unit: "%",
      target: null,
      actual: d.EfficiencyTillNow,
      highlight: "yellow",
    },
    { label: "Performance", unit: "%", target: null, actual: d.PerformancePct },
    { label: "Balance Qty", unit: "No's", target: null, actual: d.BalanceQty },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-gray-900">
      <PageHeader
        title="FINAL AREA PRODUCTION PERFORMANCE"
        shift={shift}
        shiftDate={shiftDate}
      />
      <TimerBar progress={progress} />
      <div className="flex flex-1 min-h-0">
        <GaugePanel
          value={d.GaugeValue ?? 0}
          label="FG Loading"
          sublabel="Units/Shift"
        />
        <div className="flex-1 flex flex-col p-3.5 min-w-0">
          <div className="bg-[#b8cfe8] text-gray-900 font-bold text-sm text-center py-1.5">
            FG LOADING
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-left w-[45%]">
                  Metric
                </th>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-center w-[10%]">
                  Unit
                </th>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-center w-[22%]">
                  Target
                </th>
                <th className="px-2.5 py-[7px] bg-gray-700 text-gray-300 text-[11px] font-bold border border-gray-600 text-center w-[23%]">
                  Actual
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <MetricRow key={i} {...r} odd={i % 2 !== 0} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1 px-2 py-1.5 bg-gray-800 border-t border-gray-700 shrink-0">
        <StatCard label="Monthly Production Qty" value={d.MonthlyPlanQty} />
        <StatCard label="Monthly Achievement" value={d.MonthlyAchieved} />
        <StatCard label="Remaining Qty" value={d.MonthlyRemaining} />
        <StatCard label="Asking Rate" value={d.AskingRate} />
        <StatCard label="Remaining Days" value={d.RemainingDays} />
      </div>
    </div>
  );
};

// ─── Page 3 — Hourly Production ─────────────────────────────────────────────────
const Page3 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { hours = [], summary = {} } = apiData;

  const chartData = useMemo(
    () => ({
      labels: hours.map((h) => h.TimeLabel || `H${h.HourNo}`),
      datasets: [
        {
          type: "bar",
          label: "Target",
          data: hours.map((h) => h.Target),
          backgroundColor: "rgba(68,114,196,0.8)",
          borderColor: "#4472c4",
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "Actual",
          data: hours.map((h) => h.Actual),
          backgroundColor: "rgba(237,125,49,0.8)",
          borderColor: "#ed7d31",
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Loss",
          data: hours.map((h) => h.HourLoss),
          borderColor: "#9ca3af",
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.3,
          fill: false,
          yAxisID: "y2",
        },
      ],
    }),
    [hours],
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e1b4b",
          titleColor: "#e0e7ff",
          bodyColor: "#c7d2fe",
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#374151", font: { size: 9 }, maxRotation: 0 },
        },
        y: {
          position: "left",
          beginAtZero: true,
          ticks: { color: "#374151", font: { size: 9 } },
          grid: { color: "#e5e7eb" },
        },
        y2: {
          position: "right",
          beginAtZero: true,
          ticks: { color: "#9ca3af", font: { size: 9 } },
          grid: { display: false },
        },
      },
    }),
    [],
  );

  return (
    <div className="flex flex-col w-full h-full bg-gray-900">
      <PageHeader
        title="FINAL AREA HOURLY PRODUCTION PERFORMANCE"
        shift={shift}
        shiftDate={shiftDate}
      />
      <TimerBar progress={progress} />
      <div className="flex flex-1 min-h-0">
        <LeftSidebar
          consumedPct={summary.ConsumedTimePct}
          fillColor="#10b981"
          infoRows={[
            ["Plan", summary.ShiftPlan],
            ["Achieved", summary.TotalAchieved],
            ["Remaining", summary.Remaining],
          ]}
        />
        <div className="flex-1 flex flex-col p-2 gap-2 bg-[#1e2d45] min-w-0">
          {/* Hour table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="bg-[#1e3a5f] text-blue-300 px-2 py-1.5 border border-[#2a5a8a] text-left whitespace-nowrap">
                    Metric
                  </th>
                  {hours.map((h, i) => (
                    <th
                      key={i}
                      className="bg-[#1e3a5f] text-blue-300 px-1.5 py-1.5 border border-[#2a5a8a] text-center"
                    >
                      H{h.HourNo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="bg-[#1a3050] text-slate-300 px-2 py-1.5 border border-[#2a4a70] font-semibold">
                    Cumul. Loss
                  </td>
                  {hours.map((h, i) => (
                    <td
                      key={i}
                      className="bg-[#1a3050] text-gray-100 px-1.5 py-1.5 border border-[#2a4a70] text-center"
                    >
                      {h.CumulativeLoss}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="bg-[#162840] text-slate-300 px-2 py-1.5 border border-[#2a4a70] font-semibold">
                    Achievement
                  </td>
                  {hours.map((h, i) => {
                    const ach = Number(h.AchievementPct || 0);
                    return (
                      <td
                        key={i}
                        className={`bg-[#162840] px-1.5 py-1.5 border border-[#2a4a70] text-center font-bold ${
                          ach >= 85 ? "text-green-400" : "text-yellow-400"
                        }`}
                      >
                        {ach.toFixed(0)}%
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          {/* Chart */}
          <div className="flex-1 bg-white border border-gray-300 rounded-md p-2 min-h-[140px] flex flex-col">
            <div className="text-xs font-bold text-gray-700 text-center mb-1">
              Hourly Report
            </div>
            <div className="flex gap-3.5 justify-center mb-1.5 text-[11px] text-gray-700">
              {[
                ["#4472c4", "Target"],
                ["#ed7d31", "Actual"],
                ["#9ca3af", "Unit Loss"],
              ].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: c }}
                  />
                  {l}
                </span>
              ))}
            </div>
            <div className="flex-1 relative min-h-0">
              <Chart type="bar" data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Page 4 — Quality ───────────────────────────────────────────────────────────
const Page4 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { summary: qs = {}, defects = [] } = apiData;

  const pieChartData = useMemo(
    () => ({
      labels: ["OK Units", "Defect Units"],
      datasets: [
        {
          type: "doughnut",
          data: [qs.OkUnit || 0, qs.DefectUnit || 0],
          backgroundColor: ["rgba(22,163,74,0.85)", "rgba(220,38,38,0.85)"],
          borderColor: ["#15803d", "#b91c1c"],
          borderWidth: 2,
          hoverOffset: 0,
        },
      ],
    }),
    [qs],
  );

  const pieOptions = useMemo(
    () => ({
      responsive: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
      },
      animation: { duration: 400 },
    }),
    [],
  );

  return (
    <div className="flex flex-col w-full h-full bg-gray-900">
      <PageHeader
        title="FINAL AREA QUALITY PERFORMANCE"
        shift={shift}
        shiftDate={shiftDate}
      />
      <TimerBar progress={progress} />
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-[210px] shrink-0 flex flex-col gap-2.5 p-3 bg-[#1a2740] border-r border-gray-700 justify-center">
          <DonutPanel pct={qs.ConsumedTimePct} fillColor="#10b981" />
          <table className="w-full border-collapse text-[11px] mt-1">
            <tbody>
              {[
                ["Plan", qs.Plan],
                ["Achieved", qs.TotalAchieved],
                ["OK Unit", qs.OkUnit],
                ["Defect", qs.DefectUnit],
                ["OK %", qs.OkPct != null ? `${qs.OkPct}%` : null],
                ["Defect %", qs.DefectPct != null ? `${qs.DefectPct}%` : null],
                ["Rework", qs.ReworkDone],
              ].map(([k, v], i) => (
                <tr key={i}>
                  <td className="px-1.5 py-0.5 border border-[#2a5a8a] bg-[#1a3050] text-blue-300">
                    {k}
                  </td>
                  <td className="px-1.5 py-0.5 border border-[#2a5a8a] bg-[#1a3050] text-white text-right font-bold">
                    {v ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Main area */}
        <div className="flex-1 flex items-center justify-around p-3 gap-5 bg-[#1e2d45] min-w-0">
          {/* Pie */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-blue-300 font-bold">
              Quality Overview
            </div>
            <div className="relative">
              <Chart
                type="doughnut"
                data={pieChartData}
                options={pieOptions}
                width={220}
                height={220}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-[28px] font-bold text-white">
                  {qs.TotalAchieved ?? 0}
                </div>
                <div className="text-[10px] text-gray-400">Total</div>
              </div>
            </div>
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-green-300">
                <span className="w-2.5 h-2.5 bg-green-600 rounded-sm inline-block" />
                OK: {qs.OkUnit ?? 0}
              </span>
              <span className="flex items-center gap-1 text-red-300">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-sm inline-block" />
                Defect: {qs.DefectUnit ?? 0}
              </span>
            </div>
          </div>
          {/* Defect table */}
          <div className="flex-1 min-w-0">
            <div className="bg-[#1e3a5f] text-white font-bold text-sm text-center p-2 border border-[#2a5a8a]">
              Today's Top Defects
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h) => (
                    <th
                      key={h}
                      className="bg-[#1e3a5f] text-blue-300 px-2.5 py-1.5 border border-[#2a5a8a] text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defects.length > 0 ? (
                  defects.map((df, i) => (
                    <tr key={i}>
                      <td className="bg-[#1a3050] text-white px-2.5 py-[7px] border border-[#2a5a8a] text-center">
                        {df.SrNo}
                      </td>
                      <td className="bg-[#1a3050] text-slate-200 px-2.5 py-[7px] border border-[#2a5a8a]">
                        {df.DefectName}
                      </td>
                      <td className="bg-[#1a3050] text-red-400 px-2.5 py-[7px] border border-[#2a5a8a] text-center font-bold">
                        {df.DefectCount}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="bg-[#1a3050] text-gray-400 px-5 py-5 text-center border border-[#2a5a8a]"
                    >
                      No defects recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Page 5 — Loss ──────────────────────────────────────────────────────────────
const Page5 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;
  const maxTime = useMemo(
    () => Math.max(...stations.map((s) => s.TotalStopTime), 1),
    [stations],
  );

  return (
    <div className="flex flex-col w-full h-full bg-gray-900">
      <PageHeader
        title="FINAL AREA LOSS PERFORMANCE"
        shift={shift}
        shiftDate={shiftDate}
        whiteStyle
      />
      <TimerBar progress={progress} />
      <div className="flex flex-1 min-h-0">
        <LeftSidebar
          consumedPct={ls.ConsumedTimePct}
          fillColor="#f59e0b"
          infoRows={[
            ["Plan", ls.Plan],
            ["Achieved", ls.Achieved],
            ["Balance", ls.Remaining],
          ]}
        />
        <div className="flex-1 p-3 overflow-auto bg-[#1e2d45]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {["Station Name", "Stop Time (Min)", "Stop Count"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`bg-gray-700 text-gray-300 px-3 py-2 border border-gray-600 font-bold ${
                        i === 0 ? "text-left" : "text-center"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {stations.length > 0 ? (
                stations.map((s, i) => {
                  const intensity = s.TotalStopTime / maxTime;
                  const rVal = Math.round(160 + intensity * 95);
                  const rowBg =
                    s.TotalStopTime > 100
                      ? `rgb(${rVal},18,18)`
                      : s.TotalStopTime > 20
                        ? "#7f1d1d"
                        : "#1f2937";
                  return (
                    <tr key={i}>
                      <td
                        className="px-3 py-[7px] border border-gray-600 font-semibold text-gray-50"
                        style={{ background: rowBg }}
                      >
                        {s.StationName}
                      </td>
                      <td
                        className={`px-3 py-[7px] border border-gray-600 text-center font-bold ${
                          s.TotalStopTime > 50
                            ? "text-red-300"
                            : "text-gray-300"
                        }`}
                        style={{ background: rowBg }}
                      >
                        {s.TotalStopTime}
                      </td>
                      <td
                        className={`px-3 py-[7px] border border-gray-600 text-center font-bold ${
                          s.TotalStopCount > 10
                            ? "text-red-300"
                            : "text-gray-300"
                        }`}
                        style={{ background: rowBg }}
                      >
                        {s.TotalStopCount}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="py-5 text-center text-gray-500 bg-gray-800 border border-gray-700"
                  >
                    No loss data recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const FinalAssembly = () => {
  const [loading, setLoading] = useState(false);
  const [shiftDate, setShiftDate] = useState(todayISO());
  const [shift, setShift] = useState("A");
  const [allData, setAllData] = useState({
    fgPacking: {},
    fgLoading: {},
    hourly: {},
    quality: {},
    loss: {},
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lastFetched, setLastFetched] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  /* Auto-rotate */
  useEffect(() => {
    if (!isRunning) return;
    let elapsed = 0;
    setProgress(0);
    const id = setInterval(() => {
      elapsed += 50;
      setProgress(Math.min((elapsed / PAGE_DURATION_MS) * 100, 100));
      if (elapsed >= PAGE_DURATION_MS) {
        elapsed = 0;
        setProgress(0);
        setCurrentPage((p) => (p + 1) % TOTAL_PAGES);
      }
    }, 50);
    return () => clearInterval(id);
  }, [currentPage, isRunning]);

  /* Fetch all endpoints */
  const fetchAllData = useCallback(async () => {
    if (!shiftDate) {
      toast.error("Please select a shift date.");
      return;
    }
    setLoading(true);
    setIsRunning(false);
    setAllData({
      fgPacking: {},
      fgLoading: {},
      hourly: {},
      quality: {},
      loss: {},
    });

    const params = { shiftDate, shift };
    const endpoints = {
      fgPacking: `${baseURL}production/dashboard/fg-packing`,
      fgLoading: `${baseURL}production/dashboard/fg-loading`,
      hourly: `${baseURL}production/dashboard/hourly`,
      quality: `${baseURL}production/dashboard/quality`,
      loss: `${baseURL}production/dashboard/loss`,
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

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount === TOTAL_PAGES) {
        toast.error("All endpoints failed. Check server connection.");
      } else {
        if (failedCount > 0)
          toast(`${failedCount} endpoint(s) returned errors.`, { icon: "⚠️" });
        else toast.success("Dashboard data loaded successfully.");
        setAllData((prev) => ({ ...prev, ...merged }));
        setLastFetched(new Date());
        setCurrentPage(0);
        setIsRunning(true);
      }
    } catch {
      toast.error("Failed to fetch dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [shiftDate, shift]);

  /* Quick buttons */
  const handleTodayShiftA = useCallback(() => {
    setShiftDate(todayISO());
    setShift("A");
    setTimeout(fetchAllData, 0);
  }, [fetchAllData]);

  const handleTodayShiftB = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - (new Date().getHours() < 8 ? 1 : 0));
    setShiftDate(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    );
    setShift("B");
    setTimeout(fetchAllData, 0);
  }, [fetchAllData]);

  const goTo = useCallback((i) => {
    setCurrentPage(i);
    setProgress(0);
  }, []);

  const commonProps = { progress, shift, shiftDate };
  const pages = [
    <Page1 key={0} apiData={allData.fgPacking} {...commonProps} />,
    <Page2 key={1} apiData={allData.fgLoading} {...commonProps} />,
    <Page3 key={2} apiData={allData.hourly} {...commonProps} />,
    <Page4 key={3} apiData={allData.quality} {...commonProps} />,
    <Page5 key={4} apiData={allData.loss} {...commonProps} />,
  ];

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page sub-header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 rounded-xl p-2.5">
            <LayoutDashboard className="w-6 h-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
              Final Area Production Dashboard
            </h1>
            <p className="text-[11px] text-slate-400">
              Live Shift Performance · FG Packing & Loading · Quality · Loss
            </p>
          </div>
        </div>
        {lastFetched && (
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Last refreshed</p>
            <p className="text-xs font-semibold text-slate-600">
              {lastFetched.toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Filter Panel ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Filters
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Shift Date */}
            <div className="min-w-[180px]">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                Shift Date
              </label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
              />
            </div>

            {/* Shift Toggle */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                Shift
              </label>
              <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                {SHIFT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setShift(opt.value)}
                    className={`px-5 py-2 text-sm font-bold transition-all border-r border-slate-200 last:border-r-0 ${
                      shift === opt.value
                        ? "bg-slate-700 text-white"
                        : "bg-transparent text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Shift {opt.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap pb-0.5">
              <button
                onClick={fetchAllData}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-slate-800 hover:bg-slate-900 text-white shadow-sm shadow-slate-300"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Loading..." : "Load Dashboard"}
              </button>

              <button
                onClick={handleTodayShiftA}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Star className="w-3 h-3" /> TODAY A
              </button>

              <button
                onClick={handleTodayShiftB}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-3 h-3" /> TODAY B
              </button>

              {isRunning && (
                <button
                  onClick={() => setIsRunning(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  <Pause className="w-3 h-3" /> Pause
                </button>
              )}
              {!isRunning && lastFetched && (
                <button
                  onClick={() => setIsRunning(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  <Play className="w-3 h-3" /> Resume
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Dashboard Area ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader />
              <p className="text-sm text-slate-400">
                Fetching shift data from all endpoints...
              </p>
            </div>
          )}

          {!loading && lastFetched && (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                {pages[currentPage]}
              </div>
              <NavDots currentPage={currentPage} onGoTo={goTo} />
            </>
          )}

          {!loading && !lastFetched && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Factory className="w-12 h-12 opacity-20" strokeWidth={1.2} />
              <p className="text-sm font-bold text-slate-600">
                No data loaded yet
              </p>
              <p className="text-xs text-slate-400">
                Select a shift date and click Load Dashboard
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinalAssembly;
