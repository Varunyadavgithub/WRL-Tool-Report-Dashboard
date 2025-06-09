import sql, { dbConfig1 } from "../../config/db.js";

export const fetchFGData = async (req, res) => {
  const {
    startTime,
    endTime,
    model,
    stationCode,
    page = 1,
    limit = 1000,
  } = req.query;

  if (!startTime || !endTime || !stationCode) {
    return res.status(400).json({
      success: false,
      message: "startTime, endTime, and stationCode are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("stationCode", sql.VarChar, stationCode)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    } else {
      request.input("model", sql.VarChar, null);
    }

    const query = `
        ;WITH FilteredData AS (
    SELECT 
        mb.Material,
        CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
        pa.ActivityOn,
        pa.StationCode,
        pa.Operator,
        mb.Serial,
        mb.VSerial,
        mb.Serial2
    FROM MaterialBarcode mb
    JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
    JOIN WorkCenter wc ON pa.StationCode = wc.StationCode
    WHERE mb.PrintStatus = 1
      AND mb.Status <> 99
      AND pa.ActivityType = 5
      AND pa.ActivityOn BETWEEN @startTime AND @endTime
      AND wc.StationCode = @stationCode
),
ModelStats AS (
    SELECT    
        MIN(Serial) AS StartSerial,
        MAX(Serial) AS EndSerial,
        COUNT(*) AS TotalCount,
        Material
    FROM FilteredData
    GROUP BY Material
),
PagedData AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY fd.ActivityOn ASC) AS SrNo,
        m.Name AS Model_Name,
        fd.Material AS ModelName,
        fd.StationCode,
        wc.Name AS Station_Name,
        fd.Assembly_Sr_No,
        ISNULL(fd.VSerial, '') AS Asset_tag,
        ISNULL(fd.Serial2, '') AS [Customer_QR],
        CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE fd.Serial END AS FG_SR,
        fd.ActivityOn AS CreatedOn,
        u.UserName,
        ms.StartSerial,
        ms.EndSerial,
        ms.TotalCount
    FROM FilteredData fd
    JOIN Users u ON u.UserCode = fd.Operator
    JOIN WorkCenter wc ON fd.StationCode = wc.StationCode
    JOIN ModelStats ms ON ms.Material = fd.Material
    JOIN Material m ON m.MatCode = fd.Material
    WHERE (@model IS NULL OR fd.Material = @model)
)
SELECT 
    (SELECT COUNT(*) FROM PagedData) AS totalCount,
    * 
FROM PagedData
WHERE SrNo > @offset AND SrNo <= (@offset + @limit);
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Export Data
export const fetchExportData = async (req, res) => {
  const { startTime, endTime, model, stationCode } = req.query;

  if (!startTime || !endTime || !stationCode) {
    return res.status(400).json({
      success: false,
      message: "startTime, endTime, and stationCode are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);

    let query = `
      WITH FilteredData AS (
          SELECT
              mb.Material,
              CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
              pa.ActivityOn,
              pa.StationCode,
              pa.Operator,
              mb.Serial,
              mb.VSerial,
              mb.Serial2
          FROM MaterialBarcode mb
          JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
          JOIN WorkCenter wc ON pa.StationCode = wc.StationCode
          WHERE mb.PrintStatus = 1
            AND mb.Status <> 99
            AND pa.ActivityType = 5
            AND pa.ActivityOn BETWEEN @startTime AND @endTime
            AND wc.StationCode = @stationCode
      ),
      ModelStats AS (
          SELECT
              MIN(Assembly_Sr_No) AS StartSerial,
              MAX(Assembly_Sr_No) AS EndSerial,
              Material
          FROM FilteredData
          GROUP BY Material
      )
      SELECT
          ROW_NUMBER() OVER (ORDER BY fd.ActivityOn ASC) AS SrNo,
          m.Name AS Model_Name,
          fd.Material AS ModelName,
          fd.StationCode,
          wc.Name AS Station_Name,
          fd.Assembly_Sr_No,
          ISNULL(fd.VSerial, '') AS Asset_tag,
          ISNULL(fd.Serial2, '') AS [Customer_QR],
          CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE fd.Serial END AS FG_SR,
          fd.ActivityOn AS CreatedOn,
          u.UserName,
          ms.StartSerial,
          ms.EndSerial
      FROM FilteredData fd
      JOIN Users u ON u.UserCode = fd.Operator
      JOIN WorkCenter wc ON fd.StationCode = wc.StationCode
      JOIN ModelStats ms ON ms.Material = fd.Material
      JOIN Material m ON m.MatCode = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      ORDER BY SrNo;
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("stationCode", sql.VarChar, stationCode);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    } else {
      request.input("model", sql.VarChar, null);
    }

    const result = await request.query(query);
    res.status(200).json({ success: true, data: result.recordset });
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Yesterday Production Data
export const fetchYesterdayProductionData = async (req, res) => {
  const { startTime, endTime, model, stationCode } = req.query;

  if (!startTime || !endTime || !stationCode) {
    return res.status(400).json({
      success: false,
      message: "startTime, endTime, and stationCode are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("stationCode", sql.VarChar, stationCode);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    } else {
      request.input("model", sql.VarChar, null);
    }

    const query = `
        ;WITH FilteredData AS (
    SELECT 
        mb.Material,
        CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
        pa.ActivityOn,
        pa.StationCode,
        pa.Operator,
        mb.Serial,
        mb.VSerial,
        mb.Serial2
    FROM MaterialBarcode mb
    JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
    JOIN WorkCenter wc ON pa.StationCode = wc.StationCode
    WHERE mb.PrintStatus = 1
      AND mb.Status <> 99
      AND pa.ActivityType = 5
      AND pa.ActivityOn BETWEEN @startTime AND @endTime
      AND wc.StationCode = @stationCode
),
ModelStats AS (
    SELECT    
        MIN(Serial) AS StartSerial,
        MAX(Serial) AS EndSerial,
        COUNT(*) AS TotalCount,
        Material
    FROM FilteredData
    GROUP BY Material
)
    SELECT 
        m.Name AS Model_Name,
        fd.Material AS ModelName,
        fd.StationCode,
        wc.Name AS Station_Name,
        fd.Assembly_Sr_No,
        ISNULL(fd.VSerial, '') AS Asset_tag,
        ISNULL(fd.Serial2, '') AS [Customer_QR],
        CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE fd.Serial END AS FG_SR,
        fd.ActivityOn AS CreatedOn,
        u.UserName,
        ms.StartSerial,
        ms.EndSerial,
        ms.TotalCount
    FROM FilteredData fd
    JOIN Users u ON u.UserCode = fd.Operator
    JOIN WorkCenter wc ON fd.StationCode = wc.StationCode
    JOIN ModelStats ms ON ms.Material = fd.Material
    JOIN Material m ON m.MatCode = fd.Material
    WHERE (@model IS NULL OR fd.Material = @model)
    ORDER BY fd.ActivityOn ASC;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount: result.recordset.length,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Today Production Data
export const fetchTodayProductionData = async (req, res) => {
  const { startTime, endTime, model, stationCode } = req.query;

  if (!startTime || !endTime || !stationCode) {
    return res.status(400).json({
      success: false,
      message: "startTime, endTime, and stationCode are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("stationCode", sql.VarChar, stationCode);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    } else {
      request.input("model", sql.VarChar, null);
    }

    const query = `
        ;WITH FilteredData AS (
    SELECT 
        mb.Material,
        CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
        pa.ActivityOn,
        pa.StationCode,
        pa.Operator,
        mb.Serial,
        mb.VSerial,
        mb.Serial2
    FROM MaterialBarcode mb
    JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
    JOIN WorkCenter wc ON pa.StationCode = wc.StationCode
    WHERE mb.PrintStatus = 1
      AND mb.Status <> 99
      AND pa.ActivityType = 5
      AND pa.ActivityOn BETWEEN @startTime AND @endTime
      AND wc.StationCode = @stationCode
),
ModelStats AS (
    SELECT    
        MIN(Serial) AS StartSerial,
        MAX(Serial) AS EndSerial,
        COUNT(*) AS TotalCount,
        Material
    FROM FilteredData
    GROUP BY Material
)
    SELECT 
        m.Name AS Model_Name,
        fd.Material AS ModelName,
        fd.StationCode,
        wc.Name AS Station_Name,
        fd.Assembly_Sr_No,
        ISNULL(fd.VSerial, '') AS Asset_tag,
        ISNULL(fd.Serial2, '') AS [Customer_QR],
        CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE fd.Serial END AS FG_SR,
        fd.ActivityOn AS CreatedOn,
        u.UserName,
        ms.StartSerial,
        ms.EndSerial,
        ms.TotalCount
    FROM FilteredData fd
    JOIN Users u ON u.UserCode = fd.Operator
    JOIN WorkCenter wc ON fd.StationCode = wc.StationCode
    JOIN ModelStats ms ON ms.Material = fd.Material
    JOIN Material m ON m.MatCode = fd.Material
    WHERE (@model IS NULL OR fd.Material = @model)
    ORDER BY fd.ActivityOn ASC;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount: result.recordset.length,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Month Production Data
export const fetchMonthProductionData = async (req, res) => {
  const { startTime, endTime, model, stationCode } = req.query;

  if (!startTime || !endTime || !stationCode) {
    return res.status(400).json({
      success: false,
      message: "startTime, endTime, and stationCode are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("stationCode", sql.VarChar, stationCode);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    } else {
      request.input("model", sql.VarChar, null);
    }

    const query = `
        ;WITH FilteredData AS (
    SELECT 
        mb.Material,
        CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
        pa.ActivityOn,
        pa.StationCode,
        pa.Operator,
        mb.Serial,
        mb.VSerial,
        mb.Serial2
    FROM MaterialBarcode mb
    JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
    JOIN WorkCenter wc ON pa.StationCode = wc.StationCode
    WHERE mb.PrintStatus = 1
      AND mb.Status <> 99
      AND pa.ActivityType = 5
      AND pa.ActivityOn BETWEEN @startTime AND @endTime
      AND wc.StationCode = @stationCode
),
ModelStats AS (
    SELECT    
        MIN(Serial) AS StartSerial,
        MAX(Serial) AS EndSerial,
        COUNT(*) AS TotalCount,
        Material
    FROM FilteredData
    GROUP BY Material
)
    SELECT 
        m.Name AS Model_Name,
        fd.Material AS ModelName,
        fd.StationCode,
        wc.Name AS Station_Name,
        fd.Assembly_Sr_No,
        ISNULL(fd.VSerial, '') AS Asset_tag,
        ISNULL(fd.Serial2, '') AS [Customer_QR],
        CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE fd.Serial END AS FG_SR,
        fd.ActivityOn AS CreatedOn,
        u.UserName,
        ms.StartSerial,
        ms.EndSerial,
        ms.TotalCount
    FROM FilteredData fd
    JOIN Users u ON u.UserCode = fd.Operator
    JOIN WorkCenter wc ON fd.StationCode = wc.StationCode
    JOIN ModelStats ms ON ms.Material = fd.Material
    JOIN Material m ON m.MatCode = fd.Material
    WHERE (@model IS NULL OR fd.Material = @model)
    ORDER BY fd.ActivityOn ASC;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount: result.recordset.length,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Year Production Data
export const fetchYearProductionData = async (req, res) => {
  const { startTime, endTime, model, stationCode } = req.query;

  if (!startTime || !endTime || !stationCode) {
    return res.status(400).json({
      success: false,
      message: "startTime, endTime, and stationCode are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("stationCode", sql.VarChar, stationCode);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    } else {
      request.input("model", sql.VarChar, null);
    }

    const query = `
        ;WITH FilteredData AS (
    SELECT 
        mb.Material,
        CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
        pa.ActivityOn,
        pa.StationCode,
        pa.Operator,
        mb.Serial,
        mb.VSerial,
        mb.Serial2
    FROM MaterialBarcode mb
    JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
    JOIN WorkCenter wc ON pa.StationCode = wc.StationCode
    WHERE mb.PrintStatus = 1
      AND mb.Status <> 99
      AND pa.ActivityType = 5
      AND pa.ActivityOn BETWEEN @startTime AND @endTime
      AND wc.StationCode = @stationCode
),
ModelStats AS (
    SELECT    
        MIN(Serial) AS StartSerial,
        MAX(Serial) AS EndSerial,
        COUNT(*) AS TotalCount,
        Material
    FROM FilteredData
    GROUP BY Material
)
    SELECT 
        m.Name AS Model_Name,
        fd.Material AS ModelName,
        fd.StationCode,
        wc.Name AS Station_Name,
        fd.Assembly_Sr_No,
        ISNULL(fd.VSerial, '') AS Asset_tag,
        ISNULL(fd.Serial2, '') AS [Customer_QR],
        CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE fd.Serial END AS FG_SR,
        fd.ActivityOn AS CreatedOn,
        u.UserName,
        ms.StartSerial,
        ms.EndSerial,
        ms.TotalCount
    FROM FilteredData fd
    JOIN Users u ON u.UserCode = fd.Operator
    JOIN WorkCenter wc ON fd.StationCode = wc.StationCode
    JOIN ModelStats ms ON ms.Material = fd.Material
    JOIN Material m ON m.MatCode = fd.Material
    WHERE (@model IS NULL OR fd.Material = @model)
    ORDER BY fd.ActivityOn ASC;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount: result.recordset.length,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
