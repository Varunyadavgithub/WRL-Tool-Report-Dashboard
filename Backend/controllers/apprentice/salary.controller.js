import sql from "mssql";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const pool = () => global.pool3;

// ── POST /apprentice/upload ───────────────────────────────────────────────────
// Receives parsed JSON from frontend (SheetJS) and upserts into DB
export const uploadSalaryData = tryCatch(async (req, res) => {
  const { month, year, slips, uploadedBy } = req.body;
  if (!month || !year || !Array.isArray(slips) || slips.length === 0)
    throw new AppError("month, year and slips[] are required", 400);

  const p = pool();

  // Create upload batch log
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
      await p.request()
        .input("batchId",    sql.Int,           batchId)
        .input("empCode",    sql.NVarChar(50),  (s.empCode || "").toString().trim())
        .input("empName",    sql.NVarChar(200), s.empName  || "")
        .input("dept",       sql.NVarChar(200), s.department || "")
        .input("category",   sql.NVarChar(200), s.category || "")
        .input("month",      sql.Int,           parseInt(month))
        .input("year",       sql.Int,           parseInt(year))
        .input("presentDays",sql.Decimal(5,1),  parseFloat(s.presentDays) || 0)
        .input("weeklyOff",  sql.Int,           parseInt(s.weeklyOff) || 0)
        .input("halfDays",   sql.Decimal(5,1),  parseFloat(s.halfDays) || 0)
        .input("absentDays", sql.Decimal(5,1),  parseFloat(s.absentDays) || 0)
        .input("otHours",    sql.Decimal(8,2),  parseFloat(s.otHours) || 0)
        .input("stipend",    sql.Decimal(12,2), parseFloat(s.stipend) || 0)
        .input("otAmount",   sql.Decimal(12,2), parseFloat(s.otAmount) || 0)
        .input("bonus",      sql.Decimal(12,2), parseFloat(s.bonus) || 0)
        .input("incentive",  sql.Decimal(12,2), parseFloat(s.incentive) || 0)
        .input("grossPay",   sql.Decimal(12,2), parseFloat(s.grossPay) || 0)
        .input("hostel",     sql.Decimal(12,2), parseFloat(s.hostel) || 0)
        .input("canteen",    sql.Decimal(12,2), parseFloat(s.canteen) || 0)
        .input("electricity",sql.Decimal(12,2), parseFloat(s.electricity) || 0)
        .input("uniform",    sql.Decimal(12,2), parseFloat(s.uniform) || 0)
        .input("shoes",      sql.Decimal(12,2), parseFloat(s.shoes) || 0)
        .input("other",      sql.Decimal(12,2), parseFloat(s.otherDeductions) || 0)
        .input("totalDed",   sql.Decimal(12,2), parseFloat(s.totalDeductions) || 0)
        .input("netPay",     sql.Decimal(12,2), parseFloat(s.netPay) || 0)
        .input("bank",       sql.NVarChar(100), s.bankAccount || null)
        .input("uan",        sql.NVarChar(50),  s.uan || null)
        .input("dayWise",    sql.NVarChar(sql.MAX), s.dayWiseData ? JSON.stringify(s.dayWiseData) : null)
        .query(`
          MERGE ApprenticeSalarySlips AS tgt
          USING (SELECT @empCode AS EmpCode, @month AS SalaryMonth, @year AS SalaryYear) AS src
            ON tgt.EmpCode=src.EmpCode AND tgt.SalaryMonth=src.SalaryMonth AND tgt.SalaryYear=src.SalaryYear
          WHEN MATCHED THEN
            UPDATE SET
              EmpName=@empName, Department=@dept, Category=@category,
              UploadBatchId=@batchId, PresentDays=@presentDays, WeeklyOff=@weeklyOff,
              HalfDays=@halfDays, AbsentDays=@absentDays, OTHours=@otHours,
              Stipend=@stipend, OTAmount=@otAmount, Bonus=@bonus, Incentive=@incentive,
              GrossPay=@grossPay, Hostel=@hostel, Canteen=@canteen, Electricity=@electricity,
              Uniform=@uniform, Shoes=@shoes, OtherDeductions=@other,
              TotalDeductions=@totalDed, NetPay=@netPay,
              BankAccount=@bank, UAN=@uan, DayWiseData=@dayWise,
              Status='draft', UpdatedAt=GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (UploadBatchId,EmpCode,EmpName,Department,Category,SalaryMonth,SalaryYear,
              PresentDays,WeeklyOff,HalfDays,AbsentDays,OTHours,Stipend,OTAmount,Bonus,Incentive,
              GrossPay,Hostel,Canteen,Electricity,Uniform,Shoes,OtherDeductions,TotalDeductions,
              NetPay,BankAccount,UAN,DayWiseData,Status)
            VALUES (@batchId,@empCode,@empName,@dept,@category,@month,@year,
              @presentDays,@weeklyOff,@halfDays,@absentDays,@otHours,@stipend,@otAmount,
              @bonus,@incentive,@grossPay,@hostel,@canteen,@electricity,@uniform,@shoes,
              @other,@totalDed,@netPay,@bank,@uan,@dayWise,'draft');
        `);
      ok++;
    } catch (err) {
      failed++;
      errors.push({ empCode: s.empCode, error: err.message });
    }
  }

  // Update log
  await p.request()
    .input("id",     sql.Int, batchId)
    .input("ok",     sql.Int, ok)
    .input("failed", sql.Int, failed)
    .input("status", sql.NVarChar(20), failed === 0 ? "success" : ok === 0 ? "failed" : "partial")
    .input("errlog", sql.NVarChar(sql.MAX), errors.length ? JSON.stringify(errors) : null)
    .query(`UPDATE ApprenticeUploadLogs SET RowsOk=@ok,RowsFailed=@failed,Status=@status,ErrorLog=@errlog WHERE Id=@id`);

  res.status(201).json({ success: true, batchId, ok, failed, errors });
});

