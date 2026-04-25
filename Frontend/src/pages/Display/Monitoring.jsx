import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  PackageOpen,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  LineController,
  DoughnutController,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { baseURL } from "../../assets/assets";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  LineController,
  DoughnutController,
  ChartTitle,
  Tooltip,
  Legend,
  Filler,
);

/* ── Constants ── */
const PAGE_DURATION_MS = 30000;
const TOTAL_PAGES = 5;

const PAGES_META = [
  {
    key: "fgPacking",
    label: "FG Packing",
    Icon: Package,
    accent: "blue",
    accentHex: "#1e40af",
  },
  {
    key: "fgLoading",
    label: "FG Loading",
    Icon: Truck,
    accent: "teal",
    accentHex: "#0f766e",
  },
  {
    key: "hourly",
    label: "Hourly",
    Icon: BarChart2,
    accent: "violet",
    accentHex: "#7c3aed",
  },
  {
    key: "quality",
    label: "Quality",
    Icon: CheckCircle,
    accent: "green",
    accentHex: "#15803d",
  },
  {
    key: "loss",
    label: "Loss",
    Icon: AlertTriangle,
    accent: "amber",
    accentHex: "#b45309",
  },
];

const GAUGE_COLORS = [
  "#dc2626",
  "#e53e3e",
  "#ea580c",
  "#f97316",
  "#fb923c",
  "#f59e0b",
  "#eab308",
  "#bef264",
  "#86efac",
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#15803d",
  "#166534",
];

/* ── Helpers ── */
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const buildParams = (cfg, shiftDate, shift) => ({
  shiftDate,
  shift,
  stationCode1: cfg?.stationCode1 || "1220010",
  stationCode2: cfg?.stationCode2 || "1220005",
  lineCode: cfg?.lineCode || "12501",
  sectionName: cfg?.sectionName || "FINAL ASSEMBLY",
  lineTaktTime1: cfg?.lineTaktTime1 || "40",
  lineTaktTime2: cfg?.lineTaktTime2 || "40",
});

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ════════════════════════════════════════════
   CANVAS: Gauge
════════════════════════════════════════════ */
const GaugeCanvas = ({ value = 0, label = "", sublabel = "" }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width,
      H = c.height;
    const cx = W / 2,
      cy = H - 16;
    const R = Math.min(cx - 12, cy - 8);
    ctx.clearRect(0, 0, W, H);

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
    ctx.arc(cx, cy, R - 2, Math.PI, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, R - 22, 0, Math.PI * 2);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI + (i / 10) * Math.PI;
      const sin = Math.sin(angle),
        cos = Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(cx + cos * (R - 22), cy + sin * (R - 22));
      ctx.lineTo(cx + cos * (R - 5), cy + sin * (R - 5));
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 9px 'Courier New', monospace";
        ctx.fillText(String(i * 100), cx + cos * (R - 34), cy + sin * (R - 34));
      }
    }

    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(label, cx, cy - 48);
    ctx.font = "9px system-ui";
    ctx.fillStyle = "#64748b";
    ctx.fillText(sublabel, cx, cy - 32);

    const clamped = Math.min(Math.max(value, 0), 1000);
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

    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#475569";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#f1f5f9";
    ctx.fill();
  }, [value, label, sublabel]);

  return (
    <canvas ref={ref} width={280} height={160} className="block max-w-full" />
  );
};

/* ════════════════════════════════════════════
   CANVAS: Donut
════════════════════════════════════════════ */
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
    const cx = c.width / 2,
      cy = c.height / 2;
    const r = Math.min(cx, cy) - 12;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 12;
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
      ctx.lineWidth = 12;
      ctx.strokeStyle = fillColor;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }, [pct, fillColor, trackColor]);
  return <canvas ref={ref} width={size} height={size} />;
};

/* ════════════════════════════════════════════
   Live Clock
════════════════════════════════════════════ */
const LiveClock = ({ shift, shiftDate, accentHex }) => {
  const [tick, setTick] = useState(new Date());
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

/* ════════════════════════════════════════════
   Page Header
════════════════════════════════════════════ */
const PageHeader = ({ title, shift, shiftDate, accentHex }) => (
  <div className="shrink-0">
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ background: accentHex }}
    >
      <div className="w-9 h-9 rounded-full bg-white/25 border-2 border-white/50 flex items-center justify-center">
        <span className="text-white font-black text-base">W</span>
      </div>
      <span className="flex-1 text-center font-extrabold text-[15px] text-white tracking-widest uppercase font-mono">
        {title}
      </span>
    </div>
    <LiveClock shift={shift} shiftDate={shiftDate} accentHex={accentHex} />
  </div>
);

