import path from "path";
import fs from "fs";
import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { extractBisEnergyData } from "../../utils/bisPdfExtractor.js";

const uploadDir = path.resolve("uploads", "BISReport");

/* ─────────────────────────────────────────────────────────────────────────
   HELPER – IST timestamp
   BUG (was): Date.now() + 330 * 60000 produces a UTC-ms value that is
   numerically IST, but passing it straight through toISOString() then
   re-parsing it drops the offset, making the resulting Date object wrong
   by 5h30m when the JS runtime is not in IST.
   FIX: Use Intl.DateTimeFormat to obtain IST wall-clock parts and build
   a proper Date from them. This is runtime-timezone-agnostic.
──────────────────────────────────────────────────────────────────────────*/
const getISTDate = () => {
  const now = new Date();
  const ist = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const p = Object.fromEntries(ist.map(({ type, value }) => [type, value]));
  // Build as UTC-aligned string that mssql will accept as a DateTime
  return new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`);
};

/* ─────────────────────────────────────────────────────────────────────────
   HELPER – optional pagination
   page/pageSize are both optional query params — when omitted, callers get
   every row (unchanged behavior for existing consumers). When both are
   present, applies OFFSET/FETCH and the response includes a `pagination`
   block with the total row count.
──────────────────────────────────────────────────────────────────────────*/
const parsePagination = (query) => {
  if (query.page == null || query.pageSize == null) return null;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, parseInt(query.pageSize, 10) || 20);
  return { page, pageSize, offset: (page - 1) * pageSize };
};

/* ═══════════════════════════════════════════════════════════════════════
   UPLOAD
═══════════════════════════════════════════════════════════════════════ */
export const uploadBisPdfFile = tryCatch(async (req, res) => {
  const { modelName, year, month, testFrequency, description } = req.body;
  const fileName = req.file?.filename;

  if (!modelName || !year || !month || !testFrequency || !description || !fileName) {
    throw new AppError(
      "Missing required fields: modelName, year, month, testFrequency, description or fileName.",
      400,
    );
  }

  const uploadedAt = getISTDate();
  // Best-effort: a parse failure must never block the upload — extraction
  // already swallows its own errors and returns all-null fields.
  const energyData = await extractBisEnergyData(req.file.path);

  try {
    const pool = await connectToDB(dbConfig1);

    const query = `
      INSERT INTO BISUpload (
        ModelName, Year, Month, TestFrequency, Description, FileName, UploadAt,
        DeclaredAnnualEnergy, MeasuredAnnualEnergy, EnergyDeviationPercent, TestResult
      )
      OUTPUT INSERTED.SrNo
      VALUES (
        @ModelName, @Year, @Month, @TestFrequency, @Description, @FileName, @UploadAt,
        @DeclaredAnnualEnergy, @MeasuredAnnualEnergy, @EnergyDeviationPercent, @TestResult
      )
    `;

    const insertResult = await pool
      .request()
      .input("ModelName",             sql.VarChar,  modelName)
      .input("Year",                  sql.VarChar,  year)
      .input("Month",                 sql.VarChar,  month)
      .input("TestFrequency",         sql.VarChar,  testFrequency)
      .input("Description",           sql.VarChar,  description)
      .input("FileName",              sql.VarChar,  fileName)
      .input("UploadAt",              sql.DateTime, uploadedAt)
      .input("DeclaredAnnualEnergy",  sql.Decimal(12, 3), energyData.declaredAnnualEnergy)
      .input("MeasuredAnnualEnergy",  sql.Decimal(12, 3), energyData.measuredAnnualEnergy)
      .input("EnergyDeviationPercent", sql.Decimal(6, 2), energyData.energyDeviationPercent)
      .input("TestResult",            sql.VarChar(20), energyData.testResult)
      .query(query);

    res.status(200).json({
      success: true,
      srNo: insertResult.recordset[0].SrNo,
      filename: req.file.originalname,
      fileUrl: `/uploads/BISReport/${req.file.filename}`,
      energyData,
      message: "Uploaded successfully",
    });
  } catch (error) {
    throw new AppError(`Failed to upload the BIS Report data: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   LIST FILES
═══════════════════════════════════════════════════════════════════════ */
export const getBisPdfFiles = tryCatch(async (req, res) => {
  try {
    const pool = await connectToDB(dbConfig1);
    const pagination = parsePagination(req.query);

    let total = null;
    if (pagination) {
      const countResult = await pool.request().query(`SELECT COUNT(*) AS total FROM BISUpload`);
      total = countResult.recordset[0].total;
    }

    // BUG (was): SELECT * — always use explicit columns so schema changes
    // don't silently break the mapping below.
    const request = pool.request();
    if (pagination) {
      request.input("Offset", sql.Int, pagination.offset);
      request.input("PageSize", sql.Int, pagination.pageSize);
    }
    const result = await request.query(`
      SELECT SrNo, ModelName, Year, Month, TestFrequency, Description, FileName, UploadAt,
             DeclaredAnnualEnergy, MeasuredAnnualEnergy, EnergyDeviationPercent, TestResult
      FROM BISUpload
      ORDER BY SrNo DESC
      ${pagination ? "OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY" : ""}
    `);

    const files = result.recordset.map((file) => ({
      srNo:                   file.SrNo,
      modelName:               file.ModelName,
      year:                    file.Year,
      month:                   file.Month,
      testFrequency:           file.TestFrequency,      // ← correct casing
      description:             file.Description,
      fileName:                file.FileName,
      url:                     `/uploads/BISReport/${file.FileName}`,
      uploadAt:                file.UploadAt,           // ← correct casing
      declaredAnnualEnergy:    file.DeclaredAnnualEnergy,
      measuredAnnualEnergy:    file.MeasuredAnnualEnergy,
      energyDeviationPercent:  file.EnergyDeviationPercent,
      testResult:              file.TestResult,
    }));

    res.status(200).json({
      success: true,
      message: "BIS PDF Files retrieved successfully.",
      files,
      ...(pagination ? { pagination: { ...pagination, total } } : {}),
    });
  } catch (error) {
    throw new AppError(`Failed to fetch the BIS PDF Files: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   DOWNLOAD
═══════════════════════════════════════════════════════════════════════ */
export const downloadBisPdfFile = tryCatch(async (req, res) => {
  const { srNo }     = req.params;
  const { filename } = req.query;

  if (!srNo)      throw new AppError("Missing required field: SrNo.", 400);
  if (!filename)  throw new AppError("Missing required query param: filename.", 400);

  const filePath = path.join(uploadDir, filename);

  try {
    // 1. Physical file check first – cheap, no DB round-trip
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on disk." });
    }

    // 2. Verify the DB record exists
    const pool = await connectToDB(dbConfig1);

    const result = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo, 10))
      .query(`
        SELECT FileName, ModelName, Year, Month
        FROM BISUpload
        WHERE SrNo = @SrNo
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "File record not found in database." });
    }

    // 3. Stream the file
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (err) => {
      console.error("File streaming error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Error streaming file." });
      }
    });
  } catch (error) {
    throw new AppError(`Failed to download BIS PDF: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   DELETE
═══════════════════════════════════════════════════════════════════════ */
export const deleteBisPdfFile = tryCatch(async (req, res) => {
  const { srNo }     = req.params;
  const { filename } = req.query;

  if (!srNo)     throw new AppError("Missing required field: SrNo.", 400);
  if (!filename) throw new AppError("Missing required query param: filename.", 400);

  const filePath = path.join(uploadDir, filename);

  try {
    // BUG (was): fs.unlinkSync() ran BEFORE the DB DELETE. If the DB
    // operation failed the file was already gone, leaving an orphaned
    // DB record pointing at a non-existent file.
    // FIX: Delete from DB first; only unlink file on success.

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on disk." });
    }

    const pool = await connectToDB(dbConfig1);

    const result = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo, 10))
      .query(`DELETE FROM BISUpload WHERE SrNo = @SrNo`);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "Record not found in database." });
    }

    // DB record is gone — now safe to remove the physical file
    fs.unlinkSync(filePath);

    res.status(200).json({ success: true, message: "File deleted successfully." });
  } catch (error) {
    throw new AppError(`Failed to delete the BIS PDF file: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   UPDATE
═══════════════════════════════════════════════════════════════════════ */
export const updateBisPdfFile = tryCatch(async (req, res) => {
  const { srNo }                                             = req.params;
  const { modelName, year, month, testFrequency, description } = req.body;
  const newFile                                              = req.file;

  if (!modelName || !year || !month || !testFrequency || !description) {
    if (newFile) {
      const p = path.join(uploadDir, newFile.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    throw new AppError(
      "Missing required fields: modelName, year, month, testFrequency or description.",
      400,
    );
  }

  try {
    const pool = await connectToDB(dbConfig1);

    const existingResult = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo, 10))
      .query(`SELECT FileName FROM BISUpload WHERE SrNo = @SrNo`);

    if (existingResult.recordset.length === 0) {
      if (newFile) {
        const p = path.join(uploadDir, newFile.filename);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      return res.status(404).json({ success: false, message: "Record not found." });
    }

    const oldFileName  = existingResult.recordset[0].FileName;
    const finalFileName = newFile ? newFile.filename : oldFileName;

    // Re-extract energy data only when a new PDF was uploaded — a
    // metadata-only edit (name/year/description) keeps whatever was parsed
    // from the file already on record.
    const energyData = newFile ? await extractBisEnergyData(newFile.path) : null;

    const updateRequest = pool
      .request()
      .input("ModelName",     sql.VarChar, modelName)
      .input("Year",          sql.VarChar, year)
      .input("Month",         sql.VarChar, month)
      .input("TestFrequency", sql.VarChar, testFrequency)
      .input("Description",   sql.VarChar, description)
      .input("FileName",      sql.VarChar, finalFileName)
      .input("SrNo",          sql.Int,     parseInt(srNo, 10));

    let energySetClause = "";
    if (energyData) {
      updateRequest
        .input("DeclaredAnnualEnergy",   sql.Decimal(12, 3), energyData.declaredAnnualEnergy)
        .input("MeasuredAnnualEnergy",   sql.Decimal(12, 3), energyData.measuredAnnualEnergy)
        .input("EnergyDeviationPercent", sql.Decimal(6, 2),  energyData.energyDeviationPercent)
        .input("TestResult",             sql.VarChar(20),    energyData.testResult);
      energySetClause = `,
            DeclaredAnnualEnergy   = @DeclaredAnnualEnergy,
            MeasuredAnnualEnergy   = @MeasuredAnnualEnergy,
            EnergyDeviationPercent = @EnergyDeviationPercent,
            TestResult             = @TestResult`;
    }

    await updateRequest.query(`
      UPDATE BISUpload
      SET ModelName     = @ModelName,
          Year          = @Year,
          Month         = @Month,
          TestFrequency = @TestFrequency,
          Description   = @Description,
          FileName      = @FileName${energySetClause}
      WHERE SrNo = @SrNo
    `);

    // Only delete old file AFTER successful DB update
    if (newFile && oldFileName) {
      const oldPath = path.join(uploadDir, oldFileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    res.status(200).json({
      success: true,
      message: "BIS Report updated successfully.",
      data: {
        srNo,
        modelName,
        year,
        month,
        testFrequency,
        description,
        fileName:    finalFileName,
        fileUrl:     `/uploads/BISReport/${finalFileName}`,
        fileUpdated: !!newFile,
      },
    });
  } catch (error) {
    // Cleanup orphaned upload on failure
    if (newFile) {
      const p = path.join(uploadDir, newFile.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    throw new AppError(`Failed to update BIS Report: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   GET BIS REPORT STATUS  (files + compliance status combined)
═══════════════════════════════════════════════════════════════════════ */
export const getBisReportStatus = tryCatch(async (req, res) => {
  try {
    const pool = await connectToDB(dbConfig1);
    const pagination = parsePagination(req.query);

    // ── Files ─────────────────────────────────────────────────────────
    let filesTotal = null;
    if (pagination) {
      const countResult = await pool.request().query(`SELECT COUNT(*) AS total FROM BISUpload`);
      filesTotal = countResult.recordset[0].total;
    }

    // BUG (was): SELECT * — use explicit columns
    const filesRequest = pool.request();
    if (pagination) {
      filesRequest.input("Offset", sql.Int, pagination.offset);
      filesRequest.input("PageSize", sql.Int, pagination.pageSize);
    }
    const filesResult = await filesRequest.query(`
      SELECT SrNo, ModelName, Year, Month, TestFrequency, Description, FileName, UploadAt,
             DeclaredAnnualEnergy, MeasuredAnnualEnergy, EnergyDeviationPercent, TestResult
      FROM BISUpload
      ORDER BY SrNo DESC
      ${pagination ? "OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY" : ""}
    `);

    const files = filesResult.recordset.map((file) => ({
      srNo:          file.SrNo,
      modelName:     file.ModelName,
      year:          file.Year,
      month:         file.Month,
      // BUG (was): file.testFrequency — JS property names are case-sensitive;
      // mssql returns columns with their original DB casing (TestFrequency).
      // Using the wrong case silently returns undefined for every row.
      testFrequency: file.TestFrequency,
      description:   file.Description,
      fileName:      file.FileName,
      url:           `/uploads/BISReport/${file.FileName}`,
      // BUG (was): file.UploadAT — the column is UploadAt (see INSERT above).
      // The wrong casing returns undefined for every row.
      uploadAt:               file.UploadAt,
      declaredAnnualEnergy:   file.DeclaredAnnualEnergy,
      measuredAnnualEnergy:   file.MeasuredAnnualEnergy,
      energyDeviationPercent: file.EnergyDeviationPercent,
      testResult:             file.TestResult,
    }));

    // ── Status ────────────────────────────────────────────────────────
    const currentDate = getISTDate();

    const statusResult = await pool
      .request()
      .input("CurrentDate", sql.DateTime, currentDate)
      .query(`
        WITH Psno AS (
          SELECT DocNo, Material
          FROM   MaterialBarcode
          WHERE  PrintStatus = 1 AND Status <> 99
        ),
        FilteredData AS (
          SELECT bc.ModelName,
                 b.ActivityOn
          FROM  Psno
          JOIN  ProcessActivity b  ON b.PSNo         = Psno.DocNo
          JOIN  WorkCenter      c  ON c.StationCode  = b.StationCode
          JOIN  BISCategory     bc ON bc.MaterialCode = Psno.Material
          WHERE bc.Category    = 1
            AND b.ActivityType = 5
            AND c.StationCode  = 1220010
            AND b.ActivityOn BETWEEN '2022-01-01 00:00:01' AND @CurrentDate
        ),
        ProductionSummary AS (
          SELECT ModelName,
                 YEAR(ActivityOn) AS Activity_Year,
                 COUNT(*)         AS Model_Count
          FROM   FilteredData
          GROUP  BY ModelName, YEAR(ActivityOn)
        ),
        DedupedBIS AS (
          SELECT *
          FROM (
              SELECT *,
                     ROW_NUMBER() OVER (
                         PARTITION BY ModelName, Year
                         ORDER BY Month DESC          -- pick the latest upload
                     ) AS rn
              FROM BISUpload
          ) sub
          WHERE rn = 1
        ),
        FinalResult AS (
          SELECT p.ModelName,
                 p.Activity_Year AS Year,
                 b.Month,
                 p.Model_Count   AS Prod_Count,
                 -- A model with an uploaded report that FAILED its energy
                 -- test must not read the same as one that never had a
                 -- report at all — surfaced as its own status, not folded
                 -- into "Test Completed".
                 CASE WHEN b.ModelName IS NULL  THEN 'Test Pending'
                      WHEN b.TestResult = 'FAIL' THEN 'Test Failed'
                      ELSE 'Test Completed' END AS Status,
                 b.ModelName AS UploadedModelName,
                 b.FileName,
                 b.Description,
                 b.TestResult
          FROM ProductionSummary p
          LEFT JOIN DedupedBIS b
                 ON b.ModelName = p.ModelName
                AND b.Year      = p.Activity_Year
        )
        SELECT *
        FROM   FinalResult
        ORDER  BY ModelName, Year;
      `);

    const status = statusResult.recordset.map((item) => ({
      ...item,
      fileUrl: item.FileName ? `/uploads/BISReport/${item.FileName}` : null,
    }));

    res.status(200).json({
      success: true,
      message: "BIS Report status data retrieved successfully.",
      files,
      status,
      ...(pagination ? { filesPagination: { ...pagination, total: filesTotal } } : {}),
    });
  } catch (error) {
    throw new AppError(`Failed to fetch BIS Report status data: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   CONFIRM / EDIT ENERGY DATA
   Lets the user review the auto-extracted (OCR-derived) energy values right
   after upload and correct anything OCR got wrong, without re-uploading the
   file or touching the other BISUpload fields.
═══════════════════════════════════════════════════════════════════════ */
const toNullableNumber = (v) => (v === "" || v === undefined || v === null ? null : Number(v));

export const updateBisEnergyData = tryCatch(async (req, res) => {
  const { srNo } = req.params;
  const { declaredAnnualEnergy, measuredAnnualEnergy, energyDeviationPercent, testResult } = req.body;

  if (!srNo) throw new AppError("Missing required field: SrNo.", 400);

  try {
    const pool = await connectToDB(dbConfig1);

    const result = await pool
      .request()
      .input("SrNo",                   sql.Int,            parseInt(srNo, 10))
      .input("DeclaredAnnualEnergy",   sql.Decimal(12, 3), toNullableNumber(declaredAnnualEnergy))
      .input("MeasuredAnnualEnergy",   sql.Decimal(12, 3), toNullableNumber(measuredAnnualEnergy))
      .input("EnergyDeviationPercent", sql.Decimal(6, 2),  toNullableNumber(energyDeviationPercent))
      .input("TestResult",             sql.VarChar(20),    testResult || null)
      .query(`
        UPDATE BISUpload
        SET DeclaredAnnualEnergy   = @DeclaredAnnualEnergy,
            MeasuredAnnualEnergy   = @MeasuredAnnualEnergy,
            EnergyDeviationPercent = @EnergyDeviationPercent,
            TestResult             = @TestResult
        WHERE SrNo = @SrNo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "Record not found." });
    }

    res.status(200).json({ success: true, message: "Energy data confirmed." });
  } catch (error) {
    throw new AppError(`Failed to update BIS energy data: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   FETCH ENERGY DATA (re-extract from an already-uploaded PDF)
   For records uploaded before this feature existed, or where extraction
   was skipped/failed the first time — re-runs extraction against the file
   already on disk. Does NOT write to the DB; the caller reviews the result
   in the same confirm dialog used post-upload and saves it explicitly via
   updateBisEnergyData above.
═══════════════════════════════════════════════════════════════════════ */
export const fetchBisEnergyData = tryCatch(async (req, res) => {
  const { srNo } = req.params;
  if (!srNo) throw new AppError("Missing required field: SrNo.", 400);

  try {
    const pool = await connectToDB(dbConfig1);

    const result = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo, 10))
      .query(`SELECT FileName FROM BISUpload WHERE SrNo = @SrNo`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Record not found." });
    }

    const filePath = path.join(uploadDir, result.recordset[0].FileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on disk." });
    }

    const energyData = await extractBisEnergyData(filePath);

    res.status(200).json({
      success: true,
      message: "Energy data extracted.",
      energyData,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch BIS energy data: ${error.message}`, 500);
  }
});
