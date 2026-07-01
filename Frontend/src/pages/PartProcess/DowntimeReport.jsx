import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Search, Calendar, Clock, Filter, Loader2, PackageOpen,
  TimerOff, AlertCircle, BarChart2, Download, TrendingDown,
  Activity, ArrowRight, ChevronRight, ListChecks, FileSpreadsheet, FileText,
} from "lucide-react";
import { exportSectionsToExcel, exportMultiSectionPDF } from "../../utils/reportExport.js";
import DateTimePicker from "../../components/ui/DateTimePicker";
import toast from "react-hot-toast";
import axios from "axios";
import { mapDbRecord } from "../../utils/mapDbRecord.js";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";
import {
  enrichRecords, detectChangeovers, changeoverStats,
  parseDurSecs, IDLE_THRESHOLD_MINS, STD_CHANGEOVER_MINS,
} from "../../utils/productionLogic.js";
import {
  selectMaterials, getMaterialByModel, selectShifts,
  getShiftWindow, toMins, selectDowntimeEntries, selectDepartments,
  selectDowntimeReasons,
} from "../../redux/slices/masterConfigSlice";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n) => (n < 10 ? "0" + n : n);
const fmtYMD   = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtAbs   = (ms, timeStr) => ms ? `${fmtYMD(new Date(ms))} ${timeStr||""}`.trim() : timeStr || "—";
const todayStr = () => fmtYMD(new Date());
const offsetDate = (days) => { const d = new Date(); d.setDate(d.getDate()+days); return fmtYMD(d); };
const secsToMins = (s) => (s/60).toFixed(1);
const fmtDur = (dur="00:00:00") => {
  const [h,m,s] = (dur||"00:00:00").split(":").map(Number);
  const total = (h||0)*60 + (m||0) + (s||0)/60;
  if (total >= 60) return `${Math.floor(total/60)}h ${Math.round(total%60)}m`;
  return `${total.toFixed(1)}m`;
};
const extractHHMM = (t) => {
  if (!t) return null;
  const s = String(t);
  if (s.includes("T")) return s.split("T")[1].substring(0,5);
  if (s.length > 10 && s.includes(" ")) return s.split(" ")[1].substring(0,5);
  return s.substring(0,5);
};
const todSecs = (t) => {
  if (!t) return null;
  const s = String(t);
  let tp = s;
  if (s.includes("T")) tp = s.split("T")[1];
  else if (s.length > 10 && s.includes(" ")) tp = s.split(" ")[1];
  const [h,m,sec] = tp.split(":").map(Number);
  if (Number.isNaN(h)||Number.isNaN(m)) return null;
  return h*3600 + m*60 + (sec||0);
};
const resolveShift = (startTime, configShifts) => {
  if (!startTime || !configShifts?.length) return null;
  const hhmm = extractHHMM(startTime);
  if (!hhmm) return null;
  const t = toMins(hhmm);
  return configShifts.find((s) => {
    const s0 = toMins(s.startTime); let e0 = toMins(s.endTime);
    if (e0 <= s0) e0 += 1440;
    const tc = t < s0 ? t + 1440 : t;
    return tc >= s0 && tc < e0;
  }) ?? null;
};

