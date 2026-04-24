import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// ─── Helper: create and connect a pool ────────────────────────────────────────
const withPool = async (callback) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
};

// ─── Helper: resolve shift boundaries ────────────────────────────────────────
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

const WORKING_MINS = 570;

// ─── GET /dashboard/fg-packing ───────────────────────────────────────────────
export const getFGPackingData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

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
      WHERE StationCode = 1220010
        AND ActivityType = 5
        AND ActivityOn >= @shiftStart
        AND ActivityOn <  @shiftEnd
    ),
    MonthlyActual AS (
      SELECT COUNT(PSNo) AS ActualFG
      FROM ProcessActivity
      WHERE StationCode IN (1220010, 1230017)
        AND ActivityType = 5
        AND ActivityOn >= @monthStart
        AND ActivityOn <  @monthEnd
    ),
    StopLoss AS (
      SELECT
        ISNULL(SUM(
          CASE WHEN T.EmgOff IS NOT NULL
            THEN DATEDIFF(MINUTE, T.EmgOn, T.EmgOff)
            ELSE 0
          END
        ), 0) AS TotalLossMin,
        COUNT(*) AS TotalStopCount
      FROM EMGTrans T
      INNER JOIN EMGMaster M
        ON T.PLCCode = M.PLCCode
       AND T.MEMBit  = M.MEMBit
       AND M.Active  = 1
      WHERE T.EmgOff IS NOT NULL
        AND T.EmgOn >= @shiftStart
        AND T.EmgOn <  @shiftEnd
        AND M.Location = 'Final ASSEMBLY'
    )
    SELECT
      pd.PlanQty                                                            AS MonthlyPlanQty,
      @workingMins                                                          AS WorkingTimeMin,

      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT) AS ShiftOutputTarget,

      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        / NULLIF(CAST(@workingMins AS FLOAT) / 60.0, 0)
      AS INT)                                                               AS UPHTarget,

      sa.PackingTillNow,
      sl.TotalLossMin                                                       AS LossTime,
      0                                                                     AS LossUnits,

      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)
        - sa.PackingTillNow                                                 AS BalanceQty,

      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
           / NULLIF(CAST(@workingMins AS FLOAT), 0))
      AS INT)                                                               AS ProratedTarget,

      CAST(
        sa.PackingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                      AS PerformancePct,

      CAST(
        sa.PackingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                      AS EfficiencyTillNow,

      CAST(
        sa.PackingTillNow * 60.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
      AS DECIMAL(6,2))                                                      AS ActualUPH,

      sa.PackingTillNow                                                     AS GaugeValue,

      ma.ActualFG                                                           AS MonthlyAchieved,
      pd.PlanQty - ma.ActualFG                                             AS MonthlyRemaining,

      CAST(
        (pd.PlanQty - ma.ActualFG) * 1.0
        / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
      AS INT)                                                               AS AskingRate,

      DAY(EOMONTH(GETDATE())) - DAY(GETDATE())                             AS RemainingDays

    FROM PlanData    pd
    CROSS JOIN ShiftActual   sa
    CROSS JOIN MonthlyActual ma
    CROSS JOIN StopLoss      sl;
  `;

  const data = await withPool(async (pool) => {
    const result = await pool.request()
      .input("shiftStart",  sql.DateTime, istStart)
      .input("shiftEnd",    sql.DateTime, istEnd)
      .input("workingMins", sql.Int,      WORKING_MINS)
      .input("monthStart",  sql.DateTime, convertToIST(monthStart.toISOString()))
      .input("monthEnd",    sql.DateTime, convertToIST(monthEnd.toISOString()))
      .query(query);
    return result.recordset[0] || null;
  });

  if (!data) throw new AppError("No plan data found for the given shift and date.", 404);

  res.status(200).json({ success: true, message: "FG Packing data retrieved successfully.", data });
});

// ─── GET /dashboard/fg-loading ───────────────────────────────────────────────
export const getFGLoadingData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

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
      WHERE StationCode = 1230017
        AND ActivityType = 5
        AND ActivityOn >= @shiftStart
        AND ActivityOn <  @shiftEnd
    ),
    MonthlyActual AS (
      SELECT COUNT(PSNo) AS ActualFG
      FROM ProcessActivity
      WHERE StationCode IN (1220010, 1230017)
        AND ActivityType = 5
        AND ActivityOn >= @monthStart
        AND ActivityOn <  @monthEnd
    ),
    StopLoss AS (
      SELECT
        ISNULL(SUM(
          CASE WHEN T.EmgOff IS NOT NULL
            THEN DATEDIFF(MINUTE, T.EmgOn, T.EmgOff)
            ELSE 0
          END
        ), 0) AS TotalLossMin
      FROM EMGTrans T
      INNER JOIN EMGMaster M
        ON T.PLCCode = M.PLCCode
       AND T.MEMBit  = M.MEMBit
       AND M.Active  = 1
      WHERE T.EmgOff IS NOT NULL
        AND T.EmgOn >= @shiftStart
        AND T.EmgOn <  @shiftEnd
        AND M.Location = 'Final ASSEMBLY'
    )
    SELECT
      pd.PlanQty                                                            AS MonthlyPlanQty,
      @workingMins                                                          AS WorkingTimeMin,

      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT) AS ShiftOutputTarget,

      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        / NULLIF(CAST(@workingMins AS FLOAT) / 60.0, 0)
      AS INT)                                                               AS UPHTarget,

      sa.LoadingTillNow,
      sl.TotalLossMin                                                       AS LossTime,
      0                                                                     AS LossUnits,

      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)
        - sa.LoadingTillNow                                                 AS BalanceQty,

      CAST(
        (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
        * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
           / NULLIF(CAST(@workingMins AS FLOAT), 0))
      AS INT)                                                               AS ProratedTarget,

      CAST(
        sa.LoadingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                      AS PerformancePct,

      CAST(
        sa.LoadingTillNow * 100.0
        / NULLIF(
            (pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0))
            * (DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
               / NULLIF(CAST(@workingMins AS FLOAT), 0))
          , 0)
      AS DECIMAL(6,2))                                                      AS EfficiencyTillNow,

      CAST(
        sa.LoadingTillNow * 60.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0)
      AS DECIMAL(6,2))                                                      AS ActualUPH,

      sa.LoadingTillNow                                                     AS GaugeValue,

      ma.ActualFG                                                           AS MonthlyAchieved,
      pd.PlanQty - ma.ActualFG                                             AS MonthlyRemaining,

      CAST(
        (pd.PlanQty - ma.ActualFG) * 1.0
        / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
      AS INT)                                                               AS AskingRate,

      DAY(EOMONTH(GETDATE())) - DAY(GETDATE())                             AS RemainingDays

    FROM PlanData    pd
    CROSS JOIN ShiftActual   sa
    CROSS JOIN MonthlyActual ma
    CROSS JOIN StopLoss      sl;
  `;

  const data = await withPool(async (pool) => {
    const result = await pool.request()
      .input("shiftStart",  sql.DateTime, istStart)
      .input("shiftEnd",    sql.DateTime, istEnd)
      .input("workingMins", sql.Int,      WORKING_MINS)
      .input("monthStart",  sql.DateTime, convertToIST(monthStart.toISOString()))
      .input("monthEnd",    sql.DateTime, convertToIST(monthEnd.toISOString()))
      .query(query);
    return result.recordset[0] || null;
  });

  if (!data) throw new AppError("No plan data found for the given shift and date.", 404);

  res.status(200).json({ success: true, message: "FG Loading data retrieved successfully.", data });
});

