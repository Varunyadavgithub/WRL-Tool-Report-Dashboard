import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

export const getLptModelSummary = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const isStart = convertToIST(startDate);
  const isEnd = convertToIST(endDate);

  const query = `
    WITH FPA_COMPUTED AS (
      SELECT
        c.Name AS ModelName,
        cnt.ModelCount,
        CASE
          WHEN cnt.ModelCount <= 10 THEN 0
          ELSE CEILING((cnt.ModelCount - 10) / 10.0)
        END AS LPT
      FROM (
        SELECT b.Material, COUNT(*) AS ModelCount
        FROM ProcessActivity a
        INNER JOIN MaterialBarcode b ON a.PSNo = b.DocNo
        WHERE
          a.StationCode IN (1220014)
          AND a.ActivityType = 5
          AND a.ActivityOn BETWEEN @startDate AND @endDate
          AND b.Type NOT IN (0, 200)
        GROUP BY b.Material
      ) AS cnt
      INNER JOIN Material c ON cnt.Material = c.MatCode
    ),
    SAMPLE_INSPECTED AS (
      SELECT ModelName, COUNT(DISTINCT AssemblyNo) AS SampleInspected
      FROM LPTReport
      WHERE DateTime BETWEEN @startDate AND @endDate
      GROUP BY ModelName
    )
    SELECT
      f.ModelName,
      f.ModelCount,
      f.LPT,
      ISNULL(s.SampleInspected, 0) AS SampleInspected,
      (f.LPT - ISNULL(s.SampleInspected, 0)) AS PendingSample,
      CAST((ISNULL(s.SampleInspected, 0) * 100.0) / NULLIF(f.LPT, 0) AS DECIMAL(5,2)) AS LPT_Percentage
    FROM FPA_COMPUTED f
    LEFT JOIN SAMPLE_INSPECTED s ON f.ModelName = s.ModelName
    WHERE f.LPT > 0
    ORDER BY f.ModelCount;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, isStart)
      .input("endDate", sql.DateTime, isEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "LPT Model Summary retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch LPT Model Summary: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getLptReport = tryCatch(async (req, res) => {
  const { startDate, endDate, model, lptType } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const isStart = convertToIST(startDate);
  const isEnd = convertToIST(endDate);

  let query = `
    SELECT *
    FROM LPTReport
    WHERE DateTime BETWEEN @startDate AND @endDate
  `;

  if (model) {
    query += " AND Model=@model";
  }

  if (lptType && lptType !== "All") {
    query += " AND LPTType=@lptType";
  }

  query += " ORDER BY DateTime DESC";

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = await pool
      .request()
      .input("startDate", sql.DateTime, isStart)
      .input("endDate", sql.DateTime, isEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
    }

    if (lptType && lptType !== "All") {
      request.input("lptType", sql.VarChar, lptType);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "LPT Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the LPT Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
