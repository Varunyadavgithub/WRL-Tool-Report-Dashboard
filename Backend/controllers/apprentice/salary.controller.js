import sql from "mssql";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const pool = () => global.pool3;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Mail transport (configure via env) ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

// ── POST /apprentice/upload ───────────────────────────────────────────────────
export const uploadSalaryData = tryCatch(async (req, res) => {
  const { month, year, slips, uploadedBy } = req.body;
  if (!month || !year || !Array.isArray(slips) || slips.length === 0)
    throw new AppError("month, year and slips[] are required", 400);

  const p = pool();
  const batchRes = await p.request()
    .input("month", sql.Int, parseInt(month))
    .input("year",  sql.Int, parseInt(year))
    .input("by",    sql.NVarChar(200), uploadedBy || "HR")
    .input("total", sql.Int, slips.length)
    .query(`
      INSERT INTO ApprenticeUploadLogs (SalaryMonth,SalaryYear,UploadedBy,RowsTotal,Status)
      OUTPUT INSERTED.Id
      VALUES (@month,@year,@by,@total,'processing')
    `);
  const batchId = batchRes.recordset[0].Id;

  let ok = 0, failed = 0;
  const errors = [];

  for (const s of slips) {
    try {
      const num = (v) => parseFloat(v) || 0;
      await p.request()
        .input("batchId",     sql.Int,            batchId)
        .input("empCode",     sql.NVarChar(50),   (s.empCode || "").toString().trim().toUpperCase())
        .input("labourId",    sql.NVarChar(60),   s.labourId || null)
        .input("email",       sql.NVarChar(200),  s.email || null)
        .input("mobileNo",    sql.NVarChar(20),   s.mobileNo || null)
        .input("empName",     sql.NVarChar(200),  s.empName || "")
        .input("category",    sql.NVarChar(100),  s.category || "")
        .input("dept",        sql.NVarChar(200),  s.department || "")
        .input("location",    sql.NVarChar(120),  s.location || "")
        .input("doj",         sql.NVarChar(20),   s.doj || null)
        .input("month",       sql.Int,            parseInt(month))
        .input("year",        sql.Int,            parseInt(year))
        .input("presentDays", sql.Decimal(5,1),   num(s.presentDays))
        .input("lop",         sql.Decimal(5,1),   num(s.lop))
        .input("otherAllow",  sql.Decimal(12,2),  num(s.otherAllowance))
        .input("arrear",      sql.Decimal(12,2),  num(s.arrear))
        .input("compStipend", sql.Decimal(12,2),  num(s.companyStipend))
        .input("govtDBT",     sql.Decimal(12,2),  num(s.governmentDBT))
        .input("totalStipend",sql.Decimal(12,2),  num(s.totalStipend))
        .input("incentive",   sql.Decimal(12,2),  num(s.incentive))
        .input("gross",       sql.Decimal(12,2),  num(s.grossAmount))
        .input("canteen",     sql.Decimal(12,2),  num(s.canteen))
        .input("hostel",      sql.Decimal(12,2),  num(s.hostelRent))
        .input("electricity", sql.Decimal(12,2),  num(s.electricity))
        .input("uniform",     sql.Decimal(12,2),  num(s.uniform))
        .input("shoes",       sql.Decimal(12,2),  num(s.shoes))
        .input("otherDed",    sql.Decimal(12,2),  num(s.otherDed))
        .input("netDed",      sql.Decimal(12,2),  num(s.netDeduction))
        .input("netPay",      sql.Decimal(12,2),  num(s.netPayment))
        .query(`
          MERGE ApprenticeSalarySlips AS tgt
          USING (SELECT @empCode AS EmpCode, @month AS SalaryMonth, @year AS SalaryYear) AS src
            ON tgt.EmpCode=src.EmpCode AND tgt.SalaryMonth=src.SalaryMonth AND tgt.SalaryYear=src.SalaryYear
          WHEN MATCHED THEN UPDATE SET
              LabourId=@labourId, Email=@email, MobileNo=@mobileNo, EmpName=@empName, Category=@category,
              Department=@dept, Location=@location, DateOfJoining=@doj, UploadBatchId=@batchId,
              PresentDays=@presentDays, LOP=@lop,
              OtherAllowance=@otherAllow, Arrear=@arrear, CompanyStipend=@compStipend,
              GovernmentDBT=@govtDBT, TotalStipend=@totalStipend, Incentive=@incentive, GrossAmount=@gross,
              Canteen=@canteen, HostelRent=@hostel, Electricity=@electricity, Uniform=@uniform,
              Shoes=@shoes, OtherDed=@otherDed, NetDeduction=@netDed, NetPayment=@netPay,
              Status='draft', UpdatedAt=GETDATE()
          WHEN NOT MATCHED THEN INSERT
            (UploadBatchId,EmpCode,LabourId,Email,MobileNo,EmpName,Category,Department,Location,DateOfJoining,
             SalaryMonth,SalaryYear,PresentDays,LOP,OtherAllowance,Arrear,CompanyStipend,GovernmentDBT,
             TotalStipend,Incentive,GrossAmount,Canteen,HostelRent,Electricity,Uniform,Shoes,OtherDed,
             NetDeduction,NetPayment,Status)
            VALUES
            (@batchId,@empCode,@labourId,@email,@mobileNo,@empName,@category,@dept,@location,@doj,
             @month,@year,@presentDays,@lop,@otherAllow,@arrear,@compStipend,@govtDBT,
             @totalStipend,@incentive,@gross,@canteen,@hostel,@electricity,@uniform,@shoes,@otherDed,
             @netDed,@netPay,'draft');
        `);
      ok++;
    } catch (err) {
      failed++;
      errors.push({ empCode: s.empCode, error: err.message });
    }
  }

  await p.request()
    .input("id", sql.Int, batchId)
    .input("ok", sql.Int, ok)
    .input("failed", sql.Int, failed)
    .input("status", sql.NVarChar(20), failed === 0 ? "success" : ok === 0 ? "failed" : "partial")
    .input("errlog", sql.NVarChar(sql.MAX), errors.length ? JSON.stringify(errors) : null)
    .query(`UPDATE ApprenticeUploadLogs SET RowsOk=@ok,RowsFailed=@failed,Status=@status,ErrorLog=@errlog WHERE Id=@id`);

  res.status(201).json({ success: true, batchId, ok, failed, errors });
});

