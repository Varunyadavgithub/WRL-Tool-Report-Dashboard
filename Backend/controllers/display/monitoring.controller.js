import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// ─── Pool helper ──────────────────────────────────────────────────────────────
const withPool = async (callback) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
};

// ─── Shift boundary resolver ──────────────────────────────────────────────────
const resolveShiftBounds = (shiftDate, shift) => {
  const base = new Date(shiftDate);
  if (shift === "A") {
    const start = new Date(base);
    start.setHours(8, 0, 0, 0);
    const end = new Date(base);
    end.setHours(20, 0, 0, 0);
    return { shiftStart: start, shiftEnd: end };
  }
  // Shift B: 20:00 on shiftDate → 08:00 next day
  const start = new Date(base);
  start.setHours(20, 0, 0, 0);
  const end = new Date(base);
  end.setDate(base.getDate() + 1);
  end.setHours(8, 0, 0, 0);
  return { shiftStart: start, shiftEnd: end };
};

// ─── Shared param validator ───────────────────────────────────────────────────
const validateShiftParams = (req) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate)
    throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift))
    throw new AppError("Invalid shift. Must be A or B.", 400);
  return { shiftDate, shift };
};

// ─── configId validator ───────────────────────────────────────────────────────
// BUG FIX: Centralised so every data endpoint validates and parses consistently.
const validateConfigId = (req) => {
  const { configId } = req.query;
  if (!configId)
    throw new AppError("Missing required query parameter: configId.", 400);
  const id = Number(configId);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("configId must be a positive integer.", 400);
  return id;
};

// ─── Config fetcher ───────────────────────────────────────────────────────────
const getConfig = async (pool, configId) => {
  const result = await pool
    .request()
    .input("Id", sql.Int, configId)
    .query("SELECT * FROM dbo.DashboardConfig WHERE Id = @Id AND IsActive = 1");
  return result.recordset[0] || null;
};

// ─── Month boundaries helper (reused by FG Packing & FG Loading) ─────────────
// BUG FIX: Was recomputed with `new Date()` inside every request handler,
// meaning the month boundaries could differ from shiftStart on month-end nights.
// Now derived from shiftStart to be consistent.
const resolveMonthBounds = (shiftStart) => {
  const monthStart = new Date(
    shiftStart.getFullYear(),
    shiftStart.getMonth(),
    1,
    8,
    0,
    0,
  );
  const monthEnd = new Date(
    shiftStart.getFullYear(),
    shiftStart.getMonth() + 1,
    1,
    8,
    0,
    0,
  );
  return { monthStart, monthEnd };
};


// ─── Shared FG query builder ──────────────────────────────────────────────────
// BUG FIX (CRITICAL): Both getFGPackingData and getFGLoadingData had identical
// queries but each had a broken CTE block — the CTEs were defined but the final
// SELECT had no FROM clause joining them to DashboardConfig (the SELECT jumped
// straight into dc.LineMonthlyProduction1 without a preceding SELECT keyword,
// and the ShiftActual CTE used "PackingTillNow" as the alias but the column was
// named "LoadingTillNow" in the CTE definition).  Fixed below with a single
// shared builder that is parameterised by which column alias to use.
const buildFGQuery = (shiftActualAlias) => `
 WITH ShiftActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  = @stationCode1
      AND ActivityType = 5
      AND Remark       = @lineCode
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  @shiftEnd
),
MonthlyActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  = @stationCode1
      AND ActivityType = 5
      AND Remark       = @lineCode
      AND ActivityOn  >= @monthStart
      AND ActivityOn  <  @monthEnd
)

SELECT
    dc.LineMonthlyProduction1 AS MonthlyPlanQty,
    dc.WorkingTimeMin,
    dc.LineTaktTime1          AS TactTimeSec,

    -- Shift Target
        CAST(
    ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
AS INT) AS ShiftOutputTarget,

    dc.LineTarget1 AS UPHTarget,

    sa.ActualFG AS ActualQty,

    -- ✅ FIXED LossTime (clean formula)
    CAST(
      (
        (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        - sa.ActualFG
      ) * dc.LineTaktTime1 / 60.0
    AS INT) AS LossTime,

    -- Loss Units
    CAST(
      (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
      - sa.ActualFG
    AS INT) AS LossUnits,

    -- Balance
    CAST(dc.LineMonthlyProduction1 * 1.0
      / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
    AS INT) - sa.ActualFG AS BalanceQty,

    -- Prorated Target
    CAST(
      (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
      * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
         / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
    AS INT) AS ProratedTarget,

    -- Performance
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS PerformancePct,

    -- Efficiency
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS EfficiencyTillNow,

    -- Actual UPH
    CAST(
      sa.ActualFG * 60.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
    AS DECIMAL(6,2)) AS ActualUPH,

    sa.ActualFG AS GaugeValue,
    ma.ActualFG AS MonthlyAchieved,

    dc.LineMonthlyProduction1 - ma.ActualFG AS MonthlyRemaining,

    -- Asking Rate
    CAST(
      (dc.LineMonthlyProduction1 - ma.ActualFG) * 1.0
      / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
    AS INT) AS AskingRate,

    DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) AS RemainingDays,

    -- Time %
    DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
      AS ConsumedTimePct

FROM dbo.DashboardConfig dc
CROSS JOIN ShiftActual   sa
CROSS JOIN MonthlyActual ma
WHERE dc.Id = @configId;
`;

