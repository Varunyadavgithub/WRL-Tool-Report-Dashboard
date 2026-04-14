import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

export const getCPTReport = tryCatch(async (req, res) => {
  const { startDate, endDate, page = 1, limit = 50 } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400,
    );
  }

  // Bug Fix: convertToIST now receives full datetime strings (not just dates)
  // so time-of-day filtering works correctly from the frontend
  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const pageNumber = parseInt(page, 10) || 1;
  const pageSize = parseInt(limit, 10) || 50;
  const offset = (pageNumber - 1) * pageSize;

  // Bug Fix: use a single pair of datetime params (@startDate / @endDate) consistently
  // throughout the entire query — the original mixed @FROM/@TO with @startDate/@endDate.
  // Also fixed: the OFFSET / FETCH clause now uses the SQL parameters, not JS template vars.
  const query = `
    DECLARE @RETURN_TBL TABLE (
      [Result_ID]        [bigint]      NULL,
      [DATE]             [nvarchar](50) NULL,
      [TIME]             [nvarchar](50) NULL,
      [BARCODE]          [nvarchar](50) NULL,
      [MODEL]            [nvarchar](50) NULL,
      [MODELNAME]        [nvarchar](50) NULL,
      [RUNTIME_MINUTES]  [nvarchar](50) NULL,
      [MAX_TEMPERATURE]  [nvarchar](50) NULL,
      [MIN_TEMPERATURE]  [nvarchar](50) NULL,
      [MAX_CURRENT]      [nvarchar](50) NULL,
      [MIN_CURRENT]      [nvarchar](50) NULL,
      [MAX_VOLTAGE]      [nvarchar](50) NULL,
      [MIN_VOLTAGE]      [nvarchar](50) NULL,
      [MAX_POWER]        [nvarchar](50) NULL,
      [MIN_POWER]        [nvarchar](50) NULL,
      [PERFORMANCE]      [nvarchar](50) NULL,
      [FaultCode]        [nvarchar](50) NULL,
      [FaultName]        [nvarchar](50) NULL,
      [AREA_ID]          [nvarchar](2)  NULL
    );

    IF OBJECT_ID(N'tempdb..#RESULT_SET') IS NOT NULL
      DROP TABLE #RESULT_SET;

    BEGIN
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

      -- Bug Fix: unified datetime params — both the CTE and the final INSERT
      -- now use the same @startDate / @endDate rather than a mix of @FROM/@TO
      ;WITH SAMPLE_DATA AS (
        SELECT
          RSS.RESULT_ID,
          RSS.PROFILE_DEVICE_NO,
          MAX(RSS.SAMPLE_VALUE) AS [Max],
          MIN(RSS.SAMPLE_VALUE) AS [Min]
        FROM PLIS.dbo.RESULTS_SEQS_SAMPLES RSS
        INNER JOIN PLIS.dbo.RESULTS R
          ON R.RESULT_ID = RSS.RESULT_ID
         AND R.SERVER_ID  = 0
        WHERE RSS.SERVER_ID = 0
          AND R.START_DATE BETWEEN @startDate AND @endDate
        GROUP BY RSS.RESULT_ID, RSS.PROFILE_DEVICE_NO
      ),
      SAMPLE_DATA_PROFILE_DEVICE AS (
        SELECT
          SD.RESULT_ID,
          SD.[Max],
          SD.[Min],
          PD.DEVICE_TYPE_ID
        FROM PLIS.dbo.RESULTS R
        INNER JOIN SAMPLE_DATA SD
          ON R.RESULT_ID = SD.RESULT_ID
        INNER JOIN PLIS.dbo.PROFILES_DEVICES PD
          ON SD.PROFILE_DEVICE_NO    = PD.DEVICE_NO
         AND R.PROFILE_ID            = PD.PROFILE_ID
         AND R.PROFILE_HISTORY_ID    = PD.HISTORY_ID
         AND PD.SERVER_ID            = 0
        WHERE PD.DEVICE_TYPE_ID IN (1, 2, 3, 7)
          AND R.SERVER_ID = 0
      )
      SELECT * INTO #RESULT_SET FROM SAMPLE_DATA_PROFILE_DEVICE;

      CREATE INDEX #RESULT_SET_DEVICE_TYPE_ID ON #RESULT_SET (DEVICE_TYPE_ID);

      INSERT INTO @RETURN_TBL (
        [Result_ID], [DATE], [TIME], [BARCODE], [MODEL], [MODELNAME],
        [RUNTIME_MINUTES],
        [MAX_TEMPERATURE], [MIN_TEMPERATURE],
        [MAX_CURRENT],     [MIN_CURRENT],
        [MAX_VOLTAGE],     [MIN_VOLTAGE],
        [MAX_POWER],       [MIN_POWER],
        [PERFORMANCE], [FaultCode], [FaultName], [AREA_ID]
      )
      SELECT
        MAIN.RESULT_ID,
        CONVERT(VARCHAR(10), MAIN.START_DATE, 105)  AS [DATE],
        CONVERT(VARCHAR(8),  MAIN.START_DATE, 108)  AS [TIME],
        MAIN.BARCODE,
        MAIN.MODEL_ID                               AS MODEL,
        MDL.NAME                                    AS MODELNAME,
        DATEDIFF(MI, MAIN.START_DATE, MAIN.END_DATE) AS RUNTIME_MINUTES,
        TEMP.[Max]  AS MAX_TEMPERATURE,
        TEMP.[Min]  AS MIN_TEMPERATURE,
        CUR.[Max]   AS MAX_CURRENT,
        CUR.[Min]   AS MIN_CURRENT,
        VOL.[Max]   AS MAX_VOLTAGE,
        VOL.[Min]   AS MIN_VOLTAGE,
        POW.[Max]   AS MAX_POWER,
        POW.[Min]   AS MIN_POWER,
        CASE WHEN MAIN.STATUS = 1 THEN 'PASS' ELSE 'FAIL' END AS PERFORMANCE,
        ISNULL(SS.DEVICE_STATUS_CODE, 0)            AS FaultCode,
        CASE
          WHEN SS.DEVICE_STATUS_CODE = 26          THEN 'System Already Charged'
          WHEN CN.NAME IS NULL AND MAIN.STATUS = 0 THEN 'Station Fault Stop'
          WHEN CN.NAME IS NULL                     THEN 'Charging Pass'
          ELSE CN.NAME
        END                                         AS FaultName,
        MAIN.AREA_ID
      FROM PLIS.dbo.RESULTS MAIN
      INNER JOIN #RESULT_SET TEMP ON MAIN.RESULT_ID = TEMP.RESULT_ID AND TEMP.DEVICE_TYPE_ID = 7
      INNER JOIN #RESULT_SET CUR  ON TEMP.RESULT_ID = CUR.RESULT_ID  AND CUR.DEVICE_TYPE_ID  = 2
      INNER JOIN #RESULT_SET VOL  ON CUR.RESULT_ID  = VOL.RESULT_ID  AND VOL.DEVICE_TYPE_ID  = 3
      INNER JOIN #RESULT_SET POW  ON VOL.RESULT_ID  = POW.RESULT_ID  AND POW.DEVICE_TYPE_ID  = 1
      LEFT JOIN  PLIS.dbo.MODELS MDL
        ON MDL.MODEL_ID = MAIN.MODEL_ID
      LEFT JOIN  PLIS.dbo.RESULTS_STEPS_STATUS SS
        ON MAIN.RESULT_ID = SS.RESULT_ID
      LEFT JOIN (
        SELECT DISTINCT STATUS_CODE_ID, NAME, STATUS_CODE_TYPE
        FROM PLIS.dbo.DEVICES_STATUS_CODES
        WHERE LANGUAGE_ID = 0
      ) CN
        ON CN.STATUS_CODE_ID   = SS.DEVICE_STATUS_CODE
       AND CN.STATUS_CODE_TYPE = SS.Status_Type_ID
      -- Bug Fix: AREA_ID filter restored; datetime range uses the unified params
      WHERE MAIN.AREA_ID IN (5, 6, 8, 9)
        AND MAIN.START_DATE BETWEEN @startDate AND @endDate;

      -- Total count (excluding records already tracked in GasChargeSUSDtls)
      DECLARE @TotalCount INT;
      SELECT @TotalCount = COUNT(*)
      FROM @RETURN_TBL
      WHERE Result_ID NOT IN (SELECT Result_ID FROM GasChargeSUSDtls);

      -- Paginated result set
      -- Bug Fix: OFFSET/FETCH now uses SQL parameters @offset and @pageSize
      SELECT *
      FROM @RETURN_TBL
      WHERE Result_ID NOT IN (SELECT Result_ID FROM GasChargeSUSDtls)
      ORDER BY Result_ID DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY;

      -- Total count (second recordset)
      SELECT @TotalCount AS TotalCount;
    END
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, pageSize)
      .query(query);

    const data = result.recordsets[0];
    const totalCount = result.recordsets[1]?.[0]?.TotalCount ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      success: true,
      message: "CPT Report data retrieved successfully.",
      data,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalRecords: totalCount,
        limit: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the CPT Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
