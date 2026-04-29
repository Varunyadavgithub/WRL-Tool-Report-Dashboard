import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// --- Pool helper --------------------------------------------------------------
const withPool = async (callback) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
};

// --- Shift boundary resolver --------------------------------------------------
const resolveShiftBounds = (shiftDate, shift) => {
  const base = new Date(shiftDate);
  if (shift === "A") {
    const start = new Date(base);
    start.setHours(8, 0, 0, 0);
    const end = new Date(base);
    end.setHours(20, 0, 0, 0);
    return { shiftStart: start, shiftEnd: end };
  }
  // Shift B: 20:00 on shiftDate ? 08:00 next day
  const start = new Date(base);
  start.setHours(20, 0, 0, 0);
  const end = new Date(base);
  end.setDate(base.getDate() + 1);
  end.setHours(8, 0, 0, 0);
  return { shiftStart: start, shiftEnd: end };
};

// --- Shared param validator ---------------------------------------------------
const validateShiftParams = (req) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate)
    throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift))
    throw new AppError("Invalid shift. Must be A or B.", 400);
  return { shiftDate, shift };
};

// --- configId validator -------------------------------------------------------
const validateConfigId = (req) => {
  const { configId } = req.query;
  if (!configId)
    throw new AppError("Missing required query parameter: configId.", 400);
  const id = Number(configId);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("configId must be a positive integer.", 400);
  return id;
};

// --- Config fetcher -----------------------------------------------------------
const getConfig = async (pool, configId) => {
  const result = await pool
    .request()
    .input("Id", sql.Int, configId)
    .query("SELECT * FROM dbo.DashboardConfig WHERE Id = @Id AND IsActive = 1");
  return result.recordset[0] || null;
};

// --- Month boundaries helper --------------------------------------------------
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

// --- Shared FG query builder --------------------------------------------------
// FIX #7: Removed unused shiftActualAlias parameter — it was accepted but never
//         interpolated into the query template, making it dead code.
const buildFGQuery = () => `
  WITH ShiftActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode1)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  @shiftEnd
),
MonthlyActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode1)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @monthStart
      AND ActivityOn  <  @monthEnd
),
HourlyProduction AS (
    SELECT 
        DATEPART(HOUR, ActivityOn) AS Hr,
        COUNT(PSNo) AS HourlyQty
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode1)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  CASE 
                            WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                            ELSE GETDATE() 
                         END
    GROUP BY DATEPART(HOUR, ActivityOn)
),
AvgUPH AS (
    SELECT 
        AVG(CAST(HourlyQty AS FLOAT)) AS AvgUPH
    FROM HourlyProduction
)

SELECT
    dc.LineMonthlyProduction1 AS MonthlyPlanQty,
    dc.WorkingTimeMin,
    dc.LineTaktTime1          AS TactTimeSec,
    -- Actual Working Minutes
    DATEDIFF(
        MINUTE,
        @shiftStart,
        CASE 
            WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
            ELSE GETDATE() 
        END
    ) AS ActualWorkingMin,

    -- Actual Takt Time
    CAST(
        DATEDIFF(
            SECOND,
            @shiftStart,
            CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                ELSE GETDATE() 
            END
        ) * 1.0
        / NULLIF(sa.ActualFG, 0)
    AS DECIMAL(10,2)) AS ActualTaktTimeSec,

    -- Shift Target
    CAST(
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
    AS INT) AS ShiftOutputTarget,

    dc.LineTarget1 AS UPHTarget,

    sa.ActualFG AS ActualQty,

    -- Loss Time
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
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
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

    CAST(au.AvgUPH AS DECIMAL(10,2)) AS ActualUPH_Avg,

    sa.ActualFG AS GaugeValue,
    ma.ActualFG AS MonthlyAchieved,

    dc.LineMonthlyProduction1 - ma.ActualFG AS MonthlyRemaining,

    -- Asking Rate
    CAST(
      (dc.LineMonthlyProduction1 - ma.ActualFG) * 1.0
      / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1, 0)
    AS INT) AS AskingRate,

    DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1 AS RemainingDays,

    -- Time %
    DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
      AS ConsumedTimePct

FROM dbo.DashboardConfig dc
CROSS JOIN ShiftActual   sa
CROSS JOIN MonthlyActual ma
CROSS JOIN AvgUPH au
WHERE dc.Id = @configId;
`;

// --- Shared FG request binder -------------------------------------------------
// FIX #1: Added @currentTime binding — buildFGQuery uses it in 3 places but it
//         was never bound here, causing a SQL runtime "must declare scalar variable" error.
// FIX #2: istStart/istEnd already converted by caller; monthStart/monthEnd still need conversion.
// FIX #3: stationCode1 is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
// FIX #4: lineCode is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
const bindFGRequest = (
  req,
  { configId, lineCode, istStart, istEnd, stationCode1, monthStart, monthEnd },
) => {
  // Cap currentTime at shiftEnd so that viewing a past shift (e.g. yesterday)
  // doesn't compute ActualWorkingMin / UPH from shiftStart all the way to *now*.
  // Without this cap, April 25 Shift A opened on April 26 gives
  //   DATEDIFF(MINUTE, Apr25-08:00, Apr26-09:20) = 1520 instead of 720.
  const now = new Date();
  const cappedCurrentTime = now > istEnd ? istEnd : now;

  return req
    .input("configId", sql.Int, configId)
    .input("lineCode", sql.NVarChar(50), String(lineCode))
    .input("shiftStart", sql.DateTime, istStart)
    .input("shiftEnd", sql.DateTime, istEnd)
    .input("currentTime", sql.DateTime, cappedCurrentTime) // FIX: capped at shiftEnd
    .input("monthStart", sql.DateTime, convertToIST(monthStart))
    .input("monthEnd", sql.DateTime, convertToIST(monthEnd))
    .input("stationCode1", sql.NVarChar(50), String(stationCode1));
};

// --- Loading query builder ----------------------------------------------------
// FIX #7: Removed unused shiftActualAlias parameter.
const buildLoadingQuery = () => `
   WITH ShiftActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode2)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  @shiftEnd
),
MonthlyActual AS (
    SELECT COUNT(PSNo) AS ActualFG
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode2)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @monthStart
      AND ActivityOn  <  @monthEnd
),
HourlyProduction AS (
    SELECT 
        DATEPART(HOUR, ActivityOn) AS Hr,
        COUNT(PSNo) AS HourlyQty
    FROM ProcessActivity
    WHERE StationCode  in (@stationCode2)
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= @shiftStart
      AND ActivityOn  <  CASE 
                            WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                            ELSE GETDATE() 
                         END
    GROUP BY DATEPART(HOUR, ActivityOn)
),
AvgUPH AS (
    SELECT 
        AVG(CAST(HourlyQty AS FLOAT)) AS AvgUPH
    FROM HourlyProduction
)

SELECT
    dc.LineMonthlyProduction1 AS MonthlyPlanQty,
    dc.WorkingTimeMin,
    dc.LineTaktTime1          AS TactTimeSec,
    -- Actual Working Minutes
    DATEDIFF(
        MINUTE,
        @shiftStart,
        CASE 
            WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
            ELSE GETDATE() 
        END
    ) AS ActualWorkingMin,

    -- Actual Takt Time
    CAST(
        DATEDIFF(
            SECOND,
            @shiftStart,
            CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd 
                ELSE GETDATE() 
            END
        ) * 1.0
        / NULLIF(sa.ActualFG, 0)
    AS DECIMAL(10,2)) AS ActualTaktTimeSec,

    -- Shift Target
    CAST(
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
    AS INT) AS ShiftOutputTarget,

    dc.LineTarget1 AS UPHTarget,

    sa.ActualFG AS ActualQty,

    -- Loss Time
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
        ((60.0 / NULLIF(dc.LineTaktTime1, 0)) * dc.WorkingTimeMin) * 0.85
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

    CAST(au.AvgUPH AS DECIMAL(10,2)) AS ActualUPH_Avg,

    sa.ActualFG AS GaugeValue,
    ma.ActualFG AS MonthlyAchieved,

    dc.LineMonthlyProduction1 - ma.ActualFG AS MonthlyRemaining,

    -- Asking Rate
    CAST(
      (dc.LineMonthlyProduction1 - ma.ActualFG) * 1.0
      / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1, 0)
    AS INT) AS AskingRate,

    DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1 AS RemainingDays,

    -- Time %
    DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
      / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
      AS ConsumedTimePct

FROM dbo.DashboardConfig dc
CROSS JOIN ShiftActual   sa
CROSS JOIN MonthlyActual ma
CROSS JOIN AvgUPH au
WHERE dc.Id = @configId;
`;

// --- Loading request binder ---------------------------------------------------
// FIX #5: stationCode2 is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
// FIX #6: lineCode is NVarChar(50) in the DB — was incorrectly bound as sql.Int.
const bindLoadingRequest = (
  req,
  { configId, lineCode, istStart, istEnd, stationCode2, monthStart, monthEnd },
) =>
  req
    .input("configId", sql.Int, configId)
    .input("lineCode", sql.NVarChar(50), String(lineCode)) // FIX #6
    .input("shiftStart", sql.DateTime, istStart)
    .input("shiftEnd", sql.DateTime, istEnd)
    .input("monthStart", sql.DateTime, convertToIST(monthStart))
    .input("monthEnd", sql.DateTime, convertToIST(monthEnd))
    .input("stationCode2", sql.NVarChar(50), String(stationCode2)); // FIX #5

// -------------------------------------------------------------------------------
//  DASHBOARD CONFIG CRUD
// -------------------------------------------------------------------------------

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

// PUT /dashboard/configs/:id — create
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
    workingTimeMin,
    showDisplay1,
    showDisplay2,
    showHourly,
    showQuality,
    showLoss,
  } = req.body;

  // --- Validation -----------------------------------------------
  if (!dashboardName?.trim())
    throw new AppError("Dashboard name is required.", 400);
  if (!stationCode1?.trim())
    throw new AppError("Station Code 1 is required.", 400);

  // Helper: safely parse int, returns fallback if value is not a valid number
  const safeInt = (val, fallback = null) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };

  // Validate optional int fields — reject if provided but not numeric
  const optionalIntFields = {
    lineTaktTime2,
    lineMonthlyProduction2,
    workingTimeMin,
  };

  for (const [fieldName, value] of Object.entries(optionalIntFields)) {
    if (value !== undefined && value !== null && value !== "") {
      if (!Number.isFinite(Number(value))) {
        throw new AppError(
          `${fieldName} must be a valid number, received: "${value}".`,
          400,
        );
      }
    }
  }

  // --- DB Insert ------------------------------------------------
  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("DashboardName", sql.NVarChar(120), dashboardName.trim())
      .input("LineName", sql.NVarChar(100), lineName?.trim() || "")
      .input("LineCode", sql.NVarChar(50), lineCode?.trim() || "")
      .input("StationCode1", sql.NVarChar(50), stationCode1.trim())
      .input("StationName1", sql.NVarChar(100), stationName1?.trim() || "")
      .input("LineTaktTime1", sql.Int, safeInt(lineTaktTime1, 40))
      .input(
        "LineMonthlyProduction1",
        sql.Int,
        safeInt(lineMonthlyProduction1, 0),
      )
      .input("LineTarget1", sql.Int, safeInt(lineTarget1, 0))
      .input("StationCode2", sql.NVarChar(50), stationCode2?.trim() || null)
      .input("StationName2", sql.NVarChar(100), stationName2?.trim() || null)
      .input("LineTaktTime2", sql.Int, safeInt(lineTaktTime2))
      .input("LineMonthlyProduction2", sql.Int, safeInt(lineMonthlyProduction2))
      .input(
        "QualityProcessCode",
        sql.NVarChar(500),
        qualityProcessCode?.trim() || null,
      )
      .input(
        "QualityLineName",
        sql.NVarChar(100),
        qualityLineName?.trim() || null,
      )
      .input("SectionName", sql.NVarChar(200), sectionName?.trim() || null)
      .input("ShowDisplay1", sql.Bit, showDisplay1 ?? true)
      .input("ShowDisplay2", sql.Bit, showDisplay2 ?? true)
      .input("ShowHourly", sql.Bit, showHourly ?? true)
      .input("ShowQuality", sql.Bit, showQuality ?? true)
      .input("ShowLoss", sql.Bit, showLoss ?? true)
      .input("WorkingTimeMin", sql.Int, safeInt(workingTimeMin, 600)).query(`
        DECLARE @tmp TABLE (
          Id                    INT,
          DashboardName         NVARCHAR(120),
          LineName              NVARCHAR(100),
          LineCode              NVARCHAR(50),
          WorkingTimeMin        INT,
          StationCode1          NVARCHAR(50),
          StationName1          NVARCHAR(100),
          LineTaktTime1         INT,
          LineMonthlyProduction1 INT,
          LineTarget1           INT,
          StationCode2          NVARCHAR(50),
          StationName2          NVARCHAR(100),
          LineTaktTime2         INT,
          LineMonthlyProduction2 INT,
          QualityProcessCode    NVARCHAR(500),
          QualityLineName       NVARCHAR(100),
          SectionName           NVARCHAR(200),
          IsActive              BIT,
          CreatedAt             DATETIME,
          UpdatedAt             DATETIME,
          CreatedBy             NVARCHAR(100),
          UpdatedBy             NVARCHAR(100),
          ShowDisplay1 BIT,
          ShowDisplay2 BIT,
          ShowHourly   BIT,
          ShowQuality  BIT,
          ShowLoss     BIT
        );

        INSERT INTO dbo.DashboardConfig (
          DashboardName, LineName, LineCode,
          StationCode1, StationName1, LineTaktTime1, LineMonthlyProduction1, LineTarget1,
          StationCode2, StationName2, LineTaktTime2, LineMonthlyProduction2,
          QualityProcessCode, QualityLineName, SectionName, WorkingTimeMin,
          IsActive, CreatedAt, UpdatedAt,ShowDisplay1 BIT, ShowDisplay2 BIT, ShowHourly   BIT, ShowQuality  BIT, ShowLoss     BIT,
        )
        OUTPUT INSERTED.* INTO @tmp
        VALUES (
          @DashboardName, @LineName, @LineCode,
          @StationCode1, @StationName1, @LineTaktTime1, @LineMonthlyProduction1, @LineTarget1,
          @StationCode2, @StationName2, @LineTaktTime2, @LineMonthlyProduction2,
          @QualityProcessCode, @QualityLineName, @SectionName, @WorkingTimeMin,
          1, GETDATE(), GETDATE(),@ShowDisplay1, @ShowDisplay2, @ShowHourly, @ShowQuality, @ShowLoss,
        );

        SELECT * FROM @tmp;
      `);

    return result.recordset[0];
  });

  res.status(201).json({
    success: true,
    message: "Dashboard config created.",
    data,
  });
});

// PUT /dashboard/configs/:id — update
export const updateDashboardConfig = tryCatch(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid config id.", 400);
  }

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
    workingTimeMin,
    showDisplay1,
    showDisplay2,
    showHourly,
    showQuality,
    showLoss,
  } = req.body;

  // ? Safe validations
  if (!dashboardName || !dashboardName.trim()) {
    throw new AppError("Dashboard name is required.", 400);
  }

  if (!String(stationCode1 || "").trim()) {
    throw new AppError("Station Code 1 is required.", 400);
  }

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .input("DashboardName", sql.NVarChar(120), dashboardName.trim())
      .input("LineName", sql.NVarChar(100), lineName?.trim() || "")
      .input("LineCode", sql.NVarChar(50), lineCode?.trim() || "")
      .input("StationCode1", sql.NVarChar(50), String(stationCode1).trim())
      .input("StationName1", sql.NVarChar(100), stationName1?.trim() || "")
      .input("LineTaktTime1", sql.Int, Number(lineTaktTime1) || 40)
      .input(
        "LineMonthlyProduction1",
        sql.Int,
        Number(lineMonthlyProduction1) || 0,
      )
      .input("LineTarget1", sql.Int, Number(lineTarget1) || 0)
      .input("StationCode2", sql.NVarChar(50), stationCode2?.trim() || null)
      .input("StationName2", sql.NVarChar(100), stationName2?.trim() || null)
      .input("LineTaktTime2", sql.Int, Number(lineTaktTime2) || null)
      .input(
        "LineMonthlyProduction2",
        sql.Int,
        Number(lineMonthlyProduction2) || null,
      )
      .input(
        "QualityProcessCode",
        sql.NVarChar(500),
        qualityProcessCode?.trim() || null,
      )
      .input(
        "QualityLineName",
        sql.NVarChar(100),
        qualityLineName?.trim() || null,
      )
      .input("SectionName", sql.NVarChar(200), sectionName?.trim() || null)
      .input("ShowDisplay1", sql.Bit, showDisplay1 ?? true)
      .input("ShowDisplay2", sql.Bit, showDisplay2 ?? true)
      .input("ShowHourly", sql.Bit, showHourly ?? true)
      .input("ShowQuality", sql.Bit, showQuality ?? true)
      .input("ShowLoss", sql.Bit, showLoss ?? true)
      .input("WorkingTimeMin", sql.Int, Number(workingTimeMin) || 720).query(`
        DECLARE @tmp TABLE (
          Id INT,
          DashboardName NVARCHAR(120),
          LineName NVARCHAR(100),
          LineCode NVARCHAR(50),
          WorkingTimeMin INT,
          StationCode1 NVARCHAR(50),
          StationName1 NVARCHAR(100),
          LineTaktTime1 INT,
          LineMonthlyProduction1 INT,
          LineTarget1 INT,
          StationCode2 NVARCHAR(50),
          StationName2 NVARCHAR(100),
          LineTaktTime2 INT,
          LineMonthlyProduction2 INT,
          QualityProcessCode NVARCHAR(500),
          QualityLineName NVARCHAR(100),
          SectionName NVARCHAR(200),
          IsActive BIT,
          CreatedAt DATETIME,
          UpdatedAt DATETIME,
          ShowDisplay1 BIT,
          ShowDisplay2 BIT,
          ShowHourly   BIT,
          ShowQuality  BIT,
          ShowLoss     BIT
        );

        UPDATE dbo.DashboardConfig
        SET
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
          SectionName            = @SectionName,
          WorkingTimeMin         = @WorkingTimeMin,
          UpdatedAt              = GETDATE(),
          ShowDisplay1 = @ShowDisplay1,
          ShowDisplay2 = @ShowDisplay2,
          ShowHourly   = @ShowHourly,
          ShowQuality  = @ShowQuality,
          ShowLoss     = @ShowLoss
        OUTPUT 
          INSERTED.Id,
          INSERTED.DashboardName,
          INSERTED.LineName,
          INSERTED.LineCode,
          INSERTED.WorkingTimeMin,
          INSERTED.StationCode1,
          INSERTED.StationName1,
          INSERTED.LineTaktTime1,
          INSERTED.LineMonthlyProduction1,
          INSERTED.LineTarget1,
          INSERTED.StationCode2,
          INSERTED.StationName2,
          INSERTED.LineTaktTime2,
          INSERTED.LineMonthlyProduction2,
          INSERTED.QualityProcessCode,
          INSERTED.QualityLineName,
          INSERTED.SectionName,
          INSERTED.IsActive,
          INSERTED.CreatedAt,
          INSERTED.UpdatedAt,
          INSERTED.ShowDisplay1,
          INSERTED.ShowDisplay2,
          INSERTED.ShowHourly,
          INSERTED.ShowQuality,
          INSERTED.ShowLoss
        INTO @tmp
        WHERE Id = @Id AND IsActive = 1;

        SELECT * FROM @tmp;
      `);

    return result.recordset[0] || null;
  });

  if (!data) {
    throw new AppError("Dashboard config not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Dashboard config updated successfully.",
    data,
  });
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
    if (result.recordset.length === 0)
      throw new AppError("Dashboard config not found.", 404);
  });
  res.status(200).json({ success: true, message: "Dashboard config deleted." });
});

// -------------------------------------------------------------------------------
//  DASHBOARD DATA ENDPOINTS
// -------------------------------------------------------------------------------

// --- GET /dashboard/fg-packing -----------------------------------------------
export const getFGPackingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  // FIX #2: Call .toISOString() before passing to convertToIST — every other
  //         handler in this file does this; packing/loading were the odd ones out.
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);
  const { monthStart, monthEnd } = resolveMonthBounds(shiftStart);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const lineCode = config.LineCode;

    const r = await bindFGRequest(pool.request(), {
      configId,
      lineCode,
      istStart,
      istEnd,
      stationCode1,
      monthStart,
      monthEnd,
    }).query(buildFGQuery());

    return r.recordset[0] || null;
  });

  if (!data)
    throw new AppError("No data found for the given shift and date.", 404);
  res
    .status(200)
    .json({ success: true, message: "FG Packing data retrieved.", data });
});

// --- GET /dashboard/fg-loading -----------------------------------------------
export const getFGLoadingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  // FIX #2: Same  fix as getFGPackingData above.
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
    }).query(buildLoadingQuery());

    return r.recordset[0] || null;
  });

  if (!data)
    throw new AppError("No data found for the given shift and date.", 404);
  res
    .status(200)
    .json({ success: true, message: "FG Loading data retrieved.", data });
});

// --- GET /dashboard/hourly ----------------------------------------------------
export const getHourlyProductionData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const lineCode = config.LineCode;

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
                AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
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
              SELECT LineTarget1,LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
            ),
            HourlyTarget AS (
              SELECT
                c.LineTarget1 AS HourTarget
              FROM Config c
            )
      SELECT
        ROW_NUMBER() OVER (ORDER BY hs.HourTime) AS HourNo,
        hs.TIMEHOUR,

        CAST(t.AdjustedTarget AS INT) AS Target,
        hs.Loading_Count AS Actual,

        -- Hour Loss
        CAST(
          CASE 
            WHEN t.AdjustedTarget > hs.Loading_Count
            THEN t.AdjustedTarget - hs.Loading_Count
            ELSE 0
          END AS INT
        ) AS HourLoss,

        -- Cumulative Loss
        CAST(
          SUM(
            CASE 
              WHEN t.AdjustedTarget > hs.Loading_Count
              THEN t.AdjustedTarget - hs.Loading_Count
              ELSE 0
            END
          ) OVER (ORDER BY hs.HourTime ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        AS INT) AS CumulativeLoss,

        -- Achievement %
        CAST(
          hs.Loading_Count * 100.0 /
          NULLIF(t.AdjustedTarget, 0)
        AS DECIMAL(5,1)) AS AchievementPct

      FROM HourlySummary hs
      CROSS JOIN HourlyTarget ht

      CROSS APPLY (
        SELECT 
          CASE 
            WHEN hs.TIMEHOUR = 12 
              THEN ROUND(ht.HourTarget / 2.0, 0)
            ELSE ht.HourTarget
          END AS AdjustedTarget
      ) t

      ORDER BY hs.HourTime;
    `;

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
          AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
          AND b.ActivityType = 5
          AND b.ActivityOn BETWEEN @shiftStart AND @shiftEnd
      )
      SELECT
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT) AS ShiftPlan,

        sa.TotalAchieved,

        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT) - sa.TotalAchieved AS Remaining,

        CAST(
          ROUND(
            DATEDIFF(MINUTE, @shiftStart,
              CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd
                WHEN GETDATE() < @shiftStart THEN @shiftStart
                ELSE GETDATE()
              END
            ) * 100.0
            / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
          , 2)
        AS DECIMAL(5,2)) AS ConsumedTimePct

      FROM Config cfg
      CROSS JOIN ShiftActual sa;
    `;

    const [hoursResult, summaryResult] = await Promise.all([
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), String(stationCode1))
        .input("lineCode", sql.NVarChar(50), String(lineCode))
        .query(hoursQuery),
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), String(stationCode1))
        .input("lineCode", sql.NVarChar(50), String(lineCode))
        .query(summaryQuery),
    ]);

    const hours = hoursResult.recordset.map((row, idx) => ({
      HourNo: idx + 1,
      TIMEHOUR: row.TIMEHOUR,
      TimeLabel: `H${idx + 1}`,
      Target: row.Target,
      Actual: row.Actual,
      HourLoss: row.HourLoss,
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

// --- GET /dashboard/quality ---------------------------------------------------
export const getQualityData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const LineCode = config.LineCode;
    const qualityProcessCode = config.QualityProcessCode;

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
        WHERE StationCode  in (@stationCode1)
          AND ActivityType = 5
          AND Remark IN (SELECT value FROM STRING_SPLIT(@LineCode, ','))
          AND ActivityOn  >= @shiftStart
          AND ActivityOn  <  @shiftEnd
      ),
      Config AS (
        SELECT LineTaktTime1, WorkingTimeMin, LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
      )
      SELECT
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
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
        CAST(
          ROUND(
            DATEDIFF(MINUTE, @shiftStart,
              CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd
                WHEN GETDATE() < @shiftStart THEN @shiftStart
                ELSE GETDATE()
              END
            ) * 100.0
            / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
          , 2)
        AS DECIMAL(5,2)) AS ConsumedTimePct
      FROM Config cfg CROSS JOIN ShiftActual sa;
    `;

    const defectsQuery = `
      WITH ReworkBase AS (
          SELECT dc.Name AS DefectName
          FROM InspectionTrans it
          INNER JOIN InspectionHeader ih
              ON it.InspectionLotNo = ih.InspectionLotNo
          LEFT JOIN InspectionDefect idf
              ON it.ID = idf.ID
          LEFT JOIN DefectCodeMaster dc
              ON idf.Defect = dc.Code
          WHERE it.NextAction = 1
            AND ih.Process IN (SELECT value FROM STRING_SPLIT(@qualityProcessCode, ','))
            AND it.InspectedOn BETWEEN @shiftStart AND @shiftEnd
      )

      SELECT DefectName, COUNT(*) AS DefectCount
      FROM ReworkBase
      WHERE DefectName IS NOT NULL
      GROUP BY DefectName
      ORDER BY DefectCount DESC;
    `;

    const [summary, defects] = await Promise.all([
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), stationCode1)
        .input("LineCode", sql.NVarChar(50), LineCode)
        .query(summaryQuery),
      pool
        .request()
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("qualityProcessCode", sql.NVarChar(50), qualityProcessCode)
        .query(defectsQuery),
    ]);

    return { summary: summary.recordset[0] || {}, defects: defects.recordset };
  });

  res
    .status(200)
    .json({ success: true, message: "Quality data retrieved.", data });
});

// --- GET /dashboard/loss ------------------------------------------------------
export const getLossData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const configId = validateConfigId(req);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart);
  const istEnd = convertToIST(shiftEnd);

  const data = await withPool(async (pool) => {
    const config = await getConfig(pool, configId);
    if (!config) throw new AppError("Dashboard config not found.", 404);

    const stationCode1 = config.StationCode1;
    const LineName = config.LineName;
    const lineCode = config.LineCode;
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
          AND M.LineName = @LineName
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
        SELECT LineTaktTime1, WorkingTimeMin, LineMonthlyProduction1 FROM dbo.DashboardConfig WHERE Id = @configId AND IsActive = 1
      ),
      ShiftActual AS (
        SELECT COUNT(PSNo) AS Achieved
        FROM ProcessActivity
        WHERE StationCode  in (@stationCode1)
          AND ActivityType = 5
          AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
          AND ActivityOn  >= @shiftStart
          AND ActivityOn  <  @shiftEnd
      )
      SELECT
        CAST(
          ((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * 0.85
        AS INT)                                                               AS [Plan],
        sa.Achieved,
        CAST(cfg.LineMonthlyProduction1 * 1.0
          / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
        AS INT) - sa.Achieved                                                  AS Remaining,
        CAST(
          ROUND(
            DATEDIFF(MINUTE, @shiftStart,
              CASE 
                WHEN GETDATE() > @shiftEnd THEN @shiftEnd
                WHEN GETDATE() < @shiftStart THEN @shiftStart
                ELSE GETDATE()
              END
            ) * 100.0
            / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)
          , 2)
        AS DECIMAL(5,2)) AS ConsumedTimePct
      FROM Config cfg CROSS JOIN ShiftActual sa;
    `;

    const [stations, summary] = await Promise.all([
      pool
        .request()
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("sectionName", sql.NVarChar(200), sectionName)
        .input("LineName", sql.NVarChar(50), LineName)
        .query(stationsQuery),
      pool
        .request()
        .input("configId", sql.Int, configId)
        .input("shiftStart", sql.DateTime, istStart)
        .input("shiftEnd", sql.DateTime, istEnd)
        .input("stationCode1", sql.NVarChar(50), stationCode1)
        .input("LineCode", sql.NVarChar(50), lineCode) // FIX #8
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
