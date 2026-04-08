import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// ─── Shared helper: today 08:00 → tomorrow 20:00 in IST ──────────────────────
const getShiftWindow = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  const endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0, 0);
  return {
    istStart: convertToIST(startDate),
    istEnd:   convertToIST(endDate),
  };
};

// ─── getFpaCount ──────────────────────────────────────────────────────────────
export const getFpaCount = tryCatch(async (_, res) => {
  const { istStart, istEnd } = getShiftWindow();

  const query = `
    WITH DUMDATA AS (
      SELECT
        a.PSNo, c.Name, b.Material,
        a.StationCode, a.ProcessCode, a.ActivityOn,
        DATEPART(HOUR, ActivityOn) AS TIMEHOUR,
        DATEPART(DAY,  ActivityOn) AS TIMEDAY,
        ActivityType, b.Type
      FROM ProcessActivity a
      INNER JOIN MaterialBarcode b ON a.PSNo   = b.DocNo
      INNER JOIN Material        c ON b.Material = c.MatCode
      WHERE
        a.StationCode IN (1220010, 1230017)
        AND a.ActivityType = 5
        AND a.ActivityOn   BETWEEN @StartDate AND @EndDate
        AND b.Type         NOT IN (0, 200)
    ),
    FPA_DATA AS (
      SELECT
        dd.Name AS ModelName,
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
        fd.ModelName,
        fd.ModelCount,
        fd.FPA,
        ISNULL(fp.SampleInspected, 0) AS SampleInspected
      FROM FPA_DATA fd
      LEFT JOIN (
        SELECT Model, COUNT(DISTINCT FGSRNo) AS SampleInspected
        FROM   FPAReport
        WHERE  [Date] BETWEEN @StartDate AND @EndDate
        GROUP BY Model
      ) fp ON fd.ModelName = fp.Model
    )
    SELECT ModelName, ModelCount, FPA, SampleInspected
    FROM   FINAL_DATA
    WHERE  FPA > 0
    ORDER BY ModelCount;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool
      .request()
      .input("StartDate", sql.DateTime, istStart)
      .input("EndDate",   sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FPA Count data retrieved successfully.",
      data:    result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch FPA Count data: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ─── getAssetDetails ──────────────────────────────────────────────────────────
export const getAssetDetails = tryCatch(async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial?.trim()) {
    throw new AppError("Missing required query parameter: AssemblySerial.", 400);
  }

  const query = `
    SELECT mb.Serial + '~' + mb.VSerial + '~' + m.Alias AS combinedserial
    FROM   MaterialBarcode AS mb
    INNER JOIN Material    AS m ON m.MatCode = mb.Material
    WHERE  mb.Alias = @AssemblySerial;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result   = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial.trim())
      .query(query);

    const combined = result.recordset[0]?.combinedserial;

    if (!combined) {
      // Return 200 with nulls so the frontend can handle gracefully
      return res.status(200).json({ success: false, FGNo: null, AssetNo: null, ModelName: null });
    }

    const [FGNo, AssetNo, ModelName] = combined.split("~");

    res.status(200).json({
      success:   true,
      message:   "Asset Details retrieved successfully.",
      FGNo,
      AssetNo,
      ModelName,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch Asset Details: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ─── getFPQIDetails ───────────────────────────────────────────────────────────
export const getFPQIDetails = tryCatch(async (_, res) => {
  const { istStart, istEnd } = getShiftWindow();

  const query = `
    SELECT
      COUNT(DISTINCT FGSRNo)                                                              AS TotalFGSRNo,
      SUM(CASE WHEN Category = 'critical'   THEN 1 ELSE 0 END)                           AS NoOfCritical,
      SUM(CASE WHEN Category = 'major'      THEN 1 ELSE 0 END)                           AS NoOfMajor,
      SUM(CASE WHEN Category = 'minor'      THEN 1 ELSE 0 END)                           AS NoOfMinor,
      CAST(
        (
          (SUM(CASE WHEN Category = 'critical' THEN 1 ELSE 0 END) * 9) +
          (SUM(CASE WHEN Category = 'major'    THEN 1 ELSE 0 END) * 6) +
          (SUM(CASE WHEN Category = 'minor'    THEN 1 ELSE 0 END) * 1)
        ) AS FLOAT
      ) / NULLIF(COUNT(DISTINCT FGSRNo), 0)                                              AS FPQI
    FROM FPAReport
    WHERE [Date] BETWEEN @StartDate AND @EndDate;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool
      .request()
      .input("StartDate", sql.DateTime, istStart)
      .input("EndDate",   sql.DateTime, istEnd)
      .query(query);

    const row = result.recordset[0];

    // Return zeros if nothing in shift window
    res.status(200).json({
      success: true,
      message: "FPQI Details retrieved successfully.",
      data:    row ?? { TotalFGSRNo: 0, NoOfCritical: 0, NoOfMajor: 0, NoOfMinor: 0, FPQI: 0 },
    });
  } catch (error) {
    throw new AppError(`Failed to fetch FPQI Details: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ─── getFpaDefect ─────────────────────────────────────────────────────────────
export const getFpaDefect = tryCatch(async (_, res) => {
  const { istStart, istEnd } = getShiftWindow();

  // BUG FIX: previous version used @StartDate in SQL but .input("startDate") —
  // parameter names are now consistently PascalCase throughout.
  const query = `
    SELECT *
    FROM   FPAReport
    WHERE  [Date] BETWEEN @StartDate AND @EndDate
    ORDER  BY [Date] DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool
      .request()
      .input("StartDate", sql.DateTime, istStart)
      .input("EndDate",   sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FPA Defect data retrieved successfully.",
      data:    result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch FPA Defect data: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ─── getDefectCategory ────────────────────────────────────────────────────────
export const getDefectCategory = tryCatch(async (_, res) => {
  const query = `SELECT Code, Name FROM DefectCodeMaster ORDER BY Name;`;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Defect Category data retrieved successfully.",
      data:    result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch Defect Category data: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ─── addDefect ────────────────────────────────────────────────────────────────
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

  const fileName = req.file?.filename ?? null;

  if (!model?.trim() || !FGSerialNumber?.trim()) {
    throw new AppError("Missing required fields: model or FGSerialNumber.", 400);
  }

  if (!Category?.trim()) {
    throw new AppError("Missing required field: Category.", 400);
  }

  const currDate = convertToIST(currentDateTime);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const request = pool.request();
    request.input("Date",          sql.DateTime,  currDate);
    request.input("Model",         sql.NVarChar,  model.trim());
    request.input("Shift",         sql.NVarChar,  shift?.trim()         ?? null);
    request.input("FGSRNo",        sql.NVarChar,  FGSerialNumber.trim());
    request.input("Country",       sql.NVarChar,  country?.trim()       ?? null);
    request.input("Category",      sql.NVarChar,  Category.trim());
    request.input("AddDefect",     sql.NVarChar,  AddDefect?.trim()     ?? null);
    request.input("Remark",        sql.NVarChar,  Remark?.trim()        ?? null);

    let insertQuery;
    if (fileName) {
      request.input("DefectImage", sql.NVarChar, fileName);
      insertQuery = `
        INSERT INTO FPAReport (Date, Model, Shift, FGSRNo, Country, Category, AddDefect, Remark, DefectImage)
        VALUES (@Date, @Model, @Shift, @FGSRNo, @Country, @Category, @AddDefect, @Remark, @DefectImage);
      `;
    } else {
      insertQuery = `
        INSERT INTO FPAReport (Date, Model, Shift, FGSRNo, Country, Category, AddDefect, Remark)
        VALUES (@Date, @Model, @Shift, @FGSRNo, @Country, @Category, @AddDefect, @Remark);
      `;
    }

    await request.query(insertQuery);

    res.status(200).json({
      success: true,
      message: "Defect added successfully.",
      fileUrl: fileName ? `/uploads/FpaDefectImages/${fileName}` : null,
    });
  } catch (error) {
    throw new AppError(`Failed to add defect: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});