/** Downtime Reasons — CRUD (pool3 / DowntimeReasons). */
import sql from "mssql";
import { strOrNull, toBit } from "./helpers.js";

// ── Downtime Reasons ─────────────────────────────────────────────────────────
const DOWNTIME_SELECT = `
  SELECT Id AS id, DtCode AS dtCode, Reason AS reason, Department AS department, Status AS status
  FROM DowntimeReasons`;

export const getDowntimeReasons = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${DOWNTIME_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createDowntimeReason = async (req, res) => {
  try {
    const r = req.body;
    const result = await global.pool3.request()
      .input("dtCode",     sql.NVarChar(50),  strOrNull(r.dtCode))
      .input("reason",     sql.NVarChar(300), r.reason)
      .input("department", sql.NVarChar(200), strOrNull(r.department))
      .input("status",     sql.Bit, toBit(r.status ?? true))
      .query(`
        INSERT INTO DowntimeReasons (DtCode, Reason, Department, Status)
        OUTPUT INSERTED.Id AS id, INSERTED.DtCode AS dtCode, INSERTED.Reason AS reason, INSERTED.Department AS department, INSERTED.Status AS status
        VALUES (@dtCode, @reason, @department, @status)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateDowntimeReason = async (req, res) => {
  try {
    const { id } = req.params;
    const r = req.body;
    const result = await global.pool3.request()
      .input("id",         sql.Int, id)
      .input("dtCode",     sql.NVarChar(50),  strOrNull(r.dtCode))
      .input("reason",     sql.NVarChar(300), r.reason)
      .input("department", sql.NVarChar(200), strOrNull(r.department))
      .input("status",     sql.Bit, toBit(r.status ?? true))
      .query(`
        UPDATE DowntimeReasons SET DtCode = @dtCode, Reason = @reason, Department = @department, Status = @status, UpdatedAt = GETDATE()
        OUTPUT INSERTED.Id AS id, INSERTED.DtCode AS dtCode, INSERTED.Reason AS reason, INSERTED.Department AS department, INSERTED.Status AS status
        WHERE Id = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Downtime reason not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteDowntimeReason = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM DowntimeReasons WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
