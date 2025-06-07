import sql, { dbConfig1 } from "../../config/db.js";

export const getBarcodeDetails = async (req, res) => {
  const {
    startDate,
    endDate,
    model,
    department,
    page = 1,
    limit = 1000,
  } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const finalStationCodes = ["1220010", "1230017"];
    const postFoamingStationCodes = [
      "1230007",
      "1220003",
      "1220004",
      "1230012",
    ];

    const selectedStationCodes =
      department === "final" ? finalStationCodes : postFoamingStationCodes;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    if (model && model != 0) {
      request.input("model", sql.VarChar, model);
    }

    // Dynamically build StationCode string for IN clause
    const stationCodeString = selectedStationCodes.join(", ");

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
        FROM MaterialBarcode 
        WHERE PrintStatus = 1 AND Status <> 99
      ),
      FilteredData AS (
        SELECT 
          ROW_NUMBER() OVER (ORDER BY Psno.Serial) AS RowNum,
          (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS Model_Name,
          ISNULL(Psno.VSerial, '') AS Asset_tag,
        COALESCE(NULLIF(CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE Psno.Serial END, ''),
            CASE 
                WHEN Psno.VSerial IS NULL THEN Psno.Serial 
                ELSE Psno.Alias 
            END
        ) AS FG_SR,
        ISNULL(mc.Alias, 'N/A') AS category

        FROM Psno
        JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
        JOIN WorkCenter c ON b.StationCode = c.StationCode
        JOIN Material m ON m.MatCode = Psno.Material
        LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
        WHERE b.ActivityType = 5
          AND c.StationCode IN (${stationCodeString})          
          AND b.ActivityOn BETWEEN @startTime AND @endTime
          ${model && model != 0 ? "AND Psno.Material = @model" : ""}
      )
      SELECT 
        (SELECT COUNT(*) FROM FilteredData) AS totalCount,
        * 
      FROM FilteredData
      WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (error) {
    console.error("Error fetching barcode details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Export Data
export const fetchExportData = async (req, res) => {
  const { startDate, endDate, model, department } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const finalStationCodes = ["1220010", "1230017"];
    const postFoamingStationCodes = [
      "1230007",
      "1220003",
      "1220004",
      "1230012",
    ];

    const selectedStationCodes =
      department === "final" ? finalStationCodes : postFoamingStationCodes;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (model && model != 0) {
      request.input("model", sql.VarChar, model);
    }

    // Dynamically build StationCode string for IN clause
    const stationCodeString = selectedStationCodes.join(", ");

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
        FROM MaterialBarcode 
        WHERE PrintStatus = 1 AND Status <> 99
      ),
      FilteredData AS (
        SELECT 
          (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS Model_Name,
          ISNULL(Psno.VSerial, '') AS Asset_tag,
        COALESCE(NULLIF(CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE Psno.Serial END, ''),
            CASE 
                WHEN Psno.VSerial IS NULL THEN Psno.Serial 
                ELSE Psno.Alias 
            END
        ) AS FG_SR,
        ISNULL(mc.Alias, 'N/A') AS category

        FROM Psno
        JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
        JOIN WorkCenter c ON b.StationCode = c.StationCode
        JOIN Material m ON m.MatCode = Psno.Material
        LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
        WHERE b.ActivityType = 5
          AND c.StationCode IN (${stationCodeString})          
          AND b.ActivityOn BETWEEN @startTime AND @endTime
          ${model && model != 0 ? "AND Psno.Material = @model" : ""}
      )
      SELECT 
        * 
      FROM FilteredData
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (error) {
    console.error("Error fetching barcode details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
