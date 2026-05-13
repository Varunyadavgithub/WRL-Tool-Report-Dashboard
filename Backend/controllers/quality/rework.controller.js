import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// ─── Router registrations ──────────────────────────────────────────────────────
// router.get("/rework-report",          getReworkReport);
// router.get("/rework-report-quick",    getReworkReportQuick);
// router.get("/rework-report-export",   getReworkReportExport);   ← detail tab
// router.get("/rework-summary-export",  getReworkSummaryExport);  ← summary tab
// router.get("/rework-defect-export",   getReworkDefectExport);   ← defect tab
// router.get("/production-report",      getProductionReport);

// ─── Category reverse-map ─────────────────────────────────────────────────────
const CATEGORY_REVERSE_MAP = {
  Freezer: [
    "COOLER",
    "ICE LINED REFRIGERATOR",
    "COOLER AND FREEZER",
    "CHEST COOLER",
    "MEDICAL",
    "EUTECTIC",
    "ILR",
    "VACCINE FREEZER",
    "DUAL",
    "FREEZER",
  ],
  "Choc Cooler": ["Choc Cooler"],
  FOW: ["FOW MODELS", "EUTECTIC FOW FREEZER"],
  SUS: [
    "2 GLASS DOOR UNDERCOUNTER REFRIGERATOR",
    "1 DOOR UNDERCOUNTER REFRIGERATOR",
    "2 DOOR UNDERCOUNTER REFRIGERATOR",
    "3 DOOR UNDERCOUNTER REFRIGERATOR",
  ],
  SWC: ["STORAGE WATER COOLER"],
  "VISI COOLER": ["VISI COOLER"],
};

/**
 * Converts a comma-separated string of UI group labels (e.g. "Freezer,FOW")
 * into a pipe-separated string of DB mc.Name values for use with STRING_SPLIT.
 * Returns null when no filter needed → SQL WHERE sees IS NULL → no restriction.
 */
const expandCategories = (categoriesStr) => {
  if (!categoriesStr) return null;
  const groups = categoriesStr
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const dbNames = groups.flatMap((g) => CATEGORY_REVERSE_MAP[g] ?? []);
  return dbNames.length > 0 ? dbNames.join("|") : null;
};

// ─── Reusable SQL fragment: 1 when a record is "closed", else 0 ───────────────
const CLOSED_CASE = `
  CASE
    WHEN LOWER(ISNULL(Rework_Status, '')) LIKE '%close%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%done%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%complet%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%resolv%'
      OR LOWER(ISNULL(Rework_Status, '')) LIKE '%finish%'
    THEN 1 ELSE 0
  END
`;

// ─── Reusable SQL fragment: category IN filter ────────────────────────────────
const CAT_FILTER = `(
  @dbCategories IS NULL
  OR Category IN (SELECT value FROM STRING_SPLIT(@dbCategories, '|'))
)`;

// ─── Reusable SQL fragment: same category filter on mc2.Name (production) ─────
const CAT_FILTER_MC2 = `(
  @dbCategories IS NULL
  OR mc2.Name IN (SELECT value FROM STRING_SPLIT(@dbCategories, '|'))
)`;