/* ════════════════════════════════════════════
   Timer Bar
════════════════════════════════════════════ */
const TimerBar = ({ progress, accentHex }) => (
  <div className="h-[3px] bg-slate-100 shrink-0">
    <div
      className="h-full"
      style={{ width: `${progress}%`, background: accentHex }}
    />
  </div>
);

/* ════════════════════════════════════════════
   Stat Card
════════════════════════════════════════════ */
const StatCard = ({ label, value, accentHex = "#1e40af" }) => (
  <div
    className="bg-white rounded-lg px-3 py-2.5 text-center border border-slate-100"
    style={{ borderTopWidth: 3, borderTopColor: accentHex }}
  >
    <div className="text-[10px] text-slate-400 leading-tight mb-1">{label}</div>
    <div className="text-lg font-extrabold" style={{ color: accentHex }}>
      {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
    </div>
  </div>
);

/* ════════════════════════════════════════════
   Metric Table
════════════════════════════════════════════ */
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
        return (
          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
            <td className="px-2.5 py-1.5 border border-slate-100 text-slate-700 font-semibold">
              {r.label}
            </td>
            <td className="px-2.5 py-1.5 border border-slate-100 text-slate-400 text-center text-[11px]">
              {r.unit}
            </td>
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
          </tr>
        );
      })}
    </tbody>
  </table>
);

/* ════════════════════════════════════════════
   Gauge Panel
════════════════════════════════════════════ */
const GaugePanel = ({ value, label, sublabel, accentHex }) => (
  <div className="w-[280px] shrink-0 flex flex-col items-center justify-center bg-white border-r border-slate-100 px-3 py-4">
    <GaugeCanvas value={value} label={label} sublabel={sublabel} />
    <div
      className="mt-3 px-7 py-1.5 rounded-lg text-white font-extrabold text-2xl font-mono tracking-widest"
      style={{ background: accentHex, boxShadow: `0 4px 14px ${accentHex}44` }}
    >
      {String(value ?? 0).padStart(3, "0")}.00
    </div>
  </div>
);

