import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getLptReport = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const isStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const isEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  let query = `
    SELECT * 
    FROM LPTReport 
    WHERE DateTime BETWEEN @startDate AND @endDate
  `;

  if (model) {
    query += " AND Model=@model";
  }

  query += " ORDER BY DateTime DESC";

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = await pool
      .request()
      .input("startDate", sql.DateTime, isStart)
      .input("endDate", sql.DateTime, isEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "LPT Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the LPT Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
