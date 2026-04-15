import { useCallback, useEffect, useRef, useState } from "react";
import SelectField from "../../components/ui/SelectField";
import axios from "axios";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import {
  RefreshCw,
  Filter,
  X,
  BarChart2,
  List,
  Target,
  AlertTriangle,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Loader2,
  PackageOpen,
} from "lucide-react";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Status classifier ──────────────────────────────────────────────────────────
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

// ── Defect severity ────────────────────────────────────────────────────────────
const ratioLevel = (pct) => {
  if (pct === null || pct === undefined)
    return {
      color: "text-slate-400",
      bg: "bg-slate-50",
      border: "border-slate-200",
      label: "—",
      hex: "#94a3b8",
    };
  if (pct >= 35)
    return {
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Critical",
      hex: "#dc2626",
    };
  if (pct >= 25)
    return {
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "High",
      hex: "#d97706",
    };
  if (pct >= 15)
    return {
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
      label: "Moderate",
      hex: "#ea580c",
    };
  return {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "Good",
    hex: "#16a34a",
  };
};

// ── Status Badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const type = classifyStatus(status);
  const cfg = {
    open: "bg-red-50 text-red-700 border-red-200",
    closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    unknown: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const dot = {
    open: "bg-red-400 animate-pulse",
    closed: "bg-emerald-400",
    unknown: "bg-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider font-mono ${cfg[type]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[type]}`} />
      {status || "—"}
    </span>
  );
};

// ── QuickBtn ───────────────────────────────────────────────────────────────────
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
        <Spinner /> Loading…
      </span>
    ) : (
      <>
        <span className="text-[15px] font-bold tracking-widest">{label}</span>
        {sublabel && (
          <span className="text-[10px] opacity-75 font-normal">{sublabel}</span>
        )}
      </>
    )}
  </button>
);

// ── SortIcon ───────────────────────────────────────────────────────────────────
const SortIcon = ({ active, dir }) => (
  <span className="inline-flex flex-col ml-1">
    <ChevronUp
      className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === "asc" ? "text-blue-500" : "text-slate-400"}`}
    />
    <ChevronDown
      className={`w-2.5 h-2.5          ${active && dir === "desc" ? "text-blue-500" : "text-slate-400"}`}
    />
  </span>
);

// ── Donut Chart ────────────────────────────────────────────────────────────────
const DonutChart = ({ open, closed }) => {
  const total = (Number(open) || 0) + (Number(closed) || 0);
  const r = 44,
    cx = 58,
    cy = 58,
    circ = 2 * Math.PI * r;
  const cArc = total ? (closed / total) * circ : 0;
  const oArc = total ? (open / total) * circ : 0;
  const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
  return (
    <div className="relative w-[116px] h-[116px]">
      <svg viewBox="0 0 116 116">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#e2e8f0"
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
            transform: `rotate(-90deg)`,
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
            transform: `rotate(-90deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800 font-mono">
        {pct}%
      </div>
    </div>
  );
};

