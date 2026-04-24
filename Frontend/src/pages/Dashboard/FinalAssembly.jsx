import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FaSync,
  FaChartBar,
  FaCheckCircle,
  FaExclamationTriangle,
  FaStar,
  FaBolt,
  FaBox,
  FaTruck,
} from "react-icons/fa";
import { MdOutlineQueryStats, MdDashboard } from "react-icons/md";
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

// FIX: ArcElement + DoughnutController required for doughnut/pie charts
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

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_DURATION_MS = 8000;
const TOTAL_PAGES = 5;

const SHIFT_OPTIONS = [
  { value: "A", label: "Shift A — 08:00 to 20:00" },
  { value: "B", label: "Shift B — 20:00 to 08:00" },
];

const PAGES_META = [
  { key: "fgPacking", label: "FG Packing", icon: <FaBox /> },
  { key: "fgLoading", label: "FG Loading", icon: <FaTruck /> },
  { key: "hourly", label: "Hourly", icon: <FaChartBar /> },
  { key: "quality", label: "Quality", icon: <FaCheckCircle /> },
  { key: "loss", label: "Loss", icon: <FaExclamationTriangle /> },
];

const GAUGE_COLORS = [
  "#dc2626","#e53e3e","#ea580c","#f97316","#fb923c",
  "#f59e0b","#eab308","#d4d40a","#bef264","#86efac",
  "#4ade80","#22c55e","#16a34a","#15803d","#166534","#14532d",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ─── Canvas: Speedometer Gauge ─────────────────────────────────────────────────
const GaugeCanvas = ({ value = 0, label = "", sublabel = "" }) => {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height;
    const cx = W / 2, cy = H - 8;
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
      const sinA = Math.sin(angle), cosA = Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(cx + cosA * (R - 22), cy + sinA * (R - 22));
      ctx.lineTo(cx + cosA * (R - 5),  cy + sinA * (R - 5));
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "bold 8px monospace";
        ctx.fillText(String(i * 100), cx + cosA * (R - 34), cy + sinA * (R - 34));
      }
    }
    for (let i = 0; i <= 50; i++) {
      if (i % 5 === 0) continue;
      const angle = Math.PI + (i / 50) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (R - 9), cy + Math.sin(angle) * (R - 9));
      ctx.lineTo(cx + Math.cos(angle) * (R - 5), cy + Math.sin(angle) * (R - 5));
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

  return <canvas ref={ref} width={300} height={180} style={{ display: "block", maxWidth: "100%" }} />;
};

// ─── Canvas: Donut ─────────────────────────────────────────────────────────────
const DonutCanvas = ({ pct = 0, size = 150, fillColor = "#10b981", trackColor = "#374151" }) => {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const cx = c.width / 2, cy = c.height / 2;
    const r = Math.min(cx, cy) - 12;

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 15;
    ctx.strokeStyle = trackColor;
    ctx.stroke();

    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.min(pct, 100) / 100) * Math.PI * 2);
      ctx.lineWidth = 15;
      ctx.strokeStyle = fillColor;
      ctx.lineCap = "butt";
      ctx.stroke();
    }
  }, [pct, fillColor, trackColor]);

  return <canvas ref={ref} width={size} height={size} />;
};

