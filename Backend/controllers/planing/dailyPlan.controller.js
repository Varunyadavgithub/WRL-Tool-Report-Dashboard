import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Add Daily Plan
export const addDailyPlans = tryCatch(async (req, res) => {
  const planData = req.body;

  if (!Array.isArray(planData) || planData.length === 0) {
    throw new AppError("Empty or invalid plans array.", 400);
  }

  let pool;
  try {
    // Connect to the database
    pool = await sql.connect(dbConfig1);

    const uploadResults = [];

    for (const plan of planData) {
      const {
        shift: Shift,
        planQty: PlanQty,
        department: Department,
        station: Station,
      } = plan;

      // Validate required fields
      if (!Shift || !PlanQty || !Department || !Station) {
        uploadResults.push({
          status: "failed",
          reason: "Missing required fields",
          plan,
        });
        continue;
      }

      const RefDate = new Date(new Date().getTime() + 330 * 60000); // Current IST
      const PlanDate = new Date(RefDate).toISOString().split("T")[0];
      const Status = 1; // Default status
      const BusinessUnit = 12201; // Default business unit

      const query = `
        INSERT INTO DailyPlan (
          RefNo,
          RefDate,
          PlanDate,
          Shift,
          PlanQty,
          Department,
          Station,
          Status,
          BusinessUnit
        )
        SELECT
          (SELECT TOP 1 RefNo + 1 FROM DailyPlan ORDER BY RefNo DESC),
          @RefDate,
          @PlanDate,
          (SELECT ShiftCode FROM Shift WHERE Name = @Shift),
          @PlanQty,
          (SELECT DeptCode FROM Department WHERE Name = @Department),
          (SELECT StationCode FROM WorkCenter WHERE Alias = @Station),
          @Status,
          @BusinessUnit
      `;

      try {
        const result = await pool
          .request()
          .input("RefDate", sql.DateTime, RefDate)
          .input("PlanDate", sql.Date, PlanDate)
          .input("Shift", sql.VarChar, Shift)
          .input("PlanQty", sql.Int, PlanQty)
          .input("Department", sql.VarChar, Department)
          .input("Station", sql.VarChar, Station)
          .input("Status", sql.Int, Status)
          .input("BusinessUnit", sql.Int, BusinessUnit)
          .query(query);

        if (result.rowsAffected[0] > 0) {
          uploadResults.push({
            status: "success",
            insertedRows: result.rowsAffected[0],
          });
        } else {
          uploadResults.push({
            status: "failed",
            reason: "No rows inserted",
            plan,
          });
        }
      } catch (insertErr) {
        uploadResults.push({
          status: "failed",
          reason: insertErr.message,
          plan,
        });
      }
    }

    const successfulUploads = uploadResults.filter(
      (r) => r.status === "success"
    );
    const failedUploads = uploadResults.filter((r) => r.status === "failed");

    if (successfulUploads.length === 0) {
      throw new AppError("Failed to insert any Daily Plans", 400, {
        failedUploads,
      });
    }

    res.status(201).json({
      success: true,
      message: "Daily Plans processed successfully",
      successCount: successfulUploads.length,
      failedCount: failedUploads.length,
      successfulUploads,
      failedUploads,
    });
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    } else {
      throw new AppError(`Internal server error: ${err.message}`, 500);
    }
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (closeErr) {
        console.error("Error closing database connection:", closeErr);
      }
    }
  }
});

// Fetch Daily Plans
export const fetchDailyPlans = tryCatch(async (req, res) => {
  const pool = await sql.connect(dbConfig1);

  try {
    const today = new Date(); //2025-07-01T04:38:52.699Z
    const currentDate = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    ); //2025-07-01

    const query = `
      Select  RefNo, RefDate , PlanDate, sh.Name as Shift, PlanQty, dpt.Name as Department, wc.Alias from DailyPlan dp 
        INNER JOIN shift sh on sh.ShiftCode = dp.Shift
        INNER JOIN Department dpt on dpt.DeptCode = dp.Department
        INNER JOIN WorkCenter wc on wc.StationCode = dp.Station
      Where PlanDate = @currentDate
    `;

    const request = pool.request().input("currentDate", sql.Date, currentDate);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Daily Plans data retrieved successfully.",
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Daily Plans data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
