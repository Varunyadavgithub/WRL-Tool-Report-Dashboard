import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getCalibrationUsers = tryCatch(async (_, res) => {
  const query = `
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
  `;

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Calibration Users data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Calibration Users data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