// ─── Page Header ───────────────────────────────────────────────────────────────
const PageHeader = ({ title, shift, shiftDate, whiteStyle = false }) => {
  const [tick, setTick] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = `${pad(tick.getHours())}:${pad(tick.getMinutes())}:${pad(tick.getSeconds())}`;
  const shiftLabel = shift === "A" ? "08:00:00 To 20:00:00" : "20:00:00 To 08:00:00";

  return (
    <>
      <div style={{
        background: whiteStyle ? "#fff" : "#1f2937",
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 16px",
        borderBottom: whiteStyle ? "3px solid #1a5a9a" : "1px solid #374151",
        flexShrink: 0,
      }}>
        <LogoCircle />
        <div style={{
          flex: 1, textAlign: "center", fontWeight: 800,
          fontSize: whiteStyle ? 20 : 18,
          color: whiteStyle ? "#111827" : "#fff",
          letterSpacing: 1, textTransform: "uppercase",
        }}>{title}</div>
      </div>
      <div style={{
        background: whiteStyle ? "#e8f0f8" : "#111827",
        display: "flex", alignItems: "center",
        padding: "5px 16px",
        borderBottom: `1px solid ${whiteStyle ? "#c0d4e8" : "#1f2937"}`,
        fontSize: 12, flexShrink: 0, gap: 40,
      }}>
        <span style={{ color: "#6b7280" }}>Shift: <b style={{ color: whiteStyle ? "#111827" : "#fff" }}>{shift ? `SHIFT ${shift}` : "—"}</b></span>
        <span style={{ color: "#6b7280" }}>Date: <b style={{ color: whiteStyle ? "#111827" : "#fff" }}>{shiftDate || "—"}</b></span>
        <span style={{ color: "#6b7280" }}>Time: <b style={{ color: whiteStyle ? "#111827" : "#fff" }}>{timeStr}</b></span>
        <span style={{ color: "#6b7280", marginLeft: "auto" }}>Shift Duration: <b style={{ color: whiteStyle ? "#111827" : "#fff" }}>{shift ? shiftLabel : "—"}</b></span>
      </div>
    </>
  );
};

const LogoCircle = () => (
  <div style={{
    width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
    background: "radial-gradient(circle at 40% 35%, #fde68a, #d97706)",
    border: "2px solid #b45309",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <span style={{ color: "#fff", fontWeight: 900, fontSize: 20, lineHeight: 1 }}>W</span>
  </div>
);

const TimerBar = ({ progress }) => (
  <div style={{ height: 3, background: "#1f2937", flexShrink: 0 }}>
    <div style={{ height: "100%", width: `${progress}%`, background: "#10b981", transition: "none" }} />
  </div>
);

const StatCard = ({ label, value }) => (
  <div style={{
    background: "#374151", border: "1px solid #4b5563",
    borderRadius: 6, padding: "6px 8px", textAlign: "center",
  }}>
    <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 3 }}>
      {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
    </div>
  </div>
);

const METRIC_TH = {
  padding: "7px 10px", background: "#374151", color: "#d1d5db",
  fontSize: 11, fontWeight: 700, border: "1px solid #4b5563", textAlign: "center",
};

const MetricRow = ({ label, unit, target, actual, highlight, odd }) => (
  <tr style={{ background: odd ? "#172030" : "#1f2937" }}>
    <td style={{ padding: "6px 10px", border: "1px solid #374151", color: "#d1d5db", fontWeight: 600, fontSize: 12 }}>{label}</td>
    <td style={{ padding: "6px 10px", border: "1px solid #374151", color: "#6b7280", fontSize: 12, textAlign: "center" }}>{unit}</td>
    <td style={{ padding: "6px 10px", border: "1px solid #374151", color: "#fbbf24", fontWeight: 700, fontSize: 12, textAlign: "center" }}>{target ?? "—"}</td>
    <td style={{ padding: "6px 10px", border: "1px solid #374151", fontSize: 12, textAlign: "center", fontWeight: 700, color: highlight === "yellow" ? "#fde047" : "#f3f4f6" }}>{actual ?? "—"}</td>
  </tr>
);

const GaugePanel = ({ value, label, sublabel }) => (
  <div style={{
    width: 320, flexShrink: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: "#111827", borderRight: "1px solid #374151", padding: "12px 0",
  }}>
    <GaugeCanvas value={value} label={label} sublabel={sublabel} />
    <div style={{
      marginTop: 10, padding: "4px 24px",
      background: "#1f2937", border: "2px solid #4b5563", borderRadius: 4,
      color: "#fff", fontWeight: 700, fontSize: 20, fontFamily: "monospace", letterSpacing: 3,
    }}>
      {String(value ?? 0).padStart(3, "0")}.00
    </div>
  </div>
);

const DonutPanel = ({ pct = 0, fillColor = "#10b981", label = "CONSUMED TIME %" }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ width: 18, background: "#1e3a5f", flexShrink: 0, alignSelf: "stretch" }} />
      <div style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center" }}>
        <DonutCanvas pct={pct} size={140} fillColor={fillColor} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#fff", fontWeight: 700, fontSize: 20 }}>
          {Number(pct || 0).toFixed(0)}%
        </div>
      </div>
    </div>
  </div>
);

