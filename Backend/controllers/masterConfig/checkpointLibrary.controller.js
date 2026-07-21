/** Checkpoint Library — CRUD + usage-count increment (pool3 / CheckpointLibrary). */
import sql from "mssql";
import { strOrNull, toBit } from "./helpers.js";

// -- Checkpoint Library -------------------------------------------------------
// "CheckPoint" collides with the reserved CHECKPOINT keyword in T-SQL, so the
// SQL column is CheckPointText -- aliased back to checkPoint for the JS side.
const CHECKPOINT_LIBRARY_SELECT = `
  SELECT
    Id AS id, CheckPointText AS [checkPoint], Method AS method, Specification AS specification,
    Category AS category, Required AS required, UsageCount AS usageCount, Status AS status,
    CreatedBy AS createdBy, CreatedAt AS createdAt
  FROM CheckpointLibrary`;

export const getCheckpointLibrary = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${CHECKPOINT_LIBRARY_SELECT} ORDER BY Id DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createCheckpointLibraryEntry = async (req, res) => {
  try {
    const c = req.body;
    if (!c.checkPoint?.trim()) return res.status(400).json({ success: false, message: "checkPoint is required" });
    const result = await global.pool3.request()
      .input("checkPoint",    sql.NVarChar(500), c.checkPoint.trim())
      .input("method",        sql.NVarChar(300), strOrNull(c.method))
      .input("specification", sql.NVarChar(500), strOrNull(c.specification))
      .input("category",      sql.NVarChar(100), strOrNull(c.category))
      .input("required",      sql.Bit, toBit(c.required))
      .input("status",        sql.Bit, toBit(c.status ?? true))
      .input("createdBy",     sql.NVarChar(200), strOrNull(c.createdBy))
      .query(`
        INSERT INTO CheckpointLibrary (CheckPointText, Method, Specification, Category, Required, Status, CreatedBy)
        OUTPUT
          INSERTED.Id AS id, INSERTED.CheckPointText AS [checkPoint], INSERTED.Method AS method,
          INSERTED.Specification AS specification, INSERTED.Category AS category,
          INSERTED.Required AS required, INSERTED.UsageCount AS usageCount, INSERTED.Status AS status,
          INSERTED.CreatedBy AS createdBy, INSERTED.CreatedAt AS createdAt
        VALUES (@checkPoint, @method, @specification, @category, @required, @status, @createdBy)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCheckpointLibraryEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const c = req.body;
    const result = await global.pool3.request()
      .input("id",            sql.Int, id)
      .input("checkPoint",    sql.NVarChar(500), c.checkPoint)
      .input("method",        sql.NVarChar(300), strOrNull(c.method))
      .input("specification", sql.NVarChar(500), strOrNull(c.specification))
      .input("category",      sql.NVarChar(100), strOrNull(c.category))
      .input("required",      sql.Bit, toBit(c.required))
      .input("status",        sql.Bit, toBit(c.status ?? true))
      .query(`
        UPDATE CheckpointLibrary SET
          CheckPointText = @checkPoint, Method = @method, Specification = @specification,
          Category = @category, Required = @required, Status = @status, UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.CheckPointText AS [checkPoint], INSERTED.Method AS method,
          INSERTED.Specification AS specification, INSERTED.Category AS category,
          INSERTED.Required AS required, INSERTED.UsageCount AS usageCount, INSERTED.Status AS status,
          INSERTED.CreatedBy AS createdBy, INSERTED.CreatedAt AS createdAt
        WHERE Id = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Checkpoint not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCheckpointLibraryEntry = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM CheckpointLibrary WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fire-and-forget usage counter -- called by the AuditReport module when a
// library checkpoint is inserted into a template. Failures are non-fatal
// (counter is informational only, never blocks template editing).
export const incrementCheckpointUsage = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id)
      .query(`UPDATE CheckpointLibrary SET UsageCount = UsageCount + 1 WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
