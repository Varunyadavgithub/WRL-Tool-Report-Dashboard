import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FaDownload,
  FaSearch,
  FaCalendarAlt,
  FaFilter,
  FaChartBar,
  FaChartLine,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaIndustry,
  FaClipboardList,
  FaBolt,
  FaStar,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaTable,
  FaTimes,
  FaArrowRight,
  FaEye,
  FaSync,
  FaShieldAlt,
  FaTrophy,
  FaFireAlt,
  FaPercentage,
} from "react-icons/fa";
import {
  MdOutlineQueryStats,
  MdSpeed,
  MdWarningAmber,
  MdCheckCircleOutline,
  MdErrorOutline,
  MdDashboard,
  MdTrendingUp,
  MdTrendingDown,
  MdTrendingFlat,
} from "react-icons/md";
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
import DateTimePicker from "../../components/ui/DateTimePicker";
import SelectField from "../../components/ui/SelectField";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import Loader from "../../components/ui/Loader";

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

// --- Constants ----------------------------------------------------------------
const FPQI_TARGET = 2.2;

const REPORT_TYPES = [
  {
    value: "dailyFpaReport",
    label: "Daily",
    icon: <FaCalendarAlt />,
    desc: "Day-wise summary",
  },
  {
    value: "monthlyFpaReport",
    label: "Monthly",
    icon: <FaChartBar />,
    desc: "Month aggregation",
  },
  {
    value: "yearlyFpaReport",
    label: "Yearly",
    icon: <FaChartLine />,
    desc: "Year-over-year",
  },
];

const CATEGORY_CONFIG = {
  Critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
  },
  Major: { color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  Minor: { color: "#ca8a04", bg: "#fefce8", border: "#fef08a", dot: "#eab308" },
};

const CHART_COLORS = {
  good: "#10b981",
  bad: "#ef4444",
  target: "#6366f1",
  critical: "#ef4444",
  major: "#f59e0b",
  minor: "#eab308",
  sample: "#6366f1",
};

// --- Helpers ------------------------------------------------------------------
const normalizeArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const formatDate = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getFpqiStatus = (value) => {
  if (value === null || value === undefined) return null;
  return parseFloat(value) <= FPQI_TARGET ? "good" : "bad";
};

const calcFpqi = (critical, major, minor, samples) =>
  samples > 0 ? (critical * 9 + major * 6 + minor * 1) / samples : null;

// --- Mini Components ---------------------------------------------------------
const FpqiBadge = ({ value }) => {
  if (value === null || value === undefined)
    return <span style={{ color: "#9ca3af" }}>—</span>;
  const ok = getFpqiStatus(value) === "good";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 20,
        fontWeight: 700,
        fontSize: 12,
        background: ok ? "#dcfce7" : "#fee2e2",
        color: ok ? "#166534" : "#991b1b",
        border: `1px solid ${ok ? "#86efac" : "#fca5a5"}`,
      }}
    >
      {ok ? <FaCheckCircle size={10} /> : <FaTimesCircle size={10} />}
      {Number(value).toFixed(3)}
    </span>
  );
};

const CategoryBadge = ({ category }) => {
  const cfg = CATEGORY_CONFIG[category] || {};
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        fontWeight: 600,
        fontSize: 11,
        background: cfg.bg || "#f3f4f6",
        color: cfg.color || "#374151",
        border: `1px solid ${cfg.border || "#e5e7eb"}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot || "#9ca3af",
        }}
      />
      {category}
    </span>
  );
};

const StatusPill = ({ fpqi }) => {
  const ok = getFpqiStatus(fpqi) === "good";
  return ok ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "#166534",
        fontWeight: 600,
        fontSize: 11,
      }}
    >
      <MdCheckCircleOutline size={13} /> Pass
    </span>
  ) : (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: "#991b1b",
        fontWeight: 600,
        fontSize: 11,
      }}
    >
      <MdErrorOutline size={13} /> Fail
    </span>
  );
};

// --- KPI Cards Row -------------------------------------------------------------
const KpiCard = ({ icon, label, value, color, sub, trend }) => (
  <div
    style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      borderTop: `3px solid ${color}`,
      minWidth: 0,
      flex: "1 1 140px",
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${color}18`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        fontSize: 20,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "#111827",
          lineHeight: 1.1,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          fontWeight: 600,
          marginTop: 3,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
    {trend && (
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        {trend === "up" && (
          <FaArrowUp style={{ color: "#ef4444", fontSize: 14 }} />
        )}
        {trend === "down" && (
          <FaArrowDown style={{ color: "#10b981", fontSize: 14 }} />
        )}
        {trend === "flat" && (
          <FaMinus style={{ color: "#9ca3af", fontSize: 14 }} />
        )}
      </div>
    )}
  </div>
);

