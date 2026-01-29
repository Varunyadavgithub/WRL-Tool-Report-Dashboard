import sql from "mssql";
import { dbConfig1, dbConfig2 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Get Model Name
export const getModlelName = tryCatch(async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    throw new AppError(
      "Missing required query parameters: assemblySerial.",
      400
    );
  }

  const query = `
    SELECT m.Name AS combinedserial
    FROM MaterialBarcode AS mb
    INNER JOIN Material AS m ON m.MatCode = mb.Material
    WHERE mb.Serial = @AssemblySerial;
  `;

  const pool = await sql.connect(dbConfig1);

  try {
    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Model Name data retrieved successfully.",
      combinedserial: result.recordset[0]?.combinedserial || null,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch model name: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// Hold Cabinet
export const holdCabinet = tryCatch(async (req, res) => {
  const holds = req.body;

  if (!Array.isArray(holds) || holds.length === 0) {
    throw new AppError("Empty or invalid holds array.", 400);
  }

  for (const hold of holds) {
    const { modelName, fgNo, userName, defect, formattedDate } = hold;

    const currDate = new Date(new Date(formattedDate).getTime() + 330 * 60000);

    /* 1️⃣ Check Hold Status */
    const statusPool = await new sql.ConnectionPool(dbConfig1).connect();
    try {
      const statusResult = await statusPool
        .request()
        .input("FGNo", sql.VarChar, fgNo)
        .query(
          "SELECT serial FROM MaterialBarcode WHERE status = 11 AND serial = @FGNo"
        );

      if (statusResult.recordset.length) {
        throw new AppError(`FGNo ${fgNo} is already on Hold.`, 400);
      }
    } finally {
      await statusPool.close();
    }

    /* 2️⃣ Check TempDispatch */
    const tempPool = await new sql.ConnectionPool(dbConfig2).connect();
    try {
      const tempResult = await tempPool
        .request()
        .input("FGNo", sql.VarChar, fgNo)
        .query("SELECT Session_ID FROM TempDispatch WHERE FGSerialNo = @FGNo");

      if (tempResult.recordset.length) {
        throw new AppError(
          `FGNo ${fgNo} is loading under session ${tempResult.recordset[0].Session_ID}`,
          400
        );
      }
    } finally {
      await tempPool.close();
    }

    /* 3️⃣ Check DispatchMaster */
    const dispatchPool = await new sql.ConnectionPool(dbConfig2).connect();
    try {
      const dispatchResult = await dispatchPool
        .request()
        .input("FGNo", sql.VarChar, fgNo)
        .query(
          "SELECT Session_ID FROM DispatchMaster WHERE FGSerialNo = @FGNo"
        );

      if (dispatchResult.recordset.length) {
        throw new AppError(
          `FGNo ${fgNo} already dispatched under session ${dispatchResult.recordset[0].Session_ID}`,
          400
        );
      }
    } finally {
      await dispatchPool.close();
    }

    /* 4️⃣ Insert Hold (Transaction) */
    const holdPool = await new sql.ConnectionPool(dbConfig1).connect();
    const transaction = new sql.Transaction(holdPool);

    try {
      await transaction.begin();
      await new sql.Request(transaction)
        .input("ModelName", sql.VarChar, modelName)
        .input("UserCode", sql.Int, userName)
        .input("Defect", sql.VarChar, defect)
        .input("FGNo", sql.VarChar, fgNo)
        .input("HoldDateTime", sql.DateTime, currDate).query(`
          INSERT INTO DispatchHold
          (material, HoldUserCode, DefectCode, serial, HoldDateTime)
          VALUES (
            (SELECT TOP 1 MatCode FROM Material WHERE Name=@ModelName),
            @UserCode,
            @Defect,
            @FGNo,
            @HoldDateTime
          );

          UPDATE MaterialBarcode
          SET Status = 11
          WHERE Serial = @FGNo;
        `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new AppError(`Hold failed: ${error.message}`, 500);
    } finally {
      await holdPool.close();
    }
  }

  res.status(200).json({
    success: true,
    message: "All eligible FG serial numbers held successfully.",
  });
});

// Release Cabinet
export const releaseCabinet = tryCatch(async (req, res) => {
  const releases = req.body;

  if (!Array.isArray(releases) || releases.length === 0) {
    throw new AppError("Invalid or empty request body.", 400);
  }

  for (const release of releases) {
    const { fgNo, releaseUserCode, action, formattedDate } = release;

    const currDate = new Date(new Date(formattedDate).getTime() + 330 * 60000);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      await new sql.Request(transaction)
        .input("FGNo", sql.VarChar, fgNo)
        .input("UserCode", sql.Int, releaseUserCode)
        .input("Action", sql.VarChar, action)
        .input("ReleaseDateTime", sql.DateTime, currDate).query(`
          UPDATE DispatchHold
          SET [Action]=@Action,
              ReleasedUserCode=@UserCode,
              ReleasedDateTime=@ReleaseDateTime
          WHERE serial=@FGNo;

          UPDATE MaterialBarcode
          SET Status=1
          WHERE Serial=@FGNo;
        `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new AppError(`Release failed: ${error.message}`, 500);
    } finally {
      await pool.close();
    }
  }

  res.status(200).json({
    success: true,
    message: "All FG serial numbers released successfully.",
  });
});