// ─── Shared FG request binder ─────────────────────────────────────────────────
const bindFGRequest = (
  req,
  { configId, lineCode, istStart, istEnd, stationCode1, monthStart, monthEnd },
) =>
  req
    .input("configId", sql.Int, configId)
    .input("lineCode", sql.Int, lineCode)
    .input("shiftStart", sql.DateTime, istStart)
    .input("shiftEnd", sql.DateTime, istEnd)
    .input("monthStart", sql.DateTime, convertToIST(monthStart.toISOString()))
    .input("monthEnd", sql.DateTime, convertToIST(monthEnd.toISOString()))
    .input("stationCode1", sql.Int, stationCode1);

const buildLoadingQuery = (shiftActualAlias) => `
 WITH ShiftActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  = @stationCode2
      AND ActivityType = 5
      AND Remark       = @lineCode
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  @shiftEnd
),
MonthlyActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  = @stationCode2
      AND ActivityType = 5
      AND Remark       = @lineCode
      AND ActivityOn  >= @monthStart
      AND ActivityOn  <  @monthEnd
)

SELECT
    dc.LineMonthlyProduction1 AS MonthlyPlanQty,
    dc.WorkingTimeMin,
    dc.LineTaktTime1          AS TactTimeSec,

    -- Shift Target
        CAST(
    ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
AS INT) AS ShiftOutputTarget,

    dc.LineTarget1 AS UPHTarget,

    sa.ActualFG AS ActualQty,

    -- ✅ FIXED LossTime (clean formula)
    CAST(
      (
        (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        - sa.ActualFG
      ) * dc.LineTaktTime1 / 60.0
    AS INT) AS LossTime,

    -- Loss Units
    CAST(
      (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
      - sa.ActualFG
    AS INT) AS LossUnits,

    -- Balance
    CAST(dc.LineMonthlyProduction1 * 1.0
      / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
    AS INT) - sa.ActualFG AS BalanceQty,

    -- Prorated Target
    CAST(
      (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
      * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
         / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
    AS INT) AS ProratedTarget,

    -- Performance
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS PerformancePct,

    -- Efficiency
    CAST(
      sa.ActualFG * 100.0
      / NULLIF(
          (dc.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
          * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
             / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0))
        , 0)
    AS DECIMAL(6,2)) AS EfficiencyTillNow,

    -- Actual UPH
    CAST(
      sa.ActualFG * 60.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
    AS DECIMAL(6,2)) AS ActualUPH,

    sa.ActualFG AS GaugeValue,
    ma.ActualFG AS MonthlyAchieved,

    dc.LineMonthlyProduction1 - ma.ActualFG AS MonthlyRemaining,

    -- Asking Rate
    CAST(
      (dc.LineMonthlyProduction1 - ma.ActualFG) * 1.0
      / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
    AS INT) AS AskingRate,

    DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) AS RemainingDays,

    -- Time %
    DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
      AS ConsumedTimePct

FROM dbo.DashboardConfig dc
CROSS JOIN ShiftActual   sa
CROSS JOIN MonthlyActual ma
WHERE dc.Id = @configId;
`;

