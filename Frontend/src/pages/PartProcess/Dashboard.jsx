import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
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
  Zap,
  Clock,
  Calendar,
  BarChart2,
  CheckCircle2,
  XCircle,
  Timer,
  RefreshCw,
  PackageOpen,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Gauge,
  Cpu,
  Loader2,
} from "lucide-react";
import { baseURL } from "../../assets/assets.js";
import toast from "react-hot-toast";
import {
  selectMaterials, selectDowntimeReasons, selectQualityDefects,
  selectShifts, getMaterialByModel, extractSapCode, extractProgramName,
  logDowntimeEntry, logQualityEntry,
  isActiveShift, shiftElapsedMins, shiftDurationMins, toMins, getShiftWindow,
} from "../../redux/slices/masterConfigSlice";
import { TimerOff, ShieldCheck, X, Plus, FileImage } from "lucide-react";
import { mapFOsRecord } from "./FactoryMonitor";
import fosClient, { FACTORY_OS_BASE, FACTORY_MACHINE_ID } from "../../utils/factoryOsClient";
import { enrichRecords, detectChangeovers, changeoverStats, IDLE_THRESHOLD_MINS, STD_CHANGEOVER_MINS, isPunchingPart } from "../../utils/productionLogic.js";

ChartJS.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

// ── Parse "HH:MM:SS" → seconds ─────────────────────────────────────────────────
const parseDurSecs = (dur = "00:00:00") => {
  const [h, m, s] = (dur || "00:00:00").split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};
const secsToMins = (secs) => (secs / 60).toFixed(1);

// ── Punching component helpers (kept in sync with the Production Report) ──────
// Total Components Produced =
//   (No. of Sheets × No. of Components per Sheet) × machine sheet count (machineQty)
const componentQtyFromMaster = (machineQty, mat) => {
  const q            = machineQty || 0;
  const noOfSheet    = Number(mat?.noOfSheet) || 0;
  const compPerSheet = Number(mat?.actualComponentsPerSheet) || 0;
  return isPunchingPart(mat) && noOfSheet > 0 && compPerSheet > 0
    ? noOfSheet * compPerSheet * q
    : q;
};

// Component Cycle Time =
//   (Sheet CT [machine cycle time] + Loading/Unloading Time) ÷ No. of Components per Sheet
const componentCTFromMaster = (sheetCT, mat) => {
  const compPerSheet = Number(mat?.actualComponentsPerSheet) || 0;
  const loadUnload   = Number(mat?.pncLoadingUnloading) || 0;
  if (!isPunchingPart(mat) || compPerSheet <= 0) return null;
  return Math.round((((Number(sheetCT) || 0) + loadUnload) / compPerSheet) * 100) / 100;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const p2 = (n) => String(n).padStart(2, "0");

const useClock = () => {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
};

const oeeColor = (v) =>
  v >= 85 ? "#22c55e" : v >= 65 ? "#f59e0b" : "#ef4444";

// ── SVG Ring Progress ──────────────────────────────────────────────────────────
const RingProgress = ({ value, max, size = 84, stroke = 8, color = "#3b82f6" }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} className="-rotate-90" style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
};

