/**
 * Energy Meters — Master Config
 * CRUD for PDP (Power Distribution Panel) and Meter (device config) masters.
 *
 * These live under the pre-existing `EnergyMon` schema in DB3, owned and
 * populated by an external Modbus-polling service (real hardware — see
 * EnergyMon.Meter for the live meter config it reads). This controller only
 * manages that config; LiveReading/ReadingHistory/ConsumptionSummary/AlertLog
 * are written by that external service, not here.
 */
import sql from "mssql";

const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const strOrNull = (v) => (v === "" || v === null || v === undefined ? null : String(v));
const toBit = (v) => (v ? 1 : 0);

// ── PDP ──────────────────────────────────────────────────────────────────────
const PDP_SELECT = `
  SELECT pdp_id AS id, pdp_number AS pdpNumber, pdp_name AS pdpName, location AS location, is_active AS isActive
  FROM EnergyMon.PDP`;

export const getPdps = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${PDP_SELECT} ORDER BY pdp_id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createPdp = async (req, res) => {
  try {
    const p = req.body;
    if (!p.pdpNumber || !p.pdpName) return res.status(400).json({ success: false, message: "pdpNumber and pdpName are required" });

    const result = await global.pool3.request()
      .input("pdpNumber", sql.NVarChar(50),  p.pdpNumber)
      .input("pdpName",   sql.NVarChar(200), p.pdpName)
      .input("location",  sql.NVarChar(200), strOrNull(p.location))
      .input("isActive",  sql.Bit, toBit(p.isActive ?? true))
      .query(`
        INSERT INTO EnergyMon.PDP (pdp_number, pdp_name, location, is_active, created_at, updated_at)
        OUTPUT INSERTED.pdp_id AS id, INSERTED.pdp_number AS pdpNumber, INSERTED.pdp_name AS pdpName, INSERTED.location AS location, INSERTED.is_active AS isActive
        VALUES (@pdpNumber, @pdpName, @location, @isActive, SYSDATETIME(), SYSDATETIME())
      `);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `PDP Number "${req.body.pdpNumber}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updatePdp = async (req, res) => {
  try {
    const { id } = req.params;
    const p = req.body;
    const result = await global.pool3.request()
      .input("id",        sql.Int, id)
      .input("pdpNumber", sql.NVarChar(50),  p.pdpNumber)
      .input("pdpName",   sql.NVarChar(200), p.pdpName)
      .input("location",  sql.NVarChar(200), strOrNull(p.location))
      .input("isActive",  sql.Bit, toBit(p.isActive ?? true))
      .query(`
        UPDATE EnergyMon.PDP SET
          pdp_number = @pdpNumber, pdp_name = @pdpName, location = @location, is_active = @isActive, updated_at = SYSDATETIME()
        OUTPUT INSERTED.pdp_id AS id, INSERTED.pdp_number AS pdpNumber, INSERTED.pdp_name AS pdpName, INSERTED.location AS location, INSERTED.is_active AS isActive
        WHERE pdp_id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "PDP not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `PDP Number "${req.body.pdpNumber}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deletePdp = async (req, res) => {
  try {
    const { id } = req.params;
    const inUse = await global.pool3.request().input("id", sql.Int, id).query(`SELECT COUNT(*) AS cnt FROM EnergyMon.Meter WHERE pdp_id = @id`);
    if (inUse.recordset[0].cnt > 0) {
      return res.status(409).json({ success: false, message: "Cannot delete a PDP that still has meters assigned to it" });
    }
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM EnergyMon.PDP WHERE pdp_id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Meter ────────────────────────────────────────────────────────────────────
const METER_SELECT = `
  SELECT
    Mt.meter_id AS id, Mt.meter_code AS meterCode, Mt.meter_name AS meterName,
    Mt.pdp_id AS pdpId, P.pdp_name AS pdpName, P.pdp_number AS pdpNumber,
    Mt.meter_location AS meterLocation, Mt.comm_type AS commType,
    Mt.ip_address AS ipAddress, Mt.tcp_port AS tcpPort, Mt.com_port AS comPort, Mt.baud_rate AS baudRate,
    Mt.parity AS parity, Mt.stopbits AS stopbits, Mt.bytesize AS bytesize, Mt.poll_interval_s AS pollIntervalS,
    Mt.slave_id AS slaveId, Mt.meter_model AS meterModel, Mt.is_enabled AS isEnabled,
    Mt.v_min AS vMin, Mt.v_max AS vMax, Mt.i_max AS iMax, Mt.pf_min AS pfMin, Mt.freq_min AS freqMin, Mt.freq_max AS freqMax
  FROM EnergyMon.Meter Mt
  LEFT JOIN EnergyMon.PDP P ON P.pdp_id = Mt.pdp_id`;

const meterInputs = (request, m) => request
  .input("meterCode",     sql.NVarChar(50),  m.meterCode)
  .input("meterName",     sql.NVarChar(200), m.meterName)
  .input("pdpId",         sql.Int,           numOrNull(m.pdpId))
  .input("meterLocation", sql.NVarChar(200), strOrNull(m.meterLocation))
  .input("commType",      sql.NVarChar(10),  m.commType || "TCP")
  .input("ipAddress",     sql.NVarChar(50),  strOrNull(m.ipAddress))
  .input("tcpPort",       sql.Int,           numOrNull(m.tcpPort))
  .input("comPort",       sql.NVarChar(20),  strOrNull(m.comPort))
  .input("baudRate",      sql.Int,           numOrNull(m.baudRate))
  .input("parity",        sql.NVarChar(1),   strOrNull(m.parity))
  .input("stopbits",      sql.Int,           numOrNull(m.stopbits))
  .input("bytesize",      sql.Int,           numOrNull(m.bytesize))
  .input("pollIntervalS", sql.Int,           numOrNull(m.pollIntervalS) ?? 5)
  .input("slaveId",       sql.Int,           numOrNull(m.slaveId) ?? 1)
  .input("meterModel",    sql.NVarChar(50),  m.meterModel)
  .input("isEnabled",     sql.Bit,           toBit(m.isEnabled ?? true))
  .input("vMin",          sql.Float,         numOrNull(m.vMin))
  .input("vMax",          sql.Float,         numOrNull(m.vMax))
  .input("iMax",          sql.Float,         numOrNull(m.iMax))
  .input("pfMin",         sql.Float,         numOrNull(m.pfMin))
  .input("freqMin",       sql.Float,         numOrNull(m.freqMin))
  .input("freqMax",       sql.Float,         numOrNull(m.freqMax));

export const getMeters = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${METER_SELECT} ORDER BY Mt.meter_id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMeter = async (req, res) => {
  try {
    const m = req.body;
    if (!m.meterCode || !m.meterName || !m.meterModel) {
      return res.status(400).json({ success: false, message: "meterCode, meterName and meterModel are required" });
    }

    const request = meterInputs(global.pool3.request(), m);
    const result = await request.query(`
      INSERT INTO EnergyMon.Meter (
        meter_code, meter_name, pdp_id, meter_location, comm_type, ip_address, tcp_port, com_port, baud_rate,
        parity, stopbits, bytesize, poll_interval_s, slave_id, meter_model, is_enabled,
        v_min, v_max, i_max, pf_min, freq_min, freq_max, created_at, updated_at
      )
      OUTPUT INSERTED.meter_id AS id
      VALUES (
        @meterCode, @meterName, @pdpId, @meterLocation, @commType, @ipAddress, @tcpPort, @comPort, @baudRate,
        @parity, @stopbits, @bytesize, @pollIntervalS, @slaveId, @meterModel, @isEnabled,
        @vMin, @vMax, @iMax, @pfMin, @freqMin, @freqMax, SYSDATETIME(), SYSDATETIME()
      )
    `);

    const created = await global.pool3.request().input("id", sql.Int, result.recordset[0].id).query(`${METER_SELECT} WHERE Mt.meter_id = @id`);
    res.json({ success: true, data: created.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `Meter Code "${req.body.meterCode}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMeter = async (req, res) => {
  try {
    const { id } = req.params;
    const m = req.body;
    const request = meterInputs(global.pool3.request(), m).input("id", sql.Int, id);
    const result = await request.query(`
      UPDATE EnergyMon.Meter SET
        meter_code = @meterCode, meter_name = @meterName, pdp_id = @pdpId, meter_location = @meterLocation,
        comm_type = @commType, ip_address = @ipAddress, tcp_port = @tcpPort, com_port = @comPort, baud_rate = @baudRate,
        parity = @parity, stopbits = @stopbits, bytesize = @bytesize, poll_interval_s = @pollIntervalS,
        slave_id = @slaveId, meter_model = @meterModel, is_enabled = @isEnabled,
        v_min = @vMin, v_max = @vMax, i_max = @iMax, pf_min = @pfMin, freq_min = @freqMin, freq_max = @freqMax,
        updated_at = SYSDATETIME()
      OUTPUT INSERTED.meter_id AS id
      WHERE meter_id = @id
    `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Meter not found" });
    const updated = await global.pool3.request().input("id", sql.Int, id).query(`${METER_SELECT} WHERE Mt.meter_id = @id`);
    res.json({ success: true, data: updated.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ success: false, message: `Meter Code "${req.body.meterCode}" already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMeter = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM EnergyMon.Meter WHERE meter_id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
