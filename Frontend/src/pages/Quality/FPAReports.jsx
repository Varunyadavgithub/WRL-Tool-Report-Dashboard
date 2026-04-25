import { useEffect, useState, useMemo, useCallback } from "react";
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
import DateTimePicker from "../../components/ui/DateTimePicker";
import SelectField from "../../components/ui/SelectField";
import ExportButton from "../../components/ui/ExportButton";
import Loader from "../../components/ui/Loader";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import {
  Search,
  Loader2,
  PackageOpen,
  Calendar,
  Filter,
  X,
  Clock,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
  Zap,
  Star,
  ArrowUp,
  ArrowDown,
  Table2,
  Download,
  Eye,
  RefreshCw,
  Shield,
  Trophy,
  Flame,
  Percent,
  Factory,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Activity,
  ChevronRight,
  Gauge,
  FileText,
  BarChart2,
  LineChart,
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
const FPQI_TARGET = 2.2;

const REPORT_TYPES = [
  {
    value: "fpaReport",
    label: "Detail",
    icon: ClipboardList,
    desc: "Full audit records",
  },
  {
    value: "dailyFpaReport",
    label: "Daily",
    icon: Calendar,
    desc: "Day-wise summary",
  },
  {
    value: "monthlyFpaReport",
    label: "Monthly",
    icon: BarChart3,
    desc: "Month aggregation",
  },
  {
    value: "yearlyFpaReport",
    label: "Yearly",
    icon: LineChart,
    desc: "Year-over-year",
  },
];

const CATEGORY_CONFIG = {
  critical: {
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  major: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  minor: {
    text: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
  },
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

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── Helpers ────────────────────────────────────────────────────────────────────
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

/* ── Quick filter button ── */
const QuickBtn = ({ label, sublabel, loading, onClick, colorClass }) => (
  <button
    disabled={loading}
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center gap-0.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
      loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : colorClass
    }`}
  >
    {loading ? (
      <span className="flex items-center gap-2">
        <Spinner /> Loading...
      </span>
    ) : (
      <>
        <span className="text-[15px] font-bold tracking-widest">{label}</span>
        <span className="text-[10px] opacity-75 font-normal">{sublabel}</span>
      </>
    )}
  </button>
);

// ─── FPQI Badge ─────────────────────────────────────────────────────────────────
const FpqiBadge = ({ value }) => {
  if (value === null || value === undefined)
    return <span className="text-slate-400">—</span>;
  const ok = getFpqiStatus(value) === "good";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
        ok
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5" />
      )}
      {Number(value).toFixed(3)}
    </span>
  );
};

// ─── Category Badge ─────────────────────────────────────────────────────────────
const CategoryBadge = ({ category }) => {
  const cfg = CATEGORY_CONFIG[category] || {};
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
        cfg.bg || "bg-slate-100"
      } ${cfg.text || "text-slate-600"} ${cfg.border || "border-slate-200"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dot || "bg-slate-400"}`}
      />
      {category}
    </span>
  );
};

// ─── Status Pill ────────────────────────────────────────────────────────────────
const StatusPill = ({ fpqi }) => {
  const ok = getFpqiStatus(fpqi) === "good";
  return ok ? (
    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
      <CheckCircle2 className="w-3 h-3" /> Pass
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-700 font-semibold text-[11px]">
      <XCircle className="w-3 h-3" /> Fail
    </span>
  );
};

// ─── Defect Bar ─────────────────────────────────────────────────────────────────
const DefectBar = ({ critical, major, minor }) => {
  const total = critical + major + minor;
  if (total === 0) return null;
  const pct = (n) => ((n / total) * 100).toFixed(1);
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
        Defect Breakdown — {total} total
      </p>
      <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
        {critical > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center"
            style={{ flex: critical }}
          >
            <span className="text-[9px] text-white font-bold">
              {pct(critical)}%
            </span>
          </div>
        )}
        {major > 0 && (
          <div
            className="bg-amber-500 flex items-center justify-center"
            style={{ flex: major }}
          >
            <span className="text-[9px] text-white font-bold">
              {pct(major)}%
            </span>
          </div>
        )}
        {minor > 0 && (
          <div
            className="bg-yellow-500 flex items-center justify-center"
            style={{ flex: minor }}
          >
            <span className="text-[9px] text-white font-bold">
              {pct(minor)}%
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-4 mt-1.5 text-[11px] text-slate-500">
        <span>
          <span className="text-red-500 font-bold">●</span> Critical {critical}
        </span>
        <span>
          <span className="text-amber-500 font-bold">●</span> Major {major}
        </span>
        <span>
          <span className="text-yellow-500 font-bold">●</span> Minor {minor}
        </span>
      </div>
    </div>
  );
};

