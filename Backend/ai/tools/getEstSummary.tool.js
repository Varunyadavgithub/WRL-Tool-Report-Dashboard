import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Reuses the exact aggregate query from Backend/controllers/quality/estReport.controller.js's
// getEstReportSummary — EST (Electrical Safety Test) pass/fail rates, overall and per sub-test.
export const definition = {
  type: "function",
  function: {
    name: "getEstSummary",
    description:
      "Get EST (Electrical Safety Test) pass/fail stats for a date range: overall pass rate plus the four sub-tests (ECT, HV, IR, LCT). Use for 'EST data' or 'electrical safety test' questions.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date/time, e.g. '2026-07-05 00:00' or '2026-07-05'." },
        endDate: { type: "string", description: "End date/time, e.g. '2026-07-05 23:59' or '2026-07-05'." },
        model: { type: "string", description: "Optional model number to filter to a single model." },
      },
      required: ["startDate", "endDate"],
    },
  },
};

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const expandToDayBounds = (dateStr, isEnd) =>
  BARE_DATE.test(dateStr?.trim()) ? `${dateStr.trim()} ${isEnd ? "23:59:59" : "00:00:00"}` : dateStr;

export const execute = async ({ startDate, endDate, model } = {}) => {
  if (!startDate || !endDate) return { error: "startDate and endDate are required." };

  const istStart = convertToIST(expandToDayBounds(startDate, false));
  const istEnd = convertToIST(expandToDayBounds(endDate, true));

  const request = global.pool1.request()
    .input("startDate", sql.DateTime, istStart)
    .input("endDate", sql.DateTime, istEnd);
  if (model) request.input("model", sql.VarChar, model);

  const result = await request.query(`
    SELECT
      COUNT(*) as totalTests,
      SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) as totalPass,
      SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END) as totalFail,
      SUM(CASE WHEN ect_result = 'Pass' THEN 1 ELSE 0 END) as ectPass,
      SUM(CASE WHEN ect_result = 'Fail' THEN 1 ELSE 0 END) as ectFail,
      SUM(CASE WHEN hv_result = 'Pass' THEN 1 ELSE 0 END) as hvPass,
      SUM(CASE WHEN hv_result = 'Fail' THEN 1 ELSE 0 END) as hvFail,
      SUM(CASE WHEN ir_result = 'Pass' THEN 1 ELSE 0 END) as irPass,
      SUM(CASE WHEN ir_result = 'Fail' THEN 1 ELSE 0 END) as irFail,
      SUM(CASE WHEN lct_ln_result = 'Pass' THEN 1 ELSE 0 END) as lctPass,
      SUM(CASE WHEN lct_ln_result = 'Fail' THEN 1 ELSE 0 END) as lctFail,
      COUNT(DISTINCT model_no) as uniqueModels,
      COUNT(DISTINCT operator) as uniqueOperators
    FROM ESTStaging
    WHERE date_time BETWEEN @startDate AND @endDate
    ${model ? "AND model_no = @model" : ""}
  `);

  const s = result.recordset[0];
  if (!s.totalTests) return { startDate, endDate, note: "No EST tests found in this range." };

  const rate = (pass) => Number(((pass / s.totalTests) * 100).toFixed(2));

  return {
    startDate,
    endDate,
    total: { tests: s.totalTests, pass: s.totalPass, fail: s.totalFail, passRatePct: rate(s.totalPass) },
    ect: { pass: s.ectPass, fail: s.ectFail, passRatePct: rate(s.ectPass) },
    hv: { pass: s.hvPass, fail: s.hvFail, passRatePct: rate(s.hvPass) },
    ir: { pass: s.irPass, fail: s.irFail, passRatePct: rate(s.irPass) },
    lct: { pass: s.lctPass, fail: s.lctFail, passRatePct: rate(s.lctPass) },
    uniqueModels: s.uniqueModels,
    uniqueOperators: s.uniqueOperators,
  };
};
