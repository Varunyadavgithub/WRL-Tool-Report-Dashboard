import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiRefreshCw,
  FiPlay,
  FiPause,
  FiX,
  FiClock,
  FiCalendar,
  FiAlertTriangle,
  FiCheckCircle,
  FiPackage,
  FiTruck,
  FiBarChart2,
  FiActivity,
  FiSettings,
  FiTrendingUp,
  FiArrowLeft,
  FiArrowRight,
} from "react-icons/fi";
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

const PAGE_DURATION_MS = 30000;
const TOTAL_PAGES = 5;

const PAGES_META = [
  {
    key: "fgPacking",
    label: "FG Packing",
    Icon: FiPackage,
    accent: "#1e40af",
    light: "#dbeafe",
  },
  {
    key: "fgLoading",
    label: "FG Loading",
    Icon: FiTruck,
    accent: "#0f766e",
    light: "#ccfbf1",
  },
  {
    key: "hourly",
    label: "Hourly",
    Icon: FiBarChart2,
    accent: "#7c3aed",
    light: "#ede9fe",
  },
  {
    key: "quality",
    label: "Quality",
    Icon: FiCheckCircle,
    accent: "#15803d",
    light: "#dcfce7",
  },
  {
    key: "loss",
    label: "Loss",
    Icon: FiAlertTriangle,
    accent: "#b45309",
    light: "#fef3c7",
  },
];

const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ─── Build query params from saved config ─────────────────────────────────────
// Maps form/config keys → the exact query param names the controller expects:
//
//  getFGPackingData    : stationCode1, lineCode, sectionName, lineTaktTime1
//  getFGLoadingData    : stationCode1, stationCode2, sectionName, lineTaktTime2
//  getHourlyProduction : stationCode1, lineCode
//  getQualityData      : stationCode1
//  getLossData         : stationCode1, sectionName
//
// All endpoints also require: shiftDate, shift (added per-call below)
const buildParams = (cfg, shiftDate, shift) => ({
  shiftDate,
  shift,
  stationCode1: cfg?.stationCode1 || "1220010",
  stationCode2: cfg?.stationCode2 || "1220005",
  lineCode: cfg?.lineCode || "12501",
  sectionName: cfg?.sectionName || "FINAL ASSEMBLY",
  lineTaktTime1: cfg?.lineTaktTime1 || "40",
  lineTaktTime2: cfg?.lineTaktTime2 || "40",
  // stationName1/2 are display-only on the frontend; not sent to API
});

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

// ─── Gauge Canvas ─────────────────────────────────────────────────────────────
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
    <canvas
      ref={ref}
      width={280}
      height={160}
      style={{ display: "block", maxWidth: "100%" }}
    />
  );
};

// ─── Donut Canvas ─────────────────────────────────────────────────────────────
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

// ─── Live Clock ───────────────────────────────────────────────────────────────
const LiveClock = ({ shift, shiftDate, accent }) => {
  const [tick, setTick] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeStr = `${pad(tick.getHours())}:${pad(tick.getMinutes())}:${pad(tick.getSeconds())}`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "6px 16px",
        background: "#f8fafc",
        borderBottom: "1px solid #f1f5f9",
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: "#64748b",
        }}
      >
        <FiActivity size={11} color={accent} />
        Shift{" "}
        <strong style={{ color: "#0f172a", marginLeft: 2 }}>
          {shift ? `SHIFT ${shift}` : "—"}
        </strong>
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: "#64748b",
        }}
      >
        <FiCalendar size={11} color={accent} />
        <strong style={{ color: "#0f172a" }}>{shiftDate || "—"}</strong>
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: "#64748b",
        }}
      >
        <FiClock size={11} color={accent} />
        <strong style={{ color: "#0f172a", fontFamily: "monospace" }}>
          {timeStr}
        </strong>
      </span>
      <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 11 }}>
        {shift ? (shift === "A" ? "08:00 – 20:00" : "20:00 – 08:00") : "—"}
      </span>
    </div>
  );
};

