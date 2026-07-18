import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Clock,
  Calendar,
  BarChart2,
  PackageOpen,
  AlertTriangle,
  Gauge,
  Cpu,
  Loader2,
  Search,
  RefreshCw,
  Maximize2,
  Minimize2,
  Timer,
  ArrowLeft,
} from "lucide-react";
import axios from "axios";
import { fileBaseURL } from "../../assets/assets.js";
import toast from "react-hot-toast";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";
import { istToUtcMs } from "../../utils/dateUtils.js";
import {
  selectDowntimeReasons,
  selectQualityDefects,
  selectDowntimeEntries,
  selectQualityEntries,
  selectQualityPassword,
  getMaterialByModel,
  extractSapCode,
  extractProgramName,
  logDowntimeEntry,
  logQualityEntry,
  isActiveShift,
  toMins as sliceToMins,
  selectMachines,
  selectPlans,
} from "../../redux/slices/masterConfigSlice";
import { TimerOff, ShieldCheck, X, Plus, FileImage, Lock } from "lucide-react";
import {
  IDLE_THRESHOLD_MINS,
  STD_CHANGEOVER_MINS,
} from "../../utils/productionLogic.js";
import {
  usePartProcessOEE,
  p2,
  parseDurSecs,
  timeStrToMins,
  oeeColor,
  makeNormalizer,
  componentQtyFromMaster,
} from "./usePartProcessOEE";

