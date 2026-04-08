import fs from "fs";
import path from "path";
import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

const uploadDir = path.join(process.cwd(), "uploads/FpaDefectImages");

// ─── Helper: create and connect a pool ───────────────────────────────────────
// FIX: centralise pool creation so every handler uses the same pattern
// and we never forget to close it.
const withPool = async (callback) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
};

// ─── GET /quality/fpa-report ──────────────────────────────────────────────────
export const getFpaReport = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError("Missing required query parameters: startDate or endDate.", 400);
  }

  const istStart = convertToIST(startDate);
  const istEnd   = convertToIST(endDate);

  // FIX: build query string safely — never concatenate user input
  let query = `
    SELECT *
    FROM   FPAReport
    WHERE  Date BETWEEN @startDate AND @endDate
  `;
  if (model) query += " AND Model = @model";
  query += " ORDER BY Date DESC";

  const data = await withPool(async (pool) => {
    const req2 = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate",   sql.DateTime, istEnd);

    if (model) req2.input("model", sql.VarChar, model);

    const result = await req2.query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "FPA Report data retrieved successfully.",
    data,
  });
});

// ─── GET /quality/fpa-daily-report ────────────────────────────────────────────
export const getFpaDailyReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError("Missing required query parameters: startDate or endDate.", 400);
  }

  const istStart = convertToIST(startDate);
  const istEnd   = convertToIST(endDate);

  // FIX: use >= / < instead of BETWEEN so the boundary shift-date logic is
  //      consistent with the CTE that subtracts a day for pre-08:00 records.
  const query = `
WITH ShiftedData AS (
    SELECT
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
        MAX(Month)  AS Month,
        SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS NoOfCritical,
        SUM(CASE WHEN Category = 'Major'    THEN 1 ELSE 0 END) AS NoOfMajor,
        SUM(CASE WHEN Category = 'Minor'    THEN 1 ELSE 0 END) AS NoOfMinor,
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
        (NoOfCritical * 9.0 + NoOfMajor * 6.0 + NoOfMinor * 1.0)
        / NULLIF(SampleInspected, 0)
    AS DECIMAL(10, 3)) AS FPQI
FROM Summary
ORDER BY ShiftDate ASC;
  `;

  // FIX: was ORDER BY DESC — ascending is more useful for charts
  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate",   sql.DateTime, istEnd)
      .query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "FPA Daily Report data retrieved successfully.",
    data,
  });
});

// ─── GET /quality/fpa-monthly-report ─────────────────────────────────────────
export const getFpaMonthlyReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError("Missing required query parameters: startDate or endDate.", 400);
  }

  const istStart = convertToIST(startDate);
  const istEnd   = convertToIST(endDate);

  const query = `
WITH ShiftedData AS (
    SELECT
        CASE
            WHEN CAST(Date AS TIME) < '08:00:00'
                THEN DATEADD(DAY, -1, CAST(Date AS DATE))
            ELSE CAST(Date AS DATE)
        END AS ShiftDate,
        FORMAT(Date, 'yyyy-MM')    AS MonthKey,
        DATENAME(MONTH, Date)      AS MonthName,
        Category,
        FGSRNo
    FROM FPAReport
    WHERE Date >= @startDate AND Date < @endDate
),
Summary AS (
    SELECT
        MonthKey,
        MAX(MonthName) AS Month,
        SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS NoOfCritical,
        SUM(CASE WHEN Category = 'Major'    THEN 1 ELSE 0 END) AS NoOfMajor,
        SUM(CASE WHEN Category = 'Minor'    THEN 1 ELSE 0 END) AS NoOfMinor,
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
        (NoOfCritical * 9.0 + NoOfMajor * 6.0 + NoOfMinor * 1.0)
        / NULLIF(SampleInspected, 0)
    AS DECIMAL(10, 3)) AS FPQI
FROM Summary
ORDER BY MonthKey ASC;
  `;

  // FIX: ORDER BY ASC so charts render left→right chronologically
  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate",   sql.DateTime, istEnd)
      .query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "FPA Monthly Report data retrieved successfully.",
    data,
  });
});

// ─── GET /quality/fpa-yearly-report ──────────────────────────────────────────
export const getFpaYearlyReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError("Missing required query parameters: startDate or endDate.", 400);
  }

  const istStart = convertToIST(startDate);
  const istEnd   = convertToIST(endDate);

  const query = `
WITH ShiftedData AS (
    SELECT
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
        SUM(CASE WHEN Category = 'Major'    THEN 1 ELSE 0 END) AS NoOfMajor,
        SUM(CASE WHEN Category = 'Minor'    THEN 1 ELSE 0 END) AS NoOfMinor,
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
        (NoOfCritical * 9.0 + NoOfMajor * 6.0 + NoOfMinor * 1.0)
        / NULLIF(SampleInspected, 0)
    AS DECIMAL(10, 3)) AS FPQI
FROM Summary
ORDER BY Year ASC;
  `;

  // FIX: ORDER BY ASC for chronological chart rendering
  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate",   sql.DateTime, istEnd)
      .query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "FPA Yearly Report data retrieved successfully.",
    data,
  });
});

// ─── GET /quality/download-fpa-defect-image/:fgSrNo ───────────────────────────
// FIX: was using sql.connect() (global pool, deprecated) — now uses ConnectionPool
export const downloadDefectImage = tryCatch(async (req, res) => {
  const { fgSrNo }   = req.params;
  const { filename } = req.query;

  if (!fgSrNo || !filename) {
    throw new AppError("Missing required parameters: fgSrNo or filename.", 400);
  }

  // FIX: sanitise filename to prevent path traversal
  const safeFileName = path.basename(filename);
  if (safeFileName !== filename) {
    throw new AppError("Invalid filename.", 400);
  }

  const filePath = path.join(uploadDir, safeFileName);

  // FIX: check file existence before hitting the DB
  if (!fs.existsSync(filePath)) {
    throw new AppError("File not found on server.", 404);
  }

  // Verify the file belongs to the given FGSRNo to prevent unauthorized downloads
  await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("FGSRNo",   sql.NVarChar, fgSrNo.trim())
      .input("FileName", sql.NVarChar, safeFileName)
      .query(`
        SELECT 1
        FROM   FPAReport
        WHERE  FGSRNo      = @FGSRNo
          AND  DefectImage = @FileName
      `);

    if (result.recordset.length === 0) {
      throw new AppError("File record not found in database.", 404);
    }
  });

  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.setHeader("Content-Type", "application/octet-stream");

  const fileStream = fs.createReadStream(filePath);
  fileStream.on("error", (err) => {
    console.error("File streaming error:", err);
    // FIX: only end response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).end();
    }
  });
  fileStream.pipe(res);
});