// ─── Page Header ──────────────────────────────────────────────────────────────
const PageHeader = ({ title, shift, shiftDate, accent }) => (
  <div style={{ flexShrink: 0 }}>
    <div
      style={{
        background: accent,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 16px",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.25)",
          border: "2px solid rgba(255,255,255,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>W</span>
      </div>
      <span
        style={{
          flex: 1,
          textAlign: "center",
          fontWeight: 800,
          fontSize: 15,
          color: "#fff",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          fontFamily: "'Courier New', monospace",
        }}
      >
        {title}
      </span>
    </div>
    <LiveClock shift={shift} shiftDate={shiftDate} accent={accent} />
  </div>
);

// ─── Timer Bar ────────────────────────────────────────────────────────────────
const TimerBar = ({ progress, accent }) => (
  <div style={{ height: 3, background: "#f1f5f9", flexShrink: 0 }}>
    <div
      style={{
        height: "100%",
        width: `${progress}%`,
        background: accent,
        transition: "none",
      }}
    />
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, accent = "#1e40af" }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 10,
      padding: "10px 12px",
      textAlign: "center",
      borderTop: `3px solid ${accent}`,
      border: "1px solid #f1f5f9",
    }}
  >
    <div
      style={{
        fontSize: 10,
        color: "#94a3b8",
        lineHeight: 1.4,
        marginBottom: 3,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 800, color: accent }}>
      {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
    </div>
  </div>
);

