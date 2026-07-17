/**
 * EnergyMeterDashboard.jsx
 *
 * Utility Reading > Energy Meters. Four tabs:
 *  - Live:     live gauges per meter + 24h trend chart for the selected meter
 *  - Reports:  Hour/Day/Month consumption rollups (ConsumptionSummary)
 *  - Alerts:   AlertLog list with acknowledge/resolve actions
 *  - Config:   PDP and Meter master CRUD
 *
 * LiveReading/ReadingHistory are written by the external meter-polling
 * system; this page only reads them and manages PDP/Meter config.
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Zap, Wifi, WifiOff, Activity, AlertTriangle, Settings2, Plus,
  Gauge as GaugeIcon, Download, Bell, CheckCircle2, XCircle, RefreshCw,
  Search, Calendar, Clock, Radio, MapPin, ArrowLeft,
} from "lucide-react";
import {
  LineChart, Line, ComposedChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { baseURL } from "../../assets/assets";
import {
  inputCls, selectCls, Field, StatusBadge, Modal, TableActions,
  PageHeader, EmptyState, TH, TD,
} from "../MasterConfig/_shared";

const API = `${baseURL}energy-meters/`;

const fmt = (v, d = 1) => (v != null && !isNaN(v) ? Number(v).toFixed(d) : "--");

/* ═══════════════════════════════════════════════════════════
   TABS SHELL
═══════════════════════════════════════════════════════════ */
const TABS = [
  { key: "live",    label: "Live Monitoring", icon: Activity },
  { key: "reports", label: "Consumption Reports", icon: GaugeIcon },
  { key: "alerts",  label: "Alerts", icon: Bell },
  { key: "config",  label: "PDP & Meter Config", icon: Settings2 },
];

