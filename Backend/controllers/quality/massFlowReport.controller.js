import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

export const getMassFlowReport = tryCatch(async (req, res) => {
  const { startDate, endDate, model_code } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const isStart = convertToIST(startDate);
  const isEnd = convertToIST(endDate);

  let query = `
    SELECT c.id, m.Name AS model_name, c.scan_data, c.leak_text, c.leak_value, c.status, c.model_code, c.ateq_prg, c.timestamp, c.created_at
    FROM captures c
    INNER JOIN Material m ON m.AltName = c.model_code
    WHERE c.timestamp BETWEEN @startDate AND @endDate
  `;

  if (model_code) {
    query += " AND c.model_code = @model_code";
  }

  query += " ORDER BY c.timestamp DESC";

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, isStart)
      .input("endDate", sql.DateTime, isEnd);

    if (model_code) {
      request.input("model_code", sql.VarChar, model_code);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Mass Flow Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Mass Flow Report data: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
