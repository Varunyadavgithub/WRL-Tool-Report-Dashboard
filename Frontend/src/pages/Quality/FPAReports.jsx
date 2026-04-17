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
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import Loader from "../../components/ui/Loader";
import {
  Factory,
  Filter,
  Calendar,
  ChevronRight,
  Search,
  X,
  Download,
  RefreshCw,
  Zap,
  Clock,
  Star,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Table2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Shield,
  Trophy,
  Flame,
  Percent,
  Gauge,
  ClipboardList,
  Globe,
  PackageOpen,
  Loader2,
  ChartLine,
  CalendarDays,
  Target,
  FileText,
  Boxes,
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

// ─── Constants ─────────────────────────────────────────────────────────────────

const FPQI_TARGET = 2.2;

const REPORT_TYPES = [
  { value: "fpaReport", label: "Detail", desc: "Full records" },
  { value: "dailyFpaReport", label: "Daily", desc: "Day-wise summary" },
  { value: "monthlyFpaReport", label: "Monthly", desc: "Month aggregation" },
  { value: "yearlyFpaReport", label: "Yearly", desc: "Year-over-year" },
];

const CATEGORY_CONFIG = {
  Critical: {
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  Major: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  Minor: {
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
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

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

// ─── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── FpqiBadge ─────────────────────────────────────────────────────────────────
const FpqiBadge = ({ value }) => {
  if (value === null || value === undefined)
    return <span className="text-slate-400">—</span>;
  const ok = getFpqiStatus(value) === "good";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
        ok
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-rose-50 text-rose-800 border-rose-200"
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

// ─── CategoryBadge ─────────────────────────────────────────────────────────────
const CategoryBadge = ({ category }) => {
  const cfg = CATEGORY_CONFIG[category] || {};
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg || "bg-slate-50"} ${cfg.text || "text-slate-700"} ${cfg.border || "border-slate-200"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dot || "bg-slate-400"}`}
      />
      {category}
    </span>
  );
};

// ─── StatusPill ────────────────────────────────────────────────────────────────
const StatusPill = ({ fpqi }) => {
  const ok = getFpqiStatus(fpqi) === "good";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
        ok ? "text-emerald-700" : "text-rose-700"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {ok ? "Pass" : "Fail"}
    </span>
  );
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({
  icon: Icon,
  label,
  value,
  colorClass,
  borderColor,
  sub,
  trend,
}) => (
  <div
    className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[140px]`}
    style={{ borderTopWidth: 3, borderTopColor: borderColor }}
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${borderColor}18`, color: borderColor }}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
        {value}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
    {trend && (
      <div className="ml-auto shrink-0">
        {trend === "up" && <ArrowUp className="w-3.5 h-3.5 text-rose-500" />}
        {trend === "down" && (
          <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
        )}
        {trend === "flat" && <Minus className="w-3.5 h-3.5 text-slate-400" />}
      </div>
    )}
  </div>
);

// ─── DefectBar ─────────────────────────────────────────────────────────────────
const DefectBar = ({ critical, major, minor }) => {
  const total = critical + major + minor;
  if (total === 0) return null;
  const pct = (n) => ((n / total) * 100).toFixed(1);
  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
        Defect Breakdown — {total} total
      </div>
      <div className="flex h-5 rounded-lg overflow-hidden gap-0.5">
        {critical > 0 && (
          <div
            className="bg-rose-500 flex items-center justify-center"
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
          <span className="text-rose-500 font-bold">●</span> Critical {critical}
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

// ─── FPA Detail Summary ───────────────────────────────────────────────────────
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
    <div>
      <div className="flex flex-wrap gap-2.5 mb-3">
        <KpiCard
          icon={ClipboardList}
          label="Total Records"
          value={data.length}
          borderColor="#6366f1"
        />
        <KpiCard
          icon={Factory}
          label="Unique FGSRNos"
          value={samples}
          borderColor="#8b5cf6"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Critical"
          value={critical}
          borderColor="#ef4444"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Major"
          value={major}
          borderColor="#f59e0b"
        />
        <KpiCard
          icon={Info}
          label="Minor"
          value={minor}
          borderColor="#eab308"
        />
        <KpiCard
          icon={Gauge}
          label="FPQI Score"
          value={fpqi !== null ? Number(fpqi).toFixed(3) : "—"}
          borderColor={
            fpqi !== null && fpqi <= FPQI_TARGET ? "#10b981" : "#ef4444"
          }
          sub={`Target ≤ ${FPQI_TARGET}`}
        />
        {defectRate && (
          <KpiCard
            icon={Percent}
            label="Defect Rate"
            value={`${defectRate}%`}
            borderColor="#6366f1"
          />
        )}
      </div>
      <DefectBar critical={critical} major={major} minor={minor} />
    </div>
  );
};

// ─── Aggregate Summary ────────────────────────────────────────────────────────
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
          borderColor="#ef4444"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Total Major"
          value={totalMajor}
          borderColor="#f59e0b"
        />
        <KpiCard
          icon={Info}
          label="Total Minor"
          value={totalMinor}
          borderColor="#eab308"
        />
        <KpiCard
          icon={Factory}
          label="Total Samples"
          value={totalSamples}
          borderColor="#6366f1"
        />
        <KpiCard
          icon={Gauge}
          label="Avg FPQI"
          value={avgFpqi !== null ? Number(avgFpqi).toFixed(3) : "—"}
          borderColor={
            avgFpqi !== null && avgFpqi <= FPQI_TARGET ? "#10b981" : "#ef4444"
          }
          sub={`Target ≤ ${FPQI_TARGET}`}
        />
        <KpiCard
          icon={Trophy}
          label="Pass Rate"
          value={`${passRate}%`}
          borderColor="#10b981"
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
            <div className="flex-1 min-w-[200px] bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">
                ✅ Best Period
              </div>
              <div className="font-bold text-slate-900">
                {getPeriodLabel(best)}
              </div>
              <div className="text-xs text-emerald-700">
                FPQI: {Number(best.FPQI).toFixed(3)}
              </div>
            </div>
          )}
          {worst && worst !== best && (
            <div className="flex-1 min-w-[200px] bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wide mb-1">
                ❌ Worst Period
              </div>
              <div className="font-bold text-slate-900">
                {getPeriodLabel(worst)}
              </div>
              <div className="text-xs text-rose-700">
                FPQI: {Number(worst.FPQI).toFixed(3)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Top Defects Panel ────────────────────────────────────────────────────────
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
        <Flame className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Top Defect Types
        </span>
        <span className="ml-auto text-[11px] text-slate-400">by frequency</span>
      </div>
      <div className="flex flex-col gap-2">
        {top.map(([defect, count], i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                i === 0
                  ? "bg-rose-100 text-rose-600"
                  : i === 1
                    ? "bg-amber-100 text-amber-600"
                    : "bg-blue-100 text-blue-600"
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
                      ? "bg-rose-500"
                      : i === 1
                        ? "bg-amber-500"
                        : "bg-blue-500"
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

// ─── Model Performance Panel ──────────────────────────────────────────────────
const ModelPerformancePanel = ({ data }) => {
  if (!data || data.length === 0) return null;
  const models = {};
  data.forEach((r) => {
    if (!r.Model) return;
    if (!models[r.Model])
      models[r.Model] = { critical: 0, major: 0, minor: 0, fgsrNos: new Set() };
    if (r.Category === "Critical") models[r.Model].critical++;
    else if (r.Category === "Major") models[r.Model].major++;
    else if (r.Category === "Minor") models[r.Model].minor++;
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
        <Shield className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Model Performance
        </span>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
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
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
              >
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.model}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-blue-600">
                  {row.samples}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 ${row.critical > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}
                >
                  {row.critical}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 ${row.major > 0 ? "font-bold text-amber-600" : "text-slate-400"}`}
                >
                  {row.major}
                </td>
                <td
                  className={`px-3 py-2 border-b border-slate-100 ${row.minor > 0 ? "font-bold text-yellow-600" : "text-slate-400"}`}
                >
                  {row.minor}
                </td>
                <td className="px-3 py-2 border-b border-slate-100">
                  <FpqiBadge value={row.fpqi} />
                </td>
                <td className="px-3 py-2 border-b border-slate-100">
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

// ─── Country Analysis Panel ───────────────────────────────────────────────────
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          Destination Country Analysis
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {rows.map((row, i) => {
          const ok = getFpqiStatus(row.fpqi) === "good";
          return (
            <div
              key={i}
              className={`flex-1 min-w-[160px] rounded-xl px-4 py-3 border ${
                ok
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-rose-50 border-rose-200"
              }`}
            >
              <div className="font-bold text-slate-900 text-sm mb-1">
                {row.country}
              </div>
              <div className="text-[11px] text-slate-500 mb-1.5">
                {row.samples} inspected
              </div>
              <FpqiBadge value={row.fpqi} />
              <div className="flex gap-2 mt-1.5 text-[10px] text-slate-500">
                <span className="text-rose-500">C:{row.critical}</span>
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

// ─── FPQI Trend Chart ─────────────────────────────────────────────────────────
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
        backgroundColor: "#fff",
        titleColor: "#475569",
        bodyColor: "#1e293b",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            if (
              ctx.dataset.label === "FPQI" ||
              ctx.dataset.label === `Target (${FPQI_TARGET})`
            )
              return ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(3)}`;
            return ` ${ctx.dataset.label}: ${ctx.raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#94a3b8",
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
          font: { weight: "bold", size: 11 },
        },
        grid: { color: "rgba(148,163,184,0.15)" },
        ticks: { color: "#94a3b8", callback: (v) => v.toFixed(2) },
      },
      y2: {
        position: "right",
        title: {
          display: true,
          text: "Defect Count",
          color: "#94a3b8",
          font: { weight: "bold", size: 11 },
        },
        grid: { display: false },
        ticks: { color: "#94a3b8" },
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
        <ChartLine className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
          {reportType === "dailyFpaReport"
            ? "Daily"
            : reportType === "monthlyFpaReport"
              ? "Monthly"
              : "Yearly"}{" "}
          FPQI Trend
        </span>
      </div>
      <div className="px-4 pt-2 pb-1 flex flex-wrap gap-3">
        {legendItems.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-slate-500"
          >
            <span
              className="inline-block rounded"
              style={{
                width: 14,
                height: item.dashed ? 3 : 10,
                background: item.dashed ? "transparent" : item.color,
                borderTop: item.dashed ? `2px dashed ${item.color}` : "none",
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="p-4 h-[35vh] min-h-[250px]">
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
};

// ─── EmptyState ────────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
      <Search className="w-6 h-6 text-blue-400" />
    </div>
    <h3 className="text-sm font-semibold text-slate-600">No Data Found</h3>
    <p className="text-xs text-slate-400 max-w-sm text-center">
      Adjust your filters and click Query to load FPA report data.
    </p>
  </div>
);

// ─── Shared Table Components ──────────────────────────────────────────────────

const TableEmpty = () => (
  <tr>
    <td colSpan={20} className="py-10 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">No data available.</p>
      </div>
    </td>
  </tr>
);

// ─── FPA Detail Table ─────────────────────────────────────────────────────────
const FpaReportTable = ({ data }) => {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [catFilter, setCatFilter] = useState("All");

  const handleDownloadImage = async (fgSrNo, fileName) => {
    if (!fgSrNo || !fileName) {
      toast("No image available.", { icon: "📎" });
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
        toast.error("File is empty or unavailable.");
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

  if (!data || data.length === 0) return <TableEmpty />;

  const CATS = [
    { key: "All", color: "blue" },
    { key: "Critical", color: "rose" },
    { key: "Major", color: "amber" },
    { key: "Minor", color: "yellow" },
  ];

  return (
    <>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500">
          Filter:
        </span>
        {CATS.map(({ key, color }) => {
          const active = catFilter === key;
          const count =
            key === "All"
              ? data.length
              : data.filter((r) => r.Category === key).length;
          return (
            <button
              key={key}
              onClick={() => setCatFilter(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                active
                  ? `bg-${color}-600 text-white border-${color}-600 shadow-sm`
                  : `bg-${color}-50 text-${color}-700 border-${color}-200 hover:bg-${color}-100`
              }`}
            >
              {key} {key !== "All" && `(${count})`}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-400">
          Showing {sorted.length} of {data.length}
        </span>
      </div>
      <div className="overflow-auto max-h-[50vh]">
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
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
                  onClick={() => key && toggleSort(key)}
                  className={`px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center ${key ? "cursor-pointer hover:text-blue-600" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
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
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
              >
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-blue-600">
                  {row.SRNo}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                  {row.Date
                    ? row.Date.replace("T", " ").replace("Z", "").slice(0, 19)
                    : "—"}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-800">
                  {row.Model}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
                  {row.Shift}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-700">
                  {row.FGSRNo}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
                  {row.Country}
                </td>
                <td className="px-3 py-2 border-b border-slate-100">
                  <CategoryBadge category={row.Category} />
                </td>
                <td
                  className="px-3 py-2 border-b border-slate-100 text-left max-w-[200px] truncate text-slate-600"
                  title={row.AddDefect}
                >
                  {row.AddDefect}
                </td>
                <td
                  className="px-3 py-2 border-b border-slate-100 text-left max-w-[160px] truncate text-slate-500"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-semibold hover:bg-blue-100 transition-colors"
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
      </div>
    </>
  );
};

// ─── Aggregate Table Component ────────────────────────────────────────────────
const AggregateTable = ({ data, headers, renderRow, sortFn }) => {
  if (!data || data.length === 0) return <TableEmpty />;
  const sorted = sortFn ? sortFn([...data]) : data;
  return (
    <div className="overflow-auto max-h-[50vh]">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{sorted.map((row, i) => renderRow(row, i))}</tbody>
      </table>
    </div>
  );
};

// ─── Daily Table ──────────────────────────────────────────────────────────────
const DailyFpaReportTable = ({ data }) => (
  <AggregateTable
    data={data}
    headers={[
      "Date",
      "Month",
      "Critical",
      "Major",
      "Minor",
      "Sample Inspected",
      "FPQI",
      "Status",
    ]}
    sortFn={(d) =>
      d.sort((a, b) => new Date(a.ShiftDate) - new Date(b.ShiftDate))
    }
    renderRow={(row, i) => (
      <tr
        key={i}
        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
      >
        <td className="px-3 py-2 border-b border-slate-100 font-mono font-semibold text-slate-700">
          {row.ShiftDate?.slice(0, 10) || "—"}
        </td>
        <td className="px-3 py-2 border-b border-slate-100 text-slate-600">
          {row.Month}
        </td>
        <td
          className={`px-3 py-2 border-b border-slate-100 ${row.NoOfCritical > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}
        >
          {row.NoOfCritical}
        </td>
        <td
          className={`px-3 py-2 border-b border-slate-100 ${row.NoOfMajor > 0 ? "font-bold text-amber-600" : "text-slate-400"}`}
        >
          {row.NoOfMajor}
        </td>
        <td
          className={`px-3 py-2 border-b border-slate-100 ${row.NoOfMinor > 0 ? "font-bold text-yellow-600" : "text-slate-400"}`}
        >
          {row.NoOfMinor}
        </td>
        <td className="px-3 py-2 border-b border-slate-100 font-semibold text-blue-600">
          {row.SampleInspected}
        </td>
        <td className="px-3 py-2 border-b border-slate-100">
          <FpqiBadge value={row.FPQI} />
        </td>
        <td className="px-3 py-2 border-b border-slate-100">
          <StatusPill fpqi={row.FPQI} />
        </td>
      </tr>
    )}
  />
);

// ─── Monthly Table ────────────────────────────────────────────────────────────
const MonthlyFpaReportTable = ({ data }) => (
  <AggregateTable
    data={data}
    headers={[
      "Month",
      "Period",
      "Critical",
      "Major",
      "Minor",
      "Sample Inspected",
      "FPQI",
      "Status",
    ]}
    sortFn={(d) => d.sort((a, b) => a.MonthKey?.localeCompare(b.MonthKey))}
    renderRow={(row, i) => (
      <tr
        key={i}
        className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
      >
        <td className="px-3 py-2 border-b border-slate-100 font-bold text-slate-700">
          {row.Month}
        </td>
        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600">
          {row.MonthKey}
        </td>
        <td
          className={`px-3 py-2 border-b border-slate-100 ${row.NoOfCritical > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}
        >
          {row.NoOfCritical}
        </td>
        <td
          className={`px-3 py-2 border-b border-slate-100 ${row.NoOfMajor > 0 ? "font-bold text-amber-600" : "text-slate-400"}`}
        >
          {row.NoOfMajor}
        </td>
        <td
          className={`px-3 py-2 border-b border-slate-100 ${row.NoOfMinor > 0 ? "font-bold text-yellow-600" : "text-slate-400"}`}
        >
          {row.NoOfMinor}
        </td>
        <td className="px-3 py-2 border-b border-slate-100 font-semibold text-blue-600">
          {row.SampleInspected}
        </td>
        <td className="px-3 py-2 border-b border-slate-100">
          <FpqiBadge value={row.FPQI} />
        </td>
        <td className="px-3 py-2 border-b border-slate-100">
          <StatusPill fpqi={row.FPQI} />
        </td>
      </tr>
    )}
  />
);

// ─── Yearly Table ─────────────────────────────────────────────────────────────
const YearlyFpaReportTable = ({ data }) => {
  if (!data || data.length === 0) return <TableEmpty />;
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
    <div className="overflow-auto max-h-[50vh]">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0">
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
                className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap"
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
              className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40 text-center"
            >
              <td className="px-3 py-2 border-b border-slate-100 font-extrabold text-slate-800 text-sm">
                {row.Year}
              </td>
              <td
                className={`px-3 py-2 border-b border-slate-100 ${row.NoOfCritical > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}
              >
                {row.NoOfCritical}
              </td>
              <td
                className={`px-3 py-2 border-b border-slate-100 ${row.NoOfMajor > 0 ? "font-bold text-amber-600" : "text-slate-400"}`}
              >
                {row.NoOfMajor}
              </td>
              <td
                className={`px-3 py-2 border-b border-slate-100 ${row.NoOfMinor > 0 ? "font-bold text-yellow-600" : "text-slate-400"}`}
              >
                {row.NoOfMinor}
              </td>
              <td className="px-3 py-2 border-b border-slate-100 font-semibold text-blue-600">
                {row.SampleInspected}
              </td>
              <td className="px-3 py-2 border-b border-slate-100">
                <FpqiBadge value={row.FPQI} />
              </td>
              <td className="px-3 py-2 border-b border-slate-100">
                {row.trend === "down" && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                    <TrendingDown className="w-3 h-3" /> Improved
                  </span>
                )}
                {row.trend === "up" && (
                  <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                    <TrendingUp className="w-3 h-3" /> Declined
                  </span>
                )}
                {row.trend === "flat" && (
                  <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                    <Minus className="w-3 h-3" /> Stable
                  </span>
                )}
                {!row.trend && <span className="text-slate-300">—</span>}
              </td>
              <td className="px-3 py-2 border-b border-slate-100">
                <StatusPill fpqi={row.FPQI} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

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
        if (data.length === 0) toast.success("No records found.");
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
    const params = {
      startDate: formatDate(yesterday8AM),
      endDate: formatDate(today8AM),
    };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
    runQuery("fpaReport", params);
  };

  const handleTodayQuery = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const params = {
      startDate: formatDate(today8AM),
      endDate: formatDate(now),
    };
    if (selectedModelVariant?.label) params.model = selectedModelVariant.label;
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
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            FPA Reports
          </h1>
          <p className="text-[11px] text-slate-400">
            Final Product Audit · Quality Intelligence Dashboard
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
              <Clock className="w-3 h-3" />
              {lastFetched.toLocaleTimeString()}
            </span>
          )}

          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {reportType === "fpaReport"
                ? filteredData.length
                : reportData.length}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Records
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-100">
            <Target className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-bold text-violet-700">
              FPQI ≤ {FPQI_TARGET}
            </span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters & Report Type
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
            {/* Left: controls */}
            <div className="space-y-3">
              {/* Report Type Tabs */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3 h-3 text-slate-400" />
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Report Type
                  </p>
                </div>
                <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden w-fit">
                  {REPORT_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      onClick={() => setReportType(rt.value)}
                      className={`flex flex-col items-center gap-0.5 px-5 py-2.5 text-xs font-semibold transition-all border-r border-slate-200 last:border-r-0 min-w-[80px] ${
                        reportType === rt.value
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <span className="font-bold">{rt.label}</span>
                      <span
                        className={`text-[9px] ${reportType === rt.value ? "text-blue-100" : "text-slate-400"}`}
                      >
                        {rt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date pickers + FPA-only filters */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="Start Time"
                    name="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="min-w-[170px] flex-1">
                  <DateTimePicker
                    label="End Time"
                    name="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                {/* FPA-only: Model Variant */}
                {reportType === "fpaReport" && (
                  <div className="min-w-[170px] flex-1">
                    <SelectField
                      label="Model Variant"
                      options={[
                        { value: "", label: "All Models" },
                        ...variants,
                      ]}
                      value={selectedModelVariant?.value || ""}
                      onChange={(e) =>
                        setSelectedModelVariant(
                          variants.find((o) => o.value === e.target.value) ||
                            null,
                        )
                      }
                    />
                  </div>
                )}

                {/* FPA-only: Search */}
                {reportType === "fpaReport" && (
                  <div className="min-w-[170px] flex-1">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Model, FGSRNO, defect…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2"
                        >
                          <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
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
                    {loading ? "Loading…" : "Query"}
                  </button>

                  {reportData.length > 0 && (
                    <ExportButton data={reportData} filename="FPA_Report" />
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Filters */}
            <div className="border-l border-slate-100 pl-5 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Quick Select
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {showQuickYesterday && (
                  <button
                    onClick={handleYesterdayQuery}
                    disabled={loading}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      loading
                        ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                        : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                    }`}
                  >
                    Yesterday
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                {showQuickToday && (
                  <button
                    onClick={handleTodayQuery}
                    disabled={loading}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      loading
                        ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                        : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    Today
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                {showQuickMTD && (
                  <button
                    onClick={handleMTDQuery}
                    disabled={loading}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      loading
                        ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    Month to Date
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING STATE ── */}
        {loading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching report data…</p>
          </div>
        )}

        {/* ── DATA PANELS ── */}
        {!loading && reportData.length > 0 && (
          <>
            {/* Summary Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Summary
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <TopDefectsPanel data={filteredData} />
                <ModelPerformancePanel data={filteredData} />
              </div>
            )}

            {reportType === "fpaReport" && reportData.length > 0 && (
              <CountryPanel data={filteredData} />
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <Table2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Data Table
                </span>
                <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                  {reportType === "fpaReport"
                    ? filteredData.length
                    : reportData.length}{" "}
                  rows
                </span>
              </div>
              <div className="p-4">
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

        {/* ── Empty: no data ── */}
        {!loading && reportData.length === 0 && <EmptyState />}
      </div>
    </div>
  );
};

export default FPAReports;