// ── GET /apprentice/slips?month=&year= ────────────────────────────────────────
export const getSlips = tryCatch(async (req, res) => {
  const { month, year, status, dept, category, search, page = 1, limit = 500 } = req.query;
  if (!month || !year) throw new AppError("month and year are required", 400);

  const p = pool();
  const r = p.request()
    .input("month",  sql.Int, parseInt(month))
    .input("year",   sql.Int, parseInt(year))
    .input("offset", sql.Int, (parseInt(page) - 1) * parseInt(limit))
    .input("limit",  sql.Int, parseInt(limit));

  const conds = ["SalaryMonth=@month", "SalaryYear=@year"];
  if (status)   { r.input("status",   sql.NVarChar(20),  status);          conds.push("Status=@status"); }
  if (dept)     { r.input("dept",     sql.NVarChar(200), `%${dept}%`);     conds.push("Department LIKE @dept"); }
  if (category) { r.input("category", sql.NVarChar(100), category);        conds.push("Category=@category"); }
  if (search)   { r.input("search",   sql.NVarChar(200), `%${search}%`);   conds.push("(EmpCode LIKE @search OR EmpName LIKE @search OR Email LIKE @search)"); }

  const where = conds.join(" AND ");
  const result = await r.query(`
    SELECT * FROM ApprenticeSalarySlips WHERE ${where}
    ORDER BY Department, EmpName
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const cnt = await p.request()
    .input("month", sql.Int, parseInt(month))
    .input("year",  sql.Int, parseInt(year))
    .query(`SELECT COUNT(*) AS totalEmp, SUM(NetPayment) AS totalNet, SUM(GrossAmount) AS totalGross,
                   SUM(NetDeduction) AS totalDed, SUM(Incentive) AS totalIncentive,
                   COUNT(CASE WHEN Status='published' THEN 1 END) AS published,
                   COUNT(CASE WHEN Status='emailed'   THEN 1 END) AS emailed,
                   COUNT(CASE WHEN Status='draft'     THEN 1 END) AS draft
            FROM ApprenticeSalarySlips WHERE SalaryMonth=@month AND SalaryYear=@year`);

  res.json({ success: true, data: result.recordset, meta: cnt.recordset[0] });
});

// ── GET /apprentice/slips/:id ─────────────────────────────────────────────────
export const getSlipById = tryCatch(async (req, res) => {
  const result = await pool().request()
    .input("id", sql.Int, parseInt(req.params.id))
    .query(`SELECT * FROM ApprenticeSalarySlips WHERE Id=@id`);
  if (!result.recordset.length) throw new AppError("Slip not found", 404);
  res.json({ success: true, data: result.recordset[0] });
});

// ── PUT /apprentice/slips/:id/publish ─────────────────────────────────────────
export const publishSlip = tryCatch(async (req, res) => {
  const r = await pool().request()
    .input("id", sql.Int, parseInt(req.params.id))
    .query(`UPDATE ApprenticeSalarySlips SET Status='published',UpdatedAt=GETDATE()
            WHERE Id=@id AND Status='draft'`);
  if (!r.rowsAffected[0]) throw new AppError("Slip not found or already published", 404);
  res.json({ success: true });
});

// ── PUT /apprentice/slips/publish-all ─────────────────────────────────────────
export const publishAll = tryCatch(async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) throw new AppError("month and year required", 400);
  const r = await pool().request()
    .input("month", sql.Int, parseInt(month))
    .input("year",  sql.Int, parseInt(year))
    .query(`UPDATE ApprenticeSalarySlips SET Status='published',UpdatedAt=GETDATE()
            WHERE SalaryMonth=@month AND SalaryYear=@year AND Status='draft'`);
  res.json({ success: true, updated: r.rowsAffected[0] });
});

// ── DELETE /apprentice/slips?month=&year= ─────────────────────────────────────
export const deleteSlips = tryCatch(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError("month and year required", 400);
  await pool().request()
    .input("month", sql.Int, parseInt(month))
    .input("year",  sql.Int, parseInt(year))
    .query(`DELETE FROM ApprenticeSalarySlips
            WHERE SalaryMonth=@month AND SalaryYear=@year AND Status IN ('draft','published')`);
  res.json({ success: true });
});

// ── Build the salary-slip HTML used for the e-mail body ───────────────────────
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
      <p style="margin:8px 0 0;font-size:13px;font-weight:700">Apprentice Salary Slip — ${m} ${s.SalaryYear}</p>
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

// ── Build the salary-slip PDF attached to the e-mail ──────────────────────────
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

  // Header
  doc.rect(margin, margin, usableWidth, 64).fill("#1e3a5f");
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#fff")
    .text("WESTERN REFRIGERATION PVT. LTD.", margin, margin + 10, { width: usableWidth, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#cbd5e1")
    .text("Village Tadgam, Umargoan, Valsad, Gujarat - 396135", margin, margin + 32, { width: usableWidth, align: "center" });
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#fff")
    .text(`Apprentice Salary Slip - ${m} ${s.SalaryYear}`, margin, margin + 48, { width: usableWidth, align: "center" });

  let y = margin + 80;

  // Employee details
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

  // Earnings / Deductions header
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

  // Gross / Total Deduction row
  doc.rect(margin, y, usableWidth, 22).fillAndStroke("#f0fdf4", "#1e3a5f");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e3a5f").text("GROSS", margin + 8, y + 6, { width: 100 });
  doc.fillColor("#065f46").text(inr(s.GrossAmount), margin + 8, y + 6, { width: colW - 16, align: "right" });
  doc.fillColor("#1e3a5f").text("TOTAL DED.", margin + colW + 8, y + 6, { width: 100 });
  doc.fillColor("#991b1b").text(inr(s.NetDeduction), margin + colW + 8, y + 6, { width: colW - 16, align: "right" });
  y += 34;

  // Net Payment
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

const sendOne = async (slip) => {
  if (!slip.Email) throw new Error("No e-mail address on record");
  const m = MONTHS[(slip.SalaryMonth || 1) - 1];
  const pdfBuffer = await buildSlipPDF(slip);
  await transporter.sendMail({
    from: process.env.MAIL_FROM || `"WRL Payroll" <${process.env.SMTP_USER}>`,
    to: slip.Email,
    subject: `Salary Slip — ${m} ${slip.SalaryYear} (${slip.EmpCode})`,
    html: buildSlipHtml(slip),
    attachments: [{
      filename: `SalarySlip_${slip.EmpCode}_${m}${slip.SalaryYear}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

// ── POST /apprentice/slips/:id/email ──────────────────────────────────────────
export const emailSlip = tryCatch(async (req, res) => {
  const p = pool();
  const result = await p.request()
    .input("id", sql.Int, parseInt(req.params.id))
    .query(`SELECT * FROM ApprenticeSalarySlips WHERE Id=@id`);
  if (!result.recordset.length) throw new AppError("Slip not found", 404);

  const slip = result.recordset[0];
  await sendOne(slip);
  await p.request()
    .input("id", sql.Int, slip.Id)
    .query(`UPDATE ApprenticeSalarySlips SET Status='emailed',EmailedAt=GETDATE(),UpdatedAt=GETDATE() WHERE Id=@id`);

  res.json({ success: true, email: slip.Email });
});

// ── POST /apprentice/email-all ────────────────────────────────────────────────
export const emailAll = tryCatch(async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) throw new AppError("month and year required", 400);

  const p = pool();
  const rows = await p.request()
    .input("month", sql.Int, parseInt(month))
    .input("year",  sql.Int, parseInt(year))
    .query(`SELECT * FROM ApprenticeSalarySlips
            WHERE SalaryMonth=@month AND SalaryYear=@year AND Email IS NOT NULL AND Email <> ''`);

  let sent = 0, failed = 0;
  const errors = [];
  for (const slip of rows.recordset) {
    try {
      await sendOne(slip);
      await p.request().input("id", sql.Int, slip.Id)
        .query(`UPDATE ApprenticeSalarySlips SET Status='emailed',EmailedAt=GETDATE(),UpdatedAt=GETDATE() WHERE Id=@id`);
      sent++;
    } catch (err) {
      failed++;
      errors.push({ empCode: slip.EmpCode, email: slip.Email, error: err.message });
    }
  }
  res.json({ success: true, sent, failed, skippedNoEmail: 0, errors });
});

// ── GET /apprentice/dashboard?month=&year= ────────────────────────────────────
export const getDashboard = tryCatch(async (req, res) => {
  const { month, year } = req.query;
  const p = pool();

  const months = await p.request().query(
    `SELECT DISTINCT SalaryMonth,SalaryYear,COUNT(*) AS emp,SUM(NetPayment) AS netPay
     FROM ApprenticeSalarySlips GROUP BY SalaryMonth,SalaryYear ORDER BY SalaryYear DESC,SalaryMonth DESC`
  );
  if (!month || !year) return res.json({ success: true, months: months.recordset, summary: null });

  const [summary, deptWise, categoryWise, uploadLogs] = await Promise.all([
    p.request().input("m", sql.Int, parseInt(month)).input("y", sql.Int, parseInt(year))
      .query(`SELECT COUNT(*) AS totalEmp, SUM(NetPayment) AS totalNet, SUM(GrossAmount) AS totalGross,
                     SUM(NetDeduction) AS totalDed, SUM(Incentive) AS totalIncentive,
                     SUM(TotalStipend) AS totalStipend, AVG(PresentDays) AS avgPresent, SUM(LOP) AS totalLOP,
                     COUNT(CASE WHEN Status='emailed' THEN 1 END) AS emailed,
                     COUNT(CASE WHEN Status='published' THEN 1 END) AS published,
                     COUNT(CASE WHEN Status='draft' THEN 1 END) AS draft
              FROM ApprenticeSalarySlips WHERE SalaryMonth=@m AND SalaryYear=@y`),
    p.request().input("m", sql.Int, parseInt(month)).input("y", sql.Int, parseInt(year))
      .query(`SELECT Department, COUNT(*) AS emp, SUM(NetPayment) AS netPay, SUM(GrossAmount) AS grossPay,
                     SUM(NetDeduction) AS deductions, AVG(PresentDays) AS avgPresent
              FROM ApprenticeSalarySlips WHERE SalaryMonth=@m AND SalaryYear=@y
              GROUP BY Department ORDER BY netPay DESC`),
    p.request().input("m", sql.Int, parseInt(month)).input("y", sql.Int, parseInt(year))
      .query(`SELECT Category, COUNT(*) AS emp, SUM(NetPayment) AS netPay
              FROM ApprenticeSalarySlips WHERE SalaryMonth=@m AND SalaryYear=@y
              GROUP BY Category ORDER BY netPay DESC`),
    p.request().input("m", sql.Int, parseInt(month)).input("y", sql.Int, parseInt(year))
      .query(`SELECT TOP 5 * FROM ApprenticeUploadLogs WHERE SalaryMonth=@m AND SalaryYear=@y ORDER BY UploadedAt DESC`),
  ]);

  res.json({
    success: true,
    months: months.recordset,
    summary: summary.recordset[0],
    deptWise: deptWise.recordset,
    categoryWise: categoryWise.recordset,
    uploadLogs: uploadLogs.recordset,
  });
});

// ── GET /apprentice/history?empCode= ──────────────────────────────────────────
export const getHistory = tryCatch(async (req, res) => {
  const { empCode } = req.query;
  if (!empCode) throw new AppError("empCode required", 400);
  const result = await pool().request()
    .input("code", sql.NVarChar(50), empCode.trim().toUpperCase())
    .query(`SELECT Id,EmpCode,EmpName,Department,Category,SalaryMonth,SalaryYear,
                   PresentDays,LOP,GrossAmount,NetDeduction,NetPayment,Incentive,Status
            FROM ApprenticeSalarySlips WHERE EmpCode=@code ORDER BY SalaryYear DESC,SalaryMonth DESC`);
  res.json({ success: true, data: result.recordset });
});