const InfoBox = ({ rows }) => (
  <div style={{ background: "#1e3a5f", border: "1px solid #2a5080", borderRadius: 6, padding: "8px 10px" }}>
    {rows.map(([k, v], i) => (
      <div key={i} style={{ fontSize: 11, color: "#93c5fd", lineHeight: 1.8 }}>
        {k}: <b style={{ color: "#fff" }}>{v != null ? v.toLocaleString?.() ?? v : "—"}</b>
      </div>
    ))}
  </div>
);

const LeftSidebar = ({ consumedPct = 0, fillColor = "#10b981", infoRows = [] }) => (
  <div style={{
    width: 210, flexShrink: 0,
    display: "flex", flexDirection: "column", gap: 12, padding: 12,
    background: "#1a2740", borderRight: "1px solid #374151", justifyContent: "center",
  }}>
    <DonutPanel pct={consumedPct} fillColor={fillColor} />
    <InfoBox rows={infoRows} />
  </div>
);

const NavDots = ({ currentPage, onGoTo }) => (
  <div style={{
    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    gap: 12, padding: "6px 0", background: "#030712", borderTop: "1px solid #1f2937",
  }}>
    {PAGES_META.map((pg, i) => (
      <button key={i} onClick={() => onGoTo(i)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <div style={{ width: i === currentPage ? 28 : 10, height: 10, borderRadius: 5, background: i === currentPage ? "#10b981" : "#374151", transition: "all 0.3s ease" }} />
        <span style={{ fontSize: 9, fontFamily: "monospace", color: i === currentPage ? "#d1d5db" : "#6b7280" }}>{pg.label}</span>
      </button>
    ))}
  </div>
);

// ─── Page 1 — FG Packing ───────────────────────────────────────────────────────
const Page1 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const d = apiData;
  const rows = [
    { label: "Working Time",       unit: "Min",   target: 570,                  actual: d.WorkingTimeMin },
    { label: "Line Tact Time",     unit: "Sec",   target: d.TactTimeSec ?? "—", actual: d.TactTimeSec ?? "—" },
    { label: "Shift Output Target",unit: "No's",  target: d.ShiftOutputTarget,  actual: d.ShiftOutputTarget },
    { label: "Packing Till Now",   unit: "No's",  target: d.ProratedTarget,     actual: d.PackingTillNow },
    { label: "Loss Units",         unit: "No's",  target: null,                 actual: d.LossUnits },
    { label: "Loss Time",          unit: "Min",   target: null,                 actual: d.LossTime },
    { label: "UPH Target",         unit: "No's",  target: d.UPHTarget,          actual: d.ActualUPH },
    { label: "Efficiency Till Now",unit: "%",     target: null,                 actual: d.EfficiencyTillNow, highlight: "yellow" },
    { label: "Performance",        unit: "%",     target: null,                 actual: d.PerformancePct },
    { label: "Balance Qty",        unit: "No's",  target: null,                 actual: d.BalanceQty },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#111827" }}>
      <PageHeader title="FINAL AREA PRODUCTION PERFORMANCE" shift={shift} shiftDate={shiftDate} />
      <TimerBar progress={progress} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <GaugePanel value={d.GaugeValue ?? 0} label="Cabinet Packing" sublabel="FG/Shift" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, minWidth: 0 }}>
          <div style={{ background: "#b8cfe8", color: "#111827", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "6px 0", marginBottom: 0 }}>
            FG PACKING
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...METRIC_TH, textAlign: "left", width: "45%" }}>Metric</th>
                <th style={{ ...METRIC_TH, width: "10%" }}>Unit</th>
                <th style={{ ...METRIC_TH, width: "22%" }}>Target</th>
                <th style={{ ...METRIC_TH, width: "23%" }}>Actual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <MetricRow key={i} {...r} odd={i % 2 !== 0} />)}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4,
        padding: "6px 8px", background: "#1f2937", borderTop: "1px solid #374151", flexShrink: 0,
      }}>
        <StatCard label="Monthly Plan Qty"    value={d.MonthlyPlanQty} />
        <StatCard label="Monthly Achievement" value={d.MonthlyAchieved} />
        <StatCard label="Remaining Qty"       value={d.MonthlyRemaining} />
        <StatCard label="Asking Rate"         value={d.AskingRate} />
        <StatCard label="Remaining Days"      value={d.RemainingDays} />
      </div>
    </div>
  );
};