export default function EnergyMeterDashboard() {
  const [tab, setTab] = useState("live");
  const [pdps, setPdps] = useState([]);
  const [meters, setMeters] = useState([]);
  const [openAlertCount, setOpenAlertCount] = useState(0);

  const loadMasters = useCallback(async () => {
    try {
      const [pdpRes, meterRes] = await Promise.all([
        axios.get(`${API}pdps`),
        axios.get(`${API}meters`),
      ]);
      if (pdpRes.data.success) setPdps(pdpRes.data.data);
      if (meterRes.data.success) setMeters(meterRes.data.data);
    } catch (e) { /* silent — polled again shortly */ }
  }, []);

  const loadOpenAlertCount = useCallback(async () => {
    try {
      const res = await axios.get(`${API}alerts`, { params: { active: true } });
      if (res.data.success) setOpenAlertCount(res.data.data.length);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadMasters();
    loadOpenAlertCount();
    const iv = setInterval(() => { loadMasters(); loadOpenAlertCount(); }, 30000);
    return () => clearInterval(iv);
  }, [loadMasters, loadOpenAlertCount]);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-3">
          <div className="p-2 rounded-lg bg-amber-50">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-none">Energy Meters</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">PDP & meter live readings, consumption reports and alerts</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-5 pb-2 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  active ? "bg-blue-600 text-white shadow-sm shadow-blue-200" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
                {t.key === "alerts" && openAlertCount > 0 && (
                  <span className={`ml-1 text-[10px] font-bold px-1.5 rounded-full ${active ? "bg-white/20" : "bg-rose-100 text-rose-600"}`}>
                    {openAlertCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "live"    && <LiveTab />}
        {tab === "reports" && <ReportsTab meters={meters} />}
        {tab === "alerts"  && <AlertsTab meters={meters} onChange={loadOpenAlertCount} />}
        {tab === "config"  && <ConfigTab pdps={pdps} meters={meters} onChange={loadMasters} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LIVE TAB
═══════════════════════════════════════════════════════════ */
const CommBadge = ({ status }) =>
  status === "Online" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Wifi className="w-2.5 h-2.5" /> Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
      <WifiOff className="w-2.5 h-2.5" /> Offline
    </span>
  );

const TodayConsumptionCard = ({ todayKwh }) => (
  <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl shadow-sm p-5 flex items-center gap-4 mb-4">
    <div className="p-3 rounded-xl bg-amber-100 shrink-0">
      <Zap className="w-6 h-6 text-amber-600" />
    </div>
    <div>
      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-widest">Today's Consumption</p>
      <p className="text-3xl font-bold text-slate-800 font-mono leading-tight">
        {todayKwh != null ? Number(todayKwh).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--"}
        <span className="text-base text-slate-400 font-normal ml-1.5">kWh</span>
      </p>
    </div>
  </div>
);

const StatPanel = ({ title, rows }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <h3 className="text-sm font-bold text-slate-800 mb-2.5">{title}</h3>
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className={`flex items-center justify-between text-xs ${
          r.highlight ? "pt-1.5 mt-1 border-t border-slate-100 font-bold text-slate-800" : "text-slate-500"
        }`}>
          <span>{r.label}</span>
          <span className="font-mono font-semibold">
            {r.value}{r.unit ? <span className="text-slate-400 font-normal ml-0.5">{r.unit}</span> : null}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// Phase labels follow the R/Y/B convention (mapped from the meter's A/B/C columns).
const buildPanels = (m, todayKwh) => [
  {
    title: "Current (A)", rows: [
      { label: "R", value: fmt(m.currentA) },
      { label: "Y", value: fmt(m.currentB) },
      { label: "B", value: fmt(m.currentC) },
      { label: "Average", value: fmt(m.currentAvg), highlight: true },
    ],
  },
  {
    title: "Voltage (V, Line-Neutral)", rows: [
      { label: "R-N", value: fmt(m.voltageAn) },
      { label: "Y-N", value: fmt(m.voltageBn) },
      { label: "B-N", value: fmt(m.voltageCn) },
      { label: "Average", value: fmt(m.voltageLnAvg), highlight: true },
    ],
  },
  {
    title: "Voltage (V, Line-Line)", rows: [
      { label: "R-Y", value: fmt(m.voltageAb) },
      { label: "Y-B", value: fmt(m.voltageBc) },
      { label: "B-R", value: fmt(m.voltageCa) },
      { label: "Average", value: fmt(m.voltageLlAvg), highlight: true },
    ],
  },
  {
    title: "Active Power (kW)", rows: [
      { label: "R", value: fmt(m.powerA, 3) },
      { label: "Y", value: fmt(m.powerB, 3) },
      { label: "B", value: fmt(m.powerC, 3) },
      { label: "Total", value: fmt(m.powerTotal, 3), highlight: true },
    ],
  },
  {
    title: "Power Factor", rows: [
      { label: "R", value: fmt(m.pfA, 3) },
      { label: "Y", value: fmt(m.pfB, 3) },
      { label: "B", value: fmt(m.pfC, 3) },
      { label: "Total", value: fmt(m.pfTotal, 3), highlight: true },
    ],
  },
  {
    title: "Energy", rows: [
      { label: "Frequency", value: fmt(m.frequency, 2), unit: "Hz" },
      { label: "Total Energy", value: m.energyKwh != null ? Number(m.energyKwh).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--", unit: "kWh" },
      { label: "Today", value: todayKwh != null ? Number(todayKwh).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--", unit: "kWh", highlight: true },
    ],
  },
];

const TREND_PANELS = [
  {
    title: "Voltage (Line-Neutral)", unit: "V", series: [
      { key: "voltageAn", label: "R-N", color: "#ef4444" },
      { key: "voltageBn", label: "Y-N", color: "#f59e0b" },
      { key: "voltageCn", label: "B-N", color: "#3b82f6" },
    ],
  },
  {
    title: "Current", unit: "A", series: [
      { key: "currentA", label: "R", color: "#ef4444" },
      { key: "currentB", label: "Y", color: "#f59e0b" },
      { key: "currentC", label: "B", color: "#3b82f6" },
    ],
  },
  {
    title: "Active Power", unit: "kW", series: [
      { key: "powerA", label: "R", color: "#ef4444" },
      { key: "powerB", label: "Y", color: "#f59e0b" },
      { key: "powerC", label: "B", color: "#3b82f6" },
      { key: "powerTotal", label: "Total", color: "#7c3aed" },
    ],
  },
  {
    title: "Power Factor", unit: "", series: [
      { key: "pfTotal", label: "Total", color: "#7c3aed" },
    ],
  },
  {
    title: "Frequency", unit: "Hz", series: [
      { key: "frequency", label: "Freq", color: "#7c3aed" },
    ],
  },
];

const PhaseTrendChart = ({ title, unit, series, data }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
    <div className="flex items-center justify-between mb-2 flex-wrap gap-y-1">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        {title} {unit && <span className="text-slate-400">({unit})</span>}
      </p>
      <div className="flex items-center gap-2.5">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="timeLabel" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={34} domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid #e2e8f0" }} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.75} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const TodayConsumptionChart = ({ meterId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!meterId) return;
    setLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);
      const res = await axios.get(`${API}consumption`, {
        params: { meterId, periodType: "Hour", from: todayStart.toISOString(), to: tomorrowStart.toISOString() },
      });
      if (res.data.success) {
        let cumulative = 0;
        setRows(res.data.data
          .sort((a, b) => new Date(a.periodStart) - new Date(b.periodStart))
          .map((r) => {
            cumulative += Number(r.consumptionKwh);
            return {
              ...r,
              hourLabel: new Date(r.periodStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              cumulativeKwh: cumulative,
            };
          }));
      }
    } catch (e) {} finally { setLoading(false); }
  }, [meterId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const totalKwh = rows.reduce((a, r) => a + Number(r.consumptionKwh), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-800">Today's Consumption by Hour</h3>
        <span className="text-xs font-mono font-bold text-amber-600">
          {totalKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh total
        </span>
      </div>
      {loading && !rows.length ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">Loading…</div>
      ) : !rows.length ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">No completed hours yet today.</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="hourLabel" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
            <YAxis yAxisId="hourly" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
            <YAxis yAxisId="cumulative" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}
              formatter={(v, name) => [`${fmt(v, 3)} kWh`, name === "cumulativeKwh" ? "Cumulative" : "Hourly"]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "cumulativeKwh" ? "Cumulative Today" : "Hourly Consumption")} />
            <Bar yAxisId="hourly" dataKey="consumptionKwh" fill="#fcd34d" radius={[4, 4, 0, 0]} />
            <Line yAxisId="cumulative" type="monotone" dataKey="cumulativeKwh" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#f59e0b" }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

const TrendSection = ({ meterId, hours }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!meterId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}trend`, { params: { meterId, hours: Math.ceil(hours) } });
        if (!cancelled && res.data.success) {
          setData(res.data.data.map((r) => ({ ...r, timeLabel: new Date(r.ts).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) })));
        }
      } catch (e) {} finally { if (!cancelled) setLoading(false); }
    };
    load();
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [meterId, hours]);

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-800 mb-3">Trend</h3>
      {loading && !data.length ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">Loading…</div>
      ) : !data.length ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">No history for this range.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {TREND_PANELS.map((panel) => <PhaseTrendChart key={panel.title} data={data} {...panel} />)}
        </div>
      )}
    </div>
  );
};

// ── Meter overview cards (search + date-range toolbar, matching the Utility
//    Reading / Dehumidifier monitor cards) ───────────────────────────────────
const DATE_RANGES = [
  { k: "shift", l: "Shift" },
  { k: "today", l: "Today" },
  { k: "3days", l: "3 Days", hours: 72 },
  { k: "week",  l: "Week",  hours: 168 },
];

// Shift 1: 08:00–20:00. Shift 2: 20:00–08:00 (next day).
const getShiftStart = () => {
  const now = new Date();
  const t8  = new Date(now); t8.setHours(8, 0, 0, 0);
  const t20 = new Date(now); t20.setHours(20, 0, 0, 0);
  if (now >= t8 && now < t20) return t8;
  if (now < t8) return new Date(t20.getTime() - 86_400_000);
  return t20;
};

const resolveHours = (key) => {
  if (key === "shift") {
    return Math.max(1, (Date.now() - getShiftStart().getTime()) / 3_600_000);
  }
  if (key === "today") {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(1, (now - midnight) / 3_600_000);
  }
  return DATE_RANGES.find((r) => r.k === key)?.hours ?? 24;
};

const DateFilter = ({ value, onChange }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
    {DATE_RANGES.map((r) => (
      <button key={r.k} onClick={() => onChange(r.k)}
        className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-colors ${
          value === r.k ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-200 hover:bg-slate-50"
        }`}>{r.l}</button>
    ))}
  </div>
);

const clampPct = (v, max) => (v == null || !max ? 0 : Math.min(1, Math.max(0, v / max)));

const MeterOverviewCard = ({ m, todayKwh, selected, onSelect }) => {
  const stats = [
    { label: "Voltage", value: fmt(m.voltageLlAvg), unit: "V",  color: "#2563eb", pct: clampPct(m.voltageLlAvg, 450) },
    { label: "Current", value: fmt(m.currentAvg),   unit: "A",  color: "#f97316", pct: clampPct(m.currentAvg, m.iMax || 150) },
    { label: "Power",   value: fmt(m.powerTotal, 2), unit: "kW", color: "#10b981", pct: clampPct(m.powerTotal, 100) },
    { label: "PF",      value: fmt(m.pfTotal, 2),    unit: "",  color: "#8b5cf6", pct: clampPct(m.pfTotal, 1) },
  ];
  return (
    <div
      onClick={() => onSelect(m.meterId)}
      className={`relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer p-5 ${
        selected ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <Radio className="absolute top-4 right-4 w-3.5 h-3.5 text-slate-300" />
      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide pr-6 leading-snug">{m.meterName}</h3>
      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.meterCode} · {m.pdpName || "—"}</p>
      {m.meterLocation && (
        <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
          <MapPin className="w-3 h-3 shrink-0" /> {m.meterLocation}
        </p>
      )}
      <span className={`inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
        m.commStatus === "Online" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${m.commStatus === "Online" ? "bg-emerald-500" : "bg-slate-400"}`} /> {m.commStatus}
      </span>

      <div className="mt-4 space-y-2.5">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>
              <span>{s.label}</span>
              <span className="text-slate-700 font-mono text-xs">{s.value}{s.unit}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
              <div className="h-full rounded-full transition-all" style={{ width: `${s.pct * 100}%`, background: s.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
          <Zap className="w-3 h-3" /> Today
        </span>
        <span className="text-sm font-bold text-slate-800 font-mono">
          {todayKwh != null ? Number(todayKwh).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "--"}
          <span className="text-[10px] text-slate-400 font-normal ml-0.5">kWh</span>
        </span>
      </div>

      <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-3">
        <Clock className="w-3 h-3" /> {m.lastCommAt ? new Date(m.lastCommAt).toLocaleString() : "No data yet"}
      </p>
    </div>
  );
};

const MeterDetailPage = ({ meter, todayKwh, hours, onBack }) => (
  <div>
    <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-2 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to meters
        </button>
        <h2 className="text-base font-bold text-slate-800">
          {meter.meterName} <span className="font-mono text-cyan-600 text-sm font-semibold">({meter.meterCode})</span>
        </h2>
        <p className="text-[11px] text-slate-400">
          {meter.pdpName || "—"}{meter.meterLocation ? ` · ${meter.meterLocation}` : ""}
        </p>
      </div>
      <CommBadge status={meter.commStatus} />
    </div>
    {meter.commStatus !== "Online" && meter.lastError && (
      <p className="mb-3 text-xs text-rose-500">{meter.lastError}</p>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {buildPanels(meter, todayKwh).map((p) => <StatPanel key={p.title} {...p} />)}
    </div>
    <TodayConsumptionChart meterId={meter.meterId} />
    <TrendSection meterId={meter.meterId} hours={hours} />
  </div>
);

const LiveTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("meter") ? Number(searchParams.get("meter")) : null;
  const setSelectedId = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id == null) next.delete("meter"); else next.set("meter", String(id));
      return next;
    });
  };

  const [live, setLive] = useState([]);
  const [todayKwh, setTodayKwh] = useState({}); // { [meterId]: totalKwh }
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("today");

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}live`);
      if (res.data.success) setLive(res.data.data);
    } catch (e) {}
  }, []);

  const loadTodayConsumption = useCallback(async () => {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);
      const res = await axios.get(`${API}consumption`, {
        params: { periodType: "Hour", from: todayStart.toISOString(), to: tomorrowStart.toISOString() },
      });
      if (res.data.success) {
        const totals = {};
        res.data.data.forEach((r) => { totals[r.meterId] = (totals[r.meterId] || 0) + Number(r.consumptionKwh); });
        setTodayKwh(totals);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    load();
    loadTodayConsumption();
    const iv = setInterval(load, 7000);
    const ivKwh = setInterval(loadTodayConsumption, 60000);
    return () => { clearInterval(iv); clearInterval(ivKwh); };
  }, [load, loadTodayConsumption]);

  const online = live.filter((m) => m.commStatus === "Online").length;
  const todayTotal = Object.values(todayKwh).reduce((a, b) => a + b, 0);
  const selectedMeter = live.find((m) => m.meterId === selectedId);

  const q = search.trim().toLowerCase();
  const filteredLive = q
    ? live.filter((m) => [m.meterName, m.meterCode, m.pdpName].some((v) => (v || "").toLowerCase().includes(q)))
    : live;

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          <Wifi className="w-3 h-3" /> {online} Online
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
          <WifiOff className="w-3 h-3" /> {live.length - online} Offline
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
          <Zap className="w-3 h-3" /> Plant Today: {todayTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
        </span>
      </div>

      {!live.length ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-sm text-slate-400">
          No meters configured yet. Add one from the Config tab.
        </div>
      ) : selectedMeter ? (
        <MeterDetailPage
          meter={selectedMeter}
          todayKwh={todayKwh[selectedMeter.meterId]}
          hours={resolveHours(dateRange)}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <>
          <TodayConsumptionCard todayKwh={todayTotal} />

          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search meters…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-56"
              />
            </div>
            <DateFilter value={dateRange} onChange={setDateRange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredLive.length
              ? filteredLive.map((m) => (
                  <MeterOverviewCard
                    key={m.meterId} m={m} todayKwh={todayKwh[m.meterId]}
                    selected={m.meterId === selectedId} onSelect={setSelectedId}
                  />
                ))
              : <div className="col-span-full bg-white rounded-xl border border-slate-200 py-10 text-center text-sm text-slate-400">No meters match "{search}".</div>}
          </div>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   REPORTS TAB
═══════════════════════════════════════════════════════════ */
const REPORT_TYPES = [
  { k: "consumption",    l: "Consumption" },
  { k: "peak-demand",    l: "Peak Demand" },
  { k: "pdp-summary",    l: "PDP Summary" },
  { k: "alert-summary",  l: "Alert Summary" },
];

const ReportsTab = ({ meters }) => {
  const [reportType, setReportType] = useState("consumption");
  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        {REPORT_TYPES.map((r) => (
          <button key={r.k} onClick={() => setReportType(r.k)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              reportType === r.k ? "bg-slate-800 text-white border-slate-800" : "text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}>{r.l}</button>
        ))}
      </div>
      {reportType === "consumption"   && <ConsumptionReport meters={meters} />}
      {reportType === "peak-demand"   && <PeakDemandReport meters={meters} />}
      {reportType === "pdp-summary"   && <PdpSummaryReport />}
      {reportType === "alert-summary" && <AlertSummaryReport meters={meters} />}
    </div>
  );
};

const ConsumptionReport = ({ meters }) => {
  const [meterId, setMeterId] = useState("all");
  const [periodType, setPeriodType] = useState("Day");
  const [rows, setRows] = useState([]);
  const [partialRows, setPartialRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { periodType };
      if (meterId !== "all") params.meterId = meterId;
      const res = await axios.get(`${API}consumption`, { params });
      if (res.data.success) setRows(res.data.data);
    } catch (e) {} finally { setLoading(false); }
  }, [meterId, periodType]);

  // Day/Month rollups only appear once that period fully closes (midnight /
  // month-end). Until then, show a running total for the still-open period —
  // summed live from completed Hour rows — so the tab isn't just empty.
  const loadPartial = useCallback(async () => {
    if (periodType === "Hour") { setPartialRows([]); return; }
    const now = new Date();
    const periodStart = periodType === "Day"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), 1);
    try {
      const params = { periodType: "Hour", from: periodStart.toISOString(), to: now.toISOString() };
      if (meterId !== "all") params.meterId = meterId;
      const res = await axios.get(`${API}consumption`, { params });
      if (!res.data.success) return;
      const byMeter = {};
      res.data.data.forEach((r) => {
        const acc = byMeter[r.meterId] ??= {
          meterId: r.meterId, meterName: r.meterName, meterCode: r.meterCode,
          consumptionKwh: 0, startCounterKwh: null, endCounterKwh: null, earliestStart: null, latestStart: null,
        };
        acc.consumptionKwh += Number(r.consumptionKwh);
        const rStart = new Date(r.periodStart);
        if (acc.earliestStart == null || rStart < acc.earliestStart) { acc.earliestStart = rStart; acc.startCounterKwh = r.startCounterKwh; }
        if (acc.latestStart == null || rStart > acc.latestStart) { acc.latestStart = rStart; acc.endCounterKwh = r.endCounterKwh; }
      });
      setPartialRows(Object.values(byMeter).map((r) => ({
        id: `partial-${r.meterId}`, meterId: r.meterId, meterName: r.meterName, meterCode: r.meterCode,
        periodStart, periodEnd: now,
        consumptionKwh: r.consumptionKwh, startCounterKwh: r.startCounterKwh, endCounterKwh: r.endCounterKwh,
        inProgress: true,
      })));
    } catch (e) {}
  }, [periodType, meterId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    loadPartial();
    const iv = setInterval(loadPartial, 60000);
    return () => clearInterval(iv);
  }, [loadPartial]);

  // A meter that already has a real closed row for this period doesn't need
  // the synthetic "in progress" total too.
  const visiblePartialRows = partialRows.filter((p) => !rows.some((r) => r.meterId === p.meterId));
  const displayRows = [...visiblePartialRows, ...rows];

  const exportExcel = () => {
    const headers = ["Meter", "Meter Code", "Period", "Start", "End", "Consumption (kWh)", "Start Counter", "End Counter"];
    const data = displayRows.map((r) => [
      r.meterName, r.meterCode, r.inProgress ? `${periodType} (in progress)` : periodType,
      new Date(r.periodStart).toLocaleString(), r.inProgress ? "In Progress" : new Date(r.periodEnd).toLocaleString(),
      Number(r.consumptionKwh).toFixed(3), r.startCounterKwh ?? "", r.endCounterKwh ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consumption");
    XLSX.writeFile(wb, `EnergyConsumption_${periodType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Meter</label>
          <select value={meterId} onChange={(e) => setMeterId(e.target.value)} className={selectCls} style={{ minWidth: 180 }}>
            <option value="all">All Meters</option>
            {meters.map((m) => <option key={m.id} value={m.id}>{m.meterName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Period</label>
          <div className="flex gap-1.5">
            {["Hour", "Day", "Month"].map((p) => (
              <button key={p} onClick={() => setPeriodType(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  periodType === p ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}>{p}</button>
            ))}
          </div>
        </div>
        <button onClick={exportExcel} disabled={!displayRows.length}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-40 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <TH>Meter</TH><TH>Period Start</TH><TH>Period End</TH>
                <TH center>Consumption (kWh)</TH><TH center>Start Counter</TH><TH center>End Counter</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-400">Loading…</td></tr>
              ) : displayRows.length ? displayRows.map((r) => (
                <tr key={r.id} className={`transition-colors ${r.inProgress ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-blue-50/40 even:bg-slate-50/30"}`}>
                  <TD cls="font-semibold text-slate-700">{r.meterName} <span className="text-slate-400 font-mono text-[10px]">({r.meterCode})</span></TD>
                  <TD>{new Date(r.periodStart).toLocaleString()}</TD>
                  <TD>
                    {r.inProgress
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">In Progress</span>
                      : new Date(r.periodEnd).toLocaleString()}
                  </TD>
                  <TD center mono cls="font-bold text-blue-600">{fmt(r.consumptionKwh, 3)}</TD>
                  <TD center mono cls="text-slate-500">{fmt(r.startCounterKwh, 3)}</TD>
                  <TD center mono cls="text-slate-500">{fmt(r.endCounterKwh, 3)}</TD>
                </tr>
              )) : <EmptyState colSpan={6} message="No consumption data for this selection yet." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PeakDemandReport = ({ meters }) => {
  const [meterId, setMeterId] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (meterId !== "all") params.meterId = meterId;
      const res = await axios.get(`${API}reports/peak-demand`, { params });
      if (res.data.success) setRows(res.data.data);
    } catch (e) {} finally { setLoading(false); }
  }, [meterId]);

  useEffect(() => { load(); }, [load]);

  const exportExcel = () => {
    const headers = ["Meter", "Day", "Peak (kW)", "Peak At", "Avg Demand (kW)", "Load Factor"];
    const data = rows.map((r) => [
      r.meterName, new Date(r.day).toLocaleDateString(), Number(r.peakKw).toFixed(3),
      new Date(r.peakAt).toLocaleString(), Number(r.avgKw).toFixed(3),
      r.loadFactor != null ? `${(r.loadFactor * 100).toFixed(1)}%` : "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Peak Demand");
    XLSX.writeFile(wb, `PeakDemand_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Meter</label>
          <select value={meterId} onChange={(e) => setMeterId(e.target.value)} className={selectCls} style={{ minWidth: 180 }}>
            <option value="all">All Meters</option>
            {meters.map((m) => <option key={m.id} value={m.id}>{m.meterName}</option>)}
          </select>
        </div>
        <p className="text-[10px] text-slate-400 max-w-xs">Last 30 days. Load Factor = average demand ÷ peak demand for that day — higher is more efficient.</p>
        <button onClick={exportExcel} disabled={!rows.length}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-40 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <TH>Meter</TH><TH>Day</TH><TH center>Peak (kW)</TH><TH>Peak At</TH>
                <TH center>Avg Demand (kW)</TH><TH center>Load Factor</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-400">Loading…</td></tr>
              ) : rows.length ? rows.map((r) => (
                <tr key={`${r.meterId}-${r.day}`} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                  <TD cls="font-semibold text-slate-700">{r.meterName} <span className="text-slate-400 font-mono text-[10px]">({r.meterCode})</span></TD>
                  <TD>{new Date(r.day).toLocaleDateString()}</TD>
                  <TD center mono cls="font-bold text-rose-600">{fmt(r.peakKw, 2)}</TD>
                  <TD>{new Date(r.peakAt).toLocaleTimeString()}</TD>
                  <TD center mono cls="text-slate-500">{fmt(r.avgKw, 2)}</TD>
                  <TD center mono cls="text-slate-500">{r.loadFactor != null ? `${(r.loadFactor * 100).toFixed(1)}%` : "--"}</TD>
                </tr>
              )) : <EmptyState colSpan={6} message="No reading history for this range yet." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PdpSummaryReport = () => {
  const [periodType, setPeriodType] = useState("Day");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}reports/pdp-summary`, { params: { periodType } });
      if (res.data.success) setRows(res.data.data);
    } catch (e) {} finally { setLoading(false); }
  }, [periodType]);

  useEffect(() => { load(); }, [load]);

  const exportExcel = () => {
    const headers = ["PDP Number", "PDP Name", "Meters", "Total Consumption (kWh)"];
    const data = rows.map((r) => [r.pdpNumber, r.pdpName, r.meterCount, Number(r.totalKwh).toFixed(3)]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PDP Summary");
    XLSX.writeFile(wb, `PdpSummary_${periodType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Period</label>
          <div className="flex gap-1.5">
            {["Hour", "Day", "Month"].map((p) => (
              <button key={p} onClick={() => setPeriodType(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  periodType === p ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}>{p}</button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">Sums closed {periodType.toLowerCase()} rollups across every meter under each PDP.</p>
        <button onClick={exportExcel} disabled={!rows.length}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-40 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <TH>PDP Number</TH><TH>PDP Name</TH><TH center>Meters</TH><TH center>Total Consumption (kWh)</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-10 text-center text-xs text-slate-400">Loading…</td></tr>
              ) : rows.length ? rows.map((r) => (
                <tr key={r.pdpId} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                  <TD mono cls="font-bold text-cyan-600">{r.pdpNumber}</TD>
                  <TD cls="font-semibold text-slate-700">{r.pdpName}</TD>
                  <TD center mono>{r.meterCount}</TD>
                  <TD center mono cls="font-bold text-blue-600">{fmt(r.totalKwh, 3)}</TD>
                </tr>
              )) : <EmptyState colSpan={4} message={`No closed ${periodType.toLowerCase()} rollups yet for this selection.`} />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AlertSummaryReport = ({ meters }) => {
  const [meterId, setMeterId] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (meterId !== "all") params.meterId = meterId;
      const res = await axios.get(`${API}reports/alert-summary`, { params });
      if (res.data.success) setRows(res.data.data);
    } catch (e) {} finally { setLoading(false); }
  }, [meterId]);

  useEffect(() => { load(); }, [load]);

  const exportExcel = () => {
    const headers = ["Meter", "Alert Type", "Severity", "Occurrences", "Total Minutes", "Still Open"];
    const data = rows.map((r) => [r.meterName, r.alertType, r.severity, r.occurrences, Number(r.totalMinutes).toFixed(1), r.stillOpen]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alert Summary");
    XLSX.writeFile(wb, `AlertSummary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Meter</label>
          <select value={meterId} onChange={(e) => setMeterId(e.target.value)} className={selectCls} style={{ minWidth: 180 }}>
            <option value="all">All Meters</option>
            {meters.map((m) => <option key={m.id} value={m.id}>{m.meterName}</option>)}
          </select>
        </div>
        <p className="text-[10px] text-slate-400">Last 30 days, grouped by alert type.</p>
        <button onClick={exportExcel} disabled={!rows.length}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-40 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <TH>Meter</TH><TH>Alert Type</TH><TH center>Severity</TH>
                <TH center>Occurrences</TH><TH center>Total Downtime</TH><TH center>Still Open</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-400">Loading…</td></tr>
              ) : rows.length ? rows.map((r) => (
                <tr key={`${r.meterId}-${r.alertType}-${r.severity}`} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                  <TD cls="font-semibold text-slate-700">{r.meterName} <span className="text-slate-400 font-mono text-[10px]">({r.meterCode})</span></TD>
                  <TD>{r.alertType}</TD>
                  <TD center><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.Warning}`}>{r.severity}</span></TD>
                  <TD center mono cls="font-bold text-slate-700">{r.occurrences}</TD>
                  <TD center mono cls="text-slate-500">
                    {r.totalMinutes >= 60 ? `${(r.totalMinutes / 60).toFixed(1)} h` : `${fmt(r.totalMinutes, 1)} min`}
                  </TD>
                  <TD center>{r.stillOpen > 0
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">{r.stillOpen} open</span>
                    : <span className="text-[10px] text-slate-300">—</span>}
                  </TD>
                </tr>
              )) : <EmptyState colSpan={6} message="No alerts for this selection in the last 30 days." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   ALERTS TAB
═══════════════════════════════════════════════════════════ */
const SEVERITY_STYLE = {
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
  Warning:  "bg-amber-50 text-amber-700 border-amber-200",
};

const AlertsTab = ({ onChange }) => {
  const [rows, setRows] = useState([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}alerts`, { params: activeOnly ? { active: true } : {} });
      if (res.data.success) setRows(res.data.data);
    } catch (e) {} finally { setLoading(false); }
  }, [activeOnly]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  const acknowledge = async (id) => {
    try {
      await axios.post(`${API}alerts/${id}/acknowledge`, {});
      toast.success("Alert acknowledged.");
      load(); onChange?.();
    } catch (e) { toast.error("Failed to acknowledge alert."); }
  };

  const resolve = async (id) => {
    try {
      await axios.post(`${API}alerts/${id}/resolve`, {});
      toast.success("Alert resolved.");
      load(); onChange?.();
    } catch (e) { toast.error("Failed to resolve alert."); }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => setActiveOnly((p) => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            activeOnly ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-200 hover:bg-slate-50"
          }`}>
          <AlertTriangle className="w-3.5 h-3.5" /> {activeOnly ? "Showing Active Only" : "Showing All"}
        </button>
        <button onClick={load} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[65vh]">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <TH>Meter</TH><TH>Type</TH><TH center>Severity</TH><TH>Message</TH>
                <TH>Opened</TH><TH>Resolved</TH><TH center>Ack</TH><TH center>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-slate-400">Loading…</td></tr>
              ) : rows.length ? rows.map((a) => (
                <tr key={a.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                  <TD cls="font-semibold text-slate-700">{a.meterName} <span className="text-slate-400 font-mono text-[10px]">({a.meterCode})</span></TD>
                  <TD>{a.alertType}</TD>
                  <TD center><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.Warning}`}>{a.severity}</span></TD>
                  <TD cls="text-slate-500">{a.message}</TD>
                  <TD>{new Date(a.openedAt).toLocaleString()}</TD>
                  <TD>{a.resolvedAt ? new Date(a.resolvedAt).toLocaleString() : <span className="text-rose-500 font-semibold">Open</span>}</TD>
                  <TD center>{a.isAcknowledged ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" /> : <XCircle className="w-4 h-4 text-slate-300 inline" />}</TD>
                  <TD center>
                    <div className="flex items-center justify-center gap-1.5">
                      {!a.isAcknowledged && (
                        <button onClick={() => acknowledge(a.id)} className="text-[10px] font-semibold px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">Ack</button>
                      )}
                      {!a.resolvedAt && (
                        <button onClick={() => resolve(a.id)} className="text-[10px] font-semibold px-2 py-1 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50">Resolve</button>
                      )}
                    </div>
                  </TD>
                </tr>
              )) : <EmptyState colSpan={8} message="No alerts." />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   CONFIG TAB — PDP & Meter masters