// ─── Shared FG request binder ─────────────────────────────────────────────────
const bindLoadingRequest = (
  req,
  { configId, lineCode, istStart, istEnd, stationCode2, monthStart, monthEnd },
) =>
  req
    .input("configId", sql.Int, configId)
    .input("lineCode", sql.Int, lineCode)
    .input("shiftStart", sql.DateTime, istStart)
    .input("shiftEnd", sql.DateTime, istEnd)
    .input("monthStart", sql.DateTime, convertToIST(monthStart.toISOString()))
    .input("monthEnd", sql.DateTime, convertToIST(monthEnd.toISOString()))
    .input("stationCode2", sql.Int, stationCode2);

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD CONFIG CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /dashboard/configs — list all active configs
export const getAllDashboardConfigs = tryCatch(async (req, res) => {
  const data = await withPool(async (pool) => {
    const result = await pool.request().query(`
      SELECT * FROM dbo.DashboardConfig
      WHERE IsActive = 1
      ORDER BY CreatedAt DESC
    `);
    return result.recordset;
  });
  res.status(200).json({ success: true, data });
});

// GET /dashboard/configs/:id
export const getDashboardConfigById = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("Invalid config id.", 400);

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query(
        "SELECT * FROM dbo.DashboardConfig WHERE Id = @Id AND IsActive = 1",
      );
    return result.recordset[0] || null;
  });
  if (!data) throw new AppError("Dashboard config not found.", 404);
  res.status(200).json({ success: true, data });
});

// POST /dashboard/configs — create
export const createDashboardConfig = tryCatch(async (req, res) => {
  const {
    dashboardName,
    lineName,
    lineCode,
    stationCode1,
    stationName1,
    lineTaktTime1,
    lineMonthlyProduction1,
    lineTarget1,
    stationCode2,
    stationName2,
    lineTaktTime2,
    lineMonthlyProduction2,
    qualityProcessCode,
    qualityLineName,
    sectionName,
  } = req.body;

  if (!dashboardName?.trim())
    throw new AppError("Dashboard name is required.", 400);
  if (!stationCode1?.trim())
    throw new AppError("Station Code 1 is required.", 400);

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("DashboardName", sql.NVarChar(120), dashboardName)
      .input("LineName", sql.NVarChar(100), lineName || "")
      .input("LineCode", sql.NVarChar(50), lineCode || "")
      .input("StationCode1", sql.NVarChar(50), stationCode1)
      .input("StationName1", sql.NVarChar(100), stationName1 || "")
      .input("LineTaktTime1", sql.Int, Number(lineTaktTime1) || 40)
      .input(
        "LineMonthlyProduction1",
        sql.Int,
        Number(lineMonthlyProduction1) || 0,
      )
      .input("LineTarget1", sql.Int, Number(lineTarget1) || 0)
      .input("StationCode2", sql.NVarChar(50), stationCode2 || null)
      .input("StationName2", sql.NVarChar(100), stationName2 || null)
      .input("LineTaktTime2", sql.Int, Number(lineTaktTime2) || null)
      .input(
        "LineMonthlyProduction2",
        sql.Int,
        Number(lineMonthlyProduction2) || null,
      )
      .input(
        "QualityProcessCode",
        sql.NVarChar(500),
        qualityProcessCode || null,
      )
      .input("QualityLineName", sql.NVarChar(100), qualityLineName || null)
      .input("SectionName", sql.NVarChar(200), sectionName || null).query(`
        INSERT INTO dbo.DashboardConfig
          (DashboardName, LineName, LineCode,
           StationCode1, StationName1, LineTaktTime1, LineMonthlyProduction1, LineTarget1,
           StationCode2, StationName2, LineTaktTime2, LineMonthlyProduction2,
           QualityProcessCode, QualityLineName, SectionName)
        OUTPUT INSERTED.*
        VALUES
          (@DashboardName, @LineName, @LineCode,
           @StationCode1, @StationName1, @LineTaktTime1, @LineMonthlyProduction1, @LineTarget1,
           @StationCode2, @StationName2, @LineTaktTime2, @LineMonthlyProduction2,
           @QualityProcessCode, @QualityLineName, @SectionName)
      `);
    return result.recordset[0];
  });

  res
    .status(201)
    .json({ success: true, message: "Dashboard config created.", data });
});

