import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

/* ─────────────────────────────────────────────────────────────────────────────
   NOTE: connectToDB(dbConfig1) uses a Map-based singleton — the first call
   opens the pool; every subsequent call returns the cached pool instantly.
   Do NOT call pool.close() anywhere here — that would destroy the shared pool.
───────────────────────────────────────────────────────────────────────────── */

/* ── Bind the 3 common params every endpoint needs ── */
const bindBaseParams = (request, { istStart, istEnd, stationCode, model }) => {
  request
    .input("startTime",   sql.DateTime, istStart)
    .input("endTime",     sql.DateTime, istEnd)
    .input("stationCode", sql.VarChar,  stationCode)
    .input("model",       sql.VarChar,  model && model !== "0" ? model : null);
  return request;
};

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED FilteredData + ModelStats CTE
   Optimisations vs. original:
   • WorkCenter removed from FilteredData — was joined twice (once to filter
     by stationCode, once in the main SELECT for wc.Name). Now the filter uses
     pa.StationCode directly; WorkCenter is joined once in the outer SELECT.
   • All predicates are SARGable (no functions wrapping indexed columns).
───────────────────────────────────────────────────────────────────────────── */
const FILTERED_DATA_CTE = `
  FilteredData AS (
      SELECT
          mb.Material,
          CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
          pa.ActivityOn,
          pa.StationCode,
          pa.Operator,
          mb.Serial,
          mb.VSerial,
          mb.Serial2
      FROM MaterialBarcode mb
      JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
      WHERE mb.PrintStatus  = 1
        AND mb.Status       <> 99
        AND pa.ActivityType  = 5
        AND pa.StationCode   = @stationCode
        AND pa.ActivityOn   BETWEEN @startTime AND @endTime
  ),
  ModelStats AS (
      SELECT
          Material,
          MIN(Serial) AS StartSerial,
          MAX(Serial) AS EndSerial,
          COUNT(*)    AS TotalCount
      FROM FilteredData
      GROUP BY Material
  )
`;

