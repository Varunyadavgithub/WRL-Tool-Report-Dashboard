import sql, { dbConfig1 } from "../../config/db.js";

export const getFpaReport = async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
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
    const request = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);
    res.json(result.recordset);

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getFpaDailyReport = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
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
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getFpaMonthlyReport = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
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
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getFpaYearlyReport = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
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
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};