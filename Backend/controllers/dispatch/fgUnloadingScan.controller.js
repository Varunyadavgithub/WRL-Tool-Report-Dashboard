import sql from "mssql";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import {
  getWwmsPool,
  nowIST,
  parseFgLabel,
  lookupMaterialBySerial,
  logDuplicateScan,
  logDispatchError,
  isUniqueViolation,
} from "./scanHelpers.js";

// POST /api/dispatch/unloading/scan
// Body: { rawBarcode, scannerNo }
export const scanFgUnloading = tryCatch(async (req, res) => {
  const { rawBarcode, scannerNo } = req.body;

  if (!rawBarcode || !String(rawBarcode).trim()) {
    throw new AppError("rawBarcode is required.", 400);
  }

  // DispatchErrorLog.Session_ID is NOT NULL — Unloading has no session, so we use a
  // synthetic marker tied to the scanning station instead of a real Session_ID.
  const errorSessionTag = `UNLOADING-${scannerNo?.trim() || "NA"}`;

  const parsed = parseFgLabel(rawBarcode);
  if (!parsed) {
    await logDispatchError({
      sessionId: errorSessionTag,
      errorMessage: "Improper Data Format for FG",
      errorId: 3,
    });
    return res.status(422).json({
      success: false,
      code: "INVALID_FORMAT",
      message: "Invalid FG Label Format",
    });
  }

  const material = await lookupMaterialBySerial(parsed.serial);
  if (!material) {
    await logDispatchError({
      sessionId: errorSessionTag,
      fgSerialNo: parsed.serial,
      errorMessage: "Invalid FG Serial Number",
      errorId: 7,
    });
    return res.status(404).json({
      success: false,
      code: "INVALID_SERIAL",
      message: "Invalid FG Serial Number",
    });
  }

  const pool = await getWwmsPool();

  // Pre-check for a fast, friendly duplicate message
  const existing = await pool
    .request()
    .input("FGSerialNo", sql.VarChar, material.FGSerialNo)
    .query(`SELECT FGSerialNo FROM DispatchUnloading WHERE FGSerialNo = @FGSerialNo`);

  if (existing.recordset.length) {
    await logDuplicateScan({ modelName: material.ModelName, fgSerialNo: material.FGSerialNo });
    return res.status(409).json({
      success: false,
      code: "DUPLICATE",
      message: "FG Already Scanned",
    });
  }

  try {
    await pool
      .request()
      .input("ModelName", sql.VarChar, material.ModelName)
      .input("FGSerialNo", sql.VarChar, material.FGSerialNo)
      .input("AssetCode", sql.VarChar, material.AssetCode)
      .input("BatchCode", sql.VarChar, material.BatchCode)
      .input("ScannerNo", sql.VarChar, scannerNo ?? null)
      .input("DateTime", sql.DateTime, nowIST()).query(`
        INSERT INTO DispatchUnloading (ModelName, FGSerialNo, AssetCode, BatchCode, ScannerNo, DateTime)
        VALUES (@ModelName, @FGSerialNo, @AssetCode, @BatchCode, @ScannerNo, @DateTime)
      `);
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Race: another request unloaded this serial between our pre-check and insert
      await logDuplicateScan({ modelName: material.ModelName, fgSerialNo: material.FGSerialNo });
      return res.status(409).json({
        success: false,
        code: "DUPLICATE",
        message: "FG Already Scanned",
      });
    }
    throw new AppError(`Failed to save FG Unloading: ${err.message}`, 500);
  }

  return res.status(200).json({
    success: true,
    message: "FG Unloading Completed",
    data: {
      modelName: material.ModelName,
      fgSerialNo: material.FGSerialNo,
      assetCode: material.AssetCode,
      batchCode: material.BatchCode,
    },
  });
});
