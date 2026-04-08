import { useCallback, useEffect, useRef, useState } from "react";
import SelectField from "../../components/ui/SelectField";
import axios from "axios";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";

/* ═══════════════════════════════════════════
   THEME
═══════════════════════════════════════════ */
const T = {
  bg: "#f4f6fb",
  bgDeep: "#eef1f8",
  surface: "#ffffff",
  surfaceHover: "#f8faff",
  border: "#e2e8f0",
  borderMed: "#cbd5e1",

  primary: "#3b5bdb",
  primaryDim: "#3b5bdb14",
  primaryBorder: "#3b5bdb44",

  amber: "#d97706",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  amberDim: "#d9770618",

  red: "#dc2626",
  redBg: "#fef2f2",
  redBorder: "#fecaca",

  green: "#16a34a",
  greenBg: "#f0fdf4",
  greenBorder: "#bbf7d0",

  sky: "#0284c7",
  skyBg: "#f0f9ff",
  skyBorder: "#bae6fd",

  orange: "#ea580c",
  orangeBg: "#fff7ed",
  orangeBorder: "#fed7aa",
  orangeDim: "#ea580c18",

  text: "#0f172a",
  textSub: "#334155",
  textMuted: "#64748b",
  textFaint: "#94a3b8",

  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Outfit',sans-serif",
};

/* ─── status classifier — SINGLE SOURCE OF TRUTH ─── */
const classifyStatus = (status) => {
  const s = (status || "").toLowerCase().trim();
  if (!s || s === "not logged in") return "unknown";
  if (
    s.includes("close") ||
    s.includes("done") ||
    s.includes("complet") ||
    s.includes("resolv") ||
    s.includes("finish")
  )
    return "closed";
  if (
    s.includes("open") ||
    s.includes("pending") ||
    s.includes("wait") ||
    s.includes("in progress") ||
    s.includes("wip")
  )
    return "open";
  return "unknown";
};

const STATUS_CFG = {
  open: { bg: T.redBg, color: T.red, border: T.redBorder, dot: "#ef4444" },
  closed: {
    bg: T.greenBg,
    color: T.green,
    border: T.greenBorder,
    dot: "#22c55e",
  },
  unknown: {
    bg: "#f8fafc",
    color: T.textMuted,
    border: T.border,
    dot: "#94a3b8",
  },
};

/* defect severity */
const ratioLevel = (pct) => {
  if (pct === null || pct === undefined)
    return { color: T.textFaint, label: "—", bg: T.bg, border: T.border };
  if (pct >= 35)
    return {
      color: T.red,
      label: "Critical",
      bg: T.redBg,
      border: T.redBorder,
    };
  if (pct >= 25)
    return {
      color: T.amber,
      label: "High",
      bg: T.amberBg,
      border: T.amberBorder,
    };
  if (pct >= 15)
    return {
      color: T.orange,
      label: "Moderate",
      bg: T.orangeBg,
      border: T.orangeBorder,
    };
  return {
    color: T.green,
    label: "Good",
    bg: T.greenBg,
    border: T.greenBorder,
  };
};

/* ═══════════════════════════════════════════
   ICONS
═══════════════════════════════════════════ */
const Ico = ({ path, size = 16, color = "currentColor", sw = 1.8 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={path} />
  </svg>
);
const IC = {
  refresh:
    "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3",
  x: "M18 6L6 18M6 6l12 12",
  chart: "M18 20V10M12 20V4M6 20v-6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  check: "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3",
  alert:
    "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  clock:
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  target:
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
  factory: "M2 20h20M4 20V10l6-6 6 6v10M10 20v-5h4v5M14 7h2v3h-2z",
  info: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01",
  bar: "M12 20V10M18 20V4M6 20v-6",
  sort: "M3 6h18M7 12h10M11 18h2",
};

/* ═══════════════════════════════════════════
   STATUS BADGE
═══════════════════════════════════════════ */
const StatusBadge = ({ status }) => {
  const type = classifyStatus(status);
  const cfg = STATUS_CFG[type];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".07em",
        textTransform: "uppercase",
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        fontFamily: T.mono,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cfg.dot,
          boxShadow: `0 0 5px ${cfg.dot}88`,
          animation: type === "open" ? "rr-pulse 2s ease infinite" : "none",
        }}
      />
      {status || "—"}
    </span>
  );
};

/* ═══════════════════════════════════════════
   KPI CARD
═══════════════════════════════════════════ */
const KpiCard = ({
  label,
  value,
  sub,
  accent,
  iconPath,
  onClick,
  active,
  badge,
}) => {
  const [hover, setHover] = useState(false);
  const ac = accent || T.primary;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: "1 1 155px",
        minWidth: 145,
        background: active ? ac + "0f" : hover ? T.surfaceHover : T.surface,
        border: `1.5px solid ${active ? ac : hover ? T.borderMed : T.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        transition: "all .18s ease",
        boxShadow: active
          ? `0 0 0 3px ${ac}1a,0 4px 18px ${ac}18`
          : hover
            ? "0 4px 16px rgba(0,0,0,.07)"
            : "0 1px 4px rgba(0,0,0,.04)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: active ? ac : "transparent",
          borderRadius: "14px 14px 0 0",
          transition: "background .2s",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: active ? ac : T.textMuted,
              marginBottom: 8,
              fontFamily: T.mono,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: active ? ac : T.text,
              lineHeight: 1,
              fontFamily: T.sans,
              letterSpacing: "-0.03em",
            }}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {sub && (
            <div
              style={{
                fontSize: 11,
                color: T.textMuted,
                marginTop: 6,
                fontFamily: T.mono,
                lineHeight: 1.5,
              }}
            >
              {sub}
            </div>
          )}
          {badge && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginTop: 8,
                padding: "2px 8px",
                borderRadius: 6,
                background: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: T.mono,
                letterSpacing: ".06em",
                textTransform: "uppercase",
              }}
            >
              {badge.label}
            </div>
          )}
        </div>
        {iconPath && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              flexShrink: 0,
              background: active ? ac + "18" : T.bgDeep,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${active ? ac + "44" : T.border}`,
            }}
          >
            <Ico path={iconPath} size={16} color={active ? ac : T.textMuted} />
          </div>
        )}
      </div>
    </button>
  );
};