// ─── KPI Stat Badge (for sub-header) ────────────────────────────────────────────
const HeaderBadge = ({ value, label, colorClass }) => (
  <div
    className={`flex flex-col items-center px-4 py-1.5 rounded-lg border min-w-[90px] ${colorClass}`}
  >
    <span className="text-xl font-bold font-mono">{value}</span>
    <span className="text-[10px] font-medium uppercase tracking-wide">
      {label}
    </span>
  </div>
);

// ─── KPI Card (inside data panel) ───────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, accentColor, sub }) => (
  <div
    className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center gap-3 flex-1 min-w-[140px]"
    style={{ borderTopColor: accentColor, borderTopWidth: 3 }}
  >
    <div
      className="p-2 rounded-lg"
      style={{ background: `${accentColor}15`, color: accentColor }}
    >
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
        {value}
      </p>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
        {label}
      </p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── FPA Detail Summary ─────────────────────────────────────────────────────────
const FpaDetailSummary = ({ data }) => {
  if (!data || data.length === 0) return null;
  const critical = data.filter((r) => r.Category === "critical").length;
  const major = data.filter((r) => r.Category === "major").length;
  const minor = data.filter((r) => r.Category === "minor").length;
  const samples = new Set(data.map((r) => r.FGSRNo)).size;
  const fpqi = calcFpqi(critical, major, minor, samples);
  const defectRate =
    samples > 0
      ? (((critical + major + minor) / data.length) * 100).toFixed(1)
      : null;

  return (
    <div>
      <div className="flex flex-wrap gap-2.5 mb-3">
        <KpiCard
          icon={ClipboardList}
          label="Total Records"
          value={data.length}
          accentColor="#6366f1"
        />
        <KpiCard
          icon={Factory}
          label="FG Serial Nos"
          value={samples}
          accentColor="#8b5cf6"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Critical"
          value={critical}
          accentColor="#ef4444"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Major"
          value={major}
          accentColor="#f59e0b"
        />
        <KpiCard
          icon={Info}
          label="Minor"
          value={minor}
          accentColor="#eab308"
        />
        <KpiCard
          icon={Gauge}
          label="FPQI Score"
          value={fpqi !== null ? Number(fpqi).toFixed(3) : "—"}
          accentColor={
            fpqi !== null && fpqi <= FPQI_TARGET ? "#10b981" : "#ef4444"
          }
          sub={`Target ≤ ${FPQI_TARGET}`}
        />
        {defectRate && (
          <KpiCard
            icon={Percent}
            label="Defect Rate"
            value={`${defectRate}%`}
            accentColor="#6366f1"
          />
        )}
      </div>
      <DefectBar critical={critical} major={major} minor={minor} />
    </div>
  );
};

