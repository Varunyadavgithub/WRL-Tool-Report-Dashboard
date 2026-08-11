import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

/* ═══════════════════════════════════════════════════════════════════════
   GET — global BIS test-frequency defaults (single row, seeded by migration)
═══════════════════════════════════════════════════════════════════════ */
export const getBisTestFrequencyConfig = tryCatch(async (_, res) => {
  try {
    const pool = await connectToDB(dbConfig1);

    const result = await pool.request().query(`
      SELECT TOP 1
        Id, IntroductionFrequencyMonths, IntroductionDurationDays,
        SoundFrequencyMonths, SoundDurationDays,
        VolumeFrequencyMonths, VolumeDurationDays,
        UpdatedBy, UpdatedAt
      FROM BISTestFrequencyConfig
      ORDER BY Id
    `);

    if (result.recordset.length === 0) {
      throw new AppError("BIS test frequency config not found.", 404);
    }

    const row = result.recordset[0];
    res.status(200).json({
      success: true,
      config: {
        id: row.Id,
        introductionFrequencyMonths: row.IntroductionFrequencyMonths,
        introductionDurationDays: row.IntroductionDurationDays,
        soundFrequencyMonths: row.SoundFrequencyMonths,
        soundDurationDays: row.SoundDurationDays,
        volumeFrequencyMonths: row.VolumeFrequencyMonths,
        volumeDurationDays: row.VolumeDurationDays,
        updatedBy: row.UpdatedBy,
        updatedAt: row.UpdatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to fetch BIS test frequency config: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   UPDATE — all 6 fields required together so the form always saves a
   complete, consistent set of defaults
═══════════════════════════════════════════════════════════════════════ */
export const updateBisTestFrequencyConfig = tryCatch(async (req, res) => {
  const {
    introductionFrequencyMonths, introductionDurationDays,
    soundFrequencyMonths, soundDurationDays,
    volumeFrequencyMonths, volumeDurationDays,
  } = req.body;

  const fields = {
    introductionFrequencyMonths, introductionDurationDays,
    soundFrequencyMonths, soundDurationDays,
    volumeFrequencyMonths, volumeDurationDays,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || Number.isNaN(Number(value)) || Number(value) <= 0) {
      throw new AppError(`Missing or invalid field: ${key}. All frequency/duration values must be positive numbers.`, 400);
    }
  }

  const updatedBy = req.user?.name || req.user?.usercode || "system";

  try {
    const pool = await connectToDB(dbConfig1);

    const existing = await pool.request().query(`SELECT TOP 1 Id FROM BISTestFrequencyConfig ORDER BY Id`);
    if (existing.recordset.length === 0) {
      throw new AppError("BIS test frequency config not found.", 404);
    }

    await pool
      .request()
      .input("Id", sql.Int, existing.recordset[0].Id)
      .input("IntroductionFrequencyMonths", sql.Int, Number(introductionFrequencyMonths))
      .input("IntroductionDurationDays", sql.Int, Number(introductionDurationDays))
      .input("SoundFrequencyMonths", sql.Int, Number(soundFrequencyMonths))
      .input("SoundDurationDays", sql.Int, Number(soundDurationDays))
      .input("VolumeFrequencyMonths", sql.Int, Number(volumeFrequencyMonths))
      .input("VolumeDurationDays", sql.Int, Number(volumeDurationDays))
      .input("UpdatedBy", sql.NVarChar(100), updatedBy).query(`
        UPDATE BISTestFrequencyConfig
        SET IntroductionFrequencyMonths = @IntroductionFrequencyMonths,
            IntroductionDurationDays    = @IntroductionDurationDays,
            SoundFrequencyMonths        = @SoundFrequencyMonths,
            SoundDurationDays           = @SoundDurationDays,
            VolumeFrequencyMonths       = @VolumeFrequencyMonths,
            VolumeDurationDays          = @VolumeDurationDays,
            UpdatedBy                   = @UpdatedBy,
            UpdatedAt                   = GETDATE()
        WHERE Id = @Id
      `);

    res.status(200).json({ success: true, message: "BIS test frequency config updated successfully." });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update BIS test frequency config: ${error.message}`, 500);
  }
});
