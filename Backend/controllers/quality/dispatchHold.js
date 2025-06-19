import sql, { dbConfig1, dbConfig2 } from "../../config/db.js";

// Utility to safely connect and return pool
const getNewConnection = async (config) => {
  const pool = await sql.connect(config);
  return pool;
};

// Get Model Name
export const getModlelName = async (req, res) => {
  const { AssemblySerial } = req.query;

  if (!AssemblySerial) {
    return res.status(400).json({ error: "Missing AssemblySerial." });
  }

  try {
    const query = `
    SELECT m.Name AS combinedserial
    FROM MaterialBarcode AS mb
    INNER JOIN Material AS m ON m.MatCode = mb.Material
    WHERE mb.Serial = @AssemblySerial;
  `;

    const pool = await sql.connect(dbConfig1);

    const result = await pool
      .request()
      .input("AssemblySerial", sql.VarChar, AssemblySerial)
      .query(query);

    if (!result.recordset.length) {
      return res.json({ combinedserial: null });
    }

    res.json(result.recordset[0]);

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Hold Cabinet
export const holdCabinet = async (req, res) => {
  const holds = req.body;
  if (!Array.isArray(holds) || holds.length === 0) {
    return res.status(400).json({ error: "Empty or invalid holds array." });
  }

  try {
    for (const hold of holds) {
      const { modelName, fgNo, userName, defect, formattedDate } = hold;

      // Convert to IST (UTC+5:30)
      const currDate = new Date(
        new Date(formattedDate).getTime() + 330 * 60000
      );

      // 1. Check Hold Status in Garuda DB
      const HoldStatusPool = await getNewConnection(dbConfig1);
      const HoldStatusResult = await HoldStatusPool.request()
        .input("FGNo", sql.VarChar, fgNo)
        .query(
          "Select serial from MaterialBarcode where status = 11 and serial = @FGNo"
        );

      const HoldStatus = HoldStatusResult.recordset[0]?.serial || "~";
      await HoldStatusPool.close();

      if (HoldStatus === "~") {
        // 2. Check TempDispatch DB
        const tempDispatchPool = await getNewConnection(dbConfig2);
        const tempDispatchResult = await tempDispatchPool
          .request()
          .input("FGNo", sql.VarChar, fgNo)
          .query(
            "SELECT Session_ID FROM TempDispatch WHERE FGSerialNo = @FGNo"
          );

        const tempDispatch = tempDispatchResult.recordset[0]?.Session_ID || "~";
        await tempDispatchPool.close();

        if (tempDispatch === "~") {
          // 3. Check DispatchMaster DB (Assuming another or same DB)
          const dispatchMasterPool = await getNewConnection(dbConfig2);
          const dispatchResult = await dispatchMasterPool
            .request()
            .input("FGNo", sql.VarChar, fgNo)
            .query(
              "SELECT Session_ID FROM DispatchMaster WHERE FGSerialNo = @FGNo"
            );

          const dispatchSession =
            dispatchResult.recordset[0]?.Session_ID || "~";
          await dispatchMasterPool.close();

          if (dispatchSession === "~") {
            // 4. Proceed with Insert and Update
            const holdPool = await getNewConnection(dbConfig1);
            const transaction = new sql.Transaction(holdPool);

            try {
              await transaction.begin();
              const request = new sql.Request(transaction);
              await request
                .input("ModelName", sql.VarChar, modelName)
                .input("UserCode", sql.Int, userName)
                .input("Defect", sql.VarChar, defect)
                .input("FGNo", sql.VarChar, fgNo)
                .input("HoldDateTime", sql.DateTime, currDate).query(`
                BEGIN TRANSACTION;

                INSERT INTO DispatchHold (material, HoldUserCode, DefectCode, serial, HoldDateTime) 
                VALUES (
                    (SELECT TOP 1 MatCode FROM Material WHERE Name = @ModelName), 
                    @UserCode,
                    @Defect, 
                    @FGNo, 
                    @HoldDateTime
                )

                UPDATE MaterialBarcode 
                SET Status = 11 
                WHERE Serial = @FGNo;

                COMMIT TRANSACTION;
              `);

              await transaction.commit();
            } catch (insertErr) {
              await transaction.rollback();
              throw insertErr;
            } finally {
              await holdPool.close();
            }
          } else {
            return res.status(200).json({
              message: `FGNo ${fgNo} already dispatched under session ${dispatchSession}`,
            });
          }
        } else {
          return res.status(200).json({
            message: `FGNo ${fgNo} is being loading in the truck under session ${tempDispatch}`,
          });
        }
      } else {
        return res.status(200).json({
          message: `This FG serial no. ${HoldStatus} is already Hold`,
        });
      }
    }

    res
      .status(200)
      .json({ message: "All eligible records held successfully." });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Something went wrong while processing hold records." });
  }
};

// Release Cabinet
export const releaseCabinet = async (req, res) => {
  const releases = req.body;
  if (!Array.isArray(releases) || releases.length === 0) {
    return res.status(400).json({ error: "Invalid or empty request body." });
  }

  try {
    for (const release of releases) {
      const { modelName, fgNo, releaseUserCode, action, formattedDate } =
        release;

      // Convert to IST (UTC+5:30)
      const currDate = new Date(
        new Date(formattedDate).getTime() + 330 * 60000
      );

      // 1. Check Release Status in Garuda DB
      const ReleaseStatusPool = await getNewConnection(dbConfig1);
      const ReleaseStatusResult = await ReleaseStatusPool.request()
        .input("FGNo", sql.VarChar, fgNo)
        .query(
          "Select serial from MaterialBarcode where status = 1 and serial = @FGNo"
        );

      const ReleaseStatus = ReleaseStatusResult.recordset[0]?.serial || "~";
      await ReleaseStatusPool.close();

      if (ReleaseStatus === "~") {
        // 2. Proceed with Insert and Update for Release
        const releasePool = await getNewConnection(dbConfig1);
        const transaction = new sql.Transaction(releasePool);

        try {
          await transaction.begin();
          const request = new sql.Request(transaction);
          await request
            .input("ModelName", sql.VarChar, modelName)
            .input("UserCode", sql.Int, releaseUserCode)
            .input("Action", sql.VarChar, action)
            .input("FGNo", sql.VarChar, fgNo)
            .input("ReleaseDateTime", sql.DateTime, currDate).query(`
                BEGIN TRANSACTION;

                UPDATE DispatchHold
                SET [Action] = @Action,
                    ReleasedUserCode = @UserCode,
                    ReleasedDateTime = @ReleaseDateTime
                WHERE serial = @FGNo

                UPDATE MaterialBarcode
                SET Status = 1
                WHERE Serial = @FGNo;

                COMMIT TRANSACTION;
              `);

          await transaction.commit();
        } catch (insertErr) {
          await transaction.rollback();
          throw insertErr;
        } finally {
          await releasePool.close();
        }
      } else {
        return res.status(200).json({
          message: `This FG serial no. ${ReleaseStatus} is already Released`,
        });
      }
    }

    res
      .status(200)
      .json({ message: "All FG serial no. has been successfully relesed." });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong while processing release records.",
    });
  }
};
