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
      SELECT
        CAST(Date AS DATE) AS Date,
        DATENAME(MONTH, Date) AS Month,
        SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS [NoOfCritical],
        SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) AS [NoOfMajor],
        SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) AS [NoOfMinor],
        COUNT(DISTINCT FGSRNo) AS [SampleInspected],
        ROUND(CAST(((SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) * 9)
          + (SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) * 6)
          + (SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) * 1)) AS FLOAT)
          / NULLIF(COUNT(DISTINCT FGSRNo), 0), 3) AS FPQI
      FROM FPAReport
      WHERE Date >= @startDate AND Date <= @endDate
      GROUP BY CAST(Date AS DATE), DATENAME(MONTH, Date)
      order by Date desc;
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
SELECT
  DATENAME(MONTH, CAST(Date AS DATE)) AS [Month],
  YEAR(CAST(Date AS DATE)) AS [Year],
  SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS [NoOfCritical],
  SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) AS [NoOfMajor],
  SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) AS [NoOfMinor],
  COUNT(DISTINCT FGSRNo) AS [SampleInspected],
  ROUND(
    CAST(
      ((SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) * 9) +
       (SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) * 6) +
       (SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) * 1)
      ) AS FLOAT
    ) / NULLIF(COUNT(DISTINCT FGSRNo), 0),
  3) AS [FPQI]
FROM FPAReport
WHERE Date BETWEEN @startDate AND @endDate
GROUP BY 
  YEAR(CAST(Date AS DATE)), 
  MONTH(CAST(Date AS DATE)), 
  DATENAME(MONTH, CAST(Date AS DATE))
ORDER BY 
  YEAR(CAST(Date AS DATE)) DESC,
  MONTH(CAST(Date AS DATE)) DESC;
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
      SELECT
        YEAR(CAST(Date AS DATE)) AS Year,
        SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS [NoOfCritical],
        SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) AS [NoOfMajor],
        SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) AS [NoOfMinor],
        COUNT(DISTINCT FGSRNo) AS [SampleInspected],
        ROUND(
          CAST(
            ((SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) * 9) +
             (SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) * 6) +
             (SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) * 1)
            ) AS FLOAT
          ) / NULLIF(COUNT(DISTINCT FGSRNo), 0),
        3) AS FPQI
      FROM FPAReport
      WHERE Date BETWEEN @startDate AND @endDate
      GROUP BY YEAR(CAST(Date AS DATE))
      ORDER BY YEAR DESC;
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
