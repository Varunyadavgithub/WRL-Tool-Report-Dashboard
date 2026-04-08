import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// ─── Production Line Remark Mappings ──────────────────────────────────────────

/**
 * Maps a frontend `line` value to the SQL remark condition fragment.
 *
 * Extend this object whenever a new production line is added.
 * Keys should exactly match the `value` sent from the frontend dropdown.
// ─── Shared DB Helper ─────────────────────────────────────────────────────────

/**
 * Opens a pooled connection, runs a query, closes the pool, and returns the recordset.
 * Throws AppError on failure so tryCatch middleware can handle it.
 */
const runQuery = async (queryFn) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await queryFn(pool);
  } catch (err) {
    throw new AppError(`Database error: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
};

// ─── Common Param Validation ──────────────────────────────────────────────────

const validateParams = (stationCode, startDate, endDate, linecode) => {
  if (!stationCode || !startDate || !endDate || !linecode) {
    throw new AppError(
      "Missing required parameters: stationCode, startDate, endDate.",
      400
    );
  }
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /prod/hourly-summary
 * Fetches total production count grouped by hour.
 */
export const getHourlySummary = tryCatch(async (req, res) => {
  const { stationCode, startDate, endDate, model, linecode } = req.query;
  validateParams(stationCode, startDate, endDate, linecode);

  const istStart = convertToIST(startDate);
  const istEnd   = convertToIST(endDate);
  const hasModel = model && model !== "0";

  const query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Alias, Type
      FROM   MaterialBarcode
      WHERE  PrintStatus = 1
        AND  Status <> 99
        AND  Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR)  + ':00:00'
        AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
      FROM   Psno
        JOIN ProcessActivity b  ON b.PSNo        = Psno.DocNo
        JOIN WorkCenter       c  ON b.StationCode = c.StationCode
        JOIN Material         m  ON Psno.Material = m.MatCode
        JOIN Users            u  ON b.Operator    = u.UserCode
      WHERE  c.StationCode = @stationCode
        AND  b.ActivityType = 5
        AND  b.ActivityOn BETWEEN @startDate AND @endDate
        ${hasModel ? "AND Psno.Material = @model" : ""}
        AND b.remark = @linecode
      GROUP BY
        DATEPART(DAY,  b.ActivityOn),
        DATEPART(HOUR, b.ActivityOn),
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME)
    )
    SELECT
      CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
      TIMEHOUR,
      Loading_Count AS COUNT
    FROM  HourlySummary
    ORDER BY HourTime;
  `;

  const data = await runQuery(async (pool) => {
    // FIX: renamed inner variable to avoid shadowing the outer `req` (Express request)
    const dbReq = pool
      .request()
      .input("stationCode", sql.Int,      parseInt(stationCode))
      .input("linecode", sql.Int,      parseInt(linecode))
      .input("startDate",   sql.DateTime, istStart)
      .input("endDate",     sql.DateTime, istEnd);

    if (hasModel) dbReq.input("model", sql.VarChar, model);

    const result = await dbReq.query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "Hourly summary fetched successfully",
    data,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /prod/hourly-model-count
 * Fetches production count grouped by hour + model variant.
 */
export const getHourlyModelCount = tryCatch(async (req, res) => {
  const { stationCode, startDate, endDate, model, linecode  } = req.query;
  validateParams(stationCode, startDate, endDate, linecode);

  const istStart = convertToIST(startDate);
  const istEnd   = convertToIST(endDate);
  const hasModel = model && model !== "0";

  const query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Alias, Type
      FROM   MaterialBarcode
      WHERE  PrintStatus = 1
        AND  Status <> 99
        AND  Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        m.Name                        AS Material_Name,
        COUNT(*)                      AS Loading_Count
      FROM   Psno
        JOIN ProcessActivity b  ON b.PSNo        = Psno.DocNo
        JOIN WorkCenter       c  ON b.StationCode = c.StationCode
        JOIN Material         m  ON Psno.Material = m.MatCode
        JOIN Users            u  ON b.Operator    = u.UserCode
      WHERE  c.StationCode = @stationCode
        AND  b.ActivityType = 5
        AND  b.ActivityOn BETWEEN @startDate AND @endDate
        ${hasModel ? "AND Psno.Material = @model" : ""}
        AND b.remark = @linecode
      GROUP BY
        DATEPART(HOUR, b.ActivityOn),
        m.Name
    )
    SELECT TIMEHOUR, Material_Name, Loading_Count AS COUNT
    FROM   HourlySummary
    ORDER  BY TIMEHOUR, Material_Name;
  `;

  const data = await runQuery(async (pool) => {
    // FIX: renamed inner variable to avoid shadowing the outer `req` (Express request)
    const dbReq = pool
      .request()
      .input("stationCode", sql.Int,      parseInt(stationCode))
      .input("linecode", sql.Int,      parseInt(linecode))
      .input("startDate",   sql.DateTime, istStart)
      .input("endDate",     sql.DateTime, istEnd);

    if (hasModel) dbReq.input("model", sql.VarChar, model);

    const result = await dbReq.query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "Hourly model count fetched successfully",
    data,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /prod/hourly-category-count
 * Fetches production count grouped by hour + product category.
 */
export const getHourlyCategoryCount = tryCatch(async (req, res) => {
  const { stationCode, startDate, endDate, model, linecode } = req.query;
  validateParams(stationCode, startDate, endDate, linecode);

  const istStart = convertToIST(startDate);
  const istEnd   = convertToIST(endDate);
  const hasModel = model && model !== "0";

  const query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Alias, Type
      FROM   MaterialBarcode
      WHERE  PrintStatus = 1
        AND  Status <> 99
        AND  Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        mc.Alias                      AS category,
        COUNT(*)                      AS Loading_Count
      FROM   Psno
        JOIN ProcessActivity  b   ON b.PSNo          = Psno.DocNo
        JOIN WorkCenter        c   ON b.StationCode   = c.StationCode
        JOIN Material          m   ON Psno.Material   = m.MatCode
        JOIN Users             u   ON b.Operator      = u.UserCode
        JOIN MaterialCategory  mc  ON mc.CategoryCode = m.Category
      WHERE  c.StationCode = @stationCode
        AND  b.ActivityType = 5
        AND  b.ActivityOn BETWEEN @startDate AND @endDate
        ${hasModel ? "AND Psno.Material = @model" : ""}
        AND b.remark = @linecode
      GROUP BY
        DATEPART(HOUR, b.ActivityOn),
        mc.Alias
    )
    SELECT TIMEHOUR, category, Loading_Count AS COUNT
    FROM   HourlySummary
    ORDER  BY TIMEHOUR, category;
  `;

  const data = await runQuery(async (pool) => {
    // FIX: renamed inner variable to avoid shadowing the outer `req` (Express request)
    const dbReq = pool
      .request()
      .input("stationCode", sql.Int,      parseInt(stationCode))
      .input("linecode", sql.Int,      parseInt(linecode))
      .input("startDate",   sql.DateTime, istStart)
      .input("endDate",     sql.DateTime, istEnd);

    if (hasModel) dbReq.input("model", sql.VarChar, model);

    const result = await dbReq.query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "Hourly category count fetched successfully",
    data,
  });
});