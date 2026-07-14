import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Reuses the exact aggregate queries from Backend/controllers/visitor/dashboard.controller.js's
// getDashboardStats — visitor counts + department breakdown. That endpoint computes
// its own date window server-side from a "today"/"month" filter rather than
// accepting explicit dates, so this tool mirrors that same behavior exactly.
export const definition = {
  type: "function",
  function: {
    name: "getVisitorStats",
    description:
      "Get visitor management stats: total/active visitor counts and a per-department breakdown. Use for 'visitor data' questions.",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["today", "month"],
          description: "'today' = the current shift window (8am-8pm), 'month' = the current calendar month. Defaults to 'today'.",
        },
      },
    },
  },
};

export const execute = async ({ filter = "today" } = {}) => {
  const now = new Date();
  let startDate, endDate;
  if (filter === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0, 0);
  }
  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const request = global.pool3.request()
    .input("startDate", sql.DateTime, istStart)
    .input("endDate", sql.DateTime, istEnd);

  const [statsResult, deptResult] = await Promise.all([
    request.query(`
      SELECT
        (SELECT COUNT(*) FROM visitor_passes WHERE created_at BETWEEN @startDate AND @endDate) AS totalVisitors,
        (SELECT COUNT(*) FROM visit_logs WHERE check_in_time BETWEEN @startDate AND @endDate AND check_out_time IS NULL) AS activeVisitors,
        (SELECT COUNT(*) FROM visit_logs WHERE check_in_time BETWEEN @startDate AND @endDate) AS totalVisits
    `),
    global.pool3.request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(`
        SELECT d.department_name AS department, COUNT(vp.pass_id) AS visitorCount
        FROM departments d
        LEFT JOIN visitor_passes vp ON d.deptCode = vp.department_to_visit AND vp.created_at BETWEEN @startDate AND @endDate
        GROUP BY d.id, d.department_name
        ORDER BY visitorCount DESC
      `),
  ]);

  return {
    filter,
    ...statsResult.recordset[0],
    byDepartment: deptResult.recordset.filter((d) => d.visitorCount > 0).slice(0, 15),
  };
};
