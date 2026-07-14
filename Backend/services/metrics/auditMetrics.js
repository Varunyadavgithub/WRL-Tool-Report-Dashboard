import sql from "mssql";
import { MAX_RANGE_DAYS } from "../../ai/tools/_shared.js";

// Daily-grouped variant of the audit query in
// Backend/ai/tools/getAuditSummary.tool.js — same Audits table (pool3),
// same Status/IsDeleted/CreatedAt/TemplateId columns, grouped by day.
// Note: Audits has no quality "score" or findings-severity column — only a
// submitted/approved/rejected workflow status — so approvalRate is the
// closest honest proxy for audit health, not a defect-weighted index like
// quality.fpqi.
const dayCount = (start, end) => Math.round((new Date(end) - new Date(start)) / 86400000) + 1;

const FIELD_COLUMN = { totalAudits: "totalAudits", approvedCount: "approvedCount", rejectedCount: "rejectedCount" };

/** Daily {date, value, sampleSize} series for one audit field, optionally scoped to one template. */
export const getDailySeries = async (field, start, end, { templateId } = {}) => {
  if (dayCount(start, end) > MAX_RANGE_DAYS) {
    throw new Error(`Date range too wide (${dayCount(start, end)} days). Please ask for ${MAX_RANGE_DAYS} days or fewer at a time.`);
  }

  const result = await global.pool3.request()
    .input("startDate", sql.DateTime, new Date(`${start} 00:00:00`))
    .input("endDate", sql.DateTime, new Date(`${end} 23:59:59`))
    .input("templateId", sql.Int, templateId || null)
    .query(`
      SELECT
        CAST(CreatedAt AS DATE) AS reportDate,
        COUNT(*) AS totalAudits,
        SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS approvedCount,
        SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount
      FROM Audits
      WHERE IsDeleted = 0 AND CreatedAt BETWEEN @startDate AND @endDate
        AND (@templateId IS NULL OR TemplateId = @templateId)
      GROUP BY CAST(CreatedAt AS DATE)
      ORDER BY reportDate
    `);

  return result.recordset
    .map((r) => {
      const value = field === "approvalRate"
        ? (r.totalAudits > 0 ? Math.round((r.approvedCount / r.totalAudits) * 1000) / 10 : null)
        : r[FIELD_COLUMN[field]];
      return { date: r.reportDate.toISOString().slice(0, 10), value, sampleSize: r.totalAudits };
    })
    .filter((p) => p.value !== null);
};