// ─── Aggregate Summary ──────────────────────────────────────────────────────────
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
    <div>
      <div className="flex flex-wrap gap-2.5 mb-3">
        <KpiCard
          icon={AlertTriangle}
          label="Total Critical"
          value={totalCritical}
          accentColor="#ef4444"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Total Major"
          value={totalMajor}
          accentColor="#f59e0b"
        />
        <KpiCard
          icon={Info}
          label="Total Minor"
          value={totalMinor}
          accentColor="#eab308"
        />
        <KpiCard
          icon={Factory}
          label="Total Samples"
          value={totalSamples}
          accentColor="#6366f1"
        />
        <KpiCard
          icon={Gauge}
          label="Avg FPQI"
          value={avgFpqi !== null ? Number(avgFpqi).toFixed(3) : "—"}
          accentColor={
            avgFpqi !== null && avgFpqi <= FPQI_TARGET ? "#10b981" : "#ef4444"
          }
          sub={`Target ≤ ${FPQI_TARGET}`}
        />
        <KpiCard
          icon={Trophy}
          label="Pass Rate"
          value={`${passRate}%`}
          accentColor="#10b981"
          sub={`${passCount} pass / ${failCount} fail`}
        />
      </div>
      <DefectBar
        critical={totalCritical}
        major={totalMajor}
        minor={totalMinor}
      />
      {(best || worst) && (
        <div className="flex gap-2.5 flex-wrap">
          {best && (
            <div className="flex-1 min-w-[200px] bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Best Period
              </p>
              <p className="font-bold text-slate-900">{getPeriodLabel(best)}</p>
              <p className="text-xs text-emerald-700">
                FPQI: {Number(best.FPQI).toFixed(3)}
              </p>
            </div>
          )}
          {worst && worst !== best && (
            <div className="flex-1 min-w-[200px] bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Worst Period
              </p>
              <p className="font-bold text-slate-900">
                {getPeriodLabel(worst)}
              </p>
              <p className="text-xs text-red-700">
                FPQI: {Number(worst.FPQI).toFixed(3)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Top Defects Panel ──────────────────────────────────────────────────────────
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-red-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Top Defect Types
        </span>
        <span className="ml-auto text-[11px] text-slate-400">by frequency</span>
      </div>
      <div className="flex flex-col gap-2">
        {top.map(([defect, count], i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className={`w-5 h-5 rounded-md text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                i === 0
                  ? "bg-red-100 text-red-600"
                  : i === 1
                    ? "bg-amber-100 text-amber-600"
                    : "bg-indigo-100 text-indigo-600"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-0.5">
                <span className="text-xs text-slate-700 font-medium truncate">
                  {defect}
                </span>
                <span className="text-[11px] font-bold text-slate-700 ml-2 shrink-0">
                  {count}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    i === 0
                      ? "bg-red-500"
                      : i === 1
                        ? "bg-amber-500"
                        : "bg-indigo-500"
                  }`}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Model Performance Panel ────────────────────────────────────────────────────
const ModelPerformancePanel = ({ data }) => {
  if (!data || data.length === 0) return null;
  const models = {};
  data.forEach((r) => {
    if (!r.Model) return;
    if (!models[r.Model])
      models[r.Model] = { critical: 0, major: 0, minor: 0, fgsrNos: new Set() };
    if (r.Category === "critical") models[r.Model].critical++;
    else if (r.Category === "major") models[r.Model].major++;
    else if (r.Category === "minor") models[r.Model].minor++;
    if (r.FGSRNo) models[r.Model].fgsrNos.add(r.FGSRNo);
  });

  const rows = Object.entries(models)
    .map(([model, d]) => {
      const samples = d.fgsrNos.size;
      return {
        model,
        ...d,
        samples,
        fpqi: calcFpqi(d.critical, d.major, d.minor, samples),
      };
    })
    .sort((a, b) => (a.fpqi ?? 999) - (b.fpqi ?? 999));

  if (rows.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-indigo-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Model Performance
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-100">
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
                  className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
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
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
              >
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800 text-center">
                  {row.model}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center text-indigo-600 font-semibold">
                  {row.samples}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.critical > 0 ? "text-red-500" : "text-slate-300"}`}
                >
                  {row.critical}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.major > 0 ? "text-amber-500" : "text-slate-300"}`}
                >
                  {row.major}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.minor > 0 ? "text-yellow-500" : "text-slate-300"}`}
                >
                  {row.minor}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  <FpqiBadge value={row.fpqi} />
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
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

// ─── Country Panel ──────────────────────────────────────────────────────────────
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
    if (r.Category === "critical") countries[r.Country].critical++;
    else if (r.Category === "major") countries[r.Country].major++;
    else if (r.Category === "minor") countries[r.Country].minor++;
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Factory className="w-4 h-4 text-violet-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Destination Country Analysis
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map((row, i) => {
          const ok = getFpqiStatus(row.fpqi) === "good";
          return (
            <div
              key={i}
              className={`flex-1 min-w-[160px] rounded-lg px-3.5 py-2.5 border ${
                ok
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="font-bold text-sm text-slate-900 mb-0.5">
                {row.country}
              </p>
              <p className="text-[11px] text-slate-500 mb-1.5">
                {row.samples} inspected
              </p>
              <FpqiBadge value={row.fpqi} />
              <div className="flex gap-2 mt-1.5 text-[10px] text-slate-500">
                <span className="text-red-500">C:{row.critical}</span>
                <span className="text-amber-500">M:{row.major}</span>
                <span className="text-yellow-500">m:{row.minor}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── FPQI Trend Chart ───────────────────────────────────────────────────────────
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
        : sorted.map((i) => String(i.Year));

  const isLine = reportType === "dailyFpaReport";
  const goodColors = sorted.map((i) =>
    getFpqiStatus(i.FPQI) === "good" ? CHART_COLORS.good : CHART_COLORS.bad,
  );

  const chartData = {
    labels,
    datasets: [
      {
        type: isLine ? "line" : "bar",
        label: "FPQI",
        data: sorted.map((i) => i.FPQI),
        backgroundColor: isLine ? "rgba(99,102,241,0.08)" : goodColors,
        borderColor: isLine ? "#6366f1" : goodColors,
        borderWidth: isLine ? 2.5 : 1.5,
        tension: 0.4,
        fill: isLine,
        pointBackgroundColor: goodColors,
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
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#6b7280",
          font: { size: 11 },
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <LineChart className="w-4 h-4 text-indigo-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          {reportType === "dailyFpaReport"
            ? "Daily"
            : reportType === "monthlyFpaReport"
              ? "Monthly"
              : "Yearly"}{" "}
          FPQI Trend
        </span>
      </div>
      <div className="flex flex-wrap gap-3 mb-3">
        {[
          ["#6366f1", "FPQI"],
          ["#22c55e", `Target ${FPQI_TARGET}`, true],
          ["#ef4444", "Critical"],
          ["#f59e0b", "Major"],
          ["#eab308", "Minor"],
        ].map(([c, l, dashed], i) => (
          <span
            key={i}
            className="flex items-center gap-1 text-[11px] text-slate-500"
          >
            <span
              className={`w-3.5 rounded-sm inline-block ${dashed ? "h-0.5 border-t-2 border-dashed" : "h-2.5"}`}
              style={{
                background: dashed ? "transparent" : c,
                borderColor: dashed ? c : undefined,
              }}
            />
            {l}
          </span>
        ))}
      </div>
      <div className="relative h-80">
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
};

// ─── FPA Detail Table ───────────────────────────────────────────────────────────
const FpaReportTable = ({ data }) => {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [catFilter, setCatFilter] = useState("All");

  const handleDownloadImage = async (fgSrNo, fileName) => {
    if (!fgSrNo || !fileName) {
      toast.error("No image available.");
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
        toast.error("File is empty.");
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
      if (err.response?.status === 404) toast.error("File not found.");
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
      const av = a[sort.key],
        bv = b[sort.key];
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

  if (!data || data.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 mb-2.5 items-center flex-wrap">
        <span className="text-[11px] font-semibold text-slate-400">
          Category:
        </span>
        {["All", "critical", "major", "minor"].map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
              catFilter === cat
                ? cat === "critical"
                  ? "bg-red-500 text-white"
                  : cat === "major"
                    ? "bg-amber-500 text-white"
                    : cat === "minor"
                      ? "bg-yellow-500 text-white"
                      : "bg-indigo-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat}{" "}
            {cat !== "All" &&
              `(${data.filter((r) => r.Category === cat).length})`}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          {sorted.length} of {data.length} records
        </span>
      </div>
      <table className="min-w-[1200px] w-full text-xs text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
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
                className={`px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap ${key ? "cursor-pointer hover:text-blue-600" : ""}`}
                onClick={() => key && toggleSort(key)}
              >
                <span className="flex items-center gap-1">
                  {label}
                  {sort.key === key &&
                    (sort.dir === "asc" ? (
                      <ArrowUp className="w-2.5 h-2.5" />
                    ) : (
                      <ArrowDown className="w-2.5 h-2.5" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
            >
              <td className="px-3 py-2 border-b border-slate-100 font-mono text-indigo-600 font-bold whitespace-nowrap">
                {row.SRNo}
              </td>
              <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                {row.Date
                  ? row.Date.replace("T", " ").replace("Z", "").slice(0, 19)
                  : "—"}
              </td>
              <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800 whitespace-nowrap">
                {row.Model}
              </td>
              <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                {row.Shift}
              </td>
              <td className="px-3 py-2 border-b border-slate-100 font-bold font-mono text-slate-700 whitespace-nowrap">
                {row.FGSRNo}
              </td>
              <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                {row.Country}
              </td>
              <td className="px-3 py-2 border-b border-slate-100">
                <CategoryBadge category={row.Category} />
              </td>
              <td
                className="px-3 py-2 border-b border-slate-100 text-slate-600 max-w-[200px] truncate"
                title={row.AddDefect}
              >
                {row.AddDefect}
              </td>
              <td
                className="px-3 py-2 border-b border-slate-100 text-slate-600 max-w-[160px] truncate"
                title={row.Remark}
              >
                {row.Remark}
              </td>
              <td className="px-3 py-2 border-b border-slate-100">
                {row.DefectImage ? (
                  <button
                    onClick={() =>
                      handleDownloadImage(row.FGSRNo, row.DefectImage)
                    }
                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-md px-2.5 py-1 text-[11px] font-semibold hover:bg-indigo-100 transition-colors"
                  >
                    <Download className="w-2.5 h-2.5" /> Download
                  </button>
                ) : (
                  <span className="text-slate-300 text-[11px]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

// ─── Daily Table ────────────────────────────────────────────────────────────────
const DailyFpaReportTable = ({ data }) => {
  if (!data || data.length === 0) return null;
  const sorted = [...data].sort(
    (a, b) => new Date(a.ShiftDate) - new Date(b.ShiftDate),
  );
  return (
    <table className="min-w-[900px] w-full text-xs text-left border-separate border-spacing-0">
      <thead className="sticky top-0 z-10">
        <tr className="bg-slate-100">
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
            <th
              key={h}
              className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => (
          <tr
            key={i}
            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
          >
            <td className="px-3 py-2 border-b border-slate-100 font-mono font-semibold text-slate-700 text-center whitespace-nowrap">
              {row.ShiftDate?.slice(0, 10) || "—"}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-slate-600 text-center">
              {row.Month}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfCritical > 0 ? "text-red-500" : "text-slate-300"}`}
            >
              {row.NoOfCritical}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfMajor > 0 ? "text-amber-500" : "text-slate-300"}`}
            >
              {row.NoOfMajor}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfMinor > 0 ? "text-yellow-500" : "text-slate-300"}`}
            >
              {row.NoOfMinor}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center font-semibold text-indigo-600">
              {row.SampleInspected}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center">
              <FpqiBadge value={row.FPQI} />
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center">
              <StatusPill fpqi={row.FPQI} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── Monthly Table ──────────────────────────────────────────────────────────────
const MonthlyFpaReportTable = ({ data }) => {
  if (!data || data.length === 0) return null;
  const sorted = [...data].sort((a, b) =>
    a.MonthKey?.localeCompare(b.MonthKey),
  );
  return (
    <table className="min-w-[900px] w-full text-xs text-left border-separate border-spacing-0">
      <thead className="sticky top-0 z-10">
        <tr className="bg-slate-100">
          {[
            "Month",
            "Period",
            "Critical",
            "Major",
            "Minor",
            "Sample Inspected",
            "FPQI",
            "Status",
          ].map((h) => (
            <th
              key={h}
              className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => (
          <tr
            key={i}
            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
          >
            <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800 text-center">
              {row.Month}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 text-center">
              {row.MonthKey}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfCritical > 0 ? "text-red-500" : "text-slate-300"}`}
            >
              {row.NoOfCritical}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfMajor > 0 ? "text-amber-500" : "text-slate-300"}`}
            >
              {row.NoOfMajor}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfMinor > 0 ? "text-yellow-500" : "text-slate-300"}`}
            >
              {row.NoOfMinor}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center font-semibold text-indigo-600">
              {row.SampleInspected}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center">
              <FpqiBadge value={row.FPQI} />
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center">
              <StatusPill fpqi={row.FPQI} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── Yearly Table ───────────────────────────────────────────────────────────────
const YearlyFpaReportTable = ({ data }) => {
  if (!data || data.length === 0) return null;
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
    <table className="min-w-[900px] w-full text-xs text-left border-separate border-spacing-0">
      <thead className="sticky top-0 z-10">
        <tr className="bg-slate-100">
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
            <th
              key={h}
              className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {withTrend.map((row, i) => (
          <tr
            key={i}
            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
          >
            <td className="px-3 py-2 border-b border-slate-100 font-extrabold text-[15px] text-slate-900 text-center">
              {row.Year}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfCritical > 0 ? "text-red-500" : "text-slate-300"}`}
            >
              {row.NoOfCritical}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfMajor > 0 ? "text-amber-500" : "text-slate-300"}`}
            >
              {row.NoOfMajor}
            </td>
            <td
              className={`px-3 py-2 border-b border-slate-100 text-center font-bold ${row.NoOfMinor > 0 ? "text-yellow-500" : "text-slate-300"}`}
            >
              {row.NoOfMinor}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center font-semibold text-indigo-600">
              {row.SampleInspected}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center">
              <FpqiBadge value={row.FPQI} />
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center">
              {row.trend === "down" && (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                  <TrendingDown className="w-3 h-3" /> Improved
                </span>
              )}
              {row.trend === "up" && (
                <span className="inline-flex items-center gap-1 text-red-500 font-semibold text-[11px]">
                  <TrendingUp className="w-3 h-3" /> Declined
                </span>
              )}
              {row.trend === "flat" && (
                <span className="inline-flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                  <Minus className="w-3 h-3" /> Stable
                </span>
              )}
              {!row.trend && (
                <span className="text-slate-300 text-[11px]">—</span>
              )}
            </td>
            <td className="px-3 py-2 border-b border-slate-100 text-center">
              <StatusPill fpqi={row.FPQI} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
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

  useEffect(() => {
    const t = setTimeout(() => setDetails(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

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
        if (data.length === 0) toast.error("No records found.");
        else toast.success(`Loaded ${data.length} records`);
      } catch {
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

  const handleYesterday = () => {
    const now = new Date();
    const t8 = new Date(now);
    t8.setHours(8, 0, 0, 0);
    const y8 = new Date(t8);
    y8.setDate(t8.getDate() - 1);
    const params = { startDate: formatDate(y8), endDate: formatDate(t8) };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
    runQuery("fpaReport", params);
  };

  const handleToday = () => {
    const now = new Date();
    const t8 = new Date(now);
    t8.setHours(8, 0, 0, 0);
    const params = { startDate: formatDate(t8), endDate: formatDate(now) };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
    runQuery("fpaReport", params);
  };

  const handleMTD = () => {
    if (!["fpaReport", "dailyFpaReport"].includes(reportType)) {
      toast.error("MTD only available for Detail and Daily.");
      return;
    }
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    const params = { startDate: formatDate(s), endDate: formatDate(now) };
    if (reportType === "fpaReport" && selectedModelVariant?.label)
      params.model = selectedModelVariant.label;
    runQuery(reportType, params);
  };

  const filteredData = useMemo(() => {
    if (reportType !== "fpaReport" || !Array.isArray(reportData))
      return reportData;
    if (!details) return reportData;
    const q = details.toLowerCase();
    return reportData.filter((item) =>
      [
        item.Model,
        item.FGSRNo,
        item.AddDefect,
        item.Remark,
        item.Country,
        item.Category,
        item.Shift,
      ].some((v) => v?.toString().toLowerCase().includes(q)),
    );
  }, [reportData, details, reportType]);

  const isAggregated = reportType !== "fpaReport";
  const showQuickToday = reportType === "fpaReport";
  const showQuickYesterday = reportType === "fpaReport";
  const showQuickMTD = ["fpaReport", "dailyFpaReport"].includes(reportType);

  if (variantsLoading) return <Loader />;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page sub-header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            FPA Reports
          </h1>
          <p className="text-[11px] text-slate-400">
            Final Product Audit · Quality Intelligence · FPQI Target ≤{" "}
            {FPQI_TARGET}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reportData.length > 0 && (
            <HeaderBadge
              value={reportData.length}
              label="Records"
              colorClass="bg-blue-50 text-blue-700 border-blue-100"
            />
          )}
          {lastFetched && (
            <div className="text-right ml-2">
              <p className="text-[10px] text-slate-400">Refreshed</p>
              <p className="text-xs font-semibold text-slate-600">
                {lastFetched.toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto flex flex-col p-4 gap-3">
        {/* ── Filters + Quick row ── */}
        <div className="flex gap-3 shrink-0">
          {/* Filters card */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Filters & Report Type
            </p>

            {/* Report type tabs */}
            <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mb-3 w-fit">
              {REPORT_TYPES.map((rt) => {
                const Icon = rt.icon;
                return (
                  <button
                    key={rt.value}
                    onClick={() => setReportType(rt.value)}
                    className={`flex flex-col items-center gap-0.5 px-5 py-2.5 border-r border-slate-200 last:border-r-0 transition-all min-w-[80px] ${
                      reportType === rt.value
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold">{rt.label}</span>
                    <span className="text-[9px] opacity-75">{rt.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[185px] flex-1">
                <DateTimePicker
                  label="Start Time"
                  name="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="min-w-[185px] flex-1">
                <DateTimePicker
                  label="End Time"
                  name="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>

              {reportType === "fpaReport" && (
                <>
                  <div className="min-w-[190px] flex-1">
                    <SelectField
                      label="Model Variant"
                      options={variants}
                      value={selectedModelVariant?.value || ""}
                      onChange={(e) =>
                        setSelectedModelVariant(
                          variants.find((o) => o.value === e.target.value) ||
                            null,
                        )
                      }
                    />
                  </div>
                  <div className="min-w-[180px] flex-1">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1 block">
                      <Search className="w-3 h-3" /> Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="Model, FGSRNO, defect..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-lg text-sm placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 pb-0.5 shrink-0">
                <button
                  onClick={handleQuery}
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
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? "Fetching..." : "Query"}
                </button>
                {reportData.length > 0 && (
                  <ExportButton data={reportData} filename="FPA_Report" />
                )}
              </div>
            </div>
          </div>

          {/* Quick filters card */}
          <div className="w-60 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
              Quick Filters
            </p>
            <p className="text-[10px] text-slate-400 mb-3">
              Pre-defined time ranges.
            </p>
            <div className="flex flex-col gap-2">
              {showQuickYesterday && (
                <QuickBtn
                  label="YESTERDAY"
                  sublabel="Prev day 08:00 → today 08:00"
                  loading={loading}
                  onClick={handleYesterday}
                  colorClass="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                />
              )}
              {showQuickToday && (
                <QuickBtn
                  label="TODAY"
                  sublabel="08:00 → now"
                  loading={loading}
                  onClick={handleToday}
                  colorClass="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                />
              )}
              {showQuickMTD && (
                <QuickBtn
                  label="MTD"
                  sublabel="Month to date"
                  loading={loading}
                  onClick={handleMTD}
                  colorClass="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center py-16 gap-2 text-blue-600">
            <Spinner cls="w-5 h-5" />
            <span className="text-sm">Fetching report data...</span>
          </div>
        )}

        {/* ── Data Panels ── */}
        {!loading && reportData.length > 0 && (
          <>
            {/* Summary KPIs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> Summary
                </span>
              </div>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
                <TopDefectsPanel data={filteredData} />
                <ModelPerformancePanel data={filteredData} />
              </div>
            )}

            {reportType === "fpaReport" && reportData.length > 0 && (
              <CountryPanel data={filteredData} />
            )}

            {/* Data Table */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
              {/* Section header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <Table2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Data Table
                  </span>
                </div>
                <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full border border-indigo-100 font-bold">
                  {reportType === "fpaReport"
                    ? filteredData.length
                    : reportData.length}{" "}
                  rows
                </span>
              </div>

              {/* Table body */}
              <div className="flex-1 overflow-auto min-w-0">
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
            </div>
          </>
        )}

        {/* ── Empty State ── */}
        {!loading && reportData.length === 0 && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-slate-400 py-16">
            <PackageOpen className="w-12 h-12 opacity-20" strokeWidth={1.2} />
            <p className="text-sm font-bold text-slate-600">No data found</p>
            <p className="text-xs text-slate-400">
              Adjust your filters and click Query
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FPAReports;
