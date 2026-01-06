import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";

export const getBarcodeDetails = tryCatch(async (req, res) => {
  const {
    startDate,
    endDate,
    model,
    department,
    page = 1,
    limit = 1000,
  } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400
    );
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const finalStationCodes = ["1220010", "1230017"];
  const postFoamingStationCodes = ["1230007", "1220003", "1220004", "1230012"];
  const finalLoadingStationCodes = ["1220005", "1230013"];

  let selectedStationCodes = [];

  if (department === "final") {
    selectedStationCodes = finalStationCodes;
  } else if (department === "post-foaming") {
    selectedStationCodes = postFoamingStationCodes;
  } else if (department === "final-loading") {
    selectedStationCodes = finalLoadingStationCodes;
  } else {
    return res.status(400).send("Invalid department value.");
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
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
      ROW_NUMBER() OVER (
        ORDER BY 
          (SELECT Name FROM Material WHERE MatCode = Psno.Material), 
          COALESCE(NULLIF(CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE Psno.Serial END, ''),
                   CASE 
                     WHEN Psno.VSerial IS NULL THEN Psno.Serial 
                     ELSE Psno.Alias 
                   END)
      ) AS RowNum,
      (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS Model_Name,
      ISNULL(Psno.VSerial, '') AS Asset_tag,
      ISNULL(Psno.Serial2, '') AS CustomerQR,
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
      message: "Barcode Details data retrieved successfully",
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Barcode Details data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

// Export Data
export const totalProductionExportData = async (req, res) => {
  const { startDate, endDate, model, department } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400
    );
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const finalStationCodes = ["1220010", "1230017"];
  const postFoamingStationCodes = ["1230007", "1220003", "1220004", "1230012"];
  const finalLoadingStationCodes = ["1220005", "1230013"];

  let selectedStationCodes = [];

  if (department === "final") {
    selectedStationCodes = finalStationCodes;
  } else if (department === "post-foaming") {
    selectedStationCodes = postFoamingStationCodes;
  } else if (department === "final-loading") {
    selectedStationCodes = finalLoadingStationCodes;
  } else {
    return res.status(400).send("Invalid department value.");
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
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
      ROW_NUMBER() OVER (
        ORDER BY 
          (SELECT Name FROM Material WHERE MatCode = Psno.Material), 
          COALESCE(NULLIF(CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE Psno.Serial END, ''),
                   CASE 
                     WHEN Psno.VSerial IS NULL THEN Psno.Serial 
                     ELSE Psno.Alias 
                   END)
      ) AS RowNum,
      (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS Model_Name,
      ISNULL(Psno.VSerial, '') AS Asset_tag,
      ISNULL(Psno.Serial2, '') AS CustomerQR,
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
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Total Production Export data retrieved successfully",
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Total Production Export data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
};

// Quick Filters Data
export const getQuickFiltersBarcodeDetails = async (req, res) => {
  const { startDate, endDate, model, department } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400
    );
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const finalStationCodes = ["1220010", "1230017"];
  const postFoamingStationCodes = ["1230007", "1220003", "1220004", "1230012"];
  const finalLoadingStationCodes = ["1220005", "1230013"];

  let selectedStationCodes = [];

  if (department === "final") {
    selectedStationCodes = finalStationCodes;
  } else if (department === "post-foaming") {
    selectedStationCodes = postFoamingStationCodes;
  } else if (department === "final-loading") {
    selectedStationCodes = finalLoadingStationCodes;
  } else {
    return res.status(400).send("Invalid department value.");
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (model && model != 0) {
      request.input("model", sql.VarChar, model);
    }

    const stationCodeString = selectedStationCodes.join(", ");

    const query = `
   WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
    FROM MaterialBarcode 
    WHERE PrintStatus = 1 AND Status <> 99
  ),
  FilteredData AS (
    SELECT 
      ROW_NUMBER() OVER (
        ORDER BY 
          (SELECT Name FROM Material WHERE MatCode = Psno.Material), 
          COALESCE(NULLIF(CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE Psno.Serial END, ''),
                   CASE 
                     WHEN Psno.VSerial IS NULL THEN Psno.Serial 
                     ELSE Psno.Alias 
                   END)
      ) AS RowNum,
      (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS Model_Name,
      ISNULL(Psno.VSerial, '') AS Asset_tag,
      ISNULL(Psno.Serial2, '') AS CustomerQR,
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
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Quick Filters Barcode Details data retrieved successfully",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Quick Filters Barcode Details data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
};
