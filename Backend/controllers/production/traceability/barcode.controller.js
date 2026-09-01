import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/tryCatch.js";
import { AppError } from "../../../utils/AppError.js";

/* ─────────────────────────────────────────────────────────────
   Shared connection pool
───────────────────────────────────────────────────────────── */

let _pool = null;

async function getPool() {
  // Re-use healthy pool
  if (_pool && _pool.connected && !_pool.connecting) {
    return _pool;
  }

  // Close stale pool
  if (_pool) {
    try {
      await _pool.close();
    } catch {
      // ignore
    }

    _pool = null;
  }

  try {
    _pool = await new sql.ConnectionPool({
      ...dbConfig1,

      requestTimeout: 120_000,
      connectionTimeout: 30_000,

      pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30_000,
      },
    }).connect();

    _pool.on("error", (err) => {
      console.error("[Production Summary DB Pool Error]", err.message);
      _pool = null;
    });

    return _pool;
  } catch (err) {
    _pool = null;

    throw new AppError(`Database connection failed: ${err.message}`, 503);
  }
}

/* ─────────────────────────────────────────────────────────────
   Extract + validate date parameters
───────────────────────────────────────────────────────────── */

function extractParams(query) {
  const { startDate, endDate, page = 1, limit = 100 } = query;

  if (!startDate || !endDate) {
    throw new AppError("startDate and endDate are required", 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Invalid startDate or endDate", 400);
  }

  if (end < start) {
    throw new AppError(
      "endDate must be greater than or equal to startDate",
      400,
    );
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);

  const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

  /*
    We use:

      OrderDate >= @startDate
      AND OrderDate < @endDateExclusive

    so the entire end date is included even when OrderDate
    contains a time component.
  */

  const endExclusive = new Date(end);

  endExclusive.setDate(endExclusive.getDate() + 1);

  return {
    startDate: start,
    endDateExclusive: endExclusive,
    page: parsedPage,
    limit: parsedLimit,
  };
}

/* ─────────────────────────────────────────────────────────────
   Build common request
───────────────────────────────────────────────────────────── */

function buildRequest(pool, { startDate, endDateExclusive }) {
  const request = pool
    .request()
    .input("startDate", sql.DateTime, startDate)
    .input("endDateExclusive", sql.DateTime, endDateExclusive);

  return request;
}

/* ─────────────────────────────────────────────────────────────
   Base FROM / WHERE
───────────────────────────────────────────────────────────── */

const BASE_FROM = `
    FROM ProdHeader AS PH
    INNER JOIN Material AS M
        ON PH.Material = M.MatCode

    WHERE PH.OrderDate >= @startDate
      AND PH.OrderDate < @endDateExclusive
`;

/* ═══════════════════════════════════════════════════════════
   GET /prod/production-summary

   Main paginated table data
═══════════════════════════════════════════════════════════ */

export const getFoamingBarcodeSummary = tryCatch(async (req, res) => {
  const params = extractParams(req.query);

  const pool = await getPool();

  const request = buildRequest(pool, params);

  const offset = (params.page - 1) * params.limit;

  request.input("offset", sql.Int, offset);

  request.input("limit", sql.Int, params.limit);

  const query = `
      SELECT
          M.Name AS Name,
          CAST(PH.OrderDate AS DATE) AS OrderDate,
          SUM(PH.Qty) AS TotalQty

      ${BASE_FROM}

      GROUP BY
          M.Name,
          CAST(PH.OrderDate AS DATE)

      ORDER BY
          OrderDate ASC,
          M.Name ASC

      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY;
    `;

  try {
    const result = await request.query(query);

    return res.status(200).json({
      success: true,

      message: "Production Summary Report generated successfully",

      data: result.recordset,

      meta: {
        page: params.page,
        limit: params.limit,
        count: result.recordset.length,
      },
    });
  } catch (err) {
    throw new AppError(
      `Failed to generate production summary: ${err.message}`,
      500,
    );
  }
});

/* ═══════════════════════════════════════════════════════════
   GET /prod/export-production-summary

   Full data for Excel export
═══════════════════════════════════════════════════════════ */

export const FoamingBarcodeSummaryExportData = tryCatch(async (req, res) => {
  const params = extractParams(req.query);

  const pool = await getPool();

  const request = buildRequest(pool, params);

  const query = `
      SELECT
          M.Name AS Name,
          CAST(PH.OrderDate AS DATE) AS OrderDate,
          SUM(PH.Qty) AS TotalQty

      ${BASE_FROM}

      GROUP BY
          M.Name,
          CAST(PH.OrderDate AS DATE)

      ORDER BY
          OrderDate ASC,
          M.Name ASC;
    `;

  try {
    const result = await request.query(query);

    return res.status(200).json({
      success: true,

      message: "Production Summary export data fetched successfully",

      data: result.recordset,

      meta: {
        count: result.recordset.length,
      },
    });
  } catch (err) {
    throw new AppError(
      `Failed to export production summary: ${err.message}`,
      500,
    );
  }
});

/* ═══════════════════════════════════════════════════════════
   GET /prod/production-summary-summary

   KPI data
═══════════════════════════════════════════════════════════ */

export const getFoamingBarcodeSummarySummary = tryCatch(async (req, res) => {
  const params = extractParams(req.query);

  const pool = await getPool();

  const request = buildRequest(pool, params);

  const query = `
      WITH ProductionData AS (
          SELECT
              M.Name AS Name,
              CAST(PH.OrderDate AS DATE) AS OrderDate,
              SUM(PH.Qty) AS TotalQty

          ${BASE_FROM}

          GROUP BY
              M.Name,
              CAST(PH.OrderDate AS DATE)
      )

      SELECT
          ISNULL(SUM(TotalQty), 0) AS TotalQty,

          COUNT(DISTINCT Name) AS MaterialCount,

          COUNT(DISTINCT OrderDate) AS ProductionDays,

          CASE
              WHEN COUNT(DISTINCT OrderDate) = 0
              THEN 0

              ELSE
                  SUM(TotalQty) /
                  COUNT(DISTINCT OrderDate)
          END AS AveragePerDay,

          MIN(OrderDate) AS EarliestDate,

          MAX(OrderDate) AS LatestDate

      FROM ProductionData;
    `;

  try {
    const result = await request.query(query);

    const row = result.recordset[0] || {};

    return res.status(200).json({
      success: true,

      data: {
        totalQty: Number(row.TotalQty || 0),

        materialCount: Number(row.MaterialCount || 0),

        productionDays: Number(row.ProductionDays || 0),

        averagePerDay: Number(row.AveragePerDay || 0),

        dateRange: {
          from: row.EarliestDate || null,
          to: row.LatestDate || null,
        },
      },
    });
  } catch (err) {
    throw new AppError(
      `Failed to fetch production summary KPI: ${err.message}`,
      500,
    );
  }
});
