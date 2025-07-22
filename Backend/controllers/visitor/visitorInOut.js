import sql, { dbConfig3 } from "../../config/db.js";

export const getVisitorLogs = async (_, res) => {
  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    const now = new Date();

    // Set start date: today at 08:00:00
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      0,
      0
    );

    // Set end date: tomorrow at 20:00:00
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      20,
      0,
      0
    );
    const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    const result = await pool
      .request()
      .input("StartDate", sql.DateTime, istStart)
      .input("EndDate", sql.DateTime, istEnd).query(`
        SELECT 
            vp.pass_id,
            vp.visitor_name,
            vp.visitor_contact_no,
            vp.department_to_visit,
            vp.visit_type,
            vp.allow_on,
            vp.allow_till,
            vp.vehicle_details,
            vl.check_in_time,
            vl.check_out_time
        FROM visit_logs vl
        LEFT JOIN visitor_passes vp ON vp.pass_id = vl.unique_pass_id
        where check_in_time between @StartDate And @EndDate
        ORDER BY vl.check_in_time DESC
    `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
    await pool.close();
  } catch (error) {
    console.error("Error fetching visitor logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitor logs",
    });
  }
};

export const visitorIn = async (req, res) => {
  const { passId } = req.body;

  if (!passId) {
    return res.status(400).json({
      success: false,
      message: "Pass ID is required",
    });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();
    request.input("PassId", sql.VarChar(50), passId);

    // Get current status of the visitor
    const result = await request.query(`
      SELECT status FROM visitor_passes WHERE pass_id = @PassId
    `);

    // If passId not found
    if (result?.recordset.length === 0) {
      await pool.close();
      return res.status(404).json({
        success: false,
        message: "Pass ID not found",
      });
    }

    const currentStatus = parseInt(result?.recordset[0]?.status);

    // Allow check-in only if status is 1 (new) or 103 (checked out)
    if (currentStatus === 1 || currentStatus === 103) {
      // Proceed to check-in
      await request.query(`
        BEGIN TRANSACTION;

            INSERT INTO visit_logs (unique_pass_id, check_in_time, check_out_time)
            VALUES (@PassId, SWITCHOFFSET( GETUTCDATE(), '+05:30'), NULL);

        UPDATE visitor_passes
        SET status = 100 -- checked in
        WHERE pass_id = @PassId;

        COMMIT;
    `);
    } else {
      return res.status(409).json({
        success: false,
        message:
          "Visitor is already checked in or status invalid. Please check out first.",
      });
    }

    await pool.close();

    res.status(201).json({
      success: true,
      message: "Visitor checked in successfully",
      data: { passId },
    });
  } catch (error) {
    console.error("Error on check-in:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking in visitor",
    });
  }
};

export const visitorOut = async (req, res) => {
  const { passId } = req.body;

  if (!passId) {
    return res.status(400).json({
      success: false,
      message: "Pass ID is required",
    });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();
    request.input("PassId", sql.VarChar(50), passId);

    // Step 1: Check if visitor is currently checked in
    const check = await request.query(`
      SELECT * FROM visit_logs
      WHERE unique_pass_id = @PassId AND check_out_time IS NULL
    `);

    if (check.recordset.length === 0) {
      await pool.close();
      return res.status(404).json({
        success: false,
        message: "Visitor is not currently checked in or already checked out.",
      });
    }

    // Step 2: Perform checkout and update status
    await request.query(`
      BEGIN TRANSACTION;

      UPDATE visit_logs
      SET check_out_time = SWITCHOFFSET( GETUTCDATE(), '+05:30')
      WHERE unique_pass_id = @PassId AND check_out_time IS NULL;

      UPDATE visitor_passes
      SET status = 103
      WHERE pass_id = @PassId;

      COMMIT;
    `);

    await pool.close();

    res.status(200).json({
      success: true,
      message: "Visitor checked out successfully",
      data: { passId },
    });
  } catch (error) {
    console.error("Error on check-out:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking out visitor",
    });
  }
};
