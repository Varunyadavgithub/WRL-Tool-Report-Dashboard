import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { sendVisitorReportMail } from "../../emailTemplates/Visitor_Management_System/visitorReport.template.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

/* ==============================
   Fetch Visitors (Report)
================================ */
export const fetchVisitors = tryCatch(async (req, res) => {
  const { startTime, endTime } = req.query;

  if (!startTime || !endTime) {
    throw new AppError("startTime and endTime are required", 400);
  }

  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .input("startTime", sql.DateTime, istStart)
    .input("endTime", sql.DateTime, istEnd).query(`
      SELECT 
          v.visitor_id AS id,
          vp.visit_type,
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

          -- Duration HH:MM:SS
          CONVERT(
              VARCHAR(8),
              DATEADD(
                  SECOND,
                  DATEDIFF(
                    SECOND,
                    vl.check_in_time,
                    ISNULL(vl.check_out_time, GETDATE())
                  ),
                  0
              ),
              108
          ) AS visit_duration,

          vp_count.total_passes AS no_of_visit,
          vp.token

      FROM visitors v
      INNER JOIN visitor_passes vp 
          ON v.visitor_id = vp.visitor_id
      INNER JOIN visit_logs vl 
          ON vl.unique_pass_id = vp.pass_id
      INNER JOIN users u 
          ON u.employee_id = vp.employee_to_visit
      INNER JOIN departments d 
          ON d.deptCode = vp.department_to_visit

      LEFT JOIN (
          SELECT visitor_id, COUNT(*) AS total_passes
          FROM visitor_passes
          GROUP BY visitor_id
      ) vp_count 
          ON vp_count.visitor_id = v.visitor_id

      WHERE vl.check_in_time BETWEEN @startTime AND @endTime
    `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Visitor report data fetched successfully",
    data: result.recordset,
    totalCount: result.recordset.length,
  });
});

/* ==============================
   Send Visitor Report Email
================================ */
export const sendVisitorReport = tryCatch(async (req, res) => {
  const { visitors } = req.body;

  if (!Array.isArray(visitors) || visitors.length === 0) {
    throw new AppError("No visitor data provided", 400);
  }

  const emailSent = await sendVisitorReportMail(visitors);

  if (!emailSent) {
    throw new AppError("Failed to send visitor report email", 500);
  }

  res.status(200).json({
    success: true,
    message: "Visitor report sent successfully",
  });
});
