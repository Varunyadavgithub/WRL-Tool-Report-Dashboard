/** Machine-Shift Allocations — which shift(s) a machine is assigned to, with
 *  full history (pool3 / MachineShiftAllocations, MachineShiftAllocationHistory). */
import sql from "mssql";

const ALLOCATION_SELECT = `
  SELECT
    a.Id AS id, a.MachineId AS machineId, a.ShiftId AS shiftId, a.Status AS status,
    m.MachineName AS machineName, s.ShiftName AS shiftName
  FROM MachineShiftAllocations a
  JOIN Machines m ON m.Id = a.MachineId
  JOIN ShiftConfigs s ON s.Id = a.ShiftId`;

export const getMachineShiftAllocations = async (req, res) => {
  try {
    const result = await global.pool3.request()
      .query(`${ALLOCATION_SELECT} WHERE a.Status = 1 ORDER BY a.MachineId, a.ShiftId`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Full append-only action log — small table, fetch-all (same pattern as
// getShiftHistory). Callers resolve "machine X's shifts as of date Y"
// locally via resolveMachineShiftsAsOf (Frontend/src/utils/productionLogic.js).
export const getMachineShiftAllocationHistory = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`
      SELECT Id AS id, MachineId AS machineId, ShiftId AS shiftId, Action AS action, ActionAt AS actionAt
      FROM MachineShiftAllocationHistory
      ORDER BY MachineId, ActionAt`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Body: { machineId, shiftIds: number[] } — the FULL desired set of shifts
// for this machine. Diffs against the current Status=1 rows and writes one
// history row per change, rather than requiring the frontend to call a
// separate assign/unassign endpoint per checkbox.
export const setMachineShiftAllocations = async (req, res) => {
  try {
    const { machineId, shiftIds } = req.body;
    if (!machineId || !Array.isArray(shiftIds)) {
      return res.status(400).json({ success: false, message: "machineId and shiftIds[] are required" });
    }
    const pool = global.pool3;

    const current = await pool.request()
      .input("machineId", sql.Int, machineId)
      .query(`SELECT ShiftId FROM MachineShiftAllocations WHERE MachineId = @machineId AND Status = 1`);
    const currentIds = current.recordset.map((r) => r.ShiftId);
    const desiredIds = shiftIds.map(Number);

    const toAdd = desiredIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !desiredIds.includes(id));

    for (const shiftId of toAdd) {
      await pool.request()
        .input("machineId", sql.Int, machineId)
        .input("shiftId", sql.Int, shiftId)
        .query(`
          MERGE MachineShiftAllocations AS target
          USING (VALUES (@machineId, @shiftId)) AS source (MachineId, ShiftId)
          ON target.MachineId = source.MachineId AND target.ShiftId = source.ShiftId
          WHEN MATCHED THEN UPDATE SET Status = 1, UpdatedAt = GETDATE()
          WHEN NOT MATCHED THEN INSERT (MachineId, ShiftId, Status) VALUES (source.MachineId, source.ShiftId, 1);
        `);
      await pool.request()
        .input("machineId", sql.Int, machineId)
        .input("shiftId", sql.Int, shiftId)
        .query(`INSERT INTO MachineShiftAllocationHistory (MachineId, ShiftId, Action) VALUES (@machineId, @shiftId, 'assigned')`);
    }

    for (const shiftId of toRemove) {
      await pool.request()
        .input("machineId", sql.Int, machineId)
        .input("shiftId", sql.Int, shiftId)
        .query(`UPDATE MachineShiftAllocations SET Status = 0, UpdatedAt = GETDATE() WHERE MachineId = @machineId AND ShiftId = @shiftId`);
      await pool.request()
        .input("machineId", sql.Int, machineId)
        .input("shiftId", sql.Int, shiftId)
        .query(`INSERT INTO MachineShiftAllocationHistory (MachineId, ShiftId, Action) VALUES (@machineId, @shiftId, 'unassigned')`);
    }

    const result = await pool.request()
      .input("machineId", sql.Int, machineId)
      .query(`${ALLOCATION_SELECT} WHERE a.MachineId = @machineId AND a.Status = 1 ORDER BY a.ShiftId`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
