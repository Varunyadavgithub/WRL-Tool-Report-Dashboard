import sql from "mssql";
import { dbConfig3 } from "../../config/db.js";

export const getCalibrationUsers = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig3);

    const result = await pool.request().query(`
      SELECT
        u.employee_id,
        u.name,
        u.department_id,
        d.department_name AS department_name,
        u.employee_email,
        u.manager_email
      FROM users u
      LEFT JOIN departments d
        ON d.DeptCode = u.department_id
      ORDER BY u.name
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load users");
  }
};
