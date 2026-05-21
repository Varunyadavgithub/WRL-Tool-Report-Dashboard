import { useState, useMemo, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell,
} from "recharts";
import {
  FaUsers, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaSync, FaClock, FaBuilding, FaTrophy, FaCalendarAlt,
} from "react-icons/fa";
import { MdTableChart } from "react-icons/md";

// ── Helpers ───────────────────────────────────────────────────────────────────
const isoDate = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const defaultRange = () => {
  const now = new Date();
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to:   isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
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

const buildDateRange = (from, to) => {
  const dates = [], cur = new Date(from), end = new Date(to);
  while (cur <= end) { dates.push(isoDate(new Date(cur))); cur.setDate(cur.getDate() + 1); }
  return dates;
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const KPI = ({ icon: Icon, label, value, sub, iconBg, iconColor, trend }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start gap-4">
    <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
      <Icon className={`text-lg ${iconColor}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-2xl font-black text-gray-800 leading-none">{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
      {sub   && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      {trend != null && (
        <p className={`text-[10px] font-bold mt-1 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
        </p>
      )}
    </div>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const AttendanceDashboard = () => {
  const def = defaultRange();
  const [fromDate, setFromDate] = useState(def.from);
  const [toDate,   setToDate]   = useState(def.to);
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);

  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate) { toast.error("Select both dates"); return; }
    const days = (new Date(toDate) - new Date(fromDate)) / 86400000;
    if (days > 90) { toast.error("Range cannot exceed 90 days"); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}manpower/attendance`, { params: { fromDate, toDate } });
      setRecords(res.data.data || []);
      setFetched(true);
      toast.success(`Loaded ${res.data.count || 0} records`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const dates = useMemo(() => buildDateRange(fromDate, toDate), [fromDate, toDate]);

  // ── Pivot all data ────────────────────────────────────────────────────────
  const { empMap, dateStats, deptStats, absentees, lateList } = useMemo(() => {
    if (!records.length) return { empMap: {}, dateStats: [], deptStats: [], absentees: [], lateList: [] };

    // Group by employee
    const empMap = {};
    records.forEach((r) => {
      const key = r.EmpCode || r.EmployeeCode || r.EmployeeName;
      if (!empMap[key]) {
        empMap[key] = { name: r.EmployeeName, dept: r.Department, code: r.EmpCode || r.EmployeeCode, byDate: {} };
      }
      const dk = r.AttendanceDate ? String(r.AttendanceDate).slice(0, 10) : null;
      if (dk) {
        if (!empMap[key].byDate[dk]) empMap[key].byDate[dk] = [];
        empMap[key].byDate[dk].push(r);
      }
    });

    const emps = Object.values(empMap);
    const totalEmps = emps.length;

    // Per-date stats (for trend chart)
    const dateStats = dates.map((d) => {
      const dow = new Date(d).getDay();
      let P = 0, HD = 0, A = 0, PM = 0, WO = 0;
      emps.forEach((emp) => {
        const recs = emp.byDate[d];
        if (!recs?.length) { dow === 0 ? WO++ : A++; return; }
        const s = deriveStatus(recs);
        if (s === "P") P++;
        else if (s === "HD") HD++;
        else if (s === "PM") PM++;
        else A++;
      });
      const pct = totalEmps > 0 ? Math.round(((P + HD) / totalEmps) * 100) : 0;
      return {
        date: new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        P, HD, A, PM, WO, pct,
      };
    });

    // Dept-wise stats
    const deptMap = {};
    emps.forEach((emp) => {
      const dept = emp.dept || "Unknown";
      if (!deptMap[dept]) deptMap[dept] = { P: 0, HD: 0, A: 0, PM: 0, WO: 0, total: 0 };
      deptMap[dept].total++;
      let presCount = 0;
      dates.forEach((d) => {
        const dow = new Date(d).getDay();
        const recs = emp.byDate[d];
        if (!recs?.length) { if (dow === 0) deptMap[dept].WO++; else deptMap[dept].A++; return; }
        const s = deriveStatus(recs);
        if (s === "P")  { deptMap[dept].P++;  presCount++; }
        if (s === "HD") { deptMap[dept].HD++; presCount += 0.5; }
        if (s === "PM") deptMap[dept].PM++;
        if (s === "A")  deptMap[dept].A++;
      });
    });
    const deptStats = Object.entries(deptMap)
      .map(([dept, d]) => ({
        dept,
        ...d,
        pct: d.total > 0 ? Math.round((d.P / (dates.length * d.total)) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    // Top absentees (most absent days)
    const absentees = emps.map((emp) => {
      let A = 0;
      dates.forEach((d) => {
        const dow = new Date(d).getDay();
        if (dow === 0) return;
        const recs = emp.byDate[d];
        if (!recs?.length) { A++; return; }
        if (deriveStatus(recs) === "A") A++;
      });
      return { ...emp, A };
    }).filter((e) => e.A > 0).sort((a, b) => b.A - a.A).slice(0, 10);

    // Late comers
    const lateMap = {};
    records.forEach((r) => {
      if (r.LateStatus === "Late") {
        const key = r.EmpCode || r.EmployeeCode || r.EmployeeName;
        if (!lateMap[key]) lateMap[key] = { name: r.EmployeeName, code: r.EmpCode, dept: r.Department, count: 0 };
        lateMap[key].count++;
      }
    });
    const lateList = Object.values(lateMap).sort((a, b) => b.count - a.count).slice(0, 10);

    return { empMap, dateStats, deptStats, absentees, lateList };
  }, [records, dates]);

  // KPIs for the selected date range
  const kpi = useMemo(() => {
    const emps = Object.values(empMap);
    if (!emps.length) return null;
    let P = 0, HD = 0, A = 0, PM = 0, WO = 0, late = 0;
    emps.forEach((emp) => {
      dates.forEach((d) => {
        const dow = new Date(d).getDay();
        const recs = emp.byDate[d];
        if (!recs?.length) { dow === 0 ? WO++ : A++; return; }
        const s = deriveStatus(recs);
        if (s === "P") P++;
        else if (s === "HD") HD++;
        else if (s === "PM") PM++;
        else A++;
      });
    });
    records.forEach((r) => { if (r.LateStatus === "Late") late++; });
    const totalSlots = emps.length * dates.filter((d) => new Date(d).getDay() !== 0).length;
    const attPct = totalSlots > 0 ? Math.round(((P + HD) / totalSlots) * 100) : 0;
    return { totalEmps: emps.length, P, HD, A, PM, WO, late, attPct };
  }, [empMap, dates, records]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl"><MdTableChart className="text-indigo-600 text-xl" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">Attendance Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Overview, trends, and insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <span className="text-gray-400 text-xs font-bold">to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200 disabled:opacity-50">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaSync size={11} />}
              {loading ? "Loading…" : "Load"}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Fetching attendance data…</p>
          </div>
        </div>
      )}

      {!loading && fetched && kpi && (
        <div className="px-6 py-5 space-y-5">

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <KPI icon={FaUsers}            label="Total Employees"  value={kpi.totalEmps} iconBg="bg-indigo-50"  iconColor="text-indigo-600" />
            <KPI icon={FaCheckCircle}      label="Present Days"     value={kpi.P}         iconBg="bg-green-50"  iconColor="text-green-600"  sub={`${kpi.attPct}% attendance`} />
            <KPI icon={FaCalendarAlt}      label="Half Days"        value={kpi.HD}        iconBg="bg-yellow-50" iconColor="text-yellow-600" />
            <KPI icon={FaExclamationTriangle} label="Punch Missing" value={kpi.PM}        iconBg="bg-orange-50" iconColor="text-orange-600" />
            <KPI icon={FaTimesCircle}      label="Absent Days"      value={kpi.A}         iconBg="bg-red-50"    iconColor="text-red-600"    />
            <KPI icon={FaClock}            label="Late Punches"     value={kpi.late}      iconBg="bg-purple-50" iconColor="text-purple-600" />
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-4 flex flex-col items-center justify-center text-white">
              <p className="text-3xl font-black">{kpi.attPct}%</p>
              <p className="text-[10px] text-indigo-200 font-semibold mt-1">Attendance Rate</p>
            </div>
          </div>

          {/* Trend Chart */}
          {dateStats.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <FaCalendarAlt className="text-indigo-400" size={13} /> Day-wise Attendance Trend
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dateStats} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 11, border: "1px solid #e2e8f0" }}
                    formatter={(v, n) => [v, n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="P"  name="Present"  fill="#4ade80" stackId="a" radius={[0,0,0,0]} />
                  <Bar dataKey="HD" name="Half Day" fill="#fbbf24" stackId="a" />
                  <Bar dataKey="PM" name="Punch Miss" fill="#fb923c" stackId="a" />
                  <Bar dataKey="A"  name="Absent"   fill="#f87171" stackId="a" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Department breakdown */}
            {deptStats.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <FaBuilding className="text-indigo-400" size={13} />
                  <h2 className="text-sm font-black text-gray-800">Department-wise Summary</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-100">
                        {["Department","Emp","P","HD","PM","A","Att%"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-bold text-gray-500 uppercase text-[10px] tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {deptStats.map((d, i) => (
                        <tr key={d.dept} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                          <td className="px-3 py-2 font-semibold text-gray-700 max-w-[120px] truncate">{d.dept}</td>
                          <td className="px-3 py-2 text-gray-500 font-bold">{d.total}</td>
                          <td className="px-3 py-2 text-green-700 font-bold">{d.P}</td>
                          <td className="px-3 py-2 text-yellow-700 font-bold">{d.HD}</td>
                          <td className="px-3 py-2 text-orange-700 font-bold">{d.PM}</td>
                          <td className="px-3 py-2 text-red-700 font-bold">{d.A}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[40px]">
                                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${d.pct}%` }} />
                              </div>
                              <span className={`font-bold text-[10px] w-8 ${d.pct >= 80 ? "text-green-600" : d.pct >= 60 ? "text-yellow-600" : "text-red-600"}`}>{d.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {/* Top Absentees */}
              {absentees.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <FaTimesCircle className="text-red-400" size={13} />
                    <h2 className="text-sm font-black text-gray-800">Top Absentees</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {absentees.map((e, i) => (
                      <div key={e.code || e.name} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">{e.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{e.code}</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">{e.A}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Late comers */}
              {lateList.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <FaClock className="text-purple-400" size={13} />
                    <h2 className="text-sm font-black text-gray-800">Frequent Late Comers</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {lateList.map((e, i) => (
                      <div key={e.code || e.name} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">{e.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{e.code}</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">{e.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attendance % line chart */}
          {dateStats.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <FaTrophy className="text-yellow-400" size={13} /> Attendance % Over Time
              </h2>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={dateStats} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="pct" name="Attendance %" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}

      {!loading && !fetched && (
        <div className="flex items-center justify-center py-32 text-center">
          <div>
            <MdTableChart className="text-6xl text-gray-200 mx-auto mb-4" />
            <p className="text-base font-bold text-gray-500">Select a date range and click Load</p>
            <p className="text-sm text-gray-400 mt-1">Dashboard will show KPIs, trends, and insights</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceDashboard;
