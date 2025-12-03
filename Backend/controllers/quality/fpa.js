import sql, { dbConfig1 } from "../../config/db.js";

export const getFpaCount = async (_, res) => {
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

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool
      .request()
      .input("StartDate", sql.DateTime, istStart)
      .input("EndDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getAssetDetails = async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    return res.status(400).send("Missing AssemblySerial.");
  }

  try {
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

    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(query);

    const combined = result.recordset[0]?.combinedserial;

    if (!combined) {
      return res.json({ FGNo: null, AssetNo: null, ModelName: null });
    }

    const [FGNo, AssetNo, ModelName] = combined.split("~");

    res.json({ FGNo, AssetNo, ModelName });
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ combinedserial: "~" + err.message });
  }
};

export const getFPQIDetails = async (_, res) => {
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

  // Report date: just today's date
  const reportDateStr = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  try {
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

    res.json(result.recordset[0]);

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getFpaDefect = async (_, res) => {
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

  // Report date: just today's date
  const reportDateStr = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  try {
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const query = `
    Select * from FPAReport where Date Between @StartDate and @EndDate
  `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getDefectCategory = async (_, res) => {
  try {
    const query = `
    Select Code, Name from DefectCodeMaster
  `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool.request().query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const addDefect = async (req, res) => {
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
    return res
      .status(400)
      .json({ success: false, message: "Required fields missing" });
  }

  const currDate = new Date(new Date(currentDateTime).getTime() + 330 * 60000);

  try {
    const pool = await sql.connect(dbConfig1);

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
    await pool.close();

    res.status(200).json({
      success: true,
      message: "Defect added successfully",
      fileUrl: fileName ? `/uploads/FpaDefectImages/${fileName}` : null,
    });
  } catch (err) {
    console.error("Error adding defect:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};