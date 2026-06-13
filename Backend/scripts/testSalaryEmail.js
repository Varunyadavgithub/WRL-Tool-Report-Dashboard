// One-off test: send a sample apprentice salary-slip email to verify SMTP config.
// Usage: node scripts/testSalaryEmail.js
import "dotenv/config";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

const inr = (v) => `₹ ${(parseFloat(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const buildSlipHtml = (s) => {
  const m = MONTHS[(s.SalaryMonth || 1) - 1];
  const earnRow = (label, amt) =>
    parseFloat(amt) > 0 ? `<tr><td style="padding:5px 10px">${label}</td><td style="padding:5px 10px;text-align:right;color:#065f46;font-weight:700">${inr(amt)}</td></tr>` : "";
  const dedRow = (label, amt) =>
    parseFloat(amt) > 0 ? `<tr><td style="padding:5px 10px">${label}</td><td style="padding:5px 10px;text-align:right;color:#991b1b;font-weight:700">${inr(amt)}</td></tr>` : "";

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
    <div style="background:#1e3a5f;color:#fff;padding:16px 20px">
      <h2 style="margin:0;font-size:18px;letter-spacing:1px">WESTERN REFRIGERATION PVT. LTD.</h2>
      <p style="margin:4px 0 0;font-size:11px;color:#cbd5e1">Village Tadgam, Umargoan, Valsad, Gujarat – 396135</p>
      <p style="margin:8px 0 0;font-size:13px;font-weight:700">Apprentice Salary Slip — ${m} ${s.SalaryYear} (TEST EMAIL)</p>
    </div>
    <div style="padding:16px 20px;font-size:12px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
        <tr><td style="color:#64748b;padding:3px 0">Employee Code</td><td style="font-weight:700">${s.EmpCode || "—"}</td>
            <td style="color:#64748b;padding:3px 0">Name</td><td style="font-weight:700">${s.EmpName || "—"}</td></tr>
        <tr><td style="color:#64748b;padding:3px 0">Department</td><td style="font-weight:700">${s.Department || "—"}</td>
            <td style="color:#64748b;padding:3px 0">Category</td><td style="font-weight:700">${s.Category || "—"}</td></tr>
        <tr><td style="color:#64748b;padding:3px 0">Labour ID</td><td style="font-weight:700">${s.LabourId || "—"}</td>
            <td style="color:#64748b;padding:3px 0">Date of Joining</td><td style="font-weight:700">${s.DateOfJoining || "—"}</td></tr>
        <tr><td style="color:#64748b;padding:3px 0">Paid Days</td><td style="font-weight:700">${s.PresentDays}</td>
            <td style="color:#64748b;padding:3px 0">LOP</td><td style="font-weight:700">${s.LOP}</td></tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#1e3a5f;color:#fff">
          <td colspan="2" style="padding:6px 10px;font-weight:700">EARNINGS</td>
          <td colspan="2" style="padding:6px 10px;font-weight:700">DEDUCTIONS</td>
        </tr>
        <tr>
          <td style="vertical-align:top;width:50%;border-right:1px solid #e2e8f0">
            <table style="width:100%;border-collapse:collapse">
              ${earnRow("Other Allowance", s.OtherAllowance)}
              ${earnRow("Arrear", s.Arrear)}
              ${earnRow("Company Stipend", s.CompanyStipend)}
              ${earnRow("Government DBT", s.GovernmentDBT)}
              ${earnRow("Total Stipend", s.TotalStipend)}
              ${earnRow("Incentive", s.Incentive)}
            </table>
          </td>
          <td style="vertical-align:top;width:50%">
            <table style="width:100%;border-collapse:collapse">
              ${dedRow("Canteen", s.Canteen)}
              ${dedRow("Hostel Rent", s.HostelRent)}
              ${dedRow("Electricity", s.Electricity)}
              ${dedRow("Uniform", s.Uniform)}
              ${dedRow("Shoes", s.Shoes)}
              ${dedRow("Other Ded.", s.OtherDed)}
            </table>
          </td>
        </tr>
        <tr style="background:#f0fdf4;font-weight:800;border-top:2px solid #1e3a5f">
          <td style="padding:6px 10px;color:#1e3a5f">GROSS</td>
          <td style="padding:6px 10px;text-align:right;color:#065f46;border-right:1px solid #e2e8f0">${inr(s.GrossAmount)}</td>
          <td style="padding:6px 10px;color:#1e3a5f">TOTAL DED.</td>
          <td style="padding:6px 10px;text-align:right;color:#991b1b">${inr(s.NetDeduction)}</td>
        </tr>
      </table>

      <div style="background:#1e3a5f;border-radius:6px;padding:12px 18px;margin-top:14px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:1px">NET PAYMENT (TAKE HOME)</span>
        <span style="color:#fff;font-size:20px;font-weight:900">${inr(s.NetPayment)}</span>
      </div>
      <p style="text-align:center;font-size:10px;color:#94a3b8;margin-top:14px">
        This is a computer-generated salary slip and does not require a signature. | WRL Payroll System
      </p>
    </div>
  </div>`;
};

const sample = {
  EmpCode: "TEST001",
  EmpName: "Test Apprentice",
  Department: "Production",
  Category: "ITI",
  LabourId: "L-1001",
  DateOfJoining: "01-01-2025",
  SalaryMonth: 6,
  SalaryYear: 2026,
  PresentDays: 26,
  LOP: 0,
  OtherAllowance: 500,
  Arrear: 0,
  CompanyStipend: 8000,
  GovernmentDBT: 2000,
  TotalStipend: 10000,
  Incentive: 1000,
  GrossAmount: 11500,
  Canteen: 800,
  HostelRent: 1000,
  Electricity: 200,
  Uniform: 0,
  Shoes: 0,
  OtherDed: 0,
  NetDeduction: 2000,
  NetPayment: 9500,
};