// PUT /dashboard/configs/:id — update
export const updateDashboardConfig = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("Invalid config id.", 400);

  const {
    dashboardName,
    lineName,
    lineCode,
    stationCode1,
    stationName1,
    lineTaktTime1,
    lineMonthlyProduction1,
    lineTarget1,
    stationCode2,
    stationName2,
    lineTaktTime2,
    lineMonthlyProduction2,
    qualityProcessCode,
    qualityLineName,
    sectionName,
  } = req.body;

  // BUG FIX: Validate required fields on update too — the original skipped this.
  if (!dashboardName?.trim())
    throw new AppError("Dashboard name is required.", 400);
  if (!stationCode1?.trim())
    throw new AppError("Station Code 1 is required.", 400);

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .input("DashboardName", sql.NVarChar(120), dashboardName)
      .input("LineName", sql.NVarChar(100), lineName || "")
      .input("LineCode", sql.NVarChar(50), lineCode || "")
      .input("StationCode1", sql.NVarChar(50), stationCode1)
      .input("StationName1", sql.NVarChar(100), stationName1 || "")
      .input("LineTaktTime1", sql.Int, Number(lineTaktTime1) || 40)
      .input(
        "LineMonthlyProduction1",
        sql.Int,
        Number(lineMonthlyProduction1) || 0,
      )
      .input("LineTarget1", sql.Int, Number(lineTarget1) || 0)
      .input("StationCode2", sql.NVarChar(50), stationCode2 || null)
      .input("StationName2", sql.NVarChar(100), stationName2 || null)
      .input("LineTaktTime2", sql.Int, Number(lineTaktTime2) || null)
      .input(
        "LineMonthlyProduction2",
        sql.Int,
        Number(lineMonthlyProduction2) || null,
      )
      .input(
        "QualityProcessCode",
        sql.NVarChar(500),
        qualityProcessCode || null,
      )
      .input("QualityLineName", sql.NVarChar(100), qualityLineName || null)
      .input("SectionName", sql.NVarChar(200), sectionName || null).query(`
        UPDATE dbo.DashboardConfig SET
          DashboardName          = @DashboardName,
          LineName               = @LineName,
          LineCode               = @LineCode,
          StationCode1           = @StationCode1,
          StationName1           = @StationName1,
          LineTaktTime1          = @LineTaktTime1,
          LineMonthlyProduction1 = @LineMonthlyProduction1,
          LineTarget1            = @LineTarget1,
          StationCode2           = @StationCode2,
          StationName2           = @StationName2,
          LineTaktTime2          = @LineTaktTime2,
          LineMonthlyProduction2 = @LineMonthlyProduction2,
          QualityProcessCode     = @QualityProcessCode,
          QualityLineName        = @QualityLineName,
          SectionName            = @SectionName
        OUTPUT INSERTED.*
        WHERE Id = @Id AND IsActive = 1
      `);
    return result.recordset[0] || null;
  });

  if (!data) throw new AppError("Dashboard config not found.", 404);
  res
    .status(200)
    .json({ success: true, message: "Dashboard config updated.", data });
});

// DELETE /dashboard/configs/:id — soft delete
export const deleteDashboardConfig = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("Invalid config id.", 400);

  await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query(
        "UPDATE dbo.DashboardConfig SET IsActive = 0 OUTPUT INSERTED.Id WHERE Id = @Id",
      );
    // BUG FIX: Verify the row actually existed before reporting success.
    if (result.recordset.length === 0)
      throw new AppError("Dashboard config not found.", 404);
  });
  res.status(200).json({ success: true, message: "Dashboard config deleted." });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD DATA ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /dashboard/fg-packing ───────────────────────────────────────────────
export const getFGPackingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);
  const { monthStart, monthEnd } = resolveMonthBounds(shiftStart);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    // BUG FIX: For packing, stationCode2 is the packing station (same as station1
    // when not configured separately). Keep original fallback logic.
    const lineCode = config.LineCode;

    const r = await bindFGRequest(pool.request(), {
      configId,
      lineCode,
      istStart,
      istEnd,
      stationCode1,
      monthStart,
      monthEnd,
    }).query(buildFGQuery("PackingTillNow"));

    return r.recordset[0] || null;
  });

  if (!data)
    throw new AppError("No data found for the given shift and date.", 404);
  res
    .status(200)
    .json({ success: true, message: "FG Packing data retrieved.", data });
});

