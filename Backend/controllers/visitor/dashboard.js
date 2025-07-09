import sql, { dbConfig3 } from "../../config/db.js";

export const getDashboardStats = async (req, res) => {
  let pool;
  try {
    // Total Visitors
    const totalVisitorsQuery = `
        SELECT COUNT(*) as total_visitors 
        FROM visitors	
    `;

    // Active Visitors
    const activeVisitorsQuery = `
        SELECT COUNT(*) as active_visitors 
        FROM visit_logs 
        WHERE check_out_time IS NULL
    `;

    // Today's Visits
    const todayVisitsQuery = `
        SELECT COUNT(*) AS today_visits 
        FROM visit_logs 
        WHERE CAST(check_in_time AS DATE) = CAST(GETDATE() AS DATE);
    `;

    // Department Breakdown
    const departmentBreakdownQuery = `
        SELECT 
            d.id,
            d.department_name,
            COUNT(vp.id) AS visitor_count
        FROM departments d
        LEFT JOIN visitor_passes vp 
            ON d.deptCode = vp.department_to_visit
        GROUP BY d.id, d.department_name;
    `;

    // Monthly Visitor Trend
    const visitorTrendQuery = `
        SELECT 
            DATENAME(month, check_in_time) AS [month],
            COUNT(*) AS visitors
        FROM visit_logs
        WHERE YEAR(check_in_time) = YEAR(GETDATE())
        GROUP BY DATENAME(month, check_in_time), MONTH(check_in_time)
        ORDER BY MONTH(check_in_time);
    `;

    // Recent Visitors
    const recentVisitorsQuery = `
        SELECT TOP 10
            v.id,
            v.name,
            d.department_name AS department,
            vl.check_in_time
        FROM visit_logs vl
        JOIN visitor_passes vp ON vl.pass_id = vp.id
        JOIN visitors v ON vp.visitor_id = v.id
        JOIN departments d ON vp.department_to_visit = d.deptCode
        ORDER BY vl.check_in_time DESC;
    `;

    pool = await sql.connect(dbConfig3);
    const [
      totalVisitorsResult,
      activeVisitorsResult,
      todayVisitsResult,
      departmentBreakdownResult,
      visitorTrendResult,
      recentVisitorsResult,
    ] = await Promise.all([
      pool.request().query(totalVisitorsQuery),
      pool.request().query(activeVisitorsQuery),
      pool.request().query(todayVisitsQuery),
      pool.request().query(departmentBreakdownQuery),
      pool.request().query(visitorTrendQuery),
      pool.request().query(recentVisitorsQuery),
    ]);
    const dashboardStats = {
      totalVisitors: totalVisitorsResult.recordset[0]?.total_visitors || 0,
      activeVisitors: activeVisitorsResult.recordset[0]?.active_visitors || 0,
      todayVisits: todayVisitsResult.recordset[0]?.today_visits || 0,
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
