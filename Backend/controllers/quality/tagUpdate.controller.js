import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// ─── Helper: get current user from request ────────────────────────────────────
// Adjust this to match your auth middleware (req.user, req.session.user, etc.)
const getCurrentUser = (req) => req.user?.name;

// ─── Helper: insert log entry ────────────────────────────────────────────────
const insertLog = async (
  pool,
  {
    assemblyNumber,
    updateType,
    oldValue,
    newValue,
    updatedBy,
    success,
    failReason,
  },
) => {
  try {
    await pool
      .request()
      .input("assemblyNumber", sql.NVarChar(100), assemblyNumber)
      .input("updateType", sql.NVarChar(50), updateType) // 'asset' | 'customerqr'
      .input("oldValue", sql.NVarChar(255), oldValue || null)
      .input("newValue", sql.NVarChar(255), newValue || null)
      .input("updatedBy", sql.NVarChar(100), updatedBy)
      .input("success", sql.Bit, success ? 1 : 0)
      .input("failReason", sql.NVarChar(500), failReason || null).query(`
        INSERT INTO TagUpdateLog
          (AssemblyNumber, UpdateType, OldValue, NewValue, UpdatedBy, Success, FailReason, CreatedAt)
        VALUES
          (@assemblyNumber, @updateType, @oldValue, @newValue, @updatedBy, @success, @failReason, GETDATE())
      `);
  } catch (logErr) {
    // Non-fatal: log errors should not break the main operation
    console.error("Failed to write tag update log:", logErr.message);
  }
};

// ─── GET /quality/asset-tag-details ──────────────────────────────────────────
export const getAssetTagDetails = tryCatch(async (req, res) => {
  const { assemblyNumber } = req.query;

  if (!assemblyNumber?.trim()) {
    throw new AppError(
      "Missing required query parameter: assemblyNumber.",
      400,
    );
  }

  // BUG FIX: Concatenate with a delimiter that won't appear in real data.
  // Using '|||' instead of '~' to reduce collision risk with real values.
  const query = `
    SELECT
      mb.Serial      AS FGNo,
      mb.VSerial     AS AssetNo,
      m.Alias        AS ModelName,
      mb.Serial2     AS Serial2
    FROM
      MaterialBarcode AS mb
    INNER JOIN
      Material AS m ON m.MatCode = mb.Material
    WHERE
      mb.Alias = @alias
  `;
  // BUG FIX: Return individual columns instead of a concatenated string.
  // The original approach of splitting "Serial~VSerial~Alias~Serial2" breaks
  // if any field contains the '~' character.

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("alias", sql.VarChar(100), assemblyNumber.trim())
      .query(query);

    if (!result.recordset.length || !result.recordset[0].FGNo) {
      return res.status(404).json({
        success: false,
        message: "No asset found for the provided Assembly Number.",
        FGNo: null,
        AssetNo: null,
        ModelName: null,
        Serial2: null,
      });
    }

    const { FGNo, AssetNo, ModelName, Serial2 } = result.recordset[0];

    res.status(200).json({
      success: true,
      message: "Asset tag details retrieved successfully.",
      FGNo,
      AssetNo,
      ModelName,
      Serial2,
    });
  } finally {
    await pool.close();
  }
});

