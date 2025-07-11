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

    await request.input("PassId", sql.VarChar(50), passId).query(`
        INSERT INTO visit_logs (unique_pass_id, check_in_time, check_out_time)
        VALUES (@PassId, GETDATE(), NULL)
      `);

    await pool.close();

    res.status(201).json({
      success: true,
      message: "Visitor allowed in",
      data: {
        passId,
      },
    });
  } catch (error) {
    console.error("SQL Insert error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log visitor entry",
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

    const updateResult = await request.input("PassId", sql.VarChar(50), passId)
      .query(`
        UPDATE visit_logs
        SET check_out_time = GETDATE()
        WHERE unique_pass_id = @PassId AND check_out_time IS NULL
      `);

    await pool.close();

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found or already checked out",
      });
    }

    res.status(200).json({
      success: true,
      message: "Visitor checked out successfully",
      data: {
        passId,
      },
    });
  } catch (error) {
    console.error("SQL Update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log visitor exit",
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
      FROM visitor_passes vp
      LEFT JOIN visit_logs vl ON vp.pass_id = vl.unique_pass_id
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
