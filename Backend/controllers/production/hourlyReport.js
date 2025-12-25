import sql, { dbConfig1 } from "../../config/db.js";

export const getHourlySummary = async (req, res) => {
  const { stationCode, startDate, endDate, model, line } = req.query;

  if (!stationCode || !startDate || !endDate) {
    return res.status(400).send("Missing stationCode, startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    let categoryCondition = "";
    let userRoleCondition = "";
    let stationCodeCondition = "= @stationCode"; // default single station

    if (stationCode == 1220010) {
      if (line == "1") {
        categoryCondition =
          " AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005) ";
      } else if (line == "2") {
        categoryCondition = " AND m.Category in (1240001, 1250005) ";
      }
    } else if (stationCode == 1220005) {
      if (line == "1") {
        categoryCondition =
          " AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005) ";
      } else if (line == "2") {
        categoryCondition = " AND m.Category in (1240001, 1250005) ";
      }
    } else if (stationCode == 1230017) {
      categoryCondition =
        " AND m.Category in (1230003, 1230004, 1230009, 1230010, 1250004) ";
    }

    if (stationCode == 1220010) {
      if (line == "1") {
        userRoleCondition = " And u.UserRole = 224006 ";
      } else if (line == "2") {
        userRoleCondition = " AND u.UserRole = 224007 ";
      }
    } else if (stationCode == 1220005) {
      if (line == "1") {
        userRoleCondition = " And u.UserRole = 225002 ";
      } else if (line == "2") {
        userRoleCondition = " AND u.UserRole = 225001 ";
      }
    }

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Alias, Type
        FROM MaterialBarcode
        WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
      ),
      HourlySummary AS (
        SELECT 
          DATEPART(DAY, b.ActivityOn) AS TIMEDAY,
          DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
          CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
             CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME) AS HourTime,
          COUNT(*) AS Loading_Count
        FROM Psno
          JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
          JOIN WorkCenter c ON b.StationCode = c.StationCode
          JOIN Material m ON Psno.Material = m.MatCode
          JOIN Users u ON b.Operator = u.UserCode
        WHERE
          c.StationCode = @stationCode
          AND b.ActivityType = 5
          AND b.ActivityOn BETWEEN @startDate AND @endDate
          ${model && model !== "0" ? "AND Psno.Material = @model" : ""}
          ${categoryCondition}
          ${userRoleCondition}
        GROUP BY 
          DATEPART(DAY, b.ActivityOn), 
          DATEPART(HOUR, b.ActivityOn),
          CAST(CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' + 
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00' AS DATETIME)
      )
      SELECT 
        CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER, TIMEHOUR, Loading_Count AS COUNT
      FROM HourlySummary
      ORDER BY HourTime;
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool.request();

    request.input("stationCode", sql.Int, parseInt(stationCode));
    request.input("startDate", sql.DateTime, istStart);
    request.input("endDate", sql.DateTime, istEnd);

    if (model && model !== "0") {
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

export const getHourlyModelCount = async (req, res) => {
  const { stationCode, startDate, endDate, model, line } = req.query;

  if (!stationCode || !startDate || !endDate) {
    return res.status(400).send("Missing stationCode, startDate, or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    let categoryCondition = "";
    let userRoleCondition = "";
    let stationCodeCondition = "= @stationCode"; // default single station

    if (stationCode == 1220010) {
      if (line == "1") {
        categoryCondition =
          " AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005) ";
      } else if (line == "2") {
        categoryCondition = " AND m.Category in (1240001, 1250005) ";
      }
    } else if (stationCode == 1220005) {
      if (line == "1") {
        categoryCondition =
          " AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005) ";
      } else if (line == "2") {
        categoryCondition = " AND m.Category in (1240001, 1250005) ";
      }
    } else if (stationCode == 1230017) {
      categoryCondition =
        " AND m.Category in (1230003, 1230004, 1230009, 1230010, 1250004) ";
    }

    if (stationCode == 1220010) {
      if (line == "1") {
        userRoleCondition = " And u.UserRole = 224006 ";
      } else if (line == "2") {
        userRoleCondition = " AND u.UserRole = 224007 ";
      }
    } else if (stationCode == 1220005) {
      if (line == "1") {
        userRoleCondition = " And u.UserRole = 225002 ";
      } else if (line == "2") {
        userRoleCondition = " AND u.UserRole = 225001 ";
      }
    }

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Alias, Type
        FROM MaterialBarcode
        WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
      ),
      HourlySummary AS (
        SELECT 
          Psno.DocNo,
          Psno.Material,
          Psno.Serial,
          Psno.VSerial,
          Psno.Alias,
          Psno.Type,
          b.StationCode,
          c.Name AS Station_Name,
          b.ActivityOn,
          DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
          b.Operator,
          m.Name AS Material_Name
        FROM Psno
        JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
        JOIN WorkCenter c ON b.StationCode = c.StationCode
        JOIN Material m ON Psno.Material = m.MatCode
        JOIN Users u ON b.Operator = u.UserCode
        WHERE 
          c.StationCode = @stationCode AND
          b.ActivityType = 5 AND
          b.ActivityOn BETWEEN @startDate AND @endDate
           ${model && model !== "0" ? "AND Psno.Material = @model" : ""}
           ${categoryCondition}
           ${userRoleCondition}
      ),
      HourlyCount AS (
        SELECT TIMEHOUR, Material_Name, COUNT(*) AS Loading_Count
      FROM HourlySummary
      GROUP BY TIMEHOUR, Material_Name
      )
      SELECT TIMEHOUR, Material_Name, Loading_Count AS COUNT
      FROM HourlyCount
      ORDER BY TIMEHOUR, Material_Name;
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool.request();

    request.input("stationCode", sql.Int, parseInt(stationCode));
    request.input("startDate", sql.DateTime, istStart);
    request.input("endDate", sql.DateTime, istEnd);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);
    res.status(200).json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getHourlyCategoryCount = async (req, res) => {
  const { stationCode, startDate, endDate, model, line } = req.query;

  if (!stationCode || !startDate || !endDate) {
    return res.status(400).send("Missing stationCode, startDate or endDate.");
  }

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    let categoryCondition = "";
    let userRoleCondition = "";
    let stationCodeCondition = "= @stationCode"; // default single station

    if (stationCode == 1220010) {
      if (line == "1") {
        categoryCondition =
          " AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005) ";
      } else if (line == "2") {
        categoryCondition = " AND m.Category in (1240001, 1250005) ";
      }
    } else if (stationCode == 1220005) {
      if (line == "1") {
        categoryCondition =
          " AND m.Category in (1220005,	1220010,	1220012,	1220016,	1220017,	1220018,	1220019,	1220020,	1220021,	1220022,	1220023,	1230008,	1250005) ";
      } else if (line == "2") {
        categoryCondition = " AND m.Category in (1240001, 1250005) ";
      }
    } else if (stationCode == 1230017) {
      categoryCondition =
        " AND m.Category in (1230003, 1230004, 1230009, 1230010, 1250004) ";
    }

    if (stationCode == 1220010) {
      if (line == "1") {
        userRoleCondition = " And u.UserRole = 224006 ";
      } else if (line == "2") {
        userRoleCondition = " AND u.UserRole = 224007 ";
      }
    } else if (stationCode == 1220005) {
      if (line == "1") {
        userRoleCondition = " And u.UserRole = 225002 ";
      } else if (line == "2") {
        userRoleCondition = " AND u.UserRole = 225001 ";
      }
    }

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Alias, Type
        FROM MaterialBarcode
        WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
      ),
      HourlySummary AS (
        SELECT 
          Psno.DocNo,
          Psno.Material,
          Psno.Serial,
          Psno.VSerial,
          Psno.Alias,
          Psno.Type,
          b.StationCode,
          c.Name AS Station_Name,
          b.ActivityOn,
          DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
          b.Operator,
          m.Name AS Material_Name,
          mc.Alias AS category
        FROM Psno
        JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
        JOIN WorkCenter c ON b.StationCode = c.StationCode
        JOIN Material m ON Psno.Material = m.MatCode
        JOIN Users u ON b.Operator = u.UserCode
        JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
        WHERE 
          c.StationCode = @stationCode
          AND b.ActivityType = 5
          AND b.ActivityOn BETWEEN @startDate AND @endDate
          ${model && model !== "0" ? "AND Psno.Material = @model" : ""}
          ${categoryCondition}
          ${userRoleCondition}
      ),
      HourlyCount AS (
        SELECT TIMEHOUR, category, COUNT(*) AS Loading_Count
        FROM HourlySummary
        GROUP BY TIMEHOUR, category
      )
      SELECT TIMEHOUR, category, Loading_Count AS COUNT
      FROM HourlyCount
      ORDER BY TIMEHOUR, category;
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool.request();

    request.input("stationCode", sql.Int, parseInt(stationCode));
    request.input("startDate", sql.DateTime, istStart);
    request.input("endDate", sql.DateTime, istEnd);
    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);
    res.status(200).json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