// ─── PUT /quality/new-asset-tag ───────────────────────────────────────────────
export const newAssetTagUpdate = tryCatch(async (req, res) => {
  const { assemblyNumber, fgSerialNumber, newAssetNumber } = req.body;
  const updatedBy = getCurrentUser(req);

  if (
    !assemblyNumber?.trim() ||
    !fgSerialNumber?.trim() ||
    !newAssetNumber?.trim()
  ) {
    throw new AppError(
      "Missing required fields: assemblyNumber, fgSerialNumber, or newAssetNumber.",
      400,
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // 1. Fetch old value for the log
    const oldValueResult = await pool
      .request()
      .input("alias", sql.NVarChar(100), assemblyNumber.trim())
      .input("fgSerial", sql.NVarChar(100), fgSerialNumber.trim()).query(`
        SELECT VSerial AS oldAsset
        FROM MaterialBarcode
        WHERE Alias = @alias AND Serial = @fgSerial
      `);
    const oldValue = oldValueResult.recordset[0]?.oldAsset || null;

    // 2. Check for duplicate — case-insensitive
    const checkResult = await pool
      .request()
      .input("newAssetNumber", sql.NVarChar(255), newAssetNumber.trim()).query(`
        SELECT COUNT(*) AS cnt
        FROM MaterialBarcode
        WHERE VSerial = @newAssetNumber
      `);

    if (checkResult.recordset[0].cnt > 0) {
      // BUG FIX: original used 'count' but mssql returns numeric; using alias 'cnt' for clarity.
      await insertLog(pool, {
        assemblyNumber,
        updateType: "asset",
        oldValue,
        newValue: newAssetNumber,
        updatedBy,
        success: false,
        failReason: "Asset number already exists.",
      });
      return res
        .status(400)
        .json({ success: false, message: "Asset number already exists." });
    }

    // 3. Perform update
    const updateResult = await pool
      .request()
      .input("assemblyNumber", sql.NVarChar(100), assemblyNumber.trim())
      .input("fgSerialNumber", sql.NVarChar(100), fgSerialNumber.trim())
      .input("newAssetNumber", sql.NVarChar(255), newAssetNumber.trim()).query(`
        UPDATE MaterialBarcode
        SET VSerial = @newAssetNumber
        WHERE Alias = @assemblyNumber AND Serial = @fgSerialNumber
      `);
    // BUG FIX: original used mismatched param name '@serial' vs binding 'assemblyNumber'.
    // Now both are consistently named '@assemblyNumber'.

    if (updateResult.rowsAffected[0] === 0) {
      await insertLog(pool, {
        assemblyNumber,
        updateType: "asset",
        oldValue,
        newValue: newAssetNumber,
        updatedBy,
        success: false,
        failReason: "No matching record found to update.",
      });
      return res
        .status(404)
        .json({
          success: false,
          message: "No matching record found to update.",
        });
    }

    // 4. Log success
    await insertLog(pool, {
      assemblyNumber,
      updateType: "asset",
      oldValue,
      newValue: newAssetNumber,
      updatedBy,
      success: true,
    });

    res
      .status(200)
      .json({ success: true, message: "Asset tag updated successfully." });
  } finally {
    await pool.close();
  }
});

// ─── PUT /quality/new-customer-qr ────────────────────────────────────────────
export const newCustomerQrUpdate = tryCatch(async (req, res) => {
  const { assemblyNumber, fgSerialNumber, newCustomerQr } = req.body;
  const updatedBy = getCurrentUser(req);

  if (
    !assemblyNumber?.trim() ||
    !fgSerialNumber?.trim() ||
    !newCustomerQr?.trim()
  ) {
    throw new AppError(
      "Missing required fields: assemblyNumber, fgSerialNumber, or newCustomerQr.",
      400,
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // 1. Fetch old value for the log
    const oldValueResult = await pool
      .request()
      .input("alias", sql.NVarChar(100), assemblyNumber.trim())
      .input("fgSerial", sql.NVarChar(100), fgSerialNumber.trim()).query(`
        SELECT Serial2 AS oldQr
        FROM MaterialBarcode
        WHERE Alias = @alias AND Serial = @fgSerial
      `);
    const oldValue = oldValueResult.recordset[0]?.oldQr || null;

    // 2. Check for duplicate
    const checkResult = await pool
      .request()
      .input("newCustomerQr", sql.NVarChar(255), newCustomerQr.trim()).query(`
        SELECT COUNT(*) AS cnt
        FROM MaterialBarcode
        WHERE Serial2 = @newCustomerQr
      `);

    if (checkResult.recordset[0].cnt > 0) {
      await insertLog(pool, {
        assemblyNumber,
        updateType: "customerqr",
        oldValue,
        newValue: newCustomerQr,
        updatedBy,
        success: false,
        failReason: "Customer QR already exists.",
      });
      return res
        .status(400)
        .json({ success: false, message: "Customer QR already exists." });
    }

    // 3. Perform update
    const updateResult = await pool
      .request()
      .input("assemblyNumber", sql.NVarChar(100), assemblyNumber.trim())
      .input("fgSerialNumber", sql.NVarChar(100), fgSerialNumber.trim())
      .input("newCustomerQr", sql.NVarChar(255), newCustomerQr.trim()).query(`
        UPDATE MaterialBarcode
        SET Serial2 = @newCustomerQr
        WHERE Alias = @assemblyNumber AND Serial = @fgSerialNumber
      `);
    // BUG FIX: original bound '@assemblyserial' but queried a param named @assemblyNumber inconsistently.

    if (updateResult.rowsAffected[0] === 0) {
      await insertLog(pool, {
        assemblyNumber,
        updateType: "customerqr",
        oldValue,
        newValue: newCustomerQr,
        updatedBy,
        success: false,
        failReason: "No matching record found to update.",
      });
      return res
        .status(404)
        .json({
          success: false,
          message: "No matching record found to update.",
        });
    }

    // 4. Log success
    await insertLog(pool, {
      assemblyNumber,
      updateType: "customerqr",
      oldValue,
      newValue: newCustomerQr,
      updatedBy,
      success: true,
    });

    res
      .status(200)
      .json({ success: true, message: "Customer QR updated successfully." });
  } finally {
    await pool.close();
  }
});

// ─── GET /quality/tag-update-logs ────────────────────────────────────────────
export const getTagUpdateLogs = tryCatch(async (req, res) => {
  const {
    limit = 200,
    updateType, // 'asset' | 'customerqr'
    success, // '1' | '0'
    assemblyNumber,
  } = req.query;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool.request();
    request.input("limit", sql.Int, parseInt(limit, 10));

    let whereClause = "WHERE 1=1";

    if (updateType) {
      request.input("updateType", sql.NVarChar(50), updateType);
      whereClause += " AND UpdateType = @updateType";
    }
    if (success !== undefined) {
      request.input("success", sql.Bit, success === "1" ? 1 : 0);
      whereClause += " AND Success = @success";
    }
    if (assemblyNumber) {
      request.input("assemblyNumber", sql.NVarChar(100), `%${assemblyNumber}%`);
      whereClause += " AND AssemblyNumber LIKE @assemblyNumber";
    }

    const result = await request.query(`
      SELECT TOP (@limit)
        Id           AS id,
        AssemblyNumber AS assemblyNumber,
        UpdateType   AS updateType,
        OldValue     AS oldValue,
        NewValue     AS newValue,
        UpdatedBy    AS updatedBy,
        Success      AS success,
        FailReason   AS failReason,
        CreatedAt    AS createdAt
      FROM TagUpdateLog
      ${whereClause}
      ORDER BY CreatedAt DESC
    `);

    const logs = result.recordset.map((row) => ({
      ...row,
      success: row.success === true || row.success === 1,
    }));

    res.status(200).json({ success: true, total: logs.length, logs });
  } finally {
    await pool.close();
  }
});
