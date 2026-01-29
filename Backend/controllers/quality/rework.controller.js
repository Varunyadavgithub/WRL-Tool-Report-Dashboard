import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

/* =========================================================
   GET MODEL & CATEGORY BY ASSEMBLY SERIAL
========================================================= */
export const getReworkEntryDetailsByAssemblySerial = tryCatch(
  async (req, res) => {
    const { AssemblySerial } = req.query;

    if (!AssemblySerial) {
      throw new AppError(
        "Missing required query parameters: assemblySerial.",
        400
      );
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

      res.status(200).json({
        success: true,
        message: "Rework Entry Details data retrieved successfully.",
        data: result.recordset[0],
      });
    } catch (error) {
      throw new AppError(
        `Failed to fetch the Rework Entry Details By Assembly Serial data:${error.message}`,
        500
      );
    } finally {
      await pool.close();
    }
  }
);

/* =========================================================
   REWORK IN  → INSERT NEW ROW
========================================================= */
export const createReworkInEntry = tryCatch(async (req, res) => {
  const { AssemblySerial, ModelName, Category, Defect, Part, Shift, UserCode } =
    req.body;

  if (!AssemblySerial || !Defect || !Part || !Shift) {
    throw new AppError(
      "Missing required fields: AssemblySerial, Defect, Part or Shift.",
      400
    );
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig1);

    // Prevent duplicate active IN
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
      return res
        .status(409)
        .json({ message: "Rework IN already exists for this Serial Number" });
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
        Usercode,
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
        @Usercode,
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
      .input("Usercode", sql.VarChar, UserCode ? String(UserCode) : "Unknown")
      .query(insertQuery);

    res.status(201).json({ message: "Rework IN completed successfully" });
  } catch (error) {
    throw new AppError(
      `Failed to create the Rework In Entry data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

/* =========================================================
   REWORK OUT  → UPDATE EXISTING IN ROW
========================================================= */
export const createReworkOutEntry = tryCatch(async (req, res) => {
  const {
    AssemblySerial,
    RootCause,
    FailCategory,
    Origin,
    ContainmentAction,
    UserCode,
  } = req.body;

  if (
    !AssemblySerial ||
    !RootCause ||
    !FailCategory ||
    !Origin ||
    !ContainmentAction
  ) {
    throw new AppError(
      "Missing required fields: AssemblySerial, RootCause, FailCategory, Origin or ContainmentAction.",
      400
    );
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
        Usercode = @Usercode,
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
      .input("Usercode", sql.VarChar, UserCode ? String(UserCode) : "Unknown")
      .query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ message: "No active Rework IN found for this Serial Number" });
    }

    res.status(200).json({ message: "Rework OUT completed successfully" });
  } catch (error) {
    throw new AppError(
      `Failed to create Rework Out Entry data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

/* =========================================================
   REWORK REPORT  → GET REWORK REPORT
========================================================= */
export const getReworkReport = tryCatch(async (req, res) => {
  const { stage, lineType, startTime, endTime } = req.query;

  if (!stage || !lineType || !startTime || !endTime) {
    throw new AppError(
      "Missing required query parameters: starstage, lineType, startTime or endTime.",
      400
    );
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig1);

    let filters = [];
    if (stage) filters.push(`Category = @stage`);
    if (lineType) filters.push(`Shift LIKE @lineType + '%'`);
    if (startTime) filters.push(`ReworkInAt >= @startTime`);
    if (endTime) filters.push(`ReworkInAt <= @endTime`);

    const whereClause = filters.length ? "WHERE " + filters.join(" AND ") : "";

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
        Usercode,
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

    res.status(200).json({
      success: true,
      message: "Rework Report data retrieved successfully.",
      totalCount: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Rework Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