ChartJS.register(
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 ── UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const RingProgress = ({
  value,
  max,
  size = 84,
  stroke = 8,
  color = "#3b82f6",
}) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ * (1 - pct);
  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90"
      style={{ display: "block" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
};

const OEEMetricBar = ({ label, value, desc }) => {
  const color = oeeColor(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 w-6">{label}</span>
          <span className="text-[10px] text-slate-400">{desc}</span>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
        {value < 100 && (
          <div
            className="h-full flex-1"
            style={{ backgroundColor: "rgba(239,68,68,0.25)" }}
          />
        )}
      </div>
    </div>
  );
};

const ComponentRow = ({ name, qty, produced, active }) => {
  const pct = qty > 0 ? Math.round((produced / qty) * 100) : 0;
  return (
    <div
      className={`flex flex-col gap-1 p-2 rounded-lg transition-all ${active ? "bg-blue-50 border border-blue-100" : "border border-transparent"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${active ? "bg-blue-500 animate-pulse" : "bg-slate-300"}`}
          />
          <span
            className={`text-xs font-medium ${active ? "text-blue-700" : "text-slate-600"}`}
          >
            {name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-mono">
            {produced}/{qty}
          </span>
          {active && (
            <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${active ? "bg-blue-500" : "bg-slate-300"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const iC =
  "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";
const Lbl = ({ children }) => (
  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
    {children}
  </label>
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 ── TimeMap  (canvas-based shift timeline)
// ─────────────────────────────────────────────────────────────────────────────
// FIX #7 ── TimeMap no longer does its own changeover detection.
//           It accepts a `changeovers` prop (already computed by detectChangeovers)
//           so the KPI card count and the timeline markers are ALWAYS in sync.
// FIX #8 ── When shiftStartTime/shiftEndTime are null ("All Shifts"), we
//           derive axis boundaries from the configured shifts array passed via
//           `allShifts` prop so the overnight gap is eliminated.
// FIX #9 ── normalize() is a pure closure derived from ssm/sem — no stale ref.

const TimeMap = ({
  records,
  changeovers = [],
  isToday = false,
  shiftName = null,
  shiftColor = null,
  // Absolute datetime boundaries for the timeline axis (epoch ms, IST-aware)
  // All Shifts:  rangeStart → rangeEnd
  // Shift 1:     today 08:00 → today 20:00
  // Shift 2:     today 20:00 → tomorrow 08:00
  windowStartMs = null, // epoch ms of axis left edge
  windowEndMs = null, // epoch ms of axis right edge
}) => {
  const scrollRef = useRef(null);
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [canvasW, setCanvasW] = useState(0);
  const [tooltip, setTooltip] = useState(null);

  const dragRef = useRef({ dragging: false, startX: 0, scrollLeft: 0 });
  const onMouseDown = useCallback((e) => {
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      scrollLeft: scrollRef.current?.scrollLeft || 0,
    };
  }, []);
  const onMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging || !scrollRef.current) return;
    scrollRef.current.scrollLeft =
      dragRef.current.scrollLeft - (e.clientX - dragRef.current.startX);
  }, []);
  const onMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const [nowMins, setNowMins] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      const d = new Date();
      setNowMins(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  // ── Absolute ms axis ────────────────────────────────────────────────────
  // All time calculations happen in epoch milliseconds so overnight shifts,
  // multi-day custom ranges, and the live cursor all work without normalisation.

  // IST formatter: epoch ms → "DD/MM HH:MM" or just "HH:MM" depending on span
  const MS_PER_MIN = 60_000;
  const MS_PER_DAY = 86_400_000;

  // Convert "HH:MM" or "HH:MM:SS" from an API record + its eventDate to epoch ms.
  // eventDate (PartProcessEvents.EventDate) is a plain calendar-date tag —
  // whatever wall-clock date the event actually happened on — confirmed
  // directly against the DB. It is NOT a "production day" that lags behind
  // for the post-midnight portion of an overnight shift, so no date bump is
  // needed: EventDate + StartTime is already the correct absolute timestamp.
  // (A previous version bumped the date forward for any StartTime before
  // 08:00, which pushed already-correctly-dated post-midnight records a full
  // day late — past the window end — silently dropping them from the axis.)
  // Returns epoch ms, or null if the record's time can't be parsed — NEVER a
  // leaking NaN. Callers guard on `=== null`; a NaN previously slipped past
  // every one of those checks (NaN <= x and NaN >= x are both false), so a
  // single unparsable record could corrupt the whole timeline's aggregate
  // stats (e.g. "NaNm running" in the legend) instead of just being dropped.
  const recordToMs = useCallback((r, field) => {
    const tStr = r[field];
    if (!tStr) return null;
    // If already a full datetime string, parse directly
    if (tStr.length > 8 || tStr.includes("T")) {
      const ms = new Date(tStr).getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    const dateStr = r.eventDate || null;
    const base = dateStr ? `${dateStr}T${tStr}` : tStr;
    const ms = new Date(base).getTime();
    return Number.isNaN(ms) ? null : ms;
  }, []);

  // Current time as epoch ms (updated every minute via nowMins)
  const nowMs = useMemo(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.getTime();
  }, [nowMins]); // eslint-disable-line

  // Window boundaries: use props when provided, else derive from data.
  // Number.isFinite (not `!== null`) so a NaN prop — e.g. new Date(badRangeStart)
  // upstream — falls back to data-derived bounds instead of silently
  // corrupting the entire axis (minMs/maxMs/nowPct/elapsedMs all NaN).
  const hasWindow = Number.isFinite(windowStartMs) && Number.isFinite(windowEndMs);
  const windowSpan = hasWindow ? windowEndMs - windowStartMs : 0;

  // Build event array in absolute ms — clamp to window when known
  const rawEvents = useMemo(() => {
    return records
      .filter((r) => r.startTime && r.endTime)
      .map((r) => {
        const s = recordToMs(r, "startTime");
        const e = recordToMs(r, "endTime");
        if (s === null || e === null) return null;
        const es = e <= s ? e + MS_PER_DAY : e; // guard for sub-ms glitches
        if (es <= s) return null;
        // Drop events entirely outside the window
        if (hasWindow && es <= windowStartMs) return null;
        if (hasWindow && s >= windowEndMs) return null;
        const cs = hasWindow ? Math.max(s, windowStartMs) : s;
        const ce = hasWindow ? Math.min(es, windowEndMs) : es;
        if (ce <= cs) return null;
        return { startMs: cs, endMs: ce, state: r.state };
      })
      .filter(Boolean);
  }, [records, recordToMs, hasWindow, windowStartMs, windowEndMs]);

  // Trim live events at "now" when viewing today and now is within the window
  const nowInWindow = hasWindow
    ? nowMs >= windowStartMs && nowMs <= windowEndMs
    : true;

  const events = useMemo(() => {
    if (!isToday || !nowInWindow) return rawEvents;
    return rawEvents
      .map((e) => ({ ...e, endMs: Math.min(e.endMs, nowMs) }))
      .filter((e) => e.endMs > e.startMs);
  }, [rawEvents, isToday, nowMs, nowInWindow]);

  // Axis min/max in epoch ms
  const AXIS_PAD_MS = 10 * MS_PER_MIN; // 10 min breathing room when no window set
  const minMs = hasWindow
    ? windowStartMs
    : Math.min(...rawEvents.map((e) => e.startMs)) - AXIS_PAD_MS;
  const maxMs = hasWindow
    ? windowEndMs
    : Math.max(
        ...rawEvents.map((e) => e.endMs),
        ...(isToday && nowInWindow ? [nowMs] : []),
      ) + AXIS_PAD_MS;
  const rangeMs = Math.max(maxMs - minMs, 1);

  // "now" cursor position
  const nowPct =
    isToday && nowInWindow && nowMs >= minMs && nowMs <= maxMs
      ? Math.min(100, Math.max(0, ((nowMs - minMs) / rangeMs) * 100))
      : null;

  const elapsedMs =
    isToday && nowInWindow ? Math.max(1, nowMs - minMs) : rangeMs;

  // Stats in minutes (derived from ms)
  const runMinsMs =
    events
      .filter((e) => e.state === "Production")
      .reduce((s, e) => s + (e.endMs - e.startMs), 0) / MS_PER_MIN;
  const downMinsMs =
    events
      .filter((e) => e.state === "Downtime" || e.state === "Idle")
      .reduce((s, e) => s + (e.endMs - e.startMs), 0) / MS_PER_MIN;
  const idleMinsMs =
    events
      .filter((e) => e.state === "Idle")
      .reduce((s, e) => s + (e.endMs - e.startMs), 0) / MS_PER_MIN;
  const runPct = Math.round((runMinsMs / (elapsedMs / MS_PER_MIN)) * 100);

  // ── Label formatter — IST-aware ────────────────────────────────────────
  // Shows date prefix (DD/MM) only when the span crosses midnight.
  const spanDays = rangeMs / MS_PER_DAY;
  const fmtMs = (ms) => {
    const d = new Date(ms);
    // Use IST offset: UTC+5:30
    const ist = new Date(d.getTime() + 5.5 * 3600_000);
    const hh = p2(ist.getUTCHours());
    const mm = p2(ist.getUTCMinutes());
    if (spanDays > 1.1) {
      // Multi-day: show "DD/MM HH:MM"
      return `${p2(ist.getUTCDate())}/${p2(ist.getUTCMonth() + 1)} ${hh}:${mm}`;
    }
    if (spanDays > 0.6) {
      // Overnight (Shift 2): show "HH:MM" but prefix date on midnight crossing
      const startDay = new Date(minMs + 5.5 * 3600_000).getUTCDate();
      const thisDay = ist.getUTCDate();
      return thisDay !== startDay ? `↓${hh}:${mm}` : `${hh}:${mm}`;
    }
    return `${hh}:${mm}`;
  };

  // Legacy fmt still used for tooltip display
  const fmt = (ms) => fmtMs(ms);

  // Stats exposed to JSX (rounded minutes for display)
  const runMins = Math.round(runMinsMs);
  const downMins = Math.round(downMinsMs);
  const idleMins = Math.round(idleMinsMs);

  // Convert changeover positions (normalised mins) → absolute ms for canvas.
  // co.endMins is the normalised minute of the new model's first record.
  // We reconstruct ms by adding the shift start date + minutes offset.
  const coMarkers = useMemo(() => {
    if (!windowStartMs) return [];
    return changeovers
      .map((co) => {
        // co.endMins: normalised minute from shift start (e.g. 1320 for 22:00 on Shift 2)
        // shiftStartMins: minute of day of shift start (e.g. 1200 for 20:00)
        const shiftStartMin = windowStartMs
          ? (() => {
              const ist = new Date(windowStartMs + 5.5 * 3600_000);
              return ist.getUTCHours() * 60 + ist.getUTCMinutes();
            })()
          : 0;
        const offsetMins = co.endMins - shiftStartMin;
        const xMs = windowStartMs + offsetMins * MS_PER_MIN;
        return {
          xMs,
          from: co.fromModel,
          to: co.toModel,
          gapMins: co.durationMins,
        };
      })
      .filter((co) => co.xMs >= minMs && co.xMs <= maxMs);
  }, [changeovers, windowStartMs, minMs, maxMs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanvasW(el.offsetWidth);
    const obs = new ResizeObserver((e) =>
      setCanvasW(e[0]?.contentRect.width || 0),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Canvas draw — all positions in epoch ms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasW || !events.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvasW * zoom;
    const H = 64;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, W, H);

    const sp = document.createElement("canvas");
    sp.width = 16;
    sp.height = 16;
    const sc = sp.getContext("2d");
    sc.fillStyle = "#f97316";
    sc.fillRect(0, 0, 16, 16);
    sc.strokeStyle = "#ef4444";
    sc.lineWidth = 7;
    sc.beginPath();
    [
      [-4, 4, 4, -4],
      [0, 16, 16, 0],
      [12, 20, 20, 12],
    ].forEach(([x1, y1, x2, y2]) => {
      sc.moveTo(x1, y1);
      sc.lineTo(x2, y2);
    });
    sc.stroke();
    const stripe = ctx.createPattern(sp, "repeat");

    const msToX = (ms) => ((ms - minMs) / rangeMs) * W;
    const PAD = 5;

    events.forEach((e) => {
      const x = msToX(e.startMs);
      const w = Math.max(1, msToX(e.endMs) - x);
      ctx.fillStyle =
        e.state === "Production"
          ? "#22c55e"
          : e.state === "Downtime"
            ? stripe
            : "#fef3c7";
      ctx.fillRect(x, PAD, w, H - PAD * 2);
      ctx.strokeStyle =
        e.state === "Production"
          ? "#16a34a"
          : e.state === "Downtime"
            ? "#dc2626"
            : "#f59e0b";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, PAD + 0.5, Math.max(1, w - 1), H - PAD * 2 - 1);
    });

    // Tick grid — interval in ms based on zoom and total span (hours)
    const spanHrs = rangeMs / 3_600_000;
    const tickMins =
      zoom >= 8
        ? 15
        : zoom >= 4
          ? 30
          : spanHrs <= 13
            ? 60
            : spanHrs <= 25
              ? 120
              : 240;
    const tickMs = tickMins * MS_PER_MIN;
    const tStart = Math.floor(minMs / tickMs) * tickMs;
    for (let t = tStart; t <= maxMs + tickMs; t += tickMs) {
      const x = msToX(t);
      if (x < 0 || x > W) continue;
      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    if (nowPct !== null && nowPct < 100) {
      const nx = (nowPct / 100) * W;
      ctx.fillStyle = "rgba(203,213,225,0.45)";
      ctx.fillRect(nx, 0, W - nx, H);
    }

    coMarkers.forEach((co) => {
      const cx = msToX(co.xMs);
      if (cx < 0 || cx > W) return;
      ctx.save();
      ctx.strokeStyle = "rgba(245,158,11,0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, H);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(cx, H);
      ctx.lineTo(cx - 5, H - 9);
      ctx.lineTo(cx + 5, H - 9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx - 5, 9);
      ctx.lineTo(cx + 5, 9);
      ctx.closePath();
      ctx.fill();
    });

    if (nowPct !== null) {
      const nx = (nowPct / 100) * W;
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, 0);
      ctx.lineTo(nx, H);
      ctx.stroke();
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(nx, PAD, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [events, coMarkers, minMs, maxMs, rangeMs, nowPct, zoom, canvasW]);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 2, 32));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 2, 1));
  const handleFit = () => {
    setZoom(1);
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };
  const scrollToNow = useCallback(() => {
    if (!scrollRef.current || nowPct === null) return;
    const el = scrollRef.current;
    el.scrollTo({
      left: Math.max(0, (nowPct / 100) * el.scrollWidth - el.clientWidth / 2),
      behavior: "smooth",
    });
  }, [nowPct]);
  useEffect(() => {
    if (zoom > 1) scrollToNow();
  }, [zoom]); // eslint-disable-line

  const handleCanvasMouseMove = useCallback(
    (e) => {
      if (dragRef.current.dragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const tMs = minMs + (mx / rect.width) * rangeMs;
      const CO_PX = 10;
      const nearCo = coMarkers.find((co) => {
        const cx = ((co.xMs - minMs) / rangeMs) * rect.width;
        return Math.abs(mx - cx) <= CO_PX;
      });
      if (nearCo) {
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          text: `CO: ${nearCo.from?.split("-")[0] || "?"} → ${nearCo.to?.split("-")[0] || "?"}  gap ${nearCo.gapMins.toFixed(1)}m`,
          co: true,
        });
        return;
      }
      const hit = events.find((ev) => tMs >= ev.startMs && tMs <= ev.endMs);
      setTooltip(
        hit
          ? {
              x: e.clientX,
              y: e.clientY,
              text: `${hit.state}: ${fmt(hit.startMs)} – ${fmt(hit.endMs)} (${Math.round((hit.endMs - hit.startMs) / MS_PER_MIN)}m)`,
            }
          : null,
      );
    },
    [events, coMarkers, minMs, rangeMs],
  );

  // Axis ticks — interval adapts to span
  const spanHrs2 = rangeMs / 3_600_000;
  const tickMins2 =
    zoom >= 8
      ? 15
      : zoom >= 4
        ? 30
        : spanHrs2 <= 13
          ? 60
          : spanHrs2 <= 25
            ? 120
            : 240;
  const tickMs2 = tickMins2 * MS_PER_MIN;
  const axTicks = [];
  const axStartMs = Math.floor(minMs / tickMs2) * tickMs2;
  for (let t = axStartMs; t <= maxMs + tickMs2; t += tickMs2) {
    const pct = ((t - minMs) / rangeMs) * 100;
    if (pct < -1 || pct > 101) continue;
    axTicks.push({ pct: Math.max(0, Math.min(100, pct)), label: fmtMs(t) });
  }

  // Render the component - no early returns, all hooks called first
  return (
    <div className="flex flex-col gap-0">
      {!rawEvents.length ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-300">
          <TimerOff className="w-8 h-8 opacity-30" strokeWidth={1.2} />
          <p className="text-xs text-slate-400">
            No timeline events to display
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                Shift Timeline
              </span>
              {shiftName && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: shiftColor || "#3b82f6" }}
                >
                  {shiftName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[
                { l: "+", fn: handleZoomIn },
                { l: "Fit", fn: handleFit },
                { l: "−", fn: handleZoomOut },
              ].map(({ l, fn }) => (
                <button
                  key={l}
                  onClick={fn}
                  className="px-2 py-0.5 text-[10px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  {l}
                </button>
              ))}
              {isToday && nowPct !== null && (
                <button
                  onClick={scrollToNow}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse shrink-0" />{" "}
                  NOW {fmtMs(nowMs)}
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />{" "}
                Production
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{
                    background:
                      "repeating-linear-gradient(-45deg,#f97316 0,#f97316 4px,#ef4444 4px,#ef4444 8px)",
                  }}
                />{" "}
                Downtime
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />{" "}
                Idle
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-amber-500 shrink-0" />
                Changeover
              </span>
              <span
                className={`font-bold ${runPct >= 80 ? "text-emerald-600" : runPct >= 60 ? "text-amber-600" : "text-rose-500"}`}
              >
                {runPct}% Running
              </span>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="overflow-x-auto rounded-lg border border-slate-200 select-none bg-white"
            style={{
              cursor: dragRef.current?.dragging
                ? "grabbing"
                : zoom > 1
                  ? "grab"
                  : "default",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <div
              style={{
                width: canvasW ? `${zoom * 100}%` : "100%",
                minWidth: "100%",
              }}
            >
              <div className="relative bg-white border-b border-slate-200 h-6">
                {axTicks.map(({ pct, label }) => (
                  <span
                    key={label}
                    className="absolute text-[10px] font-mono text-slate-500 -translate-x-1/2 bottom-0.5 whitespace-nowrap"
                    style={{ left: `${pct}%` }}
                  >
                    {label}
                  </span>
                ))}
                {nowPct !== null && (
                  <span
                    className="absolute -translate-x-1/2 bottom-0.5 text-[10px] font-bold text-blue-600 whitespace-nowrap z-10"
                    style={{ left: `${nowPct}%` }}
                  >
                    {fmtMs(nowMs)}
                  </span>
                )}
                {axTicks.map(({ pct, label }) => (
                  <span
                    key={`lm-${label}`}
                    className="absolute bottom-0 w-px bg-slate-200"
                    style={{ left: `${pct}%`, height: "5px" }}
                  />
                ))}
              </div>
              <div className="relative" style={{ height: "64px" }}>
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{ display: "block" }}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setTooltip(null)}
                />
                {nowPct !== null && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-10"
                    style={{ left: `${nowPct}%` }}
                  >
                    <div className="absolute -top-6 -translate-x-1/2 flex flex-col items-center">
                      <div className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow">
                        NOW
                      </div>
                      <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-transparent border-t-blue-600" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-1.5 text-[10px] flex-wrap">
            <span className="text-emerald-600 font-mono">
              ● {runMins}m running
            </span>
            <span className="text-slate-500 font-mono">
              ● {downMins}m downtime
              {idleMins > 0 && (
                <span className="text-amber-500 ml-1">
                  (incl. {idleMins}m idle)
                </span>
              )}
            </span>
            {coMarkers.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                ◆ {coMarkers.length} changeover{coMarkers.length > 1 ? "s" : ""}
              </span>
            )}
            {isToday && nowPct !== null && (
              <span className="flex items-center gap-1 text-blue-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />{" "}
                Live · {fmtMs(nowMs)}
              </span>
            )}
            <span className="text-slate-400">{rawEvents.length} events</span>
          </div>

          {tooltip && (
            <div
              className="fixed z-50 bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
              style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
            >
              {tooltip.text}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 ── QUICK DOWNTIME / QUALITY FORMS  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

const coMinsToHMS = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const s = Math.round((mins % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const QuickDowntimeForm = ({
  records,
  downtimeReasons,
  downtimeEntries = [],
  changeovers = [],
  eventDate,
  onSave,
  onClose,
}) => {
  const downtimeList = records.filter((r) => r.state === "Downtime");
  const activeReasons = downtimeReasons.filter((r) => r.status);
  const [activeTab, setActiveTab] = useState("log"); // "log" | "report"

  // Set of srNos that have been logged via this form (stored in Redux/DB)
  const loggedSrNos = useMemo(
    () => new Set(downtimeEntries.map((e) => String(e.srNo))),
    [downtimeEntries],
  );

  // Merge downtime events + changeover events into one unified list
  const allEvents = useMemo(() => {
    const dtEvents = downtimeList.map((r) => ({ ...r, _type: "Downtime" }));
    const coEvents = changeovers.map((co, i) => ({
      _type: "Changeover",
      srNo: `CO-${i + 1}`,
      shift: co.shift,
      startTime: co.startTime,
      endTime: co.endTime,
      duration: coMinsToHMS(co.durationMins),
      durationMins: co.durationMins,
      model: co.toModel,
      fromModel: co.fromModel,
      isOverrun: co.isOverrun,
      downtimeReason: null,
    }));
    return [...dtEvents, ...coEvents];
  }, [downtimeList, changeovers]); // eslint-disable-line

  // Unique shift names present in the combined event list
  const eventShifts = useMemo(
    () => [...new Set(allEvents.map((e) => e.shift).filter(Boolean))],
    [allEvents],
  );

  const [shiftFilter, setShiftFilter] = useState(null); // null = All Shifts
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ reasonId: "", remarks: "" });
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Keep saved events visible in the Dashboard list. They are marked as
  // logged and cannot be selected again, rather than disappearing after the
  // form resets.
  const filteredList = shiftFilter
    ? allEvents.filter((e) => e.shift === shiftFilter)
    : allEvents;

  // Changeovers don't require a reason code (they are self-explanatory)
  const canSave =
    !!selected && (selected._type === "Changeover" || !!form.reasonId);

  const handleSave = () => {
    if (!selected) {
      toast.error("Select an event from the list.");
      return;
    }
    if (selected._type !== "Changeover" && !form.reasonId) {
      toast.error("Select a downtime reason.");
      return;
    }
    const r = activeReasons.find((x) => String(x.id) === String(form.reasonId));
    onSave({
      srNo: selected.srNo,
      eventId: selected.eventId || selected.id || null,
      shift: selected.shift,
      eventDate,
      startTime: selected.startTime,
      endTime: selected.endTime,
      duration: selected.duration,
      model: selected.model,
      ...(selected._type === "Changeover"
        ? { fromModel: selected.fromModel, isChangeover: true }
        : {}),
      reasonCode: r?.dtCode || (selected._type === "Changeover" ? "CO" : null),
      reasonName:
        r?.reason || (selected._type === "Changeover" ? "Changeover" : null),
      category:
        r?.department ||
        (selected._type === "Changeover" ? "Changeover" : null),
      planned: r?.planned ?? false,
      remarks: form.remarks,
      loggedAt: new Date().toISOString(),
    });
    // Reset so user can pick next event without closing the modal
    setSelected(null);
    setForm({ reasonId: "", remarks: "" });
  };

  return (
    <>
      {/* ── Tab strip ── */}
      <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
        {[
          { key: "log", label: "Log Entry" },
          { key: "report", label: `Entry Report (${downtimeEntries.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-xs font-semibold border-b-2 transition-all ${activeTab === t.key ? "border-rose-500 text-rose-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "log" ? (
        <>
      {/* Shift filter strip — only shown when events span multiple shifts */}
      {eventShifts.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mr-1">
            Shift
          </span>
          <button
            onClick={() => setShiftFilter(null)}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${!shiftFilter ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            All
          </button>
          {eventShifts.map((s) => (
            <button
              key={s}
              onClick={() => setShiftFilter(shiftFilter === s ? null : s)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${shiftFilter === s ? "bg-rose-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Event list */}
        <div className="flex-1 overflow-auto border-r border-slate-100 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Events
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
                {downtimeList.length} DT
              </span>
              {changeovers.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {changeovers.length} CO
                </span>
              )}
            </div>
          </div>
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-300">
              <TimerOff className="w-8 h-8 opacity-30" strokeWidth={1.2} />
              <p className="text-xs text-slate-400">
                No events for selected shift
              </p>
            </div>
          ) : (
            filteredList.map((r, idx) => {
              const isCO = r._type === "Changeover";
              const isLogged = loggedSrNos.has(String(r.srNo));
              const isPending =
                !isCO && (!r.downtimeReason || r.downtimeReason === "Assign");
              const isSel =
                selected?.srNo === r.srNo && selected?._type === r._type;
              return (
                <button
                  key={idx}
                  disabled={isLogged}
                  onClick={() => {
                    setSelected(r);
                    setForm({ reasonId: "", remarks: "" });
                  }}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${isLogged ? "border-emerald-200 bg-emerald-50/60 cursor-not-allowed" : ""} ${
                    isSel
                      ? "border-rose-500 bg-rose-50 shadow-sm"
                      : isCO
                        ? r.isOverrun
                          ? "border-red-300 bg-red-50/60 hover:border-red-500"
                          : "border-amber-300 bg-amber-50/60 hover:border-amber-500"
                        : isPending
                          ? "border-amber-200 bg-amber-50/60 hover:border-amber-400"
                          : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500">
                      {isCO ? r.srNo : `Sr #${r.srNo}`} · {r.shift || "—"}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isCO
                          ? r.isOverrun
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                          : isLogged
                            ? "bg-emerald-100 text-emerald-700"
                          : isPending
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isLogged
                        ? "✓ LOGGED"
                        : isCO
                        ? r.isOverrun
                          ? "⏱ OVERRUN"
                          : "↔ CHANGEOVER"
                        : isPending
                          ? "⚠ UNASSIGNED"
                          : "✓ ASSIGNED"}
                    </span>
                  </div>
                  {isCO && (
                    <p className="text-[10px] text-slate-500 mb-1 truncate leading-snug">
                      {r.fromModel} <span className="text-slate-400">→</span>{" "}
                      {r.model}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-slate-600">
                      {r.startTime}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="font-mono text-slate-600">
                      {r.endTime}
                    </span>
                    <span
                      className={`font-bold ml-auto ${isCO ? (r.isOverrun ? "text-red-600" : "text-amber-600") : "text-rose-600"}`}
                    >
                      {r.duration}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right panel */}
        <div className="w-100 shrink-0 p-4 flex flex-col gap-3 overflow-auto">
          {selected ? (
            <>
              <div
                className={`rounded-xl border p-3 shrink-0 ${selected._type === "Changeover" ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"}`}
              >
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${selected._type === "Changeover" ? "text-amber-600" : "text-rose-500"}`}
                >
                  {selected._type === "Changeover"
                    ? "Changeover Event"
                    : "Selected Downtime"}
                </p>
                {selected._type === "Changeover" && (
                  <div className="text-[10px] text-slate-600 mb-1.5 leading-snug space-y-0.5">
                    <p>
                      <span className="font-semibold text-slate-500">
                        From:
                      </span>{" "}
                      {selected.fromModel || "—"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">To:</span>{" "}
                      {selected.model || "—"}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-700">
                    {selected.startTime}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="font-mono text-slate-700">
                    {selected.endTime}
                  </span>
                </div>
                <p
                  className={`text-sm font-bold mt-1 ${selected._type === "Changeover" ? (selected.isOverrun ? "text-red-600" : "text-amber-600") : "text-rose-600"}`}
                >
                  {selected.duration}
                </p>
                {selected._type === "Changeover" && selected.isOverrun && (
                  <p className="text-[10px] text-red-600 font-semibold mt-0.5">
                    ⏱ Changeover overrun
                  </p>
                )}
              </div>
              <div>
                <Lbl>
                  Downtime Reason
                  {selected._type !== "Changeover" && (
                    <span className="text-rose-500"> *</span>
                  )}
                  {selected._type === "Changeover" && (
                    <span className="text-slate-400"> (optional)</span>
                  )}
                </Lbl>
                <select
                  value={form.reasonId}
                  onChange={sf("reasonId")}
                  className={iC}
                >
                  <option value="">
                    {selected._type === "Changeover"
                      ? "Changeover"
                      : "Select Reason"}
                  </option>
                  {activeReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.reason}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Lbl>Remarks</Lbl>
                <textarea
                  value={form.remarks}
                  onChange={sf("remarks")}
                  className={`${iC} resize-none h-20`}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 border-2 border-dashed border-slate-200 rounded-xl text-center p-4">
              <TimerOff className="w-7 h-7 text-slate-300" strokeWidth={1.2} />
              <p className="text-xs text-slate-400">
                Select a downtime or changeover event to log
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0">
        <p className="text-[11px] text-slate-400">
          {selected
            ? `${selected._type === "Changeover" ? "Changeover" : "Downtime"} · ${selected.srNo} · ${selected.shift || "—"}`
            : "No event selected"}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors ${!canSave ? "bg-rose-300 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700"}`}
          >
            <Plus className="w-4 h-4" /> Log Entry
          </button>
        </div>
      </div>
        </>
      ) : (
        /* ── Entry Report tab ── */
        <div className="flex-1 overflow-auto">
          {downtimeEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300 py-16">
              <TimerOff className="w-10 h-10 opacity-30" strokeWidth={1.2} />
              <p className="text-sm text-slate-400">
                No downtime entries logged yet for this date.
              </p>
            </div>
          ) : (
            <table className="min-w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  {[
                    "#",
                    "Shift",
                    "Type",
                    "Model",
                    "Start",
                    "End",
                    "Duration",
                    "Reason",
                    "Category",
                    "Remarks",
                    "Logged At",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {downtimeEntries.map((e, i) => {
                  const isCO = e.isChangeover || e.IsChangeover;
                  const reason = e.reasonName || e.ReasonName;
                  return (
                    <tr key={i} className="hover:bg-rose-50/30 transition-colors">
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-500">
                        {e.shift || e.ShiftName || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        {isCO ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                            Changeover
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                            Downtime
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-[10px] text-slate-500 max-w-[160px] truncate">
                        {isCO
                          ? `${e.fromModel || e.FromModel || "—"} → ${e.model || e.Model || "—"}`
                          : e.model || e.Model || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                        {e.startTime || e.StartTime || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                        {e.endTime || e.EndTime || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-rose-500 whitespace-nowrap">
                        {e.duration || e.Duration || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        {reason ? (
                          <span className="text-emerald-700 font-semibold">{reason}</span>
                        ) : (
                          <span className="text-amber-500 text-[10px] font-bold">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500">
                        {e.category || e.Category || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 max-w-[120px] truncate">
                        {e.remarks || e.Remarks || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {String(e.loggedAt || e.LoggedAt || "")
                          .substring(0, 16)
                          .replace("T", " ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
};

const QuickQualityForm = ({
  records,
  qualityDefects,
  qualityEntries = [],
  materials,
  onSave,
  onClose,
}) => {
  const activeDefects = qualityDefects.filter((q) => q.status);
  const [activeTab, setActiveTab] = useState("log"); // "log" | "report"

  const loggedModels = useMemo(
    () => new Set(qualityEntries.map((e) => String(e.model || e.Model))),
    [qualityEntries],
  );

  const allModelGroups = useMemo(() => {
    const map = {};
    records
      .filter((r) => r.state === "Production")
      .forEach((r) => {
        const sap = r.sapCode || extractSapCode(r.model);
        const mat = getMaterialByModel(materials, r.model);
        const key = mat?.partName || r.model || sap;
        if (!key) return;
        if (!map[key])
          map[key] = {
            model: r.model,
            sapCode: sap,
            mat,
            rawQty: 0,
            events: 0,
            shift: r.shift,
          };
        map[key].rawQty += r.qty ?? 0;
        map[key].events += 1;
      });
    return Object.values(map)
      .map((g) => ({
        ...g,
        componentQty: Math.round(componentQtyFromMaster(g.rawQty, g.mat)),
      }))
      .sort((a, b) => b.componentQty - a.componentQty);
  }, [records, materials]);

  const modelGroups = allModelGroups.filter(
    (g) => !loggedModels.has(String(g.model)),
  );

  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    inspectedQty: "1",
    defectId: "",
    rejectedQty: "0",
    disposition: "Rework",
    remarks: "",
  });
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!selected) {
      toast.error("Select a model.");
      return;
    }
    if (!form.defectId) {
      toast.error("Select a defect code.");
      return;
    }
    const q = activeDefects.find((x) => String(x.id) === String(form.defectId));
    onSave({
      ...form,
      model: selected.model,
      partName: selected.mat?.partName,
      sapCode: selected.mat?.sapCode,
      shift: selected.shift,
      defectCode: q?.qCode,
      defectName: q?.defectName,
      severity: q?.severity,
      loggedAt: new Date().toISOString(),
    });
    setSelected(null);
    setForm({
      inspectedQty: "1",
      defectId: "",
      rejectedQty: "0",
      disposition: "Rework",
      remarks: "",
    });
  };

  const DISP_COLORS = {
    Rejection: "text-rose-600 bg-rose-50 border-rose-200",
    Rework: "text-blue-600 bg-blue-50 border-blue-200",
    Hold: "text-amber-600 bg-amber-50 border-amber-200",
    Accept: "text-emerald-600 bg-emerald-50 border-emerald-200",
  };

  return (
    <>
      {/* ── Tab strip ── */}
      <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
        {[
          { key: "log", label: "Log Entry" },
          { key: "report", label: `Entry Report (${qualityEntries.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-xs font-semibold border-b-2 transition-all ${activeTab === t.key ? "border-violet-500 text-violet-600 bg-white" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "log" ? (
        <>
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Model list */}
            <div className="flex-1 overflow-auto border-r border-slate-100 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Running Models
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">
                  {modelGroups.length} models
                </span>
              </div>
              {modelGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-slate-300">
                  <ShieldCheck
                    className="w-8 h-8 opacity-30"
                    strokeWidth={1.2}
                  />
                  <p className="text-xs text-slate-400">
                    No production records found
                  </p>
                </div>
              ) : (
                modelGroups.map((g, idx) => {
                  const isSelected = selected?.model === g.model;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelected(g);
                        setForm((f) => ({
                          ...f,
                          inspectedQty: String(g.componentQty),
                        }));
                      }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${isSelected ? "border-violet-500 bg-violet-50 shadow-sm" : "border-slate-200 bg-white hover:border-violet-200"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {g.mat ? (
                            <>
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {g.mat.partName}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 truncate">
                                {g.model}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-mono text-slate-700 truncate">
                                {g.model}
                              </p>
                              <p className="text-[10px] text-rose-400 italic">
                                Not in Material Config
                              </p>
                            </>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold font-mono text-blue-600 leading-none">
                            {g.componentQty}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {g.events} events
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Form */}
            <div className="w-64 shrink-0 p-4 flex flex-col gap-3 overflow-auto">
              {selected ? (
                <>
                  <div className="bg-violet-50 rounded-xl border border-violet-200 p-3 shrink-0">
                    <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-1">
                      Selected Model
                    </p>
                    <p className="text-xs font-bold text-slate-800">
                      {selected.mat?.partName || selected.model}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Lbl>Inspected Qty</Lbl>
                      <input
                        type="number"
                        value={form.inspectedQty}
                        onChange={sf("inspectedQty")}
                        className={iC}
                        min={1}
                      />
                    </div>
                    <div>
                      <Lbl>Rejected Qty</Lbl>
                      <input
                        type="number"
                        value={form.rejectedQty}
                        onChange={sf("rejectedQty")}
                        className={iC}
                        min={0}
                      />
                    </div>
                  </div>
                  <div>
                    <Lbl>
                      Defect Code <span className="text-rose-500">*</span>
                    </Lbl>
                    <select
                      value={form.defectId}
                      onChange={sf("defectId")}
                      className={iC}
                    >
                      <option value="">Select Defect</option>
                      {activeDefects.map((q) => (
                        <option key={q.id} value={q.id}>
                          [{q.qCode}] {q.defectName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Lbl>Disposition</Lbl>
                    <select
                      value={form.disposition}
                      onChange={sf("disposition")}
                      className={iC}
                    >
                      {["Rework", "Rejection", "Hold", "Accept"].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Lbl>Remarks</Lbl>
                    <textarea
                      value={form.remarks}
                      onChange={sf("remarks")}
                      className={`${iC} resize-none h-20`}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 border-2 border-dashed border-slate-200 rounded-xl text-center p-4">
                  <ShieldCheck
                    className="w-7 h-7 text-slate-300"
                    strokeWidth={1.2}
                  />
                  <p className="text-xs text-slate-400">
                    Select a model to log a quality entry
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0">
            <p className="text-[11px] text-slate-400">
              {selected
                ? `Model: ${selected.mat?.partName || selected.model}`
                : "No model selected"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selected || !form.defectId}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors ${!selected || !form.defectId ? "bg-violet-300 cursor-not-allowed" : "bg-violet-600 hover:bg-violet-700"}`}
              >
                <Plus className="w-4 h-4" /> Log Quality
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ── Entry Report tab ── */
        <div className="flex-1 overflow-auto">
          {qualityEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300 py-16">
              <ShieldCheck className="w-10 h-10 opacity-30" strokeWidth={1.2} />
              <p className="text-sm text-slate-400">
                No quality entries logged yet for this date.
              </p>
            </div>
          ) : (
            <table className="min-w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  {[
                    "#",
                    "Shift",
                    "Part Name",
                    "SAP",
                    "Inspected",
                    "Rejected",
                    "Defect",
                    "Disposition",
                    "Remarks",
                    "Logged At",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualityEntries.map((e, i) => {
                  const rej = parseInt(e.rejectedQty ?? e.RejectedQty ?? 0, 10);
                  const disp = e.disposition || e.Disposition || "—";
                  const dispCls =
                    DISP_COLORS[disp] ||
                    "text-slate-500 bg-slate-50 border-slate-200";
                  return (
                    <tr
                      key={i}
                      className="hover:bg-violet-50/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 whitespace-nowrap text-slate-500">
                        {e.shift || e.ShiftName || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-700 max-w-[160px] truncate">
                        {e.partName || e.PartName || e.model || e.Model || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-[10px] text-slate-400">
                        {e.sapCode || e.SapCode || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-blue-600 text-center">
                        {e.inspectedQty ?? e.InspectedQty ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-center"
                        style={{ color: rej > 0 ? "#ef4444" : "#22c55e" }}
                      >
                        {rej}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 mr-1">
                          {e.defectCode || e.DefectCode || "—"}
                        </span>
                        <span className="text-slate-500">
                          {e.defectName || e.DefectName || ""}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dispCls}`}
                        >
                          {disp}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 max-w-[120px] truncate">
                        {e.remarks || e.Remarks || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {String(e.loggedAt || e.LoggedAt || "")
                          .substring(0, 16)
                          .replace("T", " ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 ── OEE TIME-SERIES  (graph buckets)
// ─────────────────────────────────────────────────────────────────────────────
// FIX #4 #5 #6 ── uses timeStrToMins (no shadowing) + normalize() for overnight
// FIX #6 ── bucket comparison uses normalised minutes throughout

const buildOeeTimeSeries = (
  srcRecords,
  shiftStartMins,
  shiftEndMins,
  idealCycleSecs,
  shifts = [],
  isToday = false,
  nowMins = null,
  overrideQ = null,
) => {
  if (!srcRecords.length) return { labels: [], oee: [], a: [], p: [], q: [] };

  // FIX #13 — when no ideal cycle time is configured for the dominant model,
  // computeOEE() reports P:100 (pUnverified) and OEE == A * Q / 100. The graph
  // must follow the same convention, otherwise the P/OEE lines collapse toward
  // 0 (using an arbitrary assumed cycle time) while the KPI badge shows P:100%/OEE≈A%.
  const pUnverified = !idealCycleSecs;

  // Earliest configured shift start = the production-day boundary. Used both
  // to normalise "All Shifts" overnight records (anything before this belongs
  // to the next calendar day) and as the axis start for the 24h bucket range.
  const earliestShiftStart =
    shifts.length > 0
      ? Math.min(
          ...shifts.map((s) => {
            const [h, m] = s.startTime.split(":").map(Number);
            return h * 60 + m;
          }),
        )
      : 480; // Default to 08:00

  // When no explicit shift bounds are given (All Shifts view), normalise
  // against the day-start boundary so overnight records get +1440 and the
  // graph plots to end of data rather than cutting off at 23:xx. (Previously
  // relied on detecting a quiet "gap" around midnight, which silently failed
  // — and dropped post-midnight data entirely — whenever production ran
  // continuously through midnight with no detectable gap.)
  const autoNormalize = (m) => (m !== null && m < earliestShiftStart ? m + 1440 : m);

  const hasShiftBounds = shiftStartMins !== null && shiftEndMins !== null;
  const normalize = hasShiftBounds
    ? makeNormalizer(shiftStartMins, shiftEndMins)
    : autoNormalize;

  // Normalise start-times once
  const withNorm = srcRecords
    .filter((r) => r.startTime)
    .map((r) => ({ ...r, _normStart: normalize(timeStrToMins(r.startTime)) }))
    .filter((r) => r._normStart !== null);

  if (!withNorm.length) return { labels: [], oee: [], a: [], p: [], q: [] };

  // Also normalise end-times so the last bucket reaches actual end of data
  const withNormEnd = withNorm.map((r) => ({
    ...r,
    _normEnd: r.endTime ? normalize(timeStrToMins(r.endTime)) : r._normStart,
  }));

  // ── Axis boundaries ──────────────────────────────────────────────────────
  // When a specific shift is selected, pin the axis to the exact shift window
  // (shiftStartMins → shiftStartMins + shiftDuration) so the graph always shows
  // the full shift even when data ends early (e.g. machine stopped at 01:00 but
  // Shift 2 runs to 08:00 = normalised 1920).
  // For "All Shifts", use the full 24-hour range from earliest shift start to latest shift end.
  const normTimes = withNorm.map((r) => r._normStart);
  const normEndTimes = withNormEnd.map((r) => r._normEnd).filter(Boolean);

  let startBucket, endBucket;
  if (hasShiftBounds) {
    // Shift duration (handles overnight: sem <= ssm → add 1440)
    const shiftDurMins =
      shiftEndMins <= shiftStartMins
        ? shiftEndMins + 1440 - shiftStartMins
        : shiftEndMins - shiftStartMins;
    startBucket = shiftStartMins;
    endBucket = shiftStartMins + shiftDurMins; // e.g. 1200 + 720 = 1920 for Shift 2
  } else {
    // For "All Shifts", use the full 24-hour day (08:00 to 08:00 next day = 1440 minutes)
    // starting from the earliest configured shift start (typically 08:00 = 480 mins).
    startBucket = earliestShiftStart;
    endBucket = startBucket + 1440; // Full 24-hour range
  }

  // FIX #14 — for today's data, don't project the cumulative A/P/OEE curves
  // beyond "now". Past this point the elapsed-time denominator keeps growing
  // while no further down/production records exist, which makes Availability
  // asymptotically climb toward 100% as if the rest of the shift already ran
  // cleanly. Clip the axis to "now" (still allowing a single point if the
  // shift hasn't started yet, and leaving the axis untouched once the shift
  // has actually finished).
  if (isToday && nowMins !== null) {
    const nowNorm = normalize(nowMins);
    endBucket = Math.min(endBucket, Math.max(startBucket, nowNorm));
  }

  const labels = [],
    oeeA = [],
    aA = [],
    pA = [],
    qA = [];

  const WINDOW = 30; // minutes per bucket

  // Pre-compute normalised end times for downtime overlap clipping
  const withNormEndAll = withNorm.map((r) => {
    const durMins = parseDurSecs(r.duration) / 60;
    const rawEnd  = r.endTime ? normalize(timeStrToMins(r.endTime)) : null;
    return { ...r, _normEnd: rawEnd ?? (r._normStart + durMins) };
  });

  for (let t = startBucket + WINDOW; t <= endBucket; t += WINDOW) {
    const wStart = t - WINDOW;
    const wEnd   = t;
    labels.push(`${p2(Math.floor((wStart % 1440) / 60))}:${p2(wStart % 60)}`);

    // Records whose start falls in this window (for production counts)
    const inWindow = withNorm.filter(
      (r) => r._normStart >= wStart && r._normStart < wEnd,
    );

    // Any records started at all by this window (for downtime overlap calc)
    const anyStarted = withNormEndAll.filter((r) => r._normStart < wEnd);

    if (!anyStarted.length) {
      oeeA.push(0);
      aA.push(0);
      pA.push(pUnverified ? 100 : 0);
      qA.push(overrideQ ?? 100);
      continue;
    }

    const windowSecs = WINDOW * 60;

    // Downtime clipped to this window: only count seconds that overlap [wStart, wEnd]
    const dtSecs = anyStarted
      .filter((r) => r.state === "Downtime")
      .reduce((sum, r) => {
        const overlapMins =
          Math.max(0, Math.min(wEnd, r._normEnd) - Math.max(wStart, r._normStart));
        return sum + overlapMins * 60;
      }, 0);

    const effectiveDTSecs = Math.min(dtSecs, windowSecs);
    const A = Math.max(
      0,
      Math.min(100, ((windowSecs - effectiveDTSecs) / windowSecs) * 100),
    );

    const prod = inWindow.filter((r) => r.state === "Production");
    const qty  = prod.reduce((s, r) => s + (r.qty ?? 0), 0);
    const good = prod
      .filter((r) => r.quality === "GOOD")
      .reduce((s, r) => s + (r.qty ?? 0), 0);

    const runS = Math.max(0, windowSecs - effectiveDTSecs);
    const P = pUnverified
      ? 100
      : runS > 0
        ? Math.min(100, ((qty * idealCycleSecs) / runS) * 100)
        : 0;

    // Q: quality log pass rate when available, else machine GOOD/BAD for this window
    const hasQ = prod.some((r) => r.quality != null && r.quality !== "");
    const machineQ = hasQ && qty > 0 ? Math.min(100, (good / qty) * 100) : 100;
    const Q = overrideQ !== null ? overrideQ : machineQ;
    const oeeV = (A / 100) * (P / 100) * (Q / 100) * 100;

    oeeA.push(Math.round(oeeV * 10) / 10);
    aA.push(Math.round(A * 10) / 10);
    pA.push(Math.round(P * 10) / 10);
    qA.push(Math.round(Q * 10) / 10);
  }

  return { labels, oee: oeeA, a: aA, p: pA, q: qA };
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 ── MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const PartProcessDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const downtimeReasons = useSelector(selectDowntimeReasons);
  const qualityDefects = useSelector(selectQualityDefects);
  const downtimeEntries = useSelector(selectDowntimeEntries);
  const qualityEntries = useSelector(selectQualityEntries);
  const qualityPassword = useSelector(selectQualityPassword);
  const plans = useSelector(selectPlans);

  const [downtimeModal, setDowntimeModal] = useState(false);
  const [qualityModal, setQualityModal] = useState(false);
  const [pwdGate, setPwdGate] = useState(false);
  const [pwdInput, setPwdInput] = useState("");
  const [pwdError, setPwdError] = useState(false);
  const [dbDTLogs, setDbDTLogs] = useState([]);
  const [dbQLogs, setDbQLogs] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    time,
    materials,
    shifts,
    records,
    loading,
    loadProgress,
    rangeMode,
    rangeStart,
    rangeEnd,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    showCustom,
    setShowCustom,
    selectedDate,
    isToday,
    handleToday,
    handleYesterday,
    handleCustomApply,
    selectedShift,
    setSelectedShift,
    loadToday,
    shiftRecords,
    changeoverRecords,
    changeovers,
    coStats,
    shiftOEE,
    activeOEEData,
    activeOEE,
    activeA,
    activeP,
    activeQ,
    activePUnverified,
    activeQUnverified,
    displayQty,
    displayComponentQty,
    displayComponentGood,
    displayComponentBad,
    passR,
    dMins,
    activeAvgCycleSecs,
    curModel,
    curMat,
    curComponentCT,
    isRunning,
    shiftProgress,
  } = usePartProcessOEE();

  // ── Match the configured Machine for the header banner ──────────────────
  // records[0] is the most recent record (Production or Downtime); both carry
  // assetName/lineName from PartProcessEvents, so this works even when the
  // machine is currently idle/down.
  const machines = useSelector(selectMachines);
  const currentMachine = useMemo(() => {
    if (!machines.length) return null;
    const latest = records[0];
    if (!latest) return machines.find((m) => m.status) || null;
    const norm = (s) => (s || "").trim().toLowerCase();
    const byAsset = norm(latest.assetName);
    const byLine  = norm(latest.lineName);
    return (
      machines.find((m) => byAsset && norm(m.machineName) === byAsset) ||
      machines.find((m) => byLine && norm(m.lineName) === byLine) ||
      null
    );
  }, [machines, records]);

  // ── Fetch logs from DB whenever date changes ─────────────────────────────
  useEffect(() => {
    if (!selectedDate) return;
    const fetch = async () => {
      try {
        const [dtRes, qRes] = await Promise.all([
          axios.get(`${PART_PROCESS_API}/downtime-log`, { withCredentials: true }),
          axios.get(
            `${PART_PROCESS_API}/quality-log?startDate=${selectedDate}&endDate=${selectedDate}`,
            { withCredentials: true },
          ),
        ]);
        // The database is the source of truth for logged entries. Do not
        // discard rows by the currently loaded event/date range; doing so made
        // saved entries disappear whenever the Dashboard was refreshed.
        setDbDTLogs(dtRes.data?.data ?? []);
        setDbQLogs(qRes.data?.data ?? []);
      } catch (err) {
        if (err.response?.status !== 401)
          console.error("[Dashboard] fetch logs:", err.message);
      }
    };
    fetch();
  }, [selectedDate]);

  useEffect(() => {
    const onFull = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("fullscreen toggle failed", err);
    }
  };

  // Merge Redux + DB entries (DB wins on eventId match; Redux wins for brand-new entries not yet in DB)
  const mergedDTEntries = useMemo(() => {
    const map = {};
    dbDTLogs.forEach((e) => {
      const key = e.EventId ?? e.eventId ?? `st_${e.StartTime ?? e.startTime}`;
      map[String(key)] = {
        ...e,
        eventId: e.EventId ?? e.eventId,
        srNo: e.SrNo ?? e.srNo,
        reasonName: e.ReasonName ?? e.reasonName,
        category: e.Category ?? e.category,
        startTime: e.StartTime ?? e.startTime,
      };
    });
    downtimeEntries.forEach((e) => {
      const key = e.eventId ?? `st_${e.startTime}`;
      if (!map[String(key)]) map[String(key)] = e;
    });
    return Object.values(map);
  }, [dbDTLogs, downtimeEntries]);

  const mergedQEntries = useMemo(() => {
    const seen = new Set();
    const out = [];
    [...dbQLogs, ...qualityEntries].forEach((e) => {
      const key =
        e.Id ??
        e.id ??
        `${e.Model ?? e.model}_${e.DefectCode ?? e.defectCode}_${e.LoggedAt ?? e.loggedAt}`;
      if (!seen.has(String(key))) {
        seen.add(String(key));
        out.push(e);
      }
    });
    return out;
  }, [dbQLogs, qualityEntries]);

  // Persisted logs are fetched without a server filter so a saved entry never
  // disappears after refresh. Scope them here, alongside the event records,
  // before they feed any dashboard card or graph.
  const scopedLogEntries = useMemo(() => {
    const normaliseShift = (value) => String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    const selectedShiftName = normaliseShift(selectedShift?.shiftName);
    const eventIdsInRange = new Set(
      records.map((r) => String(r.eventId ?? r.id)).filter(Boolean),
    );

    const belongsToActiveScope = (entry) => {
      const rawEventDate = entry.eventDate ?? entry.EventDate ?? "";
      let eventDate = "";
      if (rawEventDate) {
        try {
          eventDate = new Date(String(rawEventDate)).toISOString().slice(0, 10);
        } catch {
          eventDate = String(rawEventDate).slice(0, 10);
        }
      }
      const eventId = entry.eventId ?? entry.EventId;
      // Older saved rows may not have EventDate. Keep them only when their
      // linked production event is in the currently loaded range.
      if (eventDate ? eventDate !== selectedDate : !eventIdsInRange.has(String(eventId))) {
        return false;
      }
      if (!selectedShiftName) return true;
      const entryShift = normaliseShift(entry.shift ?? entry.ShiftName);
      return !entryShift || entryShift === selectedShiftName;
    };

    return {
      downtime: mergedDTEntries.filter(belongsToActiveScope),
      quality: mergedQEntries.filter(belongsToActiveScope),
    };
  }, [mergedDTEntries, mergedQEntries, records, selectedDate, selectedShift]);

  const scopedDTEntries = scopedLogEntries.downtime;
  const scopedQEntries = scopedLogEntries.quality;

  // ── OEE time-series graph ───────────────────────────────────────────────
  // Minute-resolution "now" — recomputing the chart on every second tick of
  // useClock() would be wasteful since the graph buckets are 30 minutes wide.
  const nowMins = time.getHours() * 60 + time.getMinutes();

  // FIX #4 #5 #6 — uses buildOeeTimeSeries with normalisation
  const oeeTimeSeries = useMemo(() => {
    // For "All Shifts": use `records` directly. It's already bounded to the
    // exact [rangeStart, rangeEnd] window by usePartProcessOEE's loadForRange,
    // which for a 24h window (e.g. 08:00 D -> 08:00 D+1) legitimately spans
    // two calendar EventDates. A previous version filtered down to only
    // `r.eventDate === selectedDate`, which dropped every record tagged with
    // the next day's EventDate — including the real post-midnight portion of
    // this same production window (e.g. an overnight Shift 2's 00:00-08:00
    // tail) — making the "All Shifts" OEE trend chart flatline after
    // midnight even though the data existed (confirmed via Shift 2's own
    // graph and the Shift Timeline widget both showing it correctly).
    // For a specific shift: use shiftRecords (already time-filtered to that shift).
    const src = selectedShift ? shiftRecords : records;

    // Find ideal cycle time for the graph's P curve
    const domModel = src
      .filter((r) => r.state === "Production" && r.model)
      .reduce((acc, r) => {
        acc[r.model] = (acc[r.model] || 0) + (r.qty ?? 0);
        return acc;
      }, {});
    const topModel = Object.entries(domModel).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    const mat = topModel ? getMaterialByModel(materials, topModel) : null;
    const idealCT =
      mat?.definedComponentCycleTime > 0 ? mat.definedComponentCycleTime : null;

    // Use shift boundaries for normalisation.
    // For "All Shifts" pass null so buildOeeTimeSeries auto-detects overnight.
    const ssm = selectedShift ? sliceToMins(selectedShift.startTime) : null;
    const sem = selectedShift ? sliceToMins(selectedShift.endTime) : null;

    // Use quality log pass rate (if any entries exist) to override Q in the graph
    let qOverride = null;
    if (scopedQEntries.length > 0) {
      let insp = 0,
        rej = 0;
      const byKey = {};
      scopedQEntries.forEach((e) => {
        const key = e.partName || e.PartName || e.model || e.Model || "_";
        if (!byKey[key]) byKey[key] = { insp: 0, rej: 0 };
        byKey[key].insp = Math.max(
          byKey[key].insp,
          parseInt(e.inspectedQty ?? e.InspectedQty ?? 0, 10),
        );
        byKey[key].rej += parseInt(e.rejectedQty ?? e.RejectedQty ?? 0, 10);
      });
      Object.values(byKey).forEach((v) => {
        insp += v.insp;
        rej += v.rej;
      });
      if (insp > 0)
        qOverride = Math.round((Math.max(0, insp - rej) / insp) * 100);
    }

    return buildOeeTimeSeries(
      src,
      ssm,
      sem,
      idealCT,
      shifts,
      isToday,
      nowMins,
      qOverride,
    );
  }, [
    shiftRecords,
    records,
    selectedShift,
    materials,
    shifts,
    isToday,
    nowMins,
    scopedQEntries,
  ]);

  // ── Department loss ──────────────────────────────────────────────────────
  const deptLoss = useMemo(() => {
    // Build fast eventId → logged entry map
    // Build reason name → department from config (fallback for old entries without category saved)
    const rNameToDept = {};
    downtimeReasons.forEach((r) => {
      if (r.reason && r.department) rNameToDept[r.reason] = r.department;
    });

    const map = {};
    scopedDTEntries.forEach((r) => {
      const dept =
        r.category ||
        r.Category ||
        rNameToDept[r.reasonName || r.ReasonName] ||
        "Unassigned";
      map[dept] = (map[dept] || 0) + parseDurSecs(r.duration || r.Duration);
    });

    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [
    scopedDTEntries,
    downtimeReasons,
  ]);

  const DEPT_COLORS = [
    "#6366f1",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#8b5cf6",
    "#0ea5e9",
    "#f43f5e",
    "#14b8a6",
  ];
  const deptTotalSecs = deptLoss.reduce((s, [, v]) => s + v, 0);

  // ── Quality log aggregates ────────────────────────────────────────────────
  // qualityByModel keyed by partName (primary) or model string (fallback)
  const qualityByModel = useMemo(() => {
    const map = {};
    scopedQEntries.forEach((e) => {
      const key = e.partName || e.PartName || e.model || e.Model || "";
      if (!key) return;
      if (!map[key]) map[key] = { inspected: 0, rejected: 0 };
      // Multiple entries for the same model = different defect codes on the same batch.
      // Inspected is the batch size (take MAX so it isn't double-counted),
      // Rejected is cumulative across all defect types (SUM).
      const insp = parseInt(e.inspectedQty ?? e.InspectedQty ?? 0, 10);
      const rej = parseInt(e.rejectedQty ?? e.RejectedQty ?? 0, 10);
      map[key].inspected = Math.max(map[key].inspected, insp);
      map[key].rejected += rej;
    });
    return map;
  }, [scopedQEntries]);

  const qualityTotals = useMemo(() => {
    let inspected = 0,
      rejected = 0;
    Object.values(qualityByModel).forEach((v) => {
      inspected += v.inspected;
      rejected += v.rejected;
    });
    const accepted = Math.max(0, displayComponentQty - rejected);
    const passRate =
      displayComponentQty > 0 ? Math.round((accepted / displayComponentQty) * 100) : null;
    return { inspected, rejected, accepted, passRate, hasData: inspected > 0 };
  }, [qualityByModel, displayComponentQty]);

  // ── Model breakdown chart ───────────────────────────────────────────────
  const CHART_COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#22c55e",
    "#f59e0b",
    "#06b6d4",
    "#e879f9",
    "#fb923c",
  ];

  const activeModelMap = useMemo(() => {
    const src = selectedShift
      ? shiftRecords
      : records.filter((r) => r.eventDate === selectedDate);
    const map = {};
    src
      .filter((r) => r.state === "Production")
      .forEach((r) => {
        const mat = getMaterialByModel(materials, r.model);
        const sap = r.sapCode || extractSapCode(r.model);
        const key = mat?.partName || r.model || sap || "Unknown";
        map[key] = (map[key] || 0) + componentQtyFromMaster(r.qty ?? 0, mat);
      });
    return map;
  }, [shiftRecords, records, selectedShift, selectedDate, materials]);

  const modelLabels = Object.keys(activeModelMap);
  const modelValues = Object.values(activeModelMap);

  // Planning Config target qty per model for selectedDate — keyed the same way
  // activeModelMap keys its rows (Material's partName when matched via SAP code,
  // else falls back to the raw SAP code), so it can merge cleanly with produced
  // models. Component-qty units, matching "Produced", so they're comparable.
  const plannedModelMap = useMemo(() => {
    const map = {};
    plans.forEach((p) => {
      if (p.planDate !== selectedDate) return;
      if (p.status === false || p.status === 0) return;
      const mat = materials.find((m) => m.sapCode === p.sapCode);
      const key = mat?.partName || p.partName || p.sapCode;
      if (!key) return;
      map[key] = (map[key] || 0) + (Number(p.targetQty) || 0);
    });
    return map;
  }, [plans, selectedDate, materials]);

  // Model Breakdown shows the union of "actually produced today" and "planned
  // for today" — a freshly-uploaded plan with zero production yet should still
  // show its Target, not wait until the model starts running.
  const modelBreakdownLabels = useMemo(() => {
    const planOnly = Object.keys(plannedModelMap).filter((k) => !(k in activeModelMap));
    return [...modelLabels, ...planOnly];
  }, [modelLabels, plannedModelMap, activeModelMap]);

  const wrapLabel = (name) => {
    const words = String(name).split(" ");
    if (words.length <= 3) return name;
    const lines = [];
    for (let i = 0; i < words.length; i += 3)
      lines.push(words.slice(i, i + 3).join(" "));
    return lines;
  };

  const modelChartData = useMemo(
    () => ({
      labels: modelLabels.map(wrapLabel),
      datasets: [
        {
          data: modelValues,
          backgroundColor: CHART_COLORS.slice(0, modelLabels.length),
          borderWidth: 0,
          borderRadius: 5,
        },
      ],
    }),
    [modelLabels.join(), modelValues.join()],
  ); // eslint-disable-line

  const modelChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#1e293b",
          bodyColor: "#475569",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          callbacks: {
            title: (items) => modelLabels[items[0]?.dataIndex] ?? "",
            label: (ctx) => `  Components: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10, weight: "500" },
            color: "#374151",
            maxRotation: 0,
            autoSkip: false,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.06)" },
          title: {
            display: true,
            text: "Components Produced",
            font: { size: 10 },
            color: "#94a3b8",
          },
          ticks: { font: { size: 10 }, color: "#94a3b8", stepSize: 1 },
        },
      },
    }),
    [],
  ); // eslint-disable-line

  // ── OEE line chart data ─────────────────────────────────────────────────
  const oeeLineData = useMemo(
    () => ({
      labels: oeeTimeSeries.labels,
      datasets: [
        {
          label: "OEE",
          data: oeeTimeSeries.oee,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.10)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          order: 4,
        },
        {
          label: "Availability",
          data: oeeTimeSeries.a,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.06)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          order: 1,
        },
        {
          label: "Performance",
          data: oeeTimeSeries.p,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245,158,11,0.06)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          order: 2,
        },
        {
          label: "Quality",
          data: oeeTimeSeries.q,
          borderColor: "#a78bfa",
          backgroundColor: "rgba(167,139,250,0.06)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          order: 3,
        },
      ],
    }),
    [oeeTimeSeries],
  );

  const oeeLineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "center",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 11 },
            padding: 20,
            color: "#475569",
          },
        },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#374151",
          bodyColor: "#374151",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(148,163,184,0.1)" },
          ticks: { font: { size: 10 }, color: "#94a3b8", maxTicksLimit: 14 },
        },
        y: {
          beginAtZero: true,
          max: 110,
          grid: { color: "rgba(148,163,184,0.08)" },
          ticks: {
            font: { size: 10 },
            color: "#94a3b8",
            stepSize: 20,
            callback: (v) => v + "%",
          },
        },
      },
    }),
    [],
  );

  const OEE_ITEMS = [
    { label: "OEE", value: activeOEE, desc: "Overall Effectiveness" },
    { label: "A", value: activeA, desc: "Availability" },
    { label: "P", value: activeP, desc: "Performance" },
    { label: "Q", value: activeQ, desc: "Quality" },
  ];

  // ── Timeline records ────────────────────────────────────────────────────
  // FIX #8 — pass the same record set used for changeovers (shiftRecords for specific shift, all records for All Shifts)
  const timelineRecords = useMemo(
    () =>
      changeoverRecords.map((r) => ({
        ...r,
        state: r.effectiveState || r.state,
      })),
    [changeoverRecords],
  );

  // Shift breakdown per-shift for the Running Summary section
  const totalProdRecords = (selectedShift ? shiftRecords : records).filter(
    (r) => r.state === "Production",
  ).length;

  return (
    <>
      <div className="part-process-dashboard h-full flex flex-col bg-slate-100 overflow-hidden">
        {/* ── STICKY HEADER ── */}
          <div className={`sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0 ${isFullscreen ? "hidden" : ""}`}>
          {loading && loadProgress.total > 0 && (
            <div className="bg-blue-600 shrink-0">
              <div className="flex items-center justify-between px-5 py-1 text-[11px] text-white/80">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading…&nbsp;
                  <span className="font-bold text-white font-mono">
                    {loadProgress.loaded.toLocaleString()}
                  </span>
                  <span className="opacity-60">of</span>
                  <span className="font-bold text-white font-mono">
                    {loadProgress.total.toLocaleString()}
                  </span>
                </span>
                <span className="font-bold text-white font-mono">
                  {loadProgress.total > 0
                    ? Math.round(
                        (loadProgress.loaded / loadProgress.total) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="h-0.5 bg-blue-500">
                <div
                  className="h-full bg-white/70 transition-all duration-300"
                  style={{
                    width: `${loadProgress.total > 0 ? (loadProgress.loaded / loadProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">
            <button
              onClick={() => navigate("/part-process/overview")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 overflow-hidden">
                {currentMachine?.imagePath ? (
                  <img
                    src={fileBaseURL + currentMachine.imagePath}
                    alt={currentMachine.machineName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Cpu className="w-4 h-4 text-slate-500" />
                )}
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-none">
                  {currentMachine?.machineName || "Part Process"}
                  {currentMachine?.machineCode && (
                    <span className="ml-1.5 text-[10px] font-mono font-semibold text-cyan-600">
                      ({currentMachine.machineCode})
                    </span>
                  )}
                </p>
                <span
                  className={`text-[10px] font-semibold ${isRunning ? "text-emerald-600" : "text-rose-500"}`}
                >
                  {loading ? "Loading…" : isRunning ? "● Running" : "■ Stopped"}
                </span>
              </div>
            </div>

            {curModel && (
              <>
                <div className="w-px h-8 bg-slate-200 mx-1" />
                <div className="text-xs">
                  {curMat ? (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        {curMat.partName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {curModel} · {curMat.drawingNumber}{" "}
                        {curMat.drawingRevision}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-slate-600">{curModel}</span>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2 ml-2 flex-wrap">
              <button
                onClick={() => navigate("/part-process/hourly-report")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Hourly Report
              </button>
              <button
                onClick={() => navigate("/part-process/production-report")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800"
              >
                Production Report
              </button>
              <button
                onClick={() => setDowntimeModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                <TimerOff className="w-3.5 h-3.5" /> Log Downtime
              </button>
              <button
                onClick={() => {
                  if (qualityPassword) {
                    setPwdInput("");
                    setPwdError(false);
                    setPwdGate(true);
                  } else {
                    setQualityModal(true);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
              >
                {qualityPassword ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}{" "}
                Log Quality
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* ── Quick range buttons ── */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {[
                  { label: "Today", mode: "today", fn: handleToday },
                  {
                    label: "Yesterday",
                    mode: "yesterday",
                    fn: handleYesterday,
                  },
                ].map(({ label, mode, fn }) => (
                  <button
                    key={mode}
                    onClick={fn}
                    disabled={loading}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all disabled:opacity-40 ${
                      rangeMode === mode
                        ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustom((v) => !v)}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all disabled:opacity-40 ${
                    rangeMode === "custom"
                      ? "bg-white text-purple-700 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Custom
                </button>
              </div>

              {/* ── Custom datetime range picker (inline dropdown) ── */}
              {showCustom && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 shadow-sm">
                  <input
                    type="datetime-local"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-slate-400 text-xs font-bold">→</span>
                  <input
                    type="datetime-local"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400"
                  />
                  <button
                    onClick={handleCustomApply}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Search className="w-3 h-3" />
                    )}
                    Apply
                  </button>
                </div>
              )}

              {/* ── Active range label ── */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-500 whitespace-nowrap max-w-[260px] truncate">
                <Calendar className="w-3 h-3 shrink-0" />
                {rangeMode === "today" &&
                  `Today · ${new Date(rangeStart).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} → now`}
                {rangeMode === "yesterday" && "Yesterday (full shift)"}
                {rangeMode === "custom" &&
                  `${new Date(rangeStart).toLocaleDateString("en-IN")} ${new Date(rangeStart).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} → ${new Date(rangeEnd).toLocaleDateString("en-IN")} ${new Date(rangeEnd).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-white">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-bold font-mono tracking-wide">
                  {p2(time.getHours())}:{p2(time.getMinutes())}:
                  {p2(time.getSeconds())}
                </span>
              </div>
              {records.length > 0 && !loading && (
                <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 min-w-[60px]">
                  <span className="text-sm font-bold font-mono text-slate-700">
                    {records.length.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">
                    records
                  </span>
                </div>
              )}
              <button
                onClick={loadToday}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={toggleFullScreen}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              {/* floating exit button moved below so it's not hidden with header */}
            </div>
          </div>
        </div>

        {isFullscreen && (
          <button
            onClick={toggleFullScreen}
            className="fixed top-2 right-2 z-50 p-2 rounded bg-white/80 shadow-md"
            title="Exit fullscreen"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        )}

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 relative">
          {loading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-100/80 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-sm font-semibold text-slate-600">
                Loading dashboard data…
              </span>
              {loadProgress.total > 0 && (
                <span className="text-xs text-slate-500 font-mono">
                  {loadProgress.loaded.toLocaleString()} /{" "}
                  {loadProgress.total.toLocaleString()} records
                </span>
              )}
            </div>
          )}

          {/* ── SHIFT SELECTOR ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Shift
                </span>
              </div>
              <button
                onClick={() => setSelectedShift(null)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${!selectedShift ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                All Shifts
              </button>
              {shifts.map((s) => {
                const active = isActiveShift(s) && isToday;
                const selected = selectedShift?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedShift(s)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${selected ? "text-white shadow-sm" : active ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                    style={
                      selected
                        ? {
                            backgroundColor: s.color || "#3b82f6",
                            borderColor: s.color || "#3b82f6",
                          }
                        : {}
                    }
                  >
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    )}
                    <span>{s.shiftName}</span>
                    <span className="font-normal opacity-70 text-[10px]">
                      {s.startTime}–{s.endTime}
                    </span>
                    {active && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selected ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}`}
                      >
                        NOW
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SHIFT INFO CARD ── */}
          {selectedShift && (
            <div
              className="bg-white rounded-xl border shadow-sm shrink-0 overflow-hidden"
              style={{ borderColor: selectedShift.color || "#e2e8f0" }}
            >
              <div className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: selectedShift.color || "#3b82f6",
                      }}
                    />
                    <p className="text-sm font-bold text-slate-800">
                      {selectedShift.shiftName}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400 font-mono">
                      [{selectedShift.shiftCode}]
                    </span>
                    {isActiveShift(selectedShift) && isToday && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                        Active Now
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    <span className="font-mono font-semibold text-slate-700">
                      {selectedShift.startTime} → {selectedShift.endTime}
                    </span>
                    {selectedShift.breakStart && (
                      <span>
                        Break:{" "}
                        <strong className="text-slate-600">
                          {selectedShift.breakStart}–{selectedShift.breakEnd}
                        </strong>
                      </span>
                    )}
                    <span>
                      Tea breaks:{" "}
                      <strong className="text-slate-600">
                        {selectedShift.teaBreaks}
                      </strong>
                    </span>
                  </div>
                  {shiftProgress && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Shift Progress</span>
                        <span
                          className="font-bold font-mono"
                          style={{ color: selectedShift.color || "#3b82f6" }}
                        >
                          {shiftProgress.pct}% · {shiftProgress.remaining}{" "}
                          remaining
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${shiftProgress.pct}%`,
                            backgroundColor: selectedShift.color || "#3b82f6",
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 font-mono">
                        <span>{selectedShift.startTime}</span>
                        <span>
                          {shiftProgress.elapsed}m elapsed of{" "}
                          {shiftProgress.total}m
                        </span>
                        <span>{selectedShift.endTime}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {[
                    {
                        label: "Qty",
                        value: displayComponentQty.toLocaleString(),
                        color: "text-blue-600",
                      },
                    {
                      label: "Good",
                      value: shiftOEE.good,
                      color: "text-emerald-600",
                    },
                    {
                      label: "Downtime",
                      value: `${shiftOEE.downMins}m`,
                      color: "text-rose-500",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 min-w-[60px]"
                    >
                      <span className={`text-lg font-bold font-mono ${color}`}>
                        {value}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ROW 1: KPI Cards ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
              <div className="relative shrink-0">
                <RingProgress
                  value={displayComponentQty}
                  max={Math.max(displayComponentQty, 500)}
                  color={selectedShift?.color || "#3b82f6"}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold font-mono text-slate-700">
                    {displayComponentQty > 0
                      ? Math.min(
                          100,
                          Math.round((displayComponentQty / 500) * 100),
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  {selectedShift
                    ? `${selectedShift.shiftName} Components`
                    : "Components Produced"}
                </p>
                <p className="text-2xl font-bold font-mono text-slate-800">
                  {displayComponentQty.toLocaleString()}
                </p>
                {/* Showing component count only (sheets hidden) */}
                <p className="text-[11px] text-slate-400">
                  {totalProdRecords} production events
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
              <div className="relative shrink-0">
                <RingProgress
                  value={activeOEE}
                  max={100}
                  color={oeeColor(activeOEE)}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-xs font-bold font-mono"
                    style={{ color: oeeColor(activeOEE) }}
                  >
                    {activeOEE}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  {selectedShift ? `${selectedShift.shiftName} OEE` : "OEE"}
                </p>
                <p
                  className="text-2xl font-bold font-mono"
                  style={{ color: oeeColor(activeOEE) }}
                >
                  {activeOEE}%
                </p>
                <span
                  className={`text-[10px] font-semibold block mt-0.5 ${activeOEE >= 85 ? "text-emerald-600" : activeOEE >= 65 ? "text-amber-600" : "text-rose-500"}`}
                >
                  {activeOEE >= 85
                    ? "World Class"
                    : activeOEE >= 65
                      ? "Acceptable"
                      : "Needs Attention"}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  {selectedShift
                    ? `${selectedShift.shiftName} Quality`
                    : "Quality Split"}
                </p>
                {qualityTotals.hasData && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-500 border border-violet-200">
                    From Log
                  </span>
                )}
              </div>
              <div className="flex items-end gap-3 mb-2">
                <div>
                  <p className="text-xl font-bold font-mono text-emerald-600">
                    {qualityTotals.hasData
                      ? qualityTotals.accepted
                      : displayComponentGood}
                  </p>
                  <p className="text-[10px] text-emerald-500 font-medium">
                    Accepted
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-xl font-bold font-mono text-rose-500">
                    {qualityTotals.hasData
                      ? qualityTotals.rejected
                      : displayComponentBad}
                  </p>
                  <p className="text-[10px] text-rose-400 font-medium">
                    Rejected
                  </p>
                </div>
                {qualityTotals.hasData && (
                  <>
                    <div className="w-px h-8 bg-slate-200" />

                  </>
                )}
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                {qualityTotals.hasData ? (
                  <>
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${qualityTotals.passRate}%` }}
                    />
                    {qualityTotals.rejected > 0 && (
                      <div
                        className="h-full bg-rose-400"
                        style={{ width: `${100 - qualityTotals.passRate}%` }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${passR}%` }}
                    />
                    {displayComponentBad > 0 && (
                      <div
                        className="h-full bg-rose-400"
                        style={{ width: `${100 - passR}%` }}
                      />
                    )}
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {qualityTotals.hasData ? qualityTotals.passRate : passR}% pass
                rate
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                {selectedShift
                  ? `${selectedShift.shiftName} Downtime`
                  : "Downtime"}
              </p>
              <div className="flex items-end gap-2 mb-2 flex-wrap">
                <div>
                  <p
                    className={`text-xl font-bold font-mono ${dMins > 30 ? "text-rose-500" : "text-amber-600"}`}
                  >
                    {dMins}
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium">
                    min total
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 text-[9px] font-semibold pb-0.5">
                  <span className="text-rose-500">
                    {
                      shiftRecords.filter(
                        (r) => (r.effectiveState || r.state) === "Downtime",
                      ).length
                    }
                    × brief (&lt;{IDLE_THRESHOLD_MINS}m)
                  </span>
                  <span className="text-amber-600">
                    {
                      shiftRecords.filter(
                        (r) => (r.effectiveState || r.state) === "Idle",
                      ).length
                    }
                    × idle (≥{IDLE_THRESHOLD_MINS}m)
                  </span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <p className="text-xl font-bold font-mono text-amber-600">
                    {coStats.count}
                  </p>
                  <p className="text-[9px] text-amber-500 font-medium">
                    Changeovers
                  </p>
                </div>
              </div>
              {coStats.overrunMins > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-rose-50 border border-rose-100">
                  <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                  <span className="text-[10px] text-rose-600 font-semibold">
                    {coStats.overrunCount} CO &gt;{STD_CHANGEOVER_MINS}m ·{" "}
                    {coStats.overrunMins}m loss
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <Timer className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] text-slate-500">
                  Avg sheet CT: <strong>{activeAvgCycleSecs}s</strong>
                </span>
              </div>
            </div>
          </div>

          {/* ── ROW 2: OEE Chart + Production Summary + Setting Parameters ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                  OEE
                </span>
                {records.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className={`font-bold ${activeOEE >= 85 ? "text-emerald-600" : activeOEE >= 65 ? "text-amber-600" : "text-rose-500"}`}
                    >
                      {selectedShift ? selectedShift.shiftName : "All Shifts"}{" "}
                      OEE: {activeOEE}%
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400">
                      A:{activeA}% · P:{activeP}% · Q:{activeQ}%
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 min-h-80">
                {oeeTimeSeries.labels.length > 1 ? (
                  <Line data={oeeLineData} options={oeeLineOptions} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                    <Gauge className="w-8 h-8 opacity-40" strokeWidth={1.2} />
                    <p className="text-xs text-slate-400">
                      Load data to see OEE trend
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-3">
                  Production Summary
                </p>
                <div className="flex flex-col divide-y divide-slate-100">
                  {[
                    {
                      label: "Model Target",
                      value:
                        modelLabels.length ||
                        (shiftRecords.length > 0 ? 1 : "-"),
                      color: "text-slate-600",
                    },
                    {
                      label: "Produced Part Count",
                      value: displayComponentQty.toLocaleString(),
                      color: "text-blue-600",
                    },
                    {
                      label: "Accepted Count",
                      value: qualityTotals.hasData
                        ? qualityTotals.accepted
                        : displayComponentGood,
                      color: "text-emerald-600",
                    },
                    {
                      label: "Rejected Count",
                      value: qualityTotals.hasData
                        ? qualityTotals.rejected
                        : displayComponentBad,
                      color: "text-rose-500",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span className="text-[12px] text-slate-500">
                        {label}
                      </span>
                      <span className={`text-sm font-bold font-mono ${color}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-3">
                  Setting Parameters
                </p>
                <div className="flex flex-col divide-y divide-slate-100">
                  <div className="py-2.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      Part Name
                    </span>
                    <p className="text-sm font-bold text-blue-700 mt-0.5 leading-snug">
                      {curMat?.partName ||
                        (curModel ? (
                          <span className="text-slate-600 text-xs font-normal block">
                            {extractProgramName(curModel) || curModel}
                            <span className="block text-[9px] font-bold text-rose-500 mt-0.5">
                              ⚠ Master not exist
                            </span>
                          </span>
                        ) : (
                          <span className="text-amber-600">N/A</span>
                        ))}
                    </p>
                  </div>
                  {[
                    {
                      label: "Defined Component CT",
                      value: curMat
                        ? `${curMat.definedComponentCycleTime} s`
                        : "N/A",
                    },
                    {
                      label: "Component CT",
                      value:
                        curComponentCT != null ? `${curComponentCT} s` : "N/A",
                    },
                    {
                      label: "SAP Code",
                      value:
                        curMat?.sapCode || extractSapCode(curModel) || "N/A",
                    },
                    // FIX #3 — runTimeMins & downTimeMins now always returned from computeOEE
                    {
                      label: "RunTime/DownTime",
                      value:
                        activeOEEData.runTimeMins > 0 ||
                        activeOEEData.downMins > 0
                          ? `${activeOEEData.runTimeMins}/${activeOEEData.downMins}`
                          : "N/A",
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span className="text-[12px] text-slate-500">
                        {label}
                      </span>
                      <span className="text-sm font-bold font-mono text-amber-600">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 3: Model breakdown + Running Summary + OEE A·P·Q ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                <PackageOpen className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Model Breakdown
                </span>
              </div>
              {modelBreakdownLabels.length > 0 ? (
                <div className="overflow-auto">
                  <table className="min-w-full text-[11px] border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {["Model", "Target", "Produced", "Accepted", "Rejected"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-[10px] font-semibold text-slate-400 border-b border-slate-200 text-left whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {modelBreakdownLabels.map((m, i) => {
                        const produced = activeModelMap[m] || 0;
                        const target = plannedModelMap[m] || 0;
                        const masterMatch = materials.some(
                          (mat) => mat.partName === m,
                        );
                        const qLog = qualityByModel[m] || {
                          inspected: 0,
                          rejected: 0,
                        };
                        const accepted = Math.max(0, produced - qLog.rejected);
                        return (
                          <tr
                            key={m}
                            className="hover:bg-blue-50/30 transition-colors"
                          >
                            <td className="px-3 py-2.5 border-b border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      CHART_COLORS[i % CHART_COLORS.length],
                                  }}
                                />
                                <div className="min-w-0">
                                  <p
                                    className={`font-semibold leading-snug truncate max-w-[160px] ${masterMatch ? "text-slate-700" : "text-slate-500"}`}
                                  >
                                    {m}
                                  </p>
                                  {!masterMatch && (
                                    <p className="text-[9px] font-bold text-rose-500">
                                      ⚠ no master
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-slate-500">
                              {target > 0 ? target : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-blue-600">
                              {produced}
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-emerald-600">
                              {accepted}
                            </td>
                            <td
                              className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono"
                              style={{
                                color: qLog.rejected > 0 ? "#ef4444" : "#22c55e",
                              }}
                            >
                              {qLog.rejected}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-300 py-6 px-3">
                  <PackageOpen
                    className="w-8 h-8 opacity-40"
                    strokeWidth={1.2}
                  />
                  <p className="text-xs text-slate-400">No data yet</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                <Activity className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Department Loss
                </span>
                {loading && (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-auto" />
                )}
              </div>
              {deptLoss.length === 0 ? (
                <div className="p-4 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
                  <span className="text-2xl">🏭</span>
                  <p className="text-[11px] text-slate-400 font-medium">
                    No department data yet
                  </p>
                  <p className="text-[10px] text-slate-300">
                    Log downtime reasons with departments to see breakdown
                  </p>
                </div>
              ) : (
                <div className="p-3 flex flex-col gap-2.5">
                  {deptLoss.map(([dept, secs], i) => {
                    const mins = Math.round((secs / 60) * 10) / 10;
                    const pct =
                      deptTotalSecs > 0
                        ? Math.round((secs / deptTotalSecs) * 100)
                        : 0;
                    const col = DEPT_COLORS[i % DEPT_COLORS.length];
                    return (
                      <div key={dept}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: col }}
                            />
                            <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[130px]">
                              {dept}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">
                              {pct}%
                            </span>
                            <span
                              className="text-[11px] font-bold font-mono"
                              style={{ color: col }}
                            >
                              {mins}m
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: col }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center pt-1 mt-0.5 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">
                      Total attributed loss
                    </span>
                    <span className="text-[11px] font-bold font-mono text-slate-600">
                      {Math.round((deptTotalSecs / 60) * 10) / 10}m
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                <Gauge className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  OEE Breakdown (A · P · Q)
                </span>
                <span
                  className="ml-auto text-sm font-bold font-mono"
                  style={{
                    color: activeOEE > 0 ? oeeColor(activeOEE) : "#94a3b8",
                  }}
                >
                  {activeOEE > 0 ? `${activeOEE}%` : "N/A"}
                </span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {(() => {
                  const qVal = qualityTotals.hasData
                    ? qualityTotals.passRate
                    : activeQ;
                  const qWarn = qualityTotals.hasData
                    ? false
                    : activeQUnverified;
                  return [
                    {
                      label: "Availability",
                      key: "A",
                      value: activeA,
                      color: "#22c55e",
                      warn: false,
                    },
                    {
                      label: "Performance",
                      key: "P",
                      value: activeP,
                      color: "#f59e0b",
                      warn: activePUnverified,
                    },
                    {
                      label: "Quality",
                      key: "Q",
                      value: qVal,
                      color: "#a78bfa",
                      warn: qWarn,
                      fromLog: qualityTotals.hasData,
                    },
                  ].map(({ label, key, value, color, warn, fromLog }) => (
                    <div
                      key={key}
                      className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                          {key}
                        </span>
                        <span
                          className="text-base font-bold font-mono"
                          style={{ color: value > 0 ? color : "#94a3b8" }}
                        >
                          {value > 0 ? `${value}%` : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${value}%`,
                            backgroundColor: value > 0 ? color : "#e2e8f0",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-slate-400">{label}</p>
                        {fromLog && (
                          <span className="text-[8px] font-bold text-violet-500 bg-violet-50 border border-violet-200 px-1 rounded">
                            log
                          </span>
                        )}
                        {warn && (
                          <span className="text-[8px] font-bold text-amber-500 bg-amber-50 border border-amber-200 px-1 rounded">
                            no data
                          </span>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                {[
                  {
                    label: "Runtime",
                    value: `${activeOEEData.runTimeMins || 0} min`,
                    color: "text-emerald-600",
                  },
                  {
                    label: "Downtime",
                    value: `${activeOEEData.downMins || 0} min`,
                    color: "text-rose-500",
                  },
                  {
                    label: "Avg Sheet CT",
                    value:
                      activeAvgCycleSecs > 0 ? `${activeAvgCycleSecs}s` : "—",
                    color: "text-violet-600",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center text-[11px] py-1 border-t border-slate-100"
                  >
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-bold font-mono ${color}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── TIMELINE ── */}
          {/* FIX #7 — pass `changeovers` prop so markers match KPI card count */}
          {/* FIX #8 — shift start/end passed for correct axis boundaries */}
          {timelineRecords.length > 0 &&
            (() => {
              // Compute absolute datetime window for the timeline axis:
              //   All Shifts:  rangeStart → rangeEnd  (from date-range picker)
              //   Shift 1:     selectedDate 08:00 IST → selectedDate 20:00 IST
              //   Shift 2:     selectedDate 20:00 IST → (selectedDate+1) 08:00 IST
              let tlWindowStart, tlWindowEnd;
              if (!selectedShift) {
                // All Shifts: use the loaded range directly
                tlWindowStart = new Date(rangeStart).getTime();
                tlWindowEnd = new Date(rangeEnd).getTime();
              } else {
                // Parse "HH:MM" shift times against selectedDate in IST
                const [sH, sM] = selectedShift.startTime.split(":").map(Number);
                const [eH, eM] = selectedShift.endTime.split(":").map(Number);
                const [yr, mo, dy] = selectedDate.split("-").map(Number);
                tlWindowStart = istToUtcMs(yr, mo, dy, sH, sM);
                // End: same date if day shift, next date if overnight
                const isON = eH * 60 + eM <= sH * 60 + sM;
                const endDy = isON ? dy + 1 : dy;
                tlWindowEnd = istToUtcMs(yr, mo, endDy, eH, eM);
              }
              return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <TimeMap
                    records={timelineRecords}
                    changeovers={changeovers}
                    isToday={isToday}
                    shiftName={selectedShift?.shiftName}
                    shiftColor={selectedShift?.color}
                    windowStartMs={tlWindowStart}
                    windowEndMs={tlWindowEnd}
                  />
                </div>
              );
            })()}

          {/* ── Model-wise Production Chart ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Model-wise Production (Components)
              </span>
            </div>
            <div className="h-56">
              {modelLabels.length > 0 ? (
                <Bar data={modelChartData} options={modelChartOptions} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                  <BarChart2 className="w-8 h-8 opacity-40" strokeWidth={1.2} />
                  <p className="text-xs text-slate-400">
                    No production data yet
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Logged Entries ── */}
          {(scopedDTEntries.length > 0 || scopedQEntries.length > 0) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {/* Downtime / Changeover Logs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <TimerOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Downtime Log
                  </span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                    {scopedDTEntries.length}
                  </span>
                </div>
                {scopedDTEntries.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-300 text-center">
                    No downtime entries logged yet.
                  </p>
                ) : (
                  <div className="overflow-auto max-h-52">
                    <table className="min-w-full text-[11px] border-separate border-spacing-0">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          {[
                            "Shift",
                            "Start",
                            "Duration",
                            "Reason",
                            "Remarks",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 border-b border-slate-200 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scopedDTEntries.map((e, i) => {
                          const reason = e.reasonName || e.ReasonName;
                          const isCO = e.isChangeover || e.IsChangeover;
                          return (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                                {e.shift || e.ShiftName || "—"}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                                {String(
                                  e.startTime || e.StartTime || "",
                                ).substring(0, 8) || "—"}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-rose-500 whitespace-nowrap">
                                {e.duration || e.Duration || "—"}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100">
                                {isCO ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                                    Changeover
                                  </span>
                                ) : reason ? (
                                  <span className="text-emerald-700 font-semibold">
                                    {reason}
                                  </span>
                                ) : (
                                  <span className="text-amber-500 text-[10px] font-bold">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-slate-400 max-w-[120px] truncate">
                                {e.remarks || e.Remarks || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quality Logs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Quality Log
                  </span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                    {scopedQEntries.length}
                  </span>
                </div>
                {scopedQEntries.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-300 text-center">
                    No quality entries logged yet.
                  </p>
                ) : (
                  <div className="overflow-auto max-h-52">
                    <table className="min-w-full text-[11px] border-separate border-spacing-0">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          {[
                            "Shift",
                            "Model",
                            "Inspected",
                            "Rejected",
                            "Defect",
                            "Disposition",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 border-b border-slate-200 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scopedQEntries.map((e, i) => {
                          const rej = parseInt(
                            e.rejectedQty ?? e.RejectedQty ?? 0,
                            10,
                          );
                          return (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                                {e.shift || e.ShiftName || "—"}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 max-w-[140px] truncate font-medium text-slate-700">
                                {e.partName ||
                                  e.PartName ||
                                  e.model ||
                                  e.Model ||
                                  "—"}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-blue-600 text-center">
                                {e.inspectedQty ?? e.InspectedQty ?? "—"}
                              </td>
                              <td
                                className="px-3 py-2 border-b border-slate-100 font-mono font-bold text-center"
                                style={{
                                  color: rej > 0 ? "#ef4444" : "#22c55e",
                                }}
                              >
                                {rej}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {e.defectCode || e.DefectCode || "—"}
                                </span>
                                <span className="ml-1 text-slate-500">
                                  {e.defectName || e.DefectName || ""}
                                </span>
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 text-slate-500">
                                {e.disposition || e.Disposition || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Current Part Info ── */}
          {curMat && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileImage className="w-4 h-4 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Current Part Details — from Material Config
                </span>
                <span className="ml-auto text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  SAP: {curMat.sapCode}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                {[
                  {
                    label: "Part Name",
                    value: curMat.partName,
                    bold: true,
                    color: "text-blue-700",
                  },
                  {
                    label: "Category",
                    value: curMat.category,
                    bold: false,
                    color: "text-slate-600",
                  },
                  {
                    label: "Defined Comp CT",
                    value: `${curMat.definedComponentCycleTime} s`,
                    bold: true,
                    color: "text-violet-600",
                  },
                  {
                    label: "No of Sheet",
                    value: curMat.noOfSheet,
                    bold: true,
                    color: "text-emerald-600",
                  },
                  {
                    label: "Comp / Sheet",
                    value: curMat.actualComponentsPerSheet,
                    bold: true,
                    color: "text-emerald-600",
                  },
                  {
                    label: "Load/Unload",
                    value: `${curMat.pncLoadingUnloading} s`,
                    bold: false,
                    color: "text-amber-700",
                  },
                  {
                    label: "Drawing No.",
                    value: curMat.drawingNumber,
                    bold: false,
                    color: "text-amber-700",
                  },
                  {
                    label: "Rev.",
                    value: curMat.drawingRevision,
                    bold: false,
                    color: "text-amber-600",
                  },
                ].map(({ label, value, bold, color }) => (
                  <div
                    key={label}
                    className="bg-slate-50 rounded-lg p-2.5 border border-slate-100"
                  >
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
                      {label}
                    </p>
                    <p
                      className={`text-xs ${bold ? "font-bold" : "font-medium"} ${color}`}
                    >
                      {value || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Log Downtime Modal ── */}
      {downtimeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDowntimeModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[82vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-rose-200 bg-rose-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-100">
                  <TimerOff className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Log Downtime Entry
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Select a pending event → assign reason code
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDowntimeModal(false)}
                className="p-1.5 rounded-lg hover:bg-rose-100"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <QuickDowntimeForm
              records={records}
              downtimeReasons={downtimeReasons}
              downtimeEntries={scopedDTEntries}
              changeovers={changeovers}
              eventDate={selectedDate}
              onSave={async (entry) => {
                dispatch(logDowntimeEntry(entry));
                try {
                  await axios.post(`${PART_PROCESS_API}/downtime-log`, entry, {
                    withCredentials: true,
                  });
                  toast.success("Downtime logged.");
                  const r = await axios.get(`${PART_PROCESS_API}/downtime-log`, {
                    withCredentials: true,
                  });
                  setDbDTLogs(r.data?.data ?? []);
                } catch (err) {
                  console.error("[Dashboard] downtime-log save:", err.message);
                  toast.success(
                    "Downtime logged (local only — server save failed).",
                  );
                }
              }}
              onClose={() => setDowntimeModal(false)}
            />
          </div>
        </div>
      )}

      {/* ── Password Gate Modal ── */}
      {pwdGate && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPwdGate(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-100">
                <Lock className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Quality Log Password
                </h2>
                <p className="text-[11px] text-slate-400">
                  Enter password to continue
                </p>
              </div>
            </div>
            <input
              type="password"
              autoFocus
              value={pwdInput}
              onChange={(e) => {
                setPwdInput(e.target.value);
                setPwdError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pwdInput === qualityPassword) {
                    setPwdGate(false);
                    setQualityModal(true);
                  } else {
                    setPwdError(true);
                  }
                }
              }}
              placeholder="Enter password…"
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${pwdError ? "border-rose-400 bg-rose-50 focus:ring-rose-300" : "border-slate-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"}`}
            />
            {pwdError && (
              <p className="text-xs text-rose-500 font-semibold -mt-2">
                Incorrect password.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPwdGate(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pwdInput === qualityPassword) {
                    setPwdGate(false);
                    setQualityModal(true);
                  } else {
                    setPwdError(true);
                  }
                }}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Log Quality Modal ── */}
      {qualityModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setQualityModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[82vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-violet-200 bg-violet-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-100">
                  <ShieldCheck className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Log Quality Entry
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Select a model → fill inspection details — modal stays open
                    for multiple entries
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQualityModal(false)}
                className="p-1.5 rounded-lg hover:bg-violet-100"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <QuickQualityForm
              records={records}
              qualityDefects={qualityDefects}
              qualityEntries={scopedQEntries}
              materials={materials}
              onSave={async (entry) => {
                const fullEntry = { ...entry, eventDate: selectedDate };
                dispatch(logQualityEntry(fullEntry));
                try {
                  await axios.post(
                    `${PART_PROCESS_API}/quality-log`,
                    fullEntry,
                    { withCredentials: true },
                  );
                  toast.success("Quality entry logged.");
                  const r = await axios.get(
                    `${PART_PROCESS_API}/quality-log?startDate=${selectedDate}&endDate=${selectedDate}`,
                    { withCredentials: true },
                  );
                  setDbQLogs(r.data?.data ?? []);
                } catch (err) {
                  console.error("[Dashboard] quality-log save:", err.message);
                  toast.success(
                    "Quality entry logged (local only — server save failed).",
                  );
                }
              }}
              onClose={() => setQualityModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default PartProcessDashboard;