// ─── Shared base CTE ──────────────────────────────────────────────────────────
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
            DATEDIFF(DAY,    pr.StartedOn, pr.CompletedOn), ':',
            FORMAT((DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) / 60) % 24, 'D2'), ':',
            FORMAT( DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) % 60,        'D2')
        )                     AS Duration,
        dct.Type              AS Defect_Category,
        dc.Name               AS Defect,
        rc.Type               AS Root_Cause,
        rr.Type               AS Counter_Action,
        it.ApproverRemark     AS Remark,
        ih.Material           AS MatCode
    FROM InspectionTrans it
    INNER JOIN InspectionHeader ih
        ON  it.InspectionLotNo = ih.InspectionLotNo
    INNER JOIN Material m
        ON  ih.Material = m.MatCode
    LEFT  JOIN MaterialCategory mc
        ON  m.Category = mc.CategoryCode
    INNER JOIN ProcessRouting pr
        ON  ih.DocNo       = pr.PSNo
        AND pr.ProcessCode = ih.Process
    INNER JOIN WorkCenter w
        ON  pr.StationCode = w.StationCode
    LEFT  JOIN Status s
        ON  ih.Status = s.ID
    LEFT  JOIN InspectionDefect idf
        ON  it.ID = idf.ID
    LEFT  JOIN DefectCodeMaster dc
        ON  idf.Defect = dc.Code
    LEFT  JOIN DefectCategoryType dct
        ON  dc.DefectCategory = dct.ID
    LEFT  JOIN RootCause rc
        ON  it.RootCause = rc.ID
    LEFT  JOIN ReworkResolution rr
        ON  it.ReworkResolution = rr.ID
    LEFT  JOIN Users us
        ON  it.ApprovedBy = us.UserCode
    WHERE it.NextAction = 1
      AND it.InspectedOn BETWEEN @startTime AND @endTime
  )
`;

// ─── Helper: open a pool connection ───────────────────────────────────────────
const getPool = () => new sql.ConnectionPool(dbConfig1).connect();

// ─── Helper: bind all shared parameters onto an mssql Request ─────────────────
const bindInputs = (request, { istStart, istEnd, model, dbCategories }) =>
  request
    .input("startTime", sql.DateTime, istStart)
    .input("endTime", sql.DateTime, istEnd)
    // FIX: coerce "0" or empty string to null consistently
    .input(
      "model",
      sql.VarChar,
      model && model !== "0" && model.trim() !== "" ? model.trim() : null,
    )
    .input("dbCategories", sql.VarChar, dbCategories ?? null);

// ─── Helper: validate + parse common query params ─────────────────────────────
const parseCommonParams = (query) => {
  const { startTime, endTime, model, categories } = query;
  if (!startTime || !endTime)
    throw new AppError(
      "Missing required query parameters: startTime, endTime",
      400,
    );
  return {
    istStart: convertToIST(startTime),
    istEnd: convertToIST(endTime),
    model: model ?? null,
    dbCategories: expandCategories(categories),
  };
};

// ─── GET /rework-report  (paginated detail rows) ──────────────────────────────
export const getReworkReport = tryCatch(async (req, res) => {
  const { page = 1, limit = 1000 } = req.query;
  const params = parseCommonParams(req.query);
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const pool = await getPool();
  try {
    const request = pool.request();
    bindInputs(request, params);
    request
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit, 10));

    // FIX: exclude internal MatCode column from SELECT so UI doesn't receive it
    const query = `
      ${REWORK_BASE_CTE}
      , Filtered AS (
        SELECT * FROM ReworkBase
        WHERE (@model IS NULL OR MatCode = @model)
          AND ${CAT_FILTER}
      )
      SELECT
        (SELECT COUNT(*) FROM Filtered) AS totalCount,
        Model_Name, Category, Station, Process_Code,
        Assembly_Sr_No, Rework_IN, Rework_Out, UserName,
        Rework_Status, Duration, Defect_Category,
        Defect, Root_Cause, Counter_Action, Remark
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
  } finally {
    await pool.close();
  }
});