// ─── GET /dashboard/hourly ───────────────────────────────────────────────────
export const getHourlyProductionData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

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
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
      FROM Psno
      JOIN ProcessActivity  b  ON b.PSNo        = Psno.DocNo
      JOIN WorkCenter       c  ON b.StationCode = c.StationCode
      JOIN Material         m  ON Psno.Material = m.MatCode
      JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
      JOIN Users            u  ON u.UserCode    = b.Operator
      WHERE c.StationCode  = 1220010
        AND b.Remark       = 12501
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
      SELECT
        CAST(
          pd.PlanQty * 1.0
          / NULLIF(DAY(EOMONTH(@shiftStart)), 0)
          / 12.0
        AS INT) AS HourTarget
      FROM PlanData pd
    )
    SELECT
      ROW_NUMBER() OVER (ORDER BY hs.HourTime)  AS HourNo,
      hs.TIMEHOUR,
      ht.HourTarget                             AS Target,
      hs.Loading_Count                          AS Actual,
      CASE
        WHEN ht.HourTarget > hs.Loading_Count
        THEN ht.HourTarget - hs.Loading_Count
        ELSE 0
      END                                       AS HourLoss,
      SUM(
        CASE
          WHEN ht.HourTarget > hs.Loading_Count
          THEN ht.HourTarget - hs.Loading_Count
          ELSE 0
        END
      ) OVER (ORDER BY hs.HourTime ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                                                AS CumulativeLoss,
      CAST(
        hs.Loading_Count * 100.0
        / NULLIF(ht.HourTarget, 0)
      AS DECIMAL(5,1))                          AS AchievementPct
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
        AND c.StationCode  = 1220010
        AND b.Remark       = 12501
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
    FROM PlanData pd
    CROSS JOIN ShiftActual sa;
  `;

  // FIX: mssql does not allow reusing the same Request object for concurrent queries.
  // Create two separate request objects from the same pool to run queries in parallel.
  const data = await withPool(async (pool) => {
    const req1 = pool.request()
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const req2 = pool.request()
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

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

  res.status(200).json({ success: true, message: "Hourly production data retrieved successfully.", data });
});

// ─── GET /dashboard/quality ──────────────────────────────────────────────────
export const getQualityData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const summaryQuery = `
    WITH PlanData AS (
      SELECT TOP 1 PlanQty FROM MonthlyPlan
    ),
    ReworkBase AS (
      SELECT
        it.ID,
        s.Status AS Rework_Status
      FROM InspectionTrans it
      INNER JOIN InspectionHeader ih ON it.InspectionLotNo = ih.InspectionLotNo
      LEFT  JOIN Status           s  ON ih.Status          = s.ID
      WHERE it.NextAction = 1
        AND it.InspectedOn BETWEEN @shiftStart AND @shiftEnd
    ),
    ShiftActual AS (
      SELECT COUNT(PSNo) AS TotalAchieved
      FROM ProcessActivity
      WHERE StationCode IN (1220010, 1230017)
        AND ActivityType = 5
        AND ActivityOn >= @shiftStart
        AND ActivityOn <  @shiftEnd
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
    FROM PlanData pd
    CROSS JOIN ShiftActual sa;
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

  // FIX: use two separate request objects for parallel queries
  const data = await withPool(async (pool) => {
    const req1 = pool.request()
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const req2 = pool.request()
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const [summary, defects] = await Promise.all([
      req1.query(summaryQuery),
      req2.query(defectsQuery),
    ]);

    return { summary: summary.recordset[0] || {}, defects: defects.recordset };
  });

  res.status(200).json({ success: true, message: "Quality data retrieved successfully.", data });
});

