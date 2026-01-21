import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getAssetTagDetails = tryCatch(async (req, res) => {
  const { assemblyNumber } = req.query;

  if (!assemblyNumber) {
    throw new AppError(
      "Missing required query parameters: assemblyNumber.",
      400,
    );
  }

  const query = `
    SELECT 
      mb.Serial + '~' + mb.VSerial + '~' + m.Alias + '~' + mb.Serial2 AS combinedserial
    FROM 
      MaterialBarcode AS mb
    INNER JOIN 
      Material AS m ON m.MatCode = mb.Material
    WHERE 
      mb.Alias = @alias
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("alias", sql.VarChar, assemblyNumber)
      .query(query);

    const combined = result.recordset[0]?.combinedserial;

    if (!combined) {
      return res.status(404).json({
        success: false,
        message: "No data found for the provided alias.",
        FGNo: null,
        AssetNo: null,
        ModelName: null,
        Serial2: null,
      });
    }

    const [FGNo, AssetNo, ModelName, Serial2] = combined.split("~");

    res.status(200).json({
      success: true,
      message: "Asset tag details data retrieved successfully.",
      FGNo,
      AssetNo,
      ModelName,
      Serial2,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Asset tag details data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const newAssetTagUpdate = tryCatch(async (req, res) => {
  const { assemblyNumber, fgSerialNumber, newAssetNumber } = req.body;

  if (!assemblyNumber || !fgSerialNumber || !newAssetNumber) {
    throw new AppError(
      "Missing required fields: assemblyNumber, fgSerialNumber or newAssetNumber.",
      400,
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // 1️⃣ Check if newAssetNumber already exists
    const checkQuery = `
      SELECT COUNT(*) AS count
      FROM MaterialBarcode
      WHERE VSerial = @newAssetNumber
    `;
    const checkResult = await pool
      .request()
      .input("newAssetNumber", sql.NVarChar, newAssetNumber)
      .query(checkQuery);

    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: "Asset number already exists.",
      });
    }

    // 2️⃣ Proceed to update if it doesn't exist
    const updateQuery = `
      UPDATE MaterialBarcode 
      SET VSerial = @newAssetNumber
      WHERE Alias = @serial AND Serial = @fgSerialNumber
    `;
    const result = await pool
      .request()
      .input("serial", sql.NVarChar, assemblyNumber)
      .input("fgSerialNumber", sql.NVarChar, fgSerialNumber)
      .input("newAssetNumber", sql.NVarChar, newAssetNumber)
      .query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching record found to update.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Asset Tag updated successfully.",
    });
  } catch (error) {
    throw new AppError(
      `Failed to update the asset tag data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const newCustomerQrUpdate = tryCatch(async (req, res) => {
  const { assemblyNumber, fgSerialNumber, newCustomerQr } = req.body;

  if (!assemblyNumber || !fgSerialNumber || !newCustomerQr) {
    throw new AppError(
      "Missing required fields: assemblyNumber, fgSerialNumber or newCustomerQr.",
      400,
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // 1️⃣ Check if newCustomerQr already exists
    const checkQuery = `
      SELECT COUNT(*) AS count
      FROM MaterialBarcode
      WHERE Serial2 = @newCustomerQr
    `;
    const checkResult = await pool
      .request()
      .input("newCustomerQr", sql.NVarChar, newCustomerQr)
      .query(checkQuery);

    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: "Customer QR already exists.",
      });
    }

    // 2️⃣ Proceed to update if it doesn't exist
    const updateQuery = `
      UPDATE MaterialBarcode
      SET Serial2 = @newCustomerQr
      WHERE Alias = @assemblyserial AND Serial = @fgSerialNumber
    `;
    const result = await pool
      .request()
      .input("assemblyserial", sql.NVarChar, assemblyNumber)
      .input("fgSerialNumber", sql.NVarChar, fgSerialNumber)
      .input("newCustomerQr", sql.NVarChar, newCustomerQr)
      .query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching record found to update.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer QR updated successfully.",
    });
  } catch (error) {
    throw new AppError(
      `Failed to update the Customer QR data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