const exportCSV = (rows, changeovers) => {
  const dtRows = rows.map((r) => [
    r.eventId||r.srNo, r.shift,
    r.effectiveState==="Idle" ? "Idle" : "Downtime",
    fmtAbs(r._absMs,r.startTime), fmtAbs(r._absMsEnd,r.endTime),
    r.duration, r.downtimeReason||"Unassigned",
  ]);
  const coRows = changeovers.map((c,i) => [
    `CO-${i+1}`, c.shift||"—", "Changeover",
    c.startTime, c.endTime, `${c.durationMins.toFixed(1)}m`,
    `${c.fromModel} → ${c.toModel}`,
  ]);
  const H = ["Event ID","Shift","Type","Start","End","Duration","Reason / Info"];
  const csv = [H,...dtRows,...coRows].map((r)=>r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = "downtime_report.csv";
  a.click();
};

// Per-section column configs for the Excel/PDF multi-section export — one per
// table visible on screen (Downtime Events, Changeovers, Logged Entries).
const DOWNTIME_COLUMNS = [
  { label: "#",          align: "center", value: (r) => r.idx },
  { label: "Shift",      align: "left",   value: (r) => r.shift },
  { label: "Type",       align: "center", value: (r) => r.type },
  { label: "Start",      align: "left",   value: (r) => r.start },
  { label: "End",        align: "left",   value: (r) => r.end },
  { label: "Duration",   align: "center", value: (r) => r.duration },
  { label: "Reason",     align: "left",   value: (r) => r.reason },
  { label: "Department", align: "left",   value: (r) => r.department },
  { label: "Remarks",    align: "left",   value: (r) => r.remarks },
];
const CHANGEOVER_COLUMNS = [
  { label: "#",          align: "center", value: (r) => r.idx },
  { label: "Shift",      align: "left",   value: (r) => r.shift },
  { label: "From Model", align: "left",   value: (r) => r.fromModel },
  { label: "To Model",   align: "left",   value: (r) => r.toModel },
  { label: "Start",      align: "left",   value: (r) => r.start },
  { label: "End",        align: "left",   value: (r) => r.end },
  { label: "Duration",   align: "center", value: (r) => r.duration },
  { label: "Status",     align: "left",   value: (r) => r.status },
];
const LOGGED_COLUMNS = [
  { label: "#",         align: "center", value: (r) => r.idx },
  { label: "Shift",     align: "left",   value: (r) => r.shift },
  { label: "Type",      align: "center", value: (r) => r.type },
  { label: "Start",     align: "left",   value: (r) => r.start },
  { label: "End",       align: "left",   value: (r) => r.end },
  { label: "Duration",  align: "center", value: (r) => r.duration },
  { label: "Model",     align: "left",   value: (r) => r.model },
  { label: "Reason",    align: "left",   value: (r) => r.reason },
  { label: "Category",  align: "left",   value: (r) => r.category },
  { label: "Remarks",   align: "left",   value: (r) => r.remarks },
  { label: "Logged At", align: "left",   value: (r) => r.loggedAt },
];

// ─── UI Primitives ────────────────────────────────────────────────────────────
const Spinner = ({cls="w-4 h-4"}) => <Loader2 className={`animate-spin ${cls}`}/>;

const KpiCard = ({icon:Icon, label, value, sub, accent}) => {
  const colors = {
    rose:   { bg:"bg-rose-50",   icon:"bg-rose-100 text-rose-500",   val:"text-rose-600",   border:"border-rose-100"  },
    amber:  { bg:"bg-amber-50",  icon:"bg-amber-100 text-amber-500",  val:"text-amber-600",  border:"border-amber-100" },
    violet: { bg:"bg-violet-50", icon:"bg-violet-100 text-violet-500",val:"text-violet-600", border:"border-violet-100"},
    purple: { bg:"bg-purple-50", icon:"bg-purple-100 text-purple-500",val:"text-purple-600", border:"border-purple-100"},
    blue:   { bg:"bg-blue-50",   icon:"bg-blue-100 text-blue-500",    val:"text-blue-600",   border:"border-blue-100"  },
  }[accent] || {};
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${colors.bg} ${colors.border}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colors.icon}`}>
        <Icon className="w-4 h-4"/>
      </div>
      <p className={`text-2xl font-extrabold font-mono tracking-tight ${colors.val}`}>{value}</p>
      <div>
        <p className="text-xs font-semibold text-slate-700 leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const TypeBadge = ({type}) => {
  if (type==="Idle") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-2.5 h-2.5"/> Idle
    </span>
  );
  if (type==="Changeover") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
      <ArrowRight className="w-2.5 h-2.5"/> CO
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
      <TimerOff className="w-2.5 h-2.5"/> DT
    </span>
  );
};

const ShiftPill = ({name}) => (
  <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
    {name||"—"}
  </span>
);

const SectionHeader = ({icon:Icon, title, count, accent="slate", right}) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 text-${accent}-500`}/>
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{title}</span>
      {count != null && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">{count}</span>
      )}
    </div>
    {right}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const PartProcessDowntimeReport = () => {
  const materials           = useSelector(selectMaterials);
  const shifts              = useSelector(selectShifts).filter((s)=>s.status);
  const reduxEntries        = useSelector(selectDowntimeEntries);
  const departments         = useSelector(selectDepartments);
  const downtimeReasons     = useSelector(selectDowntimeReasons);

  // Map reason name → department for fallback when logged entry has no category saved
  const reasonNameToDept = useMemo(()=>{
    const m={};
    downtimeReasons.forEach((r)=>{ if(r.reason && r.department) m[r.reason]=r.department; });
    return m;
  },[downtimeReasons]);

  const [startTime,    setStartTime]    = useState(`${todayStr()} 08:00`);
  const [endTime,      setEndTime]      = useState(`${todayStr()} 20:00`);
  const [loading,      setLoading]      = useState(false);
  const [shiftLoading, setShiftLoading] = useState(null);
  const [ydayLoading,  setYdayLoading]  = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [records,      setRecords]      = useState([]);
  const [appliedRange, setAppliedRange] = useState(null);
  const [activeTab,    setActiveTab]    = useState("downtime"); // "downtime" | "changeover" | "logged"
  const [showAllDT,    setShowAllDT]    = useState(false);
  const [showAllCO,    setShowAllCO]    = useState(false);
  const [dbEntries,    setDbEntries]    = useState([]);   // entries fetched from backend DB
  const donutChartRef  = useRef(null);
  const reasonChartRef = useRef(null);
  const deptChartRef   = useRef(null);

  // Fetch logged entries from DB on mount — backend is source of truth
  const fetchDbEntries = useCallback(async () => {
    try {
      const res = await axios.get(`${PART_PROCESS_API}/downtime-log`, { withCredentials: true });
      setDbEntries(res.data?.data ?? []);
    } catch { /* silent — fallback to Redux entries */ }
  }, []);

  // Fetch on mount
  useEffect(() => { fetchDbEntries(); }, [fetchDbEntries]);

  // Merge DB entries + Redux entries, dedup by eventId (DB entry wins)
  const downtimeEntries = useMemo(() => {
    const map = new Map();
    // DB entries keyed by eventId (these have DB-native field names: EventDate, ShiftName etc.)
    dbEntries.forEach((e) => {
      const key = e.Id ?? e.id;
      map.set(`db-${key}`, {
        id:          e.Id ?? e.id,
        srNo:        e.SrNo,
        eventId:     e.EventId ?? e.eventId ?? null,
        shift:       e.ShiftName ?? e.shift,
        startTime:   e.StartTime ?? e.startTime,
        endTime:     e.EndTime   ?? e.endTime,
        duration:    e.Duration  ?? e.duration,
        model:       e.Model     ?? e.model,
        fromModel:   e.FromModel ?? e.fromModel ?? null,
        isChangeover:!!(e.IsChangeover ?? e.isChangeover),
        reasonCode:  e.ReasonCode ?? e.reasonCode,
        reasonName:  e.ReasonName ?? e.reasonName,
        category:    e.Category  ?? e.category,
        planned:     !!(e.Planned ?? e.planned),
        remarks:     e.Remarks   ?? e.remarks,
        loggedAt:    e.LoggedAt  ?? e.loggedAt,
      });
    });
    // Redux entries fill in anything not yet in DB (just-logged, before server ack)
    reduxEntries.forEach((e) => {
      if (e.eventId && [...map.values()].some((d) => d.eventId && String(d.eventId) === String(e.eventId))) return;
      map.set(`redux-${e.id}`, e);
    });
    return [...map.values()].sort((a,b)=>new Date(b.loggedAt||0)-new Date(a.loggedAt||0));
  }, [dbEntries, reduxEntries]);

  const fetchData = useCallback(async (start, end, setLoadFn) => {
    const startMs = new Date(start.replace(" ","T")+":00").getTime();
    const endMs   = new Date(end.replace(" ","T")+":00").getTime();
    if (Number.isNaN(startMs)||Number.isNaN(endMs)||endMs<=startMs) { toast.error("Invalid time range."); return; }

    setLoadFn(true); setRecords([]);
    try {
      const dayStartSec = shifts.length ? Math.min(...shifts.map((s)=>toMins(s.startTime)))*60 : 0;
      const prodDayOf = (ms) => {
        const d = new Date(ms);
        const tod = d.getHours()*3600+d.getMinutes()*60+d.getSeconds();
        const base = new Date(d); base.setHours(0,0,0,0);
        if (tod<dayStartSec) base.setDate(base.getDate()-1);
        return base;
      };
      const dates = [];
      const cur = prodDayOf(startMs); const last = prodDayOf(endMs-1000);
      while (cur<=last) { dates.push(fmtYMD(cur)); cur.setDate(cur.getDate()+1); }

      const res = await axios.get(`${PART_PROCESS_API}/records-range`, {
        params:{startDate:dates[0], endDate:dates[dates.length-1]},
        withCredentials:true,
      });
      const allRows = res.data?.data ?? [];
      const allMapped = [];

      for (const date of dates) {
        const raw = allRows.filter((r)=>String(r.EventDate).slice(0,10)===date);
        const midnight = new Date(date+"T00:00:00").getTime();
        const mapped = enrichRecords(
          raw.map((r,i)=>({...mapDbRecord(r,i), eventDate:date}))
        ).map((r) => {
          const matched = resolveShift(r.startTime, shifts);
          const tod     = todSecs(r.startTime);
          const todEnd  = todSecs(r.endTime);
          const absMs   = tod===null ? null : midnight+(tod<dayStartSec?86400000:0)+tod*1000;
          let absMsEnd  = null;
          if (absMs!==null&&todEnd!==null) {
            const sm = new Date(absMs); sm.setHours(0,0,0,0);
            absMsEnd = sm.getTime()+todEnd*1000;
            if (absMsEnd<absMs) absMsEnd+=86400000;
          }
          return { ...(matched?{...r,shift:matched.shiftName}:r), _prodDay:date, _absMs:absMs, _absMsEnd:absMsEnd };
        });
        allMapped.push(...mapped);
      }

      const startMin = toMins((start.split(" ")[1]||"00:00").substring(0,5));
      const startDate = fmtYMD(new Date(startMs));
      const startCal = new Date(startMs); startCal.setHours(0,0,0,0);
      const endCal   = new Date(endMs-1000); endCal.setHours(0,0,0,0);

      const filtered = allMapped
        .filter((r)=>r._absMs!==null&&r._absMs>=startMs&&r._absMs<endMs&&parseDurSecs(r.duration)<=86400)
        .sort((a,b)=>b._absMs-a._absMs);

      setRecords(filtered);
      setAppliedRange({ startMin, startDate, crossesMidnight: startCal.getTime()!==endCal.getTime(), days:dates.length });
      toast.success(`${filtered.length} records loaded`);
      // Refresh logged entries from DB so cross-reference is always current
      fetchDbEntries();
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Session expired — please log in again.");
      } else {
        toast.error("Failed to fetch downtime data.");
      }
    }
    finally { setLoadFn(false); }
  }, [shifts]);

  const handleQuery     = () => { if (!startTime||!endTime) { toast.error("Select a time range."); return; } fetchData(startTime,endTime,setLoading); };
  const handleToday     = () => { const s=`${todayStr()} 08:00`,e=`${offsetDate(1)} 08:00`; setStartTime(s);setEndTime(e);fetchData(s,e,setTodayLoading); };
  const handleYesterday = () => { const s=`${offsetDate(-1)} 08:00`,e=`${todayStr()} 08:00`; setStartTime(s);setEndTime(e);fetchData(s,e,setYdayLoading); };
  const handleShiftSelect = (shift) => {
    const curMins = new Date().getHours()*60+new Date().getMinutes();
    const ssm=toMins(shift.startTime),sem=toMins(shift.endTime),isON=sem<=ssm;
    const baseDate = isON&&curMins<sem ? offsetDate(-1) : todayStr();
    const win = getShiftWindow(shift,baseDate); if (!win) return;
    setStartTime(win.startDatetime); setEndTime(win.endDatetime);
    fetchData(win.startDatetime,win.endDatetime,(v)=>setShiftLoading(v?shift.shiftName:null));
  };

  const isAnyLoading = loading||ydayLoading||todayLoading||shiftLoading!==null;

  // ── Derived ────────────────────────────────────────────────────────────────
  const allDT    = useMemo(()=>records.filter((r)=>r.state==="Downtime"),[records]);
  const briefDT  = useMemo(()=>allDT.filter((r)=>(r.effectiveState||r.state)==="Downtime"),[allDT]);
  const idleDT   = useMemo(()=>allDT.filter((r)=>(r.effectiveState||r.state)==="Idle"),[allDT]);

  const changeovers = useMemo(()=>{
    if (!records.length) return [];
    const anchor = appliedRange?.crossesMidnight ? appliedRange.startMin : null;
    return detectChangeovers(records,undefined,anchor);
  },[records,appliedRange]);
  const coSt = useMemo(()=>changeoverStats(changeovers),[changeovers]);

  const totalDTSecs = useMemo(()=>allDT.reduce((s,r)=>s+parseDurSecs(r.duration),0),[allDT]);
  const idleSecs    = useMemo(()=>idleDT.reduce((s,r)=>s+parseDurSecs(r.duration),0),[idleDT]);
  const briefSecs   = useMemo(()=>briefDT.reduce((s,r)=>s+parseDurSecs(r.duration),0),[briefDT]);

  // Primary lookup: eventId (stable DB key)
  const loggedByEventId = useMemo(()=>{
    const map={};
    downtimeEntries.forEach((e)=>{ if(e.eventId) map[String(e.eventId)]=e; });
    return map;
  },[downtimeEntries]);

  // Fallback lookup: startTime "HH:MM:SS" — for entries logged before eventId was saved
  const loggedByStartTime = useMemo(()=>{
    const map={};
    downtimeEntries.forEach((e)=>{
      if(!e.eventId && e.startTime) {
        const key = String(e.startTime).substring(0,8); // "HH:MM:SS"
        map[key]=e;
      }
    });
    return map;
  },[downtimeEntries]);

  // Helper: effective reason for a DT record (logged reason wins over machine reason)
  const effectiveReason = (r) => {
    const logged = (r.eventId && loggedByEventId[String(r.eventId)])
      || loggedByStartTime[String(r.startTime || "").substring(0,8)];
    return logged?.reasonName
      || (r.downtimeReason && r.downtimeReason !== "Assign" ? r.downtimeReason : null)
      || "Unassigned";
  };

  const reasonMap = useMemo(()=>{
    const m={};
    allDT.forEach((r)=>{ const k=effectiveReason(r); m[k]=(m[k]||0)+parseDurSecs(r.duration); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[allDT, loggedByEventId, loggedByStartTime]);

  const shiftMap = useMemo(()=>{
    const m={};
    allDT.forEach((r)=>{ m[r.shift]=(m[r.shift]||0)+parseDurSecs(r.duration); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[allDT]);

  // Department of a DT record — from logged entry's category, or looked up by reason name
  const effectiveDepartment = (r) => {
    const logged = (r.eventId && loggedByEventId[String(r.eventId)])
      || loggedByStartTime[String(r.startTime||"").substring(0,8)];
    if (!logged) return null;
    // category saved at log time; fall back to current config lookup by reasonName
    return logged.category || reasonNameToDept[logged.reasonName] || null;
  };

  const departmentMap = useMemo(()=>{
    const m={};
    allDT.forEach((r)=>{
      const dept = effectiveDepartment(r) || "Unassigned";
      m[dept] = (m[dept]||0) + parseDurSecs(r.duration);
    });
    // Only include if at least one dept is assigned
    const hasAssigned = Object.keys(m).some(k => k !== "Unassigned");
    return hasAssigned ? Object.entries(m).sort((a,b)=>b[1]-a[1]) : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[allDT, loggedByEventId, loggedByStartTime]);

  const coDate = (mins) => {
    if (!appliedRange?.startDate||mins==null) return "";
    const norm=((mins%1440)+1440)%1440;
    const d=new Date(appliedRange.startDate+"T00:00:00");
    if (appliedRange.crossesMidnight&&norm<appliedRange.startMin) d.setDate(d.getDate()+1);
    return fmtYMD(d);
  };

  const hasData = allDT.length>0||changeovers.length>0;

  const donutData = useMemo(()=>{
    const vals=[briefSecs/60,idleSecs/60,coSt.overrunMins].map((v)=>Math.round(v*10)/10);
    if (vals.every((v)=>v===0)) return null;
    return {
      labels:[`DT (<${IDLE_THRESHOLD_MINS}m)`,`Idle (≥${IDLE_THRESHOLD_MINS}m)`,"CO Overrun"],
      datasets:[{data:vals,backgroundColor:["#f43f5e","#f59e0b","#8b5cf6"],borderWidth:2,borderColor:"#fff"}],
    };
  },[briefSecs,idleSecs,coSt]);

  const reasonChartData = useMemo(()=>{
    if (!reasonMap.length) return null;
    const top=reasonMap.slice(0,8);
    return {
      labels:top.map(([r])=>r.length>18?r.slice(0,18)+"…":r),
      datasets:[{
        label:"Duration (min)",
        data:top.map(([,s])=>Math.round((s/60)*10)/10),
        backgroundColor:"rgba(239,68,68,0.75)",
        borderColor:"#dc2626",borderWidth:1,borderRadius:6,
      }],
    };
  },[reasonMap]);

  const DEPT_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#0ea5e9","#f43f5e","#14b8a6"];

  const deptChartData = useMemo(()=>{
    if (!departmentMap.length) return null;
    return {
      labels: departmentMap.map(([d])=>d.length>18?d.slice(0,18)+"…":d),
      datasets:[{
        label:"Duration (min)",
        data: departmentMap.map(([,s])=>Math.round((s/60)*10)/10),
        backgroundColor: departmentMap.map((_,i)=>DEPT_COLORS[i%DEPT_COLORS.length]+"BF"),
        borderColor:     departmentMap.map((_,i)=>DEPT_COLORS[i%DEPT_COLORS.length]),
        borderWidth:1, borderRadius:6,
      }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[departmentMap]);

  // Tab config
  const tabs = [
    { key:"downtime",   label:"Downtime Events", count:allDT.length,       icon:TimerOff },
    { key:"changeover", label:"Changeovers",      count:changeovers.length,  icon:ArrowRight },
    { key:"logged",     label:"Logged Entries",   count:downtimeEntries.length, icon:ListChecks },
  ];

  const exportMeta = () => `${startTime} to ${endTime}  |  Generated ${new Date().toLocaleString()}`;

  const buildExportBlocks = () => {
    const downtimeRows = allDT.map((r, idx) => ({
      idx: idx + 1, shift: r.shift,
      type: (r.effectiveState || r.state) === "Idle" ? "Idle" : "Downtime",
      start: fmtAbs(r._absMs, r.startTime), end: fmtAbs(r._absMsEnd, r.endTime),
      duration: fmtDur(r.duration), reason: effectiveReason(r),
      department: effectiveDepartment(r) || "—",
      remarks: ((r.eventId && loggedByEventId[String(r.eventId)]) || loggedByStartTime[String(r.startTime || "").substring(0, 8)])?.remarks || "—",
    }));
    const changeoverRows = changeovers.map((c, i) => ({
      idx: i + 1, shift: c.shift || "—",
      fromModel: getMaterialByModel(materials, c.fromModel)?.partName || c.fromModel,
      toModel: getMaterialByModel(materials, c.toModel)?.partName || c.toModel,
      start: c.startTime, end: c.endTime, duration: `${c.durationMins.toFixed(1)}m`,
      status: c.isOverrun ? `+${c.overrunMins.toFixed(1)}m overrun` : "Within std",
    }));
    const loggedRows = downtimeEntries.map((e, idx) => ({
      idx: idx + 1, shift: e.shift,
      type: e.isChangeover ? "Changeover" : "Downtime",
      start: e.startTime || "—", end: e.endTime || "—", duration: e.duration || "—",
      model: e.isChangeover && e.fromModel ? `${e.fromModel} → ${e.model || "—"}` : (e.model || "—"),
      reason: e.reasonName || "—", category: e.category || "—", remarks: e.remarks || "—",
      loggedAt: e.loggedAt ? new Date(e.loggedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—",
    }));

    const blocks = [
      { type: "table", heading: "Downtime Events", columns: DOWNTIME_COLUMNS, rows: downtimeRows },
    ];
    if (changeoverRows.length) blocks.push({ type: "table", heading: "Changeovers", columns: CHANGEOVER_COLUMNS, rows: changeoverRows });
    if (donutData) blocks.push({ type: "image", heading: "Loss Breakdown", dataUrl: donutChartRef.current?.toBase64Image?.(), width: 220, height: 220 });
    if (reasonChartData) blocks.push({ type: "image", heading: "Loss by Reason (min)", dataUrl: reasonChartRef.current?.toBase64Image?.(), width: 500, height: 220 });
    if (deptChartData) blocks.push({ type: "image", heading: "Loss by Department (min)", dataUrl: deptChartRef.current?.toBase64Image?.(), width: 500, height: 220 });
    if (loggedRows.length) blocks.push({ type: "table", heading: "Logged Entries", columns: LOGGED_COLUMNS, rows: loggedRows });
    return blocks;
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Downtime Report</h1>
          <p className="text-[11px] text-slate-400">Downtime · Idle · Changeover analysis</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>exportCSV(allDT,changeovers)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
              <Download className="w-3.5 h-3.5"/> CSV
            </button>
            <button
              onClick={() => exportSectionsToExcel({
                blocks: buildExportBlocks(),
                title: "Part Process — Downtime Report",
                subtitle: exportMeta(),
                filename: "downtime_report.xlsx",
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-emerald-600 transition-colors">
              <FileSpreadsheet className="w-3.5 h-3.5"/> Excel
            </button>
            <button
              onClick={() => exportMultiSectionPDF({
                blocks: buildExportBlocks(),
                title: "Part Process - Downtime Report",
                subtitle: exportMeta(),
                filename: "downtime_report.pdf",
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-rose-600 transition-colors">
              <FileText className="w-3.5 h-3.5"/> PDF
            </button>
          </div>
        )}
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">

        {/* ── FILTER BAR ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400"/>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Filters</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[165px] flex-1">
              <DateTimePicker label="Start Time" name="start" value={startTime} onChange={(e)=>setStartTime(e.target.value)}/>
            </div>
            <div className="min-w-[165px] flex-1">
              <DateTimePicker label="End Time" name="end" value={endTime} onChange={(e)=>setEndTime(e.target.value)}/>
            </div>
            <div className="flex gap-2 pb-0.5 shrink-0 flex-wrap">
              {shifts.map((sh)=>(
                <button key={sh.shiftName} onClick={()=>handleShiftSelect(sh)} disabled={isAnyLoading}
                  style={!isAnyLoading?{backgroundColor:sh.color||"#6366f1",borderColor:sh.color||"#6366f1"}:{}}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border text-white ${isAnyLoading?"bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed":"opacity-90 hover:opacity-100"}`}>
                  {shiftLoading===sh.shiftName?<Spinner/>:<Clock className="w-3.5 h-3.5"/>}
                  {sh.shiftName}
                </button>
              ))}
              <button onClick={handleYesterday} disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isAnyLoading?"bg-slate-200 text-slate-400 cursor-not-allowed":"bg-amber-500 hover:bg-amber-600 text-white"}`}>
                {ydayLoading?<Spinner/>:<Calendar className="w-3.5 h-3.5"/>} Yesterday
              </button>
              <button onClick={handleToday} disabled={isAnyLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isAnyLoading?"bg-slate-200 text-slate-400 cursor-not-allowed":"bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                {todayLoading?<Spinner/>:<Clock className="w-3.5 h-3.5"/>} Today
              </button>
              <button onClick={handleQuery} disabled={isAnyLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isAnyLoading?"bg-slate-200 text-slate-400 cursor-not-allowed":"bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}>
                {loading?<Spinner/>:<Search className="w-3.5 h-3.5"/>} {loading?"Loading…":"Query"}
              </button>
            </div>
          </div>
        </div>

        {/* ── LOADING ── */}
        {isAnyLoading && (
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 py-16">
            <Spinner cls="w-5 h-5 text-blue-500"/><p className="text-sm text-slate-400">Fetching downtime data…</p>
          </div>
        )}

        {/* ── EMPTY ── */}
        {!isAnyLoading && !hasData && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center text-slate-400">
            <PackageOpen className="w-10 h-10 opacity-20 mx-auto mb-3" strokeWidth={1.2}/>
            <p className="text-sm font-medium">No data — select filters and click Query.</p>
          </div>
        )}

        {!isAnyLoading && hasData && (
          <>
            {/* ── KPI ROW ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <KpiCard icon={TimerOff}    label="Total Downtime"  value={`${secsToMins(totalDTSecs)}m`} sub={`${allDT.length} events`}         accent="rose"/>
              <KpiCard icon={Activity}    label="Brief Downtime"  value={briefDT.length} sub={`<${IDLE_THRESHOLD_MINS}m · ${secsToMins(briefSecs)}m total`} accent="rose"/>
              <KpiCard icon={Clock}       label="Idle Events"     value={idleDT.length}  sub={`≥${IDLE_THRESHOLD_MINS}m · ${secsToMins(idleSecs)}m total`}  accent="amber"/>
              <KpiCard icon={ArrowRight}  label="Changeovers"     value={coSt.count}     sub={`${coSt.totalMins}m total CO time`}             accent="violet"/>
              <KpiCard icon={TrendingDown}label="CO Overrun Loss" value={`${coSt.overrunMins}m`} sub={`${coSt.overrunCount} COs > ${STD_CHANGEOVER_MINS}m std`} accent="purple"/>
            </div>

            {/* ── CHARTS ROW ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {/* Donut */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <SectionHeader icon={Activity} title="Loss Breakdown" accent="rose"/>
                <div className="p-4 flex flex-col items-center gap-4">
                  {donutData ? (
                    <>
                      <div className="w-36 h-36">
                        <Doughnut ref={donutChartRef} data={donutData} options={{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{display:false},tooltip:{backgroundColor:"#1e293b",titleColor:"#f8fafc",bodyColor:"#cbd5e1",borderWidth:0}}}}/>
                      </div>
                      <div className="w-full flex flex-col gap-2">
                        {donutData.labels.map((l,i)=>(
                          <div key={l} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:donutData.datasets[0].backgroundColor[i]}}/>
                              <span className="text-[11px] text-slate-600">{l}</span>
                            </div>
                            <span className="text-xs font-bold font-mono text-slate-700">{donutData.datasets[0].data[i]}m</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-xs text-slate-400 py-8">No downtime data</p>}
                </div>
              </div>

              {/* Bar chart */}
              <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <SectionHeader icon={BarChart2} title="Loss by Reason (min)" accent="rose"/>
                <div className="p-4 h-48">
                  {reasonChartData ? (
                    <Bar ref={reasonChartRef} data={reasonChartData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"#1e293b",titleColor:"#f8fafc",bodyColor:"#cbd5e1",borderWidth:0,callbacks:{label:(c)=>`${c.parsed.y}m`}}},scales:{x:{grid:{display:false},ticks:{font:{size:10},color:"#94a3b8"}},y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.04)"},ticks:{font:{size:10},color:"#94a3b8"}}}}}/>
                  ) : <div className="flex items-center justify-center h-full text-slate-300 text-xs">No reason data</div>}
                </div>
              </div>
            </div>

            {/* ── SHIFT BREAKDOWN ── */}
            {shiftMap.length > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Shift-wise Downtime</p>
                <div className="flex gap-3 flex-wrap">
                  {shiftMap.map(([sh,secs])=>{
                    const pct = totalDTSecs>0 ? Math.round((secs/totalDTSecs)*100) : 0;
                    return (
                      <div key={sh} className="flex-1 min-w-[120px] bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{sh}</p>
                        <p className="text-xl font-extrabold font-mono text-rose-500">{secsToMins(secs)}m</p>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                          <div className="h-full bg-rose-400 rounded-full transition-all" style={{width:`${pct}%`}}/>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{pct}% of total</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── DEPARTMENT LOSS CHART ── */}
            {deptChartData && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <SectionHeader icon={BarChart2} title="Loss by Department (min)" accent="violet"/>
                <div className="p-4">
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                    {/* Bar chart */}
                    <div className="xl:col-span-2 h-48">
                      <Bar ref={deptChartRef} data={deptChartData} options={{
                        responsive:true, maintainAspectRatio:false,
                        plugins:{legend:{display:false},tooltip:{backgroundColor:"#1e293b",titleColor:"#f8fafc",bodyColor:"#cbd5e1",borderWidth:0,callbacks:{label:(c)=>`${c.parsed.y}m`}}},
                        scales:{x:{grid:{display:false},ticks:{font:{size:10},color:"#94a3b8"}},y:{beginAtZero:true,grid:{color:"rgba(0,0,0,0.04)"},ticks:{font:{size:10},color:"#94a3b8"}}},
                      }}/>
                    </div>
                    {/* Department legend with mini bars */}
                    <div className="flex flex-col gap-2.5">
                      {departmentMap.map(([dept, secs], i) => {
                        const pct = totalDTSecs>0 ? Math.round((secs/totalDTSecs)*100) : 0;
                        const col = DEPT_COLORS[i%DEPT_COLORS.length];
                        return (
                          <div key={dept}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:col}}/>
                                <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[140px]">{dept}</span>
                              </div>
                              <span className="text-[11px] font-bold font-mono text-slate-600">{secsToMins(secs)}m</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:col}}/>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-0.5">{pct}% of total downtime</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TABS ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Tab strip */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                {tabs.map((t)=>(
                  <button key={t.key} onClick={()=>setActiveTab(t.key)}
                    className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                      activeTab===t.key
                        ? "border-blue-500 text-blue-600 bg-white"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    }`}>
                    <t.icon className="w-3.5 h-3.5"/>
                    {t.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab===t.key?"bg-blue-100 text-blue-600":"bg-slate-200 text-slate-500"}`}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* ── TAB: Downtime Events ── */}
              {activeTab==="downtime" && (
                allDT.length===0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <TimerOff className="w-8 h-8 opacity-20 mx-auto mb-2" strokeWidth={1.2}/>
                    <p className="text-sm">No downtime events in this range.</p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50">
                          {["#","Shift","Type","Start","End","Duration","Reason","Department","Remarks"].map((h)=>(
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(showAllDT?allDT:allDT.slice(0,12)).map((r,idx)=>{
                          const effState = r.effectiveState||r.state;
                          const isIdle   = effState==="Idle";
                          const secs     = parseDurSecs(r.duration);
                          const maxSecs  = Math.max(...allDT.map((x)=>parseDurSecs(x.duration)),1);
                          const logged     = (r.eventId && loggedByEventId[String(r.eventId)])
                            || loggedByStartTime[String(r.startTime||"").substring(0,8)];
                          const reasonText = effectiveReason(r);
                          return (
                            <tr key={idx} className={`transition-colors ${isIdle?"hover:bg-amber-50/40":"hover:bg-rose-50/20"}`}>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400">{idx+1}</td>
                              <td className="px-3 py-2.5 border-b border-slate-100"><ShiftPill name={r.shift}/></td>
                              <td className="px-3 py-2.5 border-b border-slate-100"><TypeBadge type={isIdle?"Idle":"Downtime"}/></td>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap text-[11px]">{fmtAbs(r._absMs,r.startTime)}</td>
                              <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 whitespace-nowrap text-[11px]">{fmtAbs(r._absMsEnd,r.endTime)}</td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold font-mono text-xs ${isIdle?"text-amber-600":"text-rose-500"}`}>{fmtDur(r.duration)}</span>
                                  <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${isIdle?"bg-amber-400":"bg-rose-400"}`} style={{width:`${Math.min(100,(secs/maxSecs)*100)}%`}}/>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                {reasonText !== "Unassigned" ? (
                                  <div className="flex items-center gap-1.5">
                                    {logged?.reasonName && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>
                                    )}
                                    <span className={`text-[11px] font-semibold ${logged?.reasonName ? "text-emerald-700" : "text-slate-700"}`}>
                                      {reasonText}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">⚠ Unassigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100">
                                {(() => {
                                  const dept = effectiveDepartment(r);
                                  if (!dept) return <span className="text-slate-300 text-[11px]">—</span>;
                                  const dIdx = departmentMap.findIndex(([d])=>d===dept);
                                  const col  = DEPT_COLORS[dIdx>=0?dIdx%DEPT_COLORS.length:0];
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{backgroundColor:col+"1A",color:col,borderColor:col+"55"}}>
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor:col}}/>
                                      {dept}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2.5 border-b border-slate-100 text-[11px] text-slate-500 max-w-[160px] truncate">
                                {logged?.remarks || <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!showAllDT && allDT.length>12 && (
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center">
                        <button onClick={()=>setShowAllDT(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto">
                          <ChevronRight className="w-3.5 h-3.5"/> Show {allDT.length-12} more events
                        </button>
                      </div>
                    )}
                    {showAllDT && allDT.length>12 && (
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center">
                        <button onClick={()=>setShowAllDT(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Show less</button>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ── TAB: Changeovers ── */}
              {activeTab==="changeover" && (
                changeovers.length===0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ArrowRight className="w-8 h-8 opacity-20 mx-auto mb-2" strokeWidth={1.2}/>
                    <p className="text-sm">No changeovers detected in this range.</p>
                  </div>
                ) : (
                  <>
                    {coSt.overrunMins>0 && (
                      <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500"/>
                        <span className="text-xs font-semibold text-rose-700">{coSt.overrunMins}m total overrun loss across {coSt.overrunCount} changeover(s) · std {STD_CHANGEOVER_MINS}m</span>
                      </div>
                    )}
                    <div className="overflow-auto">
                      <table className="min-w-full text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-slate-50">
                            {["#","Shift","From Model","To Model","Start","End","Duration","Status"].map((h)=>(
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(showAllCO?changeovers:changeovers.slice(0,10)).map((co,idx)=>{
                            const fromMat = getMaterialByModel(materials,co.fromModel);
                            const toMat   = getMaterialByModel(materials,co.toModel);
                            const sDate   = coDate(co.startMins??toMins(co.startTime));
                            const eDate   = coDate(co.endMins??toMins(co.endTime));
                            return (
                              <tr key={idx} className={`transition-colors ${co.isOverrun?"bg-rose-50/30 hover:bg-rose-50/60":"hover:bg-slate-50"}`}>
                                <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400">{idx+1}</td>
                                <td className="px-3 py-2.5 border-b border-slate-100"><ShiftPill name={co.shift}/></td>
                                <td className="px-3 py-2.5 border-b border-slate-100 min-w-[160px]">
                                  <p className="text-[11px] font-semibold text-slate-700">{fromMat?.partName||co.fromModel}</p>
                                  {fromMat ? <p className="text-[9px] text-slate-400 font-mono">{fromMat.sapCode}</p>
                                           : <p className="text-[9px] text-amber-500">no master</p>}
                                </td>
                                <td className="px-3 py-2.5 border-b border-slate-100 min-w-[160px]">
                                  <p className="text-[11px] font-semibold text-slate-700">{toMat?.partName||co.toModel}</p>
                                  {toMat ? <p className="text-[9px] text-slate-400 font-mono">{toMat.sapCode}</p>
                                         : <p className="text-[9px] text-amber-500">no master</p>}
                                </td>
                                <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 text-[11px] whitespace-nowrap">{sDate?`${sDate} ${co.startTime}`:co.startTime}</td>
                                <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 text-[11px] whitespace-nowrap">{eDate?`${eDate} ${co.endTime}`:co.endTime}</td>
                                <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-slate-700">{co.durationMins.toFixed(1)}m</td>
                                <td className="px-3 py-2.5 border-b border-slate-100">
                                  {co.isOverrun ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">+{co.overrunMins.toFixed(1)}m overrun</span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Within std</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!showAllCO && changeovers.length>10 && (
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center">
                          <button onClick={()=>setShowAllCO(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto">
                            <ChevronRight className="w-3.5 h-3.5"/> Show {changeovers.length-10} more
                          </button>
                        </div>
                      )}
                      {showAllCO && changeovers.length>10 && (
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center">
                          <button onClick={()=>setShowAllCO(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Show less</button>
                        </div>
                      )}
                    </div>
                  </>
                )
              )}

              {/* ── TAB: Logged Entries ── */}
              {activeTab==="logged" && (
                downtimeEntries.length===0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ListChecks className="w-8 h-8 opacity-20 mx-auto mb-2" strokeWidth={1.2}/>
                    <p className="text-sm">No downtime entries logged yet.</p>
                    <p className="text-[11px] mt-1 text-slate-300">Use the Log Downtime button on the Dashboard to log entries.</p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50">
                          {["#","Shift","Type","Start","End","Duration","Model","Reason","Category","Remarks","Logged At"].map((h)=>(
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {downtimeEntries.map((e,idx)=>(
                          <tr key={e.id||idx} className={`transition-colors ${e.isChangeover?"hover:bg-amber-50/40 bg-amber-50/10":"hover:bg-slate-50"}`}>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400">{idx+1}</td>
                            <td className="px-3 py-2.5 border-b border-slate-100"><ShiftPill name={e.shift}/></td>
                            <td className="px-3 py-2.5 border-b border-slate-100">
                              {e.isChangeover ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  <ArrowRight className="w-2.5 h-2.5"/> CO
                                </span>
                              ) : (
                                <TypeBadge type="Downtime"/>
                              )}
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 text-[11px] whitespace-nowrap">{e.startTime||"—"}</td>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-500 text-[11px] whitespace-nowrap">{e.endTime||"—"}</td>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-bold font-mono text-rose-500">{e.duration||"—"}</td>
                            <td className="px-3 py-2.5 border-b border-slate-100 max-w-[160px]">
                              {e.isChangeover && e.fromModel ? (
                                <div>
                                  <p className="text-[10px] text-slate-400 truncate">{e.fromModel}</p>
                                  <p className="text-[10px] font-medium text-slate-600 truncate">→ {e.model||"—"}</p>
                                </div>
                              ) : <span className="text-[11px] text-slate-600 truncate block">{e.model||"—"}</span>}
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100">
                              {e.reasonName ? (
                                <span className="text-[11px] font-semibold text-emerald-700">{e.reasonName}</span>
                              ) : (
                                <span className="text-slate-300 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100">
                              {e.category ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{e.category}</span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 max-w-[160px] truncate text-[11px]">{e.remarks||"—"}</td>
                            <td className="px-3 py-2.5 border-b border-slate-100 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                              {e.loggedAt ? new Date(e.loggedAt).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PartProcessDowntimeReport;