/* ════════════════════════════════════════════
   Sidebar Panel (Donut + info rows)
════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════
   Nav Dots
════════════════════════════════════════════ */
const NavDots = ({ currentPage, onGoTo, onPrev, onNext }) => (
  <div className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 bg-white border-t border-slate-100 relative">
    <button
      onClick={onPrev}
      className="absolute left-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
    </button>
    {PAGES_META.map(({ label, Icon, accentHex }, i) => {
      const active = i === currentPage;
      return (
        <button
          key={i}
          onClick={() => onGoTo(i)}
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
    >
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

/* ════════════════════════════════════════════
   PAGE 1 — FG PACKING
════════════════════════════════════════════ */
const Page1 = ({ apiData = {}, progress, shift, shiftDate, config }) => {
  const d = apiData;
  const label = config?.stationName1 || "FG PACKING";
  const { accentHex } = PAGES_META[0];

  const rows = [
    {
      label: "Working Time",
      unit: "Min",
      target: 570,
      actual: d.WorkingTimeMin,
    },
    {
      label: "Takt Time",
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
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader
        title="Final Area Production Performance"
        shift={shift}
        shiftDate={shiftDate}
        accentHex={accentHex}
      />
      <TimerBar progress={progress} accentHex={accentHex} />
      <div className="flex flex-1 min-h-0">
        <GaugePanel
          value={d.GaugeValue ?? 0}
          label={label}
          sublabel="Units / Shift"
          accentHex={accentHex}
        />
        <div className="flex-1 flex flex-col p-3 min-w-0 gap-2">
          <div
            className="text-white font-bold text-[13px] text-center py-1.5 rounded-t-lg"
            style={{ background: accentHex }}
          >
            {label}
          </div>
          <MetricTable rows={rows} accentHex={accentHex} />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 px-3 py-2.5 bg-white border-t border-slate-100 shrink-0">
        <StatCard
          label="Monthly Plan"
          value={d.MonthlyPlanQty}
          accentHex="#1e40af"
        />
        <StatCard
          label="Monthly Achievement"
          value={d.MonthlyAchieved}
          accentHex="#15803d"
        />
        <StatCard
          label="Remaining Qty"
          value={d.MonthlyRemaining}
          accentHex="#b45309"
        />
        <StatCard
          label="Asking Rate"
          value={d.AskingRate}
          accentHex="#0f766e"
        />
        <StatCard
          label="Remaining Days"
          value={d.RemainingDays}
          accentHex="#64748b"
        />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   PAGE 2 — FG LOADING
════════════════════════════════════════════ */
const Page2 = ({ apiData = {}, progress, shift, shiftDate, config }) => {
  const d = apiData;
  const label = config?.stationName2 || "FG LOADING";
  const { accentHex } = PAGES_META[1];

  const rows = [
    {
      label: "Working Time",
      unit: "Min",
      target: 570,
      actual: d.WorkingTimeMin,
    },
    {
      label: "Takt Time",
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
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader
        title="Final Area Production Performance"
        shift={shift}
        shiftDate={shiftDate}
        accentHex={accentHex}
      />
      <TimerBar progress={progress} accentHex={accentHex} />
      <div className="flex flex-1 min-h-0">
        <GaugePanel
          value={d.GaugeValue ?? 0}
          label={label}
          sublabel="Units / Shift"
          accentHex={accentHex}
        />
        <div className="flex-1 flex flex-col p-3 min-w-0 gap-2">
          <div
            className="text-white font-bold text-[13px] text-center py-1.5 rounded-t-lg"
            style={{ background: accentHex }}
          >
            {label}
          </div>
          <MetricTable rows={rows} accentHex={accentHex} />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 px-3 py-2.5 bg-white border-t border-slate-100 shrink-0">
        <StatCard
          label="Monthly Plan"
          value={d.MonthlyPlanQty}
          accentHex={accentHex}
        />
        <StatCard
          label="Monthly Achievement"
          value={d.MonthlyAchieved}
          accentHex="#15803d"
        />
        <StatCard
          label="Remaining Qty"
          value={d.MonthlyRemaining}
          accentHex="#b45309"
        />
        <StatCard
          label="Asking Rate"
          value={d.AskingRate}
          accentHex="#0f766e"
        />
        <StatCard
          label="Remaining Days"
          value={d.RemainingDays}
          accentHex="#64748b"
        />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   PAGE 3 — HOURLY
════════════════════════════════════════════ */
const Page3 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { hours = [], summary = {} } = apiData;
  const { accentHex } = PAGES_META[2];

  const chartData = useMemo(
    () => ({
      labels: hours.map((h) => `H${h.HourNo}`),
      datasets: [
        {
          type: "bar",
          label: "Target",
          data: hours.map((h) => h.Target),
          backgroundColor: "rgba(30,64,175,0.7)",
          borderColor: "#1e40af",
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "Actual",
          data: hours.map((h) => h.Actual),
          backgroundColor: "rgba(245,158,11,0.85)",
          borderColor: "#d97706",
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Loss",
          data: hours.map((h) => h.HourLoss),
          borderColor: "#ef4444",
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
          backgroundColor: "#1e293b",
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8", font: { size: 9 }, maxRotation: 0 },
        },
        y: {
          position: "left",
          beginAtZero: true,
          ticks: { color: "#94a3b8", font: { size: 9 } },
          grid: { color: "#f1f5f9" },
        },
        y2: {
          position: "right",
          beginAtZero: true,
          ticks: { color: "#ef4444", font: { size: 9 } },
          grid: { display: false },
        },
      },
    }),
    [],
  );

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader
        title="Hourly Production Performance"
        shift={shift}
        shiftDate={shiftDate}
        accentHex={accentHex}
      />
      <TimerBar progress={progress} accentHex={accentHex} />
      <div className="flex flex-1 min-h-0">
        <SidebarPanel
          pct={summary.ConsumedTimePct}
          fillColor="#8b5cf6"
          infoRows={[
            ["Plan", summary.ShiftPlan],
            ["Achieved", summary.TotalAchieved],
            ["Remaining", summary.Remaining],
          ]}
        />
        <div className="flex-1 flex flex-col px-3 py-2.5 gap-2 min-w-0">
          {/* Hourly table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-[11px]">
              <thead>
                <tr>
                  <th
                    className="px-2.5 py-1.5 text-white font-bold border border-white/20 text-left"
                    style={{ background: accentHex }}
                  >
                    Metric
                  </th>
                  {hours.map((h, i) => (
                    <th
                      key={i}
                      className="px-2 py-1.5 text-white font-bold border border-white/20 text-center min-w-[52px]"
                      style={{ background: accentHex }}
                    >
                      H{h.HourNo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Target",
                    vals: hours.map((h) => h.Target),
                    color: "#1e40af",
                  },
                  {
                    label: "Actual",
                    vals: hours.map((h) => h.Actual),
                    color: "#0f172a",
                  },
                  {
                    label: "Cumul. Loss",
                    vals: hours.map((h) => h.CumulativeLoss),
                    color: "#ef4444",
                  },
                  {
                    label: "Achiev. %",
                    isObj: true,
                    vals: hours.map((h) => {
                      const a = Number(h.AchievementPct || 0);
                      return {
                        v: `${a.toFixed(0)}%`,
                        c: a >= 85 ? "#15803d" : "#d97706",
                      };
                    }),
                  },
                ].map((row, ri) => (
                  <tr
                    key={ri}
                    className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                  >
                    <td className="px-2.5 py-1 border border-slate-100 text-slate-700 font-semibold">
                      {row.label}
                    </td>
                    {hours.map((_, ci) => {
                      const item = row.isObj
                        ? row.vals[ci]
                        : { v: row.vals[ci], c: row.color };
                      return (
                        <td
                          key={ci}
                          className="px-2 py-1 border border-slate-100 text-center font-bold"
                          style={{ color: item.c }}
                        >
                          {item.v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart */}
          <div className="flex-1 bg-white border border-slate-100 rounded-lg px-2 pt-2 pb-1 min-h-[120px] flex flex-col">
            <div className="flex gap-3.5 justify-center mb-1.5 text-[11px]">
              {[
                ["#1e40af", "Target"],
                ["#d97706", "Actual"],
                ["#ef4444", "Loss"],
              ].map(([cl, l]) => (
                <span
                  key={l}
                  className="flex items-center gap-1 text-slate-500"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: cl }}
                  />
                  {l}
                </span>
              ))}
            </div>
            <div className="flex-1 relative min-h-0">
              <Chart
                key={`hrly-${hours.length}`}
                type="bar"
                data={chartData}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   PAGE 4 — QUALITY
════════════════════════════════════════════ */
const Page4 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { summary: qs = {}, defects = [] } = apiData;
  const { accentHex } = PAGES_META[3];

  const pieData = useMemo(
    () => ({
      labels: ["OK Units", "Defect Units"],
      datasets: [
        {
          type: "doughnut",
          data: [qs.OkUnit || 0, qs.DefectUnit || 0],
          backgroundColor: ["rgba(21,128,61,0.85)", "rgba(220,38,38,0.85)"],
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
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader
        title="Quality Performance"
        shift={shift}
        shiftDate={shiftDate}
        accentHex={accentHex}
      />
      <TimerBar progress={progress} accentHex={accentHex} />
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-[190px] shrink-0 flex flex-col gap-2.5 px-3 py-3.5 bg-slate-50 border-r border-slate-100 justify-center">
          <div className="relative flex justify-center">
            <DonutCanvas
              pct={qs.ConsumedTimePct}
              size={130}
              fillColor="#22c55e"
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-xl font-extrabold text-slate-900">
                {Number(qs.ConsumedTimePct || 0).toFixed(0)}%
              </div>
              <div className="text-[9px] text-slate-400">Time</div>
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
            {[
              ["Plan", qs.Plan],
              ["Achieved", qs.TotalAchieved],
              ["OK Unit", qs.OkUnit],
              ["Defect", qs.DefectUnit],
              ["Rework", qs.ReworkDone],
              ["OK %", qs.OkPct != null ? `${qs.OkPct}%` : null],
              ["Defect %", qs.DefectPct != null ? `${qs.DefectPct}%` : null],
            ].map(([k, v], i) => (
              <div
                key={i}
                className={`flex justify-between px-2.5 py-1 text-[11px] text-slate-400 border-b border-slate-50 ${
                  i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                }`}
              >
                <span>{k}</span>
                <strong className="text-slate-900">{v ?? "—"}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-around px-5 py-3 gap-5 min-w-0">
          {/* Doughnut */}
          <div className="flex flex-col items-center gap-2.5">
            <p className="text-[13px] text-slate-900 font-bold">
              Quality Overview
            </p>
            <div className="relative">
              <Chart
                key={`q-${qs.OkUnit}-${qs.DefectUnit}`}
                type="doughnut"
                data={pieData}
                options={pieOptions}
                width={200}
                height={200}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="text-[26px] font-extrabold text-slate-900">
                  {qs.TotalAchieved ?? 0}
                </div>
                <div className="text-[10px] text-slate-400">Total</div>
              </div>
            </div>
            <div className="flex gap-3.5 text-[11px]">
              <span className="flex items-center gap-1 text-green-700">
                <span className="w-2.5 h-2.5 bg-green-700 rounded-sm inline-block" />
                OK: {qs.OkUnit ?? 0}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-sm inline-block" />
                Defect: {qs.DefectUnit ?? 0}
              </span>
            </div>
          </div>

          {/* Defects table */}
          <div className="flex-1 min-w-0">
            <div
              className="text-white font-bold text-[13px] text-center py-2 rounded-t-lg"
              style={{ background: accentHex }}
            >
              Top Defects Today
            </div>
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h) => (
                    <th
                      key={h}
                      className="bg-emerald-100 px-2.5 py-1.5 border border-slate-100 text-left font-bold"
                      style={{ color: accentHex }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defects.length > 0 ? (
                  defects.map((df, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                    >
                      <td className="px-2.5 py-1.5 border border-slate-100 text-center text-slate-400">
                        {df.SrNo}
                      </td>
                      <td className="px-2.5 py-1.5 border border-slate-100 text-slate-700">
                        {df.DefectName}
                      </td>
                      <td className="px-2.5 py-1.5 border border-slate-100 text-center font-extrabold text-red-500">
                        {df.DefectCount}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-6 text-center text-slate-400 border border-slate-100"
                    >
                      No defects recorded this shift
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

/* ════════════════════════════════════════════
   PAGE 5 — LOSS
════════════════════════════════════════════ */
const Page5 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;
  const { accentHex } = PAGES_META[4];
  const maxTime = useMemo(
    () => Math.max(...stations.map((s) => s.TotalStopTime ?? 0), 1),
    [stations],
  );

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      <PageHeader
        title="Loss Performance"
        shift={shift}
        shiftDate={shiftDate}
        accentHex={accentHex}
      />
      <TimerBar progress={progress} accentHex={accentHex} />
      <div className="flex flex-1 min-h-0">
        <SidebarPanel
          pct={ls.ConsumedTimePct}
          fillColor="#f59e0b"
          infoRows={[
            ["Plan", ls.Plan],
            ["Achieved", ls.Achieved],
            ["Balance", ls.Remaining],
          ]}
        />
        <div className="flex-1 p-3 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {[
                  "Station Name",
                  "Stop Time (HH:MM:SS)",
                  "Stop Time (Min)",
                  "Stop Count",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2 text-white font-bold border border-white/20 ${
                      i === 0 ? "text-left" : "text-center"
                    }`}
                    style={{ background: accentHex }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map((s, i) => {
                const isCritical = s.TotalStopTime > 100;
                const isHigh = s.TotalStopTime > 20;
                const intensity = s.TotalStopTime / maxTime;
                const rowBg = isCritical
                  ? `rgba(239,68,68,${0.08 + intensity * 0.12})`
                  : isHigh
                    ? "#fef3c7"
                    : i % 2 === 0
                      ? "#fff"
                      : "#f8fafc";
                const textCol = isCritical
                  ? "#ef4444"
                  : isHigh
                    ? "#b45309"
                    : "#334155";

                return (
                  <tr key={i} style={{ background: rowBg }}>
                    <td className="px-3 py-2 border border-slate-100 text-slate-700 font-semibold">
                      {s.StationName}
                    </td>
                    <td
                      className="px-3 py-2 border border-slate-100 text-center font-bold"
                      style={{ color: textCol }}
                    >
                      {s.TotalStopTimeHMS ?? "—"}
                    </td>
                    <td
                      className="px-3 py-2 border border-slate-100 text-center font-bold"
                      style={{ color: textCol }}
                    >
                      {s.TotalStopTime}
                    </td>
                    <td
                      className={`px-3 py-2 border border-slate-100 text-center font-bold ${
                        s.TotalStopCount > 10
                          ? "text-red-500"
                          : "text-slate-700"
                      }`}
                    >
                      {s.TotalStopCount}
                    </td>
                  </tr>
                );
              })}
              {stations.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-7 text-center text-slate-400 border border-slate-100"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <PackageOpen
                        className="w-10 h-10 opacity-20"
                        strokeWidth={1.2}
                      />
                      <p className="text-sm">
                        No loss data recorded this shift
                      </p>
                    </div>
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

/* ════════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════════════════════ */
const Monitoring = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const routerState = location.state || {};
  const launchedConfig = routerState.config || null;
  const launchedDate = routerState.shiftDate || todayISO();
  const launchedShift = routerState.shift || "A";
  const isLaunched = !!routerState.autoLoad;

  /* ── State ── */
  const [shiftDate, setShiftDate] = useState(launchedDate);
  const [shift, setShift] = useState(launchedShift);
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
  const [loading, setLoading] = useState(false);

  /* ── Auto-rotate ── */
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

  /* ── Fetch all endpoints ── */
  const fetchData = useCallback(async (dateParam, shiftParam, cfg) => {
    if (!dateParam) {
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

    const params = buildParams(cfg, dateParam, shiftParam);
    const endpoints = {
      fgPacking: `${baseURL}dashboard/fg-packing`,
      fgLoading: `${baseURL}dashboard/fg-loading`,
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
  }, []);

  /* ── Auto-load on launch ── */
  useEffect(() => {
    if (isLaunched) fetchData(launchedDate, launchedShift, launchedConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = useCallback(
    () => fetchData(shiftDate, shift, launchedConfig),
    [fetchData, shiftDate, shift, launchedConfig],
  );

  /* ── Navigation ── */
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

  const commonProps = { progress, shift, shiftDate, config: launchedConfig };
  const pages = [
    <Page1 key={0} apiData={allData.fgPacking} {...commonProps} />,
    <Page2 key={1} apiData={allData.fgLoading} {...commonProps} />,
    <Page3 key={2} apiData={allData.hourly} {...commonProps} />,
    <Page4 key={3} apiData={allData.quality} {...commonProps} />,
    <Page5 key={4} apiData={allData.loss} {...commonProps} />,
  ];

  /* ════════════════════════════════════════════
     LAUNCHED — Full-screen kiosk mode
  ════════════════════════════════════════════ */
  if (isLaunched) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-50 overflow-hidden font-sans">
        {/* Control bar */}
        <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
          {launchedConfig && (
            <span className="font-extrabold text-[13px] text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {launchedConfig.dashboardName}
            </span>
          )}
          <div className="w-px h-5 bg-slate-100" />

          {/* Shift toggle */}
          {["A", "B"].map((s) => (
            <button
              key={s}
              onClick={() => {
                const dt =
                  s === "B"
                    ? (() => {
                        const d = new Date();
                        if (d.getHours() < 8) d.setDate(d.getDate() - 1);
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                      })()
                    : todayISO();
                setShift(s);
                setShiftDate(dt);
                fetchData(dt, s, launchedConfig);
              }}
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
              onClick={() => navigate(-1)}
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
            <p className="text-sm text-slate-400">Fetching shift data…</p>
          </div>
        )}

        {/* Active dashboard */}
        {!loading && lastFetched && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              {pages[currentPage]}
            </div>
            <NavDots
              currentPage={currentPage}
              onGoTo={goTo}
              onPrev={goPrev}
              onNext={goNext}
            />
          </div>
        )}

        {/* Waiting */}
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

  /* ════════════════════════════════════════════
     STANDALONE — Not launched from config manager
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Sub-header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Production Monitoring
          </h1>
          <p className="text-[11px] text-slate-400">
            Dashboard · Shift performance overview
          </p>
        </div>
        {lastFetched && (
          <span className="text-[11px] text-slate-400">
            Updated {lastFetched.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* Filters card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Filters
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Shift Date */}
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

            {/* Shift toggle */}
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

            {/* Action buttons */}
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
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
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

        {/* Dashboard area — fills remaining height */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Loading state */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3.5">
              <Spinner cls="w-8 h-8 text-blue-600" />
              <p className="text-sm text-slate-400">Fetching shift data…</p>
            </div>
          )}

          {/* Active dashboard */}
          {!loading && lastFetched && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
                {pages[currentPage]}
              </div>
              <NavDots
                currentPage={currentPage}
                onGoTo={goTo}
                onPrev={goPrev}
                onNext={goNext}
              />
            </div>
          )}

          {/* Empty / waiting state */}
          {!loading && !lastFetched && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
              <div className="w-[72px] h-[72px] rounded-2xl bg-slate-100 flex items-center justify-center">
                <Settings
                  className="w-8 h-8 text-slate-300"
                  strokeWidth={1.2}
                />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-slate-500">
                  No data loaded
                </p>
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

export default Monitoring;