// ── Shift Timeline — canvas-based (one DOM node = no lag) ──────────────────────
const TimeMap = ({ records, isToday = false, shiftName = null, shiftColor = null, shiftStartTime = null, shiftEndTime = null }) => {
  const scrollRef  = useRef(null);
  const canvasRef  = useRef(null);
  const [zoom, setZoom]       = useState(1);
  const [canvasW, setCanvasW] = useState(0);
  const [tooltip, setTooltip] = useState(null);

  // ── Drag-scroll state ─────────────────────────────────────────────────────
  const dragRef = useRef({ dragging: false, startX: 0, scrollLeft: 0 });
  const onMouseDown = useCallback((e) => {
    dragRef.current = { dragging: true, startX: e.clientX, scrollLeft: scrollRef.current?.scrollLeft || 0 };
  }, []);
  const onMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging || !scrollRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    scrollRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current.dragging = false; }, []);

  // Live clock (60s interval — no point updating faster than a minute)
  const [nowMins, setNowMins] = useState(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      const d = new Date(); setNowMins(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const toMins = (t) => {
    if (!t) return null;
    const p = String(t).split(":");
    return (parseInt(p[0],10)||0)*60 + (parseInt(p[1],10)||0);
  };
  const fmt = (m) => `${p2(Math.floor(m/60)%24)}:${p2(m%60)}`;

  // ── Overnight-shift normalization ──────────────────────────────────────────
  // For shifts like Shift 2 (20:00–08:00) records after midnight have
  // minute-values 0–480, far below the 1200 (20:00) shift start.
  // Adding 1440 to those records places them correctly on a continuous axis,
  // eliminating the 08:00–20:00 gap.
  const ssm = toMins(shiftStartTime);          // e.g. 1200 for 20:00
  const sem = toMins(shiftEndTime);            // e.g.  480 for 08:00
  const isOvernightShift = ssm !== null && sem !== null && sem <= ssm;

  const normalize = (t) => {
    if (ssm === null || t === null) return t;
    // Time is before shift start → must be the "after-midnight" portion
    if (isOvernightShift && t < ssm) return t + 1440;
    return t;
  };

  // Process records → event array (stable reference)
  const rawEvents = useMemo(() => records
    .filter(r => r.startTime && r.endTime)
    .map(r => {
      const s = normalize(toMins(r.startTime));
      let   e = normalize(toMins(r.endTime));
      if (s===null||e===null) return null;
      if (e<s) e+=1440; if (e<=s) e=s+1;
      return { start:s, end:e, state:r.state };
    }).filter(Boolean),
  // eslint-disable-next-line
  [records, ssm, isOvernightShift]);

  const events = useMemo(() => {
    if (!isToday) return rawEvents;
    const nowNorm = normalize(nowMins) ?? nowMins;
    return rawEvents.map(e=>({...e, end:Math.min(e.end, nowNorm)})).filter(e=>e.end>e.start);
  }, [rawEvents, isToday, nowMins, ssm, isOvernightShift]); // eslint-disable-line

  if (!rawEvents.length) return null;

  // ── Axis boundaries ─────────────────────────────────────────────────────────
  // When shift times are known, pin the axis to the shift window.
  // This removes the "empty gap" on overnight shifts like Shift 2 (20:00–08:00)
  // because all after-midnight records have already been normalised +1440.
  const shiftAxisMin = ssm !== null ? ssm : null;
  const shiftAxisMax = ssm !== null && sem !== null
    ? (isOvernightShift ? ssm + (sem + 1440 - ssm) : sem)  // 1200+(480+1440-1200)=1920
    : null;

  const normNow = normalize(nowMins) ?? nowMins;
  const minT    = shiftAxisMin ?? Math.min(...rawEvents.map(e=>e.start));
  const maxT    = shiftAxisMax ?? (isToday
    ? Math.max(...rawEvents.map(e=>e.end), normNow)
    : Math.max(...rawEvents.map(e=>e.end)));
  const range   = Math.max(maxT - minT, 1);
  const nowPct  = isToday && normNow >= minT
    ? Math.min(100, Math.max(0, ((normNow - minT) / range) * 100))
    : null;
  const elapsed = isToday ? Math.max(1, normNow - minT) : range;
  // Idle = subtype of Downtime — both count against running time
  const runMins  = events.filter(e=>e.state==="Production").reduce((s,e)=>s+(e.end-e.start),0);
  const downMins = events.filter(e=>e.state==="Downtime"||e.state==="Idle").reduce((s,e)=>s+(e.end-e.start),0);
  const idleMins = events.filter(e=>e.state==="Idle").reduce((s,e)=>s+(e.end-e.start),0);
  const runPct   = Math.round((runMins/elapsed)*100);

  // ── Changeovers on timeline — detect model transitions ────────────────────────
  const coMarkers = useMemo(() => {
    const prod = records
      .filter(r => r.state==="Production" && r.model && r.startTime)
      .sort((a,b)=>(normalize(toMins(a.startTime))||0)-(normalize(toMins(b.startTime))||0));
    const markers = [];
    let prevModel=null, prevEnd=null;
    prod.forEach(r=>{
      const sm = normalize(toMins(r.startTime));
      const em = normalize(toMins(r.endTime||r.startTime));
      if (prevModel && prevModel!==r.model && sm!==null) {
        markers.push({
          xMins: sm,
          from: prevModel,
          to: r.model,
          gapMins: Math.max(0, sm-(prevEnd||sm)),
        });
      }
      prevModel=r.model; prevEnd=em;
    });
    return markers;
  // eslint-disable-next-line
  }, [records, ssm, isOvernightShift]);

  // ── Track container width via ResizeObserver (triggers canvas redraw) ────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanvasW(el.offsetWidth);
    const obs = new ResizeObserver(e => setCanvasW(e[0]?.contentRect.width || 0));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Draw everything on one canvas — single paint, no per-event DOM nodes ────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasW || !events.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvasW * zoom;
    const H   = 64;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, W, H);

    // Build stripe pattern once
    const sp = document.createElement("canvas");
    sp.width = 16; sp.height = 16;
    const sc = sp.getContext("2d");
    sc.fillStyle = "#f97316"; sc.fillRect(0,0,16,16);
    sc.strokeStyle = "#ef4444"; sc.lineWidth = 7;
    sc.beginPath();
    [[-4,4,4,-4],[0,16,16,0],[12,20,20,12]].forEach(([x1,y1,x2,y2])=>{sc.moveTo(x1,y1);sc.lineTo(x2,y2);});
    sc.stroke();
    const stripe = ctx.createPattern(sp,"repeat");

    const PAD = 5;

    // Event blocks
    events.forEach(e => {
      const x = ((e.start-minT)/range)*W;
      const w = Math.max(1,((e.end-e.start)/range)*W);
      ctx.fillStyle = e.state==="Production" ? "#22c55e" : e.state==="Downtime" ? stripe : "#fef3c7";
      ctx.fillRect(x, PAD, w, H-PAD*2);
      ctx.strokeStyle = e.state==="Production" ? "#16a34a" : e.state==="Downtime" ? "#dc2626" : "#f59e0b";
      ctx.lineWidth = 1;
      ctx.strokeRect(x+0.5, PAD+0.5, Math.max(1,w-1), H-PAD*2-1);
    });

    // Tick grid lines
    const tickInt = zoom>=8?15:zoom>=4?30:zoom>=2?60:120;
    const tStart  = Math.floor(minT/tickInt)*tickInt;
    for (let t=tStart; t<=maxT+tickInt; t+=tickInt) {
      const x = ((t-minT)/range)*W;
      if (x<0||x>W) continue;
      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    }

    // Future overlay
    if (nowPct!==null && nowPct<100) {
      const nx = (nowPct/100)*W;
      ctx.fillStyle = "rgba(203,213,225,0.45)";
      ctx.fillRect(nx, 0, W-nx, H);
    }

    // ── Changeover markers — dashed vertical line + triangle at transition ────
    coMarkers.forEach(co => {
      const cx = ((co.xMins-minT)/range)*W;
      if (cx<0||cx>W) return;
      // Dashed vertical line
      ctx.save();
      ctx.strokeStyle = "rgba(245,158,11,0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,H); ctx.stroke();
      ctx.restore();
      // Down-arrow triangle at bottom
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(cx,   H);
      ctx.lineTo(cx-5, H-9);
      ctx.lineTo(cx+5, H-9);
      ctx.closePath();
      ctx.fill();
      // Up-triangle at top
      ctx.beginPath();
      ctx.moveTo(cx,   0);
      ctx.lineTo(cx-5, 9);
      ctx.lineTo(cx+5, 9);
      ctx.closePath();
      ctx.fill();
    });

    // NOW line
    if (nowPct!==null) {
      const nx = (nowPct/100)*W;
      ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(nx,0); ctx.lineTo(nx,H); ctx.stroke();
      ctx.fillStyle = "#2563eb";
      ctx.beginPath(); ctx.arc(nx, PAD, 4, 0, Math.PI*2); ctx.fill();
    }

  }, [events, coMarkers, minT, maxT, range, nowPct, zoom, canvasW]);

  // Controls
  const handleZoomIn  = () => setZoom(z=>Math.min(z*2,32));
  const handleZoomOut = () => setZoom(z=>Math.max(z/2,1));
  const handleFit     = () => { setZoom(1); scrollRef.current?.scrollTo({left:0,behavior:"smooth"}); };
  const scrollToNow   = useCallback(() => {
    if (!scrollRef.current||nowPct===null) return;
    const el=scrollRef.current;
    el.scrollTo({left:Math.max(0,(nowPct/100)*el.scrollWidth - el.clientWidth/2), behavior:"smooth"});
  }, [nowPct]);
  useEffect(() => { if (zoom>1) scrollToNow(); }, [zoom]); // eslint-disable-line

  // Tooltip on canvas hover — also shows changeover info
  const handleCanvasMouseMove = useCallback((e) => {
    if (dragRef.current.dragging) return; // suppress during drag
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const t    = minT + (mx / rect.width) * range;

    // Nearest changeover within 10px?
    const CO_PX = 10;
    const nearCo = coMarkers.find(co => {
      const cx = ((co.xMins-minT)/range)*rect.width;
      return Math.abs(mx-cx) <= CO_PX;
    });
    if (nearCo) {
      setTooltip({ x:e.clientX, y:e.clientY,
        text:`CO: ${nearCo.from?.split("-")[0]||"?"} → ${nearCo.to?.split("-")[0]||"?"}  gap ${nearCo.gapMins.toFixed(1)}m`,
        co: true });
      return;
    }

    const hit = events.find(ev => t>=ev.start && t<=ev.end);
    setTooltip(hit ? { x:e.clientX, y:e.clientY,
      text:`${hit.state}: ${fmt(hit.start)} – ${fmt(hit.end%1440)} (${hit.end-hit.start}m)` } : null);
  }, [events, coMarkers, minT, range]);

  // Ticks for the axis div
  const tickInt2 = zoom>=8?15:zoom>=4?30:zoom>=2?60:120;
  const axTicks  = [];
  const axStart  = Math.floor(minT/tickInt2)*tickInt2;
  for (let t=axStart; t<=maxT+tickInt2; t+=tickInt2) {
    const pct = Math.max(0,Math.min(100,((t-minT)/range)*100));
    if (pct<-1||pct>101) continue;
    axTicks.push({ pct, label: fmt(t) });
  }

  return (
    <div className="flex flex-col gap-0">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Shift Timeline</span>
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
          {[{l:"+",fn:handleZoomIn},{l:"Fit",fn:handleFit},{l:"−",fn:handleZoomOut}].map(({l,fn})=>(
            <button key={l} onClick={fn}
              className="px-2 py-0.5 text-[10px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition-colors">{l}</button>
          ))}
          {isToday && nowPct!==null && (
            <button onClick={scrollToNow}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse shrink-0" /> NOW {fmt(nowMins)}
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Production</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{background:"repeating-linear-gradient(-45deg,#f97316 0,#f97316 4px,#ef4444 4px,#ef4444 8px)"}} /> Downtime
          </span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" /> Idle</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-900" /> Offline</span>
          <span className="flex items-center gap-1.5">
            <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-amber-500 shrink-0" />
            Changeover
          </span>
          <span className={`font-bold ${runPct>=80?"text-emerald-600":runPct>=60?"text-amber-600":"text-rose-500"}`}>{runPct}% Running</span>
        </div>
      </div>

      {/* ── Scrollable area — drag to scroll ── */}
      <div ref={scrollRef}
        className="overflow-x-auto rounded-lg border border-slate-200 select-none bg-white"
        style={{cursor: dragRef.current?.dragging ? "grabbing" : zoom>1 ? "grab" : "default"}}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}>
        <div style={{width: canvasW ? `${zoom*100}%` : "100%", minWidth:"100%"}}>

          {/* Time axis — lightweight CSS div, max ~12 ticks */}
          <div className="relative bg-white border-b border-slate-200 h-6">
            {axTicks.map(({pct,label})=>(
              <span key={label}
                className="absolute text-[10px] font-mono text-slate-500 -translate-x-1/2 bottom-0.5 whitespace-nowrap"
                style={{left:`${pct}%`}}>{label}</span>
            ))}
            {nowPct!==null && (
              <span className="absolute -translate-x-1/2 bottom-0.5 text-[10px] font-bold text-blue-600 whitespace-nowrap z-10"
                style={{left:`${nowPct}%`}}>{fmt(nowMins)}</span>
            )}
            {/* tick marks */}
            {axTicks.map(({pct,label})=>(
              <span key={`lm-${label}`} className="absolute bottom-0 w-px bg-slate-200" style={{left:`${pct}%`,height:"5px"}} />
            ))}
          </div>

          {/* Canvas — ONE element replaces 600+ divs */}
          <div className="relative" style={{height:"64px"}}>
            <canvas ref={canvasRef}
              className="block"
              style={{display:"block"}}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={()=>setTooltip(null)} />
            {/* NOW badge overlay */}
            {nowPct!==null && (
              <div className="absolute top-0 bottom-0 pointer-events-none z-10" style={{left:`${nowPct}%`}}>
                <div className="absolute -top-6 -translate-x-1/2 flex flex-col items-center">
                  <div className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow">NOW</div>
                  <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-transparent border-t-blue-600" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-1.5 text-[10px] flex-wrap">
        <span className="text-emerald-600 font-mono">● {runMins}m running</span>
        <span className="text-slate-500 font-mono">
          ● {downMins}m downtime
          {idleMins > 0 && (
            <span className="text-amber-500 ml-1">(incl. {idleMins}m idle)</span>
          )}
        </span>
        {coMarkers.length > 0 && (
          <span className="flex items-center gap-1 text-amber-600 font-semibold">
            ◆ {coMarkers.length} changeover{coMarkers.length>1?"s":""}
          </span>
        )}
        {isToday && nowPct!==null && (
          <span className="flex items-center gap-1 text-blue-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live · {fmt(nowMins)}
          </span>
        )}
        <span className="text-slate-400">{rawEvents.length} events</span>
      </div>

      {/* Hover tooltip — fixed position, no layout reflow */}
      {tooltip && (
        <div className="fixed z-50 bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{left: tooltip.x+12, top: tooltip.y-10}}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
};

// ── OEE Metric Bar ─────────────────────────────────────────────────────────────
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
          <div className="h-full flex-1" style={{ backgroundColor: "rgba(239,68,68,0.25)" }} />
        )}
      </div>
    </div>
  );
};

