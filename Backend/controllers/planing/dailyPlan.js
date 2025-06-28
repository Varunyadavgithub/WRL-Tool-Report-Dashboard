import sql, { dbConfig1 } from "../../config/db.js";

// Add Daily Plan
export const addDailyPlans = async (req, res) => {
  const planData = req.body;
  if (!Array.isArray(planData) || planData.length === 0) {
    return res.status(400).json({ error: "Empty or invalid holds array." });
  }
  console.log(planData);

  // RefDate = "2025-06-28 08:27:26.000",
  // PlanDate = "2025-06-28",

  // try {
  //   const pool = await sql.connect(dbConfig1);

  //   const query = `
  //     INSERT INTO DailyPlan (
  //       RefNo,
  //       RefDate,
  //       PlanDate,
  //       Shift,
  //       PlanQty,
  //       Department,
  //       Station,
  //       Status,
  //       BusinessUnit
  //     )
  //     SELECT
  //       @RefNo,
  //       @RefDate,
  //       @PlanDate,
  //       (SELECT ShiftCode FROM Shift WHERE Name = @Shift),
  //       @PlanQty,
  //       (SELECT DeptCode FROM Department WHERE Name = @Department),
  //       (SELECT StationCode FROM WorkCenter WHERE Alias = @Station),
  //       @Status,
  //       @BusinessUnit
  //   `;

  //   const result = await pool
  //     .request()
  //     .input("RefNo", sql.Int, RefNo)
  //     .input("RefDate", sql.DateTime, RefDate)
  //     .input("PlanDate", sql.Date, PlanDate)
  //     .input("Shift", sql.VarChar, Shift)
  //     .input("PlanQty", sql.Int, PlanQty)
  //     .input("Department", sql.VarChar, Department)
  //     .input("Station", sql.VarChar, Station)
  //     .input("Status", sql.Int, Status)
  //     .input("BusinessUnit", sql.Int, BusinessUnit)
  //     .query(query);

  //   // Check if the insert was successful
  //   if (result.rowsAffected[0] > 0) {
  //     res.status(201).json({
  //       message: "Daily Plan added successfully",
  //       insertedRows: result.rowsAffected[0],
  //     });
  //   } else {
  //     res.status(400).json({ error: "Failed to insert Daily Plan" });
  //   }

  //   await pool.close();
  // } catch (err) {
  //   console.error("SQL Error:", err.message);
  //   res.status(500).json({ error: err.message });
  // }
};
