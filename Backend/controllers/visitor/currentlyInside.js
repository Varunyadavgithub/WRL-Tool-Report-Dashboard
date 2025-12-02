import { sendCurrentlyInsideVisitorsEmail } from "./notification.js";

export const notifyCurrentlyInsideVisitors = async (req, res) => {
  try {
    const pool = global.pool1;
    const result = await pool.request().query(`
      SELECT 
        visitor_name,
        contact_no,
        company,
        department_name,
        employee_name,
        check_in_time
      FROM Visitors
      WHERE check_in_time IS NOT NULL AND check_out_time IS NULL
    `);

    const visitors = result.recordset;

    if (!visitors.length) {
      return res.json({ success: true, message: "No visitors currently inside." });
    }

    const emailSent = await sendCurrentlyInsideVisitorsEmail(visitors);

    if (emailSent) {
      res.json({
        success: true,
        message: `Email sent successfully to security. (${visitors.length} visitors inside)`,
      });
    } else {
      res.status(500).json({ success: false, message: "Email sending failed." });
    }
    await pool.close();
  } catch (error) {
    console.error("Error notifying currently inside visitors:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