// ─── Metric Table ─────────────────────────────────────────────────────────────
const MetricTable = ({ rows, accent }) => (
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
            style={{
              padding: "8px 10px",
              background: accent,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.2)",
              textAlign: align,
              width: w,
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
          <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
            <td
              style={{
                padding: "7px 10px",
                border: "1px solid #f1f5f9",
                color: "#334155",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {r.label}
            </td>
            <td
              style={{
                padding: "7px 10px",
                border: "1px solid #f1f5f9",
                color: "#94a3b8",
                fontSize: 11,
                textAlign: "center",
              }}
            >
              {r.unit}
            </td>
            <td
              style={{
                padding: "7px 10px",
                border: "1px solid #f1f5f9",
                color: accent,
                fontWeight: 700,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {r.target ?? "—"}
            </td>
            <td
              style={{
                padding: "7px 10px",
                border: "1px solid #f1f5f9",
                fontSize: 12,
                textAlign: "center",
                fontWeight: 800,
                color: actualColor,
              }}
            >
              {r.actual ?? "—"}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

// ─── Gauge Panel ──────────────────────────────────────────────────────────────
const GaugePanel = ({ value, label, sublabel, accent }) => (
  <div
    style={{
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#fff",
      borderRight: "1px solid #f1f5f9",
      padding: "16px 12px",
    }}
  >
    <GaugeCanvas value={value} label={label} sublabel={sublabel} />
    <div
      style={{
        marginTop: 12,
        padding: "6px 28px",
        background: accent,
        borderRadius: 8,
        color: "#fff",
        fontWeight: 800,
        fontSize: 24,
        fontFamily: "'Courier New', monospace",
        letterSpacing: 4,
        boxShadow: `0 4px 14px ${accent}44`,
      }}
    >
      {String(value ?? 0).padStart(3, "0")}.00
    </div>
  </div>
);

// ─── Sidebar Panel (Donut + info rows) ────────────────────────────────────────
const SidebarPanel = ({
  pct = 0,
  fillColor,
  infoRows = [],
  label = "Consumed Time",
}) => (
  <div
    style={{
      width: 190,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      padding: "14px 12px",
      background: "#f8fafc",
      borderRight: "1px solid #f1f5f9",
      justifyContent: "center",
    }}
  >
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#94a3b8",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <DonutCanvas pct={pct} size={130} fillColor={fillColor} />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            {Number(pct || 0).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
    <div
      style={{
        background: "#fff",
        border: "1px solid #f1f5f9",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      {infoRows.map(([k, v], i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 0",
            borderBottom:
              i < infoRows.length - 1 ? "1px solid #f8fafc" : "none",
            fontSize: 11,
            color: "#94a3b8",
          }}
        >
          <span>{k}</span>
          <strong style={{ color: "#0f172a" }}>
            {v != null ? (typeof v === "number" ? v.toLocaleString() : v) : "—"}
          </strong>
        </div>
      ))}
    </div>
  </div>
);

// ─── Nav Dots ─────────────────────────────────────────────────────────────────
const NavDots = ({ currentPage, onGoTo, onPrev, onNext }) => (
  <div
    style={{
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: "8px 16px",
      background: "#fff",
      borderTop: "1px solid #f1f5f9",
      position: "relative",
    }}
  >
    <button
      onClick={onPrev}
      style={{
        position: "absolute",
        left: 12,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#94a3b8",
        display: "flex",
        padding: 4,
      }}
    >
      <FiArrowLeft size={14} />
    </button>
    {PAGES_META.map(({ label, Icon, accent, light }, i) => (
      <button
        key={i}
        onClick={() => onGoTo(i)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 12px",
            borderRadius: 20,
            background: i === currentPage ? light : "transparent",
            border:
              i === currentPage
                ? `1.5px solid ${accent}`
                : "1.5px solid transparent",
            transition: "all 0.25s",
          }}
        >
          <Icon size={11} color={i === currentPage ? accent : "#cbd5e1"} />
          {i === currentPage && (
            <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>
              {label}
            </span>
          )}
        </div>
      </button>
    ))}
    <button
      onClick={onNext}
      style={{
        position: "absolute",
        right: 12,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#94a3b8",
        display: "flex",
        padding: 4,
      }}
    >
      <FiArrowRight size={14} />
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 1 — FG PACKING
//  API: GET /dashboard/fg-packing?shiftDate&shift&stationCode1&lineCode&sectionName&lineTaktTime1
//  Response keys: WorkingTimeMin, TactTimeSec, ShiftOutputTarget, ProratedTarget,
//                 PackingTillNow, LossUnits, LossTime, UPHTarget, ActualUPH,
//                 EfficiencyTillNow, PerformancePct, BalanceQty, GaugeValue,
//                 MonthlyPlanQty, MonthlyAchieved, MonthlyRemaining, AskingRate, RemainingDays
// ═══════════════════════════════════════════════════════════════════════════════
const Page1 = ({ apiData = {}, progress, shift, shiftDate, config }) => {
  const d = apiData;
  const label = config?.stationName1 || "FG PACKING";
  const accent = PAGES_META[0].accent;

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f8fafc",
      }}
    >
      <PageHeader
        title="Final Area Production Performance"
        shift={shift}
        shiftDate={shiftDate}
        accent={accent}
      />
      <TimerBar progress={progress} accent={accent} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <GaugePanel
          value={d.GaugeValue ?? 0}
          label={label}
          sublabel="Units / Shift"
          accent={accent}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 12,
            minWidth: 0,
            gap: 8,
          }}
        >
          <div
            style={{
              background: accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              textAlign: "center",
              padding: "7px 0",
              borderRadius: "8px 8px 0 0",
            }}
          >
            {label}
          </div>
          <MetricTable rows={rows} accent={accent} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 8,
          padding: "10px 12px",
          background: "#fff",
          borderTop: "1px solid #f1f5f9",
          flexShrink: 0,
        }}
      >
        <StatCard
          label="Monthly Plan"
          value={d.MonthlyPlanQty}
          accent="#1e40af"
        />
        <StatCard
          label="Monthly Achievement"
          value={d.MonthlyAchieved}
          accent="#15803d"
        />
        <StatCard
          label="Remaining Qty"
          value={d.MonthlyRemaining}
          accent="#b45309"
        />
        <StatCard label="Asking Rate" value={d.AskingRate} accent="#0f766e" />
        <StatCard
          label="Remaining Days"
          value={d.RemainingDays}
          accent="#64748b"
        />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 2 — FG LOADING
//  API: GET /dashboard/fg-loading?shiftDate&shift&stationCode1&stationCode2&sectionName&lineTaktTime2
//  Response keys: same shape as fg-packing but LoadingTillNow instead of PackingTillNow
// ═══════════════════════════════════════════════════════════════════════════════
const Page2 = ({ apiData = {}, progress, shift, shiftDate, config }) => {
  const d = apiData;
  const label = config?.stationName2 || "FG LOADING";
  const accent = PAGES_META[1].accent;

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f8fafc",
      }}
    >
      <PageHeader
        title="Final Area Production Performance"
        shift={shift}
        shiftDate={shiftDate}
        accent={accent}
      />
      <TimerBar progress={progress} accent="#14b8a6" />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <GaugePanel
          value={d.GaugeValue ?? 0}
          label={label}
          sublabel="Units / Shift"
          accent={accent}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 12,
            minWidth: 0,
            gap: 8,
          }}
        >
          <div
            style={{
              background: accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              textAlign: "center",
              padding: "7px 0",
              borderRadius: "8px 8px 0 0",
            }}
          >
            {label}
          </div>
          <MetricTable rows={rows} accent={accent} />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 8,
          padding: "10px 12px",
          background: "#fff",
          borderTop: "1px solid #f1f5f9",
          flexShrink: 0,
        }}
      >
        <StatCard
          label="Monthly Plan"
          value={d.MonthlyPlanQty}
          accent={accent}
        />
        <StatCard
          label="Monthly Achievement"
          value={d.MonthlyAchieved}
          accent="#15803d"
        />
        <StatCard
          label="Remaining Qty"
          value={d.MonthlyRemaining}
          accent="#b45309"
        />
        <StatCard label="Asking Rate" value={d.AskingRate} accent="#0f766e" />
        <StatCard
          label="Remaining Days"
          value={d.RemainingDays}
          accent="#64748b"
        />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 3 — HOURLY
