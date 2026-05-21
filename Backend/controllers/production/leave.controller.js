import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const getPool = async () => {
  if (global.pool3) return global.pool3;
  return await new sql.ConnectionPool(dbConfig3).connect();
};

// POST /manpower/leave/apply
export const applyLeave = tryCatch(async (req, res) => {
  const { empCode, empName, department, leaveType, fromDate, toDate, totalDays, reason } = req.body;

  if (!empCode || !leaveType || !fromDate || !toDate)
    throw new AppError("empCode, leaveType, fromDate and toDate are required", 400);

  const validTypes = ["CO", "CL", "SL", "PL"];
  if (!validTypes.includes(leaveType))
    throw new AppError(`leaveType must be one of: ${validTypes.join(", ")}`, 400);

  if (new Date(fromDate) > new Date(toDate))
    throw new AppError("fromDate must be before or equal to toDate", 400);

  const pool = await getPool();

  // Check for overlapping approved/pending leaves
  const overlap = await pool.request()
    .input("empCode",   sql.NVarChar(50), empCode.trim().toUpperCase())
    .input("fromDate",  sql.Date, fromDate)
    .input("toDate",    sql.Date, toDate)
    .query(`
      SELECT COUNT(*) AS cnt FROM LeaveRequests
      WHERE EmpCode = @empCode
        AND Status IN ('pending','approved')
        AND NOT (ToDate < @fromDate OR FromDate > @toDate)
    `);

  if (overlap.recordset[0].cnt > 0)
    throw new AppError("A leave request already exists for overlapping dates", 409);

  const result = await pool.request()
    .input("empCode",    sql.NVarChar(50),  empCode.trim().toUpperCase())
    .input("empName",    sql.NVarChar(200), empName    || null)
    .input("department", sql.NVarChar(200), department || null)
    .input("leaveType",  sql.NVarChar(10),  leaveType)
    .input("fromDate",   sql.Date,          fromDate)
    .input("toDate",     sql.Date,          toDate)
    .input("totalDays",  sql.Decimal(5,1),  totalDays  || 1)
    .input("reason",     sql.NVarChar(sql.MAX), reason || null)
    .query(`
      INSERT INTO LeaveRequests
        (EmpCode, EmpName, Department, LeaveType, FromDate, ToDate, TotalDays, Reason)
      OUTPUT INSERTED.*
      VALUES
        (@empCode, @empName, @department, @leaveType, @fromDate, @toDate, @totalDays, @reason)
    `);

  res.status(201).json({ success: true, data: result.recordset[0] });
});

// GET /manpower/leave/my?empCode=WRLZ0242
export const getMyLeaves = tryCatch(async (req, res) => {
  const { empCode } = req.query;
  if (!empCode) throw new AppError("empCode is required", 400);

  const pool = await getPool();
  const result = await pool.request()
    .input("empCode", sql.NVarChar(50), empCode.trim().toUpperCase())
    .query(`
      SELECT * FROM LeaveRequests
      WHERE EmpCode = @empCode
      ORDER BY AppliedAt DESC
    `);

  res.json({ success: true, data: result.recordset });
});