// ── Component Progress Row ─────────────────────────────────────────────────────
const ComponentRow = ({ name, qty, produced, active }) => {
  const pct = qty > 0 ? Math.round((produced / qty) * 100) : 0;
  return (
    <div className={`flex flex-col gap-1 p-2 rounded-lg transition-all ${active ? "bg-blue-50 border border-blue-100" : "border border-transparent"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${active ? "bg-blue-500 animate-pulse" : "bg-slate-300"}`} />
          <span className={`text-xs font-medium ${active ? "text-blue-700" : "text-slate-600"}`}>{name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-mono">{produced}/{qty}</span>
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

// ── Shared input class ─────────────────────────────────────────────────────────
const iC = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white";
const Lbl = ({ children }) => (
  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{children}</label>
);

// ── Quick Downtime Form — shows all pending downtime events to select & assign ─
const QuickDowntimeForm = ({ records, downtimeReasons, onSave, onClose }) => {
  const pendingList  = records.filter((r) => r.state === "Downtime");
  const activeReasons = downtimeReasons.filter((r) => r.status);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ reasonId: "", operator: "", remarks: "" });
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!selected) { toast.error("Select a downtime event from the list."); return; }
    if (!form.reasonId) { toast.error("Select a downtime reason."); return; }
    const r = activeReasons.find((x) => String(x.id) === String(form.reasonId));
    onSave({
      srNo: selected.srNo, shift: selected.shift,
      startTime: selected.startTime, endTime: selected.endTime, duration: selected.duration,
      model: selected.model, reasonCode: r?.dtCode, reasonName: r?.reason,
      category: r?.category, planned: r?.planned,
      operator: form.operator, remarks: form.remarks,
      loggedAt: new Date().toISOString(),
    });
  };

  return (
    <>
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT — pending downtime list */}
        <div className="flex-1 overflow-auto border-r border-slate-100 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Downtime Events
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
              {pendingList.length} total
            </span>
          </div>

          {pendingList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-300">
              <TimerOff className="w-8 h-8 opacity-30" strokeWidth={1.2} />
              <p className="text-xs text-slate-400">No downtime events in current data</p>
              <p className="text-[11px] text-slate-300">Load data using the Query button first</p>
            </div>
          ) : (
            pendingList.map((r, idx) => {
              const isPending = !r.downtimeReason || r.downtimeReason === "Assign";
              const isSelected = selected?.srNo === r.srNo;
              return (
                <button
                  key={idx}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-rose-500 bg-rose-50 shadow-sm"
                      : isPending
                      ? "border-amber-200 bg-amber-50/60 hover:border-amber-400 hover:shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500">
                      Sr #{r.srNo} · {r.shift}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isPending ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {isPending ? "⚠ UNASSIGNED" : "✓ ASSIGNED"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-slate-600">{r.startTime}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-mono text-slate-600">{r.endTime}</span>
                    <span className="font-bold text-rose-600 ml-auto">{r.duration}</span>
                  </div>
                  {r.downtimeReason && r.downtimeReason !== "Assign" && (
                    <p className="text-[10px] text-slate-400 mt-1 truncate">{r.downtimeReason}</p>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT — assign reason form */}
        <div className="w-64 shrink-0 p-4 flex flex-col gap-3 overflow-auto">
          {selected ? (
            <>
              {/* Selected event summary */}
              <div className="bg-rose-50 rounded-xl border border-rose-200 p-3 shrink-0">
                <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-1.5">
                  Selected Event
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-700">{selected.startTime}</span>
                  <span className="text-slate-300">→</span>
                  <span className="font-mono text-slate-700">{selected.endTime}</span>
                </div>
                <p className="text-sm font-bold text-rose-600 mt-1">{selected.duration}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{selected.shift}</p>
              </div>

              {/* Reason dropdown */}
              <div>
                <Lbl>Downtime Reason <span className="text-rose-500">*</span></Lbl>
                <select value={form.reasonId} onChange={sf("reasonId")} className={iC}>
                  <option value="">Select Reason</option>
                  {activeReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.reason}
                    </option>
                  ))}
                </select>
                {/* Show category & escalation info */}
                {form.reasonId && (() => {
                  const r = activeReasons.find((x) => String(x.id) === String(form.reasonId));
                  return r ? (
                    <div className="mt-1.5 flex gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.category}</span>
                      <span className={`px-2 py-0.5 rounded-full ${r.planned ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"}`}>
                        {r.planned ? "Planned" : "Unplanned"}
                      </span>
                      {r.escalation && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Escalation {r.escalationMins}m
                        </span>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>

              <div><Lbl>Operator</Lbl>
                <input value={form.operator} onChange={sf("operator")} className={iC} placeholder="Name / ID" /></div>

              <div><Lbl>Remarks</Lbl>
                <textarea value={form.remarks} onChange={sf("remarks")} className={`${iC} resize-none h-20`} placeholder="Root cause, notes…" /></div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 border-2 border-dashed border-slate-200 rounded-xl text-center p-4">
              <TimerOff className="w-7 h-7 text-slate-300" strokeWidth={1.2} />
              <p className="text-xs text-slate-400 leading-relaxed">
                Select a downtime event from the left to assign a reason code
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0">
        <p className="text-[11px] text-slate-400">
          {selected ? `Event selected: Sr #${selected.srNo}` : "No event selected"}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || !form.reasonId}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors ${
              !selected || !form.reasonId
                ? "bg-rose-300 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200"
            }`}
          >
            <Plus className="w-4 h-4" /> Log Downtime
          </button>
        </div>
      </div>
    </>
  );
};

// ── Quick Quality Form — shows all running models with qty to select & log ─────
const QuickQualityForm = ({ records, qualityDefects, materials, onSave, onClose }) => {
  const activeDefects = qualityDefects.filter((q) => q.status);

  // Group production records by SAP Code — show Part Name as label
  const modelGroups = useMemo(() => {
    const map = {};
    records
      .filter((r) => r.state === "Production")
      .forEach((r) => {
        const sap = r.sapCode || extractSapCode(r.model);
        const mat = getMaterialByModel(materials, r.model);
        // Key: Part Name (master) > full program name > SAP code
        const key = mat?.partName || r.model || sap;
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            model: r.model,
            sapCode: sap,
            mat,
            qty: 0, events: 0, shift: r.shift,
          };
        }
        map[key].qty    += r.qty ?? 0;
        map[key].events += 1;
      });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [records, materials]);

  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    inspectedQty: "1", defectId: "", rejectedQty: "0",
    disposition: "Rework", inspector: "", remarks: "",
  });
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!selected) { toast.error("Select a model from the list."); return; }
    if (!form.defectId) { toast.error("Select a defect code."); return; }
    const q = activeDefects.find((x) => String(x.id) === String(form.defectId));
    onSave({
      ...form,
      model: selected.model,
      partName: selected.mat?.partName,
      sapCode: selected.mat?.sapCode,
      shift: selected.shift,
      defectCode: q?.qCode, defectName: q?.defectName, severity: q?.severity,
      loggedAt: new Date().toISOString(),
    });
  };

  return (
    <>
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT — running model list */}
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
              <ShieldCheck className="w-8 h-8 opacity-30" strokeWidth={1.2} />
              <p className="text-xs text-slate-400">No production records found</p>
              <p className="text-[11px] text-slate-300">Load data using the Query button first</p>
            </div>
          ) : (
            modelGroups.map((g, idx) => {
              const isSelected = selected?.model === g.model;
              return (
                <button
                  key={idx}
                  onClick={() => setSelected(g)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-violet-500 bg-violet-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      {g.mat ? (
                        <>
                          <p className="text-xs font-bold text-slate-800 truncate">{g.mat.partName}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">{g.model}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-mono text-slate-700 truncate">{g.model}</p>
                          <p className="text-[10px] text-rose-400 italic">Not in Material Config</p>
                        </>
                      )}
                    </div>
                    {/* Qty badge */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold font-mono text-blue-600 leading-none">{g.qty}</p>
                      <p className="text-[9px] text-slate-400">{g.events} events</p>
                    </div>
                  </div>

                  {g.mat && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        SAP {g.mat.sapCode}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">
                        {g.mat.definedComponentCycleTime}s comp CT
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                        {g.mat.drawingNumber} {g.mat.drawingRevision}
                      </span>
                      <span className="text-[9px] text-slate-400 ml-auto">{g.shift}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT — quality entry form */}
        <div className="w-64 shrink-0 p-4 flex flex-col gap-3 overflow-auto">
          {selected ? (
            <>
              {/* Selected model summary */}
              <div className="bg-violet-50 rounded-xl border border-violet-200 p-3 shrink-0">
                <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-1.5">
                  Selected Model
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {selected.mat?.partName || selected.model}
                </p>
                {selected.mat && (
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">{selected.mat.sapCode}</p>
                )}
                <div className="flex gap-3 mt-1.5 text-[11px]">
                  <span className="font-bold text-blue-600">{selected.qty} qty produced</span>
                  {selected.mat && (
                    <span className="text-violet-600">{selected.mat.definedComponentCycleTime}s</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><Lbl>Inspected Qty</Lbl>
                  <input type="number" value={form.inspectedQty} onChange={sf("inspectedQty")} className={iC} min={1} /></div>
                <div><Lbl>Rejected Qty</Lbl>
                  <input type="number" value={form.rejectedQty} onChange={sf("rejectedQty")} className={iC} min={0} /></div>
              </div>

              <div>
                <Lbl>Defect Code <span className="text-rose-500">*</span></Lbl>
                <select value={form.defectId} onChange={sf("defectId")} className={iC}>
                  <option value="">Select Defect</option>
                  {activeDefects.map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.qCode}] {q.defectName}
                    </option>
                  ))}
                </select>
                {form.defectId && (() => {
                  const q = activeDefects.find((x) => String(x.id) === String(form.defectId));
                  return q ? (
                    <div className="mt-1.5 flex gap-1.5 text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full ${
                        q.severity === "Critical" ? "bg-rose-100 text-rose-700"
                          : q.severity === "Major" ? "bg-orange-50 text-orange-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>{q.severity}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{q.type}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              <div><Lbl>Disposition</Lbl>
                <select value={form.disposition} onChange={sf("disposition")} className={iC}>
                  {["Rework","Rejection","Hold","Accept"].map((d) => <option key={d}>{d}</option>)}
                </select></div>

              <div><Lbl>Inspector</Lbl>
                <input value={form.inspector} onChange={sf("inspector")} className={iC} placeholder="Name / ID" /></div>

              <div><Lbl>Remarks</Lbl>
                <textarea value={form.remarks} onChange={sf("remarks")} className={`${iC} resize-none h-16`} placeholder="Observations, notes…" /></div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 border-2 border-dashed border-slate-200 rounded-xl text-center p-4">
              <ShieldCheck className="w-7 h-7 text-slate-300" strokeWidth={1.2} />
              <p className="text-xs text-slate-400 leading-relaxed">
                Select a running model from the left to log a quality entry
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0">
        <p className="text-[11px] text-slate-400">
          {selected ? `Model: ${selected.mat?.partName || selected.model}` : "No model selected"}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || !form.defectId}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-colors ${
              !selected || !form.defectId
                ? "bg-violet-300 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-700 shadow-sm shadow-violet-200"
            }`}
          >
            <Plus className="w-4 h-4" /> Log Quality
          </button>
        </div>
      </div>
    </>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const PartProcessDashboard = () => {
  const navigate = useNavigate();
  const time = useClock();
  const dispatch        = useDispatch();
  const materials       = useSelector(selectMaterials);
  const downtimeReasons = useSelector(selectDowntimeReasons);
  const qualityDefects  = useSelector(selectQualityDefects);
  const shifts          = useSelector(selectShifts).filter(s => s.status);

  const [records, setRecords]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [loadProgress, setLoadProgress]   = useState({ loaded: 0, total: 0 });
  const [downtimeModal, setDowntimeModal] = useState(false);
  const [qualityModal, setQualityModal]   = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // ── Date & Shift selection ────────────────────────────────────────────────
  const _todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  };
  const [selectedDate, setSelectedDate] = useState(_todayStr());
  const isToday = selectedDate === _todayStr();

  // Default to the currently active shift (null = All Shifts)
  const [selectedShift, setSelectedShift] = useState(
    () => shifts.find(isActiveShift) ?? null
  );

  // ── Load ALL pages for a date from FactoryOS API ──────────────────────────
  // Always fetches D and D+1 so overnight Shift 2 (20:00 D → 08:00 D+1) has
  // complete data without a second trigger. Records are tagged with eventDate.
  const loadForDate = useCallback(async (dateStr) => {
    setLoading(true);
    setRecords([]);
    setLoadProgress({ loaded: 0, total: 0 });

    const _p2 = n => String(n).padStart(2, "0");
    const _nextDay = (s) => {
      const d = new Date(s + "T00:00:00");
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${_p2(d.getMonth()+1)}-${_p2(d.getDate())}`;
    };

    const datesToFetch = [dateStr, _nextDay(dateStr)];
    const allTagged = [];

    try {
      for (const date of datesToFetch) {
        let url = `${FACTORY_OS_BASE}/monitoring/daily-summary/${FACTORY_MACHINE_ID}/?date=${date}&page=1`;
        while (url) {
          const res = await fosClient.get(url);
          const d   = res.data;
          // Tag each raw record with its calendar date before mapping
          (d.results ?? []).forEach(r => allTagged.push({ ...r, _eventDate: date }));
          setLoadProgress({ loaded: allTagged.length, total: d.count || allTagged.length });
          url = d.next || null;
          if (allTagged.length >= 8000) break;
        }
      }

      if (allTagged.length > 0) {
        const mapped = allTagged.map((r, i) => ({
          ...mapFOsRecord(r, i),
          eventDate: r._eventDate,   // "YYYY-MM-DD" of the calendar day this record belongs to
        }));
        setRecords(enrichRecords(mapped));
      } else {
        setRecords([]);
      }
    } catch {
      setRecords([]);
      toast.error("Failed to load production data.");
    } finally {
      setLoading(false);
      setLoadProgress({ loaded: 0, total: 0 });
    }
  }, []);

  // Convenience alias used by the refresh button
  const loadToday = useCallback(() => loadForDate(selectedDate), [loadForDate, selectedDate]);

  // Reload whenever selected date changes
  useEffect(() => { loadForDate(selectedDate); }, [selectedDate, loadForDate]);

  // ── Compute KPIs from API records ─────────────────────────────────────────
  const kpi = useMemo(() => {
    const prod   = records.filter((r) => r.state === "Production");
    const down   = records.filter((r) => r.state === "Downtime");
    const totalQty  = prod.reduce((s, r) => s + (r.qty ?? 0), 0);
    // Count GOOD parts by summing qty (not record count) to match totalQty metric
    const goodCount = prod.filter((r) => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0);
    const badCount  = Math.max(0, totalQty - goodCount);
    const passRate  = totalQty > 0 ? Math.round((goodCount / totalQty) * 100) : 0;
    const downSecs  = down.reduce((s, r) => s + parseDurSecs(r.duration), 0);
    const downMins  = parseFloat(secsToMins(downSecs));

    // Latest record
    const latest    = records[0];
    const isRunning = latest?.state === "Production";
    const curModel  = prod[0]?.model ?? null;

    // Avg cycle time in seconds (this is the Sheet CT — actual machine cycle time)
    const avgCycleSecs = prod.length > 0
      ? Math.round(prod.reduce((s, r) => s + parseDurSecs(r.duration), 0) / prod.length)
      : 0;

    // OEE (A × P × Q simplified)
    const plannedMins = 480; // 8-hour shift
    const A = plannedMins > 0 ? Math.min(100, Math.round(((plannedMins - downMins) / plannedMins) * 100)) : 100;
    const Q = passRate;
    const P = 80; // placeholder until ideal cycle time is known
    const OEE = Math.round((A / 100) * (P / 100) * (Q / 100) * 100);

    // Total component qty (punching parts expand by sheet × comp/sheet × machine count)
    const totalComponentQty = prod.reduce((s, r) => {
      const mat = getMaterialByModel(materials, r.model);
      return s + componentQtyFromMaster(r.qty ?? 0, mat);
    }, 0);

    // Model breakdown — use getMaterialByModel (handles strip-zero + part-name fallback)
    const modelMap = {};
    prod.forEach((r) => {
      if (!r.model && !r.sapCode) return;
      const mat = getMaterialByModel(materials, r.model);
      const sap = r.sapCode || extractSapCode(r.model);
      const key = mat?.partName || r.model || sap || "Unknown";
      modelMap[key] = (modelMap[key] || 0) + (r.qty ?? 0);
    });

    // Status timeline — only build when we have real data
    const runMinsVal  = Math.round(prod.reduce((s, r) => s + parseDurSecs(r.duration), 0) / 60);
    const downMinsVal = Math.round(downSecs / 60);
    const timeline = records.length === 0 ? [] : [
      runMinsVal  > 0 ? { label: "Running",  value: runMinsVal,  color: "#22c55e" } : null,
      downMinsVal > 0 ? { label: "Downtime", value: downMinsVal, color: "#ef4444" } : null,
    ].filter(Boolean);

    const runTimeMins  = Math.round(prod.reduce((s, r) => s + parseDurSecs(r.duration), 0) / 60);
    const downTimeMins = Math.round(downSecs / 60);

    return { isRunning, curModel, totalQty, totalComponentQty: Math.round(totalComponentQty), goodCount, badCount, passRate, downMins, avgCycleSecs, OEE, A, P, Q, modelMap, timeline, runTimeMins, downTimeMins };
  }, [records, materials]);

  // ── Date helpers (dashboard-level) ────────────────────────────────────────
  const _dashP2 = n => String(n).padStart(2, "0");
  const _nextDate = (s) => {
    const d = new Date(s + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${_dashP2(d.getMonth()+1)}-${_dashP2(d.getDate())}`;
  };

  // ── Shift-filtered records — MUST be before oeeTimeSeries and activeModelMap ─
  // Filters by CALENDAR DATE + TIME so overnight Shift 2 (20:00 D → 08:00 D+1)
  // gets exactly D's 20:00-23:59 records + D+1's 00:00-08:00 records.
  const shiftRecords = useMemo(() => {
    if (!selectedShift) return records;
    if (!selectedShift.startTime || !selectedShift.endTime) return records;
    const ssm    = toMins(selectedShift.startTime);
    const sem    = toMins(selectedShift.endTime);
    const isON   = sem <= ssm;
    const nextDt = isON ? _nextDate(selectedDate) : null;

    return records.filter(r => {
      if (!r.startTime) return false;
      const t = toMins(r.startTime);
      if (!isON) {
        // Day shift: must be on selectedDate, time in [ssm, sem)
        if (r.eventDate && r.eventDate !== selectedDate) return false;
        return t >= ssm && t < sem;
      }
      // Overnight: D records with t >= ssm, D+1 records with t < sem
      if (r.eventDate) {
        if (r.eventDate === selectedDate) return t >= ssm;
        if (r.eventDate === nextDt)       return t < sem;
        return false;
      }
      // No date tag (sample/demo data) — time-only fallback
      return t >= ssm || t < sem;
    });
  // eslint-disable-next-line
  }, [records, selectedShift, selectedDate]);

  // ── Timeline always shows exactly ONE shift ───────────────────────────────────
  // Priority: (1) selected shift, (2) currently-active shift, (3) most-recorded shift
  const timelineShift = useMemo(() => {
    if (selectedShift) return selectedShift;
    // Auto-detect active shift from config
    const active = shifts.find(isActiveShift);
    if (active) return active;
    // Fallback: whichever shift has the most records
    const counts = {};
    records.forEach(r => { if (r.shift) counts[r.shift] = (counts[r.shift] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return top ? (shifts.find(s => s.shiftName === top) || null) : null;
  }, [selectedShift, shifts, records]);

  const timelineRecords = useMemo(() => {
    let base;
    if (timelineShift && timelineShift.startTime && timelineShift.endTime) {
      const ssm    = toMins(timelineShift.startTime);
      const sem    = toMins(timelineShift.endTime);
      const isON   = sem <= ssm;
      const nextDt = isON ? _nextDate(selectedDate) : null;
      base = records.filter(r => {
        if (!r.startTime) return false;
        const t = toMins(r.startTime);
        if (!isON) {
          if (r.eventDate && r.eventDate !== selectedDate) return false;
          return t >= ssm && t < sem;
        }
        if (r.eventDate) {
          if (r.eventDate === selectedDate) return t >= ssm;
          if (r.eventDate === nextDt)       return t < sem;
          return false;
        }
        return t >= ssm || t < sem;
      });
    } else {
      base = shiftRecords;
    }
    return base.map(r => ({ ...r, state: r.effectiveState || r.state }));
  // eslint-disable-next-line
  }, [records, timelineShift, shiftRecords, selectedDate]);

  // ── Changeover analysis ────────────────────────────────────────────────────
  // Pass shiftStartMins so overnight shifts (Shift 2: 20:00→08:00) sort correctly
  // and the 23:36→00:07 midnight bug is eliminated.
  const shiftStartMins = selectedShift ? toMins(selectedShift.startTime) : null;
  const changeovers    = useMemo(
    () => detectChangeovers(shiftRecords, undefined, shiftStartMins),
    [shiftRecords, shiftStartMins], // eslint-disable-line
  );
  const coStats        = useMemo(() => changeoverStats(changeovers), [changeovers]);
  const shiftKpi = useMemo(() => {
    const zero = { qty:0, good:0, bad:0, passRate:0, downCount:0, downMins:0, runTimeMins:0, avgCycleSecs:0, A:0, P:0, Q:0, OEE:0, pUnverified:false, qUnverified:false };

    const prod = shiftRecords.filter(r => r.state === "Production");
    const down = shiftRecords.filter(r => r.state === "Downtime");

    // No production events at all → shift hasn't started or no data
    if (prod.length === 0 && down.length === 0) return zero;

    const qty      = prod.reduce((s, r) => s + (r.qty ?? 0), 0);
    const good     = prod.filter(r => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0);
    const downSecs = down.reduce((s, r) => s + parseDurSecs(r.duration), 0);
    const runSecs  = prod.reduce((s, r) => s + parseDurSecs(r.duration), 0);
    const downMins = Math.round(downSecs / 60);
    const runTimeMins = Math.round(runSecs / 60);

    // Only compute OEE if there is actual production
    if (qty === 0) {
      return { ...zero, downCount: down.length, downMins };
    }

    const plannedMins  = selectedShift ? Math.max(1, shiftDurationMins(selectedShift)) : 480;
    const plannedSecs  = plannedMins * 60;
    const avgCycleSecs = prod.length > 0 ? Math.round(runSecs / prod.length) : 0;

    // ── A: Availability = (Planned − Downtime) / Planned ─────────────────────
    const A = Math.min(100, Math.max(0, Math.round(((plannedMins - downMins) / plannedMins) * 100)));

    // ── P: Performance = (Qty × Ideal Cycle) / Net Operating Time ────────────
    // Ideal cycle comes from master config (definedComponentCycleTime, seconds).
    // NOTE: this is a per-COMPONENT defined time, while qty here is the machine
    // sheet count — confirm whether Performance should use a per-sheet target.
    // If no master entry exists fall back to actual average cycle as 100 % perf.
    const dominantModel  = shiftRecords.filter(r => r.state === "Production" && r.model)
      .reduce((acc, r) => { acc[r.model] = (acc[r.model] || 0) + (r.qty ?? 0); return acc; }, {});
    const topModel       = Object.entries(dominantModel).sort((a, b) => b[1] - a[1])[0]?.[0];
    const masterEntry    = topModel ? getMaterialByModel(materials, topModel) : null;
    const idealCycleSecs = masterEntry?.definedComponentCycleTime > 0 ? masterEntry.definedComponentCycleTime : null;
    const netSecs        = Math.max(1, plannedSecs - downSecs);
    const P = idealCycleSecs
      ? Math.min(100, Math.max(0, Math.round(((qty * idealCycleSecs) / netSecs) * 100)))
      : 100; // No standard cycle → P unknown, flag as 100 to avoid hiding A & Q

    // ── Q: Quality = Good / Total ─────────────────────────────────────────────
    // If quality field is missing on all records, fall back to 100 (unverified).
    const hasQualityData = prod.some(r => r.quality != null && r.quality !== "");
    const Q = hasQualityData && qty > 0
      ? Math.min(100, Math.round((good / qty) * 100))
      : 100;

    const OEE = Math.round((A / 100) * (P / 100) * (Q / 100) * 100);

    const componentQty = Math.round(
      prod.reduce((s, r) => {
        const mat = getMaterialByModel(materials, r.model);
        return s + componentQtyFromMaster(r.qty ?? 0, mat);
      }, 0)
    );

    return {
      qty, good, componentQty,
      bad:           Math.max(0, qty - good),
      passRate:      Math.round((good / qty) * 100),
      downCount:     down.length,
      downMins,
      runTimeMins,
      avgCycleSecs,
      A, P, Q, OEE,
      pUnverified:   !idealCycleSecs,   // true when no std cycle in master config
      qUnverified:   !hasQualityData,   // true when scrap sensor not connected
    };
  }, [shiftRecords, selectedShift, materials]);

  // Live shift progress (recalculates every second via useClock)
  const shiftProgress = useMemo(() => {
    if (!selectedShift || !isToday) return null;
    const elapsed = shiftElapsedMins(selectedShift);
    const total   = shiftDurationMins(selectedShift);
    const pct     = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
    const rem     = Math.max(0, total - elapsed);
    return { elapsed, total, pct, remaining: `${p2(Math.floor(rem / 60))}h ${p2(rem % 60)}m` };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShift, isToday, time]);

  // ── OEE time-series (30-min buckets) ────────────────────────────────────────
  const oeeTimeSeries = useMemo(() => {
    const p2 = (n) => String(n).padStart(2, "0");
    const toMins = (hhmm) => {
      if (!hhmm) return 0;
      const [h, m] = hhmm.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    // Resolve defined cycle time from materials (avoids referencing curMat before init)
    const mat = kpi.curModel ? getMaterialByModel(materials, kpi.curModel) : null;
    const defCT = mat?.definedComponentCycleTime || 45;

    // Use shift-filtered records when a shift is selected
    const src = shiftRecords;
    if (!src.length) return { labels: [], oee: [], a: [], p: [], q: [] };

    const allMins = src
      .filter((r) => r.startTime)
      .map((r) => toMins(r.startTime));

    const startMins = Math.min(...allMins, 8 * 60);
    const endMins   = Math.max(...allMins, startMins + 60);

    const labels = [];
    const oeeArr = [], aArr = [], pArr = [], qArr = [];

    for (let t = startMins; t <= endMins; t += 30) {
      labels.push(`${p2(Math.floor(t / 60))}:${p2(t % 60)}`);

      const upTo = src.filter((r) => r.startTime && toMins(r.startTime) <= t);
      if (!upTo.length) { oeeArr.push(0); aArr.push(0); pArr.push(0); qArr.push(100); continue; }

      const prod  = upTo.filter((r) => r.state === "Production");
      const down  = upTo.filter((r) => r.state === "Downtime");
      const qty   = prod.reduce((s, r) => s + (r.qty ?? 0), 0);
      const good  = prod.filter((r) => r.quality === "GOOD").reduce((s, r) => s + (r.qty ?? 0), 0);
      const dSecs = down.reduce((s, r) => s + parseDurSecs(r.duration), 0);

      const elapsedSecs = Math.max((t - startMins) * 60, 1);
      const A = Math.max(0, Math.min(100, ((elapsedSecs - dSecs) / elapsedSecs) * 100));
      const runS = Math.max(0, elapsedSecs - dSecs);
      const P = runS > 0 ? Math.min(100, ((qty * defCT) / runS) * 100) : 0;
      const Q = qty > 0 ? Math.min(100, (good / qty) * 100) : 100;
      const oeeV = (A / 100) * (P / 100) * (Q / 100) * 100;

      oeeArr.push(Math.round(oeeV * 10) / 10);
      aArr.push(Math.round(A * 10) / 10);
      pArr.push(Math.round(P * 10) / 10);
      qArr.push(Math.round(Q * 10) / 10);
    }

    return { labels, oee: oeeArr, a: aArr, p: pArr, q: qArr };
  // Use shiftRecords when a shift is selected so the chart shows that shift only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftRecords, kpi, materials]);

  // Model chart — keyed on PART NAME (resolved from master config via SAP Code)
  const CHART_COLORS = ["#3b82f6","#8b5cf6","#22c55e","#f59e0b","#06b6d4","#e879f9","#fb923c"];
  const activeModelMap = useMemo(() => {
    const src = selectedShift ? shiftRecords : records;
    const map = {};
    src.filter(r => r.state === "Production").forEach(r => {
      if (!r.model && !r.sapCode) return;
      // Full fallback: exact SAP → strip-zero SAP → number-in-partName
      const mat = getMaterialByModel(materials, r.model);
      const sap = r.sapCode || extractSapCode(r.model);
      const key = mat?.partName || r.model || sap || "Unknown";
      // Component count (punching parts expand by sheet × comp/sheet × machine count)
      map[key] = (map[key] || 0) + componentQtyFromMaster(r.qty ?? 0, mat);
    });
    return map;
  }, [shiftRecords, records, selectedShift, materials]);
  const modelLabels = Object.keys(activeModelMap);
  const modelValues = Object.values(activeModelMap);

  // Wrap long part names into multi-line labels (3 words per line)
  const wrapLabel = (name) => {
    const words = String(name).split(" ");
    if (words.length <= 3) return name;
    const lines = [];
    for (let i = 0; i < words.length; i += 3) lines.push(words.slice(i, i + 3).join(" "));
    return lines; // Chart.js renders array as multi-line label
  };

  const modelChartData = useMemo(() => ({
    labels: modelLabels.map(wrapLabel),
    datasets: [{
      data: modelValues,
      backgroundColor: CHART_COLORS.slice(0, modelLabels.length),
      borderWidth: 0,
      borderRadius: 5,
    }],
  }), [modelLabels.join(), modelValues.join()]);

  const modelChartOptions = useMemo(() => ({
    // Vertical bar — X = model name, Y = production count
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
          // Show full original name in tooltip title
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
          minRotation: 0,
          autoSkip: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0,0,0,0.06)" },
        title: { display: true, text: "Components Produced", font: { size: 10 }, color: "#94a3b8" },
        ticks: { font: { size: 10 }, color: "#94a3b8", stepSize: 1 },
      },
    },
  }), []);

  const prodPct = kpi.totalQty > 0 ? Math.min(100, Math.round((kpi.totalQty / 500) * 100)) : 0;
  const totalProdRecords = records.filter((r) => r.state === "Production").length;
  // Enrich with material info
  const curMat = kpi.curModel ? getMaterialByModel(materials, kpi.curModel) : null;
  // Component CT for the current model (uses live Sheet CT = avg machine cycle)
  const curComponentCT = componentCTFromMaster(kpi.avgCycleSecs, curMat);

  // ── Display values — all shift-scoped when a shift is selected ───────────────
  const displayQty          = selectedShift ? shiftKpi.qty           : kpi.totalQty;
  const displayComponentQty = selectedShift ? (shiftKpi.componentQty ?? shiftKpi.qty) : kpi.totalComponentQty;
  const displayGood = selectedShift ? shiftKpi.good     : kpi.goodCount;
  const displayBad  = selectedShift ? shiftKpi.bad      : kpi.badCount;
  const passR       = selectedShift ? shiftKpi.passRate : kpi.passRate;
  const dMins       = selectedShift ? shiftKpi.downMins : kpi.downMins;
  // OEE — shift-scoped (MUST be before OEE_ITEMS)
  const activeOEE        = selectedShift ? shiftKpi.OEE        : kpi.OEE;
  const activeA          = selectedShift ? shiftKpi.A          : kpi.A;
  const activeP          = selectedShift ? shiftKpi.P          : kpi.P;
  const activeQ          = selectedShift ? shiftKpi.Q          : kpi.Q;
  const activePUnverified = selectedShift ? shiftKpi.pUnverified : false;
  const activeQUnverified = selectedShift ? shiftKpi.qUnverified : false;

  // OEE items array (uses activeOEE/A/P/Q — declared above)
  const OEE_ITEMS = [
    { label: "OEE", value: activeOEE, desc: "Overall Effectiveness" },
    { label: "A",   value: activeA,   desc: "Availability" },
    { label: "P",   value: activeP,   desc: "Performance" },
    { label: "Q",   value: activeQ,   desc: "Quality" },
  ];

  // ── OEE Line Chart data ────────────────────────────────────────────────────
  const oeeLineData = useMemo(() => ({
    labels: oeeTimeSeries.labels,
    datasets: [
      {
        label: "OEE",
        data: oeeTimeSeries.oee,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.10)",
        fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
        order: 4,
      },
      {
        label: "Availability",
        data: oeeTimeSeries.a,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.06)",
        fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
        order: 1,
      },
      {
        label: "Performance",
        data: oeeTimeSeries.p,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245,158,11,0.06)",
        fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
        order: 2,
      },
      {
        label: "Quality",
        data: oeeTimeSeries.q,
        borderColor: "#a78bfa",
        backgroundColor: "rgba(167,139,250,0.06)",
        fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
        order: 3,
      },
    ],
  }), [oeeTimeSeries]);

  const oeeLineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true, position: "top", align: "center",
        labels: { usePointStyle: true, pointStyle: "circle", font: { size: 11 }, padding: 20, color: "#475569" },
      },
      tooltip: {
        backgroundColor: "#fff", titleColor: "#374151", bodyColor: "#374151",
        borderColor: "#e5e7eb", borderWidth: 1,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(148,163,184,0.1)" },
        ticks: { font: { size: 10 }, color: "#94a3b8", maxTicksLimit: 14 },
      },
      y: {
        beginAtZero: true, max: 110,
        grid: { color: "rgba(148,163,184,0.08)" },
        ticks: {
          font: { size: 10 }, color: "#94a3b8", stepSize: 20,
          callback: (v) => v + "%",
        },
      },
    },
  }), []);

  const overviewRows = [
    { label: "OEE", value: `${Number(activeOEE || 0).toFixed(1)}%`, color: oeeColor(activeOEE) },
    { label: "Availability", value: `${Number(activeA || 0).toFixed(1)}%`, color: oeeColor(activeA) },
    { label: "Performance", value: `${Number(activeP || 0).toFixed(0)}%`, color: "#111827" },
    { label: "Quality", value: `${Number(kpi.Q || 0).toFixed(2)}%`, color: kpi.Q >= 95 ? "#008236" : oeeColor(kpi.Q) },
    { label: "Good Parts", value: kpi.goodCount, color: "#0069b4" },
    { label: "NG Parts", value: kpi.badCount, color: "#111827" },
    { label: "Model", value: kpi.curModel || curMat?.partName || "N/A", color: "#111827" },
  ];

  if (!showDashboard) {
    return (
      <div className="h-full bg-slate-100 overflow-auto p-3 sm:p-6">
        <div className="w-full max-w-[380px] bg-white border border-blue-500 rounded-md shadow-sm overflow-hidden">
          <div className="bg-slate-200/80 border-b border-slate-300">
            <div className="px-4 pt-4 pb-3 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-black leading-none">Part Process</h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  {curMat?.partName || kpi.curModel || "Production Monitoring"}
                </p>
                <div className="mt-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    max={_todayStr()}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="text-[11px] font-mono text-slate-600 bg-transparent outline-none border-none cursor-pointer"
                  />
                </div>
              </div>
              <span className={`px-3 py-1 rounded border text-[10px] font-extrabold tracking-wider ${kpi.isRunning ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-rose-500 bg-rose-50 text-rose-600"}`}>
                · {kpi.isRunning ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDashboard(true)}
              className="h-24 w-full flex items-center justify-center transition-colors hover:bg-slate-300/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/30"
              aria-label="Open dashboard"
            >
              <div className="relative">
                <PackageOpen className="w-14 h-14 text-slate-300" strokeWidth={1.4} />
                <span className={`absolute -right-3 top-1 h-2.5 w-2.5 rounded-full ${kpi.isRunning ? "bg-emerald-500" : "bg-rose-500"}`} />
                <span className="absolute -right-1 top-4 h-1.5 w-7 rounded-full bg-slate-300" />
                <span className="absolute left-3 bottom-1 h-3 w-3 rounded-full border border-slate-300 bg-slate-100" />
                <span className="absolute left-9 bottom-1 h-3 w-3 rounded-full border border-slate-300 bg-slate-100" />
              </div>
            </button>
          </div>

          <div className="px-4 py-3 bg-white">
            {overviewRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-slate-200 py-1.5 last:border-b-0">
                <span className="text-[13px] text-slate-700">{row.label}</span>
                <span className="text-[14px] font-extrabold font-mono" style={{ color: row.color }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 border-t border-slate-300 bg-slate-100">
            <button
              type="button"
              onClick={() => setShowDashboard(true)}
              className="h-12 flex items-center justify-center border-r border-slate-300 text-[11px] font-extrabold tracking-wider text-blue-700 hover:bg-blue-50 transition-colors"
            >
              DASHBOARD
            </button>
            <button
              type="button"
              onClick={() => navigate("/part-process/production-report")}
              className="h-12 flex items-center justify-center border-r border-slate-300 text-center text-[10px] font-extrabold leading-tight tracking-wider text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              PRODUCTION<br />REPORT
            </button>
            <button
              type="button"
              onClick={() => navigate("/part-process/quality-report")}
              className="h-12 flex items-center justify-center text-center text-[10px] font-extrabold leading-tight tracking-wider text-amber-600 hover:bg-amber-50 transition-colors"
            >
              QUALITY<br />REPORT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">

      {/* ══════════ STICKY HEADER ══════════ */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
        {/* Loading progress bar */}
        {loading && loadProgress.total > 0 && (
          <div className="bg-blue-600 shrink-0">
            <div className="flex items-center justify-between px-5 py-1 text-[11px] text-white/80">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading complete shift data…&nbsp;
                <span className="font-bold text-white font-mono">{loadProgress.loaded.toLocaleString()}</span>
                <span className="opacity-60">of</span>
                <span className="font-bold text-white font-mono">{loadProgress.total.toLocaleString()}</span>
                records
              </span>
              <span className="font-bold text-white font-mono">
                {loadProgress.total > 0 ? Math.round((loadProgress.loaded / loadProgress.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-0.5 bg-blue-500">
              <div
                className="h-full bg-white/70 transition-all duration-300"
                style={{ width: `${loadProgress.total > 0 ? (loadProgress.loaded / loadProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap">
          {/* Status + Name */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
              <Cpu className="w-4 h-4 text-slate-500" />
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${kpi.isRunning ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-none">Part Process</p>
              <span className={`text-[10px] font-semibold ${kpi.isRunning ? "text-emerald-600" : "text-rose-500"}`}>
                {loading ? "Loading…" : kpi.isRunning ? "● Running" : "■ Stopped"}
              </span>
            </div>
          </div>

          {kpi.curModel && (
            <>
              <div className="w-px h-8 bg-slate-200 mx-1" />
              <div className="text-xs">
                {curMat ? (
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{curMat.partName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{kpi.curModel} · {curMat.drawingNumber} {curMat.drawingRevision}</span>
                  </div>
                ) : (
                  <span className="font-mono text-slate-600">{kpi.curModel}</span>
                )}
              </div>
            </>
          )}

          {/* Nav buttons */}
          <div className="flex gap-2 ml-2 flex-wrap">
            <button onClick={() => navigate("/part-process/hourly-report")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Hourly Report
            </button>
            <button onClick={() => navigate("/part-process/production-report")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800 transition-colors">
              Production Report
            </button>
            <button onClick={() => setDowntimeModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors">
              <TimerOff className="w-3.5 h-3.5" /> Log Downtime
            </button>
            <button onClick={() => setQualityModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">
              <ShieldCheck className="w-3.5 h-3.5" /> Log Quality
            </button>
          </div>

          {/* Right: date picker + clock + refresh */}
          <div className="ml-auto flex items-center gap-2">
            {/* Date selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 transition-colors">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                max={_todayStr()}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="text-xs font-mono text-slate-700 bg-transparent outline-none border-none w-28 cursor-pointer"
              />
            </div>

            {/* Quick jump — Today */}
            {!isToday && (
              <button
                onClick={() => setSelectedDate(_todayStr())}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                Today
              </button>
            )}

            {/* Live clock */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-white">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-bold font-mono tracking-wide">
                {p2(time.getHours())}:{p2(time.getMinutes())}:{p2(time.getSeconds())}
              </span>
            </div>

            {/* Record count badge */}
            {records.length > 0 && !loading && (
              <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 min-w-[60px]">
                <span className="text-sm font-bold font-mono text-slate-700">{records.length.toLocaleString()}</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">records</span>
              </div>
            )}

            {/* Refresh */}
            <button onClick={loadToday} disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              title="Reload complete shift data">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ SCROLLABLE CONTENT ══════════ */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">

        {/* ── SHIFT SELECTOR ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Shift</span>
            </div>

            {/* All Shifts tab */}
            <button
              onClick={() => setSelectedShift(null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                !selectedShift
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Shifts
            </button>

            {/* One tab per configured shift */}
            {shifts.map((s) => {
              const active   = isActiveShift(s) && isToday;
              const selected = selectedShift?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedShift(s)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    selected
                      ? "text-white shadow-sm"
                      : active
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  style={selected ? { backgroundColor: s.color || "#3b82f6", borderColor: s.color || "#3b82f6" } : {}}
                >
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  )}
                  <span>{s.shiftName}</span>
                  <span className="font-normal opacity-70 text-[10px]">
                    {s.startTime}–{s.endTime}
                  </span>
                  {active && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selected ? "bg-white/20" : "bg-emerald-100 text-emerald-700"}`}>
                      NOW
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SHIFT INFO CARD (visible when a shift is selected) ── */}
        {selectedShift && (
          <div className="bg-white rounded-xl border shadow-sm shrink-0 overflow-hidden"
            style={{ borderColor: selectedShift.color || "#e2e8f0" }}>
            <div className="flex items-start gap-4 p-4">
              {/* Shift identity */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedShift.color || "#3b82f6" }} />
                  <p className="text-sm font-bold text-slate-800">{selectedShift.shiftName}</p>
                  <span className="text-[10px] font-semibold text-slate-400 font-mono">[{selectedShift.shiftCode}]</span>
                  {isActiveShift(selectedShift) && isToday && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Now
                    </span>
                  )}
                </div>

                {/* Timing row */}
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span className="font-mono font-semibold text-slate-700">
                    {selectedShift.startTime} → {selectedShift.endTime}
                  </span>
                  <span className="text-slate-300">|</span>
                  {selectedShift.breakStart && (
                    <span>Break: <strong className="text-slate-600">{selectedShift.breakStart}–{selectedShift.breakEnd}</strong></span>
                  )}
                  <span>Tea breaks: <strong className="text-slate-600">{selectedShift.teaBreaks}</strong></span>
                  {selectedShift.weeklyOff?.length > 0 && (
                    <span>Off: <strong className="text-slate-600">{selectedShift.weeklyOff.join(", ")}</strong></span>
                  )}
                </div>

                {/* Shift progress bar (only today + current time inside shift) */}
                {shiftProgress && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Shift Progress</span>
                      <span className="font-bold font-mono" style={{ color: selectedShift.color || "#3b82f6" }}>
                        {shiftProgress.pct}% · {shiftProgress.remaining} remaining
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${shiftProgress.pct}%`, backgroundColor: selectedShift.color || "#3b82f6" }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 font-mono">
                      <span>{selectedShift.startTime}</span>
                      <span>{shiftProgress.elapsed}m elapsed of {shiftProgress.total}m</span>
                      <span>{selectedShift.endTime}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Shift KPI mini-cards */}
              <div className="flex gap-2 shrink-0">
                {[
                  { label: "Qty",      value: shiftKpi.qty,       color: "text-blue-600"    },
                  { label: "Good",     value: shiftKpi.good,      color: "text-emerald-600" },
                  { label: "Downtime", value: `${shiftKpi.downMins}m`, color: "text-rose-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 min-w-[60px]">
                    <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ROW 1: KPI Cards — reflect selected shift when active ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Total Qty — headline shows COMPONENT count; sheet count is secondary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <RingProgress value={displayComponentQty} max={Math.max(displayComponentQty, 500)} color={selectedShift?.color || "#3b82f6"} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold font-mono text-slate-700">
                  {displayComponentQty > 0 ? Math.min(100, Math.round((displayComponentQty / 500) * 100)) : 0}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                {selectedShift ? `${selectedShift.shiftName} Components` : "Components Produced"}
              </p>
              <p className="text-2xl font-bold font-mono text-slate-800">{displayComponentQty.toLocaleString()}</p>
              {displayComponentQty !== displayQty && (
                <p className="text-[11px] font-semibold text-violet-600">
                  {displayQty.toLocaleString()} sheets
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                {selectedShift
                  ? `${shiftRecords.filter(r => r.state === "Production").length} events`
                  : `${totalProdRecords} production events`}
              </p>
            </div>
          </div>

          {/* OEE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <RingProgress value={activeOEE} max={100} color={oeeColor(activeOEE)} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold font-mono" style={{ color: oeeColor(activeOEE) }}>{activeOEE}%</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                {selectedShift ? `${selectedShift.shiftName} OEE` : "OEE"}
              </p>
              <p className="text-2xl font-bold font-mono" style={{ color: oeeColor(activeOEE) }}>{activeOEE}%</p>
              <span className={`text-[10px] font-semibold block mt-0.5 ${activeOEE >= 85 ? "text-emerald-600" : activeOEE >= 65 ? "text-amber-600" : "text-rose-500"}`}>
                {activeOEE >= 85 ? "World Class" : activeOEE >= 65 ? "Acceptable" : "Needs Attention"}
              </span>
            </div>
          </div>

          {/* Quality Split */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
              {selectedShift ? `${selectedShift.shiftName} Quality` : "Quality Split"}
            </p>
            <div className="flex items-end gap-3 mb-2">
              <div>
                <p className="text-xl font-bold font-mono text-emerald-600">{displayGood}</p>
                <p className="text-[10px] text-emerald-500 font-medium">GOOD</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-xl font-bold font-mono text-rose-500">{displayBad}</p>
                <p className="text-[10px] text-rose-400 font-medium">No Data</p>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${passR}%` }} />
              {displayBad > 0 && <div className="h-full bg-rose-400" style={{ width: `${100 - passR}%` }} />}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{passR}% pass rate</p>
          </div>

          {/* Downtime (Idle = subtype) + Changeover */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
              {selectedShift ? `${selectedShift.shiftName} Downtime` : "Downtime"}
            </p>
            <div className="flex items-end gap-2 mb-2 flex-wrap">
              {/* Total downtime */}
              <div>
                <p className={`text-xl font-bold font-mono ${dMins>30?"text-rose-500":"text-amber-600"}`}>{dMins}</p>
                <p className="text-[9px] text-slate-400 font-medium">min total</p>
              </div>
              {/* Subtype breakdown */}
              <div className="flex flex-col gap-0.5 text-[9px] font-semibold pb-0.5">
                <span className="text-rose-500">{shiftRecords.filter(r=>(r.effectiveState||r.state)==="Downtime").length}× brief (&lt;{IDLE_THRESHOLD_MINS}m)</span>
                <span className="text-amber-600">{shiftRecords.filter(r=>(r.effectiveState||r.state)==="Idle").length}× idle (≥{IDLE_THRESHOLD_MINS}m)</span>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              {/* Changeovers */}
              <div className="text-center">
                <p className="text-xl font-bold font-mono text-amber-600">{coStats.count}</p>
                <p className="text-[9px] text-amber-500 font-medium">Changeovers</p>
              </div>
            </div>
            {coStats.overrunMins > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="text-[10px] text-rose-600 font-semibold">
                  {coStats.overrunCount} CO &gt;{STD_CHANGEOVER_MINS}m · {coStats.overrunMins}m loss
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <Timer className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-500">Avg sheet CT: <strong>{selectedShift ? shiftKpi.avgCycleSecs : kpi.avgCycleSecs}s</strong></span>
            </div>
          </div>
        </div>

        {/* ── ROW 2: OEE Line Chart + Production Summary + Setting Parameters ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {/* OEE Line Chart — 2 columns */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">OEE</span>
              {records.length > 0 && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`font-bold ${activeOEE >= 85 ? "text-emerald-600" : activeOEE >= 65 ? "text-amber-600" : "text-rose-500"}`}>
                    {selectedShift ? `${selectedShift.shiftName} OEE` : "Current OEE"}: {activeOEE}%
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400">A:{kpi.A}% · P:{kpi.P}% · Q:{kpi.Q}%</span>
                </div>
              )}
            </div>
            <div className="p-4 flex-1 min-h-80">
              {oeeTimeSeries.labels.length > 1 ? (
                <Line data={oeeLineData} options={oeeLineOptions} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                  <Gauge className="w-8 h-8 opacity-40" strokeWidth={1.2} />
                  <p className="text-xs text-slate-400">Load data to see OEE trend over time</p>
                </div>
              )}
            </div>
          </div>

          {/* Production Summary + Setting Parameters — 1 column */}
          <div className="flex flex-col gap-3">
            {/* Production Summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-3">
                Production Summary
              </p>
              <div className="flex flex-col divide-y divide-slate-100">
                {[
                  { label: "Model Target",       value: modelLabels.length || (shiftRecords.length > 0 ? 1 : "-"), color: "text-slate-600" },
                  { label: "Produced Part Count", value: displayComponentQty.toLocaleString(),   color: "text-blue-600"    },
                  { label: "Accepted Part Count", value: displayGood,  color: "text-emerald-600" },
                  { label: "Rejected Count",      value: displayBad,   color: "text-rose-500"    },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-2.5">
                    <span className="text-[12px] text-slate-500">{label}</span>
                    <span className={`text-sm font-bold font-mono ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Setting Parameters */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-3">
                Setting Parameters
              </p>
              <div className="flex flex-col divide-y divide-slate-100">
                {/* Part Name — full width row with larger text */}
                <div className="py-2.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Part Name</span>
                  <p className="text-sm font-bold text-blue-700 mt-0.5 leading-snug">
                    {curMat?.partName || (kpi.curModel ? (
                      <span className="text-slate-600 text-xs font-normal block">
                        {extractProgramName(kpi.curModel) || kpi.curModel}
                        <span className="block text-[9px] font-bold text-rose-500 mt-0.5">⚠ Master not exist</span>
                      </span>
                    ) : <span className="text-amber-600">N/A</span>)}
                  </p>
                </div>
                {[
                  { label: "Defined Component CT", value: curMat ? `${curMat.definedComponentCycleTime} s` : "N/A" },
                  { label: "Sheet CT (Machine)",   value: kpi.avgCycleSecs > 0 ? `${kpi.avgCycleSecs} s` : "N/A" },
                  { label: "Component CT",         value: curComponentCT != null ? `${curComponentCT} s` : "N/A" },
                  { label: "SAP Code",             value: curMat?.sapCode || extractSapCode(kpi.curModel) || "N/A" },
                  { label: "RunTime/DownTime",     value: (() => {
                      const rt = selectedShift ? shiftKpi.runTimeMins : kpi.runTimeMins;
                      const dt = selectedShift ? shiftKpi.downMins    : kpi.downTimeMins;
                      return (rt > 0 || dt > 0) ? `${rt}/${dt}` : "N/A";
                    })() },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2.5">
                    <span className="text-[12px] text-slate-500">{label}</span>
                    <span className="text-sm font-bold font-mono text-amber-600">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 3: Current model info + Running Summary + Status ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">

          {/* Model breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
              <PackageOpen className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Model Breakdown</span>
            </div>
            <div className="p-3 flex flex-col gap-1.5">
              {modelLabels.length > 0 ? modelLabels.map((m, i) => {
                const count = activeModelMap[m];
                const max   = Math.max(...modelValues, 1);
                // Check if this label came from a master config match
                const masterMatch = materials.some(mat => mat.partName === m);
                return (
                  <div key={m} className={`flex flex-col gap-1 p-2 rounded-lg border transition-all ${masterMatch ? "border-transparent hover:bg-blue-50 hover:border-blue-100" : "border-rose-100 bg-rose-50/40 hover:bg-rose-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className={`text-[11px] font-semibold leading-snug break-words block ${masterMatch ? "text-slate-700" : "text-slate-600"}`}>{m}</span>
                        {!masterMatch && (
                          <span className="text-[9px] font-bold text-rose-500 mt-0.5 block">⚠ Master not exist</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-blue-600 font-mono shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              }) : (
                <div className="flex flex-col items-center gap-2 text-slate-300 py-6">
                  <PackageOpen className="w-8 h-8 opacity-40" strokeWidth={1.2} />
                  <p className="text-xs text-slate-400">No data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Running Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Shift Summary</span>
              {loading && <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-auto" />}
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                { label: selectedShift ? `${selectedShift.shiftName} Records` : "Total Records",
                                          value: shiftRecords.length,     color: "text-slate-700",   bg: "bg-slate-50",   icon: "📋" },
                { label: "Production",     value: shiftRecords.filter(r => r.state === "Production").length,
                                                                            color: "text-blue-600",    bg: "bg-blue-50",    icon: "⚙️" },
                { label: "GOOD Quality",   value: displayGood,             color: "text-emerald-600", bg: "bg-emerald-50", icon: "✅" },
                { label: "Downtime Events",value: shiftKpi.downCount,      color: "text-amber-600",   bg: "bg-amber-50",   icon: "⏸️" },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} rounded-lg p-2.5 flex flex-col gap-1`}>
                  <span className="text-[10px] text-slate-400 font-medium">{item.icon} {item.label}</span>
                  <span className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
            {/* Shift breakdown — driven by Shift Config (selectShifts) */}
            <div className="px-3 pb-3">
              {shifts.map((s) => {
                const shRecords = records.filter((r) => r.shift === s.shiftName && r.state === "Production");
                if (!shRecords.length) return null;
                const compQty = Math.round(
                  shRecords.reduce((sum, r) => sum + componentQtyFromMaster(r.qty ?? 0, getMaterialByModel(materials, r.model)), 0)
                );
                return (
                  <div key={s.id} className="flex items-center justify-between text-[11px] py-1 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || "#94a3b8" }} />
                      {s.shiftName}
                      <span className="text-slate-300 font-mono">{s.startTime}–{s.endTime}</span>
                    </span>
                    <span className="font-bold text-slate-700 font-mono">{compQty.toLocaleString()} comp · {shRecords.length} events</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OEE A·P·Q breakdown cards */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
              <Gauge className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">OEE Breakdown (A · P · Q)</span>
              <span className="ml-auto text-sm font-bold font-mono" style={{ color: activeOEE > 0 ? (activeOEE >= 85 ? "#22c55e" : activeOEE >= 65 ? "#f59e0b" : "#ef4444") : "#94a3b8" }}>
                {activeOEE > 0 ? `${activeOEE}%` : "N/A"}
              </span>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {[
                { label: "Availability",  key: "A", value: activeA,  color: "#22c55e", warn: false },
                { label: "Performance",   key: "P", value: activeP,  color: "#f59e0b", warn: activePUnverified },
                { label: "Quality",       key: "Q", value: activeQ,  color: "#a78bfa", warn: activeQUnverified },
              ].map(({ label, key, value, color, warn }) => (
                <div key={key} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{key}</span>
                    <span className="text-base font-bold font-mono" style={{ color: value > 0 ? color : "#94a3b8" }}>
                      {value > 0 ? `${value}%` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${value}%`, backgroundColor: value > 0 ? color : "#e2e8f0" }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-slate-400">{label}</p>
                    {warn && (
                      <span className="text-[8px] font-bold text-amber-500 bg-amber-50 border border-amber-200 px-1 rounded">
                        no data
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 flex flex-col gap-1.5">
              {[
                { label: "Runtime",   value: `${selectedShift ? (shiftKpi.runTimeMins || 0) : kpi.runTimeMins} min`,  color: "text-emerald-600" },
                { label: "Downtime",  value: `${selectedShift ? (shiftKpi.downMins    || 0) : kpi.downTimeMins} min`, color: "text-rose-500"    },
                { label: "Avg Sheet CT", value: kpi.avgCycleSecs > 0 ? `${kpi.avgCycleSecs}s` : "—",                  color: "text-violet-600"  },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center text-[11px] py-1 border-t border-slate-100">
                  <span className="text-slate-500">{label}</span>
                  <span className={`font-bold font-mono ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── STATUS TIME MAP — always one shift ── */}
        {timelineRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <TimeMap
              records={timelineRecords}
              isToday={isToday}
              shiftName={timelineShift?.shiftName}
              shiftColor={timelineShift?.color}
              shiftStartTime={timelineShift?.startTime}
              shiftEndTime={timelineShift?.endTime}
            />
          </div>
        )}

        {/* ── Model Wise Production Chart ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Model-wise Production (Components)</span>
          </div>
          {/* Vertical bar: fixed height (labels wrap, not rotate) */}
          <div className="h-56">
            {modelLabels.length > 0 ? (
              <Bar data={modelChartData} options={modelChartOptions} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                <BarChart2 className="w-8 h-8 opacity-40" strokeWidth={1.2} />
                <p className="text-xs text-slate-400">No production data for today's shift yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Current Part Info (from Material Config) ── */}
        {curMat && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileImage className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Current Part Details — from Material Config</span>
              <span className="ml-auto text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">SAP: {curMat.sapCode}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
              {[
                { label: "Part Name",       value: curMat.partName,                         bold: true,  color: "text-blue-700" },
                { label: "Category",        value: curMat.category,                         bold: false, color: "text-slate-600" },
                { label: "Defined Comp CT", value: `${curMat.definedComponentCycleTime} s`, bold: true,  color: "text-violet-600" },
                { label: "No of Sheet",     value: curMat.noOfSheet,                        bold: true,  color: "text-emerald-600" },
                { label: "Comp / Sheet",    value: curMat.actualComponentsPerSheet,         bold: true,  color: "text-emerald-600" },
                { label: "Load/Unload",     value: `${curMat.pncLoadingUnloading} s`,       bold: false, color: "text-amber-700" },
                { label: "Drawing No.",     value: curMat.drawingNumber,                    bold: false, color: "text-amber-700" },
                { label: "Rev.",            value: curMat.drawingRevision,                  bold: false, color: "text-amber-600" },
              ].map(({ label, value, bold, color }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                  <p className={`text-xs ${bold ? "font-bold" : "font-medium"} ${color}`}>{value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Log Downtime Modal ── */}
    {downtimeModal && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDowntimeModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[82vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-rose-200 bg-rose-50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-100"><TimerOff className="w-4 h-4 text-rose-600" /></div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Log Downtime Entry</h2>
                <p className="text-[11px] text-slate-400">Select a pending event → assign reason code</p>
              </div>
            </div>
            <button onClick={() => setDowntimeModal(false)} className="p-1.5 rounded-lg hover:bg-rose-100 transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <QuickDowntimeForm
            records={records}
            downtimeReasons={downtimeReasons}
            onSave={(entry) => { dispatch(logDowntimeEntry(entry)); setDowntimeModal(false); toast.success("Downtime logged successfully."); }}
            onClose={() => setDowntimeModal(false)}
          />
        </div>
      </div>
    )}

    {/* ── Log Quality Modal ── */}
    {qualityModal && (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQualityModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[82vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-violet-200 bg-violet-50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-100"><ShieldCheck className="w-4 h-4 text-violet-600" /></div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Log Quality Entry</h2>
                <p className="text-[11px] text-slate-400">Select a running model → fill inspection details</p>
              </div>
            </div>
            <button onClick={() => setQualityModal(false)} className="p-1.5 rounded-lg hover:bg-violet-100 transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <QuickQualityForm
            records={records}
            qualityDefects={qualityDefects}
            materials={materials}
            onSave={(entry) => { dispatch(logQualityEntry(entry)); setQualityModal(false); toast.success("Quality entry logged."); }}
            onClose={() => setQualityModal(false)}
          />
        </div>
      </div>
    )}
    </>
  );
};

export default PartProcessDashboard;