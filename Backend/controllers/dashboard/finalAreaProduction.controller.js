import sql        from "mssql";
import { dbConfig1 }      from "../../config/db.config.js";
import { tryCatch }       from "../../utils/tryCatch.js";
import { AppError }       from "../../utils/AppError.js";
import { convertToIST }   from "../../utils/convertToIST.js";

// ─── Helper: create and connect a pool ────────────────────────────────────────
const withPool = async (callback) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
};

// ─── Helper: resolve current shift boundaries ─────────────────────────────────
// Shift A: 08:00 – 20:00   |   Shift B: 20:00 – 08:00 (next day)
const resolveShiftBounds = (shiftDate, shift) => {
  const base = new Date(shiftDate);
  if (shift === "A") {
    const start = new Date(base); start.setHours(8, 0, 0, 0);
    const end   = new Date(base); end.setHours(20, 0, 0, 0);
    return { shiftStart: start, shiftEnd: end };
  }
  // Shift B
  const start = new Date(base); start.setHours(20, 0, 0, 0);
  const end   = new Date(base); end.setDate(base.getDate() + 1); end.setHours(8, 0, 0, 0);
  return { shiftStart: start, shiftEnd: end };
};

// ─── GET /production/dashboard/fg-packing ─────────────────────────────────────
// Query params: shiftDate (YYYY-MM-DD), shift (A|B)
export const getFGPackingData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;

  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const query = `
    -- ── Shift-level FG Packing metrics ──────────────────────────────────────
    WITH ShiftPlan AS (
      SELECT
        sp.WorkingTimeMin,
        sp.TactTimeSec,
        sp.ShiftOutputTarget,
        sp.UPHTarget,
        sp.MonthlyPlanQty,
        YEAR(GETDATE())  AS CurrentYear,
        MONTH(GETDATE()) AS CurrentMonth
      FROM ShiftProductionPlan sp
      WHERE sp.Area  = 'FGPacking'
        AND sp.Shift = @shift
        AND MONTH(sp.PlanDate) = MONTH(@shiftStart)
        AND YEAR(sp.PlanDate)  = YEAR(@shiftStart)
    ),
    ActualPacking AS (
      SELECT
        COUNT(DISTINCT pa.SerialNo) AS PackingTillNow,
        SUM(pa.LossUnits)          AS LossUnits,
        SUM(pa.LossTimeMin)        AS LossTime,
        AVG(pa.EfficiencyPct)      AS EfficiencyTillNow,
        COUNT(DISTINCT pa.SerialNo) * 1.0
          / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0) * 60 AS ActualUPH
      FROM PackingActivity pa
      WHERE pa.PackedAt  >= @shiftStart
        AND pa.PackedAt  <  @shiftEnd
        AND pa.Area       = 'FGPacking'
    ),
    MonthlyAchievement AS (
      SELECT
        COUNT(DISTINCT SerialNo) AS MonthlyAchieved
      FROM PackingActivity
      WHERE Area    = 'FGPacking'
        AND MONTH(PackedAt) = MONTH(@shiftStart)
        AND YEAR(PackedAt)  = YEAR(@shiftStart)
    )
    SELECT
      -- plan fields
      sp.WorkingTimeMin,
      sp.TactTimeSec,
      sp.ShiftOutputTarget,
      sp.UPHTarget,
      sp.MonthlyPlanQty,
      -- actual fields
      ap.PackingTillNow,
      ISNULL(ap.LossUnits, 0)    AS LossUnits,
      ISNULL(ap.LossTime,  0)    AS LossTime,
      ROUND(ISNULL(ap.EfficiencyTillNow, 0), 2) AS EfficiencyTillNow,
      ROUND(ISNULL(ap.ActualUPH,         0), 2) AS ActualUPH,
      -- derived
      ISNULL(sp.ShiftOutputTarget, 0) - ISNULL(ap.PackingTillNow, 0) AS BalanceQty,
      CAST(
        ISNULL(ap.PackingTillNow, 0) * 100.0
        / NULLIF(
            -- prorated target = ShiftTarget * (ElapsedMins / WorkingTimeMins)
            sp.ShiftOutputTarget * DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
              / NULLIF(sp.WorkingTimeMin, 0)
            , 0)
      AS DECIMAL(6,2)) AS PerformancePct,
      -- planned qty for prorated target
      CAST(
        sp.ShiftOutputTarget * DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
          / NULLIF(sp.WorkingTimeMin, 0)
      AS INT) AS ProratedTarget,
      -- monthly
      sp.MonthlyPlanQty,
      ma.MonthlyAchieved,
      sp.MonthlyPlanQty - ma.MonthlyAchieved AS MonthlyRemaining,
      -- asking rate = remaining / remaining working days in month (rough)
      CAST(
        (sp.MonthlyPlanQty - ma.MonthlyAchieved) * 1.0
        / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
      AS INT) AS AskingRate,
      DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) AS RemainingDays,
      -- gauge value = actual UPH displayed as 0-1000 range
      CAST(ISNULL(ap.ActualUPH, 0) AS INT) AS GaugeValue
    FROM ShiftPlan  sp
    CROSS JOIN ActualPacking      ap
    CROSS JOIN MonthlyAchievement ma;
  `;

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("shift",      sql.VarChar,  shift)
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd)
      .query(query);
    return result.recordset[0] || null;
  });

  if (!data) throw new AppError("No plan data found for the given shift and date.", 404);

  res.status(200).json({
    success: true,
    message: "FG Packing data retrieved successfully.",
    data,
  });
});

