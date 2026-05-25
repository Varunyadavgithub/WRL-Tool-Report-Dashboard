import { useState, useMemo, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import {
  FaUser, FaCalendarAlt, FaSearch, FaPrint,
  FaClock, FaTimesCircle,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";

const S = {
  P:  { label: "P",  bg: "bg-green-100",  text: "text-green-800",  ring: "ring-green-300", title: "Present"      },
  HD: { label: "HD", bg: "bg-yellow-100", text: "text-yellow-800", ring: "ring-yellow-300", title: "Half Day"     },
  PM: { label: "PM", bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300", title: "Punch Missing"},
  WO: { label: "WO", bg: "bg-blue-100",   text: "text-blue-700",   ring: "ring-blue-200",   title: "Week Off"     },
  A:  { label: "A",  bg: "bg-red-100",    text: "text-red-700",    ring: "ring-red-300",    title: "Absent"       },
  CO: { label: "CO", bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-300", title: "Comp Off"     },
  CL: { label: "CL", bg: "bg-cyan-100",   text: "text-cyan-700",   ring: "ring-cyan-300",   title: "Casual Leave" },
  SL: { label: "SL", bg: "bg-amber-100",  text: "text-amber-700",  ring: "ring-amber-300",  title: "Sick Leave"   },
  PL: { label: "PL", bg: "bg-purple-100", text: "text-purple-700", ring: "ring-purple-300", title: "Privilege Leave"},
};

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const isoDate = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const deriveStatus = (records) => {
  if (!records?.length) return null;
  const best = records.reduce((b, r) => {
    const rank = { Present: 3, "Half Day": 2, "Punch Missing": 1 };
    return (rank[r.AttendanceStatus] ?? 0) > (rank[b.AttendanceStatus] ?? 0) ? r : b;
  }, records[0]);
  switch (best.AttendanceStatus) {
    case "Present":       return "P";
    case "Half Day":      return "HD";
    case "Punch Missing": return "PM";
    default:              return "A";
  }
};

const MonthCalendar = ({ year, month, byDate, leaveByDate = {}, onSelect, selectedDate }) => {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none w-full">
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-bold py-1.5 ${i === 0 ? "text-red-400" : "text-gray-400"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const key = isoDate(new Date(year, month, d));
          const dow = new Date(year, month, d).getDay();
          const recs      = byDate[key] || [];
          const leaveType = leaveByDate[key];
          const status    = leaveType ? leaveType
                          : recs.length > 0 ? deriveStatus(recs)
                          : (dow === 0 ? "WO" : null);
          const cfg    = status ? S[status] : null;
          const isToday = key === isoDate(new Date());
          const isSel   = key === selectedDate;
          return (
            <button key={key} onClick={() => onSelect(key, recs)}
              className={`
                flex flex-col items-center justify-center rounded-xl py-2.5 transition-all cursor-pointer
                ${cfg ? `${cfg.bg} ${cfg.text}` : "bg-gray-50 text-gray-400 hover:bg-gray-100"}
                ${isToday ? "ring-2 ring-indigo-500 ring-offset-1" : ""}
                ${isSel   ? `ring-2 ${cfg?.ring || "ring-indigo-300"} shadow-lg scale-105` : "hover:scale-105 hover:shadow-md"}
              `}
            >
              <span className={`text-sm font-black leading-none ${dow === 0 ? "text-red-500" : ""}`}>{d}</span>
              {cfg && <span className="text-[9px] font-bold mt-1 leading-none">{cfg.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MyAttendance = () => {
  const today = new Date();
  const [empCode,      setEmpCode]      = useState("");
  const [inputCode,    setInputCode]    = useState("");
  const [year,         setYear]         = useState(today.getFullYear());
  const [month,        setMonth]        = useState(today.getMonth());
  const [records,      setRecords]      = useState([]);
  const [leaves,       setLeaves]       = useState([]);
  const [empInfo,      setEmpInfo]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [fetched,      setFetched]      = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRecs, setSelectedRecs] = useState([]);

  const fetchAttendance = useCallback(async (code, y, m) => {
    if (!code.trim()) { toast.error("Enter an employee code"); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}manpower/attendance`, {
        params: {
          fromDate: isoDate(new Date(y, m, 1)),
          toDate:   isoDate(new Date(y, m + 1, 0)),
          empCode:  code.trim().toUpperCase(),
        },
      });
      const data = res.data.data || [];
      setRecords(data);
      setFetched(true);
      setSelectedDate(null);
      if (data.length > 0) {
        const info = { name: data[0].EmployeeName, dept: data[0].Department, code: data[0].EmpCode || code };
        setEmpInfo(info);
        toast.success(`Loaded ${data.length} records for ${info.name}`);
        // Auto-generate CO for days with WorkingHours > 14
        const codays = data
          .filter((r) => r.WorkingHours != null && r.WorkingHours > 14)
          .map((r) => ({ date: String(r.AttendanceDate).slice(0, 10) }))
          .filter((v, i, arr) => arr.findIndex((x) => x.date === v.date) === i); // dedupe

        if (codays.length > 0) {
          try {
            const coRes = await axios.post(`${baseURL}manpower/leave/auto-co`, {
              empCode: info.code, empName: info.name, department: info.dept, dates: codays,
            });
            if (coRes.data.created > 0)
              toast.success(`${coRes.data.created} CO leave(s) auto-generated for 14+ hr days`);
          } catch { /* silent — don't block UI for CO generation failure */ }
        }

        // fetch approved leaves for this employee
        try {
          const lRes = await axios.get(`${baseURL}manpower/leave/my`, { params: { empCode: info.code } });
          setLeaves((lRes.data.data || []).filter((l) => l.Status === "approved"));
        } catch { setLeaves([]); }
      } else {
        setEmpInfo(null);
        setLeaves([]);
        toast("No records found", { icon: "📭" });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    setEmpCode(inputCode);
    fetchAttendance(inputCode, year, month);
  };

  const handleMonthChange = (dir) => {
    let m = month + dir, y = year;
    if (m > 11) { m = 0;  y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m); setYear(y);
    if (empCode) fetchAttendance(empCode, y, m);
  };

  const byDate = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      const dk = r.AttendanceDate ? String(r.AttendanceDate).slice(0, 10) : null;
      if (!dk) return;
      if (!map[dk]) map[dk] = [];
      map[dk].push(r);
    });
    return map;
  }, [records]);

  // Map of date → leave type for approved leaves (overlays calendar)
  const leaveByDate = useMemo(() => {
    const map = {};
    leaves.forEach((l) => {
      const from = new Date(String(l.FromDate).slice(0, 10) + "T00:00:00");
      const to   = new Date(String(l.ToDate).slice(0, 10)   + "T00:00:00");
      const cur  = new Date(from);
      while (cur <= to) {
        map[isoDate(cur)] = l.LeaveType;
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [leaves]);

  const summary = useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    let P = 0, HD = 0, PM = 0, WO = 0, A = 0;
    for (let d = 1; d <= days; d++) {
      const key = isoDate(new Date(year, month, d));
      const dow = new Date(year, month, d).getDay();
      const recs = byDate[key];
      if (!recs?.length) { dow === 0 ? WO++ : A++; }
      else {
        const s = deriveStatus(recs);
        if (s === "P") P++; else if (s === "HD") HD++; else if (s === "PM") PM++; else A++;
      }
    }
    return { P, HD, PM, WO, A, TTL: P + HD };
  }, [byDate, year, month]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans print:bg-white">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm print:hidden">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl"><FaUser className="text-indigo-600 text-lg" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">My Attendance</h1>
              <p className="text-xs text-gray-400 mt-0.5">View attendance calendar by employee code</p>
            </div>
          </div>
          {fetched && empInfo && (
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-semibold transition">
              <FaPrint size={11} /> Print
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* Search + Employee banner row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:hidden">
          {/* Search */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Lookup</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Employee Code</label>
                <input type="text" placeholder="e.g. WRLZ0242"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Period</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleMonthChange(-1)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold transition flex-shrink-0">‹</button>
                  <span className="flex-1 text-center text-sm font-bold text-gray-700">{MONTHS[month]} {year}</span>
                  <button onClick={() => handleMonthChange(1)}  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold transition flex-shrink-0">›</button>
                </div>
              </div>
              <button onClick={handleSearch} disabled={loading || !inputCode.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200 disabled:opacity-50">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaSearch size={12} />}
                {loading ? "Loading…" : "Search"}
              </button>
            </div>
          </div>

          {/* Employee profile + summary in one wide card */}
          <div className="lg:col-span-2">
            {empInfo ? (
              <div className="h-full flex flex-col gap-4">
                {/* Profile banner */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-5 text-white flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FaUser className="text-white text-xl" />
                    </div>
                    <div>
                      <p className="text-xl font-black leading-tight">{empInfo.name}</p>
                      <p className="text-indigo-200 text-xs mt-0.5 font-mono">{empInfo.code}</p>
                      {empInfo.dept && <p className="text-indigo-200 text-xs">{empInfo.dept}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-indigo-200 text-xs font-semibold">Period</p>
                    <p className="font-black text-xl">{MONTHS[month]} {year}</p>
                  </div>
                </div>
                {/* Summary cards */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 flex-1">
                  {[
                    { label: "Present",      val: summary.P,   color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200"  },
                    { label: "Half Day",     val: summary.HD,  color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
                    { label: "Punch Miss",   val: summary.PM,  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
                    { label: "Week Off",     val: summary.WO,  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200"   },
                    { label: "Absent",       val: summary.A,   color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"    },
                    { label: "Paid Days",    val: summary.TTL, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
                  ].map(({ label, val, color, bg, border }) => (
                    <div key={label} className={`${bg} border ${border} rounded-xl p-3 text-center flex flex-col items-center justify-center`}>
                      <p className={`text-2xl font-black ${color}`}>{val}</p>
                      <p className="text-[10px] text-gray-500 font-semibold leading-tight mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full bg-white rounded-2xl border border-dashed border-gray-200 flex items-center justify-center text-center p-10">
                <div className="text-gray-300">
                  <FaUser className="text-5xl mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-400">Enter an employee code and click Search</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calendar + Detail */}
        {fetched && empInfo && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Calendar — takes 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <FaCalendarAlt className="text-indigo-400" size={14} />
                  {MONTHS[month]} {year}
                </h2>
                <div className="flex gap-2 print:hidden">
                  <button onClick={() => handleMonthChange(-1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold transition">‹ Prev</button>
                  <button onClick={() => handleMonthChange(1)}  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold transition">Next ›</button>
                </div>
              </div>
              <MonthCalendar year={year} month={month} byDate={byDate}
                leaveByDate={leaveByDate}
                onSelect={(date, recs) => { setSelectedDate(date); setSelectedRecs(recs); }}
                selectedDate={selectedDate}
              />
              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
                {Object.entries(S).map(([k, v]) => (
                  <span key={k} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${v.bg} ${v.text}`}>
                    {v.label} = {v.title}
                  </span>
                ))}
              </div>
            </div>

            {/* Day Detail panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col min-h-[400px]">
              <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-4">
                <FaClock className="text-indigo-400" size={14} />
                {selectedDate
                  ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })
                  : "Select a day"}
              </h2>

              {!selectedDate && (
                <div className="flex-1 flex items-center justify-center text-center text-gray-300">
                  <div>
                    <FaCalendarAlt className="mx-auto text-5xl mb-3" />
                    <p className="text-sm font-medium">Click on a date to view punch details</p>
                  </div>
                </div>
              )}

              {selectedDate && selectedRecs.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-center">
                  {new Date(selectedDate + "T00:00:00").getDay() === 0 ? (
                    <div className="text-blue-400">
                      <FaCalendarAlt className="mx-auto text-4xl mb-3" />
                      <p className="text-base font-black">Week Off</p>
                    </div>
                  ) : (
                    <div className="text-red-400">
                      <FaTimesCircle className="mx-auto text-4xl mb-3" />
                      <p className="text-base font-black">Absent</p>
                      <p className="text-xs text-gray-400 mt-1">No punch record found</p>
                    </div>
                  )}
                </div>
              )}

              {selectedDate && selectedRecs.length > 0 && (
                <div className="space-y-3 overflow-y-auto flex-1">
                  {selectedRecs.map((r, i) => {
                    const status = deriveStatus([r]);
                    const cfg = S[status] || S.A;
                    return (
                      <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className={`flex items-center justify-between px-4 py-2.5 ${cfg.bg}`}>
                          <span className={`text-sm font-black ${cfg.text}`}>{cfg.title}</span>
                          <span className="text-[10px] text-gray-500 font-semibold">{r.Shift || "—"}</span>
                        </div>
                        <div className="px-4 py-3 space-y-2.5">
                          {[
                            ["Check In",    r.InTime || "—",        "font-mono font-bold text-gray-700"],
                            ["Check Out",   r.OutTime || null,       "font-mono font-bold text-gray-700"],
                            ["Working Hrs", r.WorkingHours != null ? `${r.WorkingHours}h` : "—",
                              r.WorkingHours >= 8 ? "font-bold text-green-600" : r.WorkingHours > 0 ? "font-bold text-yellow-600" : "font-bold text-red-500"],
                          ].map(([label, val, cls]) => (
                            <div key={label} className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 font-medium">{label}</span>
                              {label === "Check Out" && !r.OutTime
                                ? <span className="text-orange-500 font-semibold">Missing</span>
                                : <span className={cls}>{val}</span>
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Punch log table */}
        {fetched && empInfo && records.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <MdOutlineFactCheck className="text-indigo-400 text-base" />
                Punch Log — {records.length} records
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {["Date","Day","In Time","Out Time","Working Hrs","Status"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((r, i) => {
                    const status = deriveStatus([r]);
                    const cfg    = S[status] || S.A;
                    const date   = r.AttendanceDate ? String(r.AttendanceDate).slice(0, 10) : "—";
                    const dow    = date !== "—" ? new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }) : "";
                    return (
                      <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-indigo-50/20 cursor-pointer`}
                        onClick={() => { setSelectedDate(date); setSelectedRecs([r]); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{date}</td>
                        <td className="px-4 py-2.5 text-gray-500">{dow}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-700">{r.InTime || "—"}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-700">
                          {r.OutTime || <span className="text-orange-500 font-semibold">Missing</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`font-bold ${r.WorkingHours >= 8 ? "text-green-600" : r.WorkingHours > 0 ? "text-yellow-600" : "text-gray-400"}`}>
                            {r.WorkingHours != null ? `${r.WorkingHours}h` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>{cfg.title}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Fetching attendance…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAttendance;
