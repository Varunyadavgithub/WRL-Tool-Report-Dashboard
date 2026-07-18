/**
 * Master Config Controller
 * CRUD for Material Config, Shift Config, Downtime Reasons, Departments
 * and Quality Defects (pool3 / DB3).
 */
import fs from "fs";
import path from "path";
import sql from "mssql";
import { UPLOADS_DIR } from "../utils/storage/config.js";
import { sendTestMail } from "../emailTemplates/PartProcess_System/testMail.template.js";
import { sendShiftEndReportMail } from "../emailTemplates/PartProcess_System/shiftEndReport.template.js";
import { buildShiftReport } from "../services/shiftReport.service.js";
import { buildReportAttachments, REPORT_NAMES } from "../services/reportAttachments.service.js";

const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const strOrNull = (v) => (v === "" || v === null || v === undefined ? null : String(v));
const toBit = (v) => (v ? 1 : 0);

const MATERIAL_SELECT = `
  SELECT
    Id AS id, SapCode AS sapCode, PartName AS partName, Category AS category,
    SheetSapCode AS sheetSapCode, SheetDescription AS sheetDescription,
    Length AS length, Width AS width, Thickness AS thickness, Weight AS weight,
    ComponentWeight AS componentWeight, ScrapWeight AS scrapWeight,
    NoOfSheet AS noOfSheet, ActualComponentsPerSheet AS actualComponentsPerSheet,
    PncLoadingUnloading AS pncLoadingUnloading, DefinedComponentCycleTime AS definedComponentCycleTime,
    DrawingNumber AS drawingNumber, DrawingRevision AS drawingRevision,
    DrawingPath AS drawingPath, Status AS status
  FROM MaterialConfigs`;

