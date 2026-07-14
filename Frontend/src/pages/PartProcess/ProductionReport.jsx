/**
 * Part Process – Production Report
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  FiSearch, FiCalendar, FiClock, FiFilter, FiLoader, FiDownload,
  FiPackage, FiBarChart2, FiList,
  FiChevronDown, FiGrid, FiFile, FiFileText, FiColumns,
  FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight,
  FiActivity, FiAlertTriangle, FiArrowUp, FiArrowDown,
} from "react-icons/fi";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import DateTimePicker from "../../components/ui/DateTimePicker";
import toast from "react-hot-toast";
import {
  selectMaterials, getMaterialByModel, selectShifts, toMins, selectPlans,
} from "../../redux/slices/masterConfigSlice";
import {
  enrichRecords, detectChangeovers, changeoverStats, parseDurSecs,
  STD_CHANGEOVER_MINS, isPunchingPart,
} from "../../utils/productionLogic.js";
import { mapDbRecord } from "../../utils/mapDbRecord.js";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";
import { getWrlLogoBase64 } from "../../utils/reportLogo.js";

/* ==================================================================
 * 1. Date / time helpers
 * ================================================================== */
const pad = (n) => (n < 10 ? "0" + n : "" + n);
const fmtYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtAbs = (ms, timeStr) =>
  ms ? `${fmtYMD(new Date(ms))} ${timeStr || ""}`.trim() : timeStr || "—";
const toDisplayDate = (isoDate) => {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
};
const todayStr = () => fmtYMD(new Date());
const offsetDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return fmtYMD(d);
};

// seconds-of-day from "HH:MM:SS" / "...THH:MM:SS" / "... HH:MM:SS"
const todSecs = (t) => {
  if (!t) return null;
  const s = String(t);
  let tp = s;
  if (s.includes("T")) tp = s.split("T")[1];
  else if (s.length > 10 && s.includes(" ")) tp = s.split(" ")[1];
  const [h, m, sec] = tp.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 3600 + m * 60 + (sec || 0);
};

const MACHINE_POWER_KW = 5; // default machine power assumption

/* ==================================================================
 * 2. Tailwind-SAFE colour tokens
 * ------------------------------------------------------------------
 * CHANGE: the original used `bg-${color}-50` style template strings.
 * Tailwind's JIT scanner can't see runtime-built class names, so those
 * colours were silently purged in production builds. We map to full,
 * statically-analysable class strings instead.
 * ================================================================== */
