import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Get All Visitors (Paginated)
export const getAllVisitors = tryCatch(async (req, res, next) => {
  const limit = Number(req.query.limit) || 100;
  const offset = Number(req.query.offset) || 0;

  if (limit <= 0 || offset < 0) {
    throw new AppError("Invalid pagination parameters", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .input("limit", sql.Int, limit)
    .input("offset", sql.Int, offset).query(`
      WITH LatestVisit AS (
        SELECT 
          vp.visitor_id,
          MAX(vl.check_in_time) AS latest_checkin
        FROM visitor_passes vp
        LEFT JOIN visit_logs vl ON vl.unique_pass_id = vp.pass_id
        GROUP BY vp.visitor_id
      ),
      PassCount AS (
        SELECT 
          visitor_id,
          COUNT(*) AS total_passes
        FROM visitor_passes
        GROUP BY visitor_id
      )
      SELECT 
        v.visitor_id AS id,
        v.name AS visitor_name,
        v.contact_no,
        v.email,
        v.identity_type,
        v.identity_no,
        v.company,
        v.address,
        v.city,
        v.state,
        v.vehicle_details,
        d.department_name,
        u.name AS employee_name,
        vp.purpose_of_visit,
        vl.check_in_time,
        vl.check_out_time,
        vp.pass_id,
        v.photo_url,
        pc.total_passes
      FROM visitors v
      INNER JOIN LatestVisit lv ON lv.visitor_id = v.visitor_id
      INNER JOIN visitor_passes vp ON vp.visitor_id = v.visitor_id
      INNER JOIN visit_logs vl 
        ON vl.unique_pass_id = vp.pass_id
        AND vl.check_in_time = lv.latest_checkin
      INNER JOIN users u ON u.employee_id = vp.employee_to_visit
      INNER JOIN departments d ON d.deptCode = vp.department_to_visit
      LEFT JOIN PassCount pc ON pc.visitor_id = v.visitor_id
      ORDER BY vl.check_in_time DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Visitor history fetched successfully",
    count: result.recordset.length,
    data: result.recordset,
  });
});

// Get Visitor Details
export const getVisitorDetails = tryCatch(async (req, res, next) => {
  const { visitorId } = req.params;

  if (!visitorId) {
    throw new AppError("Visitor ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  /* ---------- Visitor Info ---------- */
  const visitorInfo = await pool
    .request()
    .input("VisitorId", sql.VarChar(50), visitorId).query(`
      SELECT 
        v.visitor_id,
        v.name AS visitor_name,
        v.contact_no,
        v.email,
        v.company,
        v.address,
        v.city,
        v.state,
        v.identity_type,
        v.identity_no,
        v.vehicle_details,
        v.photo_url AS visitor_photo
      FROM visitors v
      WHERE v.visitor_id = @VisitorId
    `);

  if (!visitorInfo.recordset.length) {
    await pool.close();
    throw new AppError("Visitor not found", 404);
  }

  /* ---------- Visit Logs ---------- */
  const visitLogs = await pool
    .request()
    .input("VisitorId", sql.VarChar(50), visitorId).query(`
      SELECT 
        vp.pass_id,
        vp.token,
        d.department_name,
        u.name AS employee_name,
        vp.purpose_of_visit,
        vl.check_in_time,
        vl.check_out_time
      FROM visitor_passes vp
      INNER JOIN visit_logs vl ON vl.unique_pass_id = vp.pass_id
      INNER JOIN departments d ON d.deptCode = vp.department_to_visit
      INNER JOIN users u ON u.employee_id = vp.employee_to_visit
      WHERE vp.visitor_id = @VisitorId
      ORDER BY vl.check_in_time DESC
    `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Visitor full history fetched successfully",
    visitor: visitorInfo.recordset[0],
    visit_logs: visitLogs.recordset,
  });
});
