import sql from "mssql";
import { dbConfig2 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import {convertToIST} from "../../utils/convertToIST.js";

export const getDispatchErrorLog = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
        SELECT 
          a.[Session_ID], 
          a.[FGSerialNo], 
          a.[AssetNo], 
          a.[ModelName], 
          a.[ModelCode],
          a.[ErrorMessage],
          b.ErrorName, 
          a.[ErrorOn]  
        FROM [DispatchErrorLog] a 
        INNER JOIN errormaster b 
          ON a.ErrorID = b.ErrorID 
        WHERE a.ErrorOn BETWEEN @startDate AND @endDate
      ;
  `;

  const pool = await new sql.ConnectionPool(dbConfig2).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Dispatch Error Log data retrieved successfully.",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Dispatch Error Log data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
