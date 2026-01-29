import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getLptRecipe = tryCatch(async (req, res) => {
  const { modelName } = req.query;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool.request();

    let query = "SELECT * FROM LPTRecipe";

    if (modelName) {
      query += " WHERE ModelName = @modelName";
      request.input("modelName", sql.VarChar, modelName);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "LPT Recipe data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the LPT Recipe data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const deleteLptRecipe = tryCatch(async (req, res) => {
  const { modelName } = req.params;

  if (!modelName) {
    throw new AppError("Missing required query parameters: modelName.", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool.request().input("modelName", sql.VarChar, modelName);

    await request.query(`
      DELETE FROM LPTRecipe WHERE ModelName = @modelName
    `);

    res
      .status(200)
      .json({ success: true, message: "Recipe deleted successfully" });
  } catch (error) {
    throw new AppError(
      `Failed to delete the LPT Recipe data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const insertLptRecipe = tryCatch(async (req, res) => {
  const {
    matCode,
    modelName,
    minTemp,
    maxTemp,
    minCurr,
    maxCurr,
    minPow,
    maxPow,
  } = req.body;

  if (
    !matCode ||
    !modelName ||
    !minTemp ||
    !maxTemp ||
    !minCurr ||
    !maxCurr ||
    !minPow ||
    !maxPow
  ) {
    throw new AppError(
      "Missing required fields: matCode, modelName, minTemp, maxTemp, minCurr, maxCurr, minPow or maxPow.",
      400,
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("matcode", sql.VarChar, matCode)
      .input("modelName", sql.VarChar, modelName)
      .input("MinTemp", sql.VarChar, minTemp)
      .input("MaxTemp", sql.VarChar, maxTemp)
      .input("MinCurrent", sql.VarChar, minCurr)
      .input("MaxCurrent", sql.VarChar, maxCurr)
      .input("MinPower", sql.VarChar, minPow)
      .input("MaxPower", sql.VarChar, maxPow);

    await request.query(`
      INSERT INTO LPTRecipe (Matcode, ModelName, MinTemp, MaxTemp, MinCurrent, MaxCurrent, MinPower, MaxPower)
      VALUES (@matcode, @modelName, @MinTemp, @MaxTemp, @MinCurrent, @MaxCurrent, @MinPower, @MaxPower)
    `);

    res
      .status(201)
      .json({ success: true, message: "Recipe inserted successfully" });
  } catch (error) {
    throw new AppError(
      `Failed to insert the LPT Recipe data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

export const updateLptRecipe = tryCatch(async (req, res) => {
  const { modelName } = req.params;
  const { minTemp, maxTemp, minCurr, maxCurr, minPow, maxPow } = req.body;

  if (!minTemp || !maxTemp || !minCurr || !maxCurr || !minPow || !maxPow) {
    throw new AppError(
      "Missing required fields: minTemp, maxTemp, minCurr, maxCurr, minPow or maxPow.",
      400,
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("modelName", sql.VarChar, modelName)
      .input("MinTemp", sql.VarChar, minTemp)
      .input("MaxTemp", sql.VarChar, maxTemp)
      .input("MinCurrent", sql.VarChar, minCurr)
      .input("MaxCurrent", sql.VarChar, maxCurr)
      .input("MinPower", sql.VarChar, minPow)
      .input("MaxPower", sql.VarChar, maxPow);

    await request.query(`
  UPDATE LPTRecipe
  SET 
    MinTemp = @MinTemp,
    MaxTemp = @MaxTemp,
    MinCurrent = @MinCurrent,
    MaxCurrent = @MaxCurrent,
    MinPower = @MinPower,
    MaxPower = @MaxPower
  WHERE ModelName = @modelName
`);

    res
      .status(200)
      .json({ success: true, message: "Recipe updated successfully" });
  } catch (error) {
    throw new AppError(
      `Failed to update the LPT Recipe data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