/* ═══════════════════════════════════════════
   DONUT CHART
═══════════════════════════════════════════ */
const DonutChart = ({ open, closed, unknown }) => {
  const safeOpen = Number(open) || 0;
  const safeClosed = Number(closed) || 0;
  const safeUnknown = Number(unknown) || 0;

  const total = safeOpen + safeClosed + safeUnknown;

  const r = 44,
    cx = 58,
    cy = 58,
    circ = 2 * Math.PI * r;

  const cArc = total ? (safeClosed / total) * circ : 0;
  const oArc = total ? (safeOpen / total) * circ : 0;
  const uArc = total ? (safeUnknown / total) * circ : 0;

  return (
    <div style={{ position: "relative", width: 116, height: 116 }}>
      <svg viewBox="0 0 116 116">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#eee"
          strokeWidth={13}
        />

        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth={13}
          strokeDasharray={`${cArc} ${circ}`}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />

        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#ef4444"
          strokeWidth={13}
          strokeDasharray={`${oArc} ${circ}`}
          strokeDashoffset={-cArc}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div>{total > 0 ? Math.round((safeClosed / total) * 100) : 0}%</div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   REWORK STACKED BAR CHART
═══════════════════════════════════════════ */
const ReworkBarChart = ({ data }) => {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((row, i) => (
        <div key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: T.textSub,
                fontFamily: T.mono,
                fontWeight: 600,
                maxWidth: 220,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.Model_Name}
            </span>
            <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  color: T.red,
                  fontFamily: T.mono,
                  fontWeight: 700,
                }}
              >
                ↑ {row.open}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: T.green,
                  fontFamily: T.mono,
                  fontWeight: 700,
                }}
              >
                ✓ {row.closed}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: T.primary,
                  fontFamily: T.mono,
                  fontWeight: 800,
                }}
              >
                {row.total}
              </span>
            </div>
          </div>
          <div
            style={{
              height: 9,
              borderRadius: 5,
              background: T.bgDeep,
              overflow: "hidden",
              display: "flex",
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                width: `${(row.closed / max) * 100}%`,
                background: "#22c55e",
                transition: `width .9s cubic-bezier(.4,0,.2,1) ${i * 0.05}s`,
                borderRadius:
                  row.open === 0 && row.unknown === 0 ? "5px" : "5px 0 0 5px",
              }}
            />
            <div
              style={{
                width: `${(row.open / max) * 100}%`,
                background: "#ef4444",
                transition: `width .9s cubic-bezier(.4,0,.2,1) ${i * 0.05 + 0.1}s`,
              }}
            />
            {row.unknown > 0 && (
              <div
                style={{
                  width: `${(row.unknown / max) * 100}%`,
                  background: "#94a3b8",
                  transition: `width .9s cubic-bezier(.4,0,.2,1) ${i * 0.05 + 0.2}s`,
                }}
              />
            )}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 18, marginTop: 4 }}>
        {[
          { c: "#22c55e", l: "Closed" },
          { c: "#ef4444", l: "Open" },
        ].map((x) => (
          <div
            key={x.l}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <div
              style={{ width: 9, height: 9, borderRadius: 2, background: x.c }}
            />
            <span
              style={{ fontSize: 11, color: T.textMuted, fontFamily: T.mono }}
            >
              {x.l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PER-MODEL DEFECT RATIO BARS
   Now accurate: each model has its own production count
═══════════════════════════════════════════ */
const DefectRatioBars = ({ data }) => {
  const maxRatio = Math.max(...data.map((d) => d.defectRatio ?? 0), 0.01);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.map((row, i) => {
        const rl = ratioLevel(row.defectRatio);
        const barPct =
          row.defectRatio !== null
            ? (row.defectRatio / Math.max(maxRatio, 10)) * 100
            : 0;
        return (
          <div key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: T.textSub,
                  fontFamily: T.mono,
                  fontWeight: 600,
                  maxWidth: 210,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.Model_Name}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    fontFamily: T.mono,
                  }}
                >
                  Prod:{" "}
                  <b style={{ color: T.primary }}>
                    {(row.production || 0).toLocaleString()}
                  </b>
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    fontFamily: T.mono,
                  }}
                >
                  RW: <b style={{ color: T.red }}>{row.reworkTotal}</b>
                </span>
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: T.mono,
                    background: rl.bg,
                    color: rl.color,
                    border: `1px solid ${rl.border}`,
                    minWidth: 62,
                    textAlign: "center",
                  }}
                >
                  {row.defectRatio !== null
                    ? `${row.defectRatio.toFixed(2)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
            {/* ratio bar */}
            <div
              style={{
                height: 9,
                borderRadius: 5,
                background: T.bgDeep,
                overflow: "hidden",
                border: `1px solid ${T.border}`,
              }}
            >
              <div
                style={{
                  width: `${barPct}%`,
                  height: "100%",
                  background: rl.color,
                  borderRadius: 5,
                  transition: `width .9s cubic-bezier(.4,0,.2,1) ${i * 0.06}s`,
                }}
              />
            </div>
          </div>
        );
      })}
      {/* severity legend */}
      <div style={{ display: "flex", gap: 18, marginTop: 6, flexWrap: "wrap" }}>
        {[
          { color: T.green, label: "Good (<15%)" },
          { color: T.orange, label: "Moderate (15-20%)" },
          { color: T.amber, label: "High (20-35%)" },
          { color: T.red, label: "Critical (≥35%)" },
        ].map((l) => (
          <div
            key={l.label}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: l.color,
              }}
            />
            <span
              style={{ fontSize: 11, color: T.textMuted, fontFamily: T.mono }}
            >
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   DEFECT RATIO TABLE — per-model production
   Model_Name matched between rework & production
═══════════════════════════════════════════ */
const DefectRatioTable = ({ data }) => {
  const [sortCol, setSortCol] = useState("defectRatio");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortCol] ?? -1;
    const bv = b[sortCol] ?? -1;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const SortTh = ({ col, label, align = "center" }) => (
    <th
      onClick={() => handleSort(col)}
      style={{
        padding: "9px 14px",
        textAlign: align === "left" ? "left" : "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: sortCol === col ? T.primary : T.textMuted,
        fontFamily: T.mono,
        borderBottom: `2px solid ${T.border}`,
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        background: sortCol === col ? T.primaryDim : T.bgDeep,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        {label}
        {sortCol === col && (
          <Ico
            path={sortDir === "asc" ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}
            size={10}
            color={T.primary}
          />
        )}
      </span>
    </th>
  );

  const hasProd = data.some((r) => r.production !== null);

  return (
    <div style={{ overflowX: "auto" }}>
      {!hasProd && (
        <div
          style={{
            margin: "0 0 14px",
            padding: "10px 14px",
            borderRadius: 10,
            background: T.amberBg,
            border: `1px solid ${T.amberBorder}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <Ico path={IC.info} size={14} color={T.amber} />
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: T.amber,
              fontFamily: T.mono,
              lineHeight: 1.5,
            }}
          >
            Production data unavailable for this period. Ensure the
            <b> quality/production-report</b> endpoint is active and returning
            data from Station 1220010 (ActivityType = 5).
          </p>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              style={{
                padding: "9px 14px",
                textAlign: "left",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: T.textMuted,
                fontFamily: T.mono,
                borderBottom: `2px solid ${T.border}`,
                whiteSpace: "nowrap",
                background: T.bgDeep,
              }}
            >
              #
            </th>
            <SortTh col="Model_Name" label="Model" align="left" />
            <SortTh col="production" label="Production" />
            <SortTh col="reworkTotal" label="Rework" />
            <SortTh col="defectRatio" label="Defect Ratio" />
            <th
              style={{
                padding: "9px 14px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: T.textMuted,
                fontFamily: T.mono,
                borderBottom: `2px solid ${T.border}`,
                whiteSpace: "nowrap",
                background: T.bgDeep,
              }}
            >
              Severity
            </th>
            <th
              style={{
                padding: "9px 14px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: T.textMuted,
                fontFamily: T.mono,
                borderBottom: `2px solid ${T.border}`,
                whiteSpace: "nowrap",
                background: T.bgDeep,
              }}
            >
              Visual
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const rl = ratioLevel(row.defectRatio);
            const bg = i % 2 === 0 ? T.surface : T.bg;
            return (
              <tr
                key={i}
                style={{ background: bg, transition: "background .1s" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f8faff")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = bg)}
              >
                <td
                  style={{
                    padding: "11px 14px",
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: T.textFaint,
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  {i + 1}
                </td>
                {/* Model */}
                <td
                  style={{
                    padding: "11px 14px",
                    fontFamily: T.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text,
                    borderBottom: `1px solid ${T.border}`,
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.Model_Name}
                </td>
                {/* Production — exact per-model count from DB */}
                <td
                  style={{
                    padding: "11px 14px",
                    textAlign: "center",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  {row.production !== null ? (
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.primary,
                      }}
                    >
                      {row.production.toLocaleString()}
                    </span>
                  ) : (
                    <span
                      style={{
                        color: T.textFaint,
                        fontFamily: T.mono,
                        fontSize: 11,
                      }}
                    >
                      —
                    </span>
                  )}
                </td>
                {/* Rework */}
                <td
                  style={{
                    padding: "11px 14px",
                    textAlign: "center",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span
                    style={{
                      background: T.redBg,
                      color: T.red,
                      border: `1px solid ${T.redBorder}`,
                      borderRadius: 6,
                      padding: "2px 10px",
                      fontFamily: T.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      display: "inline-block",
                    }}
                  >
                    {row.reworkTotal}
                  </span>
                </td>
                {/* Defect Ratio */}
                <td
                  style={{
                    padding: "11px 14px",
                    textAlign: "center",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  {row.defectRatio !== null ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 7,
                          background: T.bgDeep,
                          borderRadius: 4,
                          overflow: "hidden",
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(row.defectRatio, 100)}%`,
                            height: "100%",
                            background: rl.color,
                            borderRadius: 4,
                            transition: "width .9s cubic-bezier(.4,0,.2,1)",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 13,
                          fontWeight: 800,
                          color: rl.color,
                          minWidth: 58,
                        }}
                      >
                        {row.defectRatio.toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <span
                      style={{
                        color: T.textFaint,
                        fontFamily: T.mono,
                        fontSize: 11,
                      }}
                    >
                      N/A
                    </span>
                  )}
                </td>
                {/* Severity */}
                <td
                  style={{
                    padding: "11px 14px",
                    textAlign: "center",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span
                    style={{
                      padding: "2px 10px",
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: T.mono,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      background: rl.bg,
                      color: rl.color,
                      border: `1px solid ${rl.border}`,
                    }}
                  >
                    {row.defectRatio !== null ? rl.label : "No Data"}
                  </span>
                </td>
                {/* Visual blocks */}
                <td
                  style={{
                    padding: "11px 14px",
                    textAlign: "center",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  {row.defectRatio !== null && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 3,
                      }}
                    >
                      {[2, 5, 10].map((thresh, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background:
                              row.defectRatio > thresh ? rl.color : T.bgDeep,
                            border: `1px solid ${row.defectRatio > thresh ? rl.color : T.border}`,
                            transition: "background .3s",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Totals row */}
          {sorted.length > 0 &&
            (() => {
              const totProd = sorted.reduce(
                (s, r) => s + (r.production ?? 0),
                0,
              );
              const totRW = sorted.reduce((s, r) => s + r.reworkTotal, 0);
              const totRatio = totProd > 0 ? (totRW / totProd) * 100 : null;
              const rl = ratioLevel(totRatio);
              return (
                <tr
                  style={{
                    background: T.bgDeep,
                    borderTop: `2px solid ${T.borderMed}`,
                  }}
                >
                  <td style={{ padding: "11px 14px" }} />
                  <td
                    style={{
                      padding: "11px 14px",
                      fontFamily: T.mono,
                      fontSize: 12,
                      fontWeight: 800,
                      color: T.text,
                    }}
                  >
                    TOTAL
                  </td>
                  <td
                    style={{
                      padding: "11px 14px",
                      textAlign: "center",
                      fontFamily: T.mono,
                      fontSize: 14,
                      color: T.primary,
                      fontWeight: 900,
                    }}
                  >
                    {totProd.toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: "11px 14px",
                      textAlign: "center",
                      fontFamily: T.mono,
                      fontSize: 14,
                      color: T.red,
                      fontWeight: 900,
                    }}
                  >
                    {totRW.toLocaleString()}
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    {totRatio !== null && (
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 15,
                          fontWeight: 900,
                          color: rl.color,
                        }}
                      >
                        {totRatio.toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    {totRatio !== null && (
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: T.mono,
                          letterSpacing: ".06em",
                          textTransform: "uppercase",
                          background: rl.bg,
                          color: rl.color,
                          border: `1px solid ${rl.border}`,
                        }}
                      >
                        {rl.label}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "11px 14px" }} />
                </tr>
              );
            })()}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════════════════════
   REWORK BREAKDOWN TABLE
═══════════════════════════════════════════ */
const BreakdownTable = ({ data, selectedModel, onModelClick }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: T.bgDeep }}>
          {["#", "Model", "Total", "Open", "Closed", "Close Rate", ""].map(
            (h, i) => (
              <th
                key={i}
                style={{
                  padding: "9px 14px",
                  textAlign: i >= 2 && i <= 6 ? "center" : "left",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                  fontFamily: T.mono,
                  borderBottom: `2px solid ${T.border}`,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => {
          const rate =
            row.total > 0 ? Math.round((row.closed / row.total) * 100) : 0;
          const isAct = selectedModel === row.Model_Name;
          const rc = rate >= 70 ? T.green : rate >= 40 ? T.amber : T.red;
          const bg = i % 2 === 0 ? T.surface : T.bg;
          return (
            <tr
              key={i}
              onClick={() => onModelClick(row.Model_Name)}
              style={{
                background: isAct ? T.primary + "0a" : bg,
                borderLeft: `3px solid ${isAct ? T.primary : "transparent"}`,
                cursor: "pointer",
                transition: "background .12s",
              }}
              onMouseEnter={(e) => {
                if (!isAct) e.currentTarget.style.background = "#f8faff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isAct
                  ? T.primary + "0a"
                  : bg;
              }}
            >
              <td
                style={{
                  padding: "10px 14px",
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.textFaint,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {i + 1}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  fontFamily: T.mono,
                  fontSize: 12,
                  color: isAct ? T.primary : T.text,
                  fontWeight: isAct ? 700 : 500,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {row.Model_Name}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  textAlign: "center",
                  fontFamily: T.mono,
                  fontSize: 14,
                  color: T.primary,
                  fontWeight: 800,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {row.total}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  textAlign: "center",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <span
                  style={{
                    background: T.redBg,
                    color: T.red,
                    border: `1px solid ${T.redBorder}`,
                    borderRadius: 6,
                    padding: "2px 9px",
                    fontFamily: T.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    display: "inline-block",
                  }}
                >
                  {row.open}
                </span>
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  textAlign: "center",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <span
                  style={{
                    background: T.greenBg,
                    color: T.green,
                    border: `1px solid ${T.greenBorder}`,
                    borderRadius: 6,
                    padding: "2px 9px",
                    fontFamily: T.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    display: "inline-block",
                  }}
                >
                  {row.closed}
                </span>
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 130,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 7,
                      background: T.bgDeep,
                      borderRadius: 4,
                      overflow: "hidden",
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: `${rate}%`,
                        height: "100%",
                        background: rc,
                        borderRadius: 4,
                        transition: "width .9s",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: T.mono,
                      color: rc,
                      fontWeight: 700,
                      minWidth: 34,
                    }}
                  >
                    {rate}%
                  </span>
                </div>
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onModelClick(row.Model_Name);
                  }}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: `1px solid ${isAct ? T.primary : T.border}`,
                    background: isAct ? T.primaryDim : "transparent",
                    color: isAct ? T.primary : T.textMuted,
                    fontFamily: T.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all .15s",
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                  }}
                >
                  {isAct ? "Clear" : "Filter"}
                </button>
              </td>
            </tr>
          );
        })}
        {data.length > 0 &&
          (() => {
            const tot = data.reduce(
              (a, r) => ({
                total: a.total + r.total,
                open: a.open + r.open,
                closed: a.closed + r.closed,
                unknown: a.unknown + r.unknown,
              }),
              { total: 0, open: 0, closed: 0, unknown: 0 },
            );
            const tr =
              tot.total > 0 ? Math.round((tot.closed / tot.total) * 100) : 0;
            const rc = tr >= 70 ? T.green : tr >= 40 ? T.amber : T.red;
            return (
              <tr
                style={{
                  background: T.bgDeep,
                  borderTop: `2px solid ${T.borderMed}`,
                }}
              >
                <td style={{ padding: "10px 14px" }} />
                <td
                  style={{
                    padding: "10px 14px",
                    fontFamily: T.mono,
                    fontSize: 12,
                    fontWeight: 800,
                    color: T.text,
                  }}
                >
                  TOTAL
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    textAlign: "center",
                    fontFamily: T.mono,
                    fontSize: 14,
                    color: T.primary,
                    fontWeight: 900,
                  }}
                >
                  {tot.total}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    textAlign: "center",
                    fontFamily: T.mono,
                    fontSize: 13,
                    color: T.red,
                    fontWeight: 800,
                  }}
                >
                  {tot.open}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    textAlign: "center",
                    fontFamily: T.mono,
                    fontSize: 13,
                    color: T.green,
                    fontWeight: 800,
                  }}
                >
                  {tot.closed}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    textAlign: "center",
                    fontFamily: T.mono,
                    fontSize: 13,
                    color: T.textMuted,
                    fontWeight: 700,
                  }}
                >
                  {tot.unknown > 0 ? tot.unknown : "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 130,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 7,
                        background: T.border,
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${tr}%`,
                          height: "100%",
                          background: rc,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: T.mono,
                        color: T.text,
                        fontWeight: 800,
                        minWidth: 34,
                      }}
                    >
                      {tr}%
                    </span>
                  </div>
                </td>
                <td style={{ padding: "10px 14px" }} />
              </tr>
            );
          })()}
      </tbody>
    </table>
  </div>
);

/* ═══════════════════════════════════════════
   SECTION WRAPPER
═══════════════════════════════════════════ */
const Section = ({ title, iconPath, children, right, delay = 0, accent }) => (
  <div
    style={{
      background: T.surface,
      borderRadius: 16,
      border: `1px solid ${accent || T.border}`,
      overflow: "hidden",
      boxShadow: "0 1px 6px rgba(0,0,0,.05)",
      animation: `rr-fadeup .45s ease ${delay}s both`,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: `1px solid ${accent || T.border}`,
        background: accent ? accent + "08" : T.bg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {iconPath && (
          <Ico path={iconPath} size={14} color={accent || T.primary} />
        )}
        <span
          style={{
            fontFamily: T.mono,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: accent || T.textSub,
          }}
        >
          {title}
        </span>
      </div>
      {right}
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

/* ═══════════════════════════════════════════
   QUICK BUTTON
═══════════════════════════════════════════ */
const QuickBtn = ({ label, onClick, loading }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "7px 16px",
        borderRadius: 8,
        border: `1.5px solid ${hover ? T.primary : T.border}`,
        background: hover ? T.primaryDim : T.surface,
        fontFamily: T.mono,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: ".09em",
        textTransform: "uppercase",
        color: hover ? T.primary : T.textMuted,
        cursor: "pointer",
        transition: "all .15s",
        display: "flex",
        alignItems: "center",
        gap: 6,
        opacity: loading ? 0.55 : 1,
      }}
    >
      {loading && (
        <span
          style={{
            width: 10,
            height: 10,
            border: `2px solid ${T.border}`,
            borderTopColor: T.primary,
            borderRadius: "50%",
            animation: "rr-spin .7s linear infinite",
            display: "inline-block",
          }}
        />
      )}
      {label}
    </button>
  );
};

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
const ReworkReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");

  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reworkData, setReworkData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModel, setSelectedModel] = useState(null);

  /* ── Production state ── */
  // productionMap: { Model_Name → production_count }
  const [productionMap, setProductionMap] = useState({});
  const [totalProduction, setTotalProduction] = useState(0);
  const [prodLoading, setProdLoading] = useState(false);

  const observer = useRef();

  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();
  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  const pad = (n) => (n < 10 ? `0${n}` : n);
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const buildParams = (extra = {}) => ({
    model: selectedModelVariant?.value || null,
    ...extra,
  });

  /* infinite scroll */
  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  /* ── Fetch production (calls getProductionReport controller)
     Response: { success, totalProduction, data: [{ Model_Name, MatCode, production_count }] }
     Model_Name here = m.Name from the production SQL (same join as rework's m.Alias).
     ⚠ NOTE: rework uses m.Alias, production uses m.Name — if they differ on your DB,
       change the production SQL's `m.Name AS Model_Name` to `m.Alias AS Model_Name`.
  ── */
  const fetchProductionData = async (st, et) => {
    try {
      setProdLoading(true);
      const res = await axios.get(`${baseURL}quality/production-report`, {
        params: {
          startTime: st,
          endTime: et,
          model: selectedModelVariant?.value || null,
        },
      });
      if (res?.data?.success) {
        const rows = res.data.data || [];
        const map = {};
        rows.forEach((r) => {
          map[r.Model_Name] = Number(r.production_count) || 0;
        });
        setProductionMap(map);
        setTotalProduction(res.data.totalProduction || 0);
      }
    } catch (err) {
      console.warn("Production data unavailable:", err.message);
      setProductionMap({});
      setTotalProduction(0);
    } finally {
      setProdLoading(false);
    }
  };

  /* paginated rework fetch */
  const fetchReworkData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/rework-report`, {
        params: buildParams({ startTime, endTime, page: pageNumber, limit }),
      });
      if (res?.data?.success) {
        const nd = res.data.data || [];
        setReworkData((prev) => (pageNumber === 1 ? nd : [...prev, ...nd]));
        if (pageNumber === 1) {
          setTotalCount(res.data.totalCount || 0);
          fetchProductionData(startTime, endTime);
        }
        setHasMore(nd.length === limit);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch rework data.");
    } finally {
      setLoading(false);
    }
  };

  /* quick fetch */
  const fetchQuickData = async (start, end, setLoader) => {
    try {
      setLoader(true);
      setReworkData([]);
      setTotalCount(0);
      setSelectedModel(null);
      setProductionMap({});
      setTotalProduction(0);
      const res = await axios.get(`${baseURL}quality/rework-report-quick`, {
        params: buildParams({ startTime: start, endTime: end }),
      });
      if (res?.data?.success) {
        setReworkData(res.data.data || []);
        setTotalCount(res.data.totalCount || 0);
        setHasMore(false);
        fetchProductionData(start, end);
      }
    } catch {
      toast.error("Failed to fetch quick data.");
    } finally {
      setLoader(false);
    }
  };

  const fetchYesterdayData = () => {
    const now = new Date();
    const t8 = new Date(now.setHours(8, 0, 0, 0));
    const y8 = new Date(t8);
    y8.setDate(t8.getDate() - 1);
    fetchQuickData(fmt(y8), fmt(t8), setYdayLoading);
  };
  const fetchTodayData = () => {
    const now = new Date();
    const t8 = new Date(now.setHours(8, 0, 0, 0));
    fetchQuickData(fmt(t8), fmt(new Date()), setTodayLoading);
  };
  const fetchMTDData = () => {
    const now = new Date();
    fetchQuickData(
      fmt(new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0)),
      fmt(now),
      setMonthLoading,
    );
  };

  const fetchExportData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return [];
    }
    try {
      const res = await axios.get(`${baseURL}quality/rework-report-export`, {
        params: buildParams({ startTime, endTime }),
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Export failed.");
      return [];
    }
  };

  const normalizeModel = (name) => {
    if (!name) return "Not Logged In";

    return name
      .trim()
      .replace(/\s*S$/i, "") // removes " S" at end
      .trim();
  };

  /* aggregation — uses classifyStatus (same as StatusBadge) */
  const aggregateReworkData = () => {
    const map = {};

    reworkData.forEach((item) => {
      const model = normalizeModel(item.Model_Name);

      if (!map[model]) {
        map[model] = {
          total: 0,
          open: 0,
          closed: 0,
        };
      }

      map[model].total++;

      const type = classifyStatus(item.Rework_Status);

      if (type === "closed") {
        map[model].closed++;
      } else {
        // ✅ unknown + open → treated as OPEN
        map[model].open++;
      }
    });

    return Object.entries(map)
      .map(([k, v]) => ({
        Model_Name: k,
        ...v,
        reworkTotal: v.total,
      }))
      .sort((a, b) => b.total - a.total);
  };

  useEffect(() => {
    if (page > 1) fetchReworkData(page);
  }, [page]);

  const handleQuery = () => {
    setPage(1);
    setReworkData([]);
    setSelectedModel(null);
    setProductionMap({});
    setTotalProduction(0);
    fetchReworkData(1);
  };
  const handleModelClick = (model) => {
    setSelectedModel((prev) => (prev === model ? null : model));
    setActiveTab("detail");
  };

  const filteredData = selectedModel
    ? reworkData.filter((x) => x.Model_Name === selectedModel)
    : reworkData;

  const aggregated = aggregateReworkData();
  const totalOpen = aggregated.reduce((s, r) => s + r.open, 0);
  const totalClosed = aggregated.reduce((s, r) => s + r.closed, 0);
  const totalUnknown = 0;
  const closeRate =
    totalCount > 0 ? Math.round((totalClosed / totalCount) * 100) : 0;

  /* merge rework aggregation with per-model production counts */
  const ratioData = aggregated
    .map((row) => {
      const prod = productionMap[row.Model_Name] ?? null;
      const ratio = prod ? (row.reworkTotal / prod) * 100 : null;
      return { ...row, production: prod, defectRatio: ratio };
    })
    .sort((a, b) => (b.defectRatio ?? -1) - (a.defectRatio ?? -1));

  const hasProd = totalProduction > 0;
  const overallRatio = hasProd ? (totalCount / totalProduction) * 100 : null;
  const columns = Object.keys(filteredData[0] || {});
  const hasData = reworkData.length > 0;

  const TABS = [
    { id: "summary", icon: IC.chart, label: "Summary" },
    { id: "defect", icon: IC.target, label: "Defect Ratio" },
    { id: "detail", icon: IC.list, label: "Detail View" },
  ];

  if (variantsLoading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        @keyframes rr-spin   { to { transform:rotate(360deg); } }
        @keyframes rr-fadeup { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
        @keyframes rr-pulse  { 0%,100%{opacity:1;}50%{opacity:.3;} }
        .rr-tr:hover td { background:#f8faff !important; }
        .rr-th {
          position:sticky; top:0; z-index:2;
          background:${T.bgDeep}; color:${T.textMuted};
          font-family:${T.mono}; font-size:10px; font-weight:700;
          letter-spacing:.1em; text-transform:uppercase;
          padding:10px 14px; white-space:nowrap;
          border-bottom:2px solid ${T.border};
        }
        .rr-td {
          padding:10px 14px; border-bottom:1px solid ${T.border};
          font-family:${T.mono}; font-size:12px;
          color:${T.textSub}; white-space:nowrap; transition:background .12s;
        }
        .tab-btn {
          padding:8px 18px; border-radius:9px; font-family:${T.mono};
          font-weight:700; font-size:10px; letter-spacing:.09em;
          text-transform:uppercase; cursor:pointer; transition:all .15s;
          display:flex; align-items:center; gap:7px; border:1.5px solid;
        }
        .tab-active        { background:${T.primaryDim};  border-color:${T.primaryBorder}; color:${T.primary}; }
        .tab-defect-active { background:${T.orangeDim};   border-color:${T.orangeBorder};  color:${T.orange};  }
        .tab-inactive      { background:${T.surface};     border-color:${T.border};        color:${T.textMuted}; }
        .tab-inactive:hover{ border-color:${T.borderMed}; color:${T.textSub}; background:${T.bg}; }
        ::-webkit-scrollbar       { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:${T.bg}; }
        ::-webkit-scrollbar-thumb { background:${T.borderMed}; border-radius:3px; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          fontFamily: T.sans,
          padding: "24px 28px",
          color: T.text,
        }}
      >
        {/* ══ HEADER ══ */}
        <div style={{ marginBottom: 22, animation: "rr-fadeup .4s ease" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: T.primaryDim,
                  border: `1.5px solid ${T.primaryBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 4px 14px ${T.primary}22`,
                }}
              >
                <Ico path={IC.layers} size={22} color={T.primary} />
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 26,
                    fontWeight: 900,
                    fontFamily: T.sans,
                    letterSpacing: "-0.03em",
                    color: T.text,
                  }}
                >
                  Rework Report
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: T.textMuted,
                    fontFamily: T.mono,
                    letterSpacing: ".06em",
                  }}
                >
                  Quality Control · Rework & Defect Ratio Dashboard
                </p>
              </div>
            </div>

            {hasData && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isDef = tab.id === "defect";
                  return (
                    <button
                      key={tab.id}
                      className={`tab-btn ${isActive ? (isDef ? "tab-defect-active" : "tab-active") : "tab-inactive"}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Ico path={tab.icon} size={12} color="currentColor" />
                      {tab.label}
                      {tab.id === "detail" && (
                        <span
                          style={{
                            background: isActive ? T.primary + "22" : T.bgDeep,
                            color: isActive ? T.primary : T.textFaint,
                            padding: "1px 7px",
                            borderRadius: 10,
                            fontSize: 10,
                            fontFamily: T.mono,
                            fontWeight: 700,
                          }}
                        >
                          {filteredData.length.toLocaleString()}
                        </span>
                      )}
                      {tab.id === "defect" && overallRatio !== null && (
                        <span
                          style={{
                            background: isActive ? T.orange + "22" : T.bgDeep,
                            color: isActive ? T.orange : T.textFaint,
                            padding: "1px 7px",
                            borderRadius: 10,
                            fontSize: 10,
                            fontFamily: T.mono,
                            fontWeight: 700,
                          }}
                        >
                          {overallRatio.toFixed(2)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ FILTER PANEL ══ */}
        <div
          style={{
            background: T.surface,
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            padding: "18px 22px",
            marginBottom: 20,
            boxShadow: "0 1px 6px rgba(0,0,0,.05)",
            animation: "rr-fadeup .4s ease .05s both",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                  fontFamily: T.mono,
                }}
              >
                Model Variant
              </label>
              <SelectField
                options={variants}
                value={selectedModelVariant?.value || ""}
                onChange={(e) =>
                  setSelectedModelVariant(
                    variants.find((v) => v.value === e.target.value) || null,
                  )
                }
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                  fontFamily: T.mono,
                }}
              >
                Start Time
              </label>
              <DateTimePicker
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                  fontFamily: T.mono,
                }}
              >
                End Time
              </label>
              <DateTimePicker
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <button
              onClick={handleQuery}
              disabled={loading}
              style={{
                padding: "10px 26px",
                borderRadius: 10,
                border: "none",
                background: loading ? T.bgDeep : T.primary,
                color: loading ? T.textMuted : "#fff",
                fontFamily: T.mono,
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: ".09em",
                textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all .15s",
                boxShadow: loading ? "none" : `0 4px 16px ${T.primary}44`,
              }}
            >
              {loading ? (
                <span
                  style={{
                    width: 13,
                    height: 13,
                    border: `2px solid ${T.border}`,
                    borderTopColor: T.primary,
                    borderRadius: "50%",
                    animation: "rr-spin .7s linear infinite",
                  }}
                />
              ) : (
                <Ico path={IC.refresh} size={13} color="#fff" />
              )}
              {loading ? "Loading…" : "Run Query"}
            </button>
            {hasData && (
              <div style={{ marginLeft: "auto" }}>
                <ExportButton
                  fetchData={fetchExportData}
                  filename="Rework_Report"
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              paddingTop: 14,
              borderTop: `1px dashed ${T.border}`,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: T.mono,
                fontWeight: 700,
                letterSpacing: ".09em",
                textTransform: "uppercase",
                color: T.textFaint,
              }}
            >
              Quick →
            </span>
            <QuickBtn
              label="Yesterday"
              onClick={fetchYesterdayData}
              loading={ydayLoading}
            />
            <QuickBtn
              label="Today"
              onClick={fetchTodayData}
              loading={todayLoading}
            />
            <QuickBtn
              label="Month to Date"
              onClick={fetchMTDData}
              loading={monthLoading}
            />
            {selectedModel && (
              <button
                onClick={() => setSelectedModel(null)}
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 13px",
                  borderRadius: 8,
                  border: `1px solid ${T.primaryBorder}`,
                  background: T.primaryDim,
                  color: T.primary,
                  fontFamily: T.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: ".05em",
                }}
              >
                <Ico path={IC.filter} size={11} color={T.primary} />
                {selectedModel}
                <Ico path={IC.x} size={11} color={T.primary} />
              </button>
            )}
          </div>
        </div>

        {/* ══ EMPTY ══ */}
        {!hasData && !loading && (
          <div
            style={{
              background: T.surface,
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              padding: "72px 24px",
              textAlign: "center",
              animation: "rr-fadeup .4s ease .1s both",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 18, opacity: 0.5 }}>
              ⚙️
            </div>
            <div
              style={{
                fontFamily: T.sans,
                fontSize: 18,
                fontWeight: 700,
                color: T.textMuted,
                marginBottom: 8,
              }}
            >
              No data loaded
            </div>
            <div
              style={{ fontFamily: T.mono, fontSize: 11, color: T.textFaint }}
            >
              Run a query or select a quick filter to load rework records
            </div>
          </div>
        )}
        {loading && !hasData && (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 72 }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                border: `3px solid ${T.border}`,
                borderTopColor: T.primary,
                borderRadius: "50%",
                animation: "rr-spin .7s linear infinite",
              }}
            />
          </div>
        )}

        {/* ══ SUMMARY TAB ══ */}
        {hasData && activeTab === "summary" && (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                marginBottom: 20,
                animation: "rr-fadeup .4s ease .08s both",
              }}
            >
              <KpiCard
                label="Total Records"
                value={totalCount}
                accent={T.primary}
                iconPath={IC.layers}
                sub={`${aggregated.length} model${aggregated.length !== 1 ? "s" : ""} tracked`}
                onClick={() => setSelectedModel(null)}
                active={!selectedModel}
              />
              <KpiCard
                label="Open / Pending"
                value={totalOpen}
                accent={T.red}
                iconPath={IC.alert}
                sub={`${totalCount > 0 ? 100 - closeRate : 0}% unresolved`}
              />
              <KpiCard
                label="Closed"
                value={totalClosed}
                accent={T.green}
                iconPath={IC.check}
                sub={`${closeRate}% resolution rate`}
              />
              {overallRatio !== null && (
                <KpiCard
                  label="Overall Defect Ratio"
                  value={`${overallRatio.toFixed(2)}%`}
                  accent={ratioLevel(overallRatio).color}
                  iconPath={IC.target}
                  sub={`${totalCount} reworks / ${totalProduction.toLocaleString()} produced`}
                  badge={ratioLevel(overallRatio)}
                />
              )}
              {totalUnknown > 0 && (
                <KpiCard
                  label="Unknown Status"
                  value={totalUnknown}
                  accent={T.textMuted}
                  iconPath={IC.clock}
                  sub="Unclassified status"
                />
              )}
              <KpiCard
                label="Models Affected"
                value={aggregated.length}
                accent={T.sky}
                iconPath={IC.bar}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 300px",
                gap: 18,
                marginBottom: 18,
                animation: "rr-fadeup .4s ease .12s both",
              }}
            >
              <Section
                title="Rework Volume by Model"
                iconPath={IC.chart}
                delay={0.12}
              >
                {aggregated.length > 0 ? (
                  <ReworkBarChart data={aggregated} />
                ) : (
                  <p
                    style={{
                      color: T.textMuted,
                      fontFamily: T.mono,
                      fontSize: 12,
                      margin: 0,
                    }}
                  >
                    No model data
                  </p>
                )}
              </Section>
              <Section title="Resolution Rate" iconPath={IC.check} delay={0.16}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 20,
                  }}
                >
                  <DonutChart
                    open={totalOpen}
                    closed={totalClosed}
                    //unknown={totalUnknown}
                  />
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {[
                      {
                        label: "Closed",
                        val: totalClosed,
                        color: T.green,
                        bg: T.greenBg,
                        border: T.greenBorder,
                      },
                      {
                        label: "Open / Pending",
                        val: totalOpen,
                        color: T.red,
                        bg: T.redBg,
                        border: T.redBorder,
                      },
                      ...(totalUnknown > 0
                        ? [
                            {
                              label: "Unknown",
                              val: totalUnknown,
                              color: T.textMuted,
                              bg: T.bg,
                              border: T.border,
                            },
                          ]
                        : []),
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "9px 13px",
                          borderRadius: 9,
                          background: s.bg,
                          border: `1px solid ${s.border}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: s.color,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: T.mono,
                              color: T.textMuted,
                            }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 900,
                            fontFamily: T.sans,
                            color: s.color,
                          }}
                        >
                          {s.val.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </div>

            <div style={{ animation: "rr-fadeup .4s ease .2s both" }}>
              <Section
                title="Model Breakdown"
                iconPath={IC.list}
                right={
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.textMuted,
                    }}
                  >
                    {aggregated.length} model
                    {aggregated.length !== 1 ? "s" : ""} · Click row to filter
                    detail
                  </span>
                }
              >
                <BreakdownTable
                  data={aggregated}
                  selectedModel={selectedModel}
                  onModelClick={handleModelClick}
                />
              </Section>
            </div>
          </>
        )}

        {/* ══ DEFECT RATIO TAB ══ */}
        {hasData && activeTab === "defect" && (
          <>
            {/* KPI row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                marginBottom: 20,
                animation: "rr-fadeup .4s ease .08s both",
              }}
            >
              <KpiCard
                label="Total Production"
                iconPath={IC.factory}
                value={
                  prodLoading
                    ? "…"
                    : hasProd
                      ? totalProduction.toLocaleString()
                      : "N/A"
                }
                accent={T.primary}
                sub={
                  prodLoading
                    ? "Fetching Station 1220010…"
                    : hasProd
                      ? `Across ${Object.keys(productionMap).length} models`
                      : "No data from production-report"
                }
              />
              <KpiCard
                label="Total Rework"
                value={totalCount}
                accent={T.red}
                iconPath={IC.alert}
                sub="Rework entries in period"
              />
              <KpiCard
                label="Overall Defect Ratio"
                value={
                  overallRatio !== null ? `${overallRatio.toFixed(2)}%` : "N/A"
                }
                accent={
                  overallRatio !== null
                    ? ratioLevel(overallRatio).color
                    : T.textFaint
                }
                iconPath={IC.target}
                sub={
                  hasProd
                    ? `${totalCount.toLocaleString()} reworks ÷ ${totalProduction.toLocaleString()} produced`
                    : prodLoading
                      ? "Calculating…"
                      : "Awaiting production data"
                }
                badge={overallRatio !== null ? ratioLevel(overallRatio) : null}
              />
              <KpiCard
                label="Models Tracked"
                value={aggregated.length}
                accent={T.sky}
                iconPath={IC.bar}
                sub={
                  hasProd
                    ? `${ratioData.filter((r) => r.defectRatio !== null).length} with production data`
                    : "Production data pending"
                }
              />
            </div>

            {/* Severity legend */}
            <div
              style={{
                background: T.surface,
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                padding: "12px 20px",
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 18,
                boxShadow: "0 1px 4px rgba(0,0,0,.04)",
                animation: "rr-fadeup .4s ease .1s both",
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                }}
              >
                Severity Thresholds:
              </span>
              {[
                { label: "Good", pct: 0.5 },
                { label: "Moderate", pct: 3 },
                { label: "High", pct: 7 },
                { label: "Critical", pct: 12 },
              ].map((t) => {
                const rl = ratioLevel(t.pct);
                return (
                  <div
                    key={t.label}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: T.mono,
                        background: rl.bg,
                        color: rl.color,
                        border: `1px solid ${rl.border}`,
                      }}
                    >
                      {t.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.textMuted,
                        fontFamily: T.mono,
                      }}
                    >
                      {t.label === "Good"
                        ? "< 15%"
                        : t.label === "Moderate"
                          ? "15–25%"
                          : t.label === "High"
                            ? "25–35%"
                            : "≥ 35%"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Per-model ratio bars */}
            {hasProd && (
              <div
                style={{
                  marginBottom: 18,
                  animation: "rr-fadeup .4s ease .12s both",
                }}
              >
                <Section
                  title="Defect Ratio by Model — Rework ÷ Per-Model Production"
                  iconPath={IC.bar}
                  delay={0.12}
                  accent={T.orange}
                >
                  <DefectRatioBars data={ratioData} />
                </Section>
              </div>
            )}

            {/* Defect ratio table */}
            <div style={{ animation: "rr-fadeup .4s ease .16s both" }}>
              <Section
                title="Per-Model Defect Ratio Table"
                iconPath={IC.target}
                delay={0.16}
                accent={T.orange}
                right={
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {prodLoading && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: T.textMuted,
                          fontFamily: T.mono,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            border: `2px solid ${T.border}`,
                            borderTopColor: T.primary,
                            borderRadius: "50%",
                            animation: "rr-spin .7s linear infinite",
                            display: "inline-block",
                          }}
                        />
                        Loading production…
                      </span>
                    )}
                    {!hasProd && !prodLoading && (
                      <span
                        style={{
                          fontSize: 11,
                          color: T.amber,
                          fontFamily: T.mono,
                          background: T.amberBg,
                          padding: "3px 10px",
                          borderRadius: 6,
                          border: `1px solid ${T.amberBorder}`,
                        }}
                      >
                        ⚠ Production data unavailable
                      </span>
                    )}
                    {hasProd && (
                      <span
                        style={{
                          fontSize: 11,
                          color: T.green,
                          fontFamily: T.mono,
                          background: T.greenBg,
                          padding: "3px 10px",
                          borderRadius: 6,
                          border: `1px solid ${T.greenBorder}`,
                        }}
                      >
                        ✓ Per-model production matched
                      </span>
                    )}
                  </div>
                }
              >
                <DefectRatioTable data={ratioData} />
              </Section>
            </div>
          </>
        )}

        {/* ══ DETAIL TAB ══ */}
        {hasData && activeTab === "detail" && (
          <div
            style={{
              background: T.surface,
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              overflow: "hidden",
              boxShadow: "0 1px 6px rgba(0,0,0,.05)",
              animation: "rr-fadeup .4s ease .08s both",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 20px",
                borderBottom: `1px solid ${T.border}`,
                background: T.bg,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Ico path={IC.list} size={14} color={T.primary} />
                <span
                  style={{
                    fontFamily: T.mono,
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: ".09em",
                    textTransform: "uppercase",
                    color: T.textSub,
                  }}
                >
                  {selectedModel ? `Filtered: ${selectedModel}` : "All Records"}
                </span>
                <span
                  style={{
                    background: T.primaryDim,
                    color: T.primary,
                    padding: "2px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: T.mono,
                    border: `1px solid ${T.primaryBorder}`,
                  }}
                >
                  {filteredData.length.toLocaleString()} rows
                </span>
                {selectedModel && (
                  <button
                    onClick={() => setSelectedModel(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 10px",
                      borderRadius: 6,
                      border: `1px solid ${T.primaryBorder}`,
                      background: T.primaryDim,
                      color: T.primary,
                      fontFamily: T.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Clear filter <Ico path={IC.x} size={10} color={T.primary} />
                  </button>
                )}
              </div>
              {hasMore && (
                <span
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    fontFamily: T.mono,
                  }}
                >
                  Scroll to load more ↓
                </span>
              )}
            </div>
            <div
              style={{ overflowX: "auto", overflowY: "auto", maxHeight: 560 }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th
                      className="rr-th"
                      style={{ width: 44, textAlign: "center" }}
                    >
                      #
                    </th>
                    {columns.map((k) => (
                      <th key={k} className="rr-th">
                        {k.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, i) => (
                    <tr
                      key={i}
                      className="rr-tr"
                      ref={i === filteredData.length - 1 ? lastRowRef : null}
                      style={{ background: i % 2 === 0 ? T.surface : T.bg }}
                    >
                      <td
                        className="rr-td"
                        style={{
                          textAlign: "center",
                          color: T.textFaint,
                          fontSize: 10,
                        }}
                      >
                        {i + 1}
                      </td>
                      {columns.map((k) => (
                        <td key={k} className="rr-td">
                          {k === "Rework_Status" ? (
                            <StatusBadge status={row[k]} />
                          ) : (
                            <span
                              style={{
                                color: k === "Model_Name" ? T.text : T.textSub,
                              }}
                            >
                              {row[k] ?? "—"}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: 28,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      border: `3px solid ${T.border}`,
                      borderTopColor: T.primary,
                      borderRadius: "50%",
                      animation: "rr-spin .7s linear infinite",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ReworkReport;
