import sql from "mssql";
import { dbConfig1, dbConfig2 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// ─── shared helper ───────────────────────────────────────────────────────────
const openPool = (config) => new sql.ConnectionPool(config).connect();

// ─── Get Model Name ──────────────────────────────────────────────────────────
export const getModlelName = tryCatch(async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    throw new AppError("Missing required query parameter: AssemblySerial.", 400);
  }

  const pool = await openPool(dbConfig1);
  try {
    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(`
        SELECT m.Name AS combinedserial
        FROM MaterialBarcode AS mb
        INNER JOIN Material AS m ON m.MatCode = mb.Material
        WHERE mb.Serial = @AssemblySerial;
      `);

    res.status(200).json({
      success: true,
      message: "Model Name data retrieved successfully.",
      combinedserial: result.recordset[0]?.combinedserial || null,
    });
  } finally {
    await pool.close();
  }
});

// ─── Hold Cabinet ────────────────────────────────────────────────────────────
export const holdCabinet = tryCatch(async (req, res) => {
  const holds = req.body;

  if (!Array.isArray(holds) || holds.length === 0) {
    throw new AppError("Empty or invalid holds array.", 400);
  }

  // ── Deduplicate serials in the incoming payload ──────────────────────────
  const uniqueSerials = [...new Set(holds.map((h) => h.fgNo))];
  if (uniqueSerials.length !== holds.length) {
    throw new AppError(
      "Duplicate FG serial numbers found in the request payload.",
      400
    );
  }

  const db1Pool = await openPool(dbConfig1);
  const db2Pool = await openPool(dbConfig2);

  const failed = [];   // [{ fgNo, reason }]
  const valid  = [];   // holds that passed all checks

  try {
    // ── Pre-flight checks — collect errors, don't throw ───────────────────
    for (const hold of holds) {
      const { fgNo } = hold;

      // 1️⃣ Already on Hold?
      const statusResult = await db1Pool
        .request()
        .input("FGNo", sql.VarChar, fgNo)
        .query("SELECT serial FROM MaterialBarcode WHERE status = 11 AND serial = @FGNo");

      if (statusResult.recordset.length) {
        failed.push({ fgNo, reason: "Already on Hold" });
        continue;
      }

      // 2️⃣ In TempDispatch?
      const tempResult = await db2Pool
        .request()
        .input("FGNo", sql.VarChar, fgNo)
        .query("SELECT Session_ID FROM TempDispatch WHERE FGSerialNo = @FGNo");

      if (tempResult.recordset.length) {
        failed.push({
          fgNo,
          reason: `Being loaded under session ${tempResult.recordset[0].Session_ID}`,
        });
        continue;
      }

      // 3️⃣ Already Dispatched?
      const dispatchResult = await db2Pool
        .request()
        .input("FGNo", sql.VarChar, fgNo)
        .query("SELECT Session_ID FROM DispatchMaster WHERE FGSerialNo = @FGNo");

      if (dispatchResult.recordset.length) {
        failed.push({
          fgNo,
          reason: `Already dispatched under session ${dispatchResult.recordset[0].Session_ID}`,
        });
        continue;
      }

      valid.push(hold);
    }

    // ── Insert only the valid ones in a single transaction ────────────────
    if (valid.length > 0) {
      const transaction = new sql.Transaction(db1Pool);
      await transaction.begin();

      try {
        for (const hold of valid) {
          const { modelName, fgNo, userName, defect, formattedDate } = hold;
          const currDate = convertToIST(formattedDate);

          await new sql.Request(transaction)
            .input("ModelName", sql.VarChar, modelName)
            .input("UserCode", sql.Int, userName)
            .input("Defect", sql.VarChar, defect)
            .input("FGNo", sql.VarChar, fgNo)
            .input("HoldDateTime", sql.DateTime, currDate).query(`
              INSERT INTO DispatchHold
                (material, HoldUserCode, DefectCode, serial, HoldDateTime)
              VALUES (
                (SELECT TOP 1 MatCode FROM Material WHERE Name = @ModelName),
                @UserCode,
                @Defect,
                @FGNo,
                @HoldDateTime
              );

              UPDATE MaterialBarcode
              SET Status = 11
              WHERE Serial = @FGNo;
            `);
        }

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw new AppError(`Hold transaction failed: ${error.message}`, 500);
      }
    }
  } finally {
    await db1Pool.close();
    await db2Pool.close();
  }

  // ── Build response summary ────────────────────────────────────────────────
  res.status(200).json({
    success: true,
    message: `${valid.length} serial(s) held successfully${failed.length ? `, ${failed.length} skipped` : ""}.`,
    held:    valid.map((h) => h.fgNo),
    skipped: failed,   // [{ fgNo, reason }]
  });
});

// ─── Release Cabinet ─────────────────────────────────────────────────────────
export const releaseCabinet = tryCatch(async (req, res) => {
  const releases = req.body;

  if (!Array.isArray(releases) || releases.length === 0) {
    throw new AppError("Invalid or empty request body.", 400);
  }

  // ── Deduplicate serials in the incoming payload ──────────────────────────
  const uniqueSerials = [...new Set(releases.map((r) => r.fgNo))];
  if (uniqueSerials.length !== releases.length) {
    throw new AppError(
      "Duplicate FG serial numbers found in the request payload.",
      400
    );
  }

  const db1Pool = await openPool(dbConfig1);

  const failed = [];
  const valid  = [];

  try {
    // ── Pre-flight check — must be on Hold (status = 11) to release ───────
    for (const release of releases) {
      const { fgNo } = release;

      const statusResult = await db1Pool
        .request()
        .input("FGNo", sql.VarChar, fgNo)
        .query("SELECT serial FROM MaterialBarcode WHERE status = 11 AND serial = @FGNo");

      if (!statusResult.recordset.length) {
        failed.push({ fgNo, reason: "Not currently on Hold" });
        continue;
      }

      valid.push(release);
    }

    // ── Release only the valid ones in a single transaction ───────────────
    if (valid.length > 0) {
      const transaction = new sql.Transaction(db1Pool);
      await transaction.begin();

      try {
        for (const release of valid) {
          const { fgNo, releaseUserCode, action, formattedDate } = release;
          const currDate = convertToIST(formattedDate);

          await new sql.Request(transaction)
            .input("FGNo", sql.VarChar, fgNo)
            .input("UserCode", sql.Int, releaseUserCode)
            .input("Action", sql.VarChar, action)
            .input("ReleaseDateTime", sql.DateTime, currDate).query(`
              UPDATE DispatchHold
              SET [Action]         = @Action,
                  ReleasedUserCode = @UserCode,
                  ReleasedDateTime = @ReleaseDateTime
              WHERE serial = @FGNo;

              UPDATE MaterialBarcode
              SET Status = 1
              WHERE Serial = @FGNo;
            `);
        }

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw new AppError(`Release transaction failed: ${error.message}`, 500);
      }
    }
  } finally {
    await db1Pool.close();
  }

  // ── Build response summary ────────────────────────────────────────────────
  res.status(200).json({
    success: true,
    message: `${valid.length} serial(s) released successfully${failed.length ? `, ${failed.length} skipped` : ""}.`,
    released: valid.map((r) => r.fgNo),
    skipped:  failed,   // [{ fgNo, reason }]
  });
});