// GET /manpower/leave/all?status=pending&dept=Manufacturing&page=1&limit=50
export const getAllLeaves = tryCatch(async (req, res) => {
  const { status, dept, empCode, fromDate, toDate, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const pool    = await getPool();
  const request = pool.request()
    .input("offset", sql.Int, offset)
    .input("limit",  sql.Int, parseInt(limit));

  const conditions = [];
  if (status)   { request.input("status",   sql.NVarChar(20),  status);                 conditions.push("Status = @status");   }
  if (dept)     { request.input("dept",     sql.NVarChar(200), `%${dept}%`);            conditions.push("Department LIKE @dept"); }
  if (empCode)  { request.input("empCode",  sql.NVarChar(50),  empCode.toUpperCase());  conditions.push("EmpCode = @empCode"); }
  if (fromDate) { request.input("fromDate", sql.Date,          fromDate);               conditions.push("FromDate >= @fromDate"); }
  if (toDate)   { request.input("toDate",   sql.Date,          toDate);                 conditions.push("ToDate <= @toDate");  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await request.query(`
    SELECT * FROM LeaveRequests
    ${where}
    ORDER BY AppliedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countRes = await pool.request().query(`SELECT COUNT(*) AS total FROM LeaveRequests ${where}`);

  res.json({ success: true, data: result.recordset, total: countRes.recordset[0].total });
});

// PUT /manpower/leave/:id/approve
export const approveLeave = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { approvedBy } = req.body;

  const pool   = await getPool();
  const result = await pool.request()
    .input("id",         sql.Int,          parseInt(id))
    .input("approvedBy", sql.NVarChar(200), approvedBy || "Manager")
    .query(`
      UPDATE LeaveRequests
      SET Status = 'approved', ApprovedBy = @approvedBy, ApprovedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND Status = 'pending'
    `);

  if (!result.recordset.length)
    throw new AppError("Leave not found or already actioned", 404);

  res.json({ success: true, data: result.recordset[0] });
});

// PUT /manpower/leave/:id/reject
export const rejectLeave = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason, rejectedBy } = req.body;

  if (!rejectionReason?.trim()) throw new AppError("Rejection reason is required", 400);

  const pool   = await getPool();
  const result = await pool.request()
    .input("id",              sql.Int,          parseInt(id))
    .input("rejectionReason", sql.NVarChar(sql.MAX), rejectionReason.trim())
    .input("rejectedBy",      sql.NVarChar(200), rejectedBy || "Manager")
    .query(`
      UPDATE LeaveRequests
      SET Status = 'rejected', RejectionReason = @rejectionReason,
          ApprovedBy = @rejectedBy, ApprovedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND Status = 'pending'
    `);

  if (!result.recordset.length)
    throw new AppError("Leave not found or already actioned", 404);

  res.json({ success: true, data: result.recordset[0] });
});

// PUT /manpower/leave/:id/cancel
export const cancelLeave = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { empCode } = req.body;

  const pool   = await getPool();
  const result = await pool.request()
    .input("id",      sql.Int,         parseInt(id))
    .input("empCode", sql.NVarChar(50), empCode?.toUpperCase())
    .query(`
      UPDATE LeaveRequests
      SET Status = 'cancelled'
      OUTPUT INSERTED.*
      WHERE Id = @id AND EmpCode = @empCode AND Status = 'pending'
    `);

  if (!result.recordset.length)
    throw new AppError("Leave not found or cannot be cancelled", 404);

  res.json({ success: true, data: result.recordset[0] });
});

// POST /manpower/leave/auto-co
// Receives days where WorkingHours > 14 and auto-creates an approved CO for each
// day that doesn't already have one.
export const generateAutoCO = tryCatch(async (req, res) => {
  const { empCode, empName, department, dates } = req.body;
  // dates = [{ date: "2026-05-04" }, ...]

  if (!empCode || !Array.isArray(dates) || dates.length === 0)
    throw new AppError("empCode and dates array are required", 400);

  const pool    = await getPool();
  const created = [];

  for (const { date } of dates) {
    if (!date) continue;

    // Skip if a CO already exists for this exact date
    const exists = await pool.request()
      .input("empCode", sql.NVarChar(50), empCode.trim().toUpperCase())
      .input("date",    sql.Date,         date)
      .query(`
        SELECT 1 FROM LeaveRequests
        WHERE EmpCode   = @empCode
          AND LeaveType = 'CO'
          AND FromDate  = @date
          AND ToDate    = @date
          AND Status   <> 'cancelled'
      `);

    if (exists.recordset.length > 0) continue;

    const ins = await pool.request()
      .input("empCode",    sql.NVarChar(50),      empCode.trim().toUpperCase())
      .input("empName",    sql.NVarChar(200),     empName    || null)
      .input("department", sql.NVarChar(200),     department || null)
      .input("date",       sql.Date,              date)
      .input("reason",     sql.NVarChar(sql.MAX), "Auto-generated: worked more than 14 hours")
      .query(`
        INSERT INTO LeaveRequests
          (EmpCode, EmpName, Department, LeaveType, FromDate, ToDate, TotalDays, Reason, Status, ApprovedBy, ApprovedAt)
        OUTPUT INSERTED.*
        VALUES
          (@empCode, @empName, @department, 'CO', @date, @date, 1, @reason, 'approved', 'System', GETDATE())
      `);

    if (ins.recordset.length) created.push(ins.recordset[0]);
  }

  res.json({ success: true, created: created.length, data: created });
});
