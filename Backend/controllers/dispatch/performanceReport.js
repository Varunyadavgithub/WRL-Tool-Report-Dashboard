import sql, { dbConfig2 } from "../../config/db.js";

// <------- Vehicle ------->
export const getDispatchVehicleUPH = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
    WITH UniqueSessions AS (
    SELECT DISTINCT session_ID
    FROM DispatchMaster
    WHERE AddedOn >= @startDate AND AddedOn <= @endDate
),
ProductionDetails AS (
    SELECT 
        us.session_ID,
        MIN(DATEPART(HOUR, dm.AddedOn)) AS TIMEHOUR  
    FROM DispatchMaster dm
    INNER JOIN UniqueSessions us ON dm.session_ID = us.session_ID
    GROUP BY us.session_ID
),
HourlySummary AS (
    SELECT 
        TIMEHOUR,
        COUNT(session_ID) AS Loading_Count 
    FROM ProductionDetails
    GROUP BY TIMEHOUR
)
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY TIMEHOUR)) AS HOUR_NUMBER, 
    TIMEHOUR, 
    Loading_Count AS COUNT 
FROM HourlySummary
ORDER BY TIMEHOUR;
  `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDispatchVehicleSummary = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
    WITH UniqueSessions AS (
    -- Get distinct session_IDs within the given time range
    SELECT DISTINCT session_ID
    FROM DispatchMaster
    WHERE AddedOn >= @startDate AND AddedOn <= @endDate
),
ProductionDetails AS (
    -- Assign a single TIMEHOUR to each session_ID
    SELECT 
        dm.session_ID,
        DATEPART(HOUR, MIN(dm.AddedOn)) AS TIMEHOUR  -- Get the earliest hour for each session
    FROM DispatchMaster dm
    INNER JOIN UniqueSessions us ON dm.session_ID = us.session_ID
    GROUP BY dm.session_ID
),
SessionSummary AS (
    -- Count the number of models per session
    SELECT 
        pd.TIMEHOUR,
        dm.session_ID,
        COUNT(*) AS Model_Count  -- Count of models per session
    FROM DispatchMaster dm
    INNER JOIN ProductionDetails pd ON dm.session_ID = pd.session_ID
    WHERE AddedOn >= @startDate AND AddedOn <= @endDate
    GROUP BY pd.TIMEHOUR, dm.session_ID
),
TotalSummary AS (
    -- Calculate the total count across all sessions
    SELECT 
        NULL AS TIMEHOUR,   
        'Total' AS session_ID,
        SUM(Model_Count) AS Model_Count
    FROM SessionSummary
)
-- Final selection ensuring the Total row appears last
SELECT HOUR_NUMBER, TIMEHOUR, session_ID, Model_Count FROM (
    SELECT 
        CONCAT('H', ROW_NUMBER() OVER (ORDER BY TIMEHOUR, session_ID)) AS HOUR_NUMBER, 
        TIMEHOUR, 
        session_ID, 
        Model_Count,
        0 AS SortOrder  -- Regular rows get 0 for sorting
    FROM SessionSummary

    UNION ALL

    SELECT 
        'TOTAL' AS HOUR_NUMBER, 
        NULL AS TIMEHOUR,  
        session_ID, 
        Model_Count,
        1 AS SortOrder  -- Total row gets 1 for sorting last
    FROM TotalSummary
) AS FinalResult
ORDER BY SortOrder, TIMEHOUR, session_ID;
  `;
    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// <------- Model ------->
export const getDispatchModelCount = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
      WITH ProductionDetails AS (
    -- Extract TIMEHOUR for all records within the time range
    SELECT 
        DATEPART(HOUR, AddedOn) AS TIMEHOUR  
    FROM DispatchMaster
    WHERE AddedOn >= @startDate AND AddedOn <= @endDate
),
Hours AS (
    -- Generate a dynamic list of hours from available data
    SELECT DISTINCT TIMEHOUR FROM ProductionDetails
),
HourlySummary AS (
    -- Count total records per hour
    SELECT 
        pd.TIMEHOUR,
        COUNT(*) AS Loading_Count  
    FROM Hours h
    LEFT JOIN ProductionDetails pd ON h.TIMEHOUR = pd.TIMEHOUR
    GROUP BY pd.TIMEHOUR
)
-- Final selection with row numbers
SELECT 
    CONCAT('H', ROW_NUMBER() OVER (ORDER BY TIMEHOUR)) AS HOUR_NUMBER, 
    TIMEHOUR, 
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY TIMEHOUR;
  `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDispatchModelSummary = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
      WITH ProductionDetails AS (
    -- Extract TIMEHOUR and ModelName for all records within the time range
    SELECT 
        DATEPART(HOUR, AddedOn) AS TIMEHOUR,  
        ModelName
    FROM DispatchMaster
    WHERE AddedOn >= @startDate AND AddedOn <= @endDate
),
HourlySummary AS (
    -- Aggregate counts per hour and per ModelName
    SELECT 
        TIMEHOUR,
        ModelName,
        COUNT(*) AS Loading_Count  -- Count all occurrences, not just distinct ones
    FROM ProductionDetails
    GROUP BY TIMEHOUR, ModelName
)
-- Final selection with row numbers
SELECT 
    TIMEHOUR, 
    ModelName,
    Loading_Count AS COUNT
FROM HourlySummary
ORDER BY TIMEHOUR, ModelName;   
    `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// <------- Category ------->
export const getDispatchCategoryModelCount = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
     WITH ProductionDetails AS (
     -- Extract TIMEHOUR for all records within the time range
     SELECT 
         DATEPART(HOUR, AddedOn) AS TIMEHOUR  
     FROM DispatchMaster
     WHERE AddedOn >= @startDate AND AddedOn <= @endDate
 ),
 Hours AS (
     -- Generate a dynamic list of hours from available data
     SELECT DISTINCT TIMEHOUR FROM ProductionDetails
 ),
 HourlySummary AS (
     -- Count total records per hour
     SELECT 
         pd.TIMEHOUR,
         COUNT(*) AS Loading_Count  
     FROM Hours h
     LEFT JOIN ProductionDetails pd ON h.TIMEHOUR = pd.TIMEHOUR
     GROUP BY pd.TIMEHOUR
 )
 -- Final selection with row numbers
 SELECT 
     CONCAT('H', ROW_NUMBER() OVER (ORDER BY TIMEHOUR)) AS HOUR_NUMBER, 
     TIMEHOUR, 
     Loading_Count AS COUNT
 FROM HourlySummary
 ORDER BY TIMEHOUR;
  `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDispatchCategorySummary = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
     WITH ProductionDetails AS (
    -- Extract ModelName for all records within the time range
    SELECT  
        ModelName
    FROM DispatchMaster
    WHERE AddedOn >= @startDate AND AddedOn <= @endDate
),
ModelSummary AS (
    -- Aggregate counts per ModelName
    SELECT  
        ModelName,
        COUNT(*) AS Loading_Count  -- Count all occurrences, not just distinct ones
    FROM ProductionDetails
    GROUP BY ModelName
)
-- Final selection ordered by ModelName
SELECT  
    ModelName,
    Loading_Count AS COUNT
FROM ModelSummary
ORDER BY ModelName;
  `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};