// ─── GET /production/dashboard/fg-loading ─────────────────────────────────────
// Mirrors fg-packing but for the loading area
export const getFGLoadingData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;

  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const query = `
    WITH ShiftPlan AS (
      SELECT
        sp.WorkingTimeMin,
        sp.ShiftOutputTarget,
        sp.UPHTarget,
        sp.MonthlyPlanQty
      FROM ShiftProductionPlan sp
      WHERE sp.Area  = 'FGLoading'
        AND sp.Shift = @shift
        AND MONTH(sp.PlanDate) = MONTH(@shiftStart)
        AND YEAR(sp.PlanDate)  = YEAR(@shiftStart)
    ),
    ActualLoading AS (
      SELECT
        COUNT(DISTINCT la.SerialNo) AS LoadingTillNow,
        SUM(la.LossUnits)           AS LossUnits,
        SUM(la.LossTimeMin)         AS LossTime,
        AVG(la.EfficiencyPct)       AS EfficiencyTillNow,
        COUNT(DISTINCT la.SerialNo) * 1.0
          / NULLIF(DATEDIFF(MINUTE, @shiftStart, GETDATE()), 0) * 60 AS ActualUPH
      FROM LoadingActivity la
      WHERE la.LoadedAt >= @shiftStart
        AND la.LoadedAt <  @shiftEnd
    ),
    MonthlyAchievement AS (
      SELECT COUNT(DISTINCT SerialNo) AS MonthlyAchieved
      FROM   LoadingActivity
      WHERE  MONTH(LoadedAt) = MONTH(@shiftStart)
        AND  YEAR(LoadedAt)  = YEAR(@shiftStart)
    )
    SELECT
      sp.WorkingTimeMin,
      sp.ShiftOutputTarget,
      sp.UPHTarget,
      sp.MonthlyPlanQty,
      al.LoadingTillNow,
      ISNULL(al.LossUnits, 0)             AS LossUnits,
      ISNULL(al.LossTime,  0)             AS LossTime,
      ROUND(ISNULL(al.EfficiencyTillNow, 0), 2) AS EfficiencyTillNow,
      ROUND(ISNULL(al.ActualUPH,         0), 2) AS ActualUPH,
      sp.ShiftOutputTarget - ISNULL(al.LoadingTillNow, 0) AS BalanceQty,
      CAST(
        ISNULL(al.LoadingTillNow, 0) * 100.0
        / NULLIF(
            sp.ShiftOutputTarget * DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
              / NULLIF(sp.WorkingTimeMin, 0)
            , 0)
      AS DECIMAL(6,2)) AS PerformancePct,
      CAST(
        sp.ShiftOutputTarget * DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 1.0
          / NULLIF(sp.WorkingTimeMin, 0)
      AS INT) AS ProratedTarget,
      sp.MonthlyPlanQty,
      ma.MonthlyAchieved,
      sp.MonthlyPlanQty - ma.MonthlyAchieved AS MonthlyRemaining,
      CAST(
        (sp.MonthlyPlanQty - ma.MonthlyAchieved) * 1.0
        / NULLIF(DAY(EOMONTH(GETDATE())) - DAY(GETDATE()), 0)
      AS INT) AS AskingRate,
      DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) AS RemainingDays,
      CAST(ISNULL(al.ActualUPH, 0) AS INT) AS GaugeValue
    FROM ShiftPlan          sp
    CROSS JOIN ActualLoading al
    CROSS JOIN MonthlyAchievement ma;
  `;

  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("shift",      sql.VarChar,  shift)
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd)
      .query(query);
    return result.recordset[0] || null;
  });

  if (!data) throw new AppError("No plan data found for the given shift and date.", 404);

  res.status(200).json({
    success: true,
    message: "FG Loading data retrieved successfully.",
    data,
  });
});

