import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

/* ═══════════════════════════════════════════════════════════════════════
   STALLS
═══════════════════════════════════════════════════════════════════════ */
export const getTestStalls = tryCatch(async (_, res) => {
  const pool = await connectToDB(dbConfig1);
  const result = await pool.request().query(`
    SELECT Id, StallCode, StallName, IsActive, SortOrder
    FROM BISTestStall
    WHERE IsActive = 1
    ORDER BY SortOrder, Id
  `);

  const stalls = result.recordset.map((row) => ({
    id: row.Id,
    stallCode: row.StallCode,
    stallName: row.StallName,
    isActive: row.IsActive,
    sortOrder: row.SortOrder,
  }));

  res.status(200).json({ success: true, stalls });
});

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD — which model is currently on which stall. A stall's "current
   test" is its open BISTestRun (EndedAt IS NULL), set the moment an
   operator puts a unit on the stall — independent of when the test report
   for it eventually gets written up, since that only happens after the
   test is already done.
═══════════════════════════════════════════════════════════════════════ */
export const getTestLabDashboard = tryCatch(async (_, res) => {
  const pool = await connectToDB(dbConfig1);

  const stallsResult = await pool.request().query(`
    SELECT s.Id AS StallId, s.StallCode, s.StallName, s.SortOrder,
           r.Id AS RunId, r.MaterialCode, r.ModelName, r.ReportType, r.StartedBy, r.StartedAt,
           bc.PhotoPath
    FROM BISTestStall s
    LEFT JOIN BISTestRun r ON r.StallId = s.Id AND r.Status = 'InProgress'
    LEFT JOIN BISCategory bc ON bc.MaterialCode = r.MaterialCode
    WHERE s.IsActive = 1
    ORDER BY s.SortOrder, s.Id
  `);

  const materialCodes = [...new Set(stallsResult.recordset.filter((r) => r.MaterialCode).map((r) => r.MaterialCode))];
  let specsByMaterialCode = {};

  if (materialCodes.length > 0) {
    const specsResult = await pool.request().query(`
      SELECT MaterialCode, SpecKey, SpecValue
      FROM BISModelSpec
      WHERE MaterialCode IN (${materialCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")})
      ORDER BY MaterialCode, SortOrder
    `);
    specsByMaterialCode = specsResult.recordset.reduce((acc, row) => {
      (acc[row.MaterialCode] ??= []).push({ specKey: row.SpecKey, specValue: row.SpecValue });
      return acc;
    }, {});
  }

  const stalls = stallsResult.recordset.map((row) => ({
    id: row.StallId,
    stallCode: row.StallCode,
    stallName: row.StallName,
    sortOrder: row.SortOrder,
    activeRun: row.RunId
      ? {
          id: row.RunId,
          materialCode: row.MaterialCode,
          modelName: row.ModelName,
          reportType: row.ReportType,
          startedBy: row.StartedBy,
          startedAt: row.StartedAt,
          photoPath: row.PhotoPath,
          specs: specsByMaterialCode[row.MaterialCode] || [],
        }
      : null,
  }));

  const completedTodayResult = await pool.request().query(`
    SELECT COUNT(*) AS Cnt
    FROM BISTestRun
    WHERE Status = 'Completed' AND CAST(EndedAt AS DATE) = CAST(GETDATE() AS DATE)
  `);

  res.status(200).json({
    success: true,
    stalls,
    completedToday: completedTodayResult.recordset[0].Cnt,
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   START / END — the operator's own action, independent of the test report
   (which gets written up later, after the test is already finished).
═══════════════════════════════════════════════════════════════════════ */
const REPORT_TYPES = ["Introduction", "Sound", "Volume"];

export const startTestRun = tryCatch(async (req, res) => {
  const { stallId, materialCode, modelName, reportType, startedBy } = req.body;
  if (!stallId || !materialCode || !modelName) {
    throw new AppError("Missing required fields: stallId, materialCode or modelName.", 400);
  }
  if (reportType && !REPORT_TYPES.includes(reportType)) {
    throw new AppError(`Invalid reportType. Must be one of: ${REPORT_TYPES.join(", ")}.`, 400);
  }

  const pool = await connectToDB(dbConfig1);

  const activeExisting = await pool
    .request()
    .input("StallId", sql.Int, stallId)
    .query(`SELECT Id FROM BISTestRun WHERE StallId = @StallId AND Status = 'InProgress'`);

  if (activeExisting.recordset.length > 0) {
    throw new AppError("This stall already has a test in progress.", 409);
  }

  const insertResult = await pool
    .request()
    .input("StallId", sql.Int, stallId)
    .input("MaterialCode", sql.NVarChar(50), materialCode)
    .input("ModelName", sql.NVarChar(300), modelName)
    .input("ReportType", sql.NVarChar(20), reportType || null)
    .input("StartedBy", sql.NVarChar(100), startedBy || null)
    .query(`
      INSERT INTO BISTestRun (StallId, MaterialCode, ModelName, ReportType, Status, StartedBy)
      OUTPUT INSERTED.Id
      VALUES (@StallId, @MaterialCode, @ModelName, @ReportType, 'InProgress', @StartedBy)
    `);

  res.status(200).json({ success: true, runId: insertResult.recordset[0].Id, message: "Test started successfully." });
});

export const endTestRun = tryCatch(async (req, res) => {
  const { runId } = req.params;
  const { endedBy } = req.body;
  if (!runId) throw new AppError("Missing required field: runId.", 400);

  const pool = await connectToDB(dbConfig1);

  const result = await pool
    .request()
    .input("Id", sql.Int, parseInt(runId, 10))
    .input("EndedBy", sql.NVarChar(100), endedBy || null)
    .query(`
      UPDATE BISTestRun
      SET Status = 'Completed', EndedBy = @EndedBy, EndedAt = GETDATE()
      WHERE Id = @Id AND Status = 'InProgress'
    `);

  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ success: false, message: "Active run not found." });
  }

  res.status(200).json({ success: true, message: "Test ended successfully." });
});