const TONE = {
  slate:   { card: "bg-slate-50 border-slate-200",     text: "text-slate-700",   sub: "text-slate-400",   accent: "bg-slate-400" },
  blue:    { card: "bg-blue-50 border-blue-200",       text: "text-blue-600",    sub: "text-blue-400",    accent: "bg-blue-500" },
  violet:  { card: "bg-violet-50 border-violet-200",   text: "text-violet-600",  sub: "text-violet-400",  accent: "bg-violet-500" },
  indigo:  { card: "bg-indigo-50 border-indigo-200",   text: "text-indigo-600",  sub: "text-indigo-400",  accent: "bg-indigo-500" },
  cyan:    { card: "bg-cyan-50 border-cyan-200",       text: "text-cyan-600",    sub: "text-cyan-400",    accent: "bg-cyan-500" },
  emerald: { card: "bg-emerald-50 border-emerald-200", text: "text-emerald-600", sub: "text-emerald-400", accent: "bg-emerald-500" },
  amber:   { card: "bg-amber-50 border-amber-200",     text: "text-amber-600",   sub: "text-amber-400",   accent: "bg-amber-500" },
  rose:    { card: "bg-rose-50 border-rose-200",       text: "text-rose-500",    sub: "text-rose-400",    accent: "bg-rose-500" },
};
// OEE colour helpers
const oeeTextColor = (v) => (v >= 85 ? "text-emerald-600" : v >= 65 ? "text-amber-600" : "text-rose-500");
const oeeBgColor   = (v) => (v >= 85 ? "bg-emerald-50 border-emerald-200" : v >= 65 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200");
const oeeBarColor  = (v) => (v >= 85 ? "bg-emerald-500" : v >= 65 ? "bg-amber-500" : "bg-rose-500");

/* ==================================================================
 * 3. Component-quantity helper
 * ------------------------------------------------------------------
 * CHANGE: Component Qty is now the single source of truth for "how
 * much did we make". This helper converts a raw record's sheet `qty`
 * into component count using the master (sheets × components/sheet for
 * punching parts, otherwise 1:1).
 * ================================================================== */
const componentsPerUnit = (materials, model) => {
  const mat = getMaterialByModel(materials, model);
  if (mat && isPunchingPart(mat)) {
    const ns = Number(mat.noOfSheet) || 0;
    const cps = Number(mat.actualComponentsPerSheet) || 0;
    if (ns > 0 && cps > 0) return ns * cps;
  }
  return 1;
};

/* ==================================================================
 * 4. Aggregation: raw records -> per-part summary rows
 * ================================================================== */
// Sum configured Plan target qty for a SAP code across the queried date span
// (a multi-day query collapses into one row per SAP code, so plans for every
// day in that span are summed). Inactive plans (status === false) are ignored.
const sumPlannedQty = (plans, sapCode, dateFrom, dateTo) => {
  if (!plans?.length || !sapCode) return 0;
  return plans.reduce((sum, p) => {
    if (p.sapCode !== sapCode) return sum;
    if (p.status === false || p.status === 0) return sum;
    if (dateFrom && p.planDate < dateFrom) return sum;
    if (dateTo && p.planDate > dateTo) return sum;
    return sum + (Number(p.targetQty) || 0);
  }, 0);
};

const aggregateRecords = (records, materials, qualityByPartName = {}, plans = []) => {
  if (!records.length) return [];

  // Enrich first — classifies Downtime >= 5 min as "Idle"
  // Downtime events do not carry a model. Attribute each stop to the most
  // recently produced model in the same shift so it affects that model's OEE.
  const lastModelByShift = new Map();
  const enriched = [...enrichRecords(records)]
    .sort((a, b) => (a._absMs ?? 0) - (b._absMs ?? 0))
    .map((record) => {
    const shiftKey = record.shift || "__unassigned_shift__";
    if (record.state === "Production" && record.model) {
      lastModelByShift.set(shiftKey, record.model);
      return record;
    }
    if (record.state === "Downtime" && !record.model) {
      const model = lastModelByShift.get(shiftKey);
      if (model) return { ...record, model };
    }
      return record;
    });

  const map = {};
  enriched.forEach((r) => {
    const mat     = getMaterialByModel(materials, r.model);
    const sapCode = mat?.sapCode || r.sapCode || "UNKNOWN";
    const key = sapCode;

    if (!map[key]) {
      map[key] = {
        sapCode, model: r.model,
        itemDescription: mat?.partName || r.model || "-",
        definedCycleTime: mat?.definedComponentCycleTime || 0,
        stdChangeoverTime: STD_CHANGEOVER_MINS,
        // CHANGE: track the actual production-day span instead of forcing
        // every row to the query's start date (fixes multi-day collapse).
        dateFrom: r._prodDay || null,
        dateTo: r._prodDay || null,
        startedAtMs: r._absMs ?? null, completedAtMs: r._absMsEnd ?? r._absMs ?? null,
        startedAt: r.startTime || "", completedAt: r.endTime || r.startTime || "",
        planQty: 0, actualQty: 0, goodQty: 0,
        downtimeSecs: 0, downtimeCount: 0, // brief downtime (<5m)
        idleSecs: 0,    idleCount: 0,      // idle (>=5m)
        cycleSecs: [], productionEvents: 0,
        rawRecords: [],
      };
    }

    const g = map[key];
    g.rawRecords.push(r);
    if (r._prodDay) {
      if (!g.dateFrom || r._prodDay < g.dateFrom) g.dateFrom = r._prodDay;
      if (!g.dateTo   || r._prodDay > g.dateTo)   g.dateTo   = r._prodDay;
    }
    if (r._absMs != null && (g.startedAtMs == null || r._absMs < g.startedAtMs)) {
      g.startedAtMs = r._absMs;
      g.startedAt = r.startTime || "";
    }
    const recordEndMs = r._absMsEnd ?? r._absMs;
    if (recordEndMs != null && (g.completedAtMs == null || recordEndMs > g.completedAtMs)) {
      g.completedAtMs = recordEndMs;
      g.completedAt = r.endTime || r.startTime || "";
    }

    if (r.state === "Production") {
      g.actualQty += r.qty ?? 0;
      if (r.quality === "GOOD") g.goodQty += r.qty ?? 0;
      const dur = parseDurSecs(r.duration);
      if (dur > 0) g.cycleSecs.push(dur);
      g.productionEvents++;
    } else if (r.effectiveState === "Idle") {
      g.idleSecs  += parseDurSecs(r.duration);
      g.idleCount += 1;
    } else if (r.effectiveState === "Downtime") {
      g.downtimeSecs  += parseDurSecs(r.duration);
      g.downtimeCount += 1;
    }
  });

  return Object.values(map)
    .filter((row) => row.sapCode !== "UNKNOWN")
    .map((row, idx) => {
      const avgCycleSecs = row.cycleSecs.length > 0
        ? Math.round(row.cycleSecs.reduce((a, b) => a + b, 0) / row.cycleSecs.length)
        : row.definedCycleTime;

      const cos      = detectChangeovers(row.rawRecords);
      const coSt     = changeoverStats(cos);
      const downMins = Math.round(row.downtimeSecs / 60);
      const idleMins = Math.round(row.idleSecs / 60);
      const lossMins = downMins + idleMins + coSt.overrunMins;

      // --- Punching component metrics ---
      const matForRow  = getMaterialByModel(materials, row.model);
      const punching   = isPunchingPart(matForRow);
      const noOfSheet    = Number(matForRow?.noOfSheet) || 0;
      const compPerSheet = Number(matForRow?.actualComponentsPerSheet) || 0;
      const loadUnload   = Number(matForRow?.pncLoadingUnloading) || 0;

      const sheetCT = punching && noOfSheet > 0
        ? Math.round((avgCycleSecs / noOfSheet) * 100) / 100
        : avgCycleSecs;
      const compCT = punching && compPerSheet > 0
        ? Math.round(((sheetCT + loadUnload) / compPerSheet) * 100) / 100
        : null;

      // Total Components Produced = (sheets × comps/sheet) × machine sheet count
      const compQty = punching && noOfSheet > 0 && compPerSheet > 0
        ? Math.round(noOfSheet * compPerSheet * row.actualQty)
        : row.actualQty;

      // Plan Qty comes from the Planning Configuration upload when available
      // (summed across the queried date span); otherwise falls back to a
      // +5% estimate over components produced.
      const plannedQty = sumPlannedQty(plans, row.sapCode, row.dateFrom, row.dateTo);
      const planQty = plannedQty > 0 ? plannedQty : Math.ceil(compQty * 1.05);
      const planQtyFromConfig = plannedQty > 0;

      // ============================================================
      // OEE  — all quantities in COMPONENT units (per spec)
      // ------------------------------------------------------------
      //   Actual Component CT  = per-component actual cycle time.
      //     punching → compCT ; non-punching → machine CT (1 sheet = 1 comp)
      //   Available Time = Plan Qty       × Defined CT
      //   Actual Time    = Actual Prod    × Actual CT
      //
      //   A% = (Available Time - Downtime) / Available Time
      //   P% = (Actual Components × Defined CT) / Net Operating Time
      //   Q% = Accepted Qty  / Actual Qty
      // ============================================================
      const actualCompCT = compCT != null ? compCT : avgCycleSecs;

      const availableTimeSecs = planQty * row.definedCycleTime; // Plan Qty × Defined CT
      const actualTimeSecs    = compQty * actualCompCT;         // Actual Prod × Actual CT
      const reqTimeMins    = Math.round(availableTimeSecs / 60); // "Required / Available Time"
      const actualTimeMins = Math.round(actualTimeSecs / 60);    // "Actual Time"

      // --- Rejected / Accepted (component units) ---
      // Prefer the quality-log batch count; fall back to the GOOD flag ratio.
      const compMultiplier = compQty > 0 && row.actualQty > 0 ? compQty / row.actualQty : 1;
      const fallbackRejects = Math.round((row.actualQty - row.goodQty) * compMultiplier);
      const logRejects = qualityByPartName[row.itemDescription ?? ""]?.rejected
        ?? qualityByPartName[(getMaterialByModel(materials, row.model)?.partName) ?? ""]?.rejected;
      const rejects  = logRejects != null ? logRejects : fallbackRejects;
      const accepted = Math.max(0, compQty - rejects);

      // Same availability rule as the Dashboard: planned time less every
      // recorded stop, including stops classified as Idle.
      const totalDowntimeSecs = row.downtimeSecs + row.idleSecs;
      const totalDowntimeMins = Math.round(totalDowntimeSecs / 60);
      const A = availableTimeSecs > 0
        ? Math.max(0, Math.min(1, (availableTimeSecs - totalDowntimeSecs) / availableTimeSecs))
        : 0;
      // Performance uses ideal production time divided by the net operating
      // time, matching the Dashboard OEE calculation.
      const netOperatingSecs = Math.max(1, availableTimeSecs - totalDowntimeSecs);
      const P = row.definedCycleTime > 0
        ? Math.max(0, Math.min(1, (compQty * row.definedCycleTime) / netOperatingSecs))
        : 1;
      // Q% = Accepted Qty / Actual Qty   (both in component units)
      const Q = compQty > 0 ? Math.min(1, accepted / compQty) : 1;

      const availability = Math.round(A * 1000) / 10;
      const performance  = Math.round(P * 1000) / 10;
      const quality      = Math.round(Q * 1000) / 10;
      const oee = Math.round((availability * performance * quality / 10000) * 10) / 10;

      const goodComp = accepted;

      // Energy
      const idealEnergyWh  = Math.round((planQty * row.definedCycleTime * MACHINE_POWER_KW) / 3600);
      const actualEnergyWh = Math.round((row.actualQty * avgCycleSecs * MACHINE_POWER_KW) / 3600);

      return {
        srNo: idx + 1,
        dateFrom: row.dateFrom,
        dateTo: row.dateTo,
        date: row.dateFrom,                       // back-compat
        startedAt: fmtAbs(row.startedAtMs, row.startedAt),
        completedAt: fmtAbs(row.completedAtMs, row.completedAt),
        sapCode: row.sapCode,
        itemDescription: row.itemDescription,
        model: row.model,
        planQty,
        planQtyFromConfig,
        actualQty: row.actualQty,                 // Sheet Qty
        isPunching: punching,
        componentQty: compQty,                    // PRIMARY production count
        goodComponentQty: goodComp,
        componentCycleTime: compCT,
        reqTimeMins,
        actualTimeMins,
        definedCycleTime: row.definedCycleTime,
        sheetCycleTime: sheetCT,
        machineCycleSecs: avgCycleSecs,
        noOfSheet, compPerSheet, loadUnload,
        stdChangeoverTime: row.stdChangeoverTime,
        actualChangeoverTime: Math.round(coSt.totalMins * 10) / 10,
        plannedChangeovers: coSt.count,
        actualChangeovers: coSt.count,
        coOverrunMins: coSt.overrunMins,
        coOverrunCount: coSt.overrunCount,
        idleMins, downMins, totalDowntimeMins, rejects, accepted, lossMins,
        oee: isNaN(oee) ? 0 : oee,
        availability, performance, quality,
        idealEnergyWh, actualEnergyWh,
        // OEE breakdown inputs (component units) — surfaced in the UI
        actualCompCT, availableTimeSecs, actualTimeSecs, netOperatingSecs,
        downtimeSecs: row.downtimeSecs, idleSecs: row.idleSecs,
        goodQty: row.goodQty,
      };
    });
};

/* ==================================================================
 * 5. Reusable presentational pieces
 * ================================================================== */
const Spinner = ({ cls = "w-4 h-4" }) => <FiLoader className={`animate-spin ${cls}`} />;

const StatCard = ({ icon: Icon, label, value, sub, tone = "slate", primary = false, delta }) => {
  const t = TONE[tone] || TONE.slate;
  return (
    <div className={`relative flex flex-col rounded-xl border ${t.card} px-3.5 py-3 overflow-hidden
      ${primary ? "sm:col-span-2 ring-1 ring-inset ring-blue-300/40" : ""}`}>
      <span className={`absolute left-0 top-0 h-full w-1 ${t.accent}`} />
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${t.sub}`}>{label}</span>
        {Icon && <Icon className={`w-3.5 h-3.5 ${t.sub}`} />}
      </div>
      <div className="flex items-end gap-2 mt-1">
        <span className={`font-mono font-bold ${primary ? "text-2xl" : "text-lg"} ${t.text}`}>{value}</span>
        {delta != null && (
          <span className={`text-[10px] font-bold mb-1 flex items-center gap-0.5 ${delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
            {delta >= 0 ? <FiArrowUp className="w-3 h-3" /> : <FiArrowDown className="w-3 h-3" />}
            {Math.abs(delta).toLocaleString()}
          </span>
        )}
      </div>
      {sub && <span className={`text-[10px] mt-0.5 ${t.sub}`}>{sub}</span>}
    </div>
  );
};

