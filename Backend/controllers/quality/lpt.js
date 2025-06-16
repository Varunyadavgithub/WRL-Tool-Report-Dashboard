import sql, { dbConfig1 } from "../../config/db.js";

export const getLptAssetDetails = async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    return res.status(400).send("Missing AssemblySerial.");
  }

  try {
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
    
    const result = await pool
    .request()
    .input("AssemblySerial", sql.VarChar, AssemblySerial)
    .query(query);
    
    const data = result?.recordset[0] || null;

    res.json({ success: true, data });
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: "~" + err.message });
  }
};

export const getLptDefectCategory = async (_, res) => {
  try {
    const query = `
        Select Code, Name from DefectCodeMaster where DefectCategory = 104
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

export const addLptDefect = async (req, res) => {
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

  try {
    // Convert to IST (UTC+5:30)
    const currDate = new Date(
      new Date(currentDateTime).getTime() + 330 * 60000
    );

    const query = `
      INSERT INTO LPTReport
      (DateTime, Shift, ModelName, AssemblyNo, Defect, Remark, MinTemp, MaxTemp, ActualTemp, MinCurrent, MaxCurrent, ActualCurrent, MinPower, MaxPower, ActualPower, Performance)
      VALUES 
      (@DateTime, @Shift, @ModelName, @AssemblyNo, @Defect, @Remark, @MinTemp, @MaxTemp, @ActualTemp, @MinCurrent, @MaxCurrent, @ActualCurrent, @MinPower, @MaxPower, @ActualPower, @Performance)
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool.request();

    request.input("DateTime", sql.DateTime, currDate);
    request.input("Shift", sql.NVarChar, shift?.trim() || null);
    request.input("ModelName", sql.NVarChar, ModelName?.trim() || null);
    request.input("AssemblyNo", sql.NVarChar, AssemblyNo?.trim() || null);
    request.input("Defect", sql.NVarChar, AddDefect?.trim() || null);
    request.input("Remark", sql.NVarChar, Remark?.trim() || null);
    request.input("MinTemp", sql.NVarChar, MinTemp ?? null);
    request.input("MaxTemp", sql.NVarChar, MaxTemp ?? null);
    request.input("ActualTemp", sql.NVarChar, ActualTemp ?? null);
    request.input("MinCurrent", sql.NVarChar, MinCurrent ?? null);
    request.input("MaxCurrent", sql.NVarChar, MaxCurrent ?? null);
    request.input("ActualCurrent", sql.NVarChar, ActualCurrent ?? null);
    request.input("MinPower", sql.NVarChar, MinPower ?? null);
    request.input("MaxPower", sql.NVarChar, MaxPower ?? null);
    request.input("ActualPower", sql.NVarChar, ActualPower ?? null);
    request.input("Performance", sql.NVarChar, Performance ?? null);
    request.input("Category", sql.NVarChar, Category?.trim() || null);

    await request.query(query);

    res
      .status(200)
      .json({ success: true, message: "Defect added successfully." });
  } catch (error) {
    console.error("Error inserting defect:", error);
    res
      .status(500)
      .json({ message: "Failed to add defect", error: error.message });
  }
};

export const getLptDefectReport = async (req, res) => {
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
    Select * from LPTReport WHERE DateTime BETWEEN @StartDate AND @EndDate
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

export const getLptDefectCount = async (req, res) => {
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
   WITH FPA_COMPUTED AS (
    SELECT 
        c.Name AS ModelName,
        COUNT(*) AS ModelCount,
        CEILING(COUNT(*) * 1.0 / 100) AS LPT
    FROM ProcessActivity a
    INNER JOIN MaterialBarcode b ON a.PSNo = b.DocNo
    INNER JOIN Material c ON b.Material = c.MatCode
    WHERE 
        a.StationCode IN (1220010, 1230017)
        AND a.ActivityType = 5
        AND a.ActivityOn BETWEEN @StartDate AND @EndDate
        AND b.Type NOT IN (0, 200)
    GROUP BY c.Name
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
