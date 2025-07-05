import sql, { dbConfig1 } from "../../config/db.js";

// Add Daily Plan
export const addDailyPlans = async (req, res) => {
  const planData = req.body;
  if (!Array.isArray(planData) || planData.length === 0) {
    return res.status(400).json({ error: "Empty or invalid holds array." });
  }

  let pool;
  try {
    // Connect to the database
    pool = await sql.connect(dbConfig1);

    // Store results of each plan upload
    const uploadResults = [];

    // Process each plan
    for (const plan of planData) {
      // Validate required fields
      const {
        shift: Shift,
        planQty: PlanQty,
        department: Department,
        station: Station,
      } = plan;

      // Validate input
      if (!Shift || !PlanQty || !Department || !Station) {
        uploadResults.push({
          status: "failed",
          reason: "Missing required fields",
          plan: plan,
        });
        continue;
      }

      // Set default values
      const RefDate = new Date(new Date().getTime() + 330 * 60000); // Current date/time
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
          (SELECT TOP 1 RefNo+1 FROM DailyPlan ORDER BY RefNo DESC),
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

        // Check if the insert was successful
        if (result.rowsAffected[0] > 0) {
          uploadResults.push({
            status: "success",
            insertedRows: result.rowsAffected[0],
          });
        } else {
          uploadResults.push({
            status: "failed",
            reason: "No rows inserted",
            plan: plan,
          });
        }
      } catch (insertErr) {
        console.error(`Error inserting plan:`, insertErr);
        uploadResults.push({
          status: "failed",
          reason: insertErr.message,
          plan: plan,
        });
      }
    }

    // Analyze upload results
    const successfulUploads = uploadResults.filter(
      (r) => r.status === "success"
    );
    const failedUploads = uploadResults.filter((r) => r.status === "failed");

    // Prepare response
    if (successfulUploads.length > 0) {
      return res.status(201).json({
        success: true,
        message: "Daily Plans processed",
        successCount: successfulUploads.length,
        failedCount: failedUploads.length,
        successfulUploads,
        failedUploads,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Failed to insert any Daily Plans",
        failedUploads,
      });
    }
  } catch (err) {
    console.error("Overall Process Error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  } finally {
    // Ensure pool is closed
    if (pool) {
      try {
        await pool.close();
      } catch (closeErr) {
        console.error("Error closing database connection:", closeErr);
      }
    }
  }
};

// Fetch Daily Plans
export const fetchDailyPlans = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig1);

    const today = new Date(); //2025-07-01T04:38:52.699Z
    const currentDate = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    ); //2025-07-01

    const query = `
      Select  RefNo, RefDate , PlanDate, sh.Name as Shift, PlanQty, dpt.Name as Department, wc.Alias from DailyPlan dp 
        inner join shift sh on sh.ShiftCode = dp.Shift
        inner join Department dpt on dpt.DeptCode = dp.Department
        inner join WorkCenter wc on wc.StationCode = dp.Station
      where PlanDate = @currentDate
    `;

    const request = pool.request().input("currentDate", sql.Date, currentDate);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};