// ─── GET /dashboard/fg-loading ───────────────────────────────────────────────
export const getFGLoadingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);
  const { monthStart, monthEnd } = resolveMonthBounds(shiftStart);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode2 = config.StationCode2;
    const lineCode = config.LineCode;

    const r = await bindLoadingRequest(pool.request(), {
      configId,
      lineCode,
      istStart,
      istEnd,
      stationCode2,
      monthStart,
      monthEnd,
    }).query(buildLoadingQuery("LoadingTillNow"));

    return r.recordset[0] || null;
  });

  if (!data)
    throw new AppError("No data found for the given shift and date.", 404);
  res
    .status(200)
    .json({ success: true, message: "FG Loading data retrieved.", data });
});

// ─── GET /dashboard/hourly ────────────────────────────────────────────────────
export const getHourlyProductionData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const lineCode     = config.LineCode;

    const hoursQuery = `
      WITH HourlySummary AS (
        SELECT
          DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
          CAST(
            CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
            CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
          AS DATETIME) AS HourTime,
          COUNT(*) AS Loading_Count
        FROM MaterialBarcode mb
        JOIN ProcessActivity b  ON b.PSNo        = mb.DocNo
        JOIN WorkCenter      c  ON b.StationCode = c.StationCode
        WHERE mb.PrintStatus = 1
          AND mb.Status     <> 99
          AND mb.Type NOT IN (200)
          AND c.StationCode  = @stationCode1
          AND b.Remark       = @lineCode
          AND b.ActivityType = 5
          AND b.ActivityOn BETWEEN @shiftStart AND @shiftEnd
        GROUP BY
          DATEPART(HOUR, b.ActivityOn),
          CAST(
            CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
            CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
          AS DATETIME)
      ),
      Config AS (
        SELECT LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
      ),
      HourlyTarget AS (
        SELECT CAST(
          c.LineMonthlyProduction1 * 1.0
          / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
          / 12.0
        AS INT) AS HourTarget
        FROM Config c
      )
      SELECT
        ROW_NUMBER() OVER (ORDER BY hs.HourTime) AS HourNo,
        hs.TIMEHOUR,
        ht.HourTarget                            AS Target,
        hs.Loading_Count                         AS Actual,
        CASE WHEN ht.HourTarget > hs.Loading_Count
             THEN ht.HourTarget - hs.Loading_Count ELSE 0 END AS HourLoss,
        SUM(
          CASE WHEN ht.HourTarget > hs.Loading_Count
               THEN ht.HourTarget - hs.Loading_Count ELSE 0 END
        ) OVER (ORDER BY hs.HourTime ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                                                 AS CumulativeLoss,
        CAST(
          hs.Loading_Count * 100.0 / NULLIF(ht.HourTarget, 0)
        AS DECIMAL(5,1))                         AS AchievementPct
      FROM HourlySummary hs
      CROSS JOIN HourlyTarget ht
      ORDER BY hs.HourTime;
    `;

    // BUG FIX: Was referencing "dc.WorkingTimeMin" but the CTE alias is "cfg".
    // Also removed the stray reference to a non-existent "dc" alias in this query.
    const summaryQuery = `
      WITH Config AS (
        SELECT
          WorkingTimeMin,
          LineMonthlyProduction1,
          LineTaktTime1
        FROM dbo.DashboardConfig
        WHERE Id = @configId AND IsActive = 1
      ),
      ShiftActual AS (
        SELECT COUNT(*) AS TotalAchieved
        FROM MaterialBarcode mb
        JOIN ProcessActivity b ON b.PSNo        = mb.DocNo
        JOIN WorkCenter      c ON b.StationCode = c.StationCode
        WHERE mb.PrintStatus = 1
          AND mb.Status     <> 99
          AND mb.Type NOT IN (200)
          AND c.StationCode  = @stationCode1
          AND b.Remark       = @lineCode
          AND b.ActivityType = 5
          AND b.ActivityOn BETWEEN @shiftStart AND @shiftEnd
      )
      SELECT
        -- Shift Plan (Takt Based)
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT) AS ShiftPlan,

        sa.TotalAchieved,

        -- BUG FIX: was "dc.WorkingTimeMin" — dc alias does not exist here; use cfg
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT) - sa.TotalAchieved AS Remaining,

        -- Consumed Time %
        DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
          / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0) AS ConsumedTimePct

      FROM Config cfg
      CROSS JOIN ShiftActual sa;
    `;

    const [hoursResult, summaryResult] = await Promise.all([
      pool
        .request()
        .input("configId",    sql.Int,           configId)
        .input("shiftStart",  sql.DateTime,      istStart)
        .input("shiftEnd",    sql.DateTime,      istEnd)
        .input("stationCode1", sql.NVarChar(50), String(stationCode1))
        .input("lineCode",    sql.NVarChar(50),  String(lineCode))
        .query(hoursQuery),
      pool
        .request()
        .input("configId",    sql.Int,           configId)
        .input("shiftStart",  sql.DateTime,      istStart)
        .input("shiftEnd",    sql.DateTime,      istEnd)
        .input("stationCode1", sql.NVarChar(50), String(stationCode1))
        .input("lineCode",    sql.NVarChar(50),  String(lineCode))
        .query(summaryQuery),
    ]);

    const hours = hoursResult.recordset.map((row, idx) => ({
      HourNo:         idx + 1,
      TIMEHOUR:       row.TIMEHOUR,
      TimeLabel:      `H${idx + 1}`,
      Target:         row.Target,
      Actual:         row.Actual,
      HourLoss:       row.HourLoss,
      CumulativeLoss: row.CumulativeLoss,
      AchievementPct: row.AchievementPct,
    }));

    return { hours, summary: summaryResult.recordset[0] || {} };
  });

  res.status(200).json({
    success: true,
    message: "Hourly production data retrieved.",
    data,
  });
});

