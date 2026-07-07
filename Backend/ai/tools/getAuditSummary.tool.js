// Reuses the exact aggregation query from Backend/controllers/auditReport/audit.controller.js's
// getAuditStats — same numbers the Audit dashboard shows, just returned as data instead of an HTTP response.
export const definition = {
  type: "function",
  function: {
    name: "getAuditSummary",
    description:
      "Get audit statistics (total/submitted/approved/rejected counts) for a date range, plus a per-template breakdown. Use for 'summarize this month's audits' type questions.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date, YYYY-MM-DD." },
        endDate: { type: "string", description: "End date, YYYY-MM-DD." },
      },
      required: ["startDate", "endDate"],
    },
  },
};

export const execute = async ({ startDate, endDate } = {}) => {
  if (!startDate || !endDate) return { error: "startDate and endDate are required." };

  const request = global.pool3.request()
    .input("startDate", startDate)
    .input("endDate", endDate);

  const summaryResult = await request.query(`
    SELECT
      COUNT(*) AS TotalAudits,
      SUM(CASE WHEN Status = 'submitted' THEN 1 ELSE 0 END) AS SubmittedCount,
      SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedCount,
      SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) AS RejectedCount
    FROM Audits
    WHERE IsDeleted = 0 AND CreatedAt >= @startDate AND CreatedAt <= @endDate
  `);

  const templateResult = await request.query(`
    SELECT TemplateName, TemplateId, COUNT(*) AS AuditCount,
           SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedCount
    FROM Audits
    WHERE IsDeleted = 0 AND CreatedAt >= @startDate AND CreatedAt <= @endDate
    GROUP BY TemplateName, TemplateId
    ORDER BY AuditCount DESC
  `);

  return {
    startDate,
    endDate,
    summary: summaryResult.recordset[0],
    templateBreakdown: templateResult.recordset.slice(0, 10),
  };
};
