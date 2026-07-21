/** Quality Defects — CRUD (pool3 / QualityDefects). */
import sql from "mssql";
import { strOrNull, toBit } from "./helpers.js";

// ── Quality Defects ──────────────────────────────────────────────────────────
const QUALITY_SELECT = `
  SELECT
    Id AS id, QCode AS qCode, DefectName AS defectName, Category AS category, Type AS type,
    Severity AS severity, Stage AS stage, RootCause AS rootCause, CapaRequired AS capaRequired, Status AS status
  FROM QualityDefects`;

export const getQualityDefects = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${QUALITY_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createQualityDefect = async (req, res) => {
  try {
    const q = req.body;
    const result = await global.pool3.request()
      .input("qCode",        sql.NVarChar(50),  strOrNull(q.qCode))
      .input("defectName",   sql.NVarChar(300), q.defectName)
      .input("category",     sql.NVarChar(100), strOrNull(q.category))
      .input("type",         sql.NVarChar(50),  strOrNull(q.type))
      .input("severity",     sql.NVarChar(50),  strOrNull(q.severity))
      .input("stage",        sql.NVarChar(100), strOrNull(q.stage))
      .input("rootCause",    sql.NVarChar(300), strOrNull(q.rootCause))
      .input("capaRequired", sql.Bit, toBit(q.capaRequired))
      .input("status",       sql.Bit, toBit(q.status ?? true))
      .query(`
        INSERT INTO QualityDefects (QCode, DefectName, Category, Type, Severity, Stage, RootCause, CapaRequired, Status)
        OUTPUT
          INSERTED.Id AS id, INSERTED.QCode AS qCode, INSERTED.DefectName AS defectName, INSERTED.Category AS category, INSERTED.Type AS type,
          INSERTED.Severity AS severity, INSERTED.Stage AS stage, INSERTED.RootCause AS rootCause, INSERTED.CapaRequired AS capaRequired, INSERTED.Status AS status
        VALUES (@qCode, @defectName, @category, @type, @severity, @stage, @rootCause, @capaRequired, @status)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateQualityDefect = async (req, res) => {
  try {
    const { id } = req.params;
    const q = req.body;
    const result = await global.pool3.request()
      .input("id",           sql.Int, id)
      .input("qCode",        sql.NVarChar(50),  strOrNull(q.qCode))
      .input("defectName",   sql.NVarChar(300), q.defectName)
      .input("category",     sql.NVarChar(100), strOrNull(q.category))
      .input("type",         sql.NVarChar(50),  strOrNull(q.type))
      .input("severity",     sql.NVarChar(50),  strOrNull(q.severity))
      .input("stage",        sql.NVarChar(100), strOrNull(q.stage))
      .input("rootCause",    sql.NVarChar(300), strOrNull(q.rootCause))
      .input("capaRequired", sql.Bit, toBit(q.capaRequired))
      .input("status",       sql.Bit, toBit(q.status ?? true))
      .query(`
        UPDATE QualityDefects SET
          QCode = @qCode, DefectName = @defectName, Category = @category, Type = @type,
          Severity = @severity, Stage = @stage, RootCause = @rootCause, CapaRequired = @capaRequired, Status = @status,
          UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.QCode AS qCode, INSERTED.DefectName AS defectName, INSERTED.Category AS category, INSERTED.Type AS type,
          INSERTED.Severity AS severity, INSERTED.Stage AS stage, INSERTED.RootCause AS rootCause, INSERTED.CapaRequired AS capaRequired, INSERTED.Status AS status
        WHERE Id = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Quality defect not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteQualityDefect = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM QualityDefects WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