// Defect distribution bar (visual breakdown)
const DefectBar = ({ critical, major, minor }) => {
  const total = critical + major + minor;
  if (total === 0) return null;
  const pct = (n) => ((n / total) * 100).toFixed(1);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        Defect Breakdown — {total} total
      </div>
      <div
        style={{
          display: "flex",
          height: 20,
          borderRadius: 10,
          overflow: "hidden",
          gap: 2,
        }}
      >
        {critical > 0 && (
          <div
            style={{
              flex: critical,
              background: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>
              {pct(critical)}%
            </span>
          </div>
        )}
        {major > 0 && (
          <div
            style={{
              flex: major,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>
              {pct(major)}%
            </span>
          </div>
        )}
        {minor > 0 && (
          <div
            style={{
              flex: minor,
              background: "#eab308",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>
              {pct(minor)}%
            </span>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 6,
          fontSize: 11,
          color: "#6b7280",
        }}
      >
        <span>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>?</span> Critical{" "}
          {critical}
        </span>
        <span>
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>?</span> Major{" "}
          {major}
        </span>
        <span>
          <span style={{ color: "#eab308", fontWeight: 700 }}>?</span> Minor{" "}
          {minor}
        </span>
      </div>
    </div>
  );
};

// --- FPA Detail Summary -------------------------------------------------------
const FpaDetailSummary = ({ data }) => {
  if (!data || data.length === 0) return null;
  const critical = data.filter((r) => r.Category === "Critical").length;
  const major = data.filter((r) => r.Category === "Major").length;
  const minor = data.filter((r) => r.Category === "Minor").length;
  const samples = new Set(data.map((r) => r.FGSRNo)).size;
  const fpqi = calcFpqi(critical, major, minor, samples);
  const defectRate =
    samples > 0
      ? (((critical + major + minor) / data.length) * 100).toFixed(1)
      : null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}
      >
        <KpiCard
          icon={<FaClipboardList />}
          label="Total Records"
          value={data.length}
          color="#6366f1"
        />
        <KpiCard
          icon={<FaIndustry />}
          label="Unique FGSRNos"
          value={samples}
          color="#8b5cf6"
        />
        <KpiCard
          icon={<FaExclamationTriangle />}
          label="Critical"
          value={critical}
          color="#ef4444"
        />
        <KpiCard
          icon={<MdWarningAmber />}
          label="Major"
          value={major}
          color="#f59e0b"
        />
        <KpiCard
          icon={<FaInfoCircle />}
          label="Minor"
          value={minor}
          color="#eab308"
        />
        <KpiCard
          icon={<MdSpeed />}
          label="FPQI Score"
          value={fpqi !== null ? Number(fpqi).toFixed(3) : "—"}
          color={fpqi !== null && fpqi <= FPQI_TARGET ? "#10b981" : "#ef4444"}
          sub={`Target = ${FPQI_TARGET}`}
        />
        {defectRate && (
          <KpiCard
            icon={<FaPercentage />}
            label="Defect Rate"
            value={`${defectRate}%`}
            color="#6366f1"
          />
        )}
      </div>
      <DefectBar critical={critical} major={major} minor={minor} />
    </div>
  );
};

// --- Aggregate Summary --------------------------------------------------------
const AggregateSummary = ({ data, reportType }) => {
  if (!data || data.length === 0) return null;
  const totalCritical = data.reduce((s, r) => s + (r.NoOfCritical || 0), 0);
  const totalMajor = data.reduce((s, r) => s + (r.NoOfMajor || 0), 0);
  const totalMinor = data.reduce((s, r) => s + (r.NoOfMinor || 0), 0);
  const totalSamples = data.reduce((s, r) => s + (r.SampleInspected || 0), 0);
  const avgFpqi = calcFpqi(totalCritical, totalMajor, totalMinor, totalSamples);
  const passCount = data.filter((r) => getFpqiStatus(r.FPQI) === "good").length;
  const failCount = data.length - passCount;
  const passRate =
    data.length > 0 ? ((passCount / data.length) * 100).toFixed(0) : 0;

  // Best and worst periods
  const sorted = [...data]
    .filter((r) => r.FPQI !== null)
    .sort((a, b) => a.FPQI - b.FPQI);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const getPeriodLabel = (row) => {
    if (reportType === "dailyFpaReport")
      return row.ShiftDate?.slice(0, 10) || "—";
    if (reportType === "monthlyFpaReport")
      return `${row.Month} ${row.MonthKey?.slice(0, 4)}`;
    if (reportType === "yearlyFpaReport") return String(row.Year);
    return "—";
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}
      >
        <KpiCard
          icon={<FaExclamationTriangle />}
          label="Total Critical"
          value={totalCritical}
          color="#ef4444"
        />
        <KpiCard
          icon={<MdWarningAmber />}
          label="Total Major"
          value={totalMajor}
          color="#f59e0b"
        />
        <KpiCard
          icon={<FaInfoCircle />}
          label="Total Minor"
          value={totalMinor}
          color="#eab308"
        />
        <KpiCard
          icon={<FaIndustry />}
          label="Total Samples"
          value={totalSamples}
          color="#6366f1"
        />
        <KpiCard
          icon={<MdSpeed />}
          label="Avg FPQI"
          value={avgFpqi !== null ? Number(avgFpqi).toFixed(3) : "—"}
          color={
            avgFpqi !== null && avgFpqi <= FPQI_TARGET ? "#10b981" : "#ef4444"
          }
          sub={`Target = ${FPQI_TARGET}`}
        />
        <KpiCard
          icon={<FaTrophy />}
          label="Pass Rate"
          value={`${passRate}%`}
          color="#10b981"
          sub={`${passCount} pass / ${failCount} fail`}
        />
      </div>
      <DefectBar
        critical={totalCritical}
        major={totalMajor}
        minor={totalMinor}
      />
      {(best || worst) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {best && (
            <div
              style={{
                flex: "1 1 200px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#166534",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                ?? Best Period
              </div>
              <div style={{ fontWeight: 700, color: "#111827" }}>
                {getPeriodLabel(best)}
              </div>
              <div style={{ fontSize: 12, color: "#166534" }}>
                FPQI: {Number(best.FPQI).toFixed(3)}
              </div>
            </div>
          )}
          {worst && worst !== best && (
            <div
              style={{
                flex: "1 1 200px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#991b1b",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                ? Worst Period
              </div>
              <div style={{ fontWeight: 700, color: "#111827" }}>
                {getPeriodLabel(worst)}
              </div>
              <div style={{ fontSize: 12, color: "#991b1b" }}>
                FPQI: {Number(worst.FPQI).toFixed(3)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Top Defects Analysis -----------------------------------------------------
const TopDefectsPanel = ({ data }) => {
  if (!data || data.length === 0) return null;
  const freq = {};
  data.forEach((r) => {
    if (r.AddDefect) freq[r.AddDefect] = (freq[r.AddDefect] || 0) + 1;
  });
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const max = top[0]?.[1] || 1;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <FaFireAlt style={{ color: "#ef4444" }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
          Top Defect Types
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
          by frequency
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {top.map(([defect, count], i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background:
                  i === 0 ? "#ef444422" : i === 1 ? "#f59e0b22" : "#6366f122",
                color: i === 0 ? "#ef4444" : i === 1 ? "#f59e0b" : "#6366f1",
                fontSize: 10,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "#374151",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {defect}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#374151",
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                >
                  {count}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#f3f4f6",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(count / max) * 100}%`,
                    height: "100%",
                    background:
                      i === 0 ? "#ef4444" : i === 1 ? "#f59e0b" : "#6366f1",
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Model Performance Panel --------------------------------------------------
const ModelPerformancePanel = ({ data }) => {
  if (!data || data.length === 0) return null;
  const models = {};
  data.forEach((r) => {
    if (!r.Model) return;
    if (!models[r.Model])
      models[r.Model] = { critical: 0, major: 0, minor: 0, fgsrNos: new Set() };
    const cat = r.Category;
    if (cat === "Critical") models[r.Model].critical++;
    else if (cat === "Major") models[r.Model].major++;
    else if (cat === "Minor") models[r.Model].minor++;
    if (r.FGSRNo) models[r.Model].fgsrNos.add(r.FGSRNo);
  });

  const rows = Object.entries(models)
    .map(([model, d]) => {
      const samples = d.fgsrNos.size;
      const fpqi = calcFpqi(d.critical, d.major, d.minor, samples);
      return { model, ...d, samples, fpqi };
    })
    .sort((a, b) => (a.fpqi ?? 999) - (b.fpqi ?? 999));

  if (rows.length < 2) return null;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <FaShieldAlt style={{ color: "#6366f1" }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
          Model Performance
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {[
                "Model",
                "Samples",
                "Critical",
                "Major",
                "Minor",
                "FPQI",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#374151",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    borderBottom: "2px solid #e5e7eb",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
              >
                <td
                  style={{
                    padding: "8px 12px",
                    fontWeight: 700,
                    color: "#1e1b4b",
                    textAlign: "center",
                  }}
                >
                  {row.model}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    color: "#6366f1",
                    fontWeight: 600,
                  }}
                >
                  {row.samples}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    color: row.critical > 0 ? "#ef4444" : "#9ca3af",
                    fontWeight: row.critical > 0 ? 700 : 400,
                  }}
                >
                  {row.critical}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    color: row.major > 0 ? "#f59e0b" : "#9ca3af",
                    fontWeight: row.major > 0 ? 700 : 400,
                  }}
                >
                  {row.major}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    color: row.minor > 0 ? "#eab308" : "#9ca3af",
                    fontWeight: row.minor > 0 ? 700 : 400,
                  }}
                >
                  {row.minor}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  <FpqiBadge value={row.fpqi} />
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  <StatusPill fpqi={row.fpqi} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Country Analysis Panel ---------------------------------------------------
const CountryPanel = ({ data }) => {
  if (!data || data.length === 0) return null;
  const countries = {};
  data.forEach((r) => {
    if (!r.Country) return;
    if (!countries[r.Country])
      countries[r.Country] = {
        critical: 0,
        major: 0,
        minor: 0,
        fgsrNos: new Set(),
      };
    if (r.Category === "Critical") countries[r.Country].critical++;
    else if (r.Category === "Major") countries[r.Country].major++;
    else if (r.Category === "Minor") countries[r.Country].minor++;
    if (r.FGSRNo) countries[r.Country].fgsrNos.add(r.FGSRNo);
  });

  const rows = Object.entries(countries)
    .map(([country, d]) => {
      const samples = d.fgsrNos.size;
      return {
        country,
        ...d,
        samples,
        fpqi: calcFpqi(d.critical, d.major, d.minor, samples),
      };
    })
    .sort(
      (a, b) =>
        b.critical * 9 +
        b.major * 6 +
        b.minor -
        (a.critical * 9 + a.major * 6 + a.minor),
    );

  if (rows.length < 2) return null;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <FaIndustry style={{ color: "#8b5cf6" }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
          Destination Country Analysis
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {rows.map((row, i) => {
          const ok = getFpqiStatus(row.fpqi) === "good";
          return (
            <div
              key={i}
              style={{
                flex: "1 1 160px",
                background: ok ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#111827",
                  marginBottom: 4,
                }}
              >
                {row.country}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                {row.samples} inspected
              </div>
              <FpqiBadge value={row.fpqi} />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 6,
                  fontSize: 10,
                  color: "#6b7280",
                }}
              >
                <span style={{ color: "#ef4444" }}>C:{row.critical}</span>
                <span style={{ color: "#f59e0b" }}>M:{row.major}</span>
                <span style={{ color: "#eab308" }}>m:{row.minor}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Charts -------------------------------------------------------------------
const FpqiTrendChart = ({ data, reportType }) => {
  if (!data || data.length === 0) return null;

  let sorted = [...data];
  if (reportType === "dailyFpaReport")
    sorted.sort((a, b) => new Date(a.ShiftDate) - new Date(b.ShiftDate));
  if (reportType === "monthlyFpaReport")
    sorted.sort((a, b) => a.MonthKey?.localeCompare(b.MonthKey));
  if (reportType === "yearlyFpaReport") sorted.sort((a, b) => a.Year - b.Year);

  const labels =
    reportType === "dailyFpaReport"
      ? sorted.map((i) => i.ShiftDate?.slice(0, 10))
      : reportType === "monthlyFpaReport"
        ? sorted.map(
            (i) => `${i.Month?.slice(0, 3)} ${i.MonthKey?.slice(0, 4)}`,
          )
        : reportType === "yearlyFpaReport"
          ? sorted.map((i) => String(i.Year))
          : [];

  const isLine = reportType === "dailyFpaReport";
  const fpqiData = sorted.map((i) => i.FPQI);
  const goodColors = sorted.map((i) =>
    getFpqiStatus(i.FPQI) === "good" ? CHART_COLORS.good : CHART_COLORS.bad,
  );

  const chartData = {
    labels,
    datasets: [
      {
        type: isLine ? "line" : "bar",
        label: "FPQI",
        data: fpqiData,
        backgroundColor: isLine ? "rgba(99,102,241,0.08)" : goodColors,
        borderColor: isLine ? "#6366f1" : goodColors,
        borderWidth: isLine ? 2.5 : 1.5,
        tension: 0.4,
        fill: isLine,
        pointBackgroundColor: sorted.map((i) =>
          getFpqiStatus(i.FPQI) === "good"
            ? CHART_COLORS.good
            : CHART_COLORS.bad,
        ),
        pointRadius: isLine ? 5 : 0,
        pointHoverRadius: 8,
        borderRadius: isLine ? 0 : 6,
        yAxisID: "y",
      },
      {
        type: "bar",
        label: "Critical",
        data: sorted.map((i) => i.NoOfCritical),
        backgroundColor: "rgba(239,68,68,0.6)",
        borderColor: "#ef4444",
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: "y2",
      },
      {
        type: "bar",
        label: "Major",
        data: sorted.map((i) => i.NoOfMajor),
        backgroundColor: "rgba(245,158,11,0.6)",
        borderColor: "#f59e0b",
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: "y2",
      },
      {
        type: "bar",
        label: "Minor",
        data: sorted.map((i) => i.NoOfMinor),
        backgroundColor: "rgba(234,179,8,0.5)",
        borderColor: "#eab308",
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: "y2",
      },
      {
        type: "line",
        label: `Target (${FPQI_TARGET})`,
        data: Array(labels.length).fill(FPQI_TARGET),
        borderColor: "#22c55e",
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        yAxisID: "y",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e1b4b",
        titleColor: "#e0e7ff",
        bodyColor: "#c7d2fe",
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            if (
              ctx.dataset.label === "FPQI" ||
              ctx.dataset.label === `Target (${FPQI_TARGET})`
            ) {
              return ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(3)}`;
            }
            return ` ${ctx.dataset.label}: ${ctx.raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#6b7280",
          fontSize: 11,
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15,
        },
      },
      y: {
        position: "left",
        title: {
          display: true,
          text: "FPQI",
          color: "#6366f1",
          font: { weight: "700", size: 11 },
        },
        grid: { color: "#f3f4f6" },
        ticks: { color: "#6b7280", callback: (v) => v.toFixed(2) },
      },
      y2: {
        position: "right",
        title: {
          display: true,
          text: "Defect Count",
          color: "#9ca3af",
          font: { weight: "700", size: 11 },
        },
        grid: { display: false },
        ticks: { color: "#9ca3af" },
      },
    },
  };

  const legendItems = [
    { color: "#6366f1", label: "FPQI" },
    { color: "#22c55e", label: `Target ${FPQI_TARGET}`, dashed: true },
    { color: "#ef4444", label: "Critical" },
    { color: "#f59e0b", label: "Major" },
    { color: "#eab308", label: "Minor" },
  ];

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <FaChartLine style={{ color: "#6366f1" }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
          {reportType === "dailyFpaReport"
            ? "Daily FPQI Trend"
            : reportType === "monthlyFpaReport"
              ? "Monthly FPQI Trend"
              : "Yearly FPQI Trend"}
        </span>
      </div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}
      >
        {legendItems.map((item, i) => (
          <span
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            <span
              style={{
                width: 14,
                height: item.dashed ? 3 : 10,
                borderRadius: item.dashed ? 0 : 3,
                background: item.color,
                borderTop: item.dashed ? `2px dashed ${item.color}` : "none",
                display: "inline-block",
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div style={{ position: "relative", height: 320 }}>
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
};

// --- Empty State ---------------------------------------------------------------
const EmptyState = ({ message = "No data found." }) => (
  <div style={{ textAlign: "center", padding: "56px 0", color: "#9ca3af" }}>
    <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>??</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>
      {message}
    </div>
    <div style={{ fontSize: 12, marginTop: 6, color: "#9ca3af" }}>
      Adjust your filters and click Query
    </div>
  </div>
);

// --- Shared table styles ------------------------------------------------------
const thS = {
  padding: "10px 12px",
  background: "#1e1b4b",
  color: "#e0e7ff",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  whiteSpace: "nowrap",
  border: "1px solid #312e81",
  textAlign: "center",
};
const tdS = {
  padding: "8px 12px",
  border: "1px solid #f3f4f6",
  fontSize: 12,
  color: "#374151",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tableWrapper = {
  maxHeight: 520,
  overflowX: "auto",
  overflowY: "auto",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
};

// --- FPA Detail Table ---------------------------------------------------------
const FpaReportTable = ({ data }) => {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [catFilter, setCatFilter] = useState("All");

  const handleDownloadImage = async (fgSrNo, fileName) => {
    if (!fgSrNo || !fileName) {
      toast("No image available.", { icon: "??" });
      return;
    }
    try {
      const response = await axios({
        url: `${baseURL}quality/download-fpa-defect-image/${fgSrNo}`,
        method: "GET",
        responseType: "blob",
        params: { filename: fileName },
      });
      if (!response.data || response.data.size === 0) {
        toast.info("File is empty or unavailable.");
        return;
      }
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Download started: "${fileName}"`);
    } catch (err) {
      if (err.response?.status === 404)
        toast.error("File not found on server.");
      else toast.error(`Download failed: ${err.message}`);
    }
  };

  const filtered = useMemo(() => {
    if (catFilter === "All") return data;
    return data.filter((r) => r.Category === catFilter);
  }, [data, catFilter]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sort]);

  const toggleSort = (key) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));
  const SortIcon = ({ k }) =>
    sort.key === k ? (
      sort.dir === "asc" ? (
        <FaArrowUp size={8} />
      ) : (
        <FaArrowDown size={8} />
      )
    ) : null;

  if (!data || data.length === 0) return <EmptyState />;

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 10,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
          Filter by Category:
        </span>
        {["All", "Critical", "Major", "Minor"].map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              background:
                catFilter === cat
                  ? cat === "Critical"
                    ? "#ef4444"
                    : cat === "Major"
                      ? "#f59e0b"
                      : cat === "Minor"
                        ? "#eab308"
                        : "#6366f1"
                  : "#f3f4f6",
              color: catFilter === cat ? "#fff" : "#374151",
              border: "none",
            }}
          >
            {cat}{" "}
            {cat !== "All" &&
              `(${data.filter((r) => r.Category === cat).length})`}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
          Showing {sorted.length} of {data.length} records
        </span>
      </div>
      <div style={tableWrapper}>
        <table
          style={{
            minWidth: "100%",
            borderCollapse: "collapse",
            tableLayout: "auto",
          }}
        >
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              {[
                { label: "SR No", key: "SRNo" },
                { label: "Date & Time", key: "Date" },
                { label: "Model", key: "Model" },
                { label: "Shift", key: "Shift" },
                { label: "FGSRNO", key: "FGSRNo" },
                { label: "Country", key: "Country" },
                { label: "Category", key: "Category" },
                { label: "Defect Detail", key: "AddDefect" },
                { label: "Remark", key: "Remark" },
                { label: "Image", key: null },
              ].map(({ label, key }) => (
                <th
                  key={label}
                  style={{ ...thS, cursor: key ? "pointer" : "default" }}
                  onClick={() => key && toggleSort(key)}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {label} {key && <SortIcon k={key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#eef2ff")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    i % 2 === 0 ? "#fff" : "#fafafa")
                }
              >
                <td style={{ ...tdS, fontWeight: 700, color: "#6366f1" }}>
                  {row.SRNo}
                </td>
                <td style={tdS}>
                  {row.Date ? (
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {row.Date.replace("T", " ").replace("Z", "").slice(0, 19)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ ...tdS, fontWeight: 700 }}>{row.Model}</td>
                <td style={tdS}>{row.Shift}</td>
                <td style={{ ...tdS, fontWeight: 700 }}>{row.FGSRNo}</td>
                <td style={tdS}>{row.Country}</td>
                <td style={tdS}>
                  <CategoryBadge category={row.Category} />
                </td>
                <td
                  style={{
                    ...tdS,
                    textAlign: "left",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={row.AddDefect}
                >
                  {row.AddDefect}
                </td>
                <td
                  style={{
                    ...tdS,
                    textAlign: "left",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={row.Remark}
                >
                  {row.Remark}
                </td>
                <td style={tdS}>
                  {row.DefectImage ? (
                    <button
                      onClick={() =>
                        handleDownloadImage(row.FGSRNo, row.DefectImage)
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#eef2ff",
                        color: "#4338ca",
                        border: "1px solid #c7d2fe",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <FaDownload size={10} /> Download
                    </button>
                  ) : (
                    <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// --- Daily Table --------------------------------------------------------------
const DailyFpaReportTable = ({ data }) => {
  if (!data || data.length === 0) return <EmptyState />;
  const sorted = [...data].sort(
    (a, b) => new Date(a.ShiftDate) - new Date(b.ShiftDate),
  );
  return (
    <div style={tableWrapper}>
      <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
          <tr>
            {[
              "Date",
              "Month",
              "Critical",
              "Major",
              "Minor",
              "Sample Inspected",
              "FPQI",
              "Status",
            ].map((h) => (
              <th key={h} style={thS}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#eef2ff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  i % 2 === 0 ? "#fff" : "#fafafa")
              }
            >
              <td style={{ ...tdS, fontFamily: "monospace", fontWeight: 600 }}>
                {row.ShiftDate?.slice(0, 10) || "—"}
              </td>
              <td style={tdS}>{row.Month}</td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfCritical > 0 ? "#ef4444" : "#9ca3af",
                  fontWeight: row.NoOfCritical > 0 ? 700 : 400,
                }}
              >
                {row.NoOfCritical}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfMajor > 0 ? "#f59e0b" : "#9ca3af",
                  fontWeight: row.NoOfMajor > 0 ? 700 : 400,
                }}
              >
                {row.NoOfMajor}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfMinor > 0 ? "#eab308" : "#9ca3af",
                  fontWeight: row.NoOfMinor > 0 ? 700 : 400,
                }}
              >
                {row.NoOfMinor}
              </td>
              <td style={{ ...tdS, fontWeight: 600, color: "#6366f1" }}>
                {row.SampleInspected}
              </td>
              <td style={tdS}>
                <FpqiBadge value={row.FPQI} />
              </td>
              <td style={tdS}>
                <StatusPill fpqi={row.FPQI} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Monthly Table ------------------------------------------------------------
const MonthlyFpaReportTable = ({ data }) => {
  if (!data || data.length === 0) return <EmptyState />;
  const sorted = [...data].sort((a, b) =>
    a.MonthKey?.localeCompare(b.MonthKey),
  );
  return (
    <div style={tableWrapper}>
      <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
          <tr>
            {[
              "Month",
              "Period (YYYY-MM)",
              "Critical",
              "Major",
              "Minor",
              "Sample Inspected",
              "FPQI",
              "Status",
            ].map((h) => (
              <th key={h} style={thS}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#eef2ff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  i % 2 === 0 ? "#fff" : "#fafafa")
              }
            >
              <td style={{ ...tdS, fontWeight: 700 }}>{row.Month}</td>
              <td style={{ ...tdS, fontFamily: "monospace" }}>
                {row.MonthKey}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfCritical > 0 ? "#ef4444" : "#9ca3af",
                  fontWeight: row.NoOfCritical > 0 ? 700 : 400,
                }}
              >
                {row.NoOfCritical}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfMajor > 0 ? "#f59e0b" : "#9ca3af",
                  fontWeight: row.NoOfMajor > 0 ? 700 : 400,
                }}
              >
                {row.NoOfMajor}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfMinor > 0 ? "#eab308" : "#9ca3af",
                  fontWeight: row.NoOfMinor > 0 ? 700 : 400,
                }}
              >
                {row.NoOfMinor}
              </td>
              <td style={{ ...tdS, fontWeight: 600, color: "#6366f1" }}>
                {row.SampleInspected}
              </td>
              <td style={tdS}>
                <FpqiBadge value={row.FPQI} />
              </td>
              <td style={tdS}>
                <StatusPill fpqi={row.FPQI} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Yearly Table -------------------------------------------------------------
const YearlyFpaReportTable = ({ data }) => {
  if (!data || data.length === 0) return <EmptyState />;
  const sorted = [...data].sort((a, b) => a.Year - b.Year);
  const withTrend = sorted.map((row, i) => {
    const prev = sorted[i - 1];
    let trend = null;
    if (prev && row.FPQI !== null && prev.FPQI !== null) {
      const diff = parseFloat(row.FPQI) - parseFloat(prev.FPQI);
      trend = diff < 0 ? "down" : diff > 0 ? "up" : "flat";
    }
    return { ...row, trend };
  });

  return (
    <div style={tableWrapper}>
      <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
          <tr>
            {[
              "Year",
              "Critical",
              "Major",
              "Minor",
              "Sample Inspected",
              "FPQI",
              "YoY Trend",
              "Status",
            ].map((h) => (
              <th key={h} style={thS}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withTrend.map((row, i) => (
            <tr
              key={i}
              style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#eef2ff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  i % 2 === 0 ? "#fff" : "#fafafa")
              }
            >
              <td
                style={{
                  ...tdS,
                  fontWeight: 800,
                  fontSize: 15,
                  color: "#1e1b4b",
                }}
              >
                {row.Year}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfCritical > 0 ? "#ef4444" : "#9ca3af",
                  fontWeight: row.NoOfCritical > 0 ? 700 : 400,
                }}
              >
                {row.NoOfCritical}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfMajor > 0 ? "#f59e0b" : "#9ca3af",
                  fontWeight: row.NoOfMajor > 0 ? 700 : 400,
                }}
              >
                {row.NoOfMajor}
              </td>
              <td
                style={{
                  ...tdS,
                  color: row.NoOfMinor > 0 ? "#eab308" : "#9ca3af",
                  fontWeight: row.NoOfMinor > 0 ? 700 : 400,
                }}
              >
                {row.NoOfMinor}
              </td>
              <td style={{ ...tdS, fontWeight: 600, color: "#6366f1" }}>
                {row.SampleInspected}
              </td>
              <td style={tdS}>
                <FpqiBadge value={row.FPQI} />
              </td>
              <td style={tdS}>
                {row.trend === "down" && (
                  <span
                    style={{
                      color: "#22c55e",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <MdTrendingDown size={13} /> Improved
                  </span>
                )}
                {row.trend === "up" && (
                  <span
                    style={{
                      color: "#ef4444",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <MdTrendingUp size={13} /> Declined
                  </span>
                )}
                {row.trend === "flat" && (
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <MdTrendingFlat size={13} /> Stable
                  </span>
                )}
                {!row.trend && (
                  <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>
                )}
              </td>
              <td style={tdS}>
                <StatusPill fpqi={row.FPQI} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Main Component -----------------------------------------------------------
const FPAReports = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [reportType, setReportType] = useState("fpaReport");
  const [reportData, setReportData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState("");
  const [lastFetched, setLastFetched] = useState(null);

  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDetails(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Clear on type change
  useEffect(() => {
    setReportData([]);
    setSearchTerm("");
    setDetails("");
    setLastFetched(null);
  }, [reportType]);

  const fetchReport = useCallback(async (type, params) => {
    const endpoints = {
      fpaReport: "quality/fpa-report",
      dailyFpaReport: "quality/fpa-daily-report",
      monthlyFpaReport: "quality/fpa-monthly-report",
      yearlyFpaReport: "quality/fpa-yearly-report",
    };
    const res = await axios.get(`${baseURL}${endpoints[type]}`, { params });
    return normalizeArray(res.data);
  }, []);

  const runQuery = useCallback(
    async (type, params) => {
      setLoading(true);
      setReportData([]);
      try {
        const data = await fetchReport(type, params);
        setReportData(data);
        setLastFetched(new Date());
        if (data.length === 0) toast("No records found.", { icon: "??" });
        else toast.success(`Loaded ${data.length} records`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch report.");
      } finally {
        setLoading(false);
      }
    },
    [fetchReport],
  );

  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select a time range.");
      return;
    }
    const params = { startDate: startTime, endDate: endTime };
    if (reportType === "fpaReport" && selectedModelVariant?.label)
      params.model = selectedModelVariant.label;
    runQuery(reportType, params);
  };

  const handleYesterdayQuery = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1);
    const modelLabel = selectedModelVariant?.label;
    const params = {
      startDate: formatDate(yesterday8AM),
      endDate: formatDate(today8AM),
    };
    if (modelLabel) params.model = modelLabel;
    runQuery("fpaReport", params);
  };

  const handleTodayQuery = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const modelLabel = selectedModelVariant?.label;
    const params = {
      startDate: formatDate(today8AM),
      endDate: formatDate(now),
    };
    if (modelLabel) params.model = modelLabel;
    runQuery("fpaReport", params);
  };

  const handleMTDQuery = () => {
    if (!["fpaReport", "dailyFpaReport"].includes(reportType)) {
      toast.error("MTD is only available for Detail and Daily reports.");
      return;
    }
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    );
    const params = {
      startDate: formatDate(startOfMonth),
      endDate: formatDate(now),
    };
    if (reportType === "fpaReport" && selectedModelVariant?.label)
      params.model = selectedModelVariant.label;
    runQuery(reportType, params);
  };

  // Filtered detail data
  const filteredData = useMemo(() => {
    if (reportType !== "fpaReport" || !Array.isArray(reportData))
      return reportData;
    if (!details) return reportData;
    const q = details.toLowerCase();
    return reportData.filter(
      (item) =>
        item.Model?.toLowerCase().includes(q) ||
        item.FGSRNo?.toLowerCase().includes(q) ||
        item.AddDefect?.toLowerCase().includes(q) ||
        item.Remark?.toLowerCase().includes(q) ||
        item.Country?.toLowerCase().includes(q) ||
        item.Category?.toLowerCase().includes(q) ||
        item.Shift?.toLowerCase().includes(q),
    );
  }, [reportData, details, reportType]);

  const isAggregated = reportType !== "fpaReport";
  const showQuickToday = reportType === "fpaReport";
  const showQuickYesterday = reportType === "fpaReport";
  const showQuickMTD = ["fpaReport", "dailyFpaReport"].includes(reportType);

  if (variantsLoading) return <Loader />;

  return (
    <div
      style={{
        padding: 24,
        background: "#f1f5f9",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* -- Header -- */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)",
          borderRadius: 14,
          padding: "22px 28px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 20px rgba(79,70,229,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: 10,
              padding: 10,
              fontSize: 24,
              color: "#fff",
            }}
          >
            <FaIndustry />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                color: "#fff",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: -0.5,
              }}
            >
              FPA Reports
            </h1>
            <p style={{ margin: 0, color: "#c7d2fe", fontSize: 13 }}>
              Final Product Audit · Quality Intelligence Dashboard
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {lastFetched && (
            <div style={{ color: "#a5b4fc", fontSize: 11, textAlign: "right" }}>
              <div>Last refreshed</div>
              <div style={{ fontWeight: 600, color: "#c7d2fe" }}>
                {lastFetched.toLocaleTimeString()}
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#a5b4fc",
              fontSize: 13,
            }}
          >
            <MdOutlineQueryStats style={{ fontSize: 18 }} />
            FPQI Target:{" "}
            <strong style={{ color: "#fff" }}>&nbsp;= {FPQI_TARGET}</strong>
          </div>
        </div>
      </div>

      {/* -- Filter Panel -- */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            color: "#374151",
          }}
        >
          <FaFilter style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            Filters &amp; Report Type
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          {/* Report Type Tabs */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Report Type
            </div>
            <div
              style={{
                display: "flex",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setReportType(rt.value)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "10px 20px",
                    background:
                      reportType === rt.value ? "#4f46e5" : "transparent",
                    color: reportType === rt.value ? "#fff" : "#6b7280",
                    border: "none",
                    cursor: "pointer",
                    borderRight: "1px solid #e5e7eb",
                    transition: "all 0.15s",
                    minWidth: 80,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{rt.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>
                    {rt.label}
                  </span>
                  <span style={{ fontSize: 9, opacity: 0.8 }}>{rt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6b7280",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Start Time
              </div>
              <DateTimePicker
                label=""
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6b7280",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                End Time
              </div>
              <DateTimePicker
                label=""
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* FPA-only filters */}
          {reportType === "fpaReport" && (
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Model Variant
                </div>
                <SelectField
                  label=""
                  options={variants}
                  value={selectedModelVariant?.value || ""}
                  onChange={(e) =>
                    setSelectedModelVariant(
                      variants.find((o) => o.value === e.target.value) || null,
                    )
                  }
                  className="max-w-56"
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6b7280",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Search
                </div>
                <div style={{ position: "relative" }}>
                  <FaSearch
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#9ca3af",
                      fontSize: 12,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Model, FGSRNO, defect…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      paddingLeft: 30,
                      paddingRight: searchTerm ? 28 : 12,
                      paddingTop: 7,
                      paddingBottom: 7,
                      border: "1px solid #d1d5db",
                      borderRadius: 7,
                      fontSize: 13,
                      outline: "none",
                      width: 200,
                    }}
                  />
                  {searchTerm && (
                    <FaTimes
                      onClick={() => setSearchTerm("")}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#9ca3af",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                onClick={handleQuery}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 20px",
                  background: loading ? "#9ca3af" : "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 2px 8px rgba(79,70,229,0.3)",
                }}
              >
                {loading ? (
                  <FaSync style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <MdOutlineQueryStats />
                )}
                {loading ? "Loading…" : "Query"}
              </button>

              {showQuickYesterday && (
                <button
                  onClick={handleYesterdayQuery}
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "9px 14px",
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  <FaBolt size={10} /> YDAY
                </button>
              )}
              {showQuickToday && (
                <button
                  onClick={handleTodayQuery}
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "9px 14px",
                    background: "#dbeafe",
                    color: "#1e40af",
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  <FaStar size={10} /> TODAY
                </button>
              )}
              {showQuickMTD && (
                <button
                  onClick={handleMTDQuery}
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "9px 14px",
                    background: "#dcfce7",
                    color: "#166534",
                    border: "1px solid #86efac",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  <FaArrowRight size={10} /> MTD
                </button>
              )}
              {reportData.length > 0 && (
                <ExportButton data={reportData} filename="FPA_Report" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -- Loading -- */}
      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <Loader />
          <div style={{ color: "#6b7280", marginTop: 10, fontSize: 13 }}>
            Fetching report data…
          </div>
        </div>
      )}

      {/* -- Data Panel -- */}
      {!loading && reportData.length > 0 && (
        <>
          {/* Summary */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {reportType === "fpaReport" ? (
              <FpaDetailSummary data={filteredData} />
            ) : (
              <AggregateSummary data={reportData} reportType={reportType} />
            )}
          </div>

          {/* Chart (aggregated reports) */}
          {isAggregated && (
            <FpqiTrendChart data={reportData} reportType={reportType} />
          )}

          {/* Analysis panels (detail report) */}
          {reportType === "fpaReport" && reportData.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <TopDefectsPanel data={filteredData} />
              <ModelPerformancePanel data={filteredData} />
            </div>
          )}
          {reportType === "fpaReport" && reportData.length > 0 && (
            <CountryPanel data={filteredData} />
          )}

          {/* Table */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <FaTable style={{ color: "#6366f1" }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                Data Table
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  background: "#eef2ff",
                  color: "#4338ca",
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {reportType === "fpaReport"
                  ? filteredData.length
                  : reportData.length}{" "}
                rows
              </span>
            </div>
            {reportType === "fpaReport" && (
              <FpaReportTable data={filteredData} />
            )}
            {reportType === "dailyFpaReport" && (
              <DailyFpaReportTable data={reportData} />
            )}
            {reportType === "monthlyFpaReport" && (
              <MonthlyFpaReportTable data={reportData} />
            )}
            {reportType === "yearlyFpaReport" && (
              <YearlyFpaReportTable data={reportData} />
            )}
          </div>
        </>
      )}

      {/* -- Empty -- */}
      {!loading && reportData.length === 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <EmptyState />
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default FPAReports;
