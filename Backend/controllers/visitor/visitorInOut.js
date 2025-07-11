import sql, { dbConfig3 } from "../../config/db.js";

export const visitorIn = async (req, res) => {
  const { passId } = req.body;

  if (!passId) {
    return res.status(400).json({
      success: false,
      message: "Pass ID is required",
    });
  }

  try {
    const pool = await sql.connect(dbConfig3);
    const request = pool.request();
    request.input("PassId", sql.VarChar(50), passId);

    // Get current status of the visitor
    const result = await request.query(`
      SELECT status FROM visitor_passes WHERE pass_id = @PassId
    `);

    // If passId not found
    if (result.recordset.length === 0) {
      await pool.close();
      return res.status(404).json({
        success: false,
        message: "Pass ID not found",
      });
    }

    const currentStatus = result.recordset[0].status;

    // Reject if already checked in (status = 100)
    if (currentStatus === 100) {
      await pool.close();
      return res.status(409).json({
        success: false,
        message: "Visitor already checked in. Please check out first.",
      });
    }

    // Otherwise, allow check-in
    await request.query(`
      BEGIN TRANSACTION;

      INSERT INTO visit_logs (unique_pass_id, check_in_time, check_out_time)
      VALUES (@PassId, GETUTCDATE(), NULL);

      UPDATE visitor_passes
      SET status = 100
      WHERE pass_id = @PassId;

      COMMIT;
    `);

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
    const pool = await sql.connect(dbConfig3);
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
      SET check_out_time = GETUTCDATE()
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

export const getVisitorLogs = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig3);
    const request = pool.request();

    const result = await request.query(`
    SELECT 
        vp.pass_id,
        vp.visitor_name,
        vp.visitor_contact_no,
        vp.department_to_visit,
        vp.visit_type,
        vp.allow_on,
        vp.allow_till,
        vp.vehicle_details,
        vp.purpose_of_visit,
        vl.check_in_time,
        vl.check_out_time
      FROM visit_logs vl
      LEFT JOIN visitor_passes vp ON vp.pass_id = vl.unique_pass_id
      ORDER BY vl.check_in_time DESC
    `);

    await pool.close();

    res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Error fetching visitor logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitor logs",
    });
  }
};