// ── Materials ────────────────────────────────────────────────────────────────
export const getMaterials = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${MATERIAL_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMaterial = async (req, res) => {
  try {
    const m = req.body;
    if (!m.sapCode) return res.status(400).json({ success: false, message: "sapCode is required" });

    const result = await global.pool3.request()
      .input("sapCode",        sql.NVarChar(50),  m.sapCode)
      .input("partName",       sql.NVarChar(300), strOrNull(m.partName))
      .input("category",       sql.NVarChar(100), strOrNull(m.category))
      .input("sheetSapCode",   sql.NVarChar(50),  strOrNull(m.sheetSapCode))
      .input("sheetDescription", sql.NVarChar(300), strOrNull(m.sheetDescription))
      .input("length",         sql.Decimal(12, 3), numOrNull(m.length))
      .input("width",          sql.Decimal(12, 3), numOrNull(m.width))
      .input("thickness",      sql.Decimal(12, 3), numOrNull(m.thickness))
      .input("weight",         sql.Decimal(12, 3), numOrNull(m.weight))
      .input("componentWeight",sql.Decimal(12, 3), numOrNull(m.componentWeight))
      .input("scrapWeight",    sql.Decimal(12, 3), numOrNull(m.scrapWeight))
      .input("noOfSheet",      sql.Decimal(12, 3), numOrNull(m.noOfSheet))
      .input("actualComponentsPerSheet", sql.Decimal(12, 3), numOrNull(m.actualComponentsPerSheet))
      .input("pncLoadingUnloading",      sql.Decimal(12, 3), numOrNull(m.pncLoadingUnloading))
      .input("definedComponentCycleTime",sql.Decimal(12, 3), numOrNull(m.definedComponentCycleTime))
      .input("drawingNumber",  sql.NVarChar(100), strOrNull(m.drawingNumber))
      .input("drawingRevision",sql.NVarChar(50),  strOrNull(m.drawingRevision))
      .input("status",         sql.Bit, toBit(m.status ?? true))
      .query(`
        INSERT INTO MaterialConfigs (
          SapCode, PartName, Category, SheetSapCode, SheetDescription, Length, Width, Thickness, Weight,
          ComponentWeight, ScrapWeight, NoOfSheet, ActualComponentsPerSheet,
          PncLoadingUnloading, DefinedComponentCycleTime, DrawingNumber, DrawingRevision, Status
        )
        OUTPUT
          INSERTED.Id AS id, INSERTED.SapCode AS sapCode, INSERTED.PartName AS partName, INSERTED.Category AS category,
          INSERTED.SheetSapCode AS sheetSapCode, INSERTED.SheetDescription AS sheetDescription,
          INSERTED.Length AS length, INSERTED.Width AS width, INSERTED.Thickness AS thickness, INSERTED.Weight AS weight,
          INSERTED.ComponentWeight AS componentWeight, INSERTED.ScrapWeight AS scrapWeight,
          INSERTED.NoOfSheet AS noOfSheet, INSERTED.ActualComponentsPerSheet AS actualComponentsPerSheet,
          INSERTED.PncLoadingUnloading AS pncLoadingUnloading, INSERTED.DefinedComponentCycleTime AS definedComponentCycleTime,
          INSERTED.DrawingNumber AS drawingNumber, INSERTED.DrawingRevision AS drawingRevision, INSERTED.Status AS status
        VALUES (
          @sapCode, @partName, @category, @sheetSapCode, @sheetDescription, @length, @width, @thickness, @weight,
          @componentWeight, @scrapWeight, @noOfSheet, @actualComponentsPerSheet,
          @pncLoadingUnloading, @definedComponentCycleTime, @drawingNumber, @drawingRevision, @status
        )
      `);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `SAP Code "${req.body.sapCode}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const m = req.body;

    const result = await global.pool3.request()
      .input("id",             sql.Int, id)
      .input("sapCode",        sql.NVarChar(50),  m.sapCode)
      .input("partName",       sql.NVarChar(300), strOrNull(m.partName))
      .input("category",       sql.NVarChar(100), strOrNull(m.category))
      .input("sheetSapCode",   sql.NVarChar(50),  strOrNull(m.sheetSapCode))
      .input("sheetDescription", sql.NVarChar(300), strOrNull(m.sheetDescription))
      .input("length",         sql.Decimal(12, 3), numOrNull(m.length))
      .input("width",          sql.Decimal(12, 3), numOrNull(m.width))
      .input("thickness",      sql.Decimal(12, 3), numOrNull(m.thickness))
      .input("weight",         sql.Decimal(12, 3), numOrNull(m.weight))
      .input("componentWeight",sql.Decimal(12, 3), numOrNull(m.componentWeight))
      .input("scrapWeight",    sql.Decimal(12, 3), numOrNull(m.scrapWeight))
      .input("noOfSheet",      sql.Decimal(12, 3), numOrNull(m.noOfSheet))
      .input("actualComponentsPerSheet", sql.Decimal(12, 3), numOrNull(m.actualComponentsPerSheet))
      .input("pncLoadingUnloading",      sql.Decimal(12, 3), numOrNull(m.pncLoadingUnloading))
      .input("definedComponentCycleTime",sql.Decimal(12, 3), numOrNull(m.definedComponentCycleTime))
      .input("drawingNumber",  sql.NVarChar(100), strOrNull(m.drawingNumber))
      .input("drawingRevision",sql.NVarChar(50),  strOrNull(m.drawingRevision))
      .input("status",         sql.Bit, toBit(m.status ?? true))
      .query(`
        UPDATE MaterialConfigs SET
          SapCode = @sapCode, PartName = @partName, Category = @category,
          SheetSapCode = @sheetSapCode, SheetDescription = @sheetDescription,
          Length = @length, Width = @width, Thickness = @thickness, Weight = @weight,
          ComponentWeight = @componentWeight, ScrapWeight = @scrapWeight,
          NoOfSheet = @noOfSheet, ActualComponentsPerSheet = @actualComponentsPerSheet,
          PncLoadingUnloading = @pncLoadingUnloading, DefinedComponentCycleTime = @definedComponentCycleTime,
          DrawingNumber = @drawingNumber, DrawingRevision = @drawingRevision, Status = @status,
          UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.SapCode AS sapCode, INSERTED.PartName AS partName, INSERTED.Category AS category,
          INSERTED.SheetSapCode AS sheetSapCode, INSERTED.SheetDescription AS sheetDescription,
          INSERTED.Length AS length, INSERTED.Width AS width, INSERTED.Thickness AS thickness, INSERTED.Weight AS weight,
          INSERTED.ComponentWeight AS componentWeight, INSERTED.ScrapWeight AS scrapWeight,
          INSERTED.NoOfSheet AS noOfSheet, INSERTED.ActualComponentsPerSheet AS actualComponentsPerSheet,
          INSERTED.PncLoadingUnloading AS pncLoadingUnloading, INSERTED.DefinedComponentCycleTime AS definedComponentCycleTime,
          INSERTED.DrawingNumber AS drawingNumber, INSERTED.DrawingRevision AS drawingRevision, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Material not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `SAP Code "${req.body.sapCode}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM MaterialConfigs WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const uploadMaterialDrawing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: "PDF file is required" });

    // Delete the old file if one exists
    const existing = await global.pool3.request()
      .input("id", sql.Int, id)
      .query(`SELECT DrawingPath FROM MaterialConfigs WHERE Id = @id`);
    if (existing.recordset.length) {
      const oldPath = existing.recordset[0].DrawingPath;
      if (oldPath) {
        const fullOld = path.join(UPLOADS_DIR, oldPath.replace(/^\/uploads\//, ""));
        if (fs.existsSync(fullOld)) fs.unlinkSync(fullOld);
      }
    }

    const drawingPath = `/uploads/MaterialDrawings/${req.file.filename}`;
    const result = await global.pool3.request()
      .input("id", sql.Int, id)
      .input("drawingPath", sql.NVarChar(500), drawingPath)
      .query(`
        UPDATE MaterialConfigs SET DrawingPath = @drawingPath, UpdatedAt = GETDATE()
        OUTPUT INSERTED.Id AS id, INSERTED.SapCode AS sapCode, INSERTED.PartName AS partName,
          INSERTED.DrawingNumber AS drawingNumber, INSERTED.DrawingRevision AS drawingRevision,
          INSERTED.DrawingPath AS drawingPath
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Material not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMaterialDrawing = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await global.pool3.request()
      .input("id", sql.Int, id)
      .query(`SELECT DrawingPath FROM MaterialConfigs WHERE Id = @id`);

    if (!existing.recordset.length) return res.status(404).json({ success: false, message: "Material not found" });

    const oldPath = existing.recordset[0].DrawingPath;
    if (oldPath) {
      const fullPath = path.join(UPLOADS_DIR, oldPath.replace(/^\/uploads\//, ""));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await global.pool3.request()
      .input("id", sql.Int, id)
      .query(`UPDATE MaterialConfigs SET DrawingPath = NULL, UpdatedAt = GETDATE() WHERE Id = @id`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upsert (XLSX import) — match existing rows by SapCode, insert new ones.
export const bulkUpsertMaterials = async (req, res) => {
  try {
    const materials = Array.isArray(req.body?.materials) ? req.body.materials : [];
    let inserted = 0, updated = 0;

    for (const m of materials) {
      if (!m.sapCode) continue;

      const request = global.pool3.request()
        .input("sapCode",        sql.NVarChar(50),  m.sapCode)
        .input("partName",       sql.NVarChar(300), strOrNull(m.partName))
        .input("category",       sql.NVarChar(100), strOrNull(m.category))
        .input("sheetSapCode",   sql.NVarChar(50),  strOrNull(m.sheetSapCode))
        .input("sheetDescription", sql.NVarChar(300), strOrNull(m.sheetDescription))
        .input("length",         sql.Decimal(12, 3), numOrNull(m.length))
        .input("width",          sql.Decimal(12, 3), numOrNull(m.width))
        .input("thickness",      sql.Decimal(12, 3), numOrNull(m.thickness))
        .input("weight",         sql.Decimal(12, 3), numOrNull(m.weight))
        .input("componentWeight",sql.Decimal(12, 3), numOrNull(m.componentWeight))
        .input("scrapWeight",    sql.Decimal(12, 3), numOrNull(m.scrapWeight))
        .input("noOfSheet",      sql.Decimal(12, 3), numOrNull(m.noOfSheet))
        .input("actualComponentsPerSheet", sql.Decimal(12, 3), numOrNull(m.actualComponentsPerSheet))
        .input("pncLoadingUnloading",      sql.Decimal(12, 3), numOrNull(m.pncLoadingUnloading))
        .input("definedComponentCycleTime",sql.Decimal(12, 3), numOrNull(m.definedComponentCycleTime))
        .input("drawingNumber",  sql.NVarChar(100), strOrNull(m.drawingNumber))
        .input("drawingRevision",sql.NVarChar(50),  strOrNull(m.drawingRevision))
        .input("status",         sql.Bit, toBit(m.status ?? true));

      const result = await request.query(`
        MERGE MaterialConfigs AS target
        USING (SELECT @sapCode AS SapCode) AS src
        ON target.SapCode = src.SapCode
        WHEN MATCHED THEN UPDATE SET
          PartName = @partName, Category = @category,
          SheetSapCode = @sheetSapCode, SheetDescription = @sheetDescription,
          Length = @length, Width = @width, Thickness = @thickness, Weight = @weight,
          ComponentWeight = @componentWeight, ScrapWeight = @scrapWeight,
          NoOfSheet = @noOfSheet, ActualComponentsPerSheet = @actualComponentsPerSheet,
          PncLoadingUnloading = @pncLoadingUnloading, DefinedComponentCycleTime = @definedComponentCycleTime,
          DrawingNumber = @drawingNumber, DrawingRevision = @drawingRevision, Status = @status,
          UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN INSERT (
          SapCode, PartName, Category, SheetSapCode, SheetDescription, Length, Width, Thickness, Weight,
          ComponentWeight, ScrapWeight, NoOfSheet, ActualComponentsPerSheet,
          PncLoadingUnloading, DefinedComponentCycleTime, DrawingNumber, DrawingRevision, Status
        ) VALUES (
          @sapCode, @partName, @category, @sheetSapCode, @sheetDescription, @length, @width, @thickness, @weight,
          @componentWeight, @scrapWeight, @noOfSheet, @actualComponentsPerSheet,
          @pncLoadingUnloading, @definedComponentCycleTime, @drawingNumber, @drawingRevision, @status
        )
        OUTPUT $action AS action;
      `);

      const action = result.recordset?.[0]?.action;
      if (action === "INSERT") inserted++;
      else if (action === "UPDATE") updated++;
    }

    const all = await global.pool3.request().query(`${MATERIAL_SELECT} ORDER BY Id`);
    res.json({ success: true, inserted, updated, data: all.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Shifts ───────────────────────────────────────────────────────────────────
const SHIFT_SELECT = `
  SELECT
    Id AS id, ShiftName AS shiftName, ShiftCode AS shiftCode, StartTime AS startTime, EndTime AS endTime,
    BreakStart AS breakStart, BreakEnd AS breakEnd, TeaBreaks AS teaBreaks, Color AS color,
    OvertimeShift AS overtimeShift, WeeklyOff AS weeklyOff, Status AS status
  FROM ShiftConfigs`;

const mapShift = (row) => ({
  ...row,
  weeklyOff: row.weeklyOff ? row.weeklyOff.split(",").map((d) => d.trim()).filter(Boolean) : [],
});

export const getShifts = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${SHIFT_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset.map(mapShift) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createShift = async (req, res) => {
  try {
    const s = req.body;
    const result = await global.pool3.request()
      .input("shiftName",     sql.NVarChar(100), s.shiftName)
      .input("shiftCode",     sql.NVarChar(20),  strOrNull(s.shiftCode))
      .input("startTime",     sql.NVarChar(10),  strOrNull(s.startTime))
      .input("endTime",       sql.NVarChar(10),  strOrNull(s.endTime))
      .input("breakStart",    sql.NVarChar(10),  strOrNull(s.breakStart))
      .input("breakEnd",      sql.NVarChar(10),  strOrNull(s.breakEnd))
      .input("teaBreaks",     sql.NVarChar(10),  strOrNull(s.teaBreaks))
      .input("color",         sql.NVarChar(20),  strOrNull(s.color))
      .input("overtimeShift", sql.Bit, toBit(s.overtimeShift))
      .input("weeklyOff",     sql.NVarChar(200), Array.isArray(s.weeklyOff) ? s.weeklyOff.join(",") : strOrNull(s.weeklyOff))
      .input("status",        sql.Bit, toBit(s.status ?? true))
      .query(`
        INSERT INTO ShiftConfigs (ShiftName, ShiftCode, StartTime, EndTime, BreakStart, BreakEnd, TeaBreaks, Color, OvertimeShift, WeeklyOff, Status)
        OUTPUT
          INSERTED.Id AS id, INSERTED.ShiftName AS shiftName, INSERTED.ShiftCode AS shiftCode, INSERTED.StartTime AS startTime, INSERTED.EndTime AS endTime,
          INSERTED.BreakStart AS breakStart, INSERTED.BreakEnd AS breakEnd, INSERTED.TeaBreaks AS teaBreaks, INSERTED.Color AS color,
          INSERTED.OvertimeShift AS overtimeShift, INSERTED.WeeklyOff AS weeklyOff, INSERTED.Status AS status
        VALUES (@shiftName, @shiftCode, @startTime, @endTime, @breakStart, @breakEnd, @teaBreaks, @color, @overtimeShift, @weeklyOff, @status)
      `);

    res.json({ success: true, data: mapShift(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const s = req.body;
    const result = await global.pool3.request()
      .input("id",            sql.Int, id)
      .input("shiftName",     sql.NVarChar(100), s.shiftName)
      .input("shiftCode",     sql.NVarChar(20),  strOrNull(s.shiftCode))
      .input("startTime",     sql.NVarChar(10),  strOrNull(s.startTime))
      .input("endTime",       sql.NVarChar(10),  strOrNull(s.endTime))
      .input("breakStart",    sql.NVarChar(10),  strOrNull(s.breakStart))
      .input("breakEnd",      sql.NVarChar(10),  strOrNull(s.breakEnd))
      .input("teaBreaks",     sql.NVarChar(10),  strOrNull(s.teaBreaks))
      .input("color",         sql.NVarChar(20),  strOrNull(s.color))
      .input("overtimeShift", sql.Bit, toBit(s.overtimeShift))
      .input("weeklyOff",     sql.NVarChar(200), Array.isArray(s.weeklyOff) ? s.weeklyOff.join(",") : strOrNull(s.weeklyOff))
      .input("status",        sql.Bit, toBit(s.status ?? true))
      .query(`
        UPDATE ShiftConfigs SET
          ShiftName = @shiftName, ShiftCode = @shiftCode, StartTime = @startTime, EndTime = @endTime,
          BreakStart = @breakStart, BreakEnd = @breakEnd, TeaBreaks = @teaBreaks, Color = @color,
          OvertimeShift = @overtimeShift, WeeklyOff = @weeklyOff, Status = @status, UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.ShiftName AS shiftName, INSERTED.ShiftCode AS shiftCode, INSERTED.StartTime AS startTime, INSERTED.EndTime AS endTime,
          INSERTED.BreakStart AS breakStart, INSERTED.BreakEnd AS breakEnd, INSERTED.TeaBreaks AS teaBreaks, INSERTED.Color AS color,
          INSERTED.OvertimeShift AS overtimeShift, INSERTED.WeeklyOff AS weeklyOff, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Shift not found" });
    res.json({ success: true, data: mapShift(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM ShiftConfigs WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

// ── Mail Subscribers ─────────────────────────────────────────────────────────
const MAIL_SUBSCRIBER_SELECT = `
  SELECT
    Id AS id, EmpName AS empName, EmpId AS empId, Department AS department, Designation AS designation,
    Email AS email, Mobile AS mobile, Subscriptions AS subscriptions, Frequency AS frequency,
    Whatsapp AS whatsapp, Sms AS sms, Status AS status
  FROM MailSubscribers`;

const mapMailSubscriber = (row) => ({
  ...row,
  subscriptions: row.subscriptions ? row.subscriptions.split("|").map((s) => s.trim()).filter(Boolean) : [],
});

export const getMailSubscribers = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${MAIL_SUBSCRIBER_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset.map(mapMailSubscriber) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMailSubscriber = async (req, res) => {
  try {
    const m = req.body;
    if (!m.empName || !m.email) return res.status(400).json({ success: false, message: "empName and email are required" });

    const result = await global.pool3.request()
      .input("empName",       sql.NVarChar(200), m.empName)
      .input("empId",         sql.NVarChar(50),  strOrNull(m.empId))
      .input("department",    sql.NVarChar(200), strOrNull(m.department))
      .input("designation",   sql.NVarChar(200), strOrNull(m.designation))
      .input("email",         sql.NVarChar(200), m.email)
      .input("mobile",        sql.NVarChar(20),  strOrNull(m.mobile))
      .input("subscriptions", sql.NVarChar(sql.MAX), Array.isArray(m.subscriptions) ? m.subscriptions.join("|") : strOrNull(m.subscriptions))
      .input("frequency",     sql.NVarChar(50),  strOrNull(m.frequency) || "Shift-wise")
      .input("whatsapp",      sql.Bit, toBit(m.whatsapp))
      .input("sms",           sql.Bit, toBit(m.sms))
      .input("status",        sql.Bit, toBit(m.status ?? true))
      .query(`
        INSERT INTO MailSubscribers (EmpName, EmpId, Department, Designation, Email, Mobile, Subscriptions, Frequency, Whatsapp, Sms, Status)
        OUTPUT
          INSERTED.Id AS id, INSERTED.EmpName AS empName, INSERTED.EmpId AS empId, INSERTED.Department AS department, INSERTED.Designation AS designation,
          INSERTED.Email AS email, INSERTED.Mobile AS mobile, INSERTED.Subscriptions AS subscriptions, INSERTED.Frequency AS frequency,
          INSERTED.Whatsapp AS whatsapp, INSERTED.Sms AS sms, INSERTED.Status AS status
        VALUES (@empName, @empId, @department, @designation, @email, @mobile, @subscriptions, @frequency, @whatsapp, @sms, @status)
      `);

    res.json({ success: true, data: mapMailSubscriber(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMailSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const m = req.body;
    const result = await global.pool3.request()
      .input("id",            sql.Int, id)
      .input("empName",       sql.NVarChar(200), m.empName)
      .input("empId",         sql.NVarChar(50),  strOrNull(m.empId))
      .input("department",    sql.NVarChar(200), strOrNull(m.department))
      .input("designation",   sql.NVarChar(200), strOrNull(m.designation))
      .input("email",         sql.NVarChar(200), m.email)
      .input("mobile",        sql.NVarChar(20),  strOrNull(m.mobile))
      .input("subscriptions", sql.NVarChar(sql.MAX), Array.isArray(m.subscriptions) ? m.subscriptions.join("|") : strOrNull(m.subscriptions))
      .input("frequency",     sql.NVarChar(50),  strOrNull(m.frequency) || "Shift-wise")
      .input("whatsapp",      sql.Bit, toBit(m.whatsapp))
      .input("sms",           sql.Bit, toBit(m.sms))
      .input("status",        sql.Bit, toBit(m.status ?? true))
      .query(`
        UPDATE MailSubscribers SET
          EmpName = @empName, EmpId = @empId, Department = @department, Designation = @designation,
          Email = @email, Mobile = @mobile, Subscriptions = @subscriptions, Frequency = @frequency,
          Whatsapp = @whatsapp, Sms = @sms, Status = @status, UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.EmpName AS empName, INSERTED.EmpId AS empId, INSERTED.Department AS department, INSERTED.Designation AS designation,
          INSERTED.Email AS email, INSERTED.Mobile AS mobile, INSERTED.Subscriptions AS subscriptions, INSERTED.Frequency AS frequency,
          INSERTED.Whatsapp AS whatsapp, INSERTED.Sms AS sms, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Subscriber not found" });
    res.json({ success: true, data: mapMailSubscriber(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMailSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM MailSubscribers WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const toMinsOfDay = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const dateOnly = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Given a test start/end window picked in the UI, resolve which configured
// shift's window the start time falls into and which production day it
// belongs to — same overnight-shift rule the cron and report pages use
// (PartProcessEvents.EventDate is the day the shift STARTED on).
const resolveTestShift = async (pool, startDate, endDate) => {
  const start = new Date(String(startDate).replace(" ", "T"));
  if (Number.isNaN(start.getTime())) throw Object.assign(new Error("Invalid start date/time"), { status: 400 });
  if (endDate) {
    const end = new Date(String(endDate).replace(" ", "T"));
    if (!Number.isNaN(end.getTime()) && end <= start) {
      throw Object.assign(new Error("End date/time must be after start date/time"), { status: 400 });
    }
  }

  const shiftsRes = await pool.request().query(`SELECT ShiftName, StartTime, EndTime FROM ShiftConfigs WHERE Status = 1`);
  const curMins = start.getHours() * 60 + start.getMinutes();
  const matched = shiftsRes.recordset.find((s) => {
    const s0 = toMinsOfDay(s.StartTime);
    let e0 = toMinsOfDay(s.EndTime);
    if (s0 === null || e0 === null) return false;
    if (e0 <= s0) e0 += 1440; // overnight shift
    const tc = curMins < s0 ? curMins + 1440 : curMins;
    return tc >= s0 && tc < e0;
  });
  if (!matched) throw Object.assign(new Error("No configured shift covers that start time."), { status: 400 });

  const s0 = toMinsOfDay(matched.StartTime);
  const e0 = toMinsOfDay(matched.EndTime);
  const isOvernight = e0 <= s0;
  let dateStr;
  if (isOvernight && curMins < s0) {
    const prev = new Date(start); prev.setDate(prev.getDate() - 1);
    dateStr = dateOnly(prev);
  } else {
    dateStr = dateOnly(start);
  }
  return { shiftName: matched.ShiftName, dateStr };
};

// Sends the real shift production report (same content/format the shift-end
// cron sends), so "Send Test Mail" verifies the full pipeline — not just SMTP
// connectivity. By default uses the most recent shift that has data; pass
// startDate/endDate (from the Test modal) to target a specific shift/date
// instead, e.g. to verify a shift that has quality/downtime logs attached.
// Falls back to a plain confirmation email when there's no production data.
export const testMailSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body || {};
    const result = await global.pool3.request()
      .input("id", sql.Int, id)
      .query(`${MAIL_SUBSCRIBER_SELECT} WHERE Id = @id`);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Subscriber not found" });
    const subscriber = mapMailSubscriber(result.recordset[0]);

    console.log(`[TestMail] subscriber=${subscriber.email} startDate=${startDate || "(none)"} endDate=${endDate || "(none)"}`);

    let shiftName, dateStr;
    if (startDate) {
      ({ shiftName, dateStr } = await resolveTestShift(global.pool3, startDate, endDate));
      console.log(`[TestMail] resolved shift="${shiftName}" date=${dateStr}`);
    } else {
      const latest = await global.pool3.request().query(`
        SELECT TOP 1 EventDate, ShiftName
        FROM PartProcessEvents
        WHERE ShiftName IS NOT NULL
        ORDER BY EventDate DESC, StartTime DESC
      `);
      if (!latest.recordset.length) {
        await sendTestMail({ to: subscriber.email, empName: subscriber.empName, subscriptions: subscriber.subscriptions });
        return res.json({ success: true, message: `No production data found yet — sent a basic test email to ${subscriber.email}` });
      }
      shiftName = latest.recordset[0].ShiftName;
      dateStr = new Date(latest.recordset[0].EventDate).toISOString().slice(0, 10);
    }

    const report = await buildShiftReport(global.pool3, { shiftName }, dateStr);
    console.log(`[TestMail] buildShiftReport(${shiftName}, ${dateStr}) -> ${report ? `${report.rows.length} row(s)` : "null (no data)"}`);
    if (!report) {
      await sendTestMail({ to: subscriber.email, empName: subscriber.empName, subscriptions: subscriber.subscriptions });
      return res.json({ success: true, message: `No production data for ${shiftName} on ${dateStr} — sent a basic test email to ${subscriber.email}` });
    }

    const reportNames = subscriber.subscriptions.filter((r) => REPORT_NAMES.includes(r));
    const attachmentsByReport = reportNames.length
      ? await buildReportAttachments(global.pool3, { shiftName }, dateStr, reportNames)
      : {};
    const attachments = reportNames.map((r) => attachmentsByReport[r]).filter(Boolean);

    await sendShiftEndReportMail({ to: subscriber.email, ...report, attachments, attachedReportNames: reportNames });

    const builtNames = reportNames.filter((r) => attachmentsByReport[r]);
    const missingNames = reportNames.filter((r) => !attachmentsByReport[r]);
    const attachNote = reportNames.length === 0
      ? " — no reports ticked for this subscriber, so no PDF was attached (edit the subscriber and pick report(s) under Report Subscriptions)"
      : builtNames.length === 0
        ? ` — ${reportNames.join(", ")} selected but no PDF could be built (likely no data for that shift)`
        : missingNames.length
          ? ` with ${builtNames.length} PDF attachment(s): ${builtNames.join(", ")} (skipped ${missingNames.join(", ")} — no data)`
          : ` with ${builtNames.length} PDF attachment(s): ${builtNames.join(", ")}`;
    res.json({ success: true, message: `Sent ${shiftName} (${dateStr}) report to ${subscriber.email}${attachNote}` });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

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

// ── Production Plans ─────────────────────────────────────────────────────────
const PLAN_SELECT = `
  SELECT
    Id AS id, MachineName AS machineName, SapCode AS sapCode, PartName AS partName, ModelCode AS modelCode,
    TargetQty AS targetQty, Shift AS shift, CONVERT(varchar(10), PlanDate, 23) AS planDate,
    Priority AS priority, Customer AS customer, PlannedCycleTime AS plannedCycleTime, Status AS status
  FROM ProductionPlans`;

export const getPlans = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${PLAN_SELECT} ORDER BY PlanDate DESC, Id DESC`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createPlan = async (req, res) => {
  try {
    const p = req.body;
    if (!p.machineName || !p.sapCode || !p.targetQty || !p.planDate) {
      return res.status(400).json({ success: false, message: "machineName, sapCode, targetQty and planDate are required" });
    }

    const result = await global.pool3.request()
      .input("machineName",      sql.NVarChar(200), p.machineName)
      .input("sapCode",          sql.NVarChar(50),  p.sapCode)
      .input("partName",         sql.NVarChar(300), strOrNull(p.partName))
      .input("modelCode",        sql.NVarChar(100), strOrNull(p.modelCode))
      .input("targetQty",        sql.Decimal(14, 2), numOrNull(p.targetQty) ?? 0)
      .input("shift",            sql.NVarChar(50),  p.shift || "All Shifts")
      .input("planDate",         sql.Date, p.planDate)
      .input("priority",         sql.NVarChar(20),  p.priority || "Medium")
      .input("customer",         sql.NVarChar(200), strOrNull(p.customer))
      .input("plannedCycleTime", sql.Decimal(12, 3), numOrNull(p.plannedCycleTime))
      .input("status",           sql.Bit, toBit(p.status ?? true))
      .query(`
        INSERT INTO ProductionPlans (
          MachineName, SapCode, PartName, ModelCode, TargetQty, Shift, PlanDate, Priority, Customer, PlannedCycleTime, Status
        )
        OUTPUT
          INSERTED.Id AS id, INSERTED.MachineName AS machineName, INSERTED.SapCode AS sapCode, INSERTED.PartName AS partName,
          INSERTED.ModelCode AS modelCode, INSERTED.TargetQty AS targetQty, INSERTED.Shift AS shift,
          CONVERT(varchar(10), INSERTED.PlanDate, 23) AS planDate, INSERTED.Priority AS priority,
          INSERTED.Customer AS customer, INSERTED.PlannedCycleTime AS plannedCycleTime, INSERTED.Status AS status
        VALUES (
          @machineName, @sapCode, @partName, @modelCode, @targetQty, @shift, @planDate, @priority, @customer, @plannedCycleTime, @status
        )
      `);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `A plan for SAP Code "${req.body.sapCode}" on this machine/date/shift already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const p = req.body;

    const result = await global.pool3.request()
      .input("id",                sql.Int, id)
      .input("machineName",      sql.NVarChar(200), p.machineName)
      .input("sapCode",          sql.NVarChar(50),  p.sapCode)
      .input("partName",         sql.NVarChar(300), strOrNull(p.partName))
      .input("modelCode",        sql.NVarChar(100), strOrNull(p.modelCode))
      .input("targetQty",        sql.Decimal(14, 2), numOrNull(p.targetQty) ?? 0)
      .input("shift",            sql.NVarChar(50),  p.shift || "All Shifts")
      .input("planDate",         sql.Date, p.planDate)
      .input("priority",         sql.NVarChar(20),  p.priority || "Medium")
      .input("customer",         sql.NVarChar(200), strOrNull(p.customer))
      .input("plannedCycleTime", sql.Decimal(12, 3), numOrNull(p.plannedCycleTime))
      .input("status",           sql.Bit, toBit(p.status ?? true))
      .query(`
        UPDATE ProductionPlans SET
          MachineName = @machineName, SapCode = @sapCode, PartName = @partName, ModelCode = @modelCode,
          TargetQty = @targetQty, Shift = @shift, PlanDate = @planDate, Priority = @priority,
          Customer = @customer, PlannedCycleTime = @plannedCycleTime, Status = @status,
          UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.MachineName AS machineName, INSERTED.SapCode AS sapCode, INSERTED.PartName AS partName,
          INSERTED.ModelCode AS modelCode, INSERTED.TargetQty AS targetQty, INSERTED.Shift AS shift,
          CONVERT(varchar(10), INSERTED.PlanDate, 23) AS planDate, INSERTED.Priority AS priority,
          INSERTED.Customer AS customer, INSERTED.PlannedCycleTime AS plannedCycleTime, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `A plan for SAP Code "${req.body.sapCode}" on this machine/date/shift already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM ProductionPlans WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upsert (Excel import) — match existing rows by SapCode + MachineName + PlanDate + Shift.
export const bulkUpsertPlans = async (req, res) => {
  try {
    const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    let inserted = 0, updated = 0, skipped = 0;

    for (const p of plans) {
      if (!p.machineName || !p.sapCode || !p.planDate) { skipped++; continue; }

      const request = global.pool3.request()
        .input("machineName",      sql.NVarChar(200), p.machineName)
        .input("sapCode",          sql.NVarChar(50),  p.sapCode)
        .input("partName",         sql.NVarChar(300), strOrNull(p.partName))
        .input("modelCode",        sql.NVarChar(100), strOrNull(p.modelCode))
        .input("targetQty",        sql.Decimal(14, 2), numOrNull(p.targetQty) ?? 0)
        .input("shift",            sql.NVarChar(50),  p.shift || "All Shifts")
        .input("planDate",         sql.Date, p.planDate)
        .input("priority",         sql.NVarChar(20),  p.priority || "Medium")
        .input("customer",         sql.NVarChar(200), strOrNull(p.customer))
        .input("plannedCycleTime", sql.Decimal(12, 3), numOrNull(p.plannedCycleTime))
        .input("status",           sql.Bit, toBit(p.status ?? true));

      const result = await request.query(`
        MERGE ProductionPlans AS target
        USING (SELECT @sapCode AS SapCode, @machineName AS MachineName, @planDate AS PlanDate, @shift AS Shift) AS src
        ON target.SapCode = src.SapCode AND target.MachineName = src.MachineName
           AND target.PlanDate = src.PlanDate AND target.Shift = src.Shift
        WHEN MATCHED THEN UPDATE SET
          PartName = @partName, ModelCode = @modelCode, TargetQty = @targetQty,
          Priority = @priority, Customer = @customer, PlannedCycleTime = @plannedCycleTime, Status = @status,
          UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN INSERT (
          MachineName, SapCode, PartName, ModelCode, TargetQty, Shift, PlanDate, Priority, Customer, PlannedCycleTime, Status
        ) VALUES (
          @machineName, @sapCode, @partName, @modelCode, @targetQty, @shift, @planDate, @priority, @customer, @plannedCycleTime, @status
        )
        OUTPUT $action AS action;
      `);

      const action = result.recordset?.[0]?.action;
      if (action === "INSERT") inserted++;
      else if (action === "UPDATE") updated++;
    }

    const all = await global.pool3.request().query(`${PLAN_SELECT} ORDER BY PlanDate DESC, Id DESC`);
    res.json({ success: true, inserted, updated, skipped, data: all.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