// ── Rework Bar Chart ───────────────────────────────────────────────────────────
const ReworkBarChart = ({ data }) => {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex flex-col gap-3">
      {data.map((row, i) => (
        <div key={i}>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-mono font-semibold text-slate-600 truncate max-w-[220px]">
              {row.Model_Name}
            </span>
            <div className="flex gap-3 shrink-0">
              <span className="text-[11px] font-bold font-mono text-red-600">
                ↑ {row.open}
              </span>
              <span className="text-[11px] font-bold font-mono text-emerald-600">
                ✓ {row.closed}
              </span>
              <span className="text-[11px] font-bold font-mono text-blue-600">
                {row.total}
              </span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex border border-slate-200">
            <div
              className="h-full bg-emerald-400 transition-all duration-700"
              style={{
                width: `${(row.closed / max) * 100}%`,
                borderRadius: row.open === 0 ? "9999px" : "9999px 0 0 9999px",
              }}
            />
            <div
              className="h-full bg-red-400 transition-all duration-700"
              style={{ width: `${(row.open / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex gap-4 mt-1">
        {[
          { c: "bg-emerald-400", l: "Closed" },
          { c: "bg-red-400", l: "Open" },
        ].map((x) => (
          <div key={x.l} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${x.c}`} />
            <span className="text-[11px] text-slate-500 font-mono">{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Defect Ratio Bars ──────────────────────────────────────────────────────────
const DefectRatioBars = ({ data }) => {
  const maxRatio = Math.max(...data.map((d) => d.defectRatio ?? 0), 0.01);
  return (
    <div className="flex flex-col gap-3">
      {data.map((row, i) => {
        const rl = ratioLevel(row.defectRatio);
        const barPct =
          row.defectRatio !== null
            ? (row.defectRatio / Math.max(maxRatio, 10)) * 100
            : 0;
        return (
          <div key={i}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-mono font-semibold text-slate-600 truncate max-w-[210px]">
                {row.Model_Name}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-mono text-slate-500">
                  Prod:{" "}
                  <b className="text-blue-600">
                    {(row.production || 0).toLocaleString()}
                  </b>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  RW: <b className="text-red-600">{row.reworkTotal}</b>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono border ${rl.bg} ${rl.color} ${rl.border}`}
                >
                  {row.defectRatio !== null
                    ? `${row.defectRatio.toFixed(2)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${barPct}%`, backgroundColor: rl.hex }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 mt-1 flex-wrap">
        {[
          { hex: "#16a34a", l: "Good (<15%)" },
          { hex: "#ea580c", l: "Moderate (15-25%)" },
          { hex: "#d97706", l: "High (25-35%)" },
          { hex: "#dc2626", l: "Critical (≥35%)" },
        ].map((l) => (
          <div key={l.l} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: l.hex }}
            />
            <span className="text-[11px] text-slate-500 font-mono">{l.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Defect Ratio Table ─────────────────────────────────────────────────────────
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
    const av = a[sortCol] ?? -1,
      bv = b[sortCol] ?? -1;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const hasProd = data.some((r) => r.production !== null);

  const totProd = sorted.reduce((s, r) => s + (r.production ?? 0), 0);
  const totRW = sorted.reduce((s, r) => s + r.reworkTotal, 0);
  const totRatio = totProd > 0 ? (totRW / totProd) * 100 : null;
  const totRl = ratioLevel(totRatio);

  return (
    <div className="overflow-auto">
      {!hasProd && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 font-mono leading-relaxed">
            Production data unavailable. Ensure the{" "}
            <b>quality/production-report</b> endpoint is active and returning
            data from Station 1220010.
          </p>
        </div>
      )}
      <table className="min-w-full text-xs border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {[
              "Sr. No.",
              "Model",
              "Production",
              "Rework",
              "Defect Ratio",
              "Severity",
              "Visual",
            ].map((h, i) => (
              <th
                key={h}
                onClick={() =>
                  ["Production", "Rework", "Defect Ratio"].includes(h)
                    ? handleSort(
                        ["production", "reworkTotal", "defectRatio"][
                          ["Production", "Rework", "Defect Ratio"].indexOf(h)
                        ],
                      )
                    : null
                }
                className={`px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center ${i === 1 ? "text-left" : ""} ${["Production", "Rework", "Defect Ratio"].includes(h) ? "cursor-pointer hover:bg-slate-200" : ""}`}
              >
                <span className="flex items-center justify-center gap-1">
                  {h}
                  {["Production", "Rework", "Defect Ratio"].includes(h) && (
                    <SortIcon
                      active={
                        sortCol ===
                        ["production", "reworkTotal", "defectRatio"][
                          ["Production", "Rework", "Defect Ratio"].indexOf(h)
                        ]
                      }
                      dir={sortDir}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const rl = ratioLevel(row.defectRatio);
            return (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
              >
                <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono text-center">
                  {i + 1}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800 font-mono max-w-[200px] truncate">
                  {row.Model_Name}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center font-bold font-mono text-blue-700">
                  {row.production !== null ? (
                    row.production.toLocaleString()
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  <span className="bg-red-50 text-red-700 border border-red-200 rounded-md px-2 py-0.5 font-bold font-mono">
                    {row.reworkTotal}
                  </span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  {row.defectRatio !== null ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(row.defectRatio, 100)}%`,
                            backgroundColor: rl.hex,
                          }}
                        />
                      </div>
                      <span
                        className={`font-bold font-mono text-sm ${rl.color}`}
                      >
                        {row.defectRatio.toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-300 font-mono">N/A</span>
                  )}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${rl.bg} ${rl.color} ${rl.border}`}
                  >
                    {row.defectRatio !== null ? rl.label : "No Data"}
                  </span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  {row.defectRatio !== null && (
                    <div className="flex justify-center gap-1">
                      {[2, 5, 10].map((thresh, ti) => (
                        <div
                          key={ti}
                          className="w-2.5 h-2.5 rounded-sm border transition-colors"
                          style={{
                            background:
                              row.defectRatio > thresh ? rl.hex : "#f1f5f9",
                            borderColor:
                              row.defectRatio > thresh ? rl.hex : "#e2e8f0",
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
          {sorted.length > 0 && (
            <tr className="bg-slate-800 text-white">
              <td className="px-3 py-3" />
              <td className="px-3 py-3 font-bold font-mono text-[11px] uppercase tracking-wider">
                TOTAL
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-blue-300">
                {totProd.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-red-300">
                {totRW.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-center">
                {totRatio !== null && (
                  <span
                    className="font-bold font-mono text-sm"
                    style={{ color: totRl.hex }}
                  >
                    {totRatio.toFixed(2)}%
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-center">
                {totRatio !== null && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${totRl.bg} ${totRl.color} ${totRl.border}`}
                  >
                    {totRl.label}
                  </span>
                )}
              </td>
              <td className="px-3 py-3" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── Breakdown Table ────────────────────────────────────────────────────────────
const BreakdownTable = ({ data, selectedModel, onModelClick }) => {
  const totals = data.reduce(
    (a, r) => ({
      total: a.total + r.total,
      open: a.open + r.open,
      closed: a.closed + r.closed,
    }),
    { total: 0, open: 0, closed: 0 },
  );
  const totRate =
    totals.total > 0 ? Math.round((totals.closed / totals.total) * 100) : 0;

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-xs border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {["Sr. No.", "Model", "Total", "Open", "Closed", "Close Rate", ""].map(
              (h, i) => (
                <th
                  key={h}
                  className={`px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap ${i <= 1 ? "text-left" : "text-center"}`}
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
            const rc =
              rate >= 70
                ? "text-emerald-600"
                : rate >= 40
                  ? "text-amber-600"
                  : "text-red-600";
            const rcHex =
              rate >= 70 ? "#16a34a" : rate >= 40 ? "#d97706" : "#dc2626";
            return (
              <tr
                key={i}
                onClick={() => onModelClick(row.Model_Name)}
                className={`cursor-pointer transition-colors ${isAct ? "bg-blue-50 border-l-2 border-blue-500" : "hover:bg-blue-50/60 even:bg-slate-50/40"}`}
              >
                <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 font-mono">
                  {i + 1}
                </td>
                <td
                  className={`px-3 py-2.5 border-b border-slate-100 font-semibold font-mono ${isAct ? "text-blue-700" : "text-slate-800"}`}
                >
                  {row.Model_Name}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center font-bold font-mono text-blue-700 text-sm">
                  {row.total}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <span className="bg-red-50 text-red-700 border border-red-200 rounded-md px-2 py-0.5 font-bold font-mono">
                    {row.open}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-2 py-0.5 font-bold font-mono">
                    {row.closed}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-[130px]">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${rate}%`, backgroundColor: rcHex }}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold min-w-[34px] ${rc}`}
                    >
                      {rate}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onModelClick(row.Model_Name);
                    }}
                    className={`px-3 py-1 rounded-md border text-[10px] font-bold font-mono uppercase tracking-wider transition-all ${
                      isAct
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    {isAct ? "Clear" : "Filter"}
                  </button>
                </td>
              </tr>
            );
          })}
          {/* Totals */}
          {data.length > 0 && (
            <tr className="bg-slate-800 text-white">
              <td className="px-3 py-3" />
              <td className="px-3 py-3 font-bold font-mono text-[11px] uppercase tracking-wider">
                TOTAL
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-blue-300 text-sm">
                {totals.total}
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-red-300">
                {totals.open}
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-emerald-300">
                {totals.closed}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2 min-w-[130px]">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/60 rounded-full"
                      style={{ width: `${totRate}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-white">
                    {totRate}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-3" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
const KpiCard = ({
  label,
  value,
  sub,
  badge,
  colorClass = "bg-blue-50 border-blue-100",
  textClass = "text-blue-700",
  subClass = "text-blue-500",
}) => (
  <div
    className={`flex flex-col items-center px-4 py-2 rounded-lg border min-w-[100px] ${colorClass}`}
  >
    <span className={`text-xl font-bold font-mono ${textClass}`}>{value}</span>
    <span
      className={`text-[10px] font-medium uppercase tracking-wide ${subClass}`}
    >
      {label}
    </span>
    {sub && (
      <span className="text-[10px] text-slate-400 mt-0.5 text-center">
        {sub}
      </span>
    )}
    {badge && (
      <span
        className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${badge.bg} ${badge.color} ${badge.border}`}
      >
        {badge.label}
      </span>
    )}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
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
    } catch {
      setProductionMap({});
      setTotalProduction(0);
    } finally {
      setProdLoading(false);
    }
  };

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
    } catch {
      toast.error("Failed to fetch rework data.");
    } finally {
      setLoading(false);
    }
  };

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
    const now = new Date(),
      t8 = new Date(now.setHours(8, 0, 0, 0)),
      y8 = new Date(t8);
    y8.setDate(t8.getDate() - 1);
    fetchQuickData(fmt(y8), fmt(t8), setYdayLoading);
  };

  const fetchTodayData = () => {
    const now = new Date(),
      t8 = new Date(now.setHours(8, 0, 0, 0));
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

  const normalizeModel = (name) =>
    name ? name.trim().replace(/\s*S$/i, "").trim() : "Not Logged In";

  const aggregateReworkData = () => {
    const map = {};
    reworkData.forEach((item) => {
      const model = normalizeModel(item.Model_Name);
      if (!map[model]) map[model] = { total: 0, open: 0, closed: 0 };
      map[model].total++;
      classifyStatus(item.Rework_Status) === "closed"
        ? map[model].closed++
        : map[model].open++;
    });
    return Object.entries(map)
      .map(([k, v]) => ({ Model_Name: k, ...v, reworkTotal: v.total }))
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

  
  const hasProd = totalProduction > 0;
  const overallRatio = hasProd ? (totalCount / totalProduction) * 100 : null;
  const overallRl = ratioLevel(overallRatio);

  const ratioData = aggregated
    .map((row) => {
      const prod = productionMap[row.Model_Name] ?? null;
      const ratio = prod ? (row.reworkTotal / prod) * 100 : null;
      return { ...row, production: prod, defectRatio: ratio };
    })
    .sort((a, b) => (b.defectRatio ?? -1) - (a.defectRatio ?? -1));

  const hasData = reworkData.length > 0;
  const columns = Object.keys(filteredData[0] || {});

  const TABS = [
    { id: "summary", icon: BarChart2, label: "Summary" },
    { id: "defect", icon: Target, label: "Defect Ratio" },
    { id: "detail", icon: List, label: "Detail View" },
  ];

  if (variantsLoading) return <Loader />;

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Rework Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Quality Control · Rework & Defect Ratio Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <>
              <KpiCard
                label="Total Records"
                value={totalCount.toLocaleString()}
                colorClass="bg-blue-50 border-blue-100"
                textClass="text-blue-700"
                subClass="text-blue-500"
              />
              <KpiCard
                label="Open / Pending"
                value={totalOpen}
                colorClass="bg-red-50 border-red-100"
                textClass="text-red-700"
                subClass="text-red-500"
              />
              <KpiCard
                label="Closed"
                value={totalClosed}
                colorClass="bg-emerald-50 border-emerald-100"
                textClass="text-emerald-700"
                subClass="text-emerald-500"
              />
              {overallRatio !== null && (
                <KpiCard
                  label="Defect Ratio"
                  value={`${overallRatio.toFixed(2)}%`}
                  colorClass={`${overallRl.bg} ${overallRl.border}`}
                  textClass={overallRl.color}
                  subClass={overallRl.color}
                  badge={overallRl}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS + QUICK FILTERS ── */}
        <div className="flex gap-3 shrink-0">
          {/* Filters card */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Filter className="w-3 h-3 text-slate-400" />
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Filters
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-[190px] flex-1">
                <SelectField
                  label="Model Variant"
                  options={variants}
                  value={selectedModelVariant?.value || ""}
                  onChange={(e) =>
                    setSelectedModelVariant(
                      variants.find((v) => v.value === e.target.value) || null,
                    )
                  }
                />
              </div>
              <div className="min-w-[185px] flex-1">
                <DateTimePicker
                  label="Start Time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="min-w-[185px] flex-1">
                <DateTimePicker
                  label="End Time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
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
                  {loading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
                  {loading ? "Loading…" : "Run Query"}
                </button>
                {hasData && (
                  <ExportButton
                    fetchData={fetchExportData}
                    filename="Rework_Report"
                  />
                )}
                {selectedModel && (
                  <button
                    onClick={() => setSelectedModel(null)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-all"
                  >
                    <Filter className="w-3 h-3" /> {selectedModel}{" "}
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick filters */}
          <div className="w-60 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
              Quick Filters
            </p>
            <p className="text-[10px] text-slate-400 mb-3">
              Select a preset time range.
            </p>
            <div className="flex flex-col gap-2">
              <QuickBtn
                label="YESTERDAY"
                sublabel="Prev day 08:00 → today 08:00"
                loading={ydayLoading}
                onClick={fetchYesterdayData}
                colorClass="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              />
              <QuickBtn
                label="TODAY"
                sublabel="08:00 → now"
                loading={todayLoading}
                onClick={fetchTodayData}
                colorClass="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              />
              <QuickBtn
                label="MTD"
                sublabel="Month to date"
                loading={monthLoading}
                onClick={fetchMTDData}
                colorClass="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* ── EMPTY / LOADING STATE ── */}
        {!hasData && !loading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <PackageOpen className="w-14 h-14 opacity-20" strokeWidth={1.2} />
            <p className="text-base font-bold text-slate-500">No data loaded</p>
            <p className="text-sm text-slate-400">
              Run a query or select a quick filter to load rework records
            </p>
          </div>
        )}
        {loading && !hasData && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-6 h-6 text-blue-600" />
            <span className="text-sm text-slate-400">
              Fetching rework data…
            </span>
          </div>
        )}

        {/* ── TAB BAR ── */}
        {hasData && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0">
            <div className="flex items-center gap-1 px-2 pt-1.5 border-b border-slate-100 bg-slate-50/50">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-blue-700 border-t-2 border-x border-t-blue-500 border-x-slate-200 -mb-px shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${isActive ? "text-blue-500" : "text-slate-400"}`}
                    />
                    {tab.label}
                    {tab.id === "detail" && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}
                      >
                        {filteredData.length.toLocaleString()}
                      </span>
                    )}
                    {tab.id === "defect" && overallRatio !== null && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? `${overallRl.bg} ${overallRl.color}` : "bg-slate-200 text-slate-500"}`}
                      >
                        {overallRatio.toFixed(2)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── SUMMARY TAB ── */}
            {activeTab === "summary" && (
              <div className="p-4 flex flex-col gap-4">
                {/* Bar chart + donut */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        Rework Volume by Model
                      </span>
                    </div>
                    {aggregated.length > 0 ? (
                      <ReworkBarChart data={aggregated} />
                    ) : (
                      <p className="text-xs text-slate-400 font-mono">
                        No model data
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        Resolution Rate
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <DonutChart open={totalOpen} closed={totalClosed} />
                      <div className="w-full flex flex-col gap-2">
                        {[
                          {
                            label: "Closed",
                            val: totalClosed,
                            cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
                          },
                          {
                            label: "Open/Pending",
                            val: totalOpen,
                            cls: "bg-red-50 border-red-200 text-red-700",
                          },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className={`flex justify-between items-center px-3 py-2 rounded-lg border ${s.cls}`}
                          >
                            <span className="text-[11px] font-mono">
                              {s.label}
                            </span>
                            <span className="text-lg font-black font-mono">
                              {s.val.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <List className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        Model Breakdown
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {aggregated.length} model
                      {aggregated.length !== 1 ? "s" : ""} · Click row to filter
                      detail
                    </span>
                  </div>
                  <BreakdownTable
                    data={aggregated}
                    selectedModel={selectedModel}
                    onModelClick={handleModelClick}
                  />
                </div>
              </div>
            )}

            {/* ── DEFECT RATIO TAB ── */}
            {activeTab === "defect" && (
              <div className="p-4 flex flex-col gap-4">
                {/* Severity legend */}
                <div className="flex items-center flex-wrap gap-4 px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">
                    Severity:
                  </span>
                  {[
                    { label: "Good", pct: 0.5 },
                    { label: "Moderate", pct: 20 },
                    { label: "High", pct: 30 },
                    { label: "Critical", pct: 40 },
                  ].map((t) => {
                    const rl = ratioLevel(t.pct);
                    return (
                      <div key={t.label} className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono ${rl.bg} ${rl.color} ${rl.border}`}
                        >
                          {t.label}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
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
                  {prodLoading && (
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono ml-auto">
                      <Spinner cls="w-3 h-3" /> Loading production…
                    </span>
                  )}
                  {!hasProd && !prodLoading && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-mono ml-auto">
                      ⚠ Production data unavailable
                    </span>
                  )}
                  {hasProd && (
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-mono ml-auto">
                      ✓ Per-model production matched
                    </span>
                  )}
                </div>

                {/* Ratio bars */}
                {hasProd && (
                  <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-orange-100 bg-orange-50/30">
                      <BarChart2 className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest">
                        Defect Ratio by Model — Rework ÷ Per-Model Production
                      </span>
                    </div>
                    <div className="p-4">
                      <DefectRatioBars data={ratioData} />
                    </div>
                  </div>
                )}

                {/* Ratio table */}
                <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-orange-100 bg-orange-50/30">
                    <Target className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest">
                      Per-Model Defect Ratio Table
                    </span>
                  </div>
                  <DefectRatioTable data={ratioData} />
                </div>
              </div>
            )}

            {/* ── DETAIL TAB ── */}
            {activeTab === "detail" && (
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      {selectedModel
                        ? `Filtered: ${selectedModel}`
                        : "All Records"}
                    </span>
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono">
                      {filteredData.length.toLocaleString()} rows
                    </span>
                    {selectedModel && (
                      <button
                        onClick={() => setSelectedModel(null)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition-all"
                      >
                        Clear filter <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  {hasMore && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Scroll to load more ↓
                    </span>
                  )}
                </div>
                <div className="overflow-auto max-h-[520px]">
                  <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap w-10">
                          Sr. No.
                        </th>
                        {columns.map((k) => (
                          <th
                            key={k}
                            className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                          >
                            {k.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, i) => (
                        <tr
                          key={i}
                          ref={
                            i === filteredData.length - 1 ? lastRowRef : null
                          }
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        >
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono text-center">
                            {i + 1}
                          </td>
                          {columns.map((k) => (
                            <td
                              key={k}
                              className="px-3 py-2 border-b border-slate-100 whitespace-nowrap"
                            >
                              {k === "Rework_Status" ? (
                                <StatusBadge status={row[k]} />
                              ) : (
                                <span
                                  className={
                                    k === "Model_Name"
                                      ? "font-semibold text-slate-800"
                                      : "text-slate-600"
                                  }
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
                    <div className="flex items-center justify-center py-4 gap-2 text-blue-600 text-xs border-t border-slate-100">
                      <Spinner /> Loading more records…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReworkReport;
