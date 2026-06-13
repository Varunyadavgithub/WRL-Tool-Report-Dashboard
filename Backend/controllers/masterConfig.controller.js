/**
 * Master Config Controller
 * CRUD for Material Config, Shift Config, Downtime Reasons, Departments
 * and Quality Defects (pool3 / DB3).
 */
import sql from "mssql";

const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const strOrNull = (v) => (v === "" || v === null || v === undefined ? null : String(v));
const toBit = (v) => (v ? 1 : 0);

const MATERIAL_SELECT = `
  SELECT
    Id AS id, SapCode AS sapCode, PartName AS partName, Category AS category,
    Length AS length, Width AS width, Thickness AS thickness, Weight AS weight,
    ComponentWeight AS componentWeight, ScrapWeight AS scrapWeight,
    NoOfSheet AS noOfSheet, ActualComponentsPerSheet AS actualComponentsPerSheet,
    PncLoadingUnloading AS pncLoadingUnloading, DefinedComponentCycleTime AS definedComponentCycleTime,
    DrawingNumber AS drawingNumber, DrawingRevision AS drawingRevision, Status AS status
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
          SapCode, PartName, Category, Length, Width, Thickness, Weight,
          ComponentWeight, ScrapWeight, NoOfSheet, ActualComponentsPerSheet,
          PncLoadingUnloading, DefinedComponentCycleTime, DrawingNumber, DrawingRevision, Status
        )
        OUTPUT
          INSERTED.Id AS id, INSERTED.SapCode AS sapCode, INSERTED.PartName AS partName, INSERTED.Category AS category,
          INSERTED.Length AS length, INSERTED.Width AS width, INSERTED.Thickness AS thickness, INSERTED.Weight AS weight,
          INSERTED.ComponentWeight AS componentWeight, INSERTED.ScrapWeight AS scrapWeight,
          INSERTED.NoOfSheet AS noOfSheet, INSERTED.ActualComponentsPerSheet AS actualComponentsPerSheet,
          INSERTED.PncLoadingUnloading AS pncLoadingUnloading, INSERTED.DefinedComponentCycleTime AS definedComponentCycleTime,
          INSERTED.DrawingNumber AS drawingNumber, INSERTED.DrawingRevision AS drawingRevision, INSERTED.Status AS status
        VALUES (
          @sapCode, @partName, @category, @length, @width, @thickness, @weight,
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
          Length = @length, Width = @width, Thickness = @thickness, Weight = @weight,
          ComponentWeight = @componentWeight, ScrapWeight = @scrapWeight,
          NoOfSheet = @noOfSheet, ActualComponentsPerSheet = @actualComponentsPerSheet,
          PncLoadingUnloading = @pncLoadingUnloading, DefinedComponentCycleTime = @definedComponentCycleTime,
          DrawingNumber = @drawingNumber, DrawingRevision = @drawingRevision, Status = @status,
          UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.SapCode AS sapCode, INSERTED.PartName AS partName, INSERTED.Category AS category,
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
          Length = @length, Width = @width, Thickness = @thickness, Weight = @weight,
          ComponentWeight = @componentWeight, ScrapWeight = @scrapWeight,
          NoOfSheet = @noOfSheet, ActualComponentsPerSheet = @actualComponentsPerSheet,
          PncLoadingUnloading = @pncLoadingUnloading, DefinedComponentCycleTime = @definedComponentCycleTime,
          DrawingNumber = @drawingNumber, DrawingRevision = @drawingRevision, Status = @status,
          UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN INSERT (
          SapCode, PartName, Category, Length, Width, Thickness, Weight,
          ComponentWeight, ScrapWeight, NoOfSheet, ActualComponentsPerSheet,
          PncLoadingUnloading, DefinedComponentCycleTime, DrawingNumber, DrawingRevision, Status
        ) VALUES (
          @sapCode, @partName, @category, @length, @width, @thickness, @weight,
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