const SectionCard = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const EmptyState = ({ icon: Icon = FiPackage, text }) => (
  <div className="flex flex-col items-center gap-2 text-slate-300 py-14">
    <Icon className="w-10 h-10 opacity-40" />
    <p className="text-sm text-slate-400 font-medium">{text}</p>
  </div>
);

// Delta badge (component-aware)
const Delta = ({ actual, plan }) => {
  if (!plan) return null;
  const diff = actual - plan;
  return (
    <span className={`text-[9px] font-bold ${diff >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
      {diff >= 0 ? "▲" : "▼"}{Math.abs(diff).toLocaleString()}
    </span>
  );
};

/* ==================================================================
 * 6. Summary table column config
 * ------------------------------------------------------------------
 * CHANGE: table is now driven by a column config array. This powers
 * sorting, column-visibility toggles and CSV/Excel export from one
 * source of truth (no more duplicated header/cell/CSV definitions).
 * ================================================================== */
const safePct = (num, den) => (den > 0 ? Math.min(100, (num / den) * 100) : 0);

const buildColumns = (materials) => [
  { key: "srNo", label: "Sr.", group: "info", sortable: true, always: true, align: "left",
    cell: (r) => <span className="text-[11px] text-slate-400 font-mono">{r.srNo}</span>,
    csv: (r) => r.srNo },
  { key: "date", label: "Date", group: "info", sortable: true, align: "left",
    sortVal: (r) => r.dateFrom || "",
    cell: (r) => (
      <span className="text-xs font-mono text-slate-600 whitespace-nowrap">
        {r.dateFrom === r.dateTo ? toDisplayDate(r.dateFrom)
          : `${toDisplayDate(r.dateFrom)} → ${toDisplayDate(r.dateTo)}`}
      </span>
    ),
    csv: (r) => (r.dateFrom === r.dateTo ? r.dateFrom : `${r.dateFrom}..${r.dateTo}`) },
  { key: "startedAt", label: "Started", group: "info", sortable: true, align: "left",
    cell: (r) => <span className="text-[11px] font-mono text-slate-600 whitespace-nowrap">{r.startedAt || "-"}</span>,
    csv: (r) => r.startedAt || "" },
  { key: "completedAt", label: "Completed", group: "info", sortable: true, align: "left",
    cell: (r) => <span className="text-[11px] font-mono text-slate-600 whitespace-nowrap">{r.completedAt || "-"}</span>,
    csv: (r) => r.completedAt || "" },
  { key: "sapCode", label: "SAP Code", group: "info", sortable: true, align: "left",
    cell: (r) => <span className="font-mono font-bold text-blue-600 text-xs">{r.sapCode}</span>,
    csv: (r) => r.sapCode },
  { key: "itemDescription", label: "Item Description", group: "info", sortable: true, always: true, align: "left", wide: true,
    cell: (r) => (
      materials.some((m) => m.partName === r.itemDescription)
        ? <span className="font-semibold text-blue-700 text-xs leading-snug block max-w-[240px]">{r.itemDescription}</span>
        : (
          <div className="max-w-[240px]">
            <span className="font-mono text-[11px] text-slate-600 block leading-snug">{r.itemDescription}</span>
            <span className="text-[9px] font-bold text-rose-500 flex items-center gap-0.5"><FiAlertTriangle className="w-2.5 h-2.5" /> Master not found</span>
          </div>
        )
    ),
    csv: (r) => r.itemDescription },
  { key: "planQty", label: "Plan Qty", group: "qty", sortable: true, align: "center",
    cell: (r) => (
      <div className="text-center">
        <span className="font-mono font-semibold text-slate-700">{r.planQty.toLocaleString()}</span>
        <div className="text-[9px] font-mono text-slate-400">
          {r.planQtyFromConfig ? "from Planning Config" : `${r.componentQty}×1.05 (estimated)`}
        </div>
      </div>
    ),
    csv: (r) => r.planQty },
  { key: "componentQty", label: "Components Produced", group: "qty", sortable: true, always: true, align: "center",
    cell: (r) => (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`font-bold font-mono text-sm ${r.componentQty >= r.planQty ? "text-emerald-600" : r.isPunching ? "text-violet-600" : "text-blue-500"}`}>
          {r.componentQty.toLocaleString()}
        </span>
        <Delta actual={r.componentQty} plan={r.planQty} />
        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${r.componentQty >= r.planQty ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${safePct(r.componentQty, r.planQty)}%` }} />
        </div>
        {r.isPunching && r.noOfSheet > 0 && r.compPerSheet > 0 && (
          <div className="text-[9px] font-mono text-slate-400">{r.noOfSheet}×{r.compPerSheet}×{r.actualQty}</div>
        )}
      </div>
    ),
    csv: (r) => r.componentQty },
  { key: "actualQty", label: "Sheet Qty", group: "qty", sortable: true, align: "center",
    cell: (r) => <span className="font-bold font-mono text-sm text-slate-600">{r.actualQty.toLocaleString()}</span>,
    csv: (r) => r.actualQty },
  { key: "reqTimeMins", label: "Required Time", group: "time", sortable: true, align: "center",
    cell: (r) => <span className="font-mono text-violet-600 font-semibold">{r.reqTimeMins}</span>,
    csv: (r) => r.reqTimeMins },
  { key: "actualTimeMins", label: "Actual Time", group: "time", sortable: true, align: "center",
    cell: (r) => <span className={`font-mono font-semibold ${r.actualTimeMins > r.reqTimeMins ? "text-amber-600" : "text-violet-600"}`}>{r.actualTimeMins}</span>,
    csv: (r) => r.actualTimeMins },
  { key: "totalDowntimeMins", label: "Downtime", group: "time", sortable: true, align: "center",
    cell: (r) => <span className="font-mono font-semibold text-rose-600">{r.totalDowntimeMins} min</span>,
    csv: (r) => r.totalDowntimeMins },
  { key: "definedCycleTime", label: "Standard CT", group: "ct", sortable: true, align: "center",
    cell: (r) => <span className="font-mono font-semibold text-cyan-600">{r.definedCycleTime > 0 ? r.definedCycleTime : "-"}</span>,
    csv: (r) => r.definedCycleTime },
  { key: "sheetCycleTime", label: "Sheet CT", group: "ct", sortable: true, align: "center",
    cell: (r) => {
      const good = r.sheetCycleTime <= r.definedCycleTime;
      return (
        <div className="text-center">
          <span className={`font-mono font-bold ${good ? "text-emerald-600" : "text-amber-600"}`}>{r.sheetCycleTime > 0 ? r.sheetCycleTime : "-"}</span>
          {r.isPunching && r.noOfSheet > 0 && <div className="text-[9px] font-mono text-slate-400">{r.machineCycleSecs} ÷ {r.noOfSheet}</div>}
        </div>
      );
    },
    csv: (r) => r.sheetCycleTime },
  { key: "componentCycleTime", label: "Actual CT", group: "ct", sortable: true, align: "center",
    sortVal: (r) => r.componentCycleTime ?? -1,
    cell: (r) => (
      r.componentCycleTime != null
        ? (
          <div className="text-center">
            <span className="font-mono font-semibold text-indigo-600">{r.componentCycleTime}</span>
            <div className="text-[9px] font-mono text-slate-400">({r.sheetCycleTime}+{r.loadUnload}) ÷ {r.compPerSheet}</div>
          </div>
        )
        : <span className="text-slate-300 text-xs">—</span>
    ),
    csv: (r) => r.componentCycleTime ?? "" },
  { key: "accepted", label: "Accepted", group: "quality", sortable: true, align: "center",
    sortVal: (r) => r.accepted,
    cell: (r) => <span className="font-bold font-mono text-emerald-600">{r.accepted.toLocaleString()}</span>,
    csv: (r) => r.accepted },
  { key: "rejected", label: "Rejected", group: "quality", sortable: true, align: "center",
    sortVal: (r) => r.rejects,
    cell: (r) => <span className="font-bold font-mono text-rose-500">{r.rejects.toLocaleString()}</span>,
    csv: (r) => r.rejects },
  { key: "availability", label: "A (%)", group: "oee", sortable: true, align: "center",
    cell: (r) => (
      <div className="text-center font-mono font-semibold text-slate-600">{r.availability}%
        <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">({r.reqTimeMins} - {r.totalDowntimeMins}) / {r.reqTimeMins} x 100</div>
      </div>
    ),
    csv: (r) => r.availability },
  { key: "performance", label: "P (%)", group: "oee", sortable: true, align: "center",
    cell: (r) => (
      <div className="text-center font-mono font-semibold text-slate-600">{r.performance}%
        <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">({r.componentQty} x {r.definedCycleTime}) / (({r.reqTimeMins} - {r.totalDowntimeMins}) x 60) x 100</div>
      </div>
    ),
    csv: (r) => r.performance },
  { key: "quality", label: "Q (%)", group: "oee", sortable: true, align: "center",
    cell: (r) => (
      <div className="text-center font-mono font-semibold text-slate-600">{r.quality}%
        <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">{r.accepted} / {r.componentQty} x 100</div>
      </div>
    ),
    csv: (r) => r.quality },
  { key: "oee", label: "OEE (%)", group: "oee", sortable: true, always: true, align: "center",
    cell: (r) => (
      <div className="text-center">
        <div className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border ${oeeBgColor(r.oee)}`}>
          <span className={`text-sm font-bold font-mono ${oeeTextColor(r.oee)}`}>{r.oee}%</span>
          <div className="w-10 h-1 bg-white/60 rounded-full overflow-hidden mt-0.5">
            <div className={`h-full rounded-full ${oeeBarColor(r.oee)}`} style={{ width: `${r.oee}%` }} />
          </div>
        </div>
        <div className="text-[9px] font-mono text-slate-400 mt-0.5 whitespace-nowrap">{r.availability} x {r.performance} x {r.quality} / 10,000</div>
      </div>
    ),
    csv: (r) => r.oee },
];

const GROUP_META = {
  info:    { label: "Part Info",      tone: "text-slate-600  bg-slate-100" },
  qty:     { label: "Production Qty",  tone: "text-blue-700   bg-blue-50" },
  time:    { label: "Time (min)",      tone: "text-violet-700 bg-violet-50" },
  ct:      { label: "Cycle Time (s)",  tone: "text-cyan-700   bg-cyan-50" },
  quality: { label: "Quality Log",     tone: "text-emerald-700 bg-emerald-50" },
  oee:     { label: "OEE (A × P × Q)", tone: "text-amber-700  bg-amber-50" },
};

// Collapse a column list into header-band segments [{group, count}].
const groupSpans = (cols) => {
  const segs = [];
  cols.forEach((c) => {
    const last = segs[segs.length - 1];
    if (last && last.group === c.group) last.count += 1;
    else segs.push({ group: c.group, count: 1 });
  });
  return segs;
};

/* ==================================================================
 * 7. Export helpers
 * ================================================================== */
// Which summary columns are additive (SUM) vs averaged (AVG) for footer rows.
const AGG_SUM = new Set(["planQty", "componentQty", "actualQty", "reqTimeMins", "actualTimeMins", "totalDowntimeMins", "accepted", "rejected"]);
const AGG_AVG = new Set(["availability", "performance", "quality", "oee"]);

const computeTotals = (rows, columns) => {
  const out = {};
  columns.forEach((c) => {
    if (AGG_SUM.has(c.key)) out[c.key] = rows.reduce((s, r) => s + (Number(c.csv(r)) || 0), 0);
    else if (AGG_AVG.has(c.key)) out[c.key] = rows.length ? rows.reduce((s, r) => s + (Number(c.csv(r)) || 0), 0) / rows.length : 0;
    else out[c.key] = null;
  });
  return out;
};
const fmtTotal = (c, totals, first) => {
  if (first) return "TOTAL / AVG";
  if (AGG_SUM.has(c.key)) return Math.round(totals[c.key]).toLocaleString();
  if (AGG_AVG.has(c.key)) return `${totals[c.key].toFixed(1)}%`;
  return "";
};
const reportMeta = (start, end) => ({ start, end, generated: new Date().toLocaleString() });

const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadBlob = (content, mime, filename) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const exportCSV = (rows, columns) => {
  const cols = columns.filter((c) => c.csv);
  const header = cols.map((c) => csvEscape(c.label)).join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(c.csv(r))).join(",")).join("\n");
  downloadBlob(header + "\n" + body, "text/csv;charset=utf-8;", "production_report.csv");
};
// Formatted Excel without extra deps: an HTML table with the ms-excel mime
// opens natively in Excel. Inline styles carry across as cell formatting:
// title banner, bold dark header, zebra rows, right-aligned numbers, totals row.
const exportExcel = async (rows, columns, meta) => {
  const logo = await getWrlLogoBase64();
  const cols = columns.filter((c) => c.csv);
  const totals = computeTotals(rows, cols);
  const span = cols.length;
  const th = (c) => `<th style="background:#1e3a8a;color:#ffffff;font-weight:bold;border:1px solid #1e293b;padding:6px;text-align:${c.align === "center" ? "center" : "left"}">${c.label}</th>`;
  const td = (c, v) => {
    const num = v !== "" && v != null && !isNaN(parseFloat(v)) && isFinite(v);
    return `<td style="border:1px solid #cbd5e1;padding:4px;text-align:${num ? "right" : "left"}">${v ?? ""}</td>`;
  };
  const head = `<tr>${cols.map(th).join("")}</tr>`;
  const body = rows.map((r, i) =>
    `<tr style="background:${i % 2 ? "#f1f5f9" : "#ffffff"}">${cols.map((c) => td(c, c.csv(r))).join("")}</tr>`).join("");
  const foot = `<tr>${cols.map((c, i) =>
    `<td style="background:#dbeafe;font-weight:bold;border:1px solid #1e293b;padding:5px;text-align:${c.align === "center" ? "center" : "left"}">${fmtTotal(c, totals, i === 0)}</td>`).join("")}</tr>`;
  const logoCell = logo ? `<td style="width:90px;padding:6px"><img src="${logo}" width="80" height="40" /></td>` : "";
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <style>table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11px}</style></head>
    <body>
      <table><tr>${logoCell}<td colspan="${span}" style="font-size:15px;font-weight:bold;padding:8px;text-align:center">Part Process — Production Report</td></tr>
      <tr><td colspan="${span + (logo ? 1 : 0)}" style="font-size:10px;color:#475569;padding:0 8px 8px;text-align:center">${meta.start} → ${meta.end} · Generated ${meta.generated}</td></tr></table>
      <table border="1">${head}${body}${foot}</table>
    </body></html>`;
  downloadBlob(html, "application/vnd.ms-excel", "production_report.xls");
};

// Print-only report block (hidden on screen, shown only when printing/PDF).
// Direct PDF generation. Builds the document from data via jsPDF + autotable,
// so the output contains ONLY the report — no app sidebar/header/username,
// since we never capture the page DOM.
const exportPDF = async (rows, columns, meta) => {
  const logo = await getWrlLogoBase64();
  const cols = columns.filter((c) => c.csv);
  const segs = groupSpans(cols);
  const totals = computeTotals(rows, cols);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginX = 24;
  const titleX = logo ? marginX + 56 : marginX;

  if (logo) doc.addImage(logo, "PNG", marginX, 14, 44, 22);

  // Title + meta (plain ASCII to stay safe across PDF fonts)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Part Process - Production Report", titleX, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`${meta.start} to ${meta.end}   |   Generated ${meta.generated}   |   ${rows.length} parts`, titleX, 42);
  doc.setTextColor(0);

  // Two header rows: coloured group band + column labels
  const groupRow = segs.map((s) => ({
    content: (GROUP_META[s.group] || GROUP_META.info).label,
    colSpan: s.count,
    styles: { halign: "center", fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: "bold" },
  }));
  const labelRow = cols.map((c) => ({
    content: c.label,
    styles: { halign: c.align === "center" ? "center" : "left" },
  }));
  const body = rows.map((r) => cols.map((c) => {
    const v = c.csv(r);
    return v == null ? "" : String(v);
  }));
  const footRow = cols.map((c, i) => ({
    content: fmtTotal(c, totals, i === 0),
    styles: { halign: c.align === "center" ? "center" : "left", fontStyle: "bold" },
  }));
  const columnStyles = {};
  cols.forEach((c, i) => { columnStyles[i] = { halign: c.align === "center" ? "center" : "left" }; });

  autoTable(doc, {
    head: [groupRow, labelRow],
    body,
    foot: [footRow],
    startY: 52,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2.5, overflow: "linebreak", lineColor: [203, 213, 225], lineWidth: 0.4 },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", lineColor: [30, 41, 59] },
    footStyles: { fillColor: [219, 234, 254], textColor: [15, 23, 42], fontStyle: "bold", lineColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    didDrawPage: (data) => {
      // page number footer
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(str, doc.internal.pageSize.getWidth() - marginX, doc.internal.pageSize.getHeight() - 12, { align: "right" });
      doc.setTextColor(0);
    },
  });

  doc.save("production_report.pdf");
};

/* ==================================================================
 * 8. Main component
 * ================================================================== */
const PAGE_SIZES = [10, 25, 50, 100];

const PartProcessProductionReport = () => {
  const materials = useSelector(selectMaterials);
  const plans = useSelector(selectPlans);
  // CHANGE: memoise the filtered shift list. `.filter()` produced a NEW array
  // every render, which re-created `fetchData` on every render and defeated
  // useCallback/useMemo downstream.
  const allShifts = useSelector(selectShifts);
  const configShifts = useMemo(() => allShifts.filter((s) => s.status), [allShifts]);

  const [startTime, setStartTime] = useState(`${todayStr()} 08:00`);
  const [endTime, setEndTime]     = useState(`${todayStr()} 20:00`);
  const [loading, setLoading]     = useState(false);
  const [ydayLoading, setYdayLoading]   = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [records, setRecords]     = useState([]);
  const [rawRecords, setRawRecords] = useState([]);
  const [dbQLogs, setDbQLogs]     = useState([]);
  const [showRaw, setShowRaw]     = useState(false);
  const [viewMode, setViewMode]   = useState("summary"); // summary | detail

  // Table controls
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState("componentQty");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage]       = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Sheet Qty + Sheet CT hidden by default; toggle on from the Columns menu.
  const [hiddenCols, setHiddenCols] = useState({ actualQty: true, sheetCycleTime: true });
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // Advanced filters
  const [modelFilter, setModelFilter]   = useState("ALL");
  const [shiftFilter, setShiftFilter]   = useState("ALL");

  const isAnyLoading = loading || ydayLoading || todayLoading;

  /* ----- demo fallback (now includes downtime so OEE is realistic) ----- */
  const DEMO_RECORDS = useMemo(() => ([
    { srNo: 1, shift: "Shift 2", state: "Production", model: "1127024-D-UNIT-FRAME-D150H", startTime: "08:00:41", endTime: "08:01:22", duration: "00:00:45", qty: 1, quality: "GOOD", operator: "OP-12", downtimeReason: null },
    { srNo: 2, shift: "Shift 2", state: "Production", model: "1127024-D-UNIT-FRAME-D150H", startTime: "08:01:22", endTime: "08:02:10", duration: "00:00:48", qty: 1, quality: "GOOD", operator: "OP-12", downtimeReason: null },
    { srNo: 3, shift: "Shift 2", state: "Downtime", model: null, startTime: "08:02:10", endTime: "08:15:46", duration: "00:13:36", qty: 0, quality: null, operator: null, downtimeReason: "Tool Change" },
    ...Array.from({ length: 55 }, (_, i) => ({
      srNo: i + 4, shift: "Shift 2", state: "Production",
      model: i % 3 === 0 ? "0109855-C-INR-BTM-550G-RT-AS" : "1127024-D-UNIT-FRAME-D150H",
      startTime: `${pad(8 + Math.floor(i / 8))}:${pad((i * 7) % 60)}:00`,
      endTime: `${pad(8 + Math.floor(i / 8))}:${pad(((i * 7) + 43) % 60)}:00`,
      duration: `00:00:${pad(41 + (i % 12))}`,
      qty: 1, quality: i % 15 === 0 ? null : "GOOD", operator: `OP-${10 + (i % 3)}`, downtimeReason: null,
    })),
    { srNo: 60, shift: "Shift 2", state: "Downtime", model: null, startTime: "12:10:00", endTime: "12:17:30", duration: "00:07:30", qty: 0, quality: null, operator: null, downtimeReason: "Assign" },
    ...Array.from({ length: 12 }, (_, i) => ({
      srNo: i + 61, shift: "Shift 1", state: "Production", model: "0109855-D-INR-BTM-550G-RT-AS",
      startTime: `0${pad(6 + Math.floor(i / 4))}:${pad((i * 9) % 60)}:00`,
      endTime: `0${pad(6 + Math.floor(i / 4))}:${pad(((i * 9) + 38) % 60)}:00`,
      duration: `00:00:${pad(38 + (i % 8))}`,
      qty: 1, quality: "GOOD", operator: `OP-${20 + (i % 2)}`, downtimeReason: null,
    })),
  ].map((r) => ({ ...r, _prodDay: todayStr(), _absMs: null, _absMsEnd: null }))), []);

  /* ----- data fetch ----- */
  const fetchData = useCallback(async (start, end, setLoadFn) => {
    const startMs = new Date(start.replace(" ", "T") + ":00").getTime();
    const endMs   = new Date(end.replace(" ", "T") + ":00").getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      toast.error("Invalid time range.");
      return;
    }

    setLoadFn(true); setRecords([]); setRawRecords([]); setPage(1);
    try {
      const dayStartSec = configShifts.length
        ? Math.min(...configShifts.map((s) => toMins(s.startTime))) * 60
        : 0;

      const prodDayOf = (ms) => {
        const d = new Date(ms);
        const tod = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
        const base = new Date(d); base.setHours(0, 0, 0, 0);
        if (tod < dayStartSec) base.setDate(base.getDate() - 1);
        return base;
      };

      const dates = [];
      const cur  = prodDayOf(startMs);
      const last = prodDayOf(endMs - 1000);
      while (cur <= last) { dates.push(fmtYMD(cur)); cur.setDate(cur.getDate() + 1); }

      const res = await axios.get(`${PART_PROCESS_API}/records-range`, {
        params: { startDate: dates[0], endDate: dates[dates.length - 1] },
        withCredentials: true,
      });
      const allRows = res.data?.data ?? [];

      const allMapped = [];
      const allRaw = [];

      for (const date of dates) {
        const raw = allRows.filter((r) => String(r.EventDate).slice(0, 10) === date);
        raw.forEach((r) => {
          const tod = todSecs(r.StartTime);
          let calDate = date;
          if (tod !== null && tod < dayStartSec) {
            const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + 1);
            calDate = fmtYMD(d);
          }
          allRaw.push({ _fetchDate: date, _calDate: calDate, ...r });
        });

        const midnight = new Date(date + "T00:00:00").getTime();
        const mapped = raw.map((r, i) => ({ ...mapDbRecord(r, i), eventDate: date })).map((r) => {
          const tod    = todSecs(r.startTime);
          const todEnd = todSecs(r.endTime);
          const absMs  = tod === null ? null : midnight + (tod < dayStartSec ? 86400000 : 0) + tod * 1000;
          let absMsEnd = null;
          if (absMs !== null && todEnd !== null) {
            const sm = new Date(absMs); sm.setHours(0, 0, 0, 0);
            absMsEnd = sm.getTime() + todEnd * 1000;
            if (absMsEnd < absMs) absMsEnd += 86400000;
          }
          return { ...r, _prodDay: date, _absMs: absMs, _absMsEnd: absMsEnd };
        });
        allMapped.push(...mapped);
      }

      const filtered = allMapped
        .filter((r) => r._absMs !== null && r._absMs >= startMs && r._absMs < endMs && parseDurSecs(r.duration) <= 86400)
        .sort((a, b) => b._absMs - a._absMs);

      setRecords(filtered);
      setRawRecords(allRaw);

      try {
        const qRes = await axios.get(`${PART_PROCESS_API}/quality-log`, {
          params: { startDate: dates[0], endDate: dates[dates.length - 1] },
          withCredentials: true,
        });
        setDbQLogs(qRes.data?.data ?? []);
      } catch { setDbQLogs([]); }

      const prodCount = filtered.filter((r) => r.state === "Production").length;
      toast.success(`${prodCount} production + ${filtered.length - prodCount} downtime records loaded`);
    } catch {
      setRecords(DEMO_RECORDS);
      setDbQLogs([]);
      toast("Demo data loaded - connect to DB for live data", { icon: "⚡" });
    } finally { setLoadFn(false); }
  }, [configShifts, DEMO_RECORDS]);

  const handleQuery = () => {
    if (!startTime || !endTime) { toast.error("Select a time range."); return; }
    fetchData(startTime, endTime, setLoading);
  };
  const handleToday = () => {
    const start = `${todayStr()} 08:00`; const end = `${offsetDate(1)} 08:00`;
    setStartTime(start); setEndTime(end); fetchData(start, end, setTodayLoading);
  };
  const handleYesterday = () => {
    const start = `${offsetDate(-1)} 08:00`; const end = `${todayStr()} 08:00`;
    setStartTime(start); setEndTime(end); fetchData(start, end, setYdayLoading);
  };

  /* ----- filtered records (model / shift advanced filters) ----- */
  const filteredRecords = useMemo(() => records.filter((r) => {
    if (modelFilter !== "ALL" && r.model !== modelFilter) return false;
    if (shiftFilter !== "ALL" && r.shift !== shiftFilter) return false;
    return true;
  }), [records, modelFilter, shiftFilter]);

  /* ----- quality log lookup (computed before summary so OEE Quality can use it) ----- */
  const qualityByPartName = useMemo(() => {
    const map = {};
    dbQLogs.forEach((e) => {
      const key = e.PartName || e.partName || e.Model || e.model || "";
      if (!key) return;
      if (!map[key]) map[key] = { inspected: 0, rejected: 0 };
      const insp = parseInt(e.InspectedQty ?? e.inspectedQty ?? 0, 10);
      const rej  = parseInt(e.RejectedQty ?? e.rejectedQty ?? 0, 10);
      map[key].inspected = Math.max(map[key].inspected, insp);
      map[key].rejected += rej;
    });
    return map;
  }, [dbQLogs]);

  /* ----- aggregated summary ----- */
  const summary = useMemo(
    () => aggregateRecords(filteredRecords, materials, qualityByPartName, plans),
    [filteredRecords, materials, qualityByPartName, plans]);

  /* ----- columns ----- */
  const columns = useMemo(() => buildColumns(materials), [materials]);
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols[c.key]), [columns, hiddenCols]);
  // Group-header spans — recomputed so colSpans track hidden columns.
  const groupSegments = useMemo(() => groupSpans(visibleColumns), [visibleColumns]);

  /* ----- search + sort + paginate ----- */
  const searchedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter((r) =>
      r.sapCode.toLowerCase().includes(q) || r.itemDescription.toLowerCase().includes(q));
  }, [summary, search]);

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    const getVal = col?.sortVal || ((r) => r[sortKey]);
    const arr = [...searchedRows].sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb));
      }
      return (va ?? 0) - (vb ?? 0);
    });
    if (sortDir === "desc") arr.reverse();
    return arr.map((r, i) => ({ ...r, srNo: i + 1 }));
  }, [searchedRows, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRows, safePage, pageSize]);

  useEffect(() => { setPage(1); }, [search, modelFilter, shiftFilter, pageSize]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  /* ----- totals (over the searched set, component-first) ----- */
  const totals = useMemo(() => {
    const rows = searchedRows;
    const n = rows.length || 1;
    const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
    return {
      planQty: sum((r) => r.planQty),
      componentQty: sum((r) => r.componentQty),
      actualQty: sum((r) => r.actualQty),
      rejects: sum((r) => r.rejects),
      accepted: sum((r) => r.accepted),
      lossMins: sum((r) => r.lossMins),
      totalDowntimeMins: sum((r) => r.totalDowntimeMins),
      idleMins: sum((r) => r.idleMins),
      availability: (sum((r) => r.availability) / n).toFixed(1),
      performance: (sum((r) => r.performance) / n).toFixed(1),
      quality: (sum((r) => r.quality) / n).toFixed(1),
      oee: (sum((r) => r.oee) / n).toFixed(1),
      idealEnergyWh: sum((r) => r.idealEnergyWh),
      actualEnergyWh: sum((r) => r.actualEnergyWh),
    };
  }, [searchedRows]);

  // Sheet→component multiplier (cached); used by the Detail view's Components column.
  const compMultiplierMap = useMemo(() => {
    const m = new Map();
    return (model) => {
      if (!model) return 1;
      if (m.has(model)) return m.get(model);
      const v = componentsPerUnit(materials, model);
      m.set(model, v);
      return v;
    };
  }, [materials]);

  const hasData = summary.length > 0;
  const modelOptions = useMemo(() => {
    const s = new Set();
    records.forEach((r) => { if (r.model) s.add(r.model); });
    return [...s].sort();
  }, [records]);
  const shiftOptions = useMemo(() => {
    const s = new Set();
    records.forEach((r) => { if (r.shift) s.add(r.shift); });
    return [...s].sort();
  }, [records]);

  /* ================================================================
   * 10. Render
   * ================================================================ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">

      {/* ---------- HEADER ---------- */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-5 py-3 flex items-center justify-between shadow-sm shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">Part Process — Production Report</h1>
          <p className="text-[11px] text-slate-400">Component Qty · OEE · Cycle Time</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2 flex-wrap">
            <StatCard icon={FiGrid} label="Components" value={totals.componentQty.toLocaleString()} tone="violet" />
            <StatCard icon={FiPackage} label="Sheets" value={totals.actualQty.toLocaleString()} tone="blue" />
            <StatCard icon={FiAlertTriangle} label="Rejects" value={totals.rejects.toLocaleString()} tone="rose" />
            <StatCard icon={FiClock} label="Downtime" value={`${totals.totalDowntimeMins} min`} tone="amber" />
            <StatCard icon={FiActivity} label="Avg OEE" value={`${totals.oee}%`} tone="emerald" />
          </div>
        )}
      </div>

      {/* ---------- BODY (screen only) ---------- */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 flex flex-col gap-3">

        {/* ----- FILTERS ----- */}
        <SectionCard className="p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <FiFilter className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Filters</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[160px] flex-1">
              <DateTimePicker label="Start Time" name="start" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <DateTimePicker label="End Time" name="end" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            {/* advanced: model / shift */}
            <div className="min-w-[150px]">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Model</label>
              <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-600 focus:ring-2 focus:ring-blue-200 outline-none">
                <option value="ALL">All models</option>
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Shift</label>
              <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-600 focus:ring-2 focus:ring-blue-200 outline-none">
                <option value="ALL">All shifts</option>
                {shiftOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pb-0.5 shrink-0 flex-wrap">
              <button onClick={handleYesterday} disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 text-white"}`}>
                {ydayLoading ? <Spinner /> : <FiCalendar className="w-3.5 h-3.5" />} Yesterday
              </button>
              <button onClick={handleToday} disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                {todayLoading ? <Spinner /> : <FiClock className="w-3.5 h-3.5" />} Today
              </button>
              <button onClick={handleQuery} disabled={isAnyLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}>
                {loading ? <Spinner /> : <FiSearch className="w-3.5 h-3.5" />} {loading ? "Loading…" : "Query"}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ----- VIEW TABS + EXPORT ----- */}
        <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1 flex-wrap">
            {[
              ["summary", FiBarChart2, "Summary"],

            ].map(([mode, Icon, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === mode ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          {hasData && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => exportCSV(sortedRows, visibleColumns)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
                <FiDownload className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => exportExcel(sortedRows, visibleColumns, reportMeta(startTime, endTime))} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-emerald-600">
                <FiFileText className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={() => exportPDF(sortedRows, visibleColumns, reportMeta(startTime, endTime))} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-rose-600">
                <FiFile className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          )}
        </div>

        {/* ================= SUMMARY TABLE ================= */}
        {viewMode === "summary" && (
          <SectionCard className="overflow-hidden flex flex-col flex-1">
            {/* table toolbar */}
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-slate-100 flex-wrap">
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SAP code / description…"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-56 focus:ring-2 focus:ring-blue-200 outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">{sortedRows.length} rows</span>
                <div className="relative">
                  <button onClick={() => setColMenuOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
                    <FiColumns className="w-3.5 h-3.5" /> Columns <FiChevronDown className="w-3 h-3" />
                  </button>
                  {colMenuOpen && (
                    <div className="absolute right-0 mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-56 max-h-72 overflow-auto">
                      {columns.map((c) => (
                        <label key={c.key} className={`flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-slate-50 ${c.always ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                          <input type="checkbox" disabled={c.always} checked={!hiddenCols[c.key]}
                            onChange={() => setHiddenCols((h) => ({ ...h, [c.key]: !h[c.key] }))} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="border-separate border-spacing-0 w-full">
                <thead className="sticky top-0 z-10">
                  {/* grouped header band */}
                  <tr>
                    {groupSegments.map((s, i) => {
                      const g = GROUP_META[s.group] || GROUP_META.info;
                      return (
                        <th key={`${s.group}-${i}`} colSpan={s.count}
                          className={`px-2 py-1.5 text-[10px] font-bold border-b border-r border-slate-300 text-center ${g.tone}`}>
                          {g.label}
                        </th>
                      );
                    })}
                  </tr>
                  {/* sortable single-row header with group colour accents */}
                  <tr>
                    {visibleColumns.map((c) => {
                      const g = GROUP_META[c.group] || GROUP_META.info;
                      const active = sortKey === c.key;
                      return (
                        <th key={c.key}
                          onClick={() => c.sortable && toggleSort(c.key)}
                          className={`px-2.5 py-2 text-[10px] font-semibold border-b border-r border-slate-200 whitespace-nowrap align-middle ${g.tone} ${c.align === "center" ? "text-center" : "text-left"} ${c.sortable ? "cursor-pointer select-none hover:brightness-95" : ""} ${c.wide ? "min-w-[150px]" : ""}`}>
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            {c.sortable && (active
                              ? (sortDir === "asc" ? <FiArrowUp className="w-3 h-3" /> : <FiArrowDown className="w-3 h-3" />)
                              : <FiChevronDown className="w-2.5 h-2.5 opacity-30" />)}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {isAnyLoading ? (
                    <tr><td colSpan={visibleColumns.length} className="py-14 text-center">
                      <div className="flex justify-center items-center gap-2 text-slate-400">
                        <Spinner cls="w-5 h-5 text-blue-500" /><span className="text-sm">Computing production summary…</span>
                      </div>
                    </td></tr>
                  ) : pagedRows.length > 0 ? (
                    pagedRows.map((r) => (
                      <tr key={r.sapCode} className="hover:bg-blue-50/30 transition-colors even:bg-slate-50/30">
                        {visibleColumns.map((c) => (
                          <td key={c.key} className={`px-2.5 py-2.5 border-b border-r border-slate-100 ${c.align === "center" ? "text-center" : ""}`}>
                            {c.cell(r)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={visibleColumns.length} className="py-14 text-center">
                      <EmptyState text="No matching rows" />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            {sortedRows.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-100 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  Rows per page
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                    className="border border-slate-200 rounded px-1.5 py-1 text-xs outline-none">
                    {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span>· {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, sortedRows.length)} of {sortedRows.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={safePage === 1} className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><FiChevronsLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><FiChevronLeft className="w-3.5 h-3.5" /></button>
                  <span className="px-2 text-xs text-slate-600">{safePage} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><FiChevronRight className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><FiChevronsRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </SectionCard>
        )}


      </div>
    </div>
  );
};

export default PartProcessProductionReport;
