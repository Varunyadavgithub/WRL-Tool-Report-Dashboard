import sql from "mssql";
import { dbConfig1, dbConfig2 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getModelName = tryCatch(async (req, res) => {
  const { modelCode } = req.query;

  if (!modelCode) {
    throw new AppError("Model code is required", 400);
  }

  const query = `
    Select name 
    From material 
    Where AltName=@modelCode;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("modelCode", sql.NVarChar, modelCode)
      .query(query);

    if (!result.recordset.length) {
      return res
        .status(404)
        .json({ success: false, message: "Model not found", data: "~" });
    }

    res.status(200).json({
      success: true,
      message: "Model name fetched successfully",
      data: result.recordset[0].name,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch model name: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

export const modelNameUpdate = tryCatch(async (req, res) => {
  const { fgSerial, modelName } = req.body;

  if (!fgSerial) {
    throw new AppError("FG Serial Number is required", 400);
  }

  const query = `
    Update DispatchUnloading 
    Set ModelName=@modelName 
    Where FGSerialNo=@fgSerial
  `;

  const pool = await new sql.ConnectionPool(dbConfig2).connect();

  try {
    const result = await pool
      .request()
      .input("modelName", sql.NVarChar, modelName)
      .input("fgSerial", sql.NVarChar, fgSerial)
      .query(query);

    if (!result.rowsAffected[0]) {
      throw new AppError(
        "No records updated. Please check the FG Serial Number.",
        404
      );
    }

    res.status(200).json({
      success: true,
      data: result.rowsAffected[0],
    });
  } catch (error) {
    throw new AppError(`Failed to update model name: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});
