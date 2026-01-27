import sql from "mssql";
import { dbConfig3 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Get all models
export const getBeeModels = tryCatch(async (_, res) => {
  const pool = await sql.connect(dbConfig3);

  const result = await pool.request().query(`
    SELECT ModelName AS model, Volume AS volume, Type AS type
    FROM BEE_ModelMaster
    ORDER BY ModelName
  `);

  res.status(200).json({
    success: true,
    models: result.recordset,
  });

  await pool.close();
});

// Save / Update models (bulk)
export const saveBeeModels = tryCatch(async (req, res) => {
  const models = req.body;

  if (!Array.isArray(models)) {
    throw new AppError("Invalid model list", 400);
  }

  const pool = await sql.connect(dbConfig3);

  for (const m of models) {
    if (!m.type) throw new AppError("Model type is required", 400);

    await pool
      .request()
      .input("ModelName", sql.VarChar, m.model)
      .input("Volume", sql.Int, m.volume)
      .input("Type", sql.VarChar, m.type).query(`
        MERGE BEE_ModelMaster AS target
        USING (SELECT @ModelName AS ModelName) AS source
        ON target.ModelName = source.ModelName
        WHEN MATCHED THEN
          UPDATE SET Volume = @Volume, Type = @Type
        WHEN NOT MATCHED THEN
          INSERT (ModelName, Volume, Type)
          VALUES (@ModelName, @Volume, @Type);
      `);
  }

  res.status(200).json({
    success: true,
    message: "Model Master updated successfully",
  });

  await pool.close();
});

// Delete model
export const deleteBeeModel = tryCatch(async (req, res) => {
  const { model } = req.params;

  if (!model) throw new AppError("Model name required", 400);

  const pool = await sql.connect(dbConfig3);

  await pool
    .request()
    .input("ModelName", sql.VarChar, model)
    .query(`DELETE FROM BEE_ModelMaster WHERE ModelName = @ModelName`);

  res.status(200).json({
    success: true,
    message: "Model deleted successfully",
  });

  await pool.close();
});

// Save Bee Rating
export const saveBeeRating = tryCatch(async (req, res) => {
  const { hardModel, hardRating, glassModel, glassRating } = req.body;

  if (!hardModel && !glassModel) {
    throw new AppError("No BEE data to save", 400);
  }

  if (hardModel && glassModel) {
    throw new AppError(
      "Please save either Hard Top or Glass Top, not both",
      400,
    );
  }

  const pool = await sql.connect(dbConfig3);

  await pool
    .request()
    .input("HardModel", sql.VarChar, hardModel || null)
    .input("HardRating", sql.Int, hardRating || null)
    .input("GlassModel", sql.VarChar, glassModel || null)
    .input("GlassRating", sql.Int, glassRating || null).query(`
      INSERT INTO BEE_Rating
      (HardModel, HardRating, GlassModel, GlassRating)
      VALUES
      (@HardModel, @HardRating, @GlassModel, @GlassRating)
    `);

  res.status(200).json({
    success: true,
    message: "BEE Rating saved successfully",
  });

  await pool.close();
});