// ─── GET /dashboard/loss ─────────────────────────────────────────────────────
export const getLossData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const stationsQuery = `
    WITH EMG AS (
      SELECT
        T.RefID,
        M.PLCLocation                              AS StationName,
        T.EmgOn,
        T.EmgOff,
        DATEDIFF(SECOND, T.EmgOn, T.EmgOff)       AS TotalSeconds
      FROM EMGTrans T
      INNER JOIN EMGMaster M
        ON T.PLCCode = M.PLCCode
       AND T.MEMBit  = M.MEMBit
       AND M.Active  = 1
      WHERE T.EmgOff IS NOT NULL
        AND T.EmgOn >= @shiftStart
        AND T.EmgOn <  @shiftEnd
        AND M.Location = 'Final ASSEMBLY'
    ),
    BREAKS AS (
      SELECT
        CAST(CAST(@shiftStart AS DATE) AS DATETIME)
          + CAST(StartTime AS DATETIME) AS BreakStart,
        CAST(CAST(@shiftStart AS DATE) AS DATETIME)
          + CAST(EndTime   AS DATETIME) AS BreakEnd
      FROM ShiftBreaks
    ),
    CALC AS (
      SELECT
        E.RefID,
        E.StationName,
        E.TotalSeconds,
        ISNULL(SUM(
          CASE
            WHEN B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
            THEN DATEDIFF(SECOND,
              CASE WHEN E.EmgOn  > B.BreakStart THEN E.EmgOn  ELSE B.BreakStart END,
              CASE WHEN E.EmgOff < B.BreakEnd   THEN E.EmgOff ELSE B.BreakEnd   END
            )
            ELSE 0
          END
        ), 0) AS BreakSeconds
      FROM EMG E
      CROSS JOIN BREAKS B
      GROUP BY E.RefID, E.StationName, E.TotalSeconds
    ),
    FINAL AS (
      SELECT
        StationName,
        (TotalSeconds - BreakSeconds) AS NetSeconds
      FROM CALC
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
    WITH PlanData AS (
      SELECT TOP 1 PlanQty FROM MonthlyPlan
    ),
    ShiftActual AS (
      SELECT COUNT(PSNo) AS Achieved
      FROM ProcessActivity
      WHERE StationCode IN (1220010, 1230017)
        AND ActivityType = 5
        AND ActivityOn >= @shiftStart
        AND ActivityOn <  @shiftEnd
    )
    SELECT
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT) AS [Plan],
      sa.Achieved,
      CAST(pd.PlanQty * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT)
        - sa.Achieved                                                        AS Remaining,
      DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0)              AS ConsumedTimePct
    FROM PlanData pd
    CROSS JOIN ShiftActual sa;
  `;

  // FIX: use two separate request objects for parallel queries
  const data = await withPool(async (pool) => {
    const req1 = pool.request()
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const req2 = pool.request()
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const [stations, summary] = await Promise.all([
      req1.query(stationsQuery),
      req2.query(summaryQuery),
    ]);

    return { stations: stations.recordset, summary: summary.recordset[0] || {} };
  });

  res.status(200).json({ success: true, message: "Loss data retrieved successfully.", data });
});