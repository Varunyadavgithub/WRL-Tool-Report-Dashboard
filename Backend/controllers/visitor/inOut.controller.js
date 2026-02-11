import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { sendVisitorPassMail } from "../../emailTemplates/Visitor_Management_System/visitorPass.template.js";

// Visitor Check-In
export const visitorIn = tryCatch(async (req, res, next) => {
  const { passId } = req.body;

  if (!passId) {
    throw new AppError("Pass ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request().input("PassId", sql.VarChar(50), passId);

  const statusResult = await request.query(`
    SELECT status FROM visitor_passes WHERE pass_id = @PassId
  `);

  if (!statusResult.recordset.length) {
    await pool.close();
    throw new AppError("Pass ID not found", 404);
  }

  const status = Number(statusResult.recordset[0].status);

  // 1 = new, 103 = checked out
  if (![1, 103].includes(status)) {
    await pool.close();
    throw new AppError(
      "Visitor is already checked in or status is invalid",
      409,
    );
  }

  await request.query(`
    BEGIN TRANSACTION;

      INSERT INTO visit_logs (unique_pass_id, check_in_time, check_out_time)
      VALUES (@PassId, SWITCHOFFSET(GETUTCDATE(), '+05:30'), NULL);

      UPDATE visitor_passes
      SET status = 100
      WHERE pass_id = @PassId;

    COMMIT;
  `);

  /* ---------- Fetch details for email ---------- */
  const info = await pool.request().input("PassId", sql.VarChar(50), passId)
    .query(`
      SELECT 
        vp.visitor_photo,
        vp.pass_id,
        vp.visitor_name,
        vp.visitor_contact_no,
        vp.visitor_email,
        vp.allow_on,
        vp.allow_till,
        d.department_name,
        u.name AS employee_name,
        u.employee_email,
        u.manager_email,
        v.company,
        v.city,
        vp.purpose_of_visit
      FROM visitor_passes vp
      JOIN visitors v ON v.visitor_id = vp.visitor_id
      LEFT JOIN departments d ON vp.department_to_visit = d.deptCode
      LEFT JOIN users u ON vp.employee_to_visit = u.employee_id
      WHERE vp.pass_id = @PassId
    `);

  const data = info.recordset[0];

  if (data) {
    await sendVisitorPassMail({
      to: data.employee_email,
      cc: [data.manager_email, process.env.CC_HR, process.env.CC_PH],
      photoPath: data.visitor_photo,
      visitorName: data.visitor_name,
      visitorContact: data.visitor_contact_no,
      visitorEmail: data.visitor_email,
      company: data.company,
      city: data.city,
      visitorId: data.pass_id,
      allowOn: data.allow_on,
      allowTill: data.allow_till,
      departmentToVisit: data.department_name,
      employeeToVisit: data.employee_name,
      purposeOfVisit: data.purpose_of_visit,
    });
  }

  await pool.close();

  res.status(201).json({
    success: true,
    message: "Visitor checked in successfully",
    data: { passId },
  });
});

// Visitor Check-Out
export const visitorOut = tryCatch(async (req, res, next) => {
  const { passId } = req.body;

  if (!passId) {
    throw new AppError("Pass ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request().input("PassId", sql.VarChar(50), passId);

  const activeVisit = await request.query(`
    SELECT 1 FROM visit_logs
    WHERE unique_pass_id = @PassId AND check_out_time IS NULL
  `);

  if (!activeVisit.recordset.length) {
    await pool.close();
    throw new AppError(
      "Visitor is not currently checked in or already checked out",
      404,
    );
  }

  await request.query(`
    BEGIN TRANSACTION;

      UPDATE visit_logs
      SET check_out_time = SWITCHOFFSET(GETUTCDATE(), '+05:30')
      WHERE unique_pass_id = @PassId AND check_out_time IS NULL;

      UPDATE visitor_passes
      SET status = 103
      WHERE pass_id = @PassId;

    COMMIT;
  `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Visitor checked out successfully",
    data: { passId },
  });
});

// Get Visitor Logs (Today)
export const getVisitorLogs = tryCatch(async (_, res, next) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const now = new Date();

  // Today 08:00 → Tomorrow 20:00 (IST)
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
  );

  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    20,
    0,
    0,
  );

  const istStart = new Date(startDate.getTime() + 330 * 60000);
  const istEnd = new Date(endDate.getTime() + 330 * 60000);

  const result = await pool
    .request()
    .input("StartDate", sql.DateTime, istStart)
    .input("EndDate", sql.DateTime, istEnd).query(`
      SELECT 
        vp.pass_id,
        vp.visitor_name,
        vp.visitor_contact_no,
        vp.company,
        d.department_name,
        u.name AS employee_name,
        vp.purpose_of_visit,
        vp.allow_on,
        vp.allow_till,
        vp.vehicle_details,
        vp.visitor_photo,
        vl.check_in_time,
        vl.check_out_time,
        vp.created_at
      FROM visit_logs vl
      RIGHT JOIN visitor_passes vp ON vp.pass_id = vl.unique_pass_id
      INNER JOIN users u ON u.employee_id = vp.employee_to_visit
      INNER JOIN departments d ON d.deptCode = vp.department_to_visit
      WHERE vp.created_at BETWEEN @StartDate AND @EndDate
      ORDER BY vp.created_at DESC
    `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Visitor logs fetched successfully",
    count: result.recordset.length,
    data: result.recordset,
  });
});
