import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getFpaDefectReport = tryCatch(async (req, res) => {
  const { ReportType, DefectName, Model, StartDate, EndDate, TopCount } =
    req.query;

  if (!ReportType) {
    throw new AppError(
      "Missing required query parameters: ReportType (Daily / Monthly / Yearly).",
      400
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("ReportType", sql.VarChar, ReportType)
      .input("DefectName", sql.VarChar, DefectName || null)
      .input("Model", sql.VarChar, Model || null)
      .input("StartDate", sql.Date, StartDate || null)
      .input("EndDate", sql.Date, EndDate || null)
      .input("TopCount", sql.Int, TopCount ? parseInt(TopCount) : 5);

    const result = await request.execute("GetFPAReport");

    res.status(200).json({
      success: true,
      message: "FPA Defect Report data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the FPA Defect Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