// ─── GET /production/dashboard/hourly ─────────────────────────────────────────
// Returns per-hour target, actual, cumulative loss, and achievement % for the shift
export const getHourlyProductionData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;

  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const query = `
    WITH HourSlots AS (
      -- Generate 12 hour buckets for the shift
      SELECT
        ROW_NUMBER() OVER (ORDER BY n.Number) AS HourNo,
        DATEADD(HOUR, n.Number - 1, @shiftStart) AS HourStart,
        DATEADD(HOUR, n.Number,     @shiftStart) AS HourEnd
      FROM (
        SELECT 1 AS Number UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
        SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL
        SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
        SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
      ) n
    ),
    HourlyPlan AS (
      SELECT
        hp.HourNo,
        hp.HourlyTarget
      FROM HourlyProductionPlan hp
      WHERE hp.Shift = @shift
        AND hp.PlanDate = CAST(@shiftStart AS DATE)
    ),
    HourlyActual AS (
      SELECT
        hs.HourNo,
        COUNT(DISTINCT pa.SerialNo) AS ActualCount,
        ISNULL(SUM(pa.LossUnits), 0) AS HourLossUnits
      FROM HourSlots hs
      LEFT JOIN PackingActivity pa
        ON pa.PackedAt >= hs.HourStart
       AND pa.PackedAt <  hs.HourEnd
       AND pa.PackedAt <  @shiftEnd
      GROUP BY hs.HourNo
    )
    SELECT
      hs.HourNo,
      FORMAT(hs.HourStart, 'h tt')
        + ' – '
        + FORMAT(hs.HourEnd, 'h tt')  AS TimeLabel,
      ISNULL(hp.HourlyTarget, 0)       AS Target,
      ISNULL(ha.ActualCount,  0)       AS Actual,
      ISNULL(ha.HourLossUnits, 0)      AS HourLoss,
      -- cumulative loss
      SUM(ISNULL(ha.HourLossUnits, 0)) OVER (
        ORDER BY hs.HourNo
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS CumulativeLoss,
      -- achievement %
      CAST(
        ISNULL(ha.ActualCount, 0) * 100.0
        / NULLIF(hp.HourlyTarget, 0)
      AS DECIMAL(5,1)) AS AchievementPct
    FROM HourSlots          hs
    LEFT JOIN HourlyPlan    hp ON hp.HourNo = hs.HourNo
    LEFT JOIN HourlyActual  ha ON ha.HourNo = hs.HourNo
    ORDER BY hs.HourNo ASC;
  `;

  // ── Summary totals
  const summaryQuery = `
    SELECT
      (SELECT ISNULL(SUM(HourlyTarget), 0) FROM HourlyProductionPlan
        WHERE Shift = @shift AND PlanDate = CAST(@shiftStart AS DATE)) AS ShiftPlan,
      COUNT(DISTINCT SerialNo) AS TotalAchieved,
      (SELECT ISNULL(SUM(HourlyTarget), 0) FROM HourlyProductionPlan
        WHERE Shift = @shift AND PlanDate = CAST(@shiftStart AS DATE))
        - COUNT(DISTINCT SerialNo) AS Remaining,
      DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0) AS ConsumedTimePct
    FROM PackingActivity
    WHERE PackedAt >= @shiftStart
      AND PackedAt <  @shiftEnd;
  `;

  const data = await withPool(async (pool) => {
    const request = pool
      .request()
      .input("shift",      sql.VarChar,  shift)
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const [hours, summary] = await Promise.all([
      request.query(query),
      request.query(summaryQuery),
    ]);

    return {
      hours:   hours.recordset,
      summary: summary.recordset[0] || {},
    };
  });

  res.status(200).json({
    success: true,
    message: "Hourly production data retrieved successfully.",
    data,
  });
});

