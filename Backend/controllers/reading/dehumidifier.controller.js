import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

/* =========================================================
   GET MACHINE LIVE STATUS
========================================================= */
export const getDehumidifierStatus = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    const result = await pool.request().query(`
    SELECT 
        M.MachineId,
        M.MachineName,

        H.ActualValue AS Humidity,
        T.ActualValue AS Temperature,

        CASE 
            WHEN H.LastUpdate > T.LastUpdate THEN H.LastUpdate
            ELSE T.LastUpdate
        END AS LastUpdate,

        CASE 
            WHEN DATEDIFF(SECOND,
                CASE WHEN H.LastUpdate > T.LastUpdate THEN H.LastUpdate ELSE T.LastUpdate END,
                GETDATE()) > 30
                THEN 'OFFLINE'
            WHEN H.ActualValue >= 60 THEN 'ALARM'
            WHEN H.ActualValue >= 50 THEN 'WARNING'
            ELSE 'NORMAL'
        END AS Status

    FROM DehumidifierMachines M

    OUTER APPLY (
        SELECT TOP 1 ActualValue, LastUpdate
        FROM DehumidifierLive
        WHERE MachineId=M.MachineId 
        AND MeterType='Humidity'
        AND ValueType='Actual'
        ORDER BY LastUpdate DESC
    ) H

    OUTER APPLY (
        SELECT TOP 1 ActualValue, LastUpdate
        FROM DehumidifierLive
        WHERE MachineId=M.MachineId 
        AND MeterType='Temp'
        AND ValueType='Actual'
        ORDER BY LastUpdate DESC
    ) T

    ORDER BY M.MachineName
    `);

    res.status(200).json({
      success: true,
      message: "Live status fetched",
      data: result.recordset,
    });
  } catch (err) {
    throw new AppError("Failed to fetch dehumidifier status", 500);
  } finally {
    await pool.close();
  }
});

/* =========================================================
   GET MACHINE TREND (24 HR)
========================================================= */
export const getDehumidifierTrend = tryCatch(async (req, res) => {
  const { machineId } = req.query;
  if (!machineId) throw new AppError("MachineId is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    const result = await pool.request().input("machineId", sql.Int, machineId)
      .query(`
        SELECT
            MeterType,
            ValueType,
            ActualValue,
            ReadingTime AS ReadingTimeFull,
            FORMAT(ReadingTime,'HH:mm') AS ReadingTime
        FROM DehumidifierReadings
        WHERE MachineId=@machineId
        AND ReadingTime >= DATEADD(HOUR,-24,GETDATE())
        ORDER BY ReadingTime
      `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } finally {
    await pool.close();
  }
});

export const getDehumidifierSummary = tryCatch(async (req, res) => {
  const { machineId } = req.query;
  if (!machineId) throw new AppError("MachineId required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {

    const request = pool.request();
    request.input("machineId", sql.Int, machineId);

    const result = await request.query(`
DECLARE @now DATETIME = GETDATE();

DECLARE @shiftStart DATETIME;
DECLARE @shiftEnd DATETIME;

------------------------------------------------------------
-- SHIFT LOGIC (08:00–20:00 / 20:00–08:00)
------------------------------------------------------------
IF CAST(@now AS TIME) BETWEEN '08:00:00' AND '19:59:59'
BEGIN
    SET @shiftStart = DATEADD(HOUR,8,CAST(CAST(@now AS DATE) AS DATETIME));
    SET @shiftEnd   = DATEADD(HOUR,20,CAST(CAST(@now AS DATE) AS DATETIME));
END
ELSE
BEGIN
    IF CAST(@now AS TIME) >= '20:00:00'
    BEGIN
        SET @shiftStart = DATEADD(HOUR,20,CAST(CAST(@now AS DATE) AS DATETIME));
        SET @shiftEnd   = DATEADD(HOUR,8,DATEADD(DAY,1,CAST(CAST(@now AS DATE) AS DATETIME)));
    END
    ELSE
    BEGIN
        SET @shiftStart = DATEADD(HOUR,20,DATEADD(DAY,-1,CAST(CAST(@now AS DATE) AS DATETIME)));
        SET @shiftEnd   = DATEADD(HOUR,8,CAST(CAST(@now AS DATE) AS DATETIME));
    END
END;

------------------------------------------------------------
-- SHIFT SUMMARY
------------------------------------------------------------
;WITH ActualData AS (
    SELECT MachineId, MeterType, ActualValue
    FROM DehumidifierReadings
    WHERE MachineId = @machineId
      AND ValueType = 'Actual'
      AND ReadingTime BETWEEN @shiftStart AND @shiftEnd
),

LatestSet AS (
    SELECT MachineId, MeterType, ActualValue,
           ROW_NUMBER() OVER (
                PARTITION BY MachineId, MeterType
                ORDER BY ReadingTime DESC
           ) AS rn
    FROM DehumidifierReadings
    WHERE MachineId = @machineId
      AND ValueType = 'Set'
      AND ReadingTime BETWEEN @shiftStart AND @shiftEnd
)

SELECT
    A.MeterType,
    MAX(A.ActualValue) AS MaxActual,
    MIN(A.ActualValue) AS MinActual,
    S.ActualValue AS SetValue
FROM ActualData A
LEFT JOIN LatestSet S
    ON A.MeterType = S.MeterType
   AND S.rn = 1
GROUP BY A.MeterType, S.ActualValue
ORDER BY A.MeterType;
`);

    res.json({
      success: true,
      message: "Shift summary fetched",
      data: result.recordset,
    });

  } catch (err) {
    console.log(err);
    throw new AppError("Failed to fetch shift summary", 500);
  } finally {
    pool.close();
  }
});