// ─── Page 2 — FG Loading ───────────────────────────────────────────────────────
const Page2 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const d = apiData;
  const rows = [
    { label: "Working Time",        unit: "Min",  target: 570,               actual: d.WorkingTimeMin },
    { label: "Shift Output Target", unit: "No's", target: d.ShiftOutputTarget, actual: d.ShiftOutputTarget },
    { label: "Loading Till Now",    unit: "No's", target: d.ProratedTarget,  actual: d.LoadingTillNow },
    { label: "Loss Units",          unit: "No's", target: null,              actual: d.LossUnits },
    { label: "Loss Time",           unit: "Min",  target: null,              actual: d.LossTime },
    { label: "UPH Target",          unit: "No's", target: d.UPHTarget,       actual: d.ActualUPH },
    { label: "Efficiency Till Now", unit: "%",    target: null,              actual: d.EfficiencyTillNow, highlight: "yellow" },
    { label: "Performance",         unit: "%",    target: null,              actual: d.PerformancePct },
    { label: "Balance Qty",         unit: "No's", target: null,              actual: d.BalanceQty },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#111827" }}>
      <PageHeader title="FINAL AREA PRODUCTION PERFORMANCE" shift={shift} shiftDate={shiftDate} />
      <TimerBar progress={progress} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <GaugePanel value={d.GaugeValue ?? 0} label="FG Loading" sublabel="Units/Shift" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, minWidth: 0 }}>
          <div style={{ background: "#b8cfe8", color: "#111827", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "6px 0" }}>
            FG LOADING
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...METRIC_TH, textAlign: "left", width: "45%" }}>Metric</th>
                <th style={{ ...METRIC_TH, width: "10%" }}>Unit</th>
                <th style={{ ...METRIC_TH, width: "22%" }}>Target</th>
                <th style={{ ...METRIC_TH, width: "23%" }}>Actual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <MetricRow key={i} {...r} odd={i % 2 !== 0} />)}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4,
        padding: "6px 8px", background: "#1f2937", borderTop: "1px solid #374151", flexShrink: 0,
      }}>
        <StatCard label="Monthly Plan Qty"    value={d.MonthlyPlanQty} />
        <StatCard label="Monthly Achievement" value={d.MonthlyAchieved} />
        <StatCard label="Remaining Qty"       value={d.MonthlyRemaining} />
        <StatCard label="Asking Rate"         value={d.AskingRate} />
        <StatCard label="Remaining Days"      value={d.RemainingDays} />
      </div>
    </div>
  );
};

// ─── Page 3 — Hourly Production ────────────────────────────────────────────────
const Page3 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { hours = [], summary = {} } = apiData;

  const chartData = useMemo(() => ({
    labels: hours.map((h) => `H${h.HourNo}`),
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
  }), [hours]);

  // FIX: chart axis tick colors changed to dark values readable on white background
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: "#1e1b4b", titleColor: "#e0e7ff", bodyColor: "#c7d2fe", padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#374151", font: { size: 9 }, maxRotation: 0 } },
      y: { position: "left", beginAtZero: true, ticks: { color: "#374151", font: { size: 9 } }, grid: { color: "#e5e7eb" } },
      y2: { position: "right", beginAtZero: true, ticks: { color: "#374151", font: { size: 9 } }, grid: { display: false } },
    },
  }), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#111827" }}>
      <PageHeader title="FINAL AREA HOURLY PRODUCTION PERFORMANCE" shift={shift} shiftDate={shiftDate} />
      <TimerBar progress={progress} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <LeftSidebar
          consumedPct={summary.ConsumedTimePct}
          fillColor="#10b981"
          infoRows={[
            ["Plan",      summary.ShiftPlan],
            ["Achieved",  summary.TotalAchieved],
            ["Remaining", summary.Remaining],
          ]}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 10px", gap: 8, background: "#1e2d45", minWidth: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ background: "#1e3a5f", color: "#93c5fd", padding: "5px 8px", border: "1px solid #2a5a8a", textAlign: "left", whiteSpace: "nowrap" }}>Metric</th>
                  {hours.map((h, i) => (
                    <th key={i} style={{ background: "#1e3a5f", color: "#93c5fd", padding: "5px 6px", border: "1px solid #2a5a8a", textAlign: "center" }}>H{h.HourNo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ background: "#1a3050", color: "#cbd5e1", padding: "5px 8px", border: "1px solid #2a4a70", fontWeight: 600 }}>Target</td>
                  {hours.map((h, i) => (
                    <td key={i} style={{ background: "#1a3050", color: "#fbbf24", padding: "5px 6px", border: "1px solid #2a4a70", textAlign: "center" }}>{h.Target}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ background: "#162840", color: "#cbd5e1", padding: "5px 8px", border: "1px solid #2a4a70", fontWeight: 600 }}>Actual</td>
                  {hours.map((h, i) => (
                    <td key={i} style={{ background: "#162840", color: "#f1f5f9", padding: "5px 6px", border: "1px solid #2a4a70", textAlign: "center" }}>{h.Actual}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ background: "#1a3050", color: "#cbd5e1", padding: "5px 8px", border: "1px solid #2a4a70", fontWeight: 600 }}>Cumul. Loss</td>
                  {hours.map((h, i) => (
                    <td key={i} style={{ background: "#1a3050", color: "#f87171", padding: "5px 6px", border: "1px solid #2a4a70", textAlign: "center" }}>{h.CumulativeLoss}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ background: "#162840", color: "#cbd5e1", padding: "5px 8px", border: "1px solid #2a4a70", fontWeight: 600 }}>Achievement</td>
                  {hours.map((h, i) => {
                    const ach = Number(h.AchievementPct || 0);
                    return (
                      <td key={i} style={{ background: "#162840", padding: "5px 6px", border: "1px solid #2a4a70", textAlign: "center", fontWeight: 700, color: ach >= 85 ? "#4ade80" : "#facc15" }}>
                        {ach.toFixed(0)}%
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1, background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 8px 4px", minHeight: 140, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textAlign: "center", marginBottom: 4 }}>Hourly Report</div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 6, fontSize: 11, color: "#374151" }}>
              {[["#4472c4", "Target"], ["#ed7d31", "Actual"], ["#9ca3af", "Unit Loss"]].map(([c, l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: "inline-block" }} />{l}
                </span>
              ))}
            </div>
            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
              <Chart key={`hourly-bar-${hours.length}`} type="bar" data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Page 4 — Quality ──────────────────────────────────────────────────────────
const Page4 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { summary: qs = {}, defects = [] } = apiData;

  const pieChartData = useMemo(() => ({
    labels: ["OK Units", "Defect Units"],
    datasets: [{
      type: "doughnut",
      data: [qs.OkUnit || 0, qs.DefectUnit || 0],
      backgroundColor: ["rgba(22,163,74,0.85)", "rgba(220,38,38,0.85)"],
      borderColor: ["#15803d", "#b91c1c"],
      borderWidth: 2,
      hoverOffset: 0,
    }],
  }), [qs]);

  const pieOptions = useMemo(() => ({
    responsive: false,
    cutout: "68%",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } },
    },
    animation: { duration: 400 },
  }), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#111827" }}>
      <PageHeader title="FINAL AREA QUALITY PERFORMANCE" shift={shift} shiftDate={shiftDate} />
      <TimerBar progress={progress} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, padding: 12, background: "#1a2740", borderRight: "1px solid #374151", justifyContent: "center" }}>
          <DonutPanel pct={qs.ConsumedTimePct} fillColor="#10b981" />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginTop: 4 }}>
            {/* FIX: <tbody> required — <tr> cannot be a direct child of <table> */}
            <tbody>
              {[
                ["Plan",     qs.Plan],
                ["Achieved", qs.TotalAchieved],
                ["OK Unit",  qs.OkUnit],
                ["Defect",   qs.DefectUnit],
                ["Rework",   qs.ReworkDone],
                ["OK %",     qs.OkPct     != null ? `${qs.OkPct}%`     : null],
                ["Defect %", qs.DefectPct != null ? `${qs.DefectPct}%` : null],
              ].map(([k, v], i) => (
                <tr key={i}>
                  <td style={{ padding: "3px 6px", border: "1px solid #2a5a8a", background: "#1a3050", color: "#93c5fd" }}>{k}</td>
                  <td style={{ padding: "3px 6px", border: "1px solid #2a5a8a", background: "#1a3050", color: "#fff", textAlign: "right", fontWeight: 700 }}>{v ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "12px 20px", gap: 20, background: "#1e2d45", minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>Quality Overview</div>
            <div style={{ position: "relative" }}>
              <Chart
                key={`quality-donut-${qs.OkUnit}-${qs.DefectUnit}`}
                type="doughnut"
                data={pieChartData}
                options={pieOptions}
                width={220}
                height={220}
              />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{qs.TotalAchieved ?? 0}</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>Total</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#86efac" }}>
                <span style={{ width: 10, height: 10, background: "#16a34a", borderRadius: 2, display: "inline-block" }} />
                OK: {qs.OkUnit ?? 0}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#fca5a5" }}>
                <span style={{ width: 10, height: 10, background: "#dc2626", borderRadius: 2, display: "inline-block" }} />
                Defect: {qs.DefectUnit ?? 0}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: "#1e3a5f", color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "center", padding: 8, border: "1px solid #2a5a8a" }}>
              Today's Top Defects
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h) => (
                    <th key={h} style={{ background: "#1e3a5f", color: "#93c5fd", padding: "6px 10px", border: "1px solid #2a5a8a", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defects.length > 0 ? defects.map((df, i) => (
                  <tr key={i}>
                    <td style={{ background: "#1a3050", color: "#fff", padding: "7px 10px", border: "1px solid #2a5a8a", textAlign: "center" }}>{df.SrNo}</td>
                    <td style={{ background: "#1a3050", color: "#e2e8f0", padding: "7px 10px", border: "1px solid #2a5a8a" }}>{df.DefectName}</td>
                    <td style={{ background: "#1a3050", color: "#f87171", padding: "7px 10px", border: "1px solid #2a5a8a", textAlign: "center", fontWeight: 700 }}>{df.DefectCount}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} style={{ background: "#1a3050", color: "#9ca3af", padding: "20px", textAlign: "center", border: "1px solid #2a5a8a" }}>
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

// ─── Page 5 — Loss ─────────────────────────────────────────────────────────────
const Page5 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;
  const maxTime = useMemo(() => Math.max(...stations.map((s) => s.TotalStopTime ?? 0), 1), [stations]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#111827" }}>
      <PageHeader title="FINAL AREA LOSS PERFORMANCE" shift={shift} shiftDate={shiftDate} whiteStyle />
      <TimerBar progress={progress} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <LeftSidebar
          consumedPct={ls.ConsumedTimePct}
          fillColor="#f59e0b"
          infoRows={[
            // FIX: SQL alias [Plan] comes through as "Plan" in JSON — use ls.Plan
            ["Plan",     ls.Plan],
            ["Achieved", ls.Achieved],
            ["Balance",  ls.Remaining],
          ]}
        />
        <div style={{ flex: 1, padding: 12, overflow: "auto", background: "#1e2d45" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Station Name", "Stop Time (HH:MM:SS)", "Stop Time (Min)", "Stop Count"].map((h, i) => (
                  <th key={i} style={{ background: "#374151", color: "#d1d5db", padding: "8px 12px", border: "1px solid #4b5563", fontWeight: 700, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map((s, i) => {
                const intensity = s.TotalStopTime / maxTime;
                const rVal = Math.round(160 + intensity * 95);
                const rowBg = s.TotalStopTime > 100 ? `rgb(${rVal},18,18)` : s.TotalStopTime > 20 ? "#7f1d1d" : "#1f2937";
                return (
                  <tr key={i}>
                    <td style={{ padding: "7px 12px", border: "1px solid #4b5563", background: rowBg, color: "#f9fafb", fontWeight: 600 }}>{s.StationName}</td>
                    <td style={{ padding: "7px 12px", border: "1px solid #4b5563", background: rowBg, color: s.TotalStopTime > 50 ? "#fca5a5" : "#d1d5db", textAlign: "center", fontWeight: 700 }}>
                      {s.TotalStopTimeHMS ?? "—"}
                    </td>
                    <td style={{ padding: "7px 12px", border: "1px solid #4b5563", background: rowBg, color: s.TotalStopTime > 50 ? "#fca5a5" : "#d1d5db", textAlign: "center", fontWeight: 700 }}>
                      {s.TotalStopTime}
                    </td>
                    <td style={{ padding: "7px 12px", border: "1px solid #4b5563", background: rowBg, color: s.TotalStopCount > 10 ? "#fca5a5" : "#d1d5db", textAlign: "center", fontWeight: 700 }}>
                      {s.TotalStopCount}
                    </td>
                  </tr>
                );
              })}
              {stations.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#6b7280", background: "#1f2937", border: "1px solid #374151" }}>
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

// ─── Main Component ─────────────────────────────────────────────────────────────
const FinalAssembly = () => {
  const [loading, setLoading]         = useState(false);
  const [shiftDate, setShiftDate]     = useState(todayISO());
  const [shift, setShift]             = useState("A");
  const [allData, setAllData]         = useState({ fgPacking: {}, fgLoading: {}, hourly: {}, quality: {}, loss: {} });
  const [currentPage, setCurrentPage] = useState(0);
  const [progress, setProgress]       = useState(0);
  const [lastFetched, setLastFetched] = useState(null);
  const [isRunning, setIsRunning]     = useState(false);

  // ── Auto-rotate
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

  // ── Core fetch function — accepts explicit params to avoid stale closure
  const fetchData = useCallback(async (dateParam, shiftParam) => {
    if (!dateParam) { toast.error("Please select a shift date."); return; }
    setLoading(true);
    setIsRunning(false);
    setAllData({ fgPacking: {}, fgLoading: {}, hourly: {}, quality: {}, loss: {} });

    const params = { shiftDate: dateParam, shift: shiftParam };
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
          axios.get(url, { params }).then((res) => ({ key, data: res.data?.data ?? res.data })),
        ),
      );

      const merged = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") merged[r.value.key] = r.value.data;
        else console.error("Endpoint failed:", r.reason?.message);
      });

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount === TOTAL_PAGES) {
        toast.error("All endpoints failed. Check server connection.");
      } else {
        if (failedCount > 0) toast(`${failedCount} endpoint(s) returned errors.`, { icon: "⚠️" });
        else toast.success("Dashboard data loaded successfully.");
        setAllData((prev) => ({ ...prev, ...merged }));
        setLastFetched(new Date());
        setCurrentPage(0);
        setIsRunning(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── "Load Dashboard" button uses current state values
  const fetchAllData = useCallback(() => {
    fetchData(shiftDate, shift);
  }, [fetchData, shiftDate, shift]);

  // FIX: set state AND call fetchData with explicit values in the same step
  // so we don't rely on React state having updated before the fetch fires
  const handleTodayShiftA = useCallback(() => {
    const date = todayISO();
    setShiftDate(date);
    setShift("A");
    fetchData(date, "A");
  }, [fetchData]);

  // FIX: Shift B logic — if current hour < 8, the shift started yesterday evening
  const handleTodayShiftB = useCallback(() => {
    const d = new Date();
    // Before 8 AM the active Shift B started the previous evening
    if (d.getHours() < 8) {
      d.setDate(d.getDate() - 1);
    }
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setShiftDate(date);
    setShift("B");
    fetchData(date, "B");
  }, [fetchData]);

  const goTo = useCallback((i) => { setCurrentPage(i); setProgress(0); }, []);

  const commonProps = { progress, shift, shiftDate };
  const pages = [
    <Page1 key={0} apiData={allData.fgPacking} {...commonProps} />,
    <Page2 key={1} apiData={allData.fgLoading}  {...commonProps} />,
    <Page3 key={2} apiData={allData.hourly}      {...commonProps} />,
    <Page4 key={3} apiData={allData.quality}     {...commonProps} />,
    <Page5 key={4} apiData={allData.loss}        {...commonProps} />,
  ];

  return (
    <div style={{ padding: 20, background: "#f1f5f9", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #111827 0%, #1f2937 60%, #374151 100%)", borderRadius: 14, padding: "20px 28px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 10, fontSize: 24, color: "#fff" }}><MdDashboard /></div>
          <div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Final Area Production Dashboard</h1>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>Live Shift Performance · FG Packing & Loading · Quality · Loss</p>
          </div>
        </div>
        {lastFetched && (
          <div style={{ color: "#9ca3af", fontSize: 11, textAlign: "right" }}>
            <div>Last refreshed</div>
            <div style={{ fontWeight: 600, color: "#d1d5db" }}>{lastFetched.toLocaleTimeString()}</div>
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Shift Date</div>
            <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Shift</div>
            <div style={{ display: "flex", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              {SHIFT_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setShift(opt.value)} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: shift === opt.value ? "#374151" : "transparent", color: shift === opt.value ? "#fff" : "#6b7280", border: "none", borderRight: "1px solid #e5e7eb", transition: "all 0.15s" }}>
                  {opt.value === "A" ? "Shift A" : "Shift B"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={fetchAllData} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 22px", background: loading ? "#9ca3af" : "#111827", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 8px rgba(0,0,0,0.3)" }}>
              {loading ? <FaSync style={{ animation: "spin 1s linear infinite" }} /> : <MdOutlineQueryStats />}
              {loading ? "Loading…" : "Load Dashboard"}
            </button>
            <button onClick={handleTodayShiftA} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: loading ? "not-allowed" : "pointer" }}>
              <FaStar size={10} /> TODAY A
            </button>
            <button onClick={handleTodayShiftB} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: loading ? "not-allowed" : "pointer" }}>
              <FaBolt size={10} /> TODAY B
            </button>
            {isRunning && (
              <button onClick={() => setIsRunning(false)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                ⏸ Pause
              </button>
            )}
            {!isRunning && lastFetched && (
              <button onClick={() => setIsRunning(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                ▶ Resume
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 48, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <div style={{ color: "#6b7280", marginTop: 10, fontSize: 13 }}>Fetching shift data from all endpoints…</div>
        </div>
      )}

      {/* Dashboard */}
      {!loading && lastFetched && (
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #374151", boxShadow: "0 4px 24px rgba(0,0,0,0.4)", height: "72vh", minHeight: 520, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{pages[currentPage]}</div>
          <NavDots currentPage={currentPage} onGoTo={goTo} />
        </div>
      )}

      {/* Empty state */}
      {!loading && !lastFetched && (
        <div style={{ textAlign: "center", padding: "56px 0", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🏭</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>No data loaded yet</div>
          <div style={{ fontSize: 12, marginTop: 6, color: "#9ca3af" }}>Select a shift date and click Load Dashboard</div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default FinalAssembly;