import sql, { dbConfig3 } from "../../config/db.js";

export const getDashboardStats = async (req, res) => {
  const { filter } = req.query;
  const now = new Date();

  let startDate, endDate;

  if (filter === "month") {
    // First day of this month at 00:00:00
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    // Last day of this month at 23:59:59
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else {
    // Default to "day"
    // Today at 08:00:00
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);

    // Tomorrow at 20:00:00
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0, 0);
  }

  // Adjust for IST (+5:30)
  const isStart = new Date(startDate.getTime() + 330 * 60000);
  const isEnd = new Date(endDate.getTime() + 330 * 60000);

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();

    // --- Visitors Stats ---
    const visitorsStatsQuery = `
      SELECT
        (SELECT COUNT(*) FROM visitor_passes WHERE created_at BETWEEN @startDate AND @endDate) AS total_visitors,
        (SELECT COUNT(*) FROM visit_logs WHERE check_in_time BETWEEN @startDate AND @endDate AND check_out_time IS NULL) AS active_visitors,
        (SELECT COUNT(*) FROM visit_logs WHERE check_in_time BETWEEN @startDate AND @endDate) AS today_visits;
    `;

    // --- Department Breakdown (fixed LEFT JOIN filter) ---
    const departmentBreakdownQuery = `
      SELECT
        d.id,
        d.department_name,
        COUNT(vp.pass_id) AS visitor_count
      FROM departments d
      LEFT JOIN visitor_passes vp
        ON d.deptCode = vp.department_to_visit AND vp.created_at BETWEEN @startDate AND @endDate
      GROUP BY d.id, d.department_name;
    `;

    // --- Visitor Trend ---
    let visitorTrendQuery = "";
    if (filter === "month") {
      visitorTrendQuery = `
        SELECT
          DATENAME(MONTH, check_in_time) AS [month],
          COUNT(*) AS visitors
        FROM visit_logs
        WHERE check_in_time BETWEEN @startDate AND @endDate
        GROUP BY DATENAME(MONTH, check_in_time), MONTH(check_in_time)
        ORDER BY MONTH(check_in_time);
      `;
    } else {
      visitorTrendQuery = `
        SELECT
          CAST(check_in_time AS DATE) AS [date],
          COUNT(*) AS visitors
        FROM visit_logs
        WHERE check_in_time BETWEEN @startDate AND @endDate
        GROUP BY CAST(check_in_time AS DATE)
        ORDER BY [date];
      `;
    }

    // --- Recent Visitors ---
    const recentVisitorsQuery = `
      SELECT TOP 10
        v.visitor_id,
        v.name AS visitor_name,
        d.department_name,
        u.name AS employee_name,
        vl.check_in_time,
        vl.check_out_time
      FROM visit_logs vl
      JOIN visitor_passes vp ON vl.unique_pass_id = vp.pass_id
      JOIN visitors v ON vp.visitor_id = v.visitor_id
      JOIN departments d ON vp.department_to_visit = d.deptCode
      JOIN users u ON vp.employee_to_visit = u.employee_id
      WHERE check_in_time BETWEEN @startDate AND @endDate
      ORDER BY vl.check_in_time DESC;
    `;

    const request = pool.request();
    request.input("startDate", sql.DateTime, isStart);
    request.input("endDate", sql.DateTime, isEnd);

    const [
      visitorsStatsResult,
      departmentBreakdownResult,
      visitorTrendResult,
      recentVisitorsResult,
    ] = await Promise.all([
      request.query(visitorsStatsQuery),
      request.query(departmentBreakdownQuery),
      request.query(visitorTrendQuery),
      request.query(recentVisitorsQuery),
    ]);

    const stats = visitorsStatsResult.recordset[0];

    const dashboardStats = {
      totalVisitors: stats?.total_visitors || 0,
      activeVisitors: stats?.active_visitors || 0,
      todayVisits: stats?.today_visits || 0,
      departments: departmentBreakdownResult.recordset,
      visitorTrend: visitorTrendResult.recordset,
      recentVisitors: recentVisitorsResult.recordset,
    };

    res.json({ success: true, dashboardStats });
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};