/** Production Plans — CRUD + bulk upsert (pool3 / ProductionPlans). */
import sql from "mssql";
import { numOrNull, strOrNull, toBit } from "./helpers.js";

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
