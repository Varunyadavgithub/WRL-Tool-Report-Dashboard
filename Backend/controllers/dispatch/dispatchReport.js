import sql, { dbConfig2 } from "../../config/db.js";

export const getFgUnloading = async (req, res) => {
  const { startDate, endDate, page = 1, limit = 1000 } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const query = `
      WITH UnloadingData AS (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY DateTime DESC) AS RowNum,
          * 
        FROM DispatchUnloading
        WHERE DateTime BETWEEN @startDate AND @endDate
      )
      SELECT 
        (SELECT COUNT(*) FROM UnloadingData) AS totalCount,
        * 
      FROM UnloadingData
      WHERE RowNum > @offset AND RowNum <= (@offset + @limit)
    ;
    `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit))
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getFgDispatch = async (req, res) => {
  const { startDate, endDate, status, page = 1, limit = 1000 } = req.query;

  if (!startDate || !endDate || !status) {
    return res.status(400).send("Missing startDate, endDate, or status.");
  }

  const lowerStatus = status.toLowerCase();
  let tableName, statusValue, additionalField;
  if (lowerStatus === "completed") {
    tableName = "DispatchMaster";
    statusValue = "Completed";
    additionalField = ", DM.Scan_ID";
  } else if (lowerStatus === "open") {
    tableName = "TempDispatch";
    statusValue = "Open";
    additionalField = "";
  } else {
    return res.status(400).send("Invalid status. Use 'Completed' or 'Open'.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const query = `
      WITH DispatchData AS (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY DM.AddedOn DESC) AS RowNum,
          DM.ModelName, 
          DM.FGSerialNo, 
          DM.AssetCode, 
          DM.Session_ID, 
          DM.AddedOn, 
          DM.AddedBy, 
          DM.Document_ID, 
          DM.ModelCode, 
          TD.DockNo, 
          TD.Vehicle_No, 
          TD.Generated_By
          ${additionalField}
        FROM ${tableName} DM
        INNER JOIN Tracking_Document TD ON DM.Document_ID = TD.Document_ID
        WHERE DM.AddedOn BETWEEN @startDate AND @endDate
          AND TD.LatestStatus = @StatusValue
      )
      SELECT 
        (SELECT COUNT(*) FROM DispatchData) AS totalCount,
        * 
      FROM DispatchData
      WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
    `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("StatusValue", sql.VarChar, statusValue)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit))
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Quick Filters
export const getQuickFgUnloading = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
      SELECT 
        *,
        (SELECT COUNT(*) FROM DispatchUnloading WHERE DateTime BETWEEN @startDate AND @endDate) AS totalCount
      FROM DispatchUnloading
      WHERE DateTime BETWEEN @startDate AND @endDate
      ORDER BY DateTime DESC;
    `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getQuickFgDispatch = async (req, res) => {
  const { startDate, endDate, status } = req.query;

  if (!startDate || !endDate || !status) {
    return res.status(400).send("Missing startDate, endDate, or status.");
  }

  const lowerStatus = status.toLowerCase();
  let tableName, statusValue, additionalField;
  if (lowerStatus === "completed") {
    tableName = "DispatchMaster";
    statusValue = "Completed";
    additionalField = ", DM.Scan_ID";
  } else if (lowerStatus === "open") {
    tableName = "TempDispatch";
    statusValue = "Open";
    additionalField = "";
  } else {
    return res.status(400).send("Invalid status. Use 'Completed' or 'Open'.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
      SELECT 
        DM.ModelName, 
        DM.FGSerialNo, 
        DM.AssetCode, 
        DM.Session_ID, 
        DM.AddedOn, 
        DM.AddedBy, 
        DM.Document_ID, 
        DM.ModelCode, 
        TD.DockNo, 
        TD.Vehicle_No, 
        TD.Generated_By
        ${additionalField},
        (
          SELECT COUNT(*) 
          FROM ${tableName} AS DM 
          INNER JOIN Tracking_Document TD ON DM.Document_ID = TD.Document_ID
          WHERE DM.AddedOn BETWEEN @startDate AND @endDate
            AND TD.LatestStatus = @StatusValue
        ) AS totalCount
      FROM ${tableName} AS DM
      INNER JOIN Tracking_Document TD ON DM.Document_ID = TD.Document_ID
      WHERE DM.AddedOn BETWEEN @startDate AND @endDate
        AND TD.LatestStatus = @StatusValue
      ORDER BY DM.AddedOn DESC;
    `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("StatusValue", sql.VarChar, statusValue)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
