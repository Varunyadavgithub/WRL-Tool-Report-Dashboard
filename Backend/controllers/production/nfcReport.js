import sql, { dbConfig1 } from "../../config/db.js";

export const getNfcReoprts = async (req, res) => {
  const { startDate, endDate, model, page = 1, limit = 1000 } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);
    const offset = (parseInt(page) - 1) * parseInt(limit);

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

    const query = `
 WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
    FROM MaterialBarcode 
    WHERE PrintStatus = 1 AND Status <> 99
),
FilteredData AS (
    SELECT 
      m.Name AS Model_Name,                  -- Clean material name
      ISNULL(Psno.VSerial, '') AS Asset_tag,

      -- NEW → NFC UID before semicolon
      CASE 
          WHEN CHARINDEX(';', Psno.Serial2) > 0 
               THEN LEFT(Psno.Serial2, CHARINDEX(';', Psno.Serial2) - 1)
          ELSE NULL
      END AS NFC_UID,

      -- Clean CustomerQR after semicolon
      CASE 
          WHEN CHARINDEX(';', Psno.Serial2) > 0 
               THEN SUBSTRING(Psno.Serial2, CHARINDEX(';', Psno.Serial2) + 1, LEN(Psno.Serial2))
          ELSE Psno.Serial2
      END AS CustomerQR,

      COALESCE(
        NULLIF(
            CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' 
                 ELSE Psno.Serial 
            END, 
        ''),
        CASE 
            WHEN Psno.VSerial IS NULL THEN Psno.Serial 
            ELSE Psno.Alias 
        END
      ) AS FG_SR

    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode

    -- Correct Material join (ledger + type filters)
    JOIN Material m 
        ON m.MatCode = Psno.Material
       AND m.Type = 100 
       AND m.Ledger = 0

    WHERE 
        b.ActivityType = 5
        AND c.StationCode IN (1220010, 1230017)
        AND b.ActivityOn BETWEEN @startTime AND @endTime
)

SELECT *
FROM FilteredData;
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
    console.error("Error fetching NFC details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Export Data
export const fetchExportData = async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (model && model != 0) {
      request.input("model", sql.VarChar, model);
    }

    const query = `
 WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
    FROM MaterialBarcode 
    WHERE PrintStatus = 1 AND Status <> 99
),
FilteredData AS (
    SELECT 
      m.Name AS Model_Name,                  -- Clean material name
      ISNULL(Psno.VSerial, '') AS Asset_tag,

      -- NEW → NFC UID before semicolon
      CASE 
          WHEN CHARINDEX(';', Psno.Serial2) > 0 
               THEN LEFT(Psno.Serial2, CHARINDEX(';', Psno.Serial2) - 1)
          ELSE NULL
      END AS NFC_UID,

      -- Clean CustomerQR after semicolon
      CASE 
          WHEN CHARINDEX(';', Psno.Serial2) > 0 
               THEN SUBSTRING(Psno.Serial2, CHARINDEX(';', Psno.Serial2) + 1, LEN(Psno.Serial2))
          ELSE Psno.Serial2
      END AS CustomerQR,

      COALESCE(
        NULLIF(
            CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' 
                 ELSE Psno.Serial 
            END, 
        ''),
        CASE 
            WHEN Psno.VSerial IS NULL THEN Psno.Serial 
            ELSE Psno.Alias 
        END
      ) AS FG_SR

    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode

    -- Correct Material join (ledger + type filters)
    JOIN Material m 
        ON m.MatCode = Psno.Material
       AND m.Type = 100 
       AND m.Ledger = 0

    WHERE 
        b.ActivityType = 5
        AND c.StationCode IN (1220010, 1230017)
        AND b.ActivityOn BETWEEN @startTime AND @endTime
)

SELECT *
FROM FilteredData;
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
    console.error("Error fetching NFC details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
