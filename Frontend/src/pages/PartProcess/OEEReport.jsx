/**
 * Part Process – OEE Report
 */
import { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import {
  FiActivity, FiBarChart2, FiCalendar, FiClock, FiDownload,
  FiFile, FiFileText, FiFilter, FiLoader, FiPackage, FiSearch,
  FiTrendingUp,
} from "react-icons/fi";
import DateTimePicker from "../../components/ui/DateTimePicker";
import {
  selectMaterials, selectShifts, getMaterialByModel,
  shiftPlannedProductionMins, toMins,
} from "../../redux/slices/masterConfigSlice";
import { mapDbRecord } from "../../utils/mapDbRecord.js";
import { enrichRecords } from "../../utils/productionLogic.js";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";
import { computeOEE } from "./usePartProcessOEE";
import { getWrlLogoBase64 } from "../../utils/reportLogo.js";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
);

/* ── date helpers ── */
const pad = (n) => (n < 10 ? "0" + n : "" + n);
const fmtYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr  = () => fmtYMD(new Date());
const offsetDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return fmtYMD(d); };
const toDisplayDate = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};
const todSecs = (t) => {
  if (!t) return null;
  let tp = String(t);
  if (tp.includes("T")) tp = tp.split("T")[1];
  else if (tp.length > 10 && tp.includes(" ")) tp = tp.split(" ")[1];
  const [h, m, sec] = tp.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 3600 + m * 60 + (sec || 0);
};

/* ── OEE colour helpers ── */
const oeeText = (v) => v >= 85 ? "text-emerald-600" : v >= 65 ? "text-amber-500" : "text-rose-500";
const oeeBg   = (v) => v >= 85 ? "bg-emerald-50 border-emerald-200" : v >= 65 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200";
const oeeBar  = (v) => v >= 85 ? "bg-emerald-500" : v >= 65 ? "bg-amber-500" : "bg-rose-500";
const oeeHex  = (v) => v >= 85 ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

/* ── atoms ── */
const Spinner = ({ cls = "w-4 h-4" }) => <FiLoader className={`animate-spin ${cls}`} />;

const SectionCard = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const EmptyState = ({ text }) => (
  <div className="flex flex-col items-center gap-2 text-slate-300 py-14">
    <FiPackage className="w-10 h-10 opacity-40" />
    <p className="text-sm text-slate-400 font-medium">{text}</p>
  </div>
);