// ─── GET /rework-report-quick ─────────────────────────────────────────────────
export const getReworkReportQuick = tryCatch(async (req, res) => {
  const params = parseCommonParams(req.query);

  const pool = await getPool();
  try {
    const request = pool.request();
    bindInputs(request, params);

    const query = `
      ${REWORK_BASE_CTE}
      SELECT
        Model_Name, Category, Station, Process_Code,
        Assembly_Sr_No, Rework_IN, Rework_Out, UserName,
        Rework_Status, Duration, Defect_Category,
        Defect, Root_Cause, Counter_Action, Remark
      FROM ReworkBase
      WHERE (@model IS NULL OR MatCode = @model)
        AND ${CAT_FILTER}
      ORDER BY Rework_IN;
    `;

    const result = await request.query(query);
    res.status(200).json({
      success: true,
      message: "Quick data fetched",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } finally {
    await pool.close();
  }
});

// ─── GET /rework-report-export  (Detail tab — all raw rows) ───────────────────
export const getReworkReportExport = tryCatch(async (req, res) => {
  const params = parseCommonParams(req.query);

  const pool = await getPool();
  try {
    const request = pool.request();
    bindInputs(request, params);

    const query = `
      ${REWORK_BASE_CTE}
      SELECT
        Model_Name, Category, Station, Process_Code,
        Assembly_Sr_No, Rework_IN, Rework_Out, UserName,
        Rework_Status, Duration, Defect_Category,
        Defect, Root_Cause, Counter_Action, Remark
      FROM ReworkBase
      WHERE (@model IS NULL OR MatCode = @model)
        AND ${CAT_FILTER}
      ORDER BY Rework_IN;
    `;

    const result = await request.query(query);
    res.status(200).json({
      success: true,
      message: "Detail export fetched",
      data: result.recordset,
    });
  } finally {
    await pool.close();
  }
});

// ─── GET /rework-summary-export  (Summary tab — per-model breakdown) ──────────
export const getReworkSummaryExport = tryCatch(async (req, res) => {
  const params = parseCommonParams(req.query);

  const pool = await getPool();
  try {
    const request = pool.request();
    bindInputs(request, params);

    const query = `
      ${REWORK_BASE_CTE}
      , Filtered AS (
        SELECT * FROM ReworkBase
        WHERE (@model IS NULL OR MatCode = @model)
          AND ${CAT_FILTER}
      )
      SELECT
        ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)   AS Sr_No,
        Model_Name,
        Category,
        COUNT(*)                                      AS Total,
        SUM(${CLOSED_CASE})                           AS Closed,
        COUNT(*) - SUM(${CLOSED_CASE})                AS Open,
        CAST(
          ROUND(
            SUM(${CLOSED_CASE}) * 100.0 / NULLIF(COUNT(*), 0),
          2) AS DECIMAL(10,2)
        )                                             AS Close_Rate_Pct
      FROM Filtered
      GROUP BY Model_Name, Category
      ORDER BY Total DESC;
    `;

    const result = await request.query(query);
    res.status(200).json({
      success: true,
      message: "Summary export fetched",
      data: result.recordset,
    });
  } finally {
    await pool.close();
  }
});

// ─── GET /rework-defect-export  (Defect Ratio tab) ────────────────────────────
export const getReworkDefectExport = tryCatch(async (req, res) => {
  const params = parseCommonParams(req.query);

  const pool = await getPool();
  try {
    const request = pool.request();
    bindInputs(request, params);

    const query = `
      ${REWORK_BASE_CTE}

      , Filtered AS (
        SELECT * FROM ReworkBase
        WHERE (@model IS NULL OR MatCode = @model)
          AND ${CAT_FILTER}
      )

      , ReworkAgg AS (
        SELECT
          Model_Name,
          Category,
          MatCode,
          COUNT(*)                       AS Rework_Total,
          SUM(${CLOSED_CASE})            AS Closed,
          COUNT(*) - SUM(${CLOSED_CASE}) AS Open
        FROM Filtered
        GROUP BY Model_Name, Category, MatCode
      )

      , Production AS (
        SELECT
          mb.Material     AS MatCode,
          COUNT(*)        AS Production_Count
        FROM MaterialBarcode mb
        INNER JOIN ProcessActivity  pa  ON  pa.PSNo        = mb.DocNo
        INNER JOIN WorkCenter       wc  ON  pa.StationCode = wc.StationCode
        INNER JOIN Material         m2  ON  m2.MatCode     = mb.Material
        LEFT  JOIN MaterialCategory mc2 ON  m2.Category    = mc2.CategoryCode
        WHERE mb.PrintStatus  = 1
          AND mb.Status      <> 99
          AND pa.ActivityType = 5
          AND pa.ActivityOn  BETWEEN @startTime AND @endTime
          AND wc.StationCode  = 1220010
          AND (@model        IS NULL OR mb.Material = @model)
          AND ${CAT_FILTER_MC2}
        GROUP BY mb.Material
      )

      SELECT
        ROW_NUMBER() OVER (
          ORDER BY
            -- FIX: push NULLs to bottom explicitly
            CASE WHEN p.Production_Count IS NULL OR p.Production_Count = 0 THEN 1 ELSE 0 END,
            ra.Rework_Total * 100.0 / NULLIF(p.Production_Count, 0) DESC
        )                                             AS Sr_No,
        ra.Model_Name,
        ra.Category,
        ISNULL(p.Production_Count, 0)                 AS Production,
        ra.Rework_Total,
        ra.Open,
        ra.Closed,
        CAST(
          CASE WHEN ISNULL(p.Production_Count, 0) > 0
            THEN ROUND(ra.Rework_Total * 100.0 / p.Production_Count, 2)
            ELSE NULL
          END AS DECIMAL(10,2)
        )                                             AS Defect_Ratio_Pct,
        CASE
          WHEN ISNULL(p.Production_Count, 0) = 0                             THEN 'No Data'
          WHEN ra.Rework_Total * 100.0 / p.Production_Count >= 35            THEN 'Critical'
          WHEN ra.Rework_Total * 100.0 / p.Production_Count >= 25            THEN 'High'
          WHEN ra.Rework_Total * 100.0 / p.Production_Count >= 15            THEN 'Moderate'
          ELSE                                                                     'Good'
        END                                           AS Severity
      FROM  ReworkAgg  ra
      LEFT  JOIN Production p ON ra.MatCode = p.MatCode
      ORDER BY
        CASE WHEN p.Production_Count IS NULL OR p.Production_Count = 0 THEN 1 ELSE 0 END,
        Defect_Ratio_Pct DESC;
    `;

    const result = await request.query(query);
    res.status(200).json({
      success: true,
      message: "Defect ratio export fetched",
      data: result.recordset,
    });
  } finally {
    await pool.close();
  }
});

// ─── GET /production-report ───────────────────────────────────────────────────
export const getProductionReport = tryCatch(async (req, res) => {
  const params = parseCommonParams(req.query);

  const pool = await getPool();
  try {
    const request = pool.request();
    bindInputs(request, params);

    const query = `
      WITH FilteredData AS (
        SELECT
          mb.Material,
          CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No
        FROM MaterialBarcode mb
        JOIN ProcessActivity pa  ON pa.PSNo        = mb.DocNo
        JOIN WorkCenter      wc  ON pa.StationCode = wc.StationCode
        WHERE mb.PrintStatus  = 1
          AND mb.Status      <> 99
          AND pa.ActivityType = 5
          AND pa.ActivityOn  BETWEEN @startTime AND @endTime
          AND wc.StationCode  = 1220010
      )
      SELECT
        m.Alias      AS Model_Name,
        fd.Material  AS MatCode,
        COUNT(*)     AS production_count
      FROM FilteredData        fd
      JOIN  Material         m   ON  m.MatCode     = fd.Material
      LEFT  JOIN MaterialCategory mc ON m.Category = mc.CategoryCode
      WHERE (@model        IS NULL OR fd.Material = @model)
        AND (
          @dbCategories IS NULL
          OR mc.Name IN (SELECT value FROM STRING_SPLIT(@dbCategories, '|'))
        )
      GROUP BY m.Alias, fd.Material
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
  } finally {
    await pool.close();
  }
});
