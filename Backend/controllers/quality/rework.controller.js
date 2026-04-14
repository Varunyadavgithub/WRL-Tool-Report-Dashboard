import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// ─── Shared CTE ─────────────────────────────────────────────────────────────
const REWORK_BASE_CTE = `
  WITH ReworkBase AS (
    SELECT
        m.Alias               AS Model_Name,
        mc.Name               AS Category,
        w.Name                AS Station,
        pr.ProcessCode        AS Process_Code,
        it.Serial             AS Assembly_Sr_No,
        pr.StartedOn          AS Rework_IN,
        pr.CompletedOn        AS Rework_Out,
        us.UserName,
        s.Status              AS Rework_Status,
        CONCAT(
            DATEDIFF(DAY, pr.StartedOn, pr.CompletedOn), ':',
            FORMAT((DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) / 60) % 24, 'D2'), ':',
            FORMAT(DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) % 60, 'D2')
        )                     AS Duration,
        dct.Type              AS Defect_Category,
        dc.Name               AS Defect,
        rc.Type               AS Root_Cause,
        rr.Type               AS Counter_Action,
        it.ApproverRemark     AS Remark,
        ih.Material           AS MatCode
    FROM InspectionTrans it
    INNER JOIN InspectionHeader ih
        ON it.InspectionLotNo = ih.InspectionLotNo
    INNER JOIN Material m
        ON ih.Material = m.MatCode
    LEFT  JOIN MaterialCategory mc
        ON m.Category = mc.CategoryCode
    INNER JOIN ProcessRouting pr
        ON ih.DocNo = pr.PSNo
       AND pr.ProcessCode = ih.Process
    INNER JOIN WorkCenter w
        ON pr.StationCode = w.StationCode
    LEFT  JOIN Status s
        ON ih.Status = s.ID
    LEFT  JOIN InspectionDefect idf
        ON it.ID = idf.ID
    LEFT  JOIN DefectCodeMaster dc
        ON idf.Defect = dc.Code
    LEFT  JOIN DefectCategoryType dct
        ON dc.DefectCategory = dct.ID
    LEFT  JOIN RootCause rc
        ON it.RootCause = rc.ID
    LEFT  JOIN ReworkResolution rr
        ON it.ReworkResolution = rr.ID
    LEFT  JOIN Users us
        ON it.ApprovedBy = us.UserCode
    WHERE it.NextAction = 1
      AND it.InspectedOn BETWEEN @startTime AND @endTime
  )
`;

// ─── GET /rework-report (Paginated) ─────────────────────────────────────────
export const getReworkReport = tryCatch(async (req, res) => {
  const { startTime, endTime, model, page = 1, limit = 1000 } = req.query;

  if (!startTime || !endTime) {
    throw new AppError("Missing required query parameters", 400);
  }

  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit))
      .input("model", sql.VarChar, model && model !== "0" ? model : null);

    const query = `
      ${REWORK_BASE_CTE}
      , Filtered AS (
        SELECT * FROM ReworkBase
        WHERE (@model IS NULL OR MatCode = @model)
      )
      SELECT
        (SELECT COUNT(*) FROM Filtered) AS totalCount,
        *
      FROM Filtered
      ORDER BY Rework_IN
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Rework report fetched",
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  } finally {
    await pool.close();
  }
});

// ─── GET /rework-report-export ──────────────────────────────────────────────
export const getReworkReportExport = tryCatch(async (req, res) => {
  const { startTime, endTime, model } = req.query;

  if (!startTime || !endTime) {
    throw new AppError("Missing required query parameters", 400);
  }

  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("model", sql.VarChar, model && model !== "0" ? model : null);

    const query = `
      ${REWORK_BASE_CTE}
      SELECT *
      FROM ReworkBase
      WHERE (@model IS NULL OR MatCode = @model)
      ORDER BY Rework_IN;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Export data fetched",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  } finally {
    await pool.close();
  }
});

// ─── GET /rework-report-quick ───────────────────────────────────────────────
export const getReworkReportQuick = tryCatch(async (req, res) => {
  const { startTime, endTime, model } = req.query;

  if (!startTime || !endTime) {
    throw new AppError("Missing required query parameters", 400);
  }

  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("model", sql.VarChar, model && model !== "0" ? model : null);

    const query = `
      ${REWORK_BASE_CTE}
      SELECT *
      FROM ReworkBase
      WHERE (@model IS NULL OR MatCode = @model)
      ORDER BY Rework_IN;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Quick data fetched",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  } finally {
    await pool.close();
  }
});

// ─── GET /production-report ──────────────────────────────────────────────────
// Returns per-model production counts for the given time range.
// Uses Station 1220010, ActivityType = 5 (same as production SQL provided).
// Response shape:
//   {
//     success: true,
//     totalProduction: 4820,
//     data: [
//       { Model_Name: "ModelX", MatCode: "1220010", production_count: 1240 },
//       ...
//     ]
//   }
export const getProductionReport = tryCatch(async (req, res) => {
  const { startTime, endTime, model } = req.query;

  if (!startTime || !endTime) {
    throw new AppError("Missing required query parameters", 400);
  }

  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("model", sql.VarChar, model && model !== "0" ? model : null);

    const query = `
      WITH FilteredData AS (
          SELECT
              mb.Material,
              CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No
          FROM MaterialBarcode mb
          JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
          JOIN WorkCenter wc ON pa.StationCode = wc.StationCode
          WHERE mb.PrintStatus = 1
            AND mb.Status <> 99
            AND pa.ActivityType = 5
            AND pa.ActivityOn BETWEEN @startTime AND @endTime
            AND wc.StationCode = 1220010
      )
      SELECT
          m.Name AS Model_Name,
          fd.Material AS MatCode,
          COUNT(*) AS production_count
      FROM FilteredData fd
      JOIN Material m ON m.MatCode = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      GROUP BY m.Name, fd.Material
      ORDER BY production_count DESC;
    `;

    const result = await request.query(query);

    const totalProduction = result.recordset.reduce(
      (sum, r) => sum + Number(r.production_count || 0),
      0,
    );

    res.status(200).json({
      success: true,
      message: "Production data fetched",
      totalProduction,
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  } finally {
    await pool.close();
  }
});
