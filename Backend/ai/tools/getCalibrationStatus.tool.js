import sql from "mssql";

// New aggregate (no existing summary endpoint to wrap — Backend/controllers/compliance/
// calibiration.controller.js's getAllAssets is a full unfiltered row dump). Kept
// deliberately simple: a status rollup plus overdue/due-soon counts on
// CalibrationAssets (pool3, always available — no offline-pool risk here).
export const definition = {
  type: "function",
  function: {
    name: "getCalibrationStatus",
    description:
      "Get calibration compliance status: count of instruments by status (e.g. Calibrated / Out of Calibration), plus how many are overdue or due soon. Use for 'calibration data' or 'compliance' questions.",
    parameters: {
      type: "object",
      properties: {
        dueSoonDays: { type: "number", description: "How many days ahead counts as 'due soon'. Defaults to 30." },
      },
    },
  },
};

export const execute = async ({ dueSoonDays = 30 } = {}) => {
  const request = global.pool3.request().input("dueSoonDays", sql.Int, dueSoonDays);

  const [statusResult, dueResult] = await Promise.all([
    request.query(`SELECT Status, COUNT(*) AS count FROM CalibrationAssets GROUP BY Status`),
    global.pool3.request().input("dueSoonDays", sql.Int, dueSoonDays).query(`
      SELECT
        SUM(CASE WHEN NextCalibrationDate < GETDATE() THEN 1 ELSE 0 END) AS overdueCount,
        SUM(CASE WHEN NextCalibrationDate BETWEEN GETDATE() AND DATEADD(day, @dueSoonDays, GETDATE()) THEN 1 ELSE 0 END) AS dueSoonCount,
        COUNT(*) AS totalAssets
      FROM CalibrationAssets
    `),
  ]);

  if (!dueResult.recordset[0].totalAssets) return { note: "No calibration assets found." };

  return {
    dueSoonDays,
    byStatus: statusResult.recordset,
    overdueCount: dueResult.recordset[0].overdueCount,
    dueSoonCount: dueResult.recordset[0].dueSoonCount,
    totalAssets: dueResult.recordset[0].totalAssets,
  };
};