const buildSlipPDF = (s) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  const margin = 40;
  const usableWidth = doc.page.width - margin * 2;
  const colW = usableWidth / 2;
  const m = MONTHS[(s.SalaryMonth || 1) - 1];

  doc.rect(margin, margin, usableWidth, 64).fill("#1e3a5f");
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#fff")
    .text("WESTERN REFRIGERATION PVT. LTD.", margin, margin + 10, { width: usableWidth, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#cbd5e1")
    .text("Village Tadgam, Umargoan, Valsad, Gujarat - 396135", margin, margin + 32, { width: usableWidth, align: "center" });
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#fff")
    .text(`Apprentice Salary Slip - ${m} ${s.SalaryYear}`, margin, margin + 48, { width: usableWidth, align: "center" });

  let y = margin + 80;

  const details = [
    ["Employee Code", s.EmpCode || "-", "Name", s.EmpName || "-"],
    ["Department",    s.Department || "-", "Category", s.Category || "-"],
    ["Labour ID",     s.LabourId || "-", "Date of Joining", s.DateOfJoining || "-"],
    ["Paid Days",     String(s.PresentDays ?? "-"), "LOP", String(s.LOP ?? "-")],
  ];
  details.forEach(([l1, v1, l2, v2]) => {
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(l1, margin, y, { width: 90 });
    doc.font("Helvetica-Bold").fillColor("#1e293b").text(v1, margin + 95, y, { width: colW - 95 });
    doc.font("Helvetica").fillColor("#64748b").text(l2, margin + colW, y, { width: 90 });
    doc.font("Helvetica-Bold").fillColor("#1e293b").text(v2, margin + colW + 95, y, { width: colW - 95 });
    y += 18;
  });

  y += 8;

  doc.rect(margin, y, usableWidth, 20).fill("#1e3a5f");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#fff")
    .text("EARNINGS", margin + 8, y + 5)
    .text("DEDUCTIONS", margin + colW + 8, y + 5);
  y += 24;

  const earnings = [
    ["Other Allowance", s.OtherAllowance],
    ["Arrear", s.Arrear],
    ["Company Stipend", s.CompanyStipend],
    ["Government DBT", s.GovernmentDBT],
    ["Total Stipend", s.TotalStipend],
    ["Incentive", s.Incentive],
  ].filter(([, v]) => parseFloat(v) > 0);

  const deductions = [
    ["Canteen", s.Canteen],
    ["Hostel Rent", s.HostelRent],
    ["Electricity", s.Electricity],
    ["Uniform", s.Uniform],
    ["Shoes", s.Shoes],
    ["Other Ded.", s.OtherDed],
  ].filter(([, v]) => parseFloat(v) > 0);

  const rowCount = Math.max(earnings.length, deductions.length, 1);
  for (let i = 0; i < rowCount; i++) {
    const rowY = y + i * 16;
    if (earnings[i]) {
      doc.font("Helvetica").fontSize(9).fillColor("#1e293b").text(earnings[i][0], margin + 8, rowY, { width: colW - 90 });
      doc.font("Helvetica-Bold").fillColor("#065f46").text(inr(earnings[i][1]), margin + 8, rowY, { width: colW - 16, align: "right" });
    }
    if (deductions[i]) {
      doc.font("Helvetica").fontSize(9).fillColor("#1e293b").text(deductions[i][0], margin + colW + 8, rowY, { width: colW - 90 });
      doc.font("Helvetica-Bold").fillColor("#991b1b").text(inr(deductions[i][1]), margin + colW + 8, rowY, { width: colW - 16, align: "right" });
    }
  }
  y += rowCount * 16 + 6;

  doc.rect(margin, y, usableWidth, 22).fillAndStroke("#f0fdf4", "#1e3a5f");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a5f").text("GROSS", margin + 8, y + 6, { width: 100 });
  doc.fillColor("#065f46").text(inr(s.GrossAmount), margin + 8, y + 6, { width: colW - 16, align: "right" });
  doc.fillColor("#1e3a5f").text("TOTAL DED.", margin + colW + 8, y + 6, { width: 100 });
  doc.fillColor("#991b1b").text(inr(s.NetDeduction), margin + colW + 8, y + 6, { width: colW - 16, align: "right" });
  y += 34;

  doc.rect(margin, y, usableWidth, 36).fill("#1e3a5f");
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#93c5fd")
    .text("NET PAYMENT (TAKE HOME)", margin + 12, y + 12);
  doc.fontSize(16).fillColor("#fff")
    .text(inr(s.NetPayment), margin, y + 9, { width: usableWidth - 12, align: "right" });
  y += 50;

  doc.font("Helvetica").fontSize(8).fillColor("#94a3b8")
    .text("This is a computer-generated salary slip and does not require a signature. | WRL Payroll System", margin, y, { width: usableWidth, align: "center" });

  doc.end();
});

const TO = "vikash.kumar@westernequipments.com";

const m = MONTHS[(sample.SalaryMonth || 1) - 1];
const pdfBuffer = await buildSlipPDF(sample);
const info = await transporter.sendMail({
  from: process.env.MAIL_FROM || `"WRL Payroll" <${process.env.SMTP_USER}>`,
  to: TO,
  subject: `[TEST] Salary Slip — ${m} ${sample.SalaryYear} (${sample.EmpCode})`,
  html: buildSlipHtml(sample),
  attachments: [{
    filename: `SalarySlip_${sample.EmpCode}_${m}${sample.SalaryYear}.pdf`,
    content: pdfBuffer,
    contentType: "application/pdf",
  }],
});

console.log("Sent:", info.messageId, "->", TO);
process.exit(0);