const OEECard = ({ label, value, sub, colored = false }) => {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div className={`flex flex-col rounded-xl border px-4 py-3 ${colored ? oeeBg(value) : "bg-slate-50 border-slate-200"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-2xl font-bold font-mono mt-1 ${colored ? oeeText(value) : "text-slate-700"}`}>
        {value != null ? `${value}%` : "—"}
      </span>
      {sub && <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>}
      <div className="w-full h-1.5 bg-slate-200/70 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colored ? oeeBar(value) : "bg-slate-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/* ── export helpers ── */
const downloadBlob = (content, mime, filename) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const exportCSV = (daily, overall, start, end) => {
  const header = "Date,OEE (%),Availability (%),Performance (%),Quality (%),Qty,Good,Rejected,Downtime (min),Run Time (min)";
  const body = daily.map(d =>
    [toDisplayDate(d.date), d.OEE, d.A, d.P, d.Q, d.qty, d.good, d.bad, d.downMins, d.runTimeMins].join(",")
  ).join("\n");
  const footer = `\nTOTAL/AVG,${overall.OEE},${overall.A},${overall.P},${overall.Q},${overall.qty},${overall.good},${overall.bad},${overall.downMins},${overall.runTimeMins}`;
  downloadBlob(header + "\n" + body + footer, "text/csv;charset=utf-8;", "oee_report.csv");
};

const exportExcel = async (daily, overall, start, end) => {
  const logo = await getWrlLogoBase64();
  const cols = ["Date", "OEE (%)", "A (%)", "P (%)", "Q (%)", "Qty", "Good", "Rejected", "Downtime (min)", "Run Time (min)"];
  const dataRows = daily.map(d => [toDisplayDate(d.date), d.OEE, d.A, d.P, d.Q, d.qty, d.good, d.bad, d.downMins, d.runTimeMins]);
  const footRow  = ["TOTAL / AVG", `${overall.OEE}%`, `${overall.A}%`, `${overall.P}%`, `${overall.Q}%`, overall.qty, overall.good, overall.bad, overall.downMins, overall.runTimeMins];
  const span = cols.length;
  const logoCell = logo ? `<td style="width:90px;padding:6px"><img src="${logo}" width="80" height="40" /></td>` : "";
  const th = (c) => `<th style="background:#1e3a8a;color:#fff;font-weight:bold;border:1px solid #1e293b;padding:6px;text-align:center">${c}</th>`;
  const td = (v) => {
    const n = v != null && !isNaN(parseFloat(v)) && isFinite(v);
    return `<td style="border:1px solid #cbd5e1;padding:4px;text-align:${n ? "right" : "left"}">${v ?? ""}</td>`;
  };
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <style>table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11px}</style></head><body>
    <table><tr>${logoCell}<td colspan="${span}" style="font-size:15px;font-weight:bold;padding:8px;text-align:center">Part Process — OEE Report</td></tr>
    <tr><td colspan="${span + (logo ? 1 : 0)}" style="font-size:10px;color:#475569;padding:0 8px 8px;text-align:center">${start} → ${end} · Generated ${new Date().toLocaleString()}</td></tr></table>
    <table border="1"><tr>${cols.map(th).join("")}</tr>
    ${dataRows.map((r, i) => `<tr style="background:${i % 2 ? "#f1f5f9" : "#fff"}">${r.map(td).join("")}</tr>`).join("")}
    <tr>${footRow.map(v => `<td style="background:#dbeafe;font-weight:bold;border:1px solid #1e293b;padding:5px">${v}</td>`).join("")}</tr>
    </table></body></html>`;
  downloadBlob(html, "application/vnd.ms-excel", "oee_report.xls");
};

const exportPDF = async (daily, overall, start, end, modelRows) => {
  const logo = await getWrlLogoBase64();
  const doc  = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const mx   = 24;
  if (logo) doc.addImage(logo, "PNG", mx, 14, 44, 22);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("Part Process - OEE Report", logo ? mx + 56 : mx, 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text(
    `${start} to ${end}   |   Generated ${new Date().toLocaleString()}   |   OEE: ${overall.OEE}%  A: ${overall.A}%  P: ${overall.P}%  Q: ${overall.Q}%`,
    logo ? mx + 56 : mx, 42,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    head: [["Date", "OEE (%)", "A (%)", "P (%)", "Q (%)", "Qty", "Good", "Rejected", "DT (min)", "Run (min)"]],
    body: daily.map(d => [toDisplayDate(d.date), `${d.OEE}%`, `${d.A}%`, `${d.P}%`, `${d.Q}%`, d.qty, d.good, d.bad, d.downMins, d.runTimeMins]),
    foot: [["TOTAL/AVG", `${overall.OEE}%`, `${overall.A}%`, `${overall.P}%`, `${overall.Q}%`, overall.qty, overall.good, overall.bad, overall.downMins, overall.runTimeMins]],
    startY: 56, margin: { left: mx, right: mx }, theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [219, 234, 254], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - mx, doc.internal.pageSize.getHeight() - 12, { align: "right" });
      doc.setTextColor(0);
    },
  });

  if (modelRows.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Model-wise Breakdown", mx, 30);
    autoTable(doc, {
      head: [["SAP Code", "Part Name", "Qty", "Good", "Rejected", "Quality (%)"]],
      body: modelRows.map(r => [r.sapCode, r.partName, r.qty, r.good, r.bad, r.Q != null ? `${r.Q}%` : "—"]),
      startY: 42, margin: { left: mx, right: mx }, theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }
  doc.save("oee_report.pdf");
};

/* ── Main Component ── */
const PartProcessOEEReport = () => {
  const materials    = useSelector(selectMaterials);
  const allShifts    = useSelector(selectShifts);
  const configShifts = useMemo(() => allShifts.filter(s => s.status), [allShifts]);

  const [startTime,    setStartTime]    = useState(`${todayStr()} 08:00`);
  const [endTime,      setEndTime]      = useState(`${todayStr()} 20:00`);
  const [loading,      setLoading]      = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [ydayLoading,  setYdayLoading]  = useState(false);
  const [records,      setRecords]      = useState([]);
  const [qualityLogs,  setQualityLogs]  = useState([]);
  const [modelFilter,  setModelFilter]  = useState("ALL");

  const isAnyLoading = loading || todayLoading || ydayLoading;

  // Configured net production capacity per day (sum of all active shifts,
  // minus each shift's configured breaks).
  const totalPlannedMins = useMemo(() => {
    if (!configShifts.length) return 480;
    return configShifts.reduce((s, sh) => s + shiftPlannedProductionMins(sh), 0);
  }, [configShifts]);

  // Actual time window the user queried (in minutes). Used as plannedMins for
  // the OVERALL computation so a 1-shift query (720 min) is not penalised by
  // a 2-shift configured total (1440 min). Per-day uses min(configured, query).
  const queryPlannedMins = useMemo(() => {
    const s = new Date(startTime.replace(" ", "T") + ":00").getTime();
    const e = new Date(endTime.replace(" ", "T") + ":00").getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return totalPlannedMins;
    return Math.max(1, Math.round((e - s) / 60000));
  }, [startTime, endTime, totalPlannedMins]);

  // Per-day planned: if the query is shorter than a full day's shifts, use
  // the query window; otherwise use the configured shift capacity per day.
  const perDayPlannedMins = useMemo(
    () => Math.min(totalPlannedMins, queryPlannedMins),
    [totalPlannedMins, queryPlannedMins],
  );

  /* ── fetch ── */
  const fetchData = useCallback(async (start, end, setLoadFn) => {
    const startMs = new Date(start.replace(" ", "T") + ":00").getTime();
    const endMs   = new Date(end.replace(" ", "T") + ":00").getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      toast.error("Invalid time range."); return;
    }
    setLoadFn(true); setRecords([]); setQualityLogs([]);
    try {
      const dayStartSec = configShifts.length
        ? Math.min(...configShifts.map(s => toMins(s.startTime))) * 60
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
      for (const date of dates) {
        const raw = allRows.filter(r => String(r.EventDate).slice(0, 10) === date);
        const midnight = new Date(date + "T00:00:00").getTime();
        const mapped = raw.map((r, i) => {
          const rec = { ...mapDbRecord(r, i), eventDate: date };
          const tod = todSecs(rec.startTime);
          const absMs = tod === null ? null
            : midnight + (tod < dayStartSec ? 86400000 : 0) + tod * 1000;
          return { ...rec, _prodDay: date, _absMs: absMs };
        });
        allMapped.push(...mapped);
      }

      const filtered = allMapped
        .filter(r => r._absMs !== null && r._absMs >= startMs && r._absMs < endMs)
        .sort((a, b) => b._absMs - a._absMs);

      setRecords(enrichRecords(filtered));

      // Also fetch manually-logged quality data (PartProcessQualityLog) for
      // accurate Q when the machine sensor is absent or unreliable.
      try {
        const qRes = await axios.get(`${PART_PROCESS_API}/quality-log`, {
          params: { startDate: dates[0], endDate: dates[dates.length - 1] },
          withCredentials: true,
        });
        setQualityLogs(qRes.data?.data ?? []);
      } catch { setQualityLogs([]); }

      const prodCt = filtered.filter(r => r.state === "Production").length;
      toast.success(`${prodCt} production · ${filtered.length - prodCt} downtime events loaded`);
    } catch {
      toast.error("Failed to load data.");
    } finally { setLoadFn(false); }
  }, [configShifts]);

  const handleQuery     = () => {
    if (!startTime || !endTime) { toast.error("Select a time range."); return; }
    fetchData(startTime, endTime, setLoading);
  };
  const handleToday     = () => {
    const s = `${todayStr()} 08:00`, e = `${offsetDate(1)} 08:00`;
    setStartTime(s); setEndTime(e); fetchData(s, e, setTodayLoading);
  };
  const handleYesterday = () => {
    const s = `${offsetDate(-1)} 08:00`, e = `${todayStr()} 08:00`;
    setStartTime(s); setEndTime(e); fetchData(s, e, setYdayLoading);
  };

  /* ── derived data ── */
  const filtered = useMemo(() =>
    modelFilter === "ALL" ? records : records.filter(r => r.model === modelFilter),
    [records, modelFilter],
  );

  // Quality log: by part name/SAP code (for model table)
  const qualityByPart = useMemo(() => {
    const map = {};
    qualityLogs.forEach(l => {
      const key = l.PartName || l.SapCode || "";
      if (!key) return;
      if (!map[key]) map[key] = { rejected: 0 };
      map[key].rejected += parseInt(l.RejectedQty || 0, 10);
    });
    return map;
  }, [qualityLogs]);

  // Quality log: total rejected per calendar date (for daily OEE)
  const qualityByDate = useMemo(() => {
    const map = {};
    qualityLogs.forEach(l => {
      const d = l.EventDate ? String(l.EventDate).slice(0, 10) : null;
      if (!d) return;
      if (!map[d]) map[d] = 0;
      map[d] += parseInt(l.RejectedQty || 0, 10);
    });
    return map;
  }, [qualityLogs]);

  // Override Q (and OEE) in a computeOEE result using quality-log rejected count.
  // Only applied when quality log actually has rejected data.
  const applyQLog = useCallback((base, rejected) => {
    if (!rejected || rejected <= 0 || base.qty === 0) return base;
    const good = Math.max(0, base.qty - rejected);
    const Q    = Math.min(100, Math.round((good / base.qty) * 100));
    const OEE  = Math.round((base.A / 100) * (base.P / 100) * (Q / 100) * 100);
    return { ...base, good, bad: rejected, Q, OEE, qUnverified: false };
  }, []);

  const overall = useMemo(() => {
    const prod = filtered.filter(r => r.state === "Production");
    const down = filtered.filter(r => r.state === "Downtime");
    const base = computeOEE({ prodRecords: prod, downRecords: down, plannedMins: queryPlannedMins, materials });
    const totalRejected = qualityLogs.reduce((s, l) => s + parseInt(l.RejectedQty || 0, 10), 0);
    return applyQLog(base, totalRejected);
  }, [filtered, queryPlannedMins, materials, qualityLogs, applyQLog]);

  const dailyOEE = useMemo(() => {
    const days = {};
    filtered.forEach(r => {
      const day = r._prodDay || r.eventDate;
      if (!day) return;
      if (!days[day]) days[day] = { prod: [], down: [] };
      if (r.state === "Production") days[day].prod.push(r);
      else if (r.state === "Downtime") days[day].down.push(r);
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { prod, down }]) => {
        const base     = computeOEE({ prodRecords: prod, downRecords: down, plannedMins: perDayPlannedMins, materials });
        const rejected = qualityByDate[date] ?? 0;
        return { date, ...applyQLog(base, rejected) };
      });
  }, [filtered, perDayPlannedMins, materials, qualityByDate, applyQLog]);

  const modelOEE = useMemo(() => {
    const byModel = {};
    filtered.filter(r => r.state === "Production").forEach(r => {
      const m = r.model || "UNKNOWN";
      if (!byModel[m]) byModel[m] = [];
      byModel[m].push(r);
    });
    return Object.entries(byModel).map(([model, recs]) => {
      const mat      = getMaterialByModel(materials, model);
      const partName = mat?.partName ?? model;
      const qty      = recs.reduce((s, r) => s + (r.qty ?? 0), 0);

      // Prefer quality-log rejected count (operator-confirmed) over machine sensor flag
      const logEntry   = qualityByPart[partName] ?? qualityByPart[mat?.sapCode ?? ""];
      const hasLog     = logEntry && logEntry.rejected > 0;
      const hasQ       = recs.some(r => r.quality != null && r.quality !== "");
      const sensorBad  = hasQ ? Math.max(0, qty - recs.filter(r => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0)) : 0;
      const bad        = hasLog ? logEntry.rejected : (hasQ ? sensorBad : 0);
      const good       = Math.max(0, qty - bad);
      const Q          = qty > 0 && (hasLog || hasQ) ? Math.min(100, Math.round((good / qty) * 100)) : null;

      return { model, sapCode: mat?.sapCode ?? "—", partName, qty, good, bad, Q };
    }).sort((a, b) => b.qty - a.qty);
  }, [filtered, materials, qualityByPart]);

  const modelOptions = useMemo(() => {
    const s = new Set();
    records.forEach(r => { if (r.model) s.add(r.model); });
    return [...s].sort();
  }, [records]);

  const hasData = records.length > 0;

  /* ── OEE trend line chart data ── */
  const chartData = useMemo(() => ({
    labels: dailyOEE.map(d => toDisplayDate(d.date)),
    datasets: [
      {
        label: "OEE %",
        data: dailyOEE.map(d => d.OEE),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.10)",
        fill: true, tension: 0.4,
        pointBackgroundColor: dailyOEE.map(d => oeeHex(d.OEE)),
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 6, pointHoverRadius: 8, borderWidth: 2.5,
      },
      {
        label: "Target (85%)",
        data: dailyOEE.map(() => 85),
        borderColor: "rgba(34,197,94,0.5)",
        backgroundColor: "transparent",
        borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0,
      },
    ],
  }), [dailyOEE]);

  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { size: 11 }, usePointStyle: true, padding: 16 } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        min: 0, max: 100,
        ticks: { font: { size: 10 }, callback: (v) => `${v}%` },
        grid: { color: "rgba(0,0,0,0.04)" },
      },
    },
  }), []);

  /* ── A / P / Q grouped bar chart ── */
  const apqChartData = useMemo(() => ({
    labels: dailyOEE.map(d => toDisplayDate(d.date)),
    datasets: [
      {
        label: "Availability (A %)",
        data: dailyOEE.map(d => d.A),
        backgroundColor: "rgba(34,197,94,0.85)",
        borderColor: "#16a34a",
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.75,
      },
      {
        label: "Performance (P %)",
        data: dailyOEE.map(d => d.P),
        backgroundColor: "rgba(59,130,246,0.85)",
        borderColor: "#2563eb",
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.75,
      },
      {
        label: "Quality (Q %)",
        data: dailyOEE.map(d => d.Q),
        backgroundColor: "rgba(245,158,11,0.85)",
        borderColor: "#d97706",
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.75,
      },
    ],
  }), [dailyOEE]);

  const apqChartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { size: 11 }, usePointStyle: true, padding: 16 } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        min: 0, max: 100,
        ticks: { font: { size: 10 }, callback: (v) => `${v}%` },
        grid: { color: "rgba(0,0,0,0.04)" },
      },
    },
  }), []);

  /* ── OEE loss donut ── */
  const donutData = useMemo(() => {
    const { A, P, Q, OEE } = overall;
    const aLoss = Math.max(0, Math.round(100 - A));
    const pLoss = Math.max(0, Math.round((A * (100 - P)) / 100));
    const qLoss = Math.max(0, 100 - OEE - aLoss - pLoss);
    return {
      labels: ["OEE Achieved", "Availability Loss", "Performance Loss", "Quality Loss"],
      datasets: [{
        data: [Math.max(0, OEE), aLoss, pLoss, qLoss],
        backgroundColor: ["#22c55e", "#ef4444", "#f59e0b", "#a78bfa"],
        borderWidth: 0, hoverOffset: 4,
      }],
    };
  }, [overall]);

  const donutOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, cutout: "68%",
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 10 }, usePointStyle: true, padding: 10 } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}%` } },
    },
  }), []);

  /* ── render ── */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">

      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-5 py-3 flex items-center justify-between shadow-sm shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">Part Process — OEE Report</h1>
          <p className="text-[11px] text-slate-400">Availability · Performance · Quality · Overall Equipment Effectiveness</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${oeeBg(overall.OEE)}`}>
              <FiActivity className="w-3.5 h-3.5 text-indigo-500" />
              <span className={`text-xs font-bold ${oeeText(overall.OEE)}`}>OEE {overall.OEE}%</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-bold text-emerald-700">A {overall.A}%</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-xs font-bold text-blue-700">P {overall.P}%</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-xs font-bold text-amber-700">Q {overall.Q}%</span>
            </div>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 flex flex-col gap-3">

        {/* FILTERS */}
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
            <div className="min-w-[180px]">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Model</label>
              <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-600 focus:ring-2 focus:ring-blue-200 outline-none">
                <option value="ALL">All models</option>
                {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
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

        {/* EXPORT ROW */}
        {hasData && (
          <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">
              {filtered.filter(r => r.state === "Production").length} production · {filtered.filter(r => r.state === "Downtime").length} downtime events
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => exportCSV(dailyOEE, overall, startTime, endTime)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
                <FiDownload className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => exportExcel(dailyOEE, overall, startTime, endTime)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-emerald-600">
                <FiFileText className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={() => exportPDF(dailyOEE, overall, startTime, endTime, modelOEE)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-rose-600">
                <FiFile className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>
        )}

        {/* CONTENT */}
        {isAnyLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-slate-400">
              <Spinner cls="w-6 h-6 text-blue-500" />
              <span className="text-sm">Loading OEE data…</span>
            </div>
          </div>
        ) : !hasData ? (
          <SectionCard className="flex-1 flex items-center justify-center">
            <EmptyState text="Query a date range to view the OEE report" />
          </SectionCard>
        ) : (
          <>
            {/* OEE SUMMARY CARDS + DONUT */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
              <OEECard
                label="Overall OEE" value={overall.OEE} colored
                sub={overall.pUnverified || overall.qUnverified ? "⚠ Some factors unverified" : `${overall.qty.toLocaleString()} parts`}
              />
              <OEECard label="Availability" value={overall.A} colored sub={`${overall.downMins} min downtime`} />
              <OEECard
                label="Performance" value={overall.P} colored
                sub={overall.pUnverified ? "No std. cycle time set" : `${overall.runTimeMins} min run time`}
              />
              <OEECard
                label="Quality" value={overall.Q} colored
                sub={overall.qUnverified ? "No quality sensor data" : `${overall.good.toLocaleString()} good / ${overall.qty.toLocaleString()}`}
              />
              {/* OEE Loss Donut */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col items-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Loss Breakdown</span>
                <div className="relative h-40 w-full max-w-[200px]">
                  <Doughnut data={donutData} options={donutOptions} />
                </div>
              </div>
            </div>

            {/* CHARTS — OEE trend + A/P/Q breakdown side by side */}
            {dailyOEE.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
                {/* OEE Trend line chart */}
                <SectionCard className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FiTrendingUp className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-slate-600">OEE Trend</span>
                    <span className="ml-auto text-[10px] text-slate-400">{dailyOEE.length} day{dailyOEE.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-60">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                </SectionCard>

                {/* A / P / Q grouped bar chart */}
                <SectionCard className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FiBarChart2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-600">Availability · Performance · Quality</span>
                  </div>
                  <div className="h-60">
                    <Bar data={apqChartData} options={apqChartOptions} />
                  </div>
                </SectionCard>
              </div>
            )}

            {/* DAILY BREAKDOWN TABLE */}
            {dailyOEE.length > 1 && (
              <SectionCard className="overflow-hidden shrink-0">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <FiBarChart2 className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">Daily Breakdown</span>
                </div>
                <div className="overflow-auto">
                  <table className="border-separate border-spacing-0 w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50">
                        {["Date", "OEE (%)", "A (%)", "P (%)", "Q (%)", "Qty", "Good", "Rejected", "DT (min)", "Run (min)"].map(h => (
                          <th key={h} className="px-3 py-2 text-[10px] font-semibold text-slate-500 border-b border-r border-slate-200 whitespace-nowrap text-center first:text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dailyOEE.map((d) => (
                        <tr key={d.date} className="hover:bg-blue-50/30 even:bg-slate-50/30">
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-xs font-mono text-slate-600 whitespace-nowrap">{toDisplayDate(d.date)}</td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`text-xs font-bold font-mono ${oeeText(d.OEE)}`}>{d.OEE}%</span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`text-xs font-mono font-semibold ${oeeText(d.A)}`}>{d.A}%</span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`text-xs font-mono font-semibold ${oeeText(d.P)}`}>{d.P}%</span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center">
                            <span className={`text-xs font-mono font-semibold ${oeeText(d.Q)}`}>{d.Q}%</span>
                          </td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono text-slate-700">{d.qty.toLocaleString()}</td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono text-emerald-600">{d.good.toLocaleString()}</td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono text-rose-500">{d.bad.toLocaleString()}</td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono text-slate-500">{d.downMins}</td>
                          <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono text-slate-500">{d.runTimeMins}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50">
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-xs font-bold text-slate-700">TOTAL / AVG</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center">
                          <span className={`text-xs font-bold font-mono ${oeeText(overall.OEE)}`}>{overall.OEE}%</span>
                        </td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-bold font-mono">{overall.A}%</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-bold font-mono">{overall.P}%</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-bold font-mono">{overall.Q}%</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-mono font-semibold">{overall.qty.toLocaleString()}</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-mono text-emerald-600 font-semibold">{overall.good.toLocaleString()}</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-mono text-rose-500 font-semibold">{overall.bad.toLocaleString()}</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-mono">{overall.downMins}</td>
                        <td className="px-3 py-2.5 border-t border-r border-slate-200 text-center text-xs font-mono">{overall.runTimeMins}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* MODEL-WISE TABLE */}
            {modelOEE.length > 0 && (
              <SectionCard className="overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <FiPackage className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">Model-wise Breakdown</span>
                  <span className="ml-auto text-[10px] text-slate-400">{modelOEE.length} model{modelOEE.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-auto">
                  <table className="border-separate border-spacing-0 w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50">
                        {["#", "SAP Code", "Part Name", "Qty", "Good", "Rejected", "Quality (%)", "Share"].map(h => (
                          <th key={h} className="px-3 py-2 text-[10px] font-semibold text-slate-500 border-b border-r border-slate-200 whitespace-nowrap text-center first:text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modelOEE.map((r, i) => {
                        const sharePct = overall.qty > 0 ? Math.round((r.qty / overall.qty) * 100) : 0;
                        return (
                          <tr key={r.model} className="hover:bg-blue-50/30 even:bg-slate-50/30">
                            <td className="px-3 py-2.5 border-b border-r border-slate-100 text-[10px] text-slate-400 font-mono text-center">{i + 1}</td>
                            <td className="px-3 py-2.5 border-b border-r border-slate-100 text-xs font-mono font-bold text-blue-600">{r.sapCode}</td>
                            <td className="px-3 py-2.5 border-b border-r border-slate-100 text-xs text-slate-700 max-w-[220px] truncate" title={r.partName}>{r.partName}</td>
                            <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono font-semibold text-slate-700">{r.qty.toLocaleString()}</td>
                            <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono text-emerald-600">{r.good.toLocaleString()}</td>
                            <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center text-xs font-mono text-rose-500">{r.bad.toLocaleString()}</td>
                            <td className="px-3 py-2.5 border-b border-r border-slate-100 text-center">
                              {r.Q != null
                                ? <span className={`text-xs font-bold font-mono ${oeeText(r.Q)}`}>{r.Q}%</span>
                                : <span className="text-[10px] text-slate-400 italic">No sensor</span>
                              }
                            </td>
                            <td className="px-3 py-2.5 border-b border-r border-slate-100">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
                                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${sharePct}%` }} />
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{sharePct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PartProcessOEEReport;