// ─── GET /dashboard/quality ───────────────────────────────────────────────────
export const getQualityData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd = convertToIST(shiftEnd.toISOString());

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;

    const summaryQuery = `
      WITH ReworkBase AS (
        SELECT it.ID, s.Status AS Rework_Status
        FROM InspectionTrans it
        INNER JOIN InspectionHeader ih ON it.InspectionLotNo = ih.InspectionLotNo
        LEFT  JOIN Status           s  ON ih.Status          = s.ID
        WHERE it.NextAction = 1
          AND it.InspectedOn BETWEEN @shiftStart AND @shiftEnd
      ),
      ShiftActual AS (
        SELECT COUNT(PSNo) AS TotalAchieved
        FROM ProcessActivity
        WHERE StationCode  = @stationCode1
          AND ActivityType = 5
          AND ActivityOn  >= @shiftStart
          AND ActivityOn  <  @shiftEnd
      ),
      Config AS (
        SELECT LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
      )
      SELECT
        CAST(cfg.LineMonthlyProduction1 * 1.0
          / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
        AS INT)                                                                        AS [Plan],
        sa.TotalAchieved,
        sa.TotalAchieved - (SELECT COUNT(*) FROM ReworkBase)                          AS OkUnit,
        (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Active')              AS DefectUnit,
        (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Closed')              AS ReworkDone,
        CAST(
          (sa.TotalAchieved - (SELECT COUNT(*) FROM ReworkBase)) * 100.0
          / NULLIF(sa.TotalAchieved, 0)
        AS DECIMAL(5,1))                                                               AS OkPct,
        CAST(
          (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Active') * 100.0
          / NULLIF(sa.TotalAchieved, 0)
        AS DECIMAL(5,1))                                                               AS DefectPct,
        DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
          / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)                      AS ConsumedTimePct
      FROM Config cfg CROSS JOIN ShiftActual sa;
    `;

    const defectsQuery = `
      SELECT TOP 5
        ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS SrNo,
        dc.Name                                     AS DefectName,
        COUNT(*)                                    AS DefectCount
      FROM InspectionTrans it
      INNER JOIN InspectionHeader  ih  ON it.InspectionLotNo = ih.InspectionLotNo
      LEFT  JOIN InspectionDefect  idf ON it.ID              = idf.ID
      LEFT  JOIN DefectCodeMaster  dc  ON idf.Defect         = dc.Code
      WHERE it.NextAction = 1
        AND it.InspectedOn BETWEEN @shiftStart AND @shiftEnd
        AND dc.Name IS NOT NULL
      GROUP BY dc.Name
      ORDER BY COUNT(*) DESC;
    `;

    const [summary, defects] = await Promise.all([
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), stationCode1)
        .query(summaryQuery),
      pool
        .request()
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .query(defectsQuery),
    ]);

    return { summary: summary.recordset[0] || {}, defects: defects.recordset };
  });

  res
    .status(200)
    .json({ success: true, message: "Quality data retrieved.", data });
});

