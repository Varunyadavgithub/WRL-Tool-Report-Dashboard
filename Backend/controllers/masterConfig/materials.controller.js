/** Materials — CRUD + drawing upload + bulk XLSX upsert (pool3 / MaterialConfigs). */
import fs from "fs";
import path from "path";
import sql from "mssql";
import { UPLOADS_DIR } from "../../utils/storage/config.js";
import { numOrNull, strOrNull, toBit } from "./helpers.js";
import { extractProgramName, getMaterialByModel, parseDurSecs } from "../../utils/productionLogic.js";

const MATERIAL_SELECT = `
  SELECT
    Id AS id, SapCode AS sapCode, PartName AS partName, Category AS category,
    SheetSapCode AS sheetSapCode, SheetDescription AS sheetDescription,
    Length AS length, Width AS width, Thickness AS thickness, Weight AS weight,
    ComponentWeight AS componentWeight, ScrapWeight AS scrapWeight,
    NoOfSheet AS noOfSheet, ActualComponentsPerSheet AS actualComponentsPerSheet,
    PncLoadingUnloading AS pncLoadingUnloading, DefinedComponentCycleTime AS definedComponentCycleTime,
    ActualComponentCycleTime AS actualComponentCycleTime, ActualCTUpdatedAt AS actualCTUpdatedAt,
    ActualCTSampleCount AS actualCTSampleCount,
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

/**
 * Recalculate ActualComponentCycleTime for every SAP code from real
 * PartProcessEvents production history — a one-time/on-demand backfill
 * triggered from the Material Config page, not an automatic sync.
 *
 * Same formula as the shift-end report's componentCycleTime (see
 * aggregateRecords in productionLogic.js): for punching parts,
 * (avg machine cycle secs + load/unload allowance) spread across every
 * component produced per machine cycle; for non-punching parts, just the
 * average machine cycle time itself (mirrors that function's sheetCycleTime
 * fallback) so every SAP code with matching samples gets a value, not just
 * punching parts.
 *
 * Matching a PartProcessEvents row to a SAP code has no direct FK — it goes
 * through the same barcode-parsing heuristic (extractProgramName +
 * getMaterialByModel) already used for shift OEE, so results here stay
 * consistent with what the Production Report / shift emails show.
 */
export const recalculateActualCycleTime = async (req, res) => {
  try {
    const materialsResult = await global.pool3.request().query(`
      SELECT SapCode AS sapCode, PncLoadingUnloading AS pncLoadingUnloading,
             ActualComponentsPerSheet AS actualComponentsPerSheet, NoOfSheet AS noOfSheet
      FROM MaterialConfigs
    `);
    const materials = materialsResult.recordset;

    const eventsResult = await global.pool3.request().query(`
      SELECT Barcode, Duration, PartsQty
      FROM PartProcessEvents
      WHERE Status = 1 AND EventType = 'Production'
        AND PartsQty > 0 AND Duration IS NOT NULL AND Duration <> '00:00:00'
    `);
    const events = eventsResult.recordset;

    const cycleSecsBySapCode = {};
    let unmatchedEvents = 0;

    for (const ev of events) {
      const programName = extractProgramName(ev.Barcode);
      const mat = getMaterialByModel(materials, programName);
      if (!mat) { unmatchedEvents++; continue; }

      const secs = parseDurSecs(ev.Duration);
      if (secs <= 0) continue;

      (cycleSecsBySapCode[mat.sapCode] ??= []).push(secs);
    }

    let updated = 0;
    for (const mat of materials) {
      const samples = cycleSecsBySapCode[mat.sapCode];
      if (!samples?.length) continue;

      const avgCycleSecs = samples.reduce((a, b) => a + b, 0) / samples.length;
      const compPerSheet = Number(mat.actualComponentsPerSheet) || 0;
      const noOfSheet    = Number(mat.noOfSheet) || 0;
      const loadUnload   = Number(mat.pncLoadingUnloading) || 0;
      const isPunching   = compPerSheet > 0 && noOfSheet > 0;

      const actualCT = isPunching
        ? ((avgCycleSecs + loadUnload) / (compPerSheet * noOfSheet))
        : avgCycleSecs;

      await global.pool3.request()
        .input("sapCode",       sql.NVarChar(50),  mat.sapCode)
        .input("actualCT",      sql.Decimal(12, 3), Math.round(actualCT * 100) / 100)
        .input("sampleCount",   sql.Int,            samples.length)
        .query(`
          UPDATE MaterialConfigs
          SET ActualComponentCycleTime = @actualCT,
              ActualCTSampleCount      = @sampleCount,
              ActualCTUpdatedAt        = GETDATE()
          WHERE SapCode = @sapCode
        `);
      updated++;
    }

    res.json({
      success: true,
      updated,
      totalMaterials: materials.length,
      totalEvents: events.length,
      unmatchedEvents,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
