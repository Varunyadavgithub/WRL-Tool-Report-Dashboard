import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

export const getFGDispatchReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
    SELECT
      mb.Serial                              AS FGSerialNo,
      m.Name                                 AS MaterialName,
      mb.DocNo                               AS DocNo,

      -- Label Printing
      CASE 
        WHEN mb.PrintStatus = 1 THEN 'SCANNED'
        ELSE 'NOT_SCANNED'
      END                                    AS FG_LabelPrinting,
      mb.PrintedOn                           AS FG_LabelPrinting_Date,

      -- Auto Scan
      CASE 
        WHEN mb.AutoScanStatus = 1 THEN 'SCANNED'
        ELSE 'NOT_SCANNED'
      END                                    AS FG_Auto_Scan,
      mb.AutoScanDatetime                    AS FG_Auto_Scan_Date,

      -- Unloading (Assuming always done if exists)
      mb.UnloadingDatetime                   AS FG_Unloading_Date,

      -- Vehicle Details
      vh.Session_ID                          AS Session_ID,
      vh.Vehicle_No                          AS Vehicle_No,
      vh.DockNo                              AS DockNo,
      vh.EntryTime                           AS Vehicle_Entry_Time

    FROM MaterialBarcode mb
    INNER JOIN Material m 
      ON m.MatCode = mb.Material

    LEFT JOIN VehicleHeader vh 
      ON vh.Session_ID = mb.Session_ID

    WHERE 
      mb.UnloadingDatetime BETWEEN @startDate AND @endDate

    ORDER BY mb.UnloadingDatetime DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FG Dispatch Report fetched successfully.",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } finally {
    await pool.close();
  }
});
