import sql, { dbConfig1 } from "../../config/db.js";

/* =========================================================
   GET MODEL & CATEGORY BY ASSEMBLY SERIAL
========================================================= */
export const getReworkEntryDetailsByAssemblySerial = async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    return res.status(400).json({ message: "AssemblySerial is required" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig1);

    const query = `
      SELECT
        mb.Serial AS modelName,
        mc.Name AS category
      FROM MaterialBarcode mb
      INNER JOIN Material m ON m.MatCode = mb.Material
      INNER JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
      WHERE mb.Alias = @AssemblySerial;
    `;

    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(query);

    if (!result.recordset.length) {
      return res.json({ modelName: null, category: null });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ message: "Failed to fetch details" });
  } finally {
    if (pool) await pool.close();
  }
};

/* =========================================================
   REWORK IN  → INSERT NEW ROW
========================================================= */
export const createReworkInEntry = async (req, res) => {
  const { AssemblySerial, ModelName, Category, Defect, Part, Shift } = req.body;

  if (!AssemblySerial || !Defect || !Part || !Shift) {
    return res.status(400).json({
      message: "Missing required Rework IN fields",
    });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig1);

    // 🔒 Prevent duplicate active IN
    const checkQuery = `
      SELECT 1
      FROM ReworkEntry
      WHERE SerialNumber = @AssemblySerial
        AND Status = 'IN';
    `;

    const checkResult = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(checkQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(409).json({
        message: "Rework IN already exists for this Serial Number",
      });
    }

    const insertQuery = `
      INSERT INTO ReworkEntry
      (
        SerialNumber,
        ModelName,
        Category,
        Defect,
        Part,
        Shift,
        ReworkInAt,
        Status
      )
      VALUES
      (
        @AssemblySerial,
        @ModelName,
        @Category,
        @Defect,
        @Part,
        @Shift,
        GETDATE(),
        'IN'
      );
    `;

    await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .input("ModelName", sql.VarChar, ModelName)
      .input("Category", sql.VarChar, Category)
      .input("Defect", sql.VarChar, Defect)
      .input("Part", sql.VarChar, Part)
      .input("Shift", sql.VarChar, Shift)
      .query(insertQuery);

    res.status(201).json({
      message: "Rework IN completed successfully",
    });
  } catch (error) {
    console.error("Rework IN Error:", error.message);
    res.status(500).json({
      message: "Failed to create Rework IN entry",
    });
  } finally {
    if (pool) await pool.close();
  }
};

/* =========================================================
   REWORK OUT  → UPDATE EXISTING IN ROW
========================================================= */
export const createReworkOutEntry = async (req, res) => {
  const { AssemblySerial, RootCause, FailCategory, Origin, ContainmentAction } =
    req.body;

  if (
    !AssemblySerial ||
    !RootCause ||
    !FailCategory ||
    !Origin ||
    !ContainmentAction
  ) {
    return res.status(400).json({
      message: "Missing required Rework OUT fields",
    });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig1);

    const updateQuery = `
      UPDATE ReworkEntry
      SET
        RootCause = @RootCause,
        FailCategory = @FailCategory,
        Origin = @Origin,
        ContainmentAction = @ContainmentAction,
        ReworkOutAt = GETDATE(),
        Status = 'OUT'
      WHERE
        SerialNumber = @AssemblySerial
        AND Status = 'IN';
    `;

    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .input("RootCause", sql.VarChar, RootCause)
      .input("FailCategory", sql.VarChar, FailCategory)
      .input("Origin", sql.VarChar, Origin)
      .input("ContainmentAction", sql.VarChar, ContainmentAction)
      .query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        message: "No active Rework IN found for this Serial Number",
      });
    }

    res.json({
      message: "Rework OUT completed successfully",
    });
  } catch (error) {
    console.error("Rework OUT Error:", error.message);
    res.status(500).json({
      message: "Failed to create Rework OUT entry",
    });
  } finally {
    if (pool) await pool.close();
  }
};

/* =========================================================
   REWORK REPORT  → GET REWORK REPORT
========================================================= */
export const getReworkReport = async (req, res) => {
  const { stage, lineType, startTime, endTime } = req.query;

  let pool;

  try {
    pool = await sql.connect(dbConfig1);

    // ========================= BUILD FILTER =========================
    let filters = [];
    if (stage) filters.push(`Category = @stage`);
    if (lineType) filters.push(`Shift LIKE @lineType + '%'`);
    if (startTime) filters.push(`ReworkInAt >= @startTime`);
    if (endTime) filters.push(`ReworkInAt <= @endTime`);

    const whereClause =
      filters.length > 0 ? "WHERE " + filters.join(" AND ") : "";

    const query = `
      SELECT 
        ReworkID,
        SerialNumber,
        ModelName,
        Category,
        Defect,
        Part,
        RootCause,
        FailCategory,
        Origin,
        ContainmentAction,
        Shift,
        ReworkInAt,
        ReworkOutAt,
        Status
      FROM ReworkEntry
      ${whereClause}
      ORDER BY ReworkInAt DESC
    `;

    const request = pool.request();

    if (stage) request.input("stage", sql.VarChar, stage);
    if (lineType) request.input("lineType", sql.VarChar, lineType);
    if (startTime) request.input("startTime", sql.DateTime, startTime);
    if (endTime) request.input("endTime", sql.DateTime, endTime);

    const result = await request.query(query);

    res.json({
      totalCount: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Rework Report Error:", error.message);
    res.status(500).json({ message: "Failed to fetch Rework Report" });
  } finally {
    if (pool) await pool.close();
  }
};
