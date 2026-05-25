import { useState, useEffect } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import {
  FaUsers, FaMoneyBillWave, FaClock, FaMinusCircle,
  FaCloudUploadAlt, FaFileAlt, FaChartBar,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316"];
const now = new Date();

const KPI = ({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start gap-4">
    <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
      <Icon className={`text-lg ${iconColor}`} />
    </div>
    <div>
      <p className="text-2xl font-black text-gray-800 leading-none">{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [year,     setYear]     = useState(now.getFullYear());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  const fetchDashboard = async (m, y) => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}apprentice/dashboard`, { params: { month: m, year: y } });
      setData(res.data);
    } catch { toast.error("Failed to load dashboard"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(month, year); }, [month, year]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);
  const s = data?.summary;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl"><FaChartBar className="text-blue-600 text-xl" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">Apprentice Payroll Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Salary slip generation & analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={month} onChange={(e) => setMonth(+e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white">
              {FULL_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(+e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => navigate("/apprentice/upload")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200">
              <FaCloudUploadAlt size={13} /> Upload Files
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Upload Salary Files", desc: "Upload Excel files to generate slips", icon: FaCloudUploadAlt, color: "from-indigo-600 to-violet-700", href: "/apprentice/upload" },
            { label: "View Salary Slips",   desc: "Browse, filter and print slips",        icon: MdOutlineFactCheck, color: "from-emerald-500 to-teal-600",  href: "/apprentice/slips"  },
            { label: "History",             desc: "Past months payroll records",           icon: FaFileAlt,  color: "from-blue-500 to-blue-700",    href: "/apprentice/slips"  },
            { label: "Reports",             desc: "Department & summary reports",          icon: FaChartBar, color: "from-amber-500 to-orange-600",  href: "/apprentice/slips"  },
          ].map(({ label, desc, icon: Icon, color, href }) => (
            <button key={label} onClick={() => navigate(href)}
              className={`bg-gradient-to-br ${color} rounded-2xl p-5 text-white text-left hover:opacity-90 transition shadow-md`}>
              <Icon className="text-2xl mb-3 opacity-90" />
              <p className="font-black text-sm leading-tight">{label}</p>
              <p className="text-[10px] opacity-75 mt-1">{desc}</p>
            </button>
          ))}
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loading && s && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPI icon={FaUsers}         label="Total Employees"    value={s.totalEmp || 0}  iconBg="bg-indigo-50"  iconColor="text-indigo-600" />
              <KPI icon={FaMoneyBillWave} label="Total Gross Pay"    value={`₹${Number(s.totalGross||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`} iconBg="bg-blue-50"    iconColor="text-blue-600" />
              <KPI icon={FaMoneyBillWave} label="Total Net Pay"      value={`₹${Number(s.totalNet||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`}   iconBg="bg-emerald-50" iconColor="text-emerald-600" />
              <KPI icon={FaMinusCircle}   label="Total Deductions"   value={`₹${Number(s.totalDed||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`}   iconBg="bg-red-50"     iconColor="text-red-600" />
              <KPI icon={FaClock}         label="Total OT Amount"    value={`₹${Number(s.totalOT||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`}    iconBg="bg-purple-50"  iconColor="text-purple-600"
                sub={`${Number(s.totalOTHours||0).toFixed(1)} OT hrs`} />
              <div className={`rounded-2xl p-4 text-center flex flex-col items-center justify-center
                ${s.published === s.totalEmp ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                <p className={`text-2xl font-black ${s.published === s.totalEmp ? "text-green-700" : "text-amber-700"}`}>{s.published}/{s.totalEmp}</p>
                <p className="text-[10px] font-semibold text-gray-500">Published / Total</p>
                {s.draft > 0 && <p className="text-[10px] text-amber-600 mt-0.5">{s.draft} drafts pending</p>}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Dept-wise Net Pay bar chart */}
              {data.deptWise?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <h2 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                    <FaChartBar className="text-indigo-400" size={13} /> Department-wise Net Pay
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.deptWise} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="Department" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Net Pay"]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="netPay" fill="#6366f1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Dept-wise employee pie */}
              {data.deptWise?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <h2 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                    <FaUsers className="text-emerald-400" size={13} /> Employee Distribution
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.deptWise} dataKey="emp" nameKey="Department" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {data.deptWise.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [v, "Employees"]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Dept breakdown table */}
            {data.deptWise?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-black text-gray-800">Department-wise Summary — {FULL_MONTHS[month-1]} {year}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-100">
                        {["Department","Employees","Avg Present","Total Gross","Total OT","Deductions","Net Pay"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-500 uppercase text-[10px] tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.deptWise.map((d, i) => (
                        <tr key={d.Department} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                          <td className="px-4 py-2.5 font-bold text-gray-800">{d.Department}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-indigo-700">{d.emp}</td>
                          <td className="px-4 py-2.5 text-center text-green-700">{Number(d.avgPresent||0).toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">₹{Number(d.grossPay||0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-purple-600">₹{Number(d.otAmount||0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-red-600">₹{Number(d.deductions||0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right font-black text-emerald-700">₹{Number(d.netPay||0).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Available months */}
        {data?.months?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-black text-gray-800 mb-4">Salary History</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {data.months.map((m) => (
                <button key={`${m.SalaryMonth}-${m.SalaryYear}`}
                  onClick={() => { setMonth(m.SalaryMonth); setYear(m.SalaryYear); }}
                  className={`p-3 rounded-xl border text-center transition-all
                    ${month === m.SalaryMonth && year === m.SalaryYear
                      ? "border-indigo-400 bg-indigo-50 shadow-sm"
                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"}`}>
                  <p className="font-black text-sm text-gray-800">{MONTHS[m.SalaryMonth-1]} {m.SalaryYear}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{m.emp} employees</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">₹{Number(m.netPay||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !s && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
            <MdOutlineFactCheck className="text-6xl text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-500">No data for {FULL_MONTHS[month-1]} {year}</h3>
            <p className="text-sm text-gray-400 mt-1 mb-6">Upload salary files to generate data for this month</p>
            <button onClick={() => navigate("/apprentice/upload")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition shadow-md shadow-indigo-200">
              <FaCloudUploadAlt size={13} /> Upload Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
