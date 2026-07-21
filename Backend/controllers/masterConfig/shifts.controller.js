/** Shifts — CRUD (pool3 / ShiftConfigs). */
import sql from "mssql";
import { strOrNull, toBit } from "./helpers.js";

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
