import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getFpaCount = tryCatch(async (_, res) => {
  const now = new Date();

  // Set start date: today at 08:00:00
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0
  );

  // Set end date: tomorrow at 20:00:00
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    20,
    0,
    0
  );
  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const query = `
    WITH DUMDATA AS (
    SELECT 
        a.PSNo, 
        c.Name, 
        b.Material, 
        a.StationCode, 
        a.ProcessCode, 
        a.ActivityOn, 
        DATEPART(HOUR, ActivityOn) AS TIMEHOUR, 
        DATEPART(DAY, ActivityOn) AS TIMEDAY, 
        ActivityType, 
        b.Type
    FROM ProcessActivity a
    INNER JOIN MaterialBarcode b ON a.PSNo = b.DocNo
    INNER JOIN Material c ON b.Material = c.MatCode
    WHERE
        a.StationCode IN (1220010, 1230017)
        AND a.ActivityType = 5
        AND a.ActivityOn BETWEEN @StartDate AND @EndDate
        AND b.Type NOT IN (0, 200)
),
FPA_DATA AS (
    SELECT 
        dd.Name AS [ModelName],  
        COUNT(dd.Name) AS ModelCount,
        CASE 
            WHEN COUNT(dd.Name) < 10 THEN 0
            ELSE ((COUNT(dd.Name) - 1) / 100) + 1
        END AS FPA
    FROM DUMDATA dd
    GROUP BY dd.Name
),
FINAL_DATA AS (
    SELECT 
        fd.[ModelName], 
        fd.ModelCount, 
        fd.FPA,
        ISNULL(fp.[SampleInspected], 0) AS [SampleInspected]
    FROM FPA_DATA fd
    LEFT JOIN (
        SELECT 
            Model, 
            COUNT(DISTINCT FGSRNo) AS [SampleInspected]
        FROM FPAReport
        WHERE [Date] BETWEEN @StartDate AND @EndDate
        GROUP BY Model
    ) fp ON fd.[ModelName] = fp.Model
)
SELECT 
    [ModelName], 
    ModelCount, 
    FPA, 
    [SampleInspected]
FROM FINAL_DATA
WHERE FPA > 0
ORDER BY ModelCount;

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
      message: "FPA Count data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPA Count data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getAssetDetails = tryCatch(async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    throw new AppError(
      "Missing required query parameters: assemblySerial.",
      400
    );
  }

  const query = `
    SELECT 
      mb.Serial + '~' + mb.VSerial + '~' + m.Alias AS combinedserial
    FROM 
      MaterialBarcode AS mb
    INNER JOIN 
      Material AS m ON m.MatCode = mb.Material
    WHERE 
      mb.Alias = @AssemblySerial;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(query);

    const combined = result.recordset[0]?.combinedserial;

    if (!combined) {
      return res.json({ FGNo: null, AssetNo: null, ModelName: null });
    }

    const [FGNo, AssetNo, ModelName] = combined.split("~");

    res.status(200).json({
      success: true,
      message: "Asset Details data retrieved successfully.",
      FGNo,
      AssetNo,
      ModelName,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Asset Details data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFPQIDetails = tryCatch(async (_, res) => {
  const now = new Date();
  // Set start date: today at 08:00:00
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0
  );

  // Set end date: tomorrow at 20:00:00
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    20,
    0,
    0
  );

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const query = `
    SELECT 
      COUNT(DISTINCT FGSRNo) AS TotalFGSRNo,
      SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) AS NoOfCritical,
      SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) AS NoOfMajor,
      SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) AS NoOfMinor,
      CAST((
          (SUM(CASE WHEN Category = 'Critical' THEN 1 ELSE 0 END) * 9) + 
          (SUM(CASE WHEN Category = 'Major' THEN 1 ELSE 0 END) * 6) + 
          (SUM(CASE WHEN Category = 'Minor' THEN 1 ELSE 0 END) * 1)
      ) AS FLOAT) / NULLIF(COUNT(DISTINCT FGSRNo), 0) AS FPQI
    FROM FPAReport
    WHERE Date Between @startDate and @endDate;
  `;

  const pool = await sql.connect(dbConfig1);

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    if (!result.recordset.length) {
      return res.json({
        TotalFGSRNo: 0,
        NoOfCritical: 0,
        NoOfMajor: 0,
        NoOfMinor: 0,
        FPQI: 0,
      });
    }

    res.status(200).json({
      success: true,
      message: "FPQI Details data retrieved successfully.",
      data: result.recordset[0],
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPQI Details data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getFpaDefect = tryCatch(async (_, res) => {
  const now = new Date();

  // Set start date: today at 08:00:00
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8,
    0,
    0
  );

  // Set end date: tomorrow at 20:00:00
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    20,
    0,
    0
  );

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  const query = `
    Select * from FPAReport 
    Where Date Between @StartDate and @EndDate
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FPA Defect data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPA Defect data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getDefectCategory = tryCatch(async (_, res) => {
  const query = `
    Select Code, Name from DefectCodeMaster
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Defect Category data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Defect Category data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const addDefect = tryCatch(async (req, res) => {
  const {
    model,
    shift,
    FGSerialNumber,
    Category,
    AddDefect,
    Remark,
    currentDateTime,
    country,
  } = req.body;

  // Get filename generated by Multer
  const fileName = req.file?.filename || null;

  if (!model || !FGSerialNumber) {
    throw new AppError(
      "Missing required query parameters: model or fgSerialNumber.",
      400
    );
  }

  const currDate = new Date(new Date(currentDateTime).getTime() + 330 * 60000);

  const pool = await sql.connect(dbConfig1);

  try {
    const request = pool.request();
    request.input("Date", sql.DateTime, currDate);
    request.input("Model", sql.NVarChar, model?.trim() || null);
    request.input("Shift", sql.NVarChar, shift?.trim() || null);
    request.input("FGSRNo", sql.NVarChar, FGSerialNumber?.trim() || null);
    request.input("Country", sql.NVarChar, country?.trim() || null);
    request.input("Category", sql.NVarChar, Category?.trim() || null);
    request.input("AddDefect", sql.NVarChar, AddDefect?.trim() || null);
    request.input("Remark", sql.NVarChar, Remark?.trim() || null);

    let insertQuery;

    if (fileName) {
      insertQuery = `
        INSERT INTO FPAReport
        (Date, Model, Shift, FGSRNo, Country, Category, AddDefect, Remark, DefectImage)
        VALUES (@Date, @Model, @Shift, @FGSRNo, @Country, @Category, @AddDefect, @Remark, @DefectImage)
      `;
      request.input("DefectImage", sql.NVarChar, fileName);
    } else {
      insertQuery = `
        INSERT INTO FPAReport
        (Date, Model, Shift, FGSRNo, Country, Category, AddDefect, Remark)
        VALUES (@Date, @Model, @Shift, @FGSRNo, @Country, @Category, @AddDefect, @Remark)
      `;
    }

    await request.query(insertQuery);

    res.status(200).json({
      success: true,
      message: "Defect added successfully",
      fileUrl: fileName ? `/uploads/FpaDefectImages/${fileName}` : null,
    });
  } catch (error) {
    throw new AppError(`Failed to add the defect:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});
