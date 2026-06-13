import { useRef, useState } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaPrint, FaDownload, FaTimes, FaEnvelope, FaWhatsapp } from "react-icons/fa";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const inr = (v) => `₹ ${(parseFloat(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const fmtN = (v) => (parseFloat(v) || 0).toFixed(1);

// ── Print component ───────────────────────────────────────────────────────────
export const SalarySlipPrint = ({ slip }) => {
  if (!slip) return null;
  const m = MONTHS[(slip.SalaryMonth || 1) - 1];
  const y = slip.SalaryYear;

  const earnings = [
    { label: "Other Allowance", amount: slip.OtherAllowance },
    { label: "Arrear",          amount: slip.Arrear },
    { label: "Company Stipend", amount: slip.CompanyStipend },
    { label: "Government DBT",  amount: slip.GovernmentDBT },
    { label: "Total Stipend",   amount: slip.TotalStipend },
    { label: "Incentive",       amount: slip.Incentive },
  ].filter((e) => parseFloat(e.amount) > 0);

  const deductions = [
    { label: "Canteen",     amount: slip.Canteen },
    { label: "Hostel Rent", amount: slip.HostelRent },
    { label: "Electricity", amount: slip.Electricity },
    { label: "Uniform",     amount: slip.Uniform },
    { label: "Shoes",       amount: slip.Shoes },
    { label: "Other Ded.",  amount: slip.OtherDed },
  ].filter((d) => parseFloat(d.amount) > 0);

  const maxRows = Math.max(earnings.length, deductions.length, 3);
  const rows = Array.from({ length: maxRows }, (_, i) => ({ earn: earnings[i] || null, ded: deductions[i] || null }));

  return (
    <div id="salary-slip-print" className="bg-white font-sans text-[11px]"
      style={{ width: "210mm", minHeight: "297mm", padding: "12mm", boxSizing: "border-box", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ borderBottom: "3px solid #1e3a5f", paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#1e3a5f", margin: 0, letterSpacing: 1 }}>
              WESTERN REFRIGERATION PVT. LTD.
            </h1>
            <p style={{ fontSize: 10, color: "#64748b", margin: "2px 0 0 0" }}>
              Village Tadgam, Umargoan, Valsad, Gujarat – 396135 | CIN: U29299GJ1982PTC005386
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ background: "#1e3a5f", color: "white", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
              APPRENTICE SALARY SLIP
            </div>
            <p style={{ fontSize: 11, color: "#1e3a5f", fontWeight: 700, marginTop: 4 }}>{m} {y}</p>
          </div>
        </div>
      </div>

      {/* Employee details */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 14px", marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
          {[
            ["Employee Code", slip.EmpCode],
            ["Employee Name", slip.EmpName],
            ["Labour ID",     slip.LabourId],
            ["Category",      slip.Category],
            ["Department",    slip.Department],
            ["Location",      slip.Location],
            ["Date of Joining", slip.DateOfJoining],
            ["E-mail",        slip.Email],
            ["Month & Year",  `${m} ${y}`],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", gap: 4 }}>
              <span style={{ color: "#64748b", minWidth: 110, flexShrink: 0 }}>{label}:</span>
              <span style={{ fontWeight: 700, color: "#1e293b", wordBreak: "break-all" }}>{val || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#1e3a5f", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Attendance</p>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Paid Days (P)", val: slip.PresentDays, color: "#d1fae5", text: "#065f46" },
            { label: "Loss of Pay",   val: slip.LOP,         color: "#fee2e2", text: "#991b1b" },
          ].map(({ label, val, color, text }) => (
            <div key={label} style={{ flex: 1, background: color, border: `1px solid ${text}40`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: text, margin: 0 }}>{fmtN(val)}</p>
              <p style={{ fontSize: 9, color: text, opacity: 0.8, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings + Deductions */}
      <div style={{ marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "white" }}>
              <th style={{ padding: "6px 10px", textAlign: "left", width: "25%" }}>Earnings</th>
              <th style={{ padding: "6px 10px", textAlign: "right", width: "25%", borderRight: "1px solid white" }}>Amount (₹)</th>
              <th style={{ padding: "6px 10px", textAlign: "left", width: "25%" }}>Deductions</th>
              <th style={{ padding: "6px 10px", textAlign: "right", width: "25%" }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                <td style={{ padding: "5px 10px", color: "#1e293b" }}>{row.earn?.label || ""}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", fontWeight: row.earn ? 700 : 400, color: row.earn ? "#065f46" : "" }}>
                  {row.earn ? inr(row.earn.amount) : ""}
                </td>
                <td style={{ padding: "5px 10px", color: "#1e293b" }}>{row.ded?.label || ""}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: row.ded ? 700 : 400, color: row.ded ? "#991b1b" : "" }}>
                  {row.ded ? inr(row.ded.amount) : ""}
                </td>
              </tr>
            ))}
            <tr style={{ background: "#f0fdf4", fontWeight: 800, borderTop: "2px solid #1e3a5f" }}>
              <td style={{ padding: "6px 10px", color: "#1e3a5f" }}>GROSS AMOUNT</td>
              <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#065f46" }}>{inr(slip.GrossAmount)}</td>
              <td style={{ padding: "6px 10px", color: "#1e3a5f" }}>NET DEDUCTION</td>
              <td style={{ padding: "6px 10px", textAlign: "right", color: "#991b1b" }}>{inr(slip.NetDeduction)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Net payment */}
      <div style={{ background: "#1e3a5f", borderRadius: 8, padding: "12px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Net Payment (Take Home)</span>
        <span style={{ color: "white", fontSize: 22, fontWeight: 900 }}>{inr(slip.NetPayment)}</span>
      </div>

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px dashed #e2e8f0" }}>
        {["Employee Signature", "HR Signature", "Authorized Signatory"].map((label) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ height: 36, borderBottom: "1px solid #1e293b", width: 140, marginBottom: 4 }} />
            <p style={{ fontSize: 10, color: "#64748b" }}>{label}</p>
          </div>
        ))}
      </div>

      <p style={{ textAlign: "center", fontSize: 9, color: "#94a3b8", marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
        This is a computer-generated salary slip and does not require a physical signature. | Generated by WRL Payroll System
      </p>
    </div>
  );
};

// ── Modal wrapper ─────────────────────────────────────────────────────────────
const SlipViewer = ({ slip, onClose, onEmailed }) => {
  const printRef = useRef();
  const [emailing, setEmailing] = useState(false);

  const handlePrint = () => {
    const content = document.getElementById("salary-slip-print");
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(`
      <html><head><title>Salary Slip - ${slip?.EmpCode}</title>
      <style>
        body { margin: 0; font-family: 'Segoe UI', sans-serif; }
        @media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>${content.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const m = MONTHS[(slip.SalaryMonth || 1) - 1];

    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text("WESTERN REFRIGERATION PVT. LTD.", 15, 12);
    doc.setFontSize(8); doc.setFont(undefined, "normal");
    doc.text("Village Tadgam, Umargoan, Valsad, Gujarat – 396135", 15, 18);
    doc.setFontSize(11); doc.setFont(undefined, "bold");
    doc.text("APPRENTICE SALARY SLIP", 138, 12);
    doc.text(`${m} ${slip.SalaryYear}`, 155, 19);

    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: 32, head: [],
      body: [
        ["Employee Code", slip.EmpCode || "", "Category", slip.Category || ""],
        ["Employee Name", slip.EmpName || "", "Department", slip.Department || ""],
        ["Labour ID", slip.LabourId || "", "Location", slip.Location || ""],
        ["Date of Joining", slip.DateOfJoining || "", "E-mail", slip.Email || "—"],
        ["Paid Days (P)", String(slip.PresentDays), "Loss of Pay", String(slip.LOP)],
      ],
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 32 },
        1: { fontStyle: "bold", cellWidth: 58 },
        2: { fontStyle: "bold", textColor: [100, 116, 139], cellWidth: 32 },
        3: { fontStyle: "bold", cellWidth: 58 },
      },
    });

    const earnRows = [
      ["Other Allowance", slip.OtherAllowance], ["Arrear", slip.Arrear],
      ["Company Stipend", slip.CompanyStipend], ["Government DBT", slip.GovernmentDBT],
      ["Total Stipend", slip.TotalStipend], ["Incentive", slip.Incentive],
    ].filter(([, v]) => parseFloat(v) > 0);
    const dedRows = [
      ["Canteen", slip.Canteen], ["Hostel Rent", slip.HostelRent], ["Electricity", slip.Electricity],
      ["Uniform", slip.Uniform], ["Shoes", slip.Shoes], ["Other Ded.", slip.OtherDed],
    ].filter(([, v]) => parseFloat(v) > 0);

    const maxR = Math.max(earnRows.length, dedRows.length);
    const combined = Array.from({ length: maxR }, (_, i) => [
      earnRows[i]?.[0] || "", earnRows[i] ? `Rs. ${parseFloat(earnRows[i][1]).toFixed(2)}` : "",
      dedRows[i]?.[0] || "",  dedRows[i] ? `Rs. ${parseFloat(dedRows[i][1]).toFixed(2)}` : "",
    ]);
    combined.push([
      "GROSS AMOUNT", `Rs. ${parseFloat(slip.GrossAmount || 0).toFixed(2)}`,
      "NET DEDUCTION", `Rs. ${parseFloat(slip.NetDeduction || 0).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 4,
      head: [["Earnings", "Amount", "Deductions", "Amount"]],
      body: combined,
      headStyles: { fillColor: [30, 58, 95], fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    });

    const y = doc.lastAutoTable.finalY + 6;
    doc.setFillColor(30, 58, 95);
    doc.rect(15, y, 180, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9); doc.text("NET PAYMENT (TAKE HOME)", 20, y + 8);
    doc.setFontSize(13); doc.setFont(undefined, "bold");
    doc.text(`Rs. ${parseFloat(slip.NetPayment || 0).toFixed(2)}`, 150, y + 8, { align: "right" });

    doc.save(`SalarySlip_${slip.EmpCode}_${m}_${slip.SalaryYear}.pdf`);
  };

  const handleEmail = async () => {
    if (!slip.Email) { toast.error("No e-mail address on record for this employee"); return; }
    setEmailing(true);
    try {
      await axios.post(`${baseURL}apprentice/slips/${slip.Id}/email`);
      toast.success(`Slip e-mailed to ${slip.Email}`);
      onEmailed && onEmailed(slip.Id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send e-mail");
    } finally {
      setEmailing(false);
    }
  };

  const handleWhatsApp = () => {
    if (!slip.MobileNo) { toast.error("No mobile number on record for this employee"); return; }
    const phone = slip.MobileNo.replace(/\D/g, "");
    const fullPhone = phone.length === 10 ? `91${phone}` : phone;
    const m = MONTHS[(slip.SalaryMonth || 1) - 1];
    const message =
      `Hi ${slip.EmpName},\n\nYour salary slip for *${m} ${slip.SalaryYear}* is ready.\n\n` +
      `Gross Amount: ${inr(slip.GrossAmount)}\n` +
      `Total Deductions: ${inr(slip.NetDeduction)}\n` +
      `*Net Payment: ${inr(slip.NetPayment)}*\n\n` +
      `Regards,\nWRL Payroll`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (!slip) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden">
        <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-sm">{slip.EmpName} — Salary Slip</span>
          <div className="flex items-center gap-2">
            <button onClick={handleEmail} disabled={emailing || !slip.Email}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition disabled:opacity-40">
              {emailing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaEnvelope size={11} />} E-mail
            </button>
            <button onClick={handleWhatsApp} disabled={!slip.MobileNo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition disabled:opacity-40">
              <FaWhatsapp size={12} /> WhatsApp
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition">
              <FaPrint size={11} /> Print
            </button>
            <button onClick={handlePDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition">
              <FaDownload size={11} /> PDF
            </button>
            <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition">
              <FaTimes size={13} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto" ref={printRef}>
          <SalarySlipPrint slip={slip} />
        </div>
      </div>
    </div>
  );
};

export default SlipViewer;