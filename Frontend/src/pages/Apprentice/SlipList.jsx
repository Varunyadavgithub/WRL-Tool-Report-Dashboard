import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import {
  FaSearch, FaSync, FaEye, FaCheckDouble, FaFileAlt,
  FaDownload, FaEnvelope, FaPaperPlane, FaWhatsapp,
} from "react-icons/fa";
import { MdOutlineFactCheck } from "react-icons/md";
import SlipViewer from "./SlipViewer";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const now = new Date();
const inr = (v) => Number(v || 0).toLocaleString("en-IN");

const STATUS_STYLE = {
  draft:     "bg-amber-100 text-amber-700",
  published: "bg-blue-100 text-blue-700",
  emailed:   "bg-green-100 text-green-700",
};

const SlipList = () => {
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year,  setYear]    = useState(now.getFullYear());
  const [slips, setSlips]   = useState([]);
  const [meta,  setMeta]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dept,   setDept]   = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [viewSlip, setViewSlip] = useState(null);
  const [emailingAll, setEmailingAll] = useState(false);
  const [rowEmailing, setRowEmailing] = useState(null);
  const [depts, setDepts] = useState([]);
  const [cats,  setCats]  = useState([]);
  const [showWaAll, setShowWaAll] = useState(false);
  const [waSent, setWaSent] = useState({});

  const fetchSlips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}apprentice/slips`, {
        params: { month, year, search, dept, category, status, limit: 1000 },
      });
      const data = res.data.data || [];
      setSlips(data);
      setMeta(res.data.meta || null);
      setDepts([...new Set(data.map((s) => s.Department).filter(Boolean))].sort());
      setCats([...new Set(data.map((s) => s.Category).filter(Boolean))].sort());
    } catch {
      toast.error("Failed to load slips");
    } finally {
      setLoading(false);
    }
  }, [month, year, search, dept, category, status]);

  useEffect(() => { fetchSlips(); }, [month, year]);

  const handleEmailAll = async () => {
    if (!window.confirm(`E-mail salary slips to all apprentices with an e-mail address for ${MONTHS[month-1]} ${year}?`)) return;
    setEmailingAll(true);
    try {
      const res = await axios.post(`${baseURL}apprentice/email-all`, { month, year });
      toast.success(`Sent ${res.data.sent} • Failed ${res.data.failed}`);
      fetchSlips();
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk e-mail failed");
    } finally {
      setEmailingAll(false);
    }
  };

  const handleRowEmail = async (s) => {
    if (!s.Email) { toast.error("No e-mail on record"); return; }
    setRowEmailing(s.Id);
    try {
      await axios.post(`${baseURL}apprentice/slips/${s.Id}/email`);
      toast.success(`Sent to ${s.Email}`);
      setSlips((prev) => prev.map((x) => x.Id === s.Id ? { ...x, Status: "emailed" } : x));
    } catch (err) {
      toast.error(err.response?.data?.message || "Send failed");
    } finally {
      setRowEmailing(null);
    }
  };

  const buildWaLink = (s) => {
    const phone = s.MobileNo.replace(/\D/g, "");
    const fullPhone = phone.length === 10 ? `91${phone}` : phone;
    const m = MONTHS[(s.SalaryMonth || month) - 1];
    const message =
      `Hi ${s.EmpName},\n\nYour salary slip for *${m} ${s.SalaryYear || year}* is ready.\n\n` +
      `Gross Amount: Rs.${inr(s.GrossAmount)}\n` +
      `Total Deductions: Rs.${inr(s.NetDeduction)}\n` +
      `*Net Payment: Rs.${inr(s.NetPayment)}*\n\n` +
      `Regards,\nWRL Payroll`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsApp = (s) => {
    if (!s.MobileNo) { toast.error("No mobile number on record"); return; }
    window.open(buildWaLink(s), "_blank");
  };

  const handleWhatsAppAllSend = (s) => {
    window.open(buildWaLink(s), "_blank");
    setWaSent((prev) => ({ ...prev, [s.Id]: true }));
  };

  const handleWhatsAppSendAll = () => {
    const targets = slips.filter((s) => s.MobileNo && !waSent[s.Id]);
    if (!targets.length) return;
    targets.forEach((s) => window.open(buildWaLink(s), "_blank"));
    setWaSent((prev) => {
      const next = { ...prev };
      targets.forEach((s) => { next[s.Id] = true; });
      return next;
    });
    toast.success(`Opened ${targets.length} WhatsApp chats — if some didn't open, allow popups for this site.`);
  };

  const handlePublishAll = async () => {
    try {
      const res = await axios.put(`${baseURL}apprentice/slips/publish-all`, { month, year });
      toast.success(`${res.data.updated} slips published`);
      fetchSlips();
    } catch { toast.error("Publish failed"); }
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
        "Emp Code": s.EmpCode, "Labour ID": s.LabourId, "Email": s.Email, "Name": s.EmpName,
        "Category": s.Category, "Department": s.Department, "Location": s.Location, "DOJ": s.DateOfJoining,
        "P Day": s.PresentDays, "LOP": s.LOP,
        "Company Stipend": s.CompanyStipend, "Govt DBT": s.GovernmentDBT, "Total Stipend": s.TotalStipend,
        "Incentive": s.Incentive, "Gross": s.GrossAmount,
        "Net Deduction": s.NetDeduction, "Net Payment": s.NetPayment, "Status": s.Status,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Salary");
      XLSX.writeFile(wb, `Salary_${MONTHS[month-1]}_${year}.xlsx`);
    });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12); doc.setFont(undefined, "bold");
    doc.text(`Apprentice Salary Report — ${MONTHS[month-1]} ${year}`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Code","Name","Dept","Category","P","LOP","Stipend","Incentive","Gross","Net Ded.","Net Pay"]],
      body: filtered.map((s) => [
        s.EmpCode, s.EmpName, s.Department, s.Category, s.PresentDays, s.LOP,
        Number(s.TotalStipend||0).toFixed(0), Number(s.Incentive||0).toFixed(0),
        Number(s.GrossAmount||0).toFixed(0), Number(s.NetDeduction||0).toFixed(0), Number(s.NetPayment||0).toFixed(0),
      ]),
      headStyles: { fillColor: [30, 58, 95] },
      styles: { fontSize: 7 },
    });
    doc.save(`SalaryReport_${MONTHS[month-1]}_${year}.pdf`);
  };

  const filtered = slips.filter((s) => {
    if (search && !s.EmpCode?.toLowerCase().includes(search.toLowerCase()) && !s.EmpName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (dept && s.Department !== dept) return false;
    if (category && s.Category !== category) return false;
    if (status && s.Status !== status) return false;
    return true;
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);
  const draftCount   = slips.filter((s) => s.Status === "draft").length;
  const emailedCount = slips.filter((s) => s.Status === "emailed").length;
  const withEmail    = slips.filter((s) => s.Email).length;
  const withMobile   = slips.filter((s) => s.MobileNo).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {viewSlip && (
        <SlipViewer slip={viewSlip} onClose={() => setViewSlip(null)}
          onEmailed={(id) => setSlips((prev) => prev.map((x) => x.Id === id ? { ...x, Status: "emailed" } : x))} />
      )}

      {showWaAll && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 overflow-hidden">
            <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
              <span className="text-white font-bold text-sm flex items-center gap-2"><FaWhatsapp /> Send Salary Slips via WhatsApp</span>
              <button onClick={() => setShowWaAll(false)} className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-xs">Close</button>
            </div>
            <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                Opens a WhatsApp chat per apprentice with the slip summary pre-filled, ready to send.
              </p>
              <button onClick={handleWhatsAppSendAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[11px] font-bold transition shadow-sm whitespace-nowrap">
                <FaWhatsapp size={11} /> Send All
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
              {slips.filter((s) => s.MobileNo).map((s) => (
                <div key={s.Id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-gray-800">{s.EmpName} <span className="text-gray-400 font-mono">({s.EmpCode})</span></p>
                    <p className="text-[11px] text-gray-400">{s.MobileNo} • Net Pay ₹{inr(s.NetPayment)}</p>
                  </div>
                  <button onClick={() => handleWhatsAppAllSend(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                      waSent[s.Id] ? "bg-green-50 text-green-600 border border-green-100" : "bg-green-500 hover:bg-green-600 text-white"
                    }`}>
                    <FaWhatsapp size={11} /> {waSent[s.Id] ? "Sent" : "Send"}
                  </button>
                </div>
              ))}
              {slips.filter((s) => s.MobileNo).length === 0 && (
                <p className="text-center text-xs text-gray-400 py-8">No apprentices with a mobile number on record.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl"><MdOutlineFactCheck className="text-indigo-600 text-xl" /></div>
            <div>
              <h1 className="text-base font-black text-gray-800 leading-none">Apprentice Salary Slips</h1>
              <p className="text-xs text-gray-400 mt-0.5">View, publish, e-mail &amp; download slips</p>
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
              <button onClick={handlePublishAll}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm">
                <FaCheckDouble size={11} /> Publish All ({draftCount})
              </button>
            )}
            <button onClick={handleEmailAll} disabled={emailingAll || !withEmail}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50">
              {emailingAll ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaPaperPlane size={11} />}
              E-mail All ({withEmail})
            </button>
            <button onClick={() => setShowWaAll(true)} disabled={!withMobile}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50">
              <FaWhatsapp size={12} /> WhatsApp All ({withMobile})
            </button>
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
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white min-w-[150px]">
                <option value="">All Departments</option>
                {depts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value="">All</option>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="emailed">E-mailed</option>
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
          </div>
        </div>

        {/* KPIs */}
        {meta && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Apprentices", val: meta.totalEmp || slips.length, color: "text-indigo-700", bg: "bg-indigo-50" },
              { label: "Draft", val: draftCount, color: "text-amber-700", bg: "bg-amber-50" },
              { label: "E-mailed", val: emailedCount, color: "text-green-700", bg: "bg-green-50" },
              { label: "Total Gross", val: `₹${inr(meta.totalGross)}`, color: "text-blue-700", bg: "bg-blue-50" },
              { label: "Total Deductions", val: `₹${inr(meta.totalDed)}`, color: "text-red-700", bg: "bg-red-50" },
              { label: "Total Net Pay", val: `₹${inr(meta.totalNet)}`, color: "text-emerald-700", bg: "bg-emerald-50" },
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
            <p className="font-bold text-gray-400">No salary slips for {MONTHS[month-1]} {year}</p>
            <p className="text-xs text-gray-400 mt-1">Upload the pay-slip Excel to generate slips</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                Showing <span className="font-bold text-gray-700">{filtered.length}</span> slips for <span className="font-bold text-gray-700">{MONTHS[month-1]} {year}</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {["#","Code","Name","Department","Category","P","LOP","Stipend","Incentive","Gross","Net Ded.","Net Pay","Status","Action"].map((h) => (
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
                      <td className="px-3 py-2.5 text-gray-500 max-w-[140px] truncate">{s.Department}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{s.Category || "—"}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-green-700">{s.PresentDays}</td>
                      <td className="px-3 py-2.5 text-center text-red-600">{s.LOP}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{inr(s.TotalStipend)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{inr(s.Incentive)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-800">₹{inr(s.GrossAmount)}</td>
                      <td className="px-3 py-2.5 text-right text-red-600">₹{inr(s.NetDeduction)}</td>
                      <td className="px-3 py-2.5 text-right font-black text-emerald-700">₹{inr(s.NetPayment)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[s.Status] || "bg-gray-100 text-gray-600"}`}>
                          {s.Status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleViewSlip(s.Id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold transition border border-indigo-100">
                            <FaEye size={9} /> View
                          </button>
                          <button onClick={() => handleRowEmail(s)} disabled={!s.Email || rowEmailing === s.Id}
                            title={s.Email || "No e-mail on record"}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-[10px] font-bold transition border border-amber-100 disabled:opacity-40">
                            {rowEmailing === s.Id
                              ? <div className="w-2.5 h-2.5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                              : <FaEnvelope size={9} />}
                          </button>
                          <button onClick={() => handleWhatsApp(s)} disabled={!s.MobileNo}
                            title={s.MobileNo || "No mobile number on record"}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-[10px] font-bold transition border border-green-100 disabled:opacity-40">
                            <FaWhatsapp size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white font-bold">
                    <td colSpan={7} className="px-3 py-2.5 text-right text-xs uppercase tracking-wider">Totals →</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{inr(filtered.reduce((a, r) => a + Number(r.TotalStipend||0), 0))}</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{inr(filtered.reduce((a, r) => a + Number(r.Incentive||0), 0))}</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{inr(filtered.reduce((a, r) => a + Number(r.GrossAmount||0), 0))}</td>
                    <td className="px-3 py-2.5 text-right text-xs">₹{inr(filtered.reduce((a, r) => a + Number(r.NetDeduction||0), 0))}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-300 font-black">₹{inr(filtered.reduce((a, r) => a + Number(r.NetPayment||0), 0))}</td>
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