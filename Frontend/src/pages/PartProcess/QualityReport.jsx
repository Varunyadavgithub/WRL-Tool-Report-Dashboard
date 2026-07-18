import { useState, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { Doughnut, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import {
  Search, Calendar, Clock, Filter, Loader2, PackageOpen,
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle, BarChart2,
  FileSpreadsheet, FileText,
} from "lucide-react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets.js";

import axios from "axios";
import { mapDbRecord } from "../../utils/mapDbRecord.js";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";
import { componentQtyFromMachine, parseDurSecs } from "../../utils/productionLogic.js";
import { selectMaterials, getMaterialByModel, extractSapCode, selectShifts, getShiftWindow, toMins } from "../../redux/slices/masterConfigSlice";
import { exportSectionsToExcel, exportMultiSectionPDF } from "../../utils/reportExport.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const pad = (n) => (n < 10 ? "0" + n : n);
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

const todayStr   = () => fmtYMD(new Date());
const offsetDate = (days) => { const d = new Date(); d.setDate(d.getDate()+days); return fmtYMD(d); };

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

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;


const KpiCard = ({ icon: Icon, label, value, colorClass }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
    <div className={`p-2 rounded-lg w-fit ${colorClass}`}><Icon className="w-4 h-4" /></div>
    <p className="text-2xl font-bold text-slate-800 font-mono">{value}</p>
    <p className="text-[11px] text-slate-400 font-medium">{label}</p>
  </div>
);

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PartProcessQualityReport = () => {
  const materials    = useSelector(selectMaterials);
  const configShifts = useSelector(selectShifts).filter(s => s.status);
  const [startTime, setStartTime] = useState(`${todayStr()} 08:00`);
  const [endTime, setEndTime]     = useState(`${todayStr()} 20:00`);
  const [loading, setLoading]     = useState(false);
  const [ydayLoading, setYdayLoading]   = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(null);
  const [records, setRecords]     = useState([]);
  const [rawRecords, setRawRecords] = useState([]);
  const [dbQLogs, setDbQLogs]     = useState([]);
  const [showRaw, setShowRaw]     = useState(false);
  const donutChartRef = useRef(null);
  const modelBarChartRef = useRef(null);
  const defectBarChartRef = useRef(null);

  const fetchData = useCallback(async (start, end, setLoadFn) => {
    const startMs = new Date(start.replace(" ", "T") + ":00").getTime();
    const endMs   = new Date(end.replace(" ", "T") + ":00").getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      toast.error("Invalid time range."); return;
    }

    setLoadFn(true); setRecords([]); setRawRecords([]);
    try {
      const dayStartSec = configShifts.length
        ? Math.min(...configShifts.map((s) => toMins(s.startTime))) * 60
        : 0;

      // EventDate in the DB is a plain calendar-date tag, not shift-adjusted
      // — an overnight shift's post-midnight tail is stored under the NEXT
      // calendar date. Query the raw calendar span of [startMs, endMs), not
      // a production-day-shifted range, or that tail's EventDate never gets
      // queried and silently drops.
      const dates = [];
      const cur  = new Date(startMs);      cur.setHours(0, 0, 0, 0);
      const last = new Date(endMs - 1000); last.setHours(0, 0, 0, 0);
      while (cur <= last) { dates.push(fmtYMD(cur)); cur.setDate(cur.getDate() + 1); }

      const res = await axios.get(`${PART_PROCESS_API}/records-range`, {
        params: { startDate: dates[0], endDate: dates[dates.length - 1] },
        withCredentials: true,
      });
      const allRows = res.data?.data ?? [];

      const allMapped = [];
      const allRaw    = [];
      for (const date of dates) {
        const raw = allRows.filter(r => String(r.EventDate).slice(0, 10) === date);
        raw.forEach(r => allRaw.push({ _fetchDate: date, ...r }));

        const midnight = new Date(date + "T00:00:00").getTime();
        const mapped = raw.map((r, i) => ({ ...mapDbRecord(r, i), eventDate: date })).map((r) => {
          const tod   = todSecs(r.startTime);
          const absMs = tod === null ? null : midnight + (tod < dayStartSec ? 86400000 : 0) + tod * 1000;
          return { ...r, _absMs: absMs };
        });
        allMapped.push(...mapped);
      }

      const filtered = allMapped
        .filter(r =>
          r._absMs !== null &&
          r._absMs >= startMs &&
          r._absMs < endMs &&
          parseDurSecs(r.duration) <= 86400,
        )
        .sort((a, b) => a._absMs - b._absMs);

      setRecords(filtered);
      setRawRecords(allRaw);

      try {
        const qRes = await axios.get(`${PART_PROCESS_API}/quality-log`, {
          params: { startDate: dates[0], endDate: dates[dates.length - 1] },
          withCredentials: true,
        });
        setDbQLogs(qRes.data?.data ?? []);
      } catch {
        setDbQLogs([]);
      }

      const prodCount = filtered.filter(r => r.state === "Production").length;
      toast.success(`Quality data loaded — ${prodCount} production + ${filtered.length - prodCount} downtime records`);
    } catch (err) { console.error("[QualityReport] fetchData:", err); toast.error("Failed to fetch data."); }
    finally { setLoadFn(false); }
  }, [configShifts]);

  const handleQuery     = () => { if (!startTime || !endTime) { toast.error("Please select a time range."); return; } fetchData(startTime, endTime, setLoading); };
  const handleToday     = () => { const s = `${todayStr()} 08:00`, e = `${offsetDate(1)} 08:00`; setStartTime(s); setEndTime(e); fetchData(s, e, setTodayLoading); };
  const handleYesterday = () => { const s = `${offsetDate(-1)} 08:00`, e = `${todayStr()} 08:00`; setStartTime(s); setEndTime(e); fetchData(s, e, setYdayLoading); };
  const handleShiftSelect = (shift) => {
    const curMins = new Date().getHours() * 60 + new Date().getMinutes();
    const ssm = toMins(shift.startTime); const sem = toMins(shift.endTime);
    const isON = sem <= ssm;
    const baseDate = isON && curMins < sem ? offsetDate(-1) : todayStr();
    const win = getShiftWindow(shift, baseDate);
    if (!win) return;
    setStartTime(win.startDatetime); setEndTime(win.endDatetime);
    fetchData(win.startDatetime, win.endDatetime, (v) => setShiftLoading(v ? shift.shiftName : null));
  };
  const isAnyLoading = loading || ydayLoading || todayLoading || shiftLoading !== null;

  // Quality analysis - production records only
  const analysis = useMemo(() => {
    const prodRecords = records.filter((r) => r.state === "Production");
    const totalQty    = prodRecords.reduce((s, r) => s + (r.qty ?? 0), 0);
    const goodQty     = prodRecords.filter((r) => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0);
    const badQty      = totalQty - goodQty;
    const passRate    = totalQty > 0 ? ((goodQty / totalQty) * 100).toFixed(1) : 0;

    // Model-wise quality breakdown — keyed on Part Name via SAP Code extraction
    const modelMap = {};
    prodRecords.forEach((r) => {
      const qty = r.qty ?? 0;
      const sap = r.sapCode || extractSapCode(r.model);
      const mat = getMaterialByModel(materials, r.model);
      const key = mat?.partName || r.model || sap;
      if (!key) return;
      if (!modelMap[key]) modelMap[key] = { model: key, sapCode: sap, rawModel: r.model, total: 0, good: 0, componentQty: 0 };
      modelMap[key].total += qty;
      modelMap[key].componentQty += Math.round(componentQtyFromMachine(qty, mat));
      if (r.quality === "GOOD") modelMap[key].good += qty;
    });
    const modelBreakdown = Object.values(modelMap).sort((a, b) => b.total - a.total);
    const totalComponentQty = Object.values(modelMap).reduce((s, m) => s + m.componentQty, 0);

    return { prodRecords, totalQty, goodQty, badQty, passRate, modelBreakdown, totalComponentQty };
  }, [records, materials]);

  // ── Quality log aggregated by part name ──────────────────────────────────
  const qualityLogByModel = useMemo(() => {
    const map = {};
    dbQLogs.forEach((e) => {
      const key = e.PartName || e.partName || e.Model || e.model || "";
      if (!key) return;
      if (!map[key]) map[key] = { inspected: 0, rejected: 0, defects: [] };
      const insp = parseInt(e.InspectedQty ?? e.inspectedQty ?? 0, 10);
      const rej  = parseInt(e.RejectedQty  ?? e.rejectedQty  ?? 0, 10);
      map[key].inspected = Math.max(map[key].inspected, insp);
      map[key].rejected  += rej;
      const defName = e.DefectName || e.defectName;
      if (defName) map[key].defects.push(defName);
    });
    return map;
  }, [dbQLogs]);

  const qualityLogTotals = useMemo(() => {
    const vals = Object.values(qualityLogByModel);
    const inspected = vals.reduce((s, v) => s + v.inspected, 0);
    const rejected  = vals.reduce((s, v) => s + v.rejected,  0);
    const accepted  = Math.max(0, analysis.totalComponentQty - rejected);
    const passRate  = analysis.totalComponentQty > 0 ? ((accepted / analysis.totalComponentQty) * 100).toFixed(1) : "0.0";
    return { inspected, accepted, rejected, passRate, hasData: inspected > 0 };
  }, [qualityLogByModel, analysis.totalComponentQty]);

  // ── Defect-wise aggregation ──────────────────────────────────────────────
  const defectAnalysis = useMemo(() => {
    if (!dbQLogs.length) return [];
    const map = {};
    dbQLogs.forEach((e) => {
      const code = e.DefectCode || e.defectCode || "Unknown";
      const name = e.DefectName || e.defectName || "Unknown";
      const rej  = parseInt(e.RejectedQty ?? e.rejectedQty ?? 0, 10);
      const sev  = e.Severity || e.severity || "";
      if (!map[code]) map[code] = { code, name, rejected: 0, occurrences: 0, critical: 0, major: 0, minor: 0 };
      map[code].rejected    += rej;
      map[code].occurrences += 1;
      if (sev === "Critical") map[code].critical += rej;
      else if (sev === "Major") map[code].major   += rej;
      else if (sev === "Minor") map[code].minor   += rej;
    });
    return Object.values(map).sort((a, b) => b.rejected - a.rejected);
  }, [dbQLogs]);

  const defectBarData = useMemo(() => {
    if (!defectAnalysis.length) return null;
    const DEFECT_COLORS = ["#f43f5e","#f97316","#eab308","#a78bfa","#3b82f6","#06b6d4","#10b981","#64748b"];
    return {
      labels: defectAnalysis.map((d) => d.code ? `${d.code} · ${d.name}` : d.name),
      datasets: [{
        label: "Rejected Qty",
        data: defectAnalysis.map((d) => d.rejected),
        backgroundColor: defectAnalysis.map((_, i) => DEFECT_COLORS[i % DEFECT_COLORS.length]),
        borderRadius: 4,
      }],
    };
  }, [defectAnalysis]);

  const defectBarOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x} rejected` } },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, title: { display: true, text: "Rejected Qty", font: { size: 10 } } },
      y: { ticks: { font: { size: 10 } } },
    },
  };

  const donutData = useMemo(() => {
    if (qualityLogTotals.hasData) {
      return {
        labels: ["Accepted", "Rejected"],
        datasets: [{
          data: [qualityLogTotals.accepted, qualityLogTotals.rejected],
          backgroundColor: ["#22c55e", "#f43f5e"],
          borderWidth: 2, borderColor: "#fff",
        }],
      };
    }
    if (!analysis.prodRecords.length) return null;
    return {
      labels: ["Good Quality", "No Quality Data"],
      datasets: [{
        data: [analysis.goodQty, analysis.badQty],
        backgroundColor: ["#22c55e", "#f43f5e"],
        borderWidth: 2, borderColor: "#fff",
      }],
    };
  }, [analysis, qualityLogTotals]);

  const modelBarData = useMemo(() => {
    const rows = analysis.modelBreakdown;
    if (!rows.length) return null;
    return {
      labels: rows.map((r) => r.model),
      datasets: [
        {
          label: "Accepted",
          data: rows.map((r) => Math.max(0, r.componentQty - (qualityLogByModel[r.model]?.rejected ?? 0))),
          backgroundColor: "#22c55e",
          borderRadius: 4,
        },
        {
          label: "Rejected",
          data: rows.map((r) => qualityLogByModel[r.model]?.rejected ?? 0),
          backgroundColor: "#f43f5e",
          borderRadius: 4,
        },
      ],
    };
  }, [analysis.modelBreakdown, qualityLogByModel]);

  const modelBarOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { size: 10 }, boxWidth: 10 } },
    },
    scales: {
      x: { stacked: true, ticks: { font: { size: 9 } } },
      y: { stacked: true, ticks: { font: { size: 9 } } },
    },
  };

  const exportMeta = () => `${startTime} to ${endTime}  |  Generated ${new Date().toLocaleString()}`;
  const exportColumns = [
    { label: "Model", align: "left", value: (r) => r.model },
    { label: "Sheet Qty", align: "center", value: (r) => r.total },
    { label: "Component Qty", align: "center", value: (r) => r.componentQty },
    { label: "Rejected", align: "center", value: (r) => qualityLogByModel[r.model]?.rejected ?? 0 },
    { label: "Accepted", align: "center", value: (r) => Math.max(0, r.componentQty - (qualityLogByModel[r.model]?.rejected ?? 0)) },
  ];
  const qLogColumns = [
    { label: "Date", align: "left", value: (e) => String(e.EventDate ?? e.eventDate ?? "").slice(0, 10) },
    { label: "Shift", align: "left", value: (e) => e.ShiftName || e.shiftName || "" },
    { label: "Part Name", align: "left", value: (e) => e.PartName || e.partName || e.Model || e.model || "" },
    { label: "Inspected", align: "center", value: (e) => parseInt(e.InspectedQty ?? e.inspectedQty ?? 0, 10) },
    { label: "Accepted", align: "center", value: (e) => Math.max(0, parseInt(e.InspectedQty ?? e.inspectedQty ?? 0, 10) - parseInt(e.RejectedQty ?? e.rejectedQty ?? 0, 10)) },
    { label: "Rejected", align: "center", value: (e) => parseInt(e.RejectedQty ?? e.rejectedQty ?? 0, 10) },
    { label: "Defect Code", align: "left", value: (e) => e.DefectCode || e.defectCode || "" },
    { label: "Defect Name", align: "left", value: (e) => e.DefectName || e.defectName || "" },
    { label: "Severity", align: "left", value: (e) => e.Severity || e.severity || "" },
    { label: "Disposition", align: "left", value: (e) => e.Disposition || e.disposition || "" },
    { label: "Remarks", align: "left", value: (e) => e.Remarks || e.remarks || "" },
  ];

  const defectColumns = [
    { label: "Defect Code",  align: "left",   value: (d) => d.code },
    { label: "Defect Name",  align: "left",   value: (d) => d.name },
    { label: "Occurrences",  align: "center", value: (d) => d.occurrences },
    { label: "Rejected Qty", align: "center", value: (d) => d.rejected },
    { label: "Critical",     align: "center", value: (d) => d.critical || 0 },
    { label: "Major",        align: "center", value: (d) => d.major || 0 },
    { label: "Minor",        align: "center", value: (d) => d.minor || 0 },
    { label: "% of Total",   align: "center", value: (d) => qualityLogTotals.rejected > 0 ? ((d.rejected / qualityLogTotals.rejected) * 100).toFixed(1) + "%" : "—" },
  ];

  const buildExportBlocks = () => {
    const blocks = [
      { type: "table", heading: "Model-wise Quality", columns: exportColumns, rows: analysis.modelBreakdown },
    ];
    if (donutData) {
      blocks.push({
        type: "image", heading: "Quality Split",
        dataUrl: donutChartRef.current?.toBase64Image?.(),
        width: 240, height: 240,
      });
    }
    if (modelBarData) {
      blocks.push({
        type: "image", heading: "Accepted vs Rejected",
        dataUrl: modelBarChartRef.current?.toBase64Image?.(),
        width: 500, height: Math.max(160, modelBarData.labels.length * 36),
      });
    }
    if (defectAnalysis.length > 0) {
      blocks.push({ type: "table", heading: "Defect-wise Analysis", columns: defectColumns, rows: defectAnalysis });
    }
    if (defectBarData) {
      blocks.push({
        type: "image", heading: "Rejections by Defect",
        dataUrl: defectBarChartRef.current?.toBase64Image?.(),
        width: 500, height: Math.max(160, defectBarData.labels.length * 36),
      });
    }
    if (dbQLogs.length > 0) {
      blocks.push({ type: "table", heading: "Quality Log Entries", columns: qLogColumns, rows: dbQLogs });
    }
    return blocks;
  };

  const handleExportExcel = () => exportSectionsToExcel({
    blocks: buildExportBlocks(),
    title: "Part Process — Quality Report", subtitle: exportMeta(), filename: "quality_report.xlsx",
  });
  const handleExportPDF = () => exportMultiSectionPDF({
    blocks: buildExportBlocks(),
    title: "Part Process - Quality Report", subtitle: exportMeta(), filename: "quality_report.pdf",
  });

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Part Process - Quality Report</h1>
          <p className="text-[11px] text-slate-400">Quality analysis from production records (GOOD / not-GOOD)</p>
        </div>
        {(qualityLogTotals.hasData || analysis.prodRecords.length > 0) && (
          <div className="flex items-center gap-2">
            {qualityLogTotals.hasData && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">From Log</span>
            )}
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {qualityLogTotals.hasData ? qualityLogTotals.passRate : analysis.passRate}%
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wide">Pass Rate</span>
            </div>
            <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-emerald-600">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-rose-600">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Filters</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[170px] flex-1">
              <DateTimePicker label="Start Time" name="start" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="min-w-[170px] flex-1">
              <DateTimePicker label="End Time" name="end" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="flex gap-2 pb-0.5 shrink-0 flex-wrap">
              {configShifts.map(sh => (
                <button key={sh.shiftName} onClick={() => handleShiftSelect(sh)} disabled={isAnyLoading}
                  style={!isAnyLoading ? { backgroundColor: sh.color || "#6366f1", borderColor: sh.color || "#6366f1" } : {}}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border text-white transition-all ${isAnyLoading ? "bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed" : "opacity-90 hover:opacity-100"}`}>
                  {shiftLoading === sh.shiftName ? <Spinner /> : <Clock className="w-3.5 h-3.5" />} {sh.shiftName}
                </button>
              ))}
              <button onClick={handleYesterday} disabled={isAnyLoading} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 text-white"}`}>{ydayLoading ? <Spinner /> : <Calendar className="w-3.5 h-3.5" />} Yesterday</button>
              <button onClick={handleToday}     disabled={isAnyLoading} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>{todayLoading ? <Spinner /> : <Clock className="w-3.5 h-3.5" />} Today</button>
              <button onClick={handleQuery}     disabled={isAnyLoading} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${isAnyLoading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}>{loading ? <Spinner /> : <Search className="w-3.5 h-3.5" />} {loading ? "Loading…" : "Query"}</button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        {(qualityLogTotals.hasData || analysis.prodRecords.length > 0) && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {qualityLogTotals.hasData ? (
              <>
                <KpiCard icon={CheckCircle2}  label="Accepted"         value={qualityLogTotals.accepted}             colorClass="bg-emerald-50 text-emerald-600" />
                <KpiCard icon={XCircle}       label="Rejected"         value={qualityLogTotals.rejected}             colorClass="bg-rose-50 text-rose-500"      />
                <KpiCard icon={AlertTriangle} label="Pass Rate (Log)"  value={`${qualityLogTotals.passRate}%`}       colorClass="bg-amber-50 text-amber-600"    />
              </>
            ) : (
              <>
                <KpiCard icon={ShieldCheck}   label="Total Sheet Qty"  value={analysis.totalQty}             colorClass="bg-blue-50 text-blue-600"      />
                <KpiCard icon={CheckCircle2}  label="Good Qty"         value={analysis.goodQty}             colorClass="bg-emerald-50 text-emerald-600" />
                <KpiCard icon={XCircle}       label="No Quality Data"  value={analysis.badQty}              colorClass="bg-rose-50 text-rose-500"      />
                <KpiCard icon={AlertTriangle} label="Pass Rate"        value={`${analysis.passRate}%`}      colorClass="bg-amber-50 text-amber-600"    />
              </>
            )}
          </div>
        )}

        {isAnyLoading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 py-16">
            <Spinner cls="w-5 h-5 text-blue-600" /><p className="text-sm text-slate-400">Fetching quality dataâ€¦</p>
          </div>
        )}

        {!isAnyLoading && analysis.prodRecords.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            {/* Model-wise quality table */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Model-wise Quality</span>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50">
                      {["Model","Sheet Qty","Component Qty","Rejected","Accepted"].map((h) => (
                        <th key={h} className={`px-3 py-2.5 text-left font-semibold border-b border-slate-200 whitespace-nowrap text-[11px] ${h==="Accepted"?"text-emerald-600":h==="Rejected"?"text-rose-500":h==="Component Qty"?"text-violet-600":"text-slate-600"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.modelBreakdown.map((row, idx) => {
                      const pct  = row.total > 0 ? ((row.good / row.total) * 100).toFixed(1) : 0;
                      const qLog = qualityLogByModel[row.model];
                      return (
                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/40">
                          <td className="px-3 py-2 border-b border-slate-100">
                            {materials.some(m => m.partName === row.model) ? (
                              <span className="font-semibold text-blue-700 text-xs">{row.model}</span>
                            ) : (
                              <div>
                                <span className="font-mono text-[11px] text-slate-600">{row.model}</span>
                                <span className="block text-[9px] font-bold text-rose-500 mt-0.5">⚠ Master not exist</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 text-center">{row.total}</td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold font-mono text-violet-600 text-center">
                            {row.componentQty}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold font-mono text-rose-500 text-center">
                            {qLog?.rejected ?? 0}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold font-mono text-emerald-600 text-center">
                            {Math.max(0, row.componentQty - (qLog?.rejected ?? 0))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Donut + Shift breakdown */}
            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Quality Split</span>
                </div>
                <div className="p-4 flex flex-col items-center gap-3">
                  {donutData ? (
                    <>
                      <div className="w-40 h-40">
                        <Doughnut ref={donutChartRef} data={donutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                      </div>
                      {donutData.labels.map((l, i) => (
                        <div key={l} className="flex items-center justify-between w-full text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: donutData.datasets[0].backgroundColor[i] }} />
                            <span className="text-slate-600">{l}</span>
                          </div>
                          <span className="font-bold text-slate-700 font-mono">{donutData.datasets[0].data[i]}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-300 py-6">
                      <ShieldCheck className="w-8 h-8 opacity-50" strokeWidth={1.2} />
                      <p className="text-xs text-slate-400">No data</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Model-wise Accepted/Rejected bar chart */}
              {modelBarData && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                    <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Accepted vs Rejected</span>
                  </div>
                  <div className="p-3" style={{ height: `${Math.max(160, modelBarData.labels.length * 36)}px` }}>
                    <Bar ref={modelBarChartRef} data={modelBarData} options={modelBarOptions} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isAnyLoading && analysis.prodRecords.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-12">
            <div className="flex flex-col items-center gap-2 text-slate-300">
              <PackageOpen className="w-8 h-8 opacity-50" strokeWidth={1.2} />
              <p className="text-xs text-slate-400">No data. Select filters and click Query.</p>
            </div>
          </div>
        )}

        {/* ── QUALITY LOG ENTRIES ── */}
        {dbQLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Quality Log Entries</span>
              <span className="ml-1 text-[10px] text-slate-400">· {dbQLogs.length} entr{dbQLogs.length === 1 ? "y" : "ies"}</span>
              <span className="ml-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">From Log</span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    {["Date","Shift","Part Name","Inspected","Accepted","Rejected","Defect Code","Defect Name","Severity","Disposition","Remarks"].map((h) => (
                      <th key={h} className={`px-3 py-2.5 text-[11px] font-semibold border-b border-slate-200 whitespace-nowrap text-left ${h==="Accepted"?"text-emerald-600":h==="Rejected"?"text-rose-500":"text-slate-600"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dbQLogs.map((e, i) => {
                    const insp = parseInt(e.InspectedQty ?? e.inspectedQty ?? 0, 10);
                    const rej  = parseInt(e.RejectedQty  ?? e.rejectedQty  ?? 0, 10);
                    const acc  = Math.max(0, insp - rej);
                    const eventDate = String(e.EventDate ?? e.eventDate ?? "").slice(0, 10);
                    return (
                      <tr key={i} className="hover:bg-emerald-50/30 transition-colors even:bg-slate-50/30">
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{eventDate || "—"}</td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            {e.ShiftName || e.shiftName || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-700">
                          {e.PartName || e.partName || e.Model || e.model || "—"}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-blue-600 text-center">{insp}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-emerald-600 text-center">{acc}</td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-center">
                          <span className={rej > 0 ? "text-rose-500" : "text-slate-400"}>{rej}</span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-violet-600">{e.DefectCode || e.defectCode || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-600">{e.DefectName || e.defectName || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          {(e.Severity || e.severity) ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(e.Severity||e.severity)==="Critical"?"bg-rose-100 text-rose-700 border border-rose-200":(e.Severity||e.severity)==="Major"?"bg-orange-50 text-orange-700 border border-orange-200":(e.Severity||e.severity)==="Minor"?"bg-amber-50 text-amber-700 border border-amber-200":"bg-slate-100 text-slate-600 border border-slate-200"}`}>
                              {e.Severity || e.severity}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 text-[11px]">{e.Disposition || e.disposition || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-500 text-[11px] max-w-[160px] truncate" title={e.Remarks || e.remarks || ""}>{e.Remarks || e.remarks || <span className="text-slate-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DEFECT-WISE ANALYSIS ── */}
        {defectAnalysis.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {/* Defect summary table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Defect-wise Analysis</span>
                <span className="ml-1 text-[10px] text-slate-400">· {defectAnalysis.length} defect type{defectAnalysis.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      {["Defect Code", "Defect Name", "Occurrences", "Rejected Qty", "Critical", "Major", "Minor", "% of Total"].map((h) => (
                        <th key={h} className={`px-3 py-2.5 text-[11px] font-semibold border-b border-slate-200 whitespace-nowrap text-left ${h === "Rejected Qty" ? "text-rose-500" : h === "Critical" ? "text-red-600" : h === "Major" ? "text-orange-600" : h === "Minor" ? "text-amber-600" : "text-slate-600"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defectAnalysis.map((d, i) => {
                      const pct = qualityLogTotals.rejected > 0 ? ((d.rejected / qualityLogTotals.rejected) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={i} className="hover:bg-rose-50/30 transition-colors even:bg-slate-50/30">
                          <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-violet-600">{d.code}</td>
                          <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-700">{d.name}</td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 text-center">{d.occurrences}</td>
                          <td className="px-3 py-2 border-b border-slate-100 font-bold font-mono text-rose-500 text-center">{d.rejected}</td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-center">
                            {d.critical > 0 ? <span className="font-bold text-red-600">{d.critical}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-center">
                            {d.major > 0 ? <span className="font-bold text-orange-600">{d.major}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 font-mono text-center">
                            {d.minor > 0 ? <span className="font-bold text-amber-600">{d.minor}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="font-bold font-mono text-slate-600 w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Defect bar chart */}
            {defectBarData && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <BarChart2 className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Rejections by Defect</span>
                </div>
                <div className="p-3" style={{ height: `${Math.max(200, defectBarData.labels.length * 40)}px` }}>
                  <Bar ref={defectBarChartRef} data={defectBarData} options={defectBarOptions} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RAW DATA VERIFICATION ── */}
        {rawRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            <button onClick={() => setShowRaw(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Raw DB Data — {rawRecords.length} records</span>
                <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">Unprocessed</span>
              </div>
              <span className="text-[10px] text-slate-400">{showRaw ? "Hide ▲" : "Show ▼"}</span>
            </button>
            {showRaw && (
              <div className="overflow-auto max-h-96 border-t border-slate-100">
                <table className="min-w-full text-[10px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-amber-50">
                      {["#","Date","Shift","Type","Program / Barcode","Start","End","Duration","Qty","Quality","DT Reason","Asset","Line"].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-[9px] font-bold text-amber-700 border-b border-amber-200 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRecords.map((r, i) => (
                      <tr key={i} className={`hover:bg-amber-50/30 ${i%2===0?"bg-white":"bg-slate-50/50"}`}>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-400 font-mono">{i+1}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{r._fetchDate}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap text-slate-600">{r.ShiftName||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap">
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${r.EventType==="Production"?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-600"}`}>{r.EventType}</span>
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-700 max-w-[200px] truncate" title={r.Barcode||""}>{r.Barcode||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">{r.StartTime}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">{r.EndTime}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">{r.Duration}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 font-mono font-bold text-slate-700">{r.PartsQty??"-"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 whitespace-nowrap">
                          {r.PartsQuality?<span className={`text-[9px] font-bold px-1 rounded ${r.PartsQuality==="GOOD"?"text-emerald-700 bg-emerald-50":"text-rose-600 bg-rose-50"}`}>{r.PartsQuality}</span>:<span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-rose-600 whitespace-nowrap">{r.DowntimeReason||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500 whitespace-nowrap">{r.AssetName||"—"}</td>
                        <td className="px-2 py-1.5 border-b border-slate-100 text-slate-500 whitespace-nowrap">{r.LineName||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default PartProcessQualityReport;
