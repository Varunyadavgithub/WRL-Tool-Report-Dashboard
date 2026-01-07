import fs from "fs";
import path from "path";
import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Path where defect images are uploaded
const uploadDir = path.join(process.cwd(), "uploads/FpaDefectImages");

export const getFpaReport = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  let query = `
    SELECT * 
    FROM FPAReport 
    WHERE Date BETWEEN @startDate AND @endDate
  `;

  if (model) {
    query += " AND Model=@model";
  }

  query += " ORDER BY Date DESC";

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "FPA Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPA Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFpaDailyReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const query = `
WITH ShiftedData AS (
    SELECT 
        -- Adjust the shift date: if time is before 8 AM, subtract 1 day
        CASE 
            WHEN CAST(Date AS TIME) < '08:00:00' 
                THEN CAST(DATEADD(DAY, -1, CAST(Date AS DATE)) AS DATE)
            ELSE CAST(Date AS DATE)
        END AS ShiftDate,
        DATENAME(MONTH, Date) AS Month,
        Category,
        FGSRNo
    FROM FPAReport
	WHERE Date >= @startDate AND Date < @endDate
),
Summary AS (
    SELECT
        ShiftDate,
        MAX(Month) AS Month,
        SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS NoOfCritical,
        SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) AS NoOfMajor,
        SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) AS NoOfMinor,
        COUNT(DISTINCT FGSRNo) AS SampleInspected
    FROM ShiftedData
    GROUP BY ShiftDate
)
SELECT
    ShiftDate,
    Month,
    NoOfCritical,
    NoOfMajor,
    NoOfMinor,
    SampleInspected,
    CAST(
        (
            (NoOfCritical * 9.0) + 
            (NoOfMajor * 6.0) + 
            (NoOfMinor * 1.0)
        ) / NULLIF(SampleInspected, 0) AS DECIMAL(10, 3)
    ) AS FPQI
FROM Summary
ORDER BY ShiftDate DESC;

  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FPA Daily Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPA Daily Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFpaMonthlyReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const query = `
WITH ShiftedData AS (
    SELECT 
        -- Adjust the shift date: if time is before 8 AM, subtract 1 day
        CASE 
            WHEN CAST(Date AS TIME) < '08:00:00' 
                THEN DATEADD(DAY, -1, CAST(Date AS DATE))
            ELSE CAST(Date AS DATE)
        END AS ShiftDate,
        FORMAT(Date, 'yyyy-MM') AS MonthKey,  -- e.g., 2025-06
        DATENAME(MONTH, Date) AS MonthName,
        Category,
        FGSRNo
    FROM FPAReport
    WHERE Date >= @startDate AND Date < @endDate
),
Summary AS (
    SELECT
        MonthKey,
        MAX(MonthName) AS Month,  -- for display
        SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS NoOfCritical,
        SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) AS NoOfMajor,
        SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) AS NoOfMinor,
        COUNT(DISTINCT FGSRNo) AS SampleInspected
    FROM ShiftedData
    GROUP BY MonthKey
)
SELECT
    MonthKey,
    Month,
    NoOfCritical,
    NoOfMajor,
    NoOfMinor,
    SampleInspected,
    CAST(
        (
            (NoOfCritical * 9.0) + 
            (NoOfMajor * 6.0) + 
            (NoOfMinor * 1.0)
        ) / NULLIF(SampleInspected, 0) AS DECIMAL(10, 3)
    ) AS FPQI
FROM Summary
ORDER BY MonthKey DESC;

  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FPA Monthly Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPA Monthly Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFpaYearlyReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const query = `
WITH ShiftedData AS (
    SELECT 
        -- Adjust the shift date: if time is before 8 AM, subtract 1 day
        CASE 
            WHEN CAST(Date AS TIME) < '08:00:00' 
                THEN DATEADD(DAY, -1, CAST(Date AS DATE))
            ELSE CAST(Date AS DATE)
        END AS ShiftDate,
        YEAR(Date) AS Year,
        Category,
        FGSRNo
    FROM FPAReport
    WHERE Date >= @startDate AND Date < @endDate
),
Summary AS (
    SELECT
        Year,
        SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS NoOfCritical,
        SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) AS NoOfMajor,
        SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) AS NoOfMinor,
        COUNT(DISTINCT FGSRNo) AS SampleInspected
    FROM ShiftedData
    GROUP BY Year
)
SELECT
    Year,
    NoOfCritical,
    NoOfMajor,
    NoOfMinor,
    SampleInspected,
    CAST(
        (
            (NoOfCritical * 9.0) + 
            (NoOfMajor * 6.0) + 
            (NoOfMinor * 1.0)
        ) / NULLIF(SampleInspected, 0) AS DECIMAL(10, 3)
    ) AS FPQI
FROM Summary
ORDER BY Year DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FPA Yearly Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPA Yearly Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const downloadDefectImage = tryCatch(async (req, res) => {
  const { fgSrNo } = req.params;
  const { filename } = req.query;

  if (!fgSrNo || !filename) {
    throw new AppError(
      "Missing required query parameters: fGSerialNumber or filename.",
      400
    );
  }

  const filePath = path.join(uploadDir, filename);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    // Verify file in database
    const pool = await sql.connect(dbConfig1);
    const query = `
      SELECT DefectImage
      FROM FPAReport
      WHERE FGSRNo = @FGSRNo AND DefectImage = @FileName
    `;
    const result = await pool
      .request()
      .input("FGSRNo", sql.NVarChar, fgSrNo.trim())
      .input("FileName", sql.NVarChar, filename)
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "File record not found in database",
      });
    }

    // Set headers for download
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("File streaming error:", error);
      res.status(500).json({
        success: false,
        message: "Error streaming file",
      });
    });
  } catch (error) {
    throw new AppError(
      `Failed to download the Defect Image:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
