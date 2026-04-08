import path from "path";
import fs from "fs";
import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

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
   HELPER – safe pool close
   Prevents "Cannot read properties of undefined (reading 'close')" that
   appears in downloadBisPdfFile / deleteBisPdfFile when pool was never
   assigned before an early return or thrown error.
──────────────────────────────────────────────────────────────────────────*/
const closePool = async (pool) => {
  if (pool) {
    try {
      await pool.close();
    } catch (_) {
      // swallow – connection may already be closed
    }
  }
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
  let pool;

  try {
    pool = await sql.connect(dbConfig1);

    const query = `
      INSERT INTO BISUpload (ModelName, Year, Month, TestFrequency, Description, FileName, UploadAt)
      VALUES (@ModelName, @Year, @Month, @TestFrequency, @Description, @FileName, @UploadAt)
    `;

    await pool
      .request()
      .input("ModelName",     sql.VarChar,  modelName)
      .input("Year",          sql.VarChar,  year)
      .input("Month",         sql.VarChar,  month)
      .input("TestFrequency", sql.VarChar,  testFrequency)
      .input("Description",   sql.VarChar,  description)
      .input("FileName",      sql.VarChar,  fileName)
      .input("UploadAt",      sql.DateTime, uploadedAt)
      .query(query);

    res.status(200).json({
      success: true,
      filename: req.file.originalname,
      fileUrl: `/uploads/BISReport/${req.file.filename}`,
      message: "Uploaded successfully",
    });
  } catch (error) {
    throw new AppError(`Failed to upload the BIS Report data: ${error.message}`, 500);
  } finally {
    await closePool(pool);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   LIST FILES
═══════════════════════════════════════════════════════════════════════ */
export const getBisPdfFiles = tryCatch(async (_, res) => {
  let pool;

  try {
    pool = await sql.connect(dbConfig1);

    // BUG (was): SELECT * — always use explicit columns so schema changes
    // don't silently break the mapping below.
    const query = `
      SELECT SrNo, ModelName, Year, Month, TestFrequency, Description, FileName, UploadAt
      FROM BISUpload
      ORDER BY SrNo DESC
    `;
    const result = await pool.request().query(query);

    const files = result.recordset.map((file) => ({
      srNo:          file.SrNo,
      modelName:     file.ModelName,
      year:          file.Year,
      month:         file.Month,
      testFrequency: file.TestFrequency,      // ← correct casing
      description:   file.Description,
      fileName:      file.FileName,
      url:           `/uploads-bis-pdf/${file.FileName}`,
      uploadAt:      file.UploadAt,           // ← correct casing
    }));

    res.status(200).json({
      success: true,
      message: "BIS PDF Files retrieved successfully.",
      files,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch the BIS PDF Files: ${error.message}`, 500);
  } finally {
    await closePool(pool);
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
  let pool;

  try {
    // 1. Physical file check first – cheap, no DB round-trip
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on disk." });
    }

    // 2. Verify the DB record exists
    pool = await sql.connect(dbConfig1);

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
  } finally {
    // BUG (was): pool.close() crashed with TypeError when pool was never
    // assigned (i.e. early-return 404 paths). closePool() guards this.
    await closePool(pool);
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
  // BUG (was): pool was declared inside the try block, making it
  // inaccessible in the finally block → ReferenceError on every call.
  let pool;

  try {
    // BUG (was): fs.unlinkSync() ran BEFORE the DB DELETE. If the DB
    // operation failed the file was already gone, leaving an orphaned
    // DB record pointing at a non-existent file.
    // FIX: Delete from DB first; only unlink file on success.

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on disk." });
    }

    pool = await sql.connect(dbConfig1);

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
  } finally {
    await closePool(pool);
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

  let pool;

  try {
    pool = await sql.connect(dbConfig1);

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

    await pool
      .request()
      .input("ModelName",     sql.VarChar, modelName)
      .input("Year",          sql.VarChar, year)
      .input("Month",         sql.VarChar, month)
      .input("TestFrequency", sql.VarChar, testFrequency)
      .input("Description",   sql.VarChar, description)
      .input("FileName",      sql.VarChar, finalFileName)
      .input("SrNo",          sql.Int,     parseInt(srNo, 10))
      .query(`
        UPDATE BISUpload
        SET ModelName     = @ModelName,
            Year          = @Year,
            Month         = @Month,
            TestFrequency = @TestFrequency,
            Description   = @Description,
            FileName      = @FileName
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
  } finally {
    await closePool(pool);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   GET BIS REPORT STATUS  (files + compliance status combined)
═══════════════════════════════════════════════════════════════════════ */
export const getBisReportStatus = tryCatch(async (_, res) => {
  let pool;

  try {
    pool = await sql.connect(dbConfig1);

    // ── Files ─────────────────────────────────────────────────────────
    // BUG (was): SELECT * — use explicit columns
    const filesResult = await pool.request().query(`
      SELECT SrNo, ModelName, Year, Month, TestFrequency, Description, FileName, UploadAt
      FROM BISUpload
      ORDER BY SrNo DESC
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
      url:           `/uploads-bis-pdf/${file.FileName}`,
      // BUG (was): file.UploadAT — the column is UploadAt (see INSERT above).
      // The wrong casing returns undefined for every row.
      uploadAt:      file.UploadAt,
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
          SELECT
            m.Name                                                AS FullModel,
            LEFT(m.Name, 9)                                       AS Model_Prefix,
            b.ActivityOn,
            CASE WHEN RIGHT(m.Name, 1) = 'R' THEN 'R' ELSE '' END AS HasRT
          FROM  Psno
          JOIN  ProcessActivity b ON b.PSNo       = Psno.DocNo
          JOIN  WorkCenter      c ON c.StationCode = b.StationCode
          JOIN  Material        m ON m.MatCode     = Psno.Material
          WHERE m.CertificateControl <> 0
            AND b.ActivityType  = 5
            AND c.StationCode   = 1220010
            AND b.ActivityOn BETWEEN '2022-01-01 00:00:01' AND @CurrentDate
        ),
        ProductionSummary AS (
          SELECT
            Model_Prefix,
            YEAR(ActivityOn) AS Activity_Year,
            MAX(HasRT)       AS LastChar,
            COUNT(*)         AS Model_Count
          FROM FilteredData
          GROUP BY Model_Prefix, YEAR(ActivityOn)
        ),
        /*
         * BUG (was): DedupedBIS partitioned only by LEFT(ModelName,9) and Year.
         * If BISUpload contains both "MODELABC1" (non-RT) and "MODELABC1 RT"
         * they share the same 9-char prefix and the same Year, so ROW_NUMBER()
         * collapsed one of them, causing the wrong model (or no model) to join
         * against ProductionSummary RT rows.
         *
         * FIX: Add a third partition key that distinguishes RT from non-RT,
         * so each variant keeps exactly one representative row.
         */
        DedupedBIS AS (
          SELECT *
          FROM (
            SELECT *,
              ROW_NUMBER() OVER (
                PARTITION BY LEFT(ModelName, 9),
                             Year,
                             CASE WHEN RIGHT(ModelName, 2) = 'RT' THEN 'RT' ELSE '' END
                ORDER BY ModelName
              ) AS rn
            FROM BISUpload
          ) sub
          WHERE rn = 1
        ),
        FinalResult AS (
          SELECT
            COALESCE(
              b.ModelName,
              CONCAT(p.Model_Prefix, CASE WHEN p.LastChar = 'R' THEN ' RT' ELSE '' END)
            )                                                   AS ModelName,
            p.Activity_Year                                     AS Year,
            b.Month,
            p.Model_Count                                       AS Prod_Count,
            CASE WHEN b.ModelName IS NOT NULL
                 THEN 'Test Completed'
                 ELSE 'Test Pending'
            END                                                 AS Status,
            b.FileName,
            b.Description
          FROM ProductionSummary p
          LEFT JOIN DedupedBIS b
            ON  LEFT(b.ModelName, 9) = p.Model_Prefix
            AND b.Year               = p.Activity_Year
            AND (
                  (RIGHT(b.ModelName, 2) != 'RT')                              -- normal model
               OR (RIGHT(b.ModelName, 2)  = 'RT' AND p.LastChar = 'R')        -- RT model
            )
        )
        SELECT *
        FROM   FinalResult
        ORDER  BY ModelName, Year;
      `);

    const status = statusResult.recordset.map((item) => ({
      ...item,
      fileUrl: item.FileName ? `/uploads-bis-pdf/${item.FileName}` : null,
    }));

    res.status(200).json({
      success: true,
      message: "BIS Report status data retrieved successfully.",
      files,
      status,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch BIS Report status data: ${error.message}`, 500);
  } finally {
    await closePool(pool);
  }
});