// ─── GET /production/dashboard/quality ────────────────────────────────────────
export const getQualityData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;

  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  // ── Main quality summary
  const summaryQuery = `
    SELECT
      (SELECT TOP 1 ShiftOutputTarget FROM ShiftProductionPlan
        WHERE Area = 'FGPacking' AND Shift = @shift
          AND MONTH(PlanDate) = MONTH(@shiftStart)
          AND YEAR(PlanDate)  = YEAR(@shiftStart)) AS Plan,
      COUNT(DISTINCT qi.SerialNo)                        AS TotalAchieved,
      SUM(CASE WHEN qi.InspectionResult = 'OK'     THEN 1 ELSE 0 END) AS OkUnit,
      SUM(CASE WHEN qi.InspectionResult = 'Defect' THEN 1 ELSE 0 END) AS DefectUnit,
      SUM(CASE WHEN qi.InspectionResult = 'Rework' THEN 1 ELSE 0 END) AS ReworkDone,
      CAST(
        SUM(CASE WHEN qi.InspectionResult = 'OK' THEN 1 ELSE 0 END) * 100.0
        / NULLIF(COUNT(DISTINCT qi.SerialNo), 0)
      AS DECIMAL(5,1)) AS OkPct,
      CAST(
        SUM(CASE WHEN qi.InspectionResult = 'Defect' THEN 1 ELSE 0 END) * 100.0
        / NULLIF(COUNT(DISTINCT qi.SerialNo), 0)
      AS DECIMAL(5,1)) AS DefectPct,
      DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0) AS ConsumedTimePct
    FROM QualityInspection qi
    WHERE qi.InspectedAt >= @shiftStart
      AND qi.InspectedAt <  @shiftEnd
      AND qi.Shift        = @shift;
  `;

  // ── Top 3 defects
  const defectsQuery = `
    SELECT TOP 3
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS SrNo,
      dd.DefectDescription                         AS DefectName,
      COUNT(*)                                     AS DefectCount
    FROM QualityInspection qi
    JOIN DefectDetail dd ON dd.DefectID = qi.DefectID
    WHERE qi.InspectedAt >= @shiftStart
      AND qi.InspectedAt <  @shiftEnd
      AND qi.Shift         = @shift
      AND qi.InspectionResult = 'Defect'
    GROUP BY dd.DefectDescription
    ORDER BY COUNT(*) DESC;
  `;

  const data = await withPool(async (pool) => {
    const req2 = pool
      .request()
      .input("shift",      sql.VarChar,  shift)
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const [summary, defects] = await Promise.all([
      req2.query(summaryQuery),
      req2.query(defectsQuery),
    ]);

    return {
      summary: summary.recordset[0] || {},
      defects: defects.recordset,
    };
  });

  res.status(200).json({
    success: true,
    message: "Quality data retrieved successfully.",
    data,
  });
});

// ─── GET /production/dashboard/loss ───────────────────────────────────────────
export const getLossData = tryCatch(async (req, res) => {
  const { shiftDate, shift = "A" } = req.query;

  if (!shiftDate) throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift)) throw new AppError("Invalid shift. Must be A or B.", 400);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  const istStart = convertToIST(shiftStart.toISOString());
  const istEnd   = convertToIST(shiftEnd.toISOString());

  const query = `
    SELECT
      ws.StationName,
      ISNULL(SUM(CASE WHEN pl.StopEndAt IS NOT NULL
        THEN DATEDIFF(MINUTE, pl.StopStartAt, pl.StopEndAt) ELSE 0 END), 0) AS TotalStopTime,
      COUNT(pl.LossID)                                                        AS TotalStopCount
    FROM WorkStation ws
    LEFT JOIN ProductionLoss pl
      ON pl.StationID  = ws.StationID
     AND pl.StopStartAt >= @shiftStart
     AND pl.StopStartAt <  @shiftEnd
    WHERE ws.Area = 'FinalArea'
    GROUP BY ws.StationName
    ORDER BY TotalStopTime DESC;
  `;

  const summaryQuery = `
    SELECT
      (SELECT TOP 1 ShiftOutputTarget FROM ShiftProductionPlan
        WHERE Area = 'FGPacking' AND Shift = @shift
          AND MONTH(PlanDate) = MONTH(@shiftStart)
          AND YEAR(PlanDate)  = YEAR(@shiftStart)) AS Plan,
      COUNT(DISTINCT pa.SerialNo) AS Achieved,
      (SELECT TOP 1 ShiftOutputTarget FROM ShiftProductionPlan
        WHERE Area = 'FGPacking' AND Shift = @shift
          AND MONTH(PlanDate) = MONTH(@shiftStart)
          AND YEAR(PlanDate)  = YEAR(@shiftStart))
        - COUNT(DISTINCT pa.SerialNo) AS Remaining,
      DATEDIFF(MINUTE, @shiftStart, GETDATE()) * 100.0
        / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0) AS ConsumedTimePct
    FROM PackingActivity pa
    WHERE pa.PackedAt >= @shiftStart
      AND pa.PackedAt <  @shiftEnd;
  `;

  const data = await withPool(async (pool) => {
    const req2 = pool
      .request()
      .input("shift",      sql.VarChar,  shift)
      .input("shiftStart", sql.DateTime, istStart)
      .input("shiftEnd",   sql.DateTime, istEnd);

    const [stations, summary] = await Promise.all([
      req2.query(query),
      req2.query(summaryQuery),
    ]);

    return {
      stations: stations.recordset,
      summary:  summary.recordset[0] || {},
    };
  });

  res.status(200).json({
    success: true,
    message: "Loss data retrieved successfully.",
    data,
  });
});