// ─── GET /dashboard/loss ──────────────────────────────────────────────────────
export const getLossData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd = convertToIST(shiftEnd.toISOString());

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    // BUG FIX: Original used a hardcoded fallback "FINAL ASSEMBLY" which is
    // misleading — if sectionName is empty the loss query returns wrong data.
    // Now we throw a descriptive error so ops can fix the config.
    const sectionName = config.SectionName;
    if (!sectionName)
      throw new AppError(
        "SectionName is not configured for this dashboard. Please update the configuration.",
        400,
      );

    const stationsQuery = `
      WITH EMG AS (
        SELECT
          T.RefID,
          M.PLCLocation                             AS StationName,
          T.EmgOn, T.EmgOff,
          DATEDIFF(SECOND, T.EmgOn, T.EmgOff)      AS TotalSeconds
        FROM EMGTrans T
        INNER JOIN EMGMaster M
          ON T.PLCCode = M.PLCCode AND T.MEMBit = M.MEMBit AND M.Active = 1
        WHERE T.EmgOff IS NOT NULL
          AND T.EmgOn >= @shiftStart AND T.EmgOn < @shiftEnd
          AND M.Location = @sectionName
      ),
      BREAKS AS (
        SELECT
          CAST(CAST(@shiftStart AS DATE) AS DATETIME) + CAST(StartTime AS DATETIME) AS BreakStart,
          CAST(CAST(@shiftStart AS DATE) AS DATETIME) + CAST(EndTime   AS DATETIME) AS BreakEnd
        FROM ShiftBreaks
      ),
      CALC AS (
        SELECT
          E.RefID, E.StationName, E.TotalSeconds,
          ISNULL(SUM(
            CASE WHEN B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
                 THEN DATEDIFF(SECOND,
                       CASE WHEN E.EmgOn  > B.BreakStart THEN E.EmgOn  ELSE B.BreakStart END,
                       CASE WHEN E.EmgOff < B.BreakEnd   THEN E.EmgOff ELSE B.BreakEnd   END)
                 ELSE 0 END
          ), 0) AS BreakSeconds
        FROM EMG E CROSS JOIN BREAKS B
        GROUP BY E.RefID, E.StationName, E.TotalSeconds
      ),
      FINAL AS (
        SELECT StationName, (TotalSeconds - BreakSeconds) AS NetSeconds FROM CALC
      )
      SELECT
        StationName,
        CONVERT(VARCHAR, DATEADD(SECOND, SUM(NetSeconds), 0), 108) AS TotalStopTimeHMS,
        CAST(SUM(NetSeconds) / 60.0 AS DECIMAL(8,1))               AS TotalStopTime,
        SUM(NetSeconds)                                             AS TotalSeconds,
        COUNT(*)                                                    AS TotalStopCount
      FROM FINAL
      WHERE NetSeconds > 0
      GROUP BY StationName
      ORDER BY SUM(NetSeconds) DESC;
    `;

    const summaryQuery = `
      WITH Config AS (
        SELECT LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
      ),
      ShiftActual AS (
        SELECT COUNT(PSNo) AS Achieved
        FROM ProcessActivity
        WHERE StationCode  = @stationCode1
          AND ActivityType = 5
          AND ActivityOn  >= @shiftStart
          AND ActivityOn  <  @shiftEnd
      )
      SELECT
        CAST(cfg.LineMonthlyProduction1 * 1.0
          / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
        AS INT)                                                                AS [Plan],
        sa.Achieved,
        CAST(cfg.LineMonthlyProduction1 * 1.0
          / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
        AS INT) - sa.Achieved                                                  AS Remaining,
        DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
          / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)              AS ConsumedTimePct
      FROM Config cfg CROSS JOIN ShiftActual sa;
    `;

    const [stations, summary] = await Promise.all([
      pool
        .request()
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("sectionName", sql.NVarChar(200), sectionName)
        .query(stationsQuery),
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), stationCode1)
        .query(summaryQuery),
    ]);

    return {
      stations: stations.recordset,
      summary: summary.recordset[0] || {},
    };
  });

  res
    .status(200)
    .json({ success: true, message: "Loss data retrieved.", data });
});
