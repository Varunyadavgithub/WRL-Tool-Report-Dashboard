/**
 * Energy Meters — Live readings, trend history, consumption reports and alerts.
 *
 * All data here (LiveReading, ReadingHistory, ConsumptionSummary, AlertLog)
 * lives under the pre-existing `EnergyMon` schema in DB3 and is written by an
 * external Modbus-polling service that already does its own rollup and
 * alert-detection — this controller is read-only against those tables (plus
 * ack/resolve on AlertLog, which is an operator action, not a poller one).
 */
import sql from "mssql";

const LIVE_SELECT = `
  SELECT
    Mt.meter_id AS meterId, Mt.meter_code AS meterCode, Mt.meter_name AS meterName,
    Mt.meter_location AS meterLocation, Mt.is_enabled AS isEnabled,
    Mt.pdp_id AS pdpId, P.pdp_name AS pdpName, P.pdp_number AS pdpNumber,
    L.current_a AS currentA, L.current_b AS currentB, L.current_c AS currentC, L.current_avg AS currentAvg,
    L.voltage_ab AS voltageAb, L.voltage_bc AS voltageBc, L.voltage_ca AS voltageCa, L.voltage_ll_avg AS voltageLlAvg,
    L.voltage_an AS voltageAn, L.voltage_bn AS voltageBn, L.voltage_cn AS voltageCn, L.voltage_ln_avg AS voltageLnAvg,
    L.power_a AS powerA, L.power_b AS powerB, L.power_c AS powerC, L.power_total AS powerTotal,
    L.pf_a AS pfA, L.pf_b AS pfB, L.pf_c AS pfC, L.pf_total AS pfTotal,
    L.frequency AS frequency, L.energy_kwh AS energyKwh,
    ISNULL(L.comm_status, 'Offline') AS commStatus, L.last_comm_at AS lastCommAt, L.last_error AS lastError
  FROM EnergyMon.Meter Mt
  LEFT JOIN EnergyMon.PDP P ON P.pdp_id = Mt.pdp_id
  LEFT JOIN EnergyMon.LiveReading L ON L.meter_id = Mt.meter_id`;

