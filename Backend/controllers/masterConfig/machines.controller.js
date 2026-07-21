/** Machines — CRUD + image upload (pool3 / Machines). */
import sql from "mssql";
import { strOrNull, toBit } from "./helpers.js";

// ── Machines ─────────────────────────────────────────────────────────────────
const MACHINE_SELECT = `
  SELECT
    Id AS id, MachineName AS machineName, MachineCode AS machineCode, IpAddress AS ipAddress,
    ControllerType AS controllerType, ApiEndpoint AS apiEndpoint, Department AS department,
    LineName AS lineName, PlantLocation AS plantLocation, ImagePath AS imagePath,
    Connected AS connected, Status AS status
  FROM Machines`;

export const getMachines = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${MACHINE_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMachine = async (req, res) => {
  try {
    const m = req.body;
    if (!m.machineName || !m.machineCode) return res.status(400).json({ success: false, message: "machineName and machineCode are required" });

    const result = await global.pool3.request()
      .input("machineName",    sql.NVarChar(200), m.machineName)
      .input("machineCode",    sql.NVarChar(50),  m.machineCode)
      .input("ipAddress",      sql.NVarChar(50),  strOrNull(m.ipAddress))
      .input("controllerType", sql.NVarChar(50),  strOrNull(m.controllerType))
      .input("apiEndpoint",    sql.NVarChar(300), strOrNull(m.apiEndpoint))
      .input("department",     sql.NVarChar(200), strOrNull(m.department))
      .input("lineName",       sql.NVarChar(100), strOrNull(m.lineName))
      .input("plantLocation",  sql.NVarChar(100), strOrNull(m.plantLocation))
      .input("connected",      sql.Bit, toBit(m.connected))
      .input("status",         sql.Bit, toBit(m.status ?? true))
      .query(`
        INSERT INTO Machines (MachineName, MachineCode, IpAddress, ControllerType, ApiEndpoint, Department, LineName, PlantLocation, Connected, Status)
        OUTPUT
          INSERTED.Id AS id, INSERTED.MachineName AS machineName, INSERTED.MachineCode AS machineCode, INSERTED.IpAddress AS ipAddress,
          INSERTED.ControllerType AS controllerType, INSERTED.ApiEndpoint AS apiEndpoint, INSERTED.Department AS department,
          INSERTED.LineName AS lineName, INSERTED.PlantLocation AS plantLocation, INSERTED.ImagePath AS imagePath,
          INSERTED.Connected AS connected, INSERTED.Status AS status
        VALUES (@machineName, @machineCode, @ipAddress, @controllerType, @apiEndpoint, @department, @lineName, @plantLocation, @connected, @status)
      `);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `Machine Code "${req.body.machineCode}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const m = req.body;
    const result = await global.pool3.request()
      .input("id",             sql.Int, id)
      .input("machineName",    sql.NVarChar(200), m.machineName)
      .input("machineCode",    sql.NVarChar(50),  m.machineCode)
      .input("ipAddress",      sql.NVarChar(50),  strOrNull(m.ipAddress))
      .input("controllerType", sql.NVarChar(50),  strOrNull(m.controllerType))
      .input("apiEndpoint",    sql.NVarChar(300), strOrNull(m.apiEndpoint))
      .input("department",     sql.NVarChar(200), strOrNull(m.department))
      .input("lineName",       sql.NVarChar(100), strOrNull(m.lineName))
      .input("plantLocation",  sql.NVarChar(100), strOrNull(m.plantLocation))
      .input("connected",      sql.Bit, toBit(m.connected))
      .input("status",         sql.Bit, toBit(m.status ?? true))
      .query(`
        UPDATE Machines SET
          MachineName = @machineName, MachineCode = @machineCode, IpAddress = @ipAddress,
          ControllerType = @controllerType, ApiEndpoint = @apiEndpoint, Department = @department,
          LineName = @lineName, PlantLocation = @plantLocation, Connected = @connected, Status = @status,
          UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.MachineName AS machineName, INSERTED.MachineCode AS machineCode, INSERTED.IpAddress AS ipAddress,
          INSERTED.ControllerType AS controllerType, INSERTED.ApiEndpoint AS apiEndpoint, INSERTED.Department AS department,
          INSERTED.LineName AS lineName, INSERTED.PlantLocation AS plantLocation, INSERTED.ImagePath AS imagePath,
          INSERTED.Connected AS connected, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Machine not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `Machine Code "${req.body.machineCode}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMachine = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM Machines WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const uploadMachineImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: "image file is required" });

    const imagePath = `/uploads/MachineImages/${req.file.filename}`;
    const result = await global.pool3.request()
      .input("id", sql.Int, id)
      .input("imagePath", sql.NVarChar(300), imagePath)
      .query(`
        UPDATE Machines SET ImagePath = @imagePath, UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.MachineName AS machineName, INSERTED.MachineCode AS machineCode, INSERTED.IpAddress AS ipAddress,
          INSERTED.ControllerType AS controllerType, INSERTED.ApiEndpoint AS apiEndpoint, INSERTED.Department AS department,
          INSERTED.LineName AS lineName, INSERTED.PlantLocation AS plantLocation, INSERTED.ImagePath AS imagePath,
          INSERTED.Connected AS connected, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Machine not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
