import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Per-model schedule overrides — every field is optional; blank/undefined
// means "fall back to the BISTestFrequencyConfig global default" (NULL).
const OVERRIDE_FIELDS = [
  "introductionFrequencyMonths", "introductionDurationDays",
  "soundFrequencyMonths", "soundDurationDays",
  "volumeFrequencyMonths", "volumeDurationDays",
];

const parseOverride = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) {
    throw new AppError("Schedule override values must be positive numbers, or left blank to use the default.", 400);
  }
  return n;
};

/* ═══════════════════════════════════════════════════════════════════════
   LIST
═══════════════════════════════════════════════════════════════════════ */
export const getBisCategories = tryCatch(async (_, res) => {
  try {
    const pool = await connectToDB(dbConfig1);

    // Inner-joined to Material (Type = 100) so the list reflects the
    // current material master — a row whose material later stops being
    // Type 100 drops out here — and surfaces Material's own Name alongside
    // BISCategory's ModelName for reference/future material codes.
    const result = await pool.request().query(`
      SELECT BC.Id, BC.MaterialCode, m.Name AS MaterialName, BC.ModelName, BC.Category, BC.CreatedAt, BC.UpdatedAt,
             BC.IntroductionFrequencyMonths, BC.IntroductionDurationDays,
             BC.SoundFrequencyMonths, BC.SoundDurationDays,
             BC.VolumeFrequencyMonths, BC.VolumeDurationDays
      FROM BISCategory BC
      INNER JOIN Material m ON m.MatCode = BC.MaterialCode
      WHERE m.Type = 100
      ORDER BY BC.ModelName
    `);

    const categories = result.recordset.map((row) => ({
      id: row.Id,
      materialCode: row.MaterialCode,
      materialName: row.MaterialName,
      modelName: row.ModelName,
      category: row.Category,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      introductionFrequencyMonths: row.IntroductionFrequencyMonths,
      introductionDurationDays: row.IntroductionDurationDays,
      soundFrequencyMonths: row.SoundFrequencyMonths,
      soundDurationDays: row.SoundDurationDays,
      volumeFrequencyMonths: row.VolumeFrequencyMonths,
      volumeDurationDays: row.VolumeDurationDays,
    }));

    res.status(200).json({ success: true, categories });
  } catch (error) {
    throw new AppError(`Failed to fetch BIS categories: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   LIST TYPE-100 MATERIALS (for the Add-Model material picker)
═══════════════════════════════════════════════════════════════════════ */
export const getType100Materials = tryCatch(async (_, res) => {
  try {
    const pool = await connectToDB(dbConfig1);

    const result = await pool.request().query(`
      SELECT MatCode, Name
      FROM Material
      WHERE Type = 100
      ORDER BY Name
    `);

    const materials = result.recordset.map((row) => ({
      matCode: row.MatCode,
      name: row.Name,
    }));

    res.status(200).json({ success: true, materials });
  } catch (error) {
    throw new AppError(`Failed to fetch materials: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   CREATE
═══════════════════════════════════════════════════════════════════════ */
export const createBisCategory = tryCatch(async (req, res) => {
  const { materialCode, modelName, category } = req.body;

  if (
    !materialCode ||
    !modelName ||
    category === undefined ||
    category === null
  ) {
    throw new AppError(
      "Missing required fields: materialCode, modelName or category.",
      400,
    );
  }

  const overrides = Object.fromEntries(
    OVERRIDE_FIELDS.map((key) => [key, parseOverride(req.body[key])]),
  );

  try {
    const pool = await connectToDB(dbConfig1);

    const existing = await pool
      .request()
      .input("MaterialCode", sql.NVarChar(50), materialCode)
      .query(`SELECT Id FROM BISCategory WHERE MaterialCode = @MaterialCode`);

    if (existing.recordset.length > 0) {
      throw new AppError(
        "A BIS category entry for this material code already exists.",
        409,
      );
    }

    const insertResult = await pool
      .request()
      .input("MaterialCode", sql.NVarChar(50), materialCode)
      .input("ModelName", sql.NVarChar(300), modelName)
      .input("Category", sql.TinyInt, category ? 1 : 0)
      .input("IntroductionFrequencyMonths", sql.Int, overrides.introductionFrequencyMonths)
      .input("IntroductionDurationDays", sql.Int, overrides.introductionDurationDays)
      .input("SoundFrequencyMonths", sql.Int, overrides.soundFrequencyMonths)
      .input("SoundDurationDays", sql.Int, overrides.soundDurationDays)
      .input("VolumeFrequencyMonths", sql.Int, overrides.volumeFrequencyMonths)
      .input("VolumeDurationDays", sql.Int, overrides.volumeDurationDays).query(`
        INSERT INTO BISCategory (
          MaterialCode, ModelName, Category,
          IntroductionFrequencyMonths, IntroductionDurationDays,
          SoundFrequencyMonths, SoundDurationDays,
          VolumeFrequencyMonths, VolumeDurationDays
        )
        OUTPUT INSERTED.Id
        VALUES (
          @MaterialCode, @ModelName, @Category,
          @IntroductionFrequencyMonths, @IntroductionDurationDays,
          @SoundFrequencyMonths, @SoundDurationDays,
          @VolumeFrequencyMonths, @VolumeDurationDays
        )
      `);

    res.status(200).json({
      success: true,
      id: insertResult.recordset[0].Id,
      message: "BIS category added successfully.",
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to add BIS category: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   UPDATE
═══════════════════════════════════════════════════════════════════════ */
export const updateBisCategory = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { materialCode, modelName, category } = req.body;

  if (!id) throw new AppError("Missing required field: id.", 400);
  if (
    !materialCode ||
    !modelName ||
    category === undefined ||
    category === null
  ) {
    throw new AppError(
      "Missing required fields: materialCode, modelName or category.",
      400,
    );
  }

  const overrides = Object.fromEntries(
    OVERRIDE_FIELDS.map((key) => [key, parseOverride(req.body[key])]),
  );

  try {
    const pool = await connectToDB(dbConfig1);

    const result = await pool
      .request()
      .input("Id", sql.Int, parseInt(id, 10))
      .input("MaterialCode", sql.NVarChar(50), materialCode)
      .input("ModelName", sql.NVarChar(300), modelName)
      .input("Category", sql.TinyInt, category ? 1 : 0)
      .input("IntroductionFrequencyMonths", sql.Int, overrides.introductionFrequencyMonths)
      .input("IntroductionDurationDays", sql.Int, overrides.introductionDurationDays)
      .input("SoundFrequencyMonths", sql.Int, overrides.soundFrequencyMonths)
      .input("SoundDurationDays", sql.Int, overrides.soundDurationDays)
      .input("VolumeFrequencyMonths", sql.Int, overrides.volumeFrequencyMonths)
      .input("VolumeDurationDays", sql.Int, overrides.volumeDurationDays).query(`
        UPDATE BISCategory
        SET MaterialCode = @MaterialCode,
            ModelName    = @ModelName,
            Category     = @Category,
            IntroductionFrequencyMonths = @IntroductionFrequencyMonths,
            IntroductionDurationDays    = @IntroductionDurationDays,
            SoundFrequencyMonths        = @SoundFrequencyMonths,
            SoundDurationDays           = @SoundDurationDays,
            VolumeFrequencyMonths       = @VolumeFrequencyMonths,
            VolumeDurationDays          = @VolumeDurationDays,
            UpdatedAt    = GETDATE()
        WHERE Id = @Id
      `);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "BIS category updated successfully." });
  } catch (error) {
    throw new AppError(`Failed to update BIS category: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   DELETE
═══════════════════════════════════════════════════════════════════════ */
export const deleteBisCategory = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Missing required field: id.", 400);

  try {
    const pool = await connectToDB(dbConfig1);

    const result = await pool
      .request()
      .input("Id", sql.Int, parseInt(id, 10))
      .query(`DELETE FROM BISCategory WHERE Id = @Id`);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "BIS category deleted successfully." });
  } catch (error) {
    throw new AppError(`Failed to delete BIS category: ${error.message}`, 500);
  }
});