═══════════════════════════════════════════════════════════ */
const PDP_INIT = { pdpNumber: "", pdpName: "", location: "", isActive: true };
const METER_INIT = {
  meterCode: "", meterName: "", pdpId: "", meterLocation: "", commType: "TCP",
  ipAddress: "", tcpPort: 502, comPort: "", baudRate: 9600, parity: "N", stopbits: 1, bytesize: 8,
  pollIntervalS: 5, slaveId: 1, meterModel: "",
  isEnabled: true, vMin: "", vMax: "", iMax: "", pfMin: "", freqMin: "", freqMax: "",
};

const ConfigTab = ({ pdps, meters, onChange }) => {
  const [sub, setSub] = useState("meters");
  const [pdpModal, setPdpModal] = useState({ open: false, mode: "add" });
  const [pdpForm, setPdpForm] = useState(PDP_INIT);
  const [meterModal, setMeterModal] = useState({ open: false, mode: "add" });
  const [meterForm, setMeterForm] = useState(METER_INIT);

  const savePdp = async () => {
    if (!pdpForm.pdpNumber || !pdpForm.pdpName) return toast.error("PDP Number and Name are required.");
    try {
      if (pdpModal.mode === "add") await axios.post(`${API}pdps`, pdpForm);
      else await axios.put(`${API}pdps/${pdpModal.row.id}`, pdpForm);
      toast.success("PDP saved.");
      setPdpModal({ open: false }); onChange();
    } catch (err) { toast.error(err?.response?.data?.message || "Failed to save PDP."); }
  };

  const deletePdp = async (id) => {
    try { await axios.delete(`${API}pdps/${id}`); toast.success("PDP deleted."); onChange(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed to delete PDP."); }
  };

  const saveMeter = async () => {
    if (!meterForm.meterCode || !meterForm.meterName || !meterForm.meterModel) return toast.error("Meter Code, Name and Model are required.");
    try {
      if (meterModal.mode === "add") await axios.post(`${API}meters`, meterForm);
      else await axios.put(`${API}meters/${meterModal.row.id}`, meterForm);
      toast.success("Meter saved.");
      setMeterModal({ open: false }); onChange();
    } catch (err) { toast.error(err?.response?.data?.message || "Failed to save meter."); }
  };

  const deleteMeter = async (id) => {
    try { await axios.delete(`${API}meters/${id}`); toast.success("Meter deleted."); onChange(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed to delete meter."); }
  };

  const sf = (setter) => (k) => (e) => setter((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const pf = sf(setPdpForm);
  const mf = sf(setMeterForm);

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-3">
        {[{ k: "pdps", l: "PDPs" }, { k: "meters", l: "Meters" }].map((s) => (
          <button key={s.k} onClick={() => setSub(s.k)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              sub === s.k ? "bg-slate-800 text-white border-slate-800" : "text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}>{s.l}</button>
        ))}
        <button
          onClick={() => sub === "pdps" ? (setPdpForm(PDP_INIT), setPdpModal({ open: true, mode: "add" })) : (setMeterForm(METER_INIT), setMeterModal({ open: true, mode: "add" }))}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> {sub === "pdps" ? "Add PDP" : "Add Meter"}
        </button>
      </div>

      {sub === "pdps" ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead><tr className="bg-slate-50"><TH>PDP Number</TH><TH>Name</TH><TH>Location</TH><TH center>Status</TH><TH center>Actions</TH></tr></thead>
              <tbody>
                {pdps.length ? pdps.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/40 even:bg-slate-50/30">
                    <TD mono cls="font-bold text-cyan-600">{p.pdpNumber}</TD>
                    <TD cls="font-semibold text-slate-700">{p.pdpName}</TD>
                    <TD cls="text-slate-500">{p.location}</TD>
                    <TD center><StatusBadge active={p.isActive} /></TD>
                    <TD center><TableActions onEdit={() => { setPdpForm({ ...p }); setPdpModal({ open: true, mode: "edit", row: p }); }} onDelete={() => deletePdp(p.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={5} message="No PDPs configured." />}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50">
                  <TH>Meter Code</TH><TH>Name</TH><TH>PDP</TH><TH>Comm</TH><TH>Address</TH>
                  <TH center>Slave ID</TH><TH center>Enabled</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {meters.length ? meters.map((m) => (
                  <tr key={m.id} className="hover:bg-blue-50/40 even:bg-slate-50/30">
                    <TD mono cls="font-bold text-cyan-600">{m.meterCode}</TD>
                    <TD cls="font-semibold text-slate-700">{m.meterName}</TD>
                    <TD cls="text-slate-500">{m.pdpName}</TD>
                    <TD><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{m.commType}</span></TD>
                    <TD mono cls="text-slate-500">{m.commType === "TCP" ? `${m.ipAddress || "—"}:${m.tcpPort || "—"}` : `${m.comPort || "—"} @ ${m.baudRate || "—"}`}</TD>
                    <TD center mono>{m.slaveId}</TD>
                    <TD center><StatusBadge active={m.isEnabled} /></TD>
                    <TD center><TableActions onEdit={() => { setMeterForm({ ...m }); setMeterModal({ open: true, mode: "edit", row: m }); }} onDelete={() => deleteMeter(m.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={8} message="No meters configured." />}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pdpModal.open && (
        <Modal title={pdpModal.mode === "add" ? "Add PDP" : "Edit PDP"} onClose={() => setPdpModal({ open: false })} onSave={savePdp}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="PDP Number" required><input value={pdpForm.pdpNumber} onChange={pf("pdpNumber")} placeholder="e.g. PDP-01" className={inputCls} /></Field>
            <Field label="PDP Name" required><input value={pdpForm.pdpName} onChange={pf("pdpName")} placeholder="e.g. Main PDP - Bay 1" className={inputCls} /></Field>
            <Field label="Location"><input value={pdpForm.location} onChange={pf("location")} placeholder="e.g. Shop Floor A" className={inputCls} /></Field>
            <div className="col-span-2 flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <input type="checkbox" checked={pdpForm.isActive} onChange={pf("isActive")} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-slate-700 font-medium">Active</span>
            </div>
          </div>
        </Modal>
      )}

      {meterModal.open && (
        <Modal title={meterModal.mode === "add" ? "Add Meter" : "Edit Meter"} onClose={() => setMeterModal({ open: false })} onSave={saveMeter} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Meter Code" required><input value={meterForm.meterCode} onChange={mf("meterCode")} placeholder="e.g. EM-01" className={inputCls} /></Field>
            <Field label="Meter Name" required><input value={meterForm.meterName} onChange={mf("meterName")} placeholder="e.g. Compressor Feeder Meter" className={inputCls} /></Field>
            <Field label="PDP">
              <select value={meterForm.pdpId} onChange={mf("pdpId")} className={selectCls}>
                <option value="">Select PDP</option>
                {pdps.map((p) => <option key={p.id} value={p.id}>{p.pdpName} ({p.pdpNumber})</option>)}
              </select>
            </Field>
            <Field label="Meter Location"><input value={meterForm.meterLocation} onChange={mf("meterLocation")} placeholder="e.g. Panel 3, Bay 1" className={inputCls} /></Field>
            <Field label="Meter Model" required><input value={meterForm.meterModel} onChange={mf("meterModel")} placeholder="e.g. EM1220H" className={inputCls} /></Field>
            <Field label="Poll Interval (s)"><input type="number" value={meterForm.pollIntervalS} onChange={mf("pollIntervalS")} placeholder="5" className={inputCls} /></Field>
            <Field label="Comm Type">
              <select value={meterForm.commType} onChange={mf("commType")} className={selectCls}>
                <option value="TCP">TCP</option>
                <option value="RTU">RTU</option>
              </select>
            </Field>
            <Field label="Slave ID"><input type="number" value={meterForm.slaveId} onChange={mf("slaveId")} placeholder="1" className={inputCls} /></Field>

            {meterForm.commType === "TCP" ? (
              <>
                <Field label="IP Address"><input value={meterForm.ipAddress} onChange={mf("ipAddress")} placeholder="e.g. 192.168.1.50" className={inputCls} /></Field>
                <Field label="TCP Port"><input type="number" value={meterForm.tcpPort} onChange={mf("tcpPort")} placeholder="502" className={inputCls} /></Field>
              </>
            ) : (
              <>
                <Field label="COM Port"><input value={meterForm.comPort} onChange={mf("comPort")} placeholder="e.g. COM3" className={inputCls} /></Field>
                <Field label="Baud Rate"><input type="number" value={meterForm.baudRate} onChange={mf("baudRate")} placeholder="9600" className={inputCls} /></Field>
                <Field label="Parity">
                  <select value={meterForm.parity} onChange={mf("parity")} className={selectCls}>
                    <option value="N">None</option>
                    <option value="E">Even</option>
                    <option value="O">Odd</option>
                  </select>
                </Field>
                <Field label="Stop Bits"><input type="number" value={meterForm.stopbits} onChange={mf("stopbits")} placeholder="1" className={inputCls} /></Field>
                <Field label="Byte Size"><input type="number" value={meterForm.bytesize} onChange={mf("bytesize")} placeholder="8" className={inputCls} /></Field>
              </>
            )}

            <div className="col-span-2 mt-1 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Alert Thresholds (optional)</p>
            </div>
            <Field label="Voltage Min (V)"><input type="number" value={meterForm.vMin} onChange={mf("vMin")} className={inputCls} /></Field>
            <Field label="Voltage Max (V)"><input type="number" value={meterForm.vMax} onChange={mf("vMax")} className={inputCls} /></Field>
            <Field label="Current Max (A)"><input type="number" value={meterForm.iMax} onChange={mf("iMax")} className={inputCls} /></Field>
            <Field label="Power Factor Min"><input type="number" step="0.01" value={meterForm.pfMin} onChange={mf("pfMin")} className={inputCls} /></Field>
            <Field label="Frequency Min (Hz)"><input type="number" value={meterForm.freqMin} onChange={mf("freqMin")} className={inputCls} /></Field>
            <Field label="Frequency Max (Hz)"><input type="number" value={meterForm.freqMax} onChange={mf("freqMax")} className={inputCls} /></Field>

            <div className="col-span-2 flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <input type="checkbox" checked={meterForm.isEnabled} onChange={mf("isEnabled")} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-slate-700 font-medium">Enabled (actively polled)</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
