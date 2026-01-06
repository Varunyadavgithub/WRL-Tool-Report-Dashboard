import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Utility to replace placeholders safely
const replacePlaceholders = (query, startTime, endTime) => {
  return query
    .replaceAll("{StartTime}", startTime)
    .replaceAll("{EndTime}", endTime);
};

// Final Line
export const getFinalLoadingHPFrz = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
SELECT DocNo, Material, Serial, VSerial, Alias, Type
FROM MaterialBarcode
WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
SELECT 
    DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
        CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN Users u ON b.Operator = u.UserCode
WHERE
    c.StationCode = 1220005 AND
    b.ActivityType = 5 AND
    b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}' 
    AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005)
    And u.UserRole = 225002
GROUP BY 
    DATEPART(DAY, b.ActivityOn), 
    DATEPART(HOUR, b.ActivityOn),
    CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
    CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER, TIMEHOUR, Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP Frz hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Frz hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFinalLoadingHPChoc = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
SELECT DocNo, Material, Serial, VSerial, Alias, Type
FROM MaterialBarcode
WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
SELECT 
    DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
        CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN Users u ON b.Operator = u.UserCode
WHERE
    c.StationCode = 1220005 AND
    b.ActivityType = 5 AND
    b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
AND m.Category in (1240001, 1250005)
And u.UserRole = 225001
GROUP BY 
    DATEPART(DAY, b.ActivityOn), 
    DATEPART(HOUR, b.ActivityOn),
    CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
    CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER, TIMEHOUR, Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;
`;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP Choc hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFinalLoadingHPSUS = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
  WITH Psno AS (
SELECT DocNo, Material, Serial, VSerial, Alias, Type
FROM MaterialBarcode
WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
SELECT 
    DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
        CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN Users u ON b.Operator = u.UserCode
WHERE
    c.StationCode = 1230013 AND
    b.ActivityType = 5 AND
    b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
GROUP BY 
    DATEPART(DAY, b.ActivityOn), 
    DATEPART(HOUR, b.ActivityOn),
    CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
    CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER, TIMEHOUR, Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;
`;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP SUS hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP SUS hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFinalLoadingHPCAT = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT 
    ISNULL(mc.Alias, 'N/A') AS category,
    COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
JOIN WorkCenter c ON b.StationCode = c.StationCode
JOIN Users us ON us.UserCode = b.Operator
JOIN Material m ON m.MatCode = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE b.ActivityType = 5
  AND c.StationCode IN (1230013, 1220005)  
  AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP CAT loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP CAT loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