/* ═══════════════════════════════════════════════════════════════════════════
   1. fetchFGData — paginated query
   Optimisations:
   • Uses connectToDB singleton — zero connection overhead on subsequent calls
   • COUNT separated into a lightweight query — no longer a correlated subquery
     computed for every returned row (was the biggest performance killer)
   • OFFSET…FETCH instead of ROW_NUMBER() + WHERE — SQL Server skips directly
     to the requested page rather than materialising all preceding rows
   • OPTION(RECOMPILE) — forces a fresh plan per call; prevents SQL Server from
     reusing a plan optimised for a 1-hour range when querying 30 days (or vice versa)
═══════════════════════════════════════════════════════════════════════════ */
export const fetchFGData = tryCatch(async (req, res) => {
  const {
    startTime,
    endTime,
    model,
    stationCode,
    page  = 1,
    limit = 1000,
  } = req.query;

  if (!startTime || !endTime || !stationCode) {
    throw new AppError(
      "Missing required query parameters: startTime, endTime, stationCode",
      400,
    );
  }

  const istStart  = convertToIST(startTime);
  const istEnd    = convertToIST(endTime);
  const pageNum   = parseInt(page,  10);
  const limitNum  = parseInt(limit, 10);
  const offset    = (pageNum - 1) * limitNum;

  const pool = await connectToDB(dbConfig1);

  try {
    /* ── Step 1: cheap COUNT (separate request object, same pool) ── */
    const countReq = pool.request();
    bindBaseParams(countReq, { istStart, istEnd, stationCode, model });

    const countResult = await countReq.query(`
      WITH ${FILTERED_DATA_CTE}
      SELECT COUNT(*) AS totalCount
      FROM   FilteredData
      WHERE  (@model IS NULL OR Material = @model)
      OPTION (RECOMPILE);
    `);
    const totalCount = countResult.recordset[0]?.totalCount ?? 0;

    /* ── Step 2: paginated data ── */
    const dataReq = pool.request();
    bindBaseParams(dataReq, { istStart, istEnd, stationCode, model });
    dataReq
      .input("offset", sql.Int, offset)
      .input("limit",  sql.Int, limitNum);

    const dataResult = await dataReq.query(`
      WITH ${FILTERED_DATA_CTE}
      SELECT
          ROW_NUMBER() OVER (ORDER BY fd.ActivityOn ASC) AS SrNo,
          m.Name        AS Model_Name,
          fd.Material   AS ModelName,
          fd.StationCode,
          wc.Name       AS Station_Name,
          fd.Assembly_Sr_No,
          ISNULL(fd.VSerial, '')  AS Asset_tag,
          ISNULL(fd.Serial2, '')  AS [Customer_QR],
          CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE fd.Serial END AS FG_SR,
          fd.ActivityOn           AS CreatedOn,
          u.UserName,
          ms.StartSerial,
          ms.EndSerial,
          ms.TotalCount
      FROM FilteredData fd
      JOIN Users      u  ON u.UserCode     = fd.Operator
      JOIN WorkCenter wc ON wc.StationCode = fd.StationCode
      JOIN ModelStats ms ON ms.Material    = fd.Material
      JOIN Material   m  ON m.MatCode      = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      ORDER BY fd.ActivityOn ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      OPTION (RECOMPILE);
    `);

    res.status(200).json({
      success:    true,
      message:    "FG Data retrieved successfully",
      data:       dataResult.recordset,
      totalCount,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch FG data: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. productionReportExportData — full export (no pagination)
═══════════════════════════════════════════════════════════════════════════ */
export const productionReportExportData = tryCatch(async (req, res) => {
  const { startTime, endTime, model, stationCode } = req.query;

  if (!startTime || !endTime || !stationCode) {
    throw new AppError(
      "Missing required query parameters: startTime, endTime, stationCode",
      400,
    );
  }

  const istStart = convertToIST(startTime);
  const istEnd   = convertToIST(endTime);

  const pool = await connectToDB(dbConfig1);

  try {
    const request = pool.request();
    bindBaseParams(request, { istStart, istEnd, stationCode, model });

    const result = await request.query(`
      WITH ${FILTERED_DATA_CTE}
      SELECT
          ROW_NUMBER() OVER (ORDER BY fd.ActivityOn ASC) AS SrNo,
          m.Name        AS Model_Name,
          fd.Material   AS ModelName,
          fd.StationCode,
          wc.Name       AS Station_Name,
          fd.Assembly_Sr_No,
          ISNULL(fd.VSerial, '')  AS Asset_tag,
          ISNULL(fd.Serial2, '')  AS [Customer_QR],
          CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE fd.Serial END AS FG_SR,
          fd.ActivityOn           AS CreatedOn,
          u.UserName,
          ms.StartSerial,
          ms.EndSerial
      FROM FilteredData fd
      JOIN Users      u  ON u.UserCode     = fd.Operator
      JOIN WorkCenter wc ON wc.StationCode = fd.StationCode
      JOIN ModelStats ms ON ms.Material    = fd.Material
      JOIN Material   m  ON m.MatCode      = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      ORDER BY SrNo
      OPTION (RECOMPILE);
    `);

    res.status(200).json({
      success: true,
      message: "Production Report data exported successfully",
      data:    result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch export data: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. fetchQuickFiltersData — YDAY / TODAY / MTD shortcuts
═══════════════════════════════════════════════════════════════════════════ */
export const fetchQuickFiltersData = tryCatch(async (req, res) => {
  const { startTime, endTime, model, stationCode } = req.query;

  if (!startTime || !endTime || !stationCode) {
    throw new AppError(
      "Missing required query parameters: startTime, endTime, stationCode",
      400,
    );
  }

  const istStart = convertToIST(startTime);
  const istEnd   = convertToIST(endTime);

  const pool = await connectToDB(dbConfig1);

  try {
    const request = pool.request();
    bindBaseParams(request, { istStart, istEnd, stationCode, model });

    const result = await request.query(`
      WITH ${FILTERED_DATA_CTE}
      SELECT
          m.Name        AS Model_Name,
          fd.Material   AS ModelName,
          fd.StationCode,
          wc.Name       AS Station_Name,
          fd.Assembly_Sr_No,
          ISNULL(fd.VSerial, '')  AS Asset_tag,
          ISNULL(fd.Serial2, '')  AS [Customer_QR],
          CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE fd.Serial END AS FG_SR,
          fd.ActivityOn           AS CreatedOn,
          u.UserName,
          ms.StartSerial,
          ms.EndSerial,
          ms.TotalCount
      FROM FilteredData fd
      JOIN Users      u  ON u.UserCode     = fd.Operator
      JOIN WorkCenter wc ON wc.StationCode = fd.StationCode
      JOIN ModelStats ms ON ms.Material    = fd.Material
      JOIN Material   m  ON m.MatCode      = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      ORDER BY fd.ActivityOn ASC
      OPTION (RECOMPILE);
    `);

    res.status(200).json({
      success:    true,
      message:    "Quick filter data retrieved successfully",
      data:       result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch quick filter data: ${error.message}`, 500);
  }
});