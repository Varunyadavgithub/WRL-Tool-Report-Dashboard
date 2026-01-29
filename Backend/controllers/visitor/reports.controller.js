import sql, { dbConfig3 } from "../../config/db.config.js";
import { sendVisitorReportMail } from "../../emailTemplates/Visitor_Management_System/visitorReport.template.js";

// Visitor
export const fetchVisitors = async (req, res) => {
  const { startTime, endTime } = req.query;
  if (!startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: "startTime, endTime is required",
    });
  }
  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);

    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    const query = `
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
                  DATEDIFF(SECOND, vl.check_in_time, ISNULL(vl.check_out_time, GETDATE())),
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
      where vl.check_in_time between @startTime and @endTime
    `;
    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const sendVisitorReport = async (req, res) => {
  try {
    const { visitors } = req.body;

    if (!Array.isArray(visitors) || visitors.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No visitor data provided." });
    }

    const emailSent = await sendVisitorReportMail(visitors);

    if (emailSent) {
      return res
        .status(200)
        .json({ success: true, message: "Visitor report sent successfully." });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to send email." });
    }
  } catch (error) {
    console.error("Error in sendVisitorReport controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};