// Final Line
export const getFinalHPFrz = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias, Type
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
    SELECT 
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
    Join Users u ON u.UserCode = b.Operator
    WHERE
        c.StationCode = 1220010 
        AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005)
        AND u.UserRole = 224006
        AND b.ActivityType = 5 
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}' 
    GROUP BY 
        DATEPART(DAY, b.ActivityOn), 
        DATEPART(HOUR, b.ActivityOn),
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
    TIMEHOUR,
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;

  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP Frz hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Frz hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFinalHPChoc = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias, Type
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
    SELECT 
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
    Join Users u ON u.UserCode = b.Operator
    WHERE
        c.StationCode = 1220010
        AND m.Category in (1240001, 1250005)
        AND u.UserRole = 224007
        AND b.ActivityType = 5 
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
    GROUP BY 
        DATEPART(DAY, b.ActivityOn), 
        DATEPART(HOUR, b.ActivityOn),
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
    TIMEHOUR,
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;
`;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP Choc hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFinalHPSUS = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `  WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias, Type
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
    SELECT 
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
    WHERE
        c.StationCode = 1230017
        AND m.Category in (1230003, 1230004, 1230009, 1230010, 1250004)
        AND b.ActivityType = 5 
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
    GROUP BY 
        DATEPART(DAY, b.ActivityOn), 
        DATEPART(HOUR, b.ActivityOn),
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
    TIMEHOUR,
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;
`;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP SUS hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP SUS hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFinalHPCAT = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT 
    ISNULL(mc.Alias, 'N/A') AS category,
    COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
JOIN WorkCenter c ON b.StationCode = c.StationCode
JOIN Users us ON us.UserCode = b.Operator
JOIN Material m ON m.MatCode = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE b.ActivityType = 5
  AND c.StationCode IN (1220010, 1230017)  
  AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Final HP CAT loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP CAT loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

// Post Foaming
export const getPostHPFrz = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH FilteredActivity AS (
    SELECT 
        CAST(CAST(b.ActivityOn AS DATE) AS DATETIME) AS ActivityDate,
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        m.Category,
        c.StationCode
    FROM MaterialBarcode mb
    JOIN ProcessActivity b ON b.PSNo = mb.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON mb.Material = m.MatCode
    WHERE 
        mb.PrintStatus = 1
        AND mb.Status <> 99
        AND mb.Type NOT IN (200)
        AND b.ActivityType = 5
        AND b.StationCode IN (1220003, 1230007)  -- Group A and CHOC
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
),
Grouped AS (
    SELECT 
        TIMEDAY,
        TIMEHOUR,
        DATEADD(HOUR, TIMEHOUR, ActivityDate) AS HourTime,
        SUM(CASE WHEN StationCode = 1220003 THEN 1 ELSE 0 END) AS GroupA_Count,
        SUM(CASE WHEN StationCode = 1230007 AND Category = 1250005 THEN 1 ELSE 0 END) AS CHOC_Count
    FROM FilteredActivity
    GROUP BY TIMEDAY, TIMEHOUR, ActivityDate
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HourNumber,
    TIMEHOUR,
    GroupA_Count,
    CHOC_Count
FROM Grouped
ORDER BY HourTime;

  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Post Foaming HP Frz hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP Frz hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getManualPostHP = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH FilteredActivity AS (
    SELECT 
        CAST(CAST(b.ActivityOn AS DATE) AS DATETIME) AS ActivityDate,
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        m.Category,
        c.StationCode
    FROM MaterialBarcode mb
    JOIN ProcessActivity b ON b.PSNo = mb.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON mb.Material = m.MatCode
    WHERE 
        mb.PrintStatus = 1
        AND mb.Status <> 99
        AND mb.Type NOT IN (200)
        AND b.ActivityType = 5
        AND b.StationCode IN (1220004, 1230007)  -- Group B and FOW
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
),
Grouped AS (
    SELECT 
        TIMEDAY,
        TIMEHOUR,
        DATEADD(HOUR, TIMEHOUR, ActivityDate) AS HourTime,
        SUM(CASE WHEN StationCode = 1220004 THEN 1 ELSE 0 END) AS GroupB_Count,
        SUM(CASE WHEN StationCode = 1230007 AND Category <> 1250005 THEN 1 ELSE 0 END) AS FOW_Count
    FROM FilteredActivity
    GROUP BY TIMEDAY, TIMEHOUR, ActivityDate
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HourNumber,
    TIMEHOUR,
    GroupB_Count,
    FOW_Count
FROM Grouped
ORDER BY HourTime;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message:
        "Manual Post Foaming HP hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Manual Post Foaming HP hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getPostHPSUS = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias, Type
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
    SELECT 
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN Users u ON b.Operator = u.UserCode
    WHERE
        c.StationCode = 1230012 
        AND b.ActivityType = 5 
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}' 
    GROUP BY 
        DATEPART(DAY, b.ActivityOn), 
        DATEPART(HOUR, b.ActivityOn),
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
    TIMEHOUR,
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;

  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Post Foaming HP SUS hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP SUS hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getPostHPCAT = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
 WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT 
    ISNULL(mc.Alias, 'N/A') AS category,
    COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
JOIN WorkCenter c ON b.StationCode = c.StationCode
JOIN Users us ON us.UserCode = b.Operator
JOIN Material m ON m.MatCode = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE b.ActivityType = 5
  AND c.StationCode IN (1220003, 1220004, 1230012, 1230007)   
  AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Post Foaming HP CAT loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP CAT loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

// Foaming
export const getFoamingHpFomA = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias, Type
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
    SELECT 
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN Users u ON b.Operator = u.UserCode
    WHERE
        c.StationCode = 1220001 
        AND b.ActivityType = 5 
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}' 
    GROUP BY 
        DATEPART(DAY, b.ActivityOn), 
        DATEPART(HOUR, b.ActivityOn),
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
    TIMEHOUR,
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;
    `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Foaming HP FOM A hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP FOM A hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFoamingHpFomB = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias, Type
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
    SELECT 
        DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON Psno.Material = m.MatCode
    JOIN Users u ON b.Operator = u.UserCode
    WHERE
        c.StationCode = 1220002 
        AND b.ActivityType = 5 
        AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}' 
    GROUP BY 
        DATEPART(DAY, b.ActivityOn), 
        DATEPART(HOUR, b.ActivityOn),
        CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
    TIMEHOUR,
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;
    `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Foaming HP FOM B hourly loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP FOM B hourly loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFoamingHpFomCat = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias
    FROM MaterialBarcode
    WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT 
    ISNULL(mc.Alias, 'N/A') AS category,
    COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
JOIN WorkCenter c ON b.StationCode = c.StationCode
JOIN Users us ON us.UserCode = b.Operator
JOIN Material m ON m.MatCode = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE b.ActivityType = 5
  AND c.StationCode IN (1220001, 1220002)      
  AND b.ActivityOn BETWEEN '{StartTime}' AND '{EndTime}'
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .query(replacePlaceholders(query, StartTime, EndTime));

    res.status(200).json({
      success: true,
      message: "Foaming HP FOM CAT loading data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP FOM CAT loading data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
