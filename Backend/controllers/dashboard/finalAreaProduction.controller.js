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
    const start = new Date(base); start.setHours(8, 0, 0, 0);
    const end   = new Date(base); end.setHours(20, 0, 0, 0);
    return { shiftStart: start, shiftEnd: end };
  }
  const start = new Date(base); start.setHours(20, 0, 0, 0);
  const end   = new Date(base); end.setDate(base.getDate() + 1); end.setHours(8, 0, 0, 0);
  return { shiftStart: start, shiftEnd: end };
};

// ─── Shared param validator ───────────────────────────────────────────────────
const validateShiftParams = (req) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);
  return { shiftDate, shift };
};

const WORKING_MINS = 570; // 9.5 hour shift net of breaks

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
  const { id } = req.params;
  const data = await withPool(async (pool) => {
    const result = await pool.request()
      .input("Id", sql.Int, Number(id))
      .query("SELECT * FROM dbo.DashboardConfig WHERE Id = @Id AND IsActive = 1");
    return result.recordset[0] || null;
  });
  if (!data) throw new AppError("Dashboard config not found.", 404);
  res.status(200).json({ success: true, data });
});

// POST /dashboard/configs — create
export const createDashboardConfig = tryCatch(async (req, res) => {
  const {
    dashboardName, lineName, lineCode,
    stationCode1, stationName1, lineTaktTime1, lineMonthlyProduction1, lineTarget1,
    stationCode2, stationName2, lineTaktTime2, lineMonthlyProduction2,
    qualityProcessCode, qualityLineName, sectionName,
  } = req.body;

  if (!dashboardName?.trim()) throw new AppError("Dashboard name is required.", 400);
  if (!stationCode1?.trim()) throw new AppError("Station Code 1 is required.", 400);

  const data = await withPool(async (pool) => {
    const result = await pool.request()
      .input("DashboardName",          sql.NVarChar(120), dashboardName)
      .input("LineName",               sql.NVarChar(100), lineName || "")
      .input("LineCode",               sql.NVarChar(50),  lineCode  || "")
      .input("StationCode1",           sql.NVarChar(50),  stationCode1)
      .input("StationName1",           sql.NVarChar(100), stationName1 || "")
      .input("LineTaktTime1",          sql.Int,           Number(lineTaktTime1) || 40)
      .input("LineMonthlyProduction1", sql.Int,           Number(lineMonthlyProduction1) || 0)
      .input("LineTarget1",            sql.Int,           Number(lineTarget1) || 0)
      .input("StationCode2",           sql.NVarChar(50),  stationCode2 || null)
      .input("StationName2",           sql.NVarChar(100), stationName2 || null)
      .input("LineTaktTime2",          sql.Int,           Number(lineTaktTime2) || null)
      .input("LineMonthlyProduction2", sql.Int,           Number(lineMonthlyProduction2) || null)
      .input("QualityProcessCode",     sql.NVarChar(500), qualityProcessCode || null)
      .input("QualityLineName",        sql.NVarChar(100), qualityLineName || null)
      .input("SectionName",            sql.NVarChar(200), sectionName || null)
      .query(`
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

  res.status(201).json({ success: true, message: "Dashboard config created.", data });
});

// PUT /dashboard/configs/:id — update
export const updateDashboardConfig = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    dashboardName, lineName, lineCode,
    stationCode1, stationName1, lineTaktTime1, lineMonthlyProduction1, lineTarget1,
    stationCode2, stationName2, lineTaktTime2, lineMonthlyProduction2,
    qualityProcessCode, qualityLineName, sectionName,
  } = req.body;

  const data = await withPool(async (pool) => {
    const result = await pool.request()
      .input("Id",                     sql.Int,           Number(id))
      .input("DashboardName",          sql.NVarChar(120), dashboardName)
      .input("LineName",               sql.NVarChar(100), lineName || "")
      .input("LineCode",               sql.NVarChar(50),  lineCode  || "")
      .input("StationCode1",           sql.NVarChar(50),  stationCode1)
      .input("StationName1",           sql.NVarChar(100), stationName1 || "")
      .input("LineTaktTime1",          sql.Int,           Number(lineTaktTime1) || 40)
      .input("LineMonthlyProduction1", sql.Int,           Number(lineMonthlyProduction1) || 0)
      .input("LineTarget1",            sql.Int,           Number(lineTarget1) || 0)
      .input("StationCode2",           sql.NVarChar(50),  stationCode2 || null)
      .input("StationName2",           sql.NVarChar(100), stationName2 || null)
      .input("LineTaktTime2",          sql.Int,           Number(lineTaktTime2) || null)
      .input("LineMonthlyProduction2", sql.Int,           Number(lineMonthlyProduction2) || null)
      .input("QualityProcessCode",     sql.NVarChar(500), qualityProcessCode || null)
      .input("QualityLineName",        sql.NVarChar(100), qualityLineName || null)
      .input("SectionName",            sql.NVarChar(200), sectionName || null)
      .query(`
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
  res.status(200).json({ success: true, message: "Dashboard config updated.", data });
});

// DELETE /dashboard/configs/:id — soft delete
export const deleteDashboardConfig = tryCatch(async (req, res) => {
  const { id } = req.params;
  await withPool(async (pool) => {
    await pool.request()
      .input("Id", sql.Int, Number(id))
      .query("UPDATE dbo.DashboardConfig SET IsActive = 0 WHERE Id = @Id");
  });
  res.status(200).json({ success: true, message: "Dashboard config deleted." });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD DATA ENDPOINTS  (all dynamic via query params from config)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /dashboard/fg-packing ───────────────────────────────────────────────
// Dynamic params: stationCode1, lineCode, sectionName, lineTaktTime1
export const getFGPackingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const {
    stationCode1  = "1220010",
    lineCode      = "12501",
    sectionName   = "FINAL ASSEMBLY",
    lineTaktTime1 = "40",
  } = req.query;

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0);

  const query = `
    WITH PlanData AS (
      SELECT TOP 1 PlanQty FROM MonthlyPlan
    ),
    ShiftActual AS (
      SELECT COUNT(PSNo) AS PackingTillNow
      FROM ProcessActivity
      WHERE StationCode  = @stationCode1
        AND ActivityType = 5
        AND ActivityOn  >= @shiftStart
        AND ActivityOn  <  @shiftEnd
    ),
    MonthlyActual AS (
      SELECT COUNT(PSNo) AS ActualFG
      FROM ProcessActivity
      WHERE StationCode  = @stationCode1
        AND ActivityType = 5
        AND ActivityOn  >= @monthStart
        AND ActivityOn  <  @monthEnd
    ),
    StopLoss AS (
      SELECT
        ISNULL(SUM(
          CASE WHEN T.EmgOff IS NOT NULL
               THEN DATEDIFF(MINUTE, T.EmgOn, T.EmgOff) ELSE 0 END
        ), 0) AS TotalLossMin,
        COUNT(*)  AS TotalStopCount
      FROM EMGTrans T
      INNER JOIN EMGMaster M
        ON T.PLCCode = M.PLCCode AND T.MEMBit = M.MEMBit AND M.Active = 1
      WHERE T.EmgOff IS NOT NULL
        AND T.EmgOn >= @shiftStart
        AND T.EmgOn <  @shiftEnd
        AND M.Location = @sectionName
    )
    SELECT
      pd.PlanQty                                                               AS MonthlyPlanQty,
      @workingMins                                                             AS WorkingTimeMin,
      @tactTime                                                                AS TactTimeSec,

      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)   AS ShiftOutputTarget,
      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        / NULLIF(CAST(@workingMins AS FLOAT) / 60.0, 0)
      AS INT)                                                                  AS UPHTarget,

      sa.PackingTillNow,
      sl.TotalLossMin                                                          AS LossTime,
      0                                                                        AS LossUnits,

      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)
        - sa.PackingTillNow                                                    AS BalanceQty,

      -- Prorated (time-proportional) target
      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
           / NULLIF(CAST(@workingMins AS FLOAT), 0))
      AS INT)                                                                  AS ProratedTarget,

      -- Performance = Actual / Prorated * 100
      CAST(
        sa.PackingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                         AS PerformancePct,

      CAST(
        sa.PackingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                         AS EfficiencyTillNow,

      CAST(
        sa.PackingTillNow * 60.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
      AS DECIMAL(6,2))                                                         AS ActualUPH,

      sa.PackingTillNow                                                        AS GaugeValue,
      ma.ActualFG                                                              AS MonthlyAchieved,
      pd.PlanQty - ma.ActualFG                                                AS MonthlyRemaining,

      CAST(
        (pd.PlanQty - ma.ActualFG) * 1.0
        / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
      AS INT)                                                                  AS AskingRate,

      DAY(EOMONTH(GETDATE())) - DAY(GETDATE())                                AS RemainingDays

    FROM PlanData    pd
    CROSS JOIN ShiftActual   sa
    CROSS JOIN MonthlyActual ma
    CROSS JOIN StopLoss      sl;
  `;

  const data = await withPool(async (pool) => {
    const r = await pool.request()
      .input("shiftStart",   sql.DateTime, istStart)
      .input("shiftEnd",     sql.DateTime, istEnd)
      .input("workingMins",  sql.Int,      WORKING_MINS)
      .input("monthStart",   sql.DateTime, convertToIST(monthStart.toISOString()))
      .input("monthEnd",     sql.DateTime, convertToIST(monthEnd.toISOString()))
      .input("stationCode1", sql.NVarChar(50),  stationCode1)
      .input("sectionName",  sql.NVarChar(200), sectionName)
      .input("tactTime",     sql.Int,      Number(lineTaktTime1))
      .query(query);
    return r.recordset[0] || null;
  });

  if (!data) throw new AppError("No plan data found for the given shift and date.", 404);
  res.status(200).json({ success: true, message: "FG Packing data retrieved.", data });
});

// ─── GET /dashboard/fg-loading ───────────────────────────────────────────────
// Dynamic params: stationCode2, sectionName, lineTaktTime2
export const getFGLoadingData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const {
    stationCode1  = "1220010",   // monthly actuals still use packing station
    stationCode2  = "1220005",
    sectionName   = "FINAL ASSEMBLY",
    lineTaktTime2 = "40",
  } = req.query;

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0);

  const query = `
    WITH PlanData AS (
      SELECT TOP 1 PlanQty FROM MonthlyPlan
    ),
    ShiftActual AS (
      SELECT COUNT(PSNo) AS LoadingTillNow
      FROM ProcessActivity
      WHERE StationCode  = @stationCode2
        AND ActivityType = 5
        AND ActivityOn  >= @shiftStart
        AND ActivityOn  <  @shiftEnd
    ),
    MonthlyActual AS (
      SELECT COUNT(PSNo) AS ActualFG
      FROM ProcessActivity
      WHERE StationCode  = @stationCode1
        AND ActivityType = 5
        AND ActivityOn  >= @monthStart
        AND ActivityOn  <  @monthEnd
    ),
    StopLoss AS (
      SELECT ISNULL(SUM(
        CASE WHEN T.EmgOff IS NOT NULL
             THEN DATEDIFF(MINUTE, T.EmgOn, T.EmgOff) ELSE 0 END
      ), 0) AS TotalLossMin
      FROM EMGTrans T
      INNER JOIN EMGMaster M
        ON T.PLCCode = M.PLCCode AND T.MEMBit = M.MEMBit AND M.Active = 1
      WHERE T.EmgOff IS NOT NULL
        AND T.EmgOn >= @shiftStart AND T.EmgOn < @shiftEnd
        AND M.Location = @sectionName
    )
    SELECT
      pd.PlanQty                                                               AS MonthlyPlanQty,
      @workingMins                                                             AS WorkingTimeMin,
      @tactTime                                                                AS TactTimeSec,
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)   AS ShiftOutputTarget,
      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        / NULLIF(CAST(@workingMins AS FLOAT) / 60.0, 0)
      AS INT)                                                                  AS UPHTarget,
      sa.LoadingTillNow,
      sl.TotalLossMin                                                          AS LossTime,
      0                                                                        AS LossUnits,
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)
        - sa.LoadingTillNow                                                    AS BalanceQty,
      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
           / NULLIF(CAST(@workingMins AS FLOAT), 0))
      AS INT)                                                                  AS ProratedTarget,
      CAST(
        sa.LoadingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                         AS PerformancePct,
      CAST(
        sa.LoadingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                         AS EfficiencyTillNow,
      CAST(
        sa.LoadingTillNow * 60.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
      AS DECIMAL(6,2))                                                         AS ActualUPH,
      sa.LoadingTillNow                                                        AS GaugeValue,
      ma.ActualFG                                                              AS MonthlyAchieved,
      pd.PlanQty - ma.ActualFG                                                AS MonthlyRemaining,
      CAST(
        (pd.PlanQty - ma.ActualFG) * 1.0
        / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
      AS INT)                                                                  AS AskingRate,
      DAY(EOMONTH(GETDATE())) - DAY(GETDATE())                                AS RemainingDays
    FROM PlanData pd
    CROSS JOIN ShiftActual   sa
    CROSS JOIN MonthlyActual ma
    CROSS JOIN StopLoss      sl;
  `;

  const data = await withPool(async (pool) => {
    const r = await pool.request()
      .input("shiftStart",   sql.DateTime, istStart)
      .input("shiftEnd",     sql.DateTime, istEnd)
      .input("workingMins",  sql.Int,      WORKING_MINS)
      .input("monthStart",   sql.DateTime, convertToIST(monthStart.toISOString()))
      .input("monthEnd",     sql.DateTime, convertToIST(monthEnd.toISOString()))
      .input("stationCode1", sql.NVarChar(50),  stationCode1)
      .input("stationCode2", sql.NVarChar(50),  stationCode2)
      .input("sectionName",  sql.NVarChar(200), sectionName)
      .input("tactTime",     sql.Int,      Number(lineTaktTime2))
      .query(query);
    return r.recordset[0] || null;
  });

  if (!data) throw new AppError("No plan data found for the given shift and date.", 404);
  res.status(200).json({ success: true, message: "FG Loading data retrieved.", data });
});

// ─── GET /dashboard/hourly ────────────────────────────────────────────────────
// Dynamic params: stationCode1, lineCode
export const getHourlyProductionData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const {
    stationCode1 = "1220010",
    lineCode     = "12501",
  } = req.query;

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const hoursQuery = `
    WITH Psno AS (
      SELECT DocNo, Material
      FROM MaterialBarcode
      WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(HOUR, b.ActivityOn)                                          AS TIMEHOUR,
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME)                                                          AS HourTime,
        COUNT(*)                                                              AS Loading_Count
      FROM Psno
      JOIN ProcessActivity  b  ON b.PSNo        = Psno.DocNo
      JOIN WorkCenter       c  ON b.StationCode = c.StationCode
      JOIN Material         m  ON Psno.Material = m.MatCode
      JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
      JOIN Users            u  ON u.UserCode    = b.Operator
      WHERE c.StationCode  = @stationCode1
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
    PlanData AS (
      SELECT TOP 1 PlanQty FROM MonthlyPlan
    ),
    HourlyTarget AS (
      SELECT CAST(
        pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) / 12.0
      AS INT) AS HourTarget
      FROM PlanData pd
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
    FROM HourlySummary  hs
    CROSS JOIN HourlyTarget ht
    ORDER BY hs.HourTime;
  `;

  const summaryQuery = `
    WITH PlanData AS (
      SELECT TOP 1 PlanQty FROM MonthlyPlan
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
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT) AS ShiftPlan,
      sa.TotalAchieved,
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)
        - sa.TotalAchieved                                                  AS Remaining,
      DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)              AS ConsumedTimePct
    FROM PlanData pd CROSS JOIN ShiftActual sa;
  `;

  const data = await withPool(async (pool) => {
    const req1 = pool.request()
      .input("shiftStart",   sql.DateTime,    istStart)
      .input("shiftEnd",     sql.DateTime,    istEnd)
      .input("stationCode1", sql.NVarChar(50), stationCode1)
      .input("lineCode",     sql.NVarChar(50), lineCode);

    const req2 = pool.request()
      .input("shiftStart",   sql.DateTime,    istStart)
      .input("shiftEnd",     sql.DateTime,    istEnd)
      .input("stationCode1", sql.NVarChar(50), stationCode1)
      .input("lineCode",     sql.NVarChar(50), lineCode);

    const [hoursResult, summaryResult] = await Promise.all([
      req1.query(hoursQuery),
      req2.query(summaryQuery),
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

  res.status(200).json({ success: true, message: "Hourly production data retrieved.", data });
});

// ─── GET /dashboard/quality ───────────────────────────────────────────────────
// Dynamic params: stationCode1 (for shift actual), qualityProcessCode (display only)
export const getQualityData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const { stationCode1 = "1220010" } = req.query;

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const summaryQuery = `
    WITH PlanData AS (
      SELECT TOP 1 PlanQty FROM MonthlyPlan
    ),
    ReworkBase AS (
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
    )
    SELECT
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)  AS [Plan],
      sa.TotalAchieved,
      sa.TotalAchieved - (SELECT COUNT(*) FROM ReworkBase)                   AS OkUnit,
      (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Active')       AS DefectUnit,
      (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Closed')       AS ReworkDone,
      CAST(
        (sa.TotalAchieved - (SELECT COUNT(*) FROM ReworkBase)) * 100.0
        / NULLIF(sa.TotalAchieved, 0)
      AS DECIMAL(5,1))                                                        AS OkPct,
      CAST(
        (SELECT COUNT(*) FROM ReworkBase WHERE Rework_Status = 'Active') * 100.0
        / NULLIF(sa.TotalAchieved, 0)
      AS DECIMAL(5,1))                                                        AS DefectPct,
      DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)               AS ConsumedTimePct
    FROM PlanData pd CROSS JOIN ShiftActual sa;
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

  const data = await withPool(async (pool) => {
    const req1 = pool.request()
      .input("shiftStart",   sql.DateTime,    istStart)
      .input("shiftEnd",     sql.DateTime,    istEnd)
      .input("stationCode1", sql.NVarChar(50), stationCode1);

    const req2 = pool.request()
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const [summary, defects] = await Promise.all([
      req1.query(summaryQuery),
      req2.query(defectsQuery),
    ]);

    return { summary: summary.recordset[0] || {}, defects: defects.recordset };
  });

  res.status(200).json({ success: true, message: "Quality data retrieved.", data });
});

// ─── GET /dashboard/loss ──────────────────────────────────────────────────────
// Dynamic params: stationCode1 (shift actual), sectionName (EMGMaster.Location)
export const getLossData = tryCatch(async (req, res) => {
  const { shiftDate, shift } = validateShiftParams(req);
  const {
    stationCode1 = "1220010",
    sectionName  = "FINAL ASSEMBLY",
  } = req.query;

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

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
    WITH PlanData AS (SELECT TOP 1 PlanQty FROM MonthlyPlan),
    ShiftActual AS (
      SELECT COUNT(PSNo) AS Achieved
      FROM ProcessActivity
      WHERE StationCode  = @stationCode1
        AND ActivityType = 5
        AND ActivityOn  >= @shiftStart
        AND ActivityOn  <  @shiftEnd
    )
    SELECT
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT) AS [Plan],
      sa.Achieved,
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)
        - sa.Achieved                                                        AS Remaining,
      DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)              AS ConsumedTimePct
    FROM PlanData pd CROSS JOIN ShiftActual sa;
  `;

  const data = await withPool(async (pool) => {
    const req1 = pool.request()
      .input("shiftStart",  sql.DateTime,    istStart)
      .input("shiftEnd",    sql.DateTime,    istEnd)
      .input("sectionName", sql.NVarChar(200), sectionName);

    const req2 = pool.request()
      .input("shiftStart",   sql.DateTime,    istStart)
      .input("shiftEnd",     sql.DateTime,    istEnd)
      .input("stationCode1", sql.NVarChar(50), stationCode1);

    const [stations, summary] = await Promise.all([
      req1.query(stationsQuery),
      req2.query(summaryQuery),
    ]);

    return { stations: stations.recordset, summary: summary.recordset[0] || {} };
  });

  res.status(200).json({ success: true, message: "Loss data retrieved.", data });
});