import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

export const getLptAssetDetails = tryCatch(async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    throw new AppError(
      "Missing required query parameters: assemblySerial.",
      400,
    );
  }

  const query = `
SELECT 
    m.Name as ModelName,
    r.MinTemp,
    r.MaxTemp,
    r.MinCurrent,
    r.MaxCurrent,
    r.MinPower,
    r.MaxPower
FROM 
    MaterialBarcode mb
JOIN 
    Material m ON m.MatCode = mb.Material
JOIN 
    LPTRecipe r ON r.Matcode = m.MatCode
WHERE 
        mb.Serial = @AssemblySerial
        OR mb.Alias = @AssemblySerial;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(query);

    const data = result?.recordset[0] || null;

    res.status(200).json({
      success: true,
      message: "LPT Asset Details data retrieved successfully.",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the LPT Asset Details data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const getLptDefectCategory = tryCatch(async (_, res) => {
  const query = `
    Select Code, Name from DefectCodeMaster 
    Where DefectCategory = 104
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Lpt Defect Category data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Lpt Defect Category data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const addLptDefect = tryCatch(async (req, res) => {
  const {
    AssemblyNo,
    ModelName,
    MinTemp,
    MaxTemp,
    ActualTemp,
    MinCurrent,
    MaxCurrent,
    ActualCurrent,
    MinPower,
    MaxPower,
    ActualPower,
    AddDefect,
    Category,
    Remark,
    Performance,
    currentDateTime,
    shift,
  } = req.body;

  // Convert to IST (UTC+5:30)
  const currDate = convertToIST(currentDateTime);

  const query = `
      INSERT INTO LPTReport
      (DateTime, Shift, ModelName, AssemblyNo, Defect, Remark, MinTemp, MaxTemp, ActualTemp, MinCurrent, MaxCurrent, ActualCurrent, MinPower, MaxPower, ActualPower, Performance)
      VALUES 
      (@DateTime, @Shift, @ModelName, @AssemblyNo, @Defect, @Remark, @MinTemp, @MaxTemp, @ActualTemp, @MinCurrent, @MaxCurrent, @ActualCurrent, @MinPower, @MaxPower, @ActualPower, @Performance)
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("DateTime", sql.DateTime, currDate)
      .input("Shift", sql.NVarChar, shift?.trim() || null)
      .input("ModelName", sql.NVarChar, ModelName?.trim() || null)
      .input("AssemblyNo", sql.NVarChar, AssemblyNo?.trim() || null)
      .input("Defect", sql.NVarChar, AddDefect?.trim() || null)
      .input("Remark", sql.NVarChar, Remark?.trim() || null)
      .input("MinTemp", sql.NVarChar, MinTemp ?? null)
      .input("MaxTemp", sql.NVarChar, MaxTemp ?? null)
      .input("ActualTemp", sql.NVarChar, ActualTemp ?? null)
      .input("MinCurrent", sql.NVarChar, MinCurrent ?? null)
      .input("MaxCurrent", sql.NVarChar, MaxCurrent ?? null)
      .input("ActualCurrent", sql.NVarChar, ActualCurrent ?? null)
      .input("MinPower", sql.NVarChar, MinPower ?? null)
      .input("MaxPower", sql.NVarChar, MaxPower ?? null)
      .input("ActualPower", sql.NVarChar, ActualPower ?? null)
      .input("Performance", sql.NVarChar, Performance ?? null)
      .input("Category", sql.NVarChar, Category?.trim() || null);

    await request.query(query);

    res
      .status(200)
      .json({ success: true, message: "LPT Defect added successfully." });
  } catch (error) {
    throw new AppError(
      `Failed to add the LPT Defect data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const getLptDefectReport = tryCatch(async (req, res) => {
  const now = new Date();

  // Set start date: today at 08:00:00
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
  );

  // Set end date: tomorrow at 20:00:00
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    20,
    0,
    0,
  );
  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
    Select * from LPTReport 
    Where DateTime BETWEEN @StartDate AND @EndDate
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("StartDate", sql.DateTime, istStart)
      .input("EndDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "LPT Defect Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the LPT Defect Report data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const getLptDefectCount = tryCatch(async (req, res) => {
  const now = new Date();

  // Set start date: today at 08:00:00
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0,
  );

  // Set end date: tomorrow at 20:00:00
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    20,
    0,
    0,
  );
  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
WITH FPA_COMPUTED AS (
    SELECT 
        c.Name AS ModelName,
        cnt.ModelCount,
        CASE 
            WHEN cnt.ModelCount <= 10 THEN 0
            ELSE CEILING((cnt.ModelCount - 10) / 10.0)
        END AS LPT
    FROM (
        SELECT 
            b.Material,
            COUNT(*) AS ModelCount
        FROM ProcessActivity a
        INNER JOIN MaterialBarcode b ON a.PSNo = b.DocNo
        WHERE 
            a.StationCode IN (1220014)
            AND a.ActivityType = 5
            AND a.ActivityOn BETWEEN @StartDate AND @EndDate
            AND b.Type NOT IN (0, 200)
        GROUP BY b.Material
    ) AS cnt
    INNER JOIN Material c ON cnt.Material = c.MatCode
),
SAMPLE_INSPECTED AS (
    SELECT 
        ModelName, 
        COUNT(DISTINCT AssemblyNo) AS SampleInspected
    FROM LPTReport
    WHERE DateTime BETWEEN @StartDate AND @EndDate
    GROUP BY ModelName
)
SELECT 
    f.ModelName, 
    f.ModelCount, 
    f.LPT, 
    ISNULL(s.SampleInspected, 0) AS SampleInspected,
    (f.LPT - ISNULL(s.SampleInspected, 0)) AS PendingSample,
    CAST((ISNULL(s.SampleInspected, 0) * 100.0) / NULLIF(f.LPT, 0) AS DECIMAL(5,2)) AS [LPT_Percentage]
FROM FPA_COMPUTED f
LEFT JOIN SAMPLE_INSPECTED s ON f.ModelName = s.ModelName
WHERE f.LPT > 0
ORDER BY f.ModelCount;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("StartDate", sql.DateTime, istStart)
      .input("EndDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Lpt Defect Count data retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Lpt Defect Count data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