export const getLiveMeters = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${LIVE_SELECT} ORDER BY Mt.meter_id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMeterTrend = async (req, res) => {
  try {
    const { meterId, hours } = req.query;
    if (!meterId) return res.status(400).json({ success: false, message: "meterId is required" });

    const result = await global.pool3.request()
      .input("meterId", sql.Int, meterId)
      .input("hours", sql.Int, Number(hours) > 0 ? Number(hours) : 24)
      .query(`
        SELECT
          ts AS ts,
          current_a AS currentA, current_b AS currentB, current_c AS currentC, current_avg AS currentAvg,
          voltage_ab AS voltageAb, voltage_bc AS voltageBc, voltage_ca AS voltageCa, voltage_ll_avg AS voltageLlAvg,
          voltage_an AS voltageAn, voltage_bn AS voltageBn, voltage_cn AS voltageCn, voltage_ln_avg AS voltageLnAvg,
          power_a AS powerA, power_b AS powerB, power_c AS powerC, power_total AS powerTotal,
          pf_a AS pfA, pf_b AS pfB, pf_c AS pfC, pf_total AS pfTotal,
          frequency AS frequency, energy_kwh AS energyKwh, comm_status AS commStatus
        FROM EnergyMon.ReadingHistory
        WHERE meter_id = @meterId AND ts >= DATEADD(HOUR, -@hours, GETDATE())
        ORDER BY ts
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getConsumptionReport = async (req, res) => {
  try {
    const { meterId, periodType, from, to } = req.query;
    const type = ["Hour", "Day", "Month"].includes(periodType) ? periodType : "Day";

    const request = global.pool3.request().input("periodType", sql.NVarChar(5), type);
    let where = "WHERE CS.period_type = @periodType";
    if (meterId) { request.input("meterId", sql.Int, meterId); where += " AND CS.meter_id = @meterId"; }
    if (from)    { request.input("from", sql.DateTime2, new Date(from)); where += " AND CS.period_start >= @from"; }
    if (to)      { request.input("to", sql.DateTime2, new Date(to)); where += " AND CS.period_start < @to"; }

    const result = await request.query(`
      SELECT
        CS.id AS id, CS.meter_id AS meterId, Mt.meter_name AS meterName, Mt.meter_code AS meterCode,
        CS.period_type AS periodType, CS.period_start AS periodStart, CS.period_end AS periodEnd,
        CS.consumption_kwh AS consumptionKwh, CS.start_counter_kwh AS startCounterKwh, CS.end_counter_kwh AS endCounterKwh
      FROM EnergyMon.ConsumptionSummary CS
      JOIN EnergyMon.Meter Mt ON Mt.meter_id = CS.meter_id
      ${where}
      ORDER BY CS.period_start DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPeakDemandReport = async (req, res) => {
  try {
    const { meterId, from, to } = req.query;
    const request = global.pool3.request();
    let where = "WHERE 1=1";
    if (meterId) { request.input("meterId", sql.Int, meterId); where += " AND meter_id = @meterId"; }
    request.input("from", sql.DateTime2, from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000));
    request.input("to", sql.DateTime2, to ? new Date(to) : new Date());
    where += " AND ts >= @from AND ts < @to";

    const result = await request.query(`
      ;WITH Daily AS (
        SELECT meter_id, CAST(ts AS DATE) AS day, power_total, ts,
          AVG(power_total) OVER (PARTITION BY meter_id, CAST(ts AS DATE)) AS avgKw,
          ROW_NUMBER() OVER (PARTITION BY meter_id, CAST(ts AS DATE) ORDER BY power_total DESC) AS rn
        FROM EnergyMon.ReadingHistory
        ${where} AND power_total IS NOT NULL
      )
      SELECT
        D.meter_id AS meterId, Mt.meter_name AS meterName, Mt.meter_code AS meterCode,
        D.day AS day, D.power_total AS peakKw, D.ts AS peakAt, D.avgKw AS avgKw,
        CASE WHEN D.power_total > 0 THEN D.avgKw / D.power_total ELSE NULL END AS loadFactor
      FROM Daily D
      JOIN EnergyMon.Meter Mt ON Mt.meter_id = D.meter_id
      WHERE D.rn = 1
      ORDER BY D.day DESC, D.meter_id
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPdpSummaryReport = async (req, res) => {
  try {
    const { periodType, from, to } = req.query;
    const type = ["Hour", "Day", "Month"].includes(periodType) ? periodType : "Day";

    const request = global.pool3.request().input("periodType", sql.NVarChar(5), type);
    let where = "WHERE CS.period_type = @periodType";
    if (from) { request.input("from", sql.DateTime2, new Date(from)); where += " AND CS.period_start >= @from"; }
    if (to)   { request.input("to", sql.DateTime2, new Date(to)); where += " AND CS.period_start < @to"; }

    const result = await request.query(`
      SELECT
        P.pdp_id AS pdpId, P.pdp_name AS pdpName, P.pdp_number AS pdpNumber,
        COUNT(DISTINCT CS.meter_id) AS meterCount,
        SUM(CS.consumption_kwh) AS totalKwh
      FROM EnergyMon.ConsumptionSummary CS
      JOIN EnergyMon.Meter Mt ON Mt.meter_id = CS.meter_id
      JOIN EnergyMon.PDP P ON P.pdp_id = Mt.pdp_id
      ${where}
      GROUP BY P.pdp_id, P.pdp_name, P.pdp_number
      ORDER BY totalKwh DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAlertSummaryReport = async (req, res) => {
  try {
    const { meterId, from, to } = req.query;
    const request = global.pool3.request();
    let where = "WHERE 1=1";
    if (meterId) { request.input("meterId", sql.Int, meterId); where += " AND A.meter_id = @meterId"; }
    request.input("from", sql.DateTime2, from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000));
    request.input("to", sql.DateTime2, to ? new Date(to) : new Date());
    where += " AND A.opened_at >= @from AND A.opened_at < @to";

    const result = await request.query(`
      SELECT
        A.meter_id AS meterId, Mt.meter_name AS meterName, Mt.meter_code AS meterCode,
        A.alert_type AS alertType, A.severity AS severity,
        COUNT(*) AS occurrences,
        SUM(DATEDIFF(SECOND, A.opened_at, ISNULL(A.resolved_at, SYSDATETIME()))) / 60.0 AS totalMinutes,
        SUM(CASE WHEN A.resolved_at IS NULL THEN 1 ELSE 0 END) AS stillOpen
      FROM EnergyMon.AlertLog A
      JOIN EnergyMon.Meter Mt ON Mt.meter_id = A.meter_id
      ${where}
      GROUP BY A.meter_id, Mt.meter_name, Mt.meter_code, A.alert_type, A.severity
      ORDER BY occurrences DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const { meterId, active } = req.query;
    const request = global.pool3.request();
    let where = "WHERE 1=1";
    if (meterId) { request.input("meterId", sql.Int, meterId); where += " AND A.meter_id = @meterId"; }
    if (active === "true") where += " AND A.resolved_at IS NULL";

    const result = await request.query(`
      SELECT
        A.id AS id, A.meter_id AS meterId, Mt.meter_name AS meterName, Mt.meter_code AS meterCode,
        A.alert_type AS alertType, A.severity AS severity, A.message AS message,
        A.value AS value, A.threshold AS threshold,
        A.opened_at AS openedAt, A.resolved_at AS resolvedAt,
        A.is_acknowledged AS isAcknowledged, A.acknowledged_by AS acknowledgedBy, A.acknowledged_at AS acknowledgedAt
      FROM EnergyMon.AlertLog A
      JOIN EnergyMon.Meter Mt ON Mt.meter_id = A.meter_id
      ${where}
      ORDER BY A.opened_at DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const acknowledgedBy = req.body?.acknowledgedBy || req.user?.name || req.user?.username || "Unknown";

    const result = await global.pool3.request()
      .input("id", sql.BigInt, id)
      .input("acknowledgedBy", sql.NVarChar(100), acknowledgedBy)
      .query(`
        UPDATE EnergyMon.AlertLog SET is_acknowledged = 1, acknowledged_by = @acknowledgedBy, acknowledged_at = SYSDATETIME()
        OUTPUT INSERTED.id AS id
        WHERE id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Alert not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await global.pool3.request()
      .input("id", sql.BigInt, id)
      .query(`
        UPDATE EnergyMon.AlertLog SET resolved_at = SYSDATETIME()
        OUTPUT INSERTED.id AS id
        WHERE id = @id AND resolved_at IS NULL
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Alert not found or already resolved" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
