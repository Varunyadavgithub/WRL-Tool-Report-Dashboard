/** Departments — CRUD (pool3 / MasterDepartments). */
import sql from "mssql";
import { toBit } from "./helpers.js";

// ── Departments ──────────────────────────────────────────────────────────────
const DEPARTMENT_SELECT = `SELECT Id AS id, Name AS name, Status AS status FROM MasterDepartments`;

export const getDepartments = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${DEPARTMENT_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const d = req.body;
    const result = await global.pool3.request()
      .input("name",   sql.NVarChar(200), d.name)
      .input("status", sql.Bit, toBit(d.status ?? true))
      .query(`
        INSERT INTO MasterDepartments (Name, Status)
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Status AS status
        VALUES (@name, @status)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `Department "${req.body.name}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body;
    const result = await global.pool3.request()
      .input("id",     sql.Int, id)
      .input("name",   sql.NVarChar(200), d.name)
      .input("status", sql.Bit, toBit(d.status ?? true))
      .query(`
        UPDATE MasterDepartments SET Name = @name, Status = @status, UpdatedAt = GETDATE()
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Status AS status
        WHERE Id = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Department not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `Department "${req.body.name}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM MasterDepartments WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