// ── GET /apprentice/slips?month=5&year=2026 ───────────────────────────────────
export const getSlips = tryCatch(async (req, res) => {
  const { month, year, status, dept, search, page = 1, limit = 100 } = req.query;
  if (!month || !year) throw new AppError("month and year are required", 400);

  const p = pool();
  const req2 = p.request()
    .input("month",  sql.Int, parseInt(month))
    .input("year",   sql.Int, parseInt(year))
    .input("offset", sql.Int, (parseInt(page) - 1) * parseInt(limit))
    .input("limit",  sql.Int, parseInt(limit));

  const conds = ["SalaryMonth=@month", "SalaryYear=@year"];
  if (status) { req2.input("status", sql.NVarChar(20), status); conds.push("Status=@status"); }
  if (dept)   { req2.input("dept",   sql.NVarChar(200), `%${dept}%`); conds.push("Department LIKE @dept"); }
  if (search) { req2.input("search", sql.NVarChar(200), `%${search}%`); conds.push("(EmpCode LIKE @search OR EmpName LIKE @search)"); }

  const where = conds.join(" AND ");
  const result = await req2.query(`
    SELECT * FROM ApprenticeSalarySlips WHERE ${where}
    ORDER BY Department, EmpName
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const cnt = await p.request()
    .input("month", sql.Int, parseInt(month))
    .input("year",  sql.Int, parseInt(year))
    .query(`SELECT COUNT(*) AS total, SUM(NetPay) AS totalNet, SUM(GrossPay) AS totalGross,
                   SUM(TotalDeductions) AS totalDed, SUM(OTAmount) AS totalOT
            FROM ApprenticeSalarySlips WHERE SalaryMonth=@month AND SalaryYear=@year`);

  res.json({ success: true, data: result.recordset, meta: cnt.recordset[0] });
});

// ── GET /apprentice/slips/:id ─────────────────────────────────────────────────
export const getSlipById = tryCatch(async (req, res) => {
  const result = await pool().request()
    .input("id", sql.Int, parseInt(req.params.id))
    .query(`SELECT * FROM ApprenticeSalarySlips WHERE Id=@id`);
  if (!result.recordset.length) throw new AppError("Slip not found", 404);
  const slip = result.recordset[0];
  if (slip.DayWiseData) {
    try { slip.DayWiseData = JSON.parse(slip.DayWiseData); } catch { slip.DayWiseData = null; }
  }
  res.json({ success: true, data: slip });
});

// ── PUT /apprentice/slips/:id/publish ─────────────────────────────────────────
export const publishSlip = tryCatch(async (req, res) => {
  const result = await pool().request()
    .input("id", sql.Int, parseInt(req.params.id))
    .query(`UPDATE ApprenticeSalarySlips SET Status='published',UpdatedAt=GETDATE() OUTPUT INSERTED.Id WHERE Id=@id`);
  if (!result.recordset.length) throw new AppError("Slip not found", 404);
  res.json({ success: true });
});

// ── PUT /apprentice/slips/publish-all ────────────────────────────────────────
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
    .query(`DELETE FROM ApprenticeSalarySlips WHERE SalaryMonth=@month AND SalaryYear=@year AND Status='draft'`);
  res.json({ success: true });
});

// ── GET /apprentice/dashboard?month=&year= ───────────────────────────────────
export const getDashboard = tryCatch(async (req, res) => {
  const { month, year } = req.query;
  const p = pool();

  // Available months
  const months = await p.request().query(
    `SELECT DISTINCT SalaryMonth,SalaryYear,COUNT(*) AS emp,SUM(NetPay) AS netPay
     FROM ApprenticeSalarySlips GROUP BY SalaryMonth,SalaryYear ORDER BY SalaryYear DESC,SalaryMonth DESC`
  );

  if (!month || !year) return res.json({ success: true, months: months.recordset, summary: null });

  const [summary, deptWise, uploadLogs] = await Promise.all([
    p.request()
      .input("m", sql.Int, parseInt(month)).input("y", sql.Int, parseInt(year))
      .query(`SELECT COUNT(*) AS totalEmp, SUM(NetPay) AS totalNet, SUM(GrossPay) AS totalGross,
                     SUM(TotalDeductions) AS totalDed, SUM(OTAmount) AS totalOT,
                     SUM(OTHours) AS totalOTHours, SUM(Bonus) AS totalBonus,
                     AVG(PresentDays) AS avgPresent, SUM(AbsentDays) AS totalAbsent,
                     COUNT(CASE WHEN Status='published' THEN 1 END) AS published,
                     COUNT(CASE WHEN Status='draft' THEN 1 END) AS draft
              FROM ApprenticeSalarySlips WHERE SalaryMonth=@m AND SalaryYear=@y`),
    p.request()
      .input("m", sql.Int, parseInt(month)).input("y", sql.Int, parseInt(year))
      .query(`SELECT Department, COUNT(*) AS emp, SUM(NetPay) AS netPay, SUM(GrossPay) AS grossPay,
                     SUM(OTAmount) AS otAmount, SUM(TotalDeductions) AS deductions, AVG(PresentDays) AS avgPresent
              FROM ApprenticeSalarySlips WHERE SalaryMonth=@m AND SalaryYear=@y
              GROUP BY Department ORDER BY netPay DESC`),
    p.request()
      .input("m", sql.Int, parseInt(month)).input("y", sql.Int, parseInt(year))
      .query(`SELECT TOP 5 * FROM ApprenticeUploadLogs WHERE SalaryMonth=@m AND SalaryYear=@y ORDER BY UploadedAt DESC`),
  ]);

  res.json({
    success: true,
    months: months.recordset,
    summary: summary.recordset[0],
    deptWise: deptWise.recordset,
    uploadLogs: uploadLogs.recordset,
  });
});

// ── GET /apprentice/history ───────────────────────────────────────────────────
export const getHistory = tryCatch(async (req, res) => {
  const { empCode } = req.query;
  if (!empCode) throw new AppError("empCode required", 400);
  const result = await pool().request()
    .input("code", sql.NVarChar(50), empCode.trim().toUpperCase())
    .query(`SELECT Id,EmpCode,EmpName,Department,Category,SalaryMonth,SalaryYear,
                   PresentDays,NetPay,GrossPay,TotalDeductions,OTAmount,Status
            FROM ApprenticeSalarySlips WHERE EmpCode=@code ORDER BY SalaryYear DESC,SalaryMonth DESC`);
  res.json({ success: true, data: result.recordset });
});
