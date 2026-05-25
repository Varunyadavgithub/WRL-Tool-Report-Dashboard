import { useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaPrint, FaDownload, FaTimes } from "react-icons/fa";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n === 0 ? "—" : `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};
const fmtN = (v) => { const n = parseFloat(v) || 0; return n.toFixed(2); };

// ── Print Salary Slip Component ───────────────────────────────────────────────
export const SalarySlipPrint = ({ slip }) => {
  if (!slip) return null;
  const m = MONTHS[(slip.SalaryMonth || 1) - 1];
  const y = slip.SalaryYear;

  const earnings = [
    { label: "Stipend",   amount: slip.Stipend   },
    { label: "OT Amount", amount: slip.OTAmount  },
    { label: "Bonus",     amount: slip.Bonus     },
    { label: "Incentive", amount: slip.Incentive },
  ].filter((e) => parseFloat(e.amount) > 0);

  const deductions = [
    { label: "Hostel",      amount: slip.Hostel      },
    { label: "Canteen",     amount: slip.Canteen     },
    { label: "Electricity", amount: slip.Electricity },
    { label: "Uniform",     amount: slip.Uniform     },
    { label: "Shoes",       amount: slip.Shoes       },
    { label: "Other",       amount: slip.OtherDeductions },
  ].filter((d) => parseFloat(d.amount) > 0);

  const maxRows = Math.max(earnings.length, deductions.length, 3);
  const rows = Array.from({ length: maxRows }, (_, i) => ({
    earn: earnings[i] || null,
    ded:  deductions[i] || null,
  }));

  const dayWise = slip.DayWiseData && typeof slip.DayWiseData === "object" ? slip.DayWiseData : null;
  const STATUS_COLORS = { P: "#d1fae5", WO: "#dbeafe", HD: "#fef9c3", A: "#fee2e2" };

  return (
    <div id="salary-slip-print" className="bg-white font-sans text-[11px]" style={{ width: "210mm", minHeight: "297mm", padding: "10mm", boxSizing: "border-box", margin: "0 auto" }}>

      {/* Company Header */}
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

      {/* Employee Details */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 14px", marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
          {[
            ["Employee Code", slip.EmpCode],
            ["Employee Name", slip.EmpName],
            ["Department",    slip.Department],
            ["Category",      slip.Category || "Apprentice"],
            ["Month & Year",  `${m} ${y}`],
            ["Bank Account",  slip.BankAccount || "—"],
            ...(slip.UAN ? [["UAN / PF No.", slip.UAN]] : []),
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", gap: 4 }}>
              <span style={{ color: "#64748b", minWidth: 100, flexShrink: 0 }}>{label}:</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{val || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance Summary */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#1e3a5f", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Attendance Summary</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Present Days", val: slip.PresentDays, color: "#d1fae5", text: "#065f46" },
            { label: "Weekly Off",   val: slip.WeeklyOff,   color: "#dbeafe", text: "#1e40af" },
            { label: "Half Days",    val: slip.HalfDays,    color: "#fef9c3", text: "#854d0e" },
            { label: "Absent Days",  val: slip.AbsentDays,  color: "#fee2e2", text: "#991b1b" },
            { label: "OT Hours",     val: slip.OTHours,     color: "#f3e8ff", text: "#6b21a8" },
          ].map(({ label, val, color, text }) => (
            <div key={label} style={{ flex: 1, minWidth: 80, background: color, border: `1px solid ${text}40`, borderRadius: 6, padding: "6px 10px", textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 900, color: text, margin: 0 }}>{fmtN(val)}</p>
              <p style={{ fontSize: 9, color: text, opacity: 0.8, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Day-wise if available */}
      {dayWise && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#1e3a5f", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Day-wise Attendance</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(16, 1fr)", gap: 2 }}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
              const v = dayWise[d] || "";
              const bg = STATUS_COLORS[v] || "#f1f5f9";
              return (
                <div key={d} style={{ background: bg, borderRadius: 3, padding: "2px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "#64748b" }}>{d}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#1e293b" }}>{v || "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Earnings + Deductions table */}
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
                  {row.earn ? `₹ ${parseFloat(row.earn.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : ""}
                </td>
                <td style={{ padding: "5px 10px", color: "#1e293b" }}>{row.ded?.label || ""}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: row.ded ? 700 : 400, color: row.ded ? "#991b1b" : "" }}>
                  {row.ded ? `₹ ${parseFloat(row.ded.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : ""}
                </td>
              </tr>
            ))}
            {/* Totals */}
            <tr style={{ background: "#f0fdf4", fontWeight: 800, borderTop: "2px solid #1e3a5f" }}>
              <td style={{ padding: "6px 10px", color: "#1e3a5f" }}>GROSS PAY</td>
              <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#065f46" }}>
                ₹ {parseFloat(slip.GrossPay || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td style={{ padding: "6px 10px", color: "#1e3a5f" }}>TOTAL DEDUCTIONS</td>
              <td style={{ padding: "6px 10px", textAlign: "right", color: "#991b1b" }}>
                ₹ {parseFloat(slip.TotalDeductions || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Net Pay highlight */}
      <div style={{ background: "#1e3a5f", borderRadius: 8, padding: "12px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Net Pay (Take Home)</span>
        <span style={{ color: "white", fontSize: 22, fontWeight: 900 }}>
          ₹ {parseFloat(slip.NetPay || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px dashed #e2e8f0" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ height: 36, borderBottom: "1px solid #1e293b", width: 140, marginBottom: 4 }}></div>
          <p style={{ fontSize: 10, color: "#64748b" }}>Employee Signature</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ height: 36, borderBottom: "1px solid #1e293b", width: 140, marginBottom: 4 }}></div>
          <p style={{ fontSize: 10, color: "#64748b" }}>HR Signature</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ height: 36, borderBottom: "1px solid #1e293b", width: 140, marginBottom: 4 }}></div>
          <p style={{ fontSize: 10, color: "#64748b" }}>Authorized Signatory</p>
        </div>
      </div>

      {/* Footer note */}
      <p style={{ textAlign: "center", fontSize: 9, color: "#94a3b8", marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
        This is a computer-generated salary slip and does not require a physical signature. | Generated by WRL Payroll System
      </p>
    </div>
  );
};

// ── Modal Wrapper ─────────────────────────────────────────────────────────────
const SlipViewer = ({ slip, onClose }) => {
  const printRef = useRef();

  const handlePrint = () => {
    const content = document.getElementById("salary-slip-print");
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(`
      <html><head><title>Salary Slip - ${slip?.EmpCode}</title>
      <style>
        body { margin: 0; font-family: 'Segoe UI', sans-serif; }
        @media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>${content.outerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const m = MONTHS[(slip.SalaryMonth || 1) - 1];

    // Header
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text("WESTERN REFRIGERATION PVT. LTD.", 15, 12);
    doc.setFontSize(8); doc.setFont(undefined, "normal");
    doc.text("Village Tadgam, Umargoan, Valsad, Gujarat – 396135", 15, 18);
    doc.setFontSize(11); doc.setFont(undefined, "bold");
    doc.text("APPRENTICE SALARY SLIP", 140, 12);
    doc.text(`${m} ${slip.SalaryYear}`, 155, 19);

    // Employee details
    doc.setTextColor(0, 0, 0);
    const empDetails = [
      ["Employee Code", slip.EmpCode || ""],
      ["Employee Name", slip.EmpName || ""],
      ["Department",    slip.Department || ""],
      ["Category",      slip.Category || "Apprentice"],
      ["Month & Year",  `${m} ${slip.SalaryYear}`],
      ["Bank Account",  slip.BankAccount || "—"],
    ];
    autoTable(doc, {
      startY: 32, head: [], body: empDetails,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, textColor: [100, 116, 139] }, 1: { cellWidth: 90, fontStyle: "bold" } },
    });

    const afterEmp = doc.lastAutoTable.finalY + 4;

    // Attendance
    autoTable(doc, {
      startY: afterEmp,
      head: [["Present Days", "Weekly Off", "Half Days", "Absent Days", "OT Hours"]],
      body: [[slip.PresentDays, slip.WeeklyOff, slip.HalfDays, slip.AbsentDays, slip.OTHours]],
      headStyles: { fillColor: [30, 58, 95], fontSize: 8 },
      bodyStyles: { fontStyle: "bold", halign: "center", fontSize: 10 },
    });

    const afterAttend = doc.lastAutoTable.finalY + 4;

    // Earnings + Deductions
    const earnRows = [
      ["Stipend",      slip.Stipend || 0],
      ["OT Amount",    slip.OTAmount || 0],
      ["Bonus",        slip.Bonus || 0],
      ["Incentive",    slip.Incentive || 0],
    ].filter(([, v]) => parseFloat(v) > 0);
    const dedRows = [
      ["Hostel",       slip.Hostel || 0],
      ["Canteen",      slip.Canteen || 0],
      ["Electricity",  slip.Electricity || 0],
      ["Uniform",      slip.Uniform || 0],
      ["Shoes",        slip.Shoes || 0],
      ["Other",        slip.OtherDeductions || 0],
    ].filter(([, v]) => parseFloat(v) > 0);

    const maxR = Math.max(earnRows.length, dedRows.length);
    const combined = Array.from({ length: maxR }, (_, i) => [
      earnRows[i]?.[0] || "",
      earnRows[i] ? `Rs. ${parseFloat(earnRows[i][1]).toFixed(2)}` : "",
      dedRows[i]?.[0] || "",
      dedRows[i] ? `Rs. ${parseFloat(dedRows[i][1]).toFixed(2)}` : "",
    ]);
    combined.push(
      ["GROSS PAY", `Rs. ${parseFloat(slip.GrossPay || 0).toFixed(2)}`, "TOTAL DEDUCTIONS", `Rs. ${parseFloat(slip.TotalDeductions || 0).toFixed(2)}`]
    );

    autoTable(doc, {
      startY: afterAttend,
      head: [["Earnings", "Amount", "Deductions", "Amount"]],
      body: combined,
      headStyles: { fillColor: [30, 58, 95], fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    });

    const afterTable = doc.lastAutoTable.finalY + 6;

    // Net Pay
    doc.setFillColor(30, 58, 95);
    doc.rect(15, afterTable, 180, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9); doc.text("NET PAY (TAKE HOME)", 20, afterTable + 8);
    doc.setFontSize(13); doc.setFont(undefined, "bold");
    doc.text(`Rs. ${parseFloat(slip.NetPay || 0).toFixed(2)}`, 150, afterTable + 8, { align: "right" });

    doc.save(`SalarySlip_${slip.EmpCode}_${m}_${slip.SalaryYear}.pdf`);
  };

  if (!slip) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
          <span className="text-white font-bold text-sm">{slip.EmpName} — Salary Slip</span>
          <div className="flex items-center gap-2">
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
        {/* Slip content */}
        <div className="overflow-y-auto" ref={printRef}>
          <SalarySlipPrint slip={slip} />
        </div>
      </div>
    </div>
  );
};

export default SlipViewer;
