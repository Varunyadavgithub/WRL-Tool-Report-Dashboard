import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import {
  FaSearch, FaSync, FaEye, FaCheckDouble, FaFilter,
  FaFileAlt, FaSortAmountDown, FaDownload,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";
import SlipViewer from "./SlipViewer";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();

const SlipList = () => {
  const [month,     setMonth]     = useState(now.getMonth() + 1);
  const [year,      setYear]      = useState(now.getFullYear());
  const [slips,     setSlips]     = useState([]);
  const [meta,      setMeta]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState("");
  const [dept,      setDept]      = useState("");
  const [status,    setStatus]    = useState("");
  const [viewSlip,  setViewSlip]  = useState(null);
  const [publishing,setPublishing] = useState(false);
  const [depts,     setDepts]     = useState([]);

  const fetchSlips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}apprentice/slips`, {
        params: { month, year, search, dept, status, limit: 500 },
      });
      setSlips(res.data.data || []);
      setMeta(res.data.meta || null);
      const uniqueDepts = [...new Set((res.data.data || []).map((s) => s.Department).filter(Boolean))].sort();
      setDepts(uniqueDepts);
    } catch (err) {
      toast.error("Failed to load slips");
    } finally {
      setLoading(false);
    }
  }, [month, year, search, dept, status]);

  useEffect(() => { fetchSlips(); }, [month, year]);

  const handlePublishAll = async () => {
    setPublishing(true);
    try {
      const res = await axios.put(`${baseURL}apprentice/slips/publish-all`, { month, year });
      toast.success(`${res.data.updated} slips published`);
      fetchSlips();
    } catch (err) {
      toast.error("Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const handleViewSlip = async (id) => {
    try {
      const res = await axios.get(`${baseURL}apprentice/slips/${id}`);
      setViewSlip(res.data.data);
    } catch { toast.error("Could not load slip"); }
  };

  const exportExcel = () => {
    import("xlsx").then((XLSX) => {
      const rows = slips.map((s) => ({
        "Emp Code": s.EmpCode, "Name": s.EmpName, "Department": s.Department, "Category": s.Category,
        "Present": s.PresentDays, "WO": s.WeeklyOff, "HD": s.HalfDays, "Absent": s.AbsentDays, "OT Hrs": s.OTHours,
        "Stipend": s.Stipend, "OT Amt": s.OTAmount, "Bonus": s.Bonus,
        "Gross Pay": s.GrossPay, "Deductions": s.TotalDeductions, "Net Pay": s.NetPay, "Status": s.Status,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Salary");
      XLSX.writeFile(wb, `Salary_${MONTHS[month-1]}_${year}.xlsx`);
    });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12); doc.setFont(undefined, "bold");
    doc.text(`Salary Report — ${MONTHS[month-1]} ${year}`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Code","Name","Dept","Present","WO","HD","Absent","OT Hrs","Gross","Deductions","Net Pay"]],
      body: slips.map((s) => [s.EmpCode,s.EmpName,s.Department,s.PresentDays,s.WeeklyOff,s.HalfDays,s.AbsentDays,s.OTHours,
        `${parseFloat(s.GrossPay||0).toFixed(0)}`,`${parseFloat(s.TotalDeductions||0).toFixed(0)}`,`${parseFloat(s.NetPay||0).toFixed(0)}`]),
      headStyles: { fillColor: [30, 58, 95] },
      styles: { fontSize: 7 },
    });
    doc.save(`SalaryReport_${MONTHS[month-1]}_${year}.pdf`);
  };

  const filtered = slips.filter((s) => {
    if (search && !s.EmpCode?.toLowerCase().includes(search.toLowerCase()) && !s.EmpName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (dept   && s.Department !== dept) return false;
    if (status && s.Status !== status)   return false;
    return true;
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);
  const draftCount   = slips.filter((s) => s.Status === "draft").length;
  const pubCount     = slips.filter((s) => s.Status === "published").length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {viewSlip && <SlipViewer slip={viewSlip} onClose={() => setViewSlip(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl"><MdOutlineFactCheck className="text-indigo-600 text-xl" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">Salary Slips</h1>
              <p className="text-xs text-gray-400 mt-0.5">View, publish & download apprentice salary slips</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={exportExcel} disabled={!slips.length}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl text-xs font-semibold transition disabled:opacity-40">
              <FaDownload size={10} /> Excel
            </button>
            <button onClick={exportPDF} disabled={!slips.length}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition disabled:opacity-40">
              <FaDownload size={10} /> PDF
            </button>
            {draftCount > 0 && (
              <button onClick={handlePublishAll} disabled={publishing}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50">
                {publishing ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaCheckDouble size={11} />}
                Publish All ({draftCount})
              </button>
            )}
            <button onClick={fetchSlips} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded-xl text-xs font-semibold transition">
              <FaSync size={10} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Month</label>
              <select value={month} onChange={(e) => setMonth(+e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Year</label>
              <select value={year} onChange={(e) => setYear(+e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Department</label>
              <select value={dept} onChange={(e) => setDept(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white min-w-[160px]">
                <option value="">All Departments</option>
                {depts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={11} />
                <input type="text" placeholder="Name or Emp Code…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>
            <button onClick={fetchSlips} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition">
              <FaSearch size={11} /> Search
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        {meta && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Employees", val: meta.totalEmp || slips.length, color: "text-indigo-700", bg: "bg-indigo-50" },
              { label: "Draft", val: draftCount, color: "text-amber-700", bg: "bg-amber-50" },
              { label: "Published", val: pubCount, color: "text-green-700", bg: "bg-green-50" },
              { label: "Total Gross", val: `₹${Number(meta.totalGross||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`, color: "text-blue-700", bg: "bg-blue-50" },
              { label: "Total Deductions", val: `₹${Number(meta.totalDed||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`, color: "text-red-700", bg: "bg-red-50" },
              { label: "Total Net Pay", val: `₹${Number(meta.totalNet||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`, color: "text-emerald-700", bg: "bg-emerald-50" },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className={`${bg} border border-gray-100 rounded-xl p-3 text-center`}>
                <p className={`text-xl font-black ${color}`}>{val}</p>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">Loading salary slips…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
            <FaFileAlt className="text-5xl text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-400">No salary slips found for {MONTHS[month-1]} {year}</p>
            <p className="text-xs text-gray-400 mt-1">Upload salary files to generate slips</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Showing <span className="font-bold text-gray-700">{filtered.length}</span> slips for <span className="font-bold text-gray-700">{MONTHS[month-1]} {year}</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {["#","Code","Name","Department","Category","P","WO","HD","A","OT Hrs","Stipend","OT Amt","Gross","Deductions","Net Pay","Status","Action"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s, i) => (
                    <tr key={s.Id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-indigo-50/20 transition-colors`}>
                      <td className="px-3 py-2.5 text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-gray-700">{s.EmpCode}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{s.EmpName}</td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate">{s.Department}</td>
                      <td className="px-3 py-2.5 text-gray-500">{s.Category || "—"}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-green-700">{s.PresentDays}</td>
                      <td className="px-3 py-2.5 text-center text-blue-600">{s.WeeklyOff}</td>
                      <td className="px-3 py-2.5 text-center text-yellow-600">{s.HalfDays}</td>
                      <td className="px-3 py-2.5 text-center text-red-600">{s.AbsentDays}</td>
                      <td className="px-3 py-2.5 text-center text-purple-600">{s.OTHours}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{Number(s.Stipend||0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{Number(s.OTAmount||0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-800">₹{Number(s.GrossPay||0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-red-600">₹{Number(s.TotalDeductions||0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right font-black text-emerald-700">₹{Number(s.NetPay||0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold
                          ${s.Status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {s.Status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => handleViewSlip(s.Id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold transition border border-indigo-100">
                          <FaEye size={9} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="bg-slate-800 text-white font-bold">
                    <td colSpan={10} className="px-3 py-2.5 text-right text-xs uppercase tracking-wider">Totals →</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{filtered.reduce((s, r) => s + Number(r.Stipend||0), 0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{filtered.reduce((s, r) => s + Number(r.OTAmount||0), 0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{filtered.reduce((s, r) => s + Number(r.GrossPay||0), 0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{filtered.reduce((s, r) => s + Number(r.TotalDeductions||0), 0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-300 font-black">₹{filtered.reduce((s, r) => s + Number(r.NetPay||0), 0).toLocaleString("en-IN")}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlipList;
