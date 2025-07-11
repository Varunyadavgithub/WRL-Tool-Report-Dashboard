import sql, { dbConfig3 } from "../../config/db.js";

export const getDashboardStats = async (req, res) => {
  let pool;
  try {
    // Combined Visitors Stats Query
    const visitorsStatsQuery = `
      SELECT
        (SELECT COUNT(*) FROM visitors) AS total_visitors,
        (SELECT COUNT(*) FROM visit_logs WHERE check_out_time IS NULL) AS active_visitors,
        (SELECT COUNT(*) FROM visit_logs WHERE CAST(check_in_time AS DATE) = CAST(GETDATE() AS DATE)) AS today_visits;
    `;

    // Department Breakdown
    const departmentBreakdownQuery = `
      SELECT
        d.id,
        d.department_name,
        COUNT(vp.pass_id) AS visitor_count
      FROM departments d
      LEFT JOIN visitor_passes vp
        ON d.deptCode = vp.department_to_visit
      GROUP BY d.id, d.department_name;
    `;

    // Daily Visitor Trend
    const visitorTrendQuery = `
      SELECT
        CAST(check_in_time AS DATE) AS [date],
        COUNT(*) AS visitors
      FROM visit_logs
      WHERE 
        YEAR(check_in_time) = YEAR(GETDATE()) 
        AND MONTH(check_in_time) = MONTH(GETDATE())
      GROUP BY CAST(check_in_time AS DATE)
      ORDER BY [date];
    `;

    // Recent Visitors
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
      ORDER BY vl.check_in_time DESC;
    `;

    pool = await new sql.ConnectionPool(dbConfig3).connect();
    const [
      visitorsStatsResult,
      departmentBreakdownResult,
      visitorTrendResult,
      recentVisitorsResult,
    ] = await Promise.all([
      pool.request().query(visitorsStatsQuery),
      pool.request().query(departmentBreakdownQuery),
      pool.request().query(visitorTrendQuery),
      pool.request().query(recentVisitorsQuery),
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