//  API: GET /dashboard/hourly?shiftDate&shift&stationCode1&lineCode
//  Response: { hours: [{HourNo,Target,Actual,HourLoss,CumulativeLoss,AchievementPct}],
//              summary: {ShiftPlan,TotalAchieved,Remaining,ConsumedTimePct} }
// ═══════════════════════════════════════════════════════════════════════════════
const Page3 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { hours = [], summary = {} } = apiData;
  const accent = PAGES_META[2].accent;

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f8fafc",
      }}
    >
      <PageHeader
        title="Hourly Production Performance"
        shift={shift}
        shiftDate={shiftDate}
        accent={accent}
      />
      <TimerBar progress={progress} accent="#8b5cf6" />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SidebarPanel
          pct={summary.ConsumedTimePct}
          fillColor="#8b5cf6"
          infoRows={[
            ["Plan", summary.ShiftPlan],
            ["Achieved", summary.TotalAchieved],
            ["Remaining", summary.Remaining],
          ]}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "10px 12px",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                minWidth: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      background: accent,
                      color: "#fff",
                      padding: "6px 10px",
                      border: "1px solid rgba(255,255,255,0.2)",
                      textAlign: "left",
                    }}
                  >
                    Metric
                  </th>
                  {hours.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        background: accent,
                        color: "#fff",
                        padding: "6px 8px",
                        border: "1px solid rgba(255,255,255,0.2)",
                        textAlign: "center",
                        minWidth: 52,
                      }}
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
                    style={{ background: ri % 2 === 0 ? "#fff" : "#f8fafc" }}
                  >
                    <td
                      style={{
                        padding: "5px 10px",
                        border: "1px solid #f1f5f9",
                        color: "#334155",
                        fontWeight: 600,
                      }}
                    >
                      {row.label}
                    </td>
                    {hours.map((_, ci) => {
                      const item = row.isObj
                        ? row.vals[ci]
                        : { v: row.vals[ci], c: row.color };
                      return (
                        <td
                          key={ci}
                          style={{
                            padding: "5px 8px",
                            border: "1px solid #f1f5f9",
                            textAlign: "center",
                            fontWeight: 700,
                            color: item.c,
                          }}
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
          <div
            style={{
              flex: 1,
              background: "#fff",
              border: "1px solid #f1f5f9",
              borderRadius: 10,
              padding: "8px 8px 4px",
              minHeight: 120,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                marginBottom: 6,
                fontSize: 11,
              }}
            >
              {[
                ["#1e40af", "Target"],
                ["#d97706", "Actual"],
                ["#ef4444", "Loss"],
              ].map(([cl, l]) => (
                <span
                  key={l}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#64748b",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      background: cl,
                      borderRadius: 2,
                      display: "inline-block",
                    }}
                  />
                  {l}
                </span>
              ))}
            </div>
            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
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

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 4 — QUALITY
//  API: GET /dashboard/quality?shiftDate&shift&stationCode1
//  Response: { summary: {Plan,TotalAchieved,OkUnit,DefectUnit,ReworkDone,OkPct,DefectPct,ConsumedTimePct},
//              defects: [{SrNo,DefectName,DefectCount}] }
// ═══════════════════════════════════════════════════════════════════════════════
const Page4 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { summary: qs = {}, defects = [] } = apiData;
  const accent = PAGES_META[3].accent;

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f8fafc",
      }}
    >
      <PageHeader
        title="Quality Performance"
        shift={shift}
        shiftDate={shiftDate}
        accent={accent}
      />
      <TimerBar progress={progress} accent="#22c55e" />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div
          style={{
            width: 190,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "14px 12px",
            background: "#f8fafc",
            borderRight: "1px solid #f1f5f9",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <DonutCanvas
              pct={qs.ConsumedTimePct}
              size={130}
              fillColor="#22c55e"
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                {Number(qs.ConsumedTimePct || 0).toFixed(0)}%
              </div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>Time</div>
            </div>
          </div>
          <div
            style={{
              background: "#fff",
              border: "1px solid #f1f5f9",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
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
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 10px",
                  background: i % 2 === 0 ? "#fff" : "#f8fafc",
                  fontSize: 11,
                  color: "#94a3b8",
                  borderBottom: "1px solid #f8fafc",
                }}
              >
                <span>{k}</span>
                <strong style={{ color: "#0f172a" }}>{v ?? "—"}</strong>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "12px 20px",
            gap: 20,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 700 }}>
              Quality Overview
            </div>
            <div style={{ position: "relative" }}>
              <Chart
                key={`q-${qs.OkUnit}-${qs.DefectUnit}`}
                type="doughnut"
                data={pieData}
                options={pieOptions}
                width={200}
                height={200}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}
                >
                  {qs.TotalAchieved ?? 0}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>Total</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#15803d",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: "#15803d",
                    borderRadius: 2,
                    display: "inline-block",
                  }}
                />{" "}
                OK: {qs.OkUnit ?? 0}
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#ef4444",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: "#ef4444",
                    borderRadius: 2,
                    display: "inline-block",
                  }}
                />{" "}
                Defect: {qs.DefectUnit ?? 0}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                background: accent,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                textAlign: "center",
                padding: 8,
                borderRadius: "8px 8px 0 0",
              }}
            >
              Top Defects Today
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  {["Sr.", "Defect Description", "Count"].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: "#dcfce7",
                        color: accent,
                        padding: "7px 10px",
                        border: "1px solid #f1f5f9",
                        textAlign: "left",
                        fontWeight: 700,
                      }}
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
                      style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                    >
                      <td
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #f1f5f9",
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
                        {df.SrNo}
                      </td>
                      <td
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #f1f5f9",
                          color: "#334155",
                        }}
                      >
                        {df.DefectName}
                      </td>
                      <td
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #f1f5f9",
                          textAlign: "center",
                          fontWeight: 800,
                          color: "#ef4444",
                        }}
                      >
                        {df.DefectCount}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#94a3b8",
                        border: "1px solid #f1f5f9",
                      }}
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

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE 5 — LOSS
//  API: GET /dashboard/loss?shiftDate&shift&stationCode1&sectionName
//  Response: { stations: [{StationName,TotalStopTimeHMS,TotalStopTime,TotalStopCount}],
//              summary: {Plan,Achieved,Remaining,ConsumedTimePct} }
// ═══════════════════════════════════════════════════════════════════════════════
const Page5 = ({ apiData = {}, progress, shift, shiftDate }) => {
  const { stations = [], summary: ls = {} } = apiData;
  const accent = PAGES_META[4].accent;
  const maxTime = useMemo(
    () => Math.max(...stations.map((s) => s.TotalStopTime ?? 0), 1),
    [stations],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f8fafc",
      }}
    >
      <PageHeader
        title="Loss Performance"
        shift={shift}
        shiftDate={shiftDate}
        accent={accent}
      />
      <TimerBar progress={progress} accent="#f59e0b" />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SidebarPanel
          pct={ls.ConsumedTimePct}
          fillColor="#f59e0b"
          infoRows={[
            ["Plan", ls.Plan],
            ["Achieved", ls.Achieved],
            ["Balance", ls.Remaining],
          ]}
        />
        <div style={{ flex: 1, padding: 12, overflow: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr>
                {[
                  "Station Name",
                  "Stop Time (HH:MM:SS)",
                  "Stop Time (Min)",
                  "Stop Count",
                ].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      background: accent,
                      color: "#fff",
                      padding: "8px 12px",
                      border: "1px solid rgba(255,255,255,0.2)",
                      fontWeight: 700,
                      textAlign: i === 0 ? "left" : "center",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map((s, i) => {
                const intensity = s.TotalStopTime / maxTime;
                const isCritical = s.TotalStopTime > 100;
                const isHigh = s.TotalStopTime > 20;
                const rowBg = isCritical
                  ? `rgba(239,68,68,${0.08 + intensity * 0.12})`
                  : isHigh
                    ? "#fef3c7"
                    : "#fff";
                const textCol = isCritical
                  ? "#ef4444"
                  : isHigh
                    ? "#b45309"
                    : "#334155";
                return (
                  <tr key={i} style={{ background: rowBg }}>
                    <td
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #f1f5f9",
                        color: "#334155",
                        fontWeight: 600,
                      }}
                    >
                      {s.StationName}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #f1f5f9",
                        color: textCol,
                        textAlign: "center",
                        fontWeight: 700,
                      }}
                    >
                      {s.TotalStopTimeHMS ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #f1f5f9",
                        color: textCol,
                        textAlign: "center",
                        fontWeight: 700,
                      }}
                    >
                      {s.TotalStopTime}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #f1f5f9",
                        color: s.TotalStopCount > 10 ? "#ef4444" : "#334155",
                        textAlign: "center",
                        fontWeight: 700,
                      }}
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
                    style={{
                      padding: 28,
                      textAlign: "center",
                      color: "#94a3b8",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    No loss data recorded this shift
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
const Monitoring = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const routerState = location.state || {};
  const launchedConfig = routerState.config || null;
  const launchedDate = routerState.shiftDate || todayISO();
  const launchedShift = routerState.shift || "A";
  const isLaunched = !!routerState.autoLoad;

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

  // ── Auto-rotate pages ─────────────────────────────────────────────────────
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

  // ── Fetch all 5 endpoints in parallel ────────────────────────────────────
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

    // buildParams produces all query params; each endpoint only reads what it needs
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
    } catch (err) {
      toast.error("Failed to fetch dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load if launched from config manager
  useEffect(() => {
    if (isLaunched) fetchData(launchedDate, launchedShift, launchedConfig);
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

  const commonProps = { progress, shift, shiftDate, config: launchedConfig };
  const pages = [
    <Page1 key={0} apiData={allData.fgPacking} {...commonProps} />,
    <Page2 key={1} apiData={allData.fgLoading} {...commonProps} />,
    <Page3 key={2} apiData={allData.hourly} {...commonProps} />,
    <Page4 key={3} apiData={allData.quality} {...commonProps} />,
    <Page5 key={4} apiData={allData.loss} {...commonProps} />,
  ];

  // ── LAUNCHED (full-screen kiosk mode) ─────────────────────────────────────
  if (isLaunched) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          background: "#f8fafc",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Control bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 16px",
            background: "#fff",
            borderBottom: "1px solid #f1f5f9",
            flexShrink: 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {launchedConfig && (
            <span
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                }}
              />
              {launchedConfig.dashboardName}
            </span>
          )}
          <div style={{ width: 1, height: 20, background: "#f1f5f9" }} />

          {/* Shift buttons — also re-fetch on shift change */}
          {["A", "B"].map((s) => (
            <button
              key={s}
              onClick={() => {
                // For shift B, use previous calendar date if currently before 08:00
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
              style={{
                padding: "4px 12px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background:
                  shift === s ? (s === "A" ? "#dbeafe" : "#fef3c7") : "#f8fafc",
                color:
                  shift === s ? (s === "A" ? "#1e40af" : "#d97706") : "#94a3b8",
                border: `1.5px solid ${shift === s ? (s === "A" ? "#93c5fd" : "#fcd34d") : "#f1f5f9"}`,
              }}
            >
              Shift {s}
            </button>
          ))}

          <input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            style={{
              padding: "4px 10px",
              border: "1.5px solid #f1f5f9",
              borderRadius: 7,
              fontSize: 12,
              color: "#0f172a",
              background: "#f8fafc",
            }}
          />

          <button
            onClick={fetchAllData}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              background: "#1e40af",
              color: "#fff",
              border: "none",
            }}
          >
            <FiRefreshCw
              size={11}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
            {loading ? "Loading…" : "Refresh"}
          </button>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {lastFetched && (
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                Updated {lastFetched.toLocaleTimeString()}
              </span>
            )}
            {isRunning ? (
              <button
                onClick={() => setIsRunning(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: "#fef3c7",
                  color: "#d97706",
                  border: "1.5px solid #fcd34d",
                }}
              >
                <FiPause size={11} /> Pause
              </button>
            ) : (
              lastFetched && (
                <button
                  onClick={() => setIsRunning(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: "#dcfce7",
                    color: "#15803d",
                    border: "1.5px solid #86efac",
                  }}
                >
                  <FiPlay size={11} /> Resume
                </button>
              )
            )}
            <button
              onClick={() => navigate(-1)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: "#fee2e2",
                color: "#ef4444",
                border: "1.5px solid #fca5a5",
              }}
            >
              <FiX size={11} /> Exit
            </button>
          </div>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
            }}
          >
            <FiRefreshCw
              size={32}
              color="#6366f1"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <div style={{ color: "#94a3b8", marginTop: 14, fontSize: 14 }}>
              Fetching shift data…
            </div>
          </div>
        )}

        {/* Active dashboard */}
        {!loading && lastFetched && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
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

        {/* Waiting for first load */}
        {!loading && !lastFetched && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <FiSettings size={32} color="#cbd5e1" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>
              Loading dashboard data…
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: #f8fafc; }
          ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
          input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.6; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  // ── STANDALONE (not launched from config manager) ─────────────────────────
  return (
    <div
      style={{
        padding: 24,
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #f1f5f9",
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>
              W
            </span>
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: 20,
                fontWeight: 800,
                fontFamily: "'Georgia', serif",
              }}
            >
              Display Monitoring
            </h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
              Live Shift Performance · FG Packing & Loading · Quality · Loss
            </p>
          </div>
        </div>
        {lastFetched && (
          <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "right" }}>
            <div>Last refreshed</div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>
              {lastFetched.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #f1f5f9",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "flex-end",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                marginBottom: 5,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Shift Date
            </div>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              style={{
                padding: "9px 12px",
                border: "1.5px solid #e2e8f0",
                borderRadius: 9,
                fontSize: 13,
                outline: "none",
                color: "#0f172a",
                background: "#f8fafc",
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                marginBottom: 5,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Shift
            </div>
            <div
              style={{
                display: "flex",
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: 9,
                overflow: "hidden",
              }}
            >
              {[
                ["A", "08:00–20:00"],
                ["B", "20:00–08:00"],
              ].map(([s]) => (
                <button
                  key={s}
                  onClick={() => setShift(s)}
                  style={{
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: shift === s ? "#1e40af" : "transparent",
                    color: shift === s ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRight: "1.5px solid #e2e8f0",
                    transition: "all 0.15s",
                  }}
                >
                  Shift {s}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={fetchAllData}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 22px",
                background: loading ? "#94a3b8" : "#1e40af",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                fontWeight: 700,
                fontSize: 13,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px rgba(30,64,175,0.3)",
              }}
            >
              <FiRefreshCw
                style={{
                  animation: loading ? "spin 1s linear infinite" : "none",
                }}
              />
              {loading ? "Loading…" : "Load Dashboard"}
            </button>
            {isRunning ? (
              <button
                onClick={() => setIsRunning(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "10px 16px",
                  background: "#fef3c7",
                  color: "#d97706",
                  border: "1.5px solid #fcd34d",
                  borderRadius: 9,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <FiPause size={13} /> Pause
              </button>
            ) : (
              lastFetched && (
                <button
                  onClick={() => setIsRunning(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "10px 16px",
                    background: "#dcfce7",
                    color: "#15803d",
                    border: "1.5px solid #86efac",
                    borderRadius: 9,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <FiPlay size={13} /> Resume
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #f1f5f9",
          }}
        >
          <FiRefreshCw
            size={32}
            color="#1e40af"
            style={{ animation: "spin 1s linear infinite" }}
          />
          <div style={{ color: "#94a3b8", marginTop: 14, fontSize: 14 }}>
            Fetching shift data…
          </div>
        </div>
      )}

      {!loading && lastFetched && (
        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid #f1f5f9",
            boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
          }}
        >
          <div style={{ height: "70vh", overflow: "hidden" }}>
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

      {!loading && !lastFetched && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #f1f5f9",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <FiSettings size={32} color="#cbd5e1" />
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#475569",
              marginBottom: 6,
            }}
          >
            No data loaded
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            Select a date and click Load Dashboard to begin
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f8fafc; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.6; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default Monitoring;
