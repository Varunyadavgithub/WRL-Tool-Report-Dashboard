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

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  // Parse pagination parameters
  const pageNumber = parseInt(page, 10) || 1;
  const pageSize = parseInt(limit, 10) || 50;
  const offset = (pageNumber - 1) * pageSize;

  let query = `
    DECLARE @RETURN_TBL TABLE (
      [Result_ID] [bigint] NULL,
      [DATE] [nvarchar](50) NULL,
      [TIME] [nvarchar](50) NULL,
      [BARCODE] [nvarchar](50) NULL,
      [MODEL] [nvarchar](50) NULL,
      [MODELNAME] [nvarchar](50) NULL,
      [RUNTIME_MINUTES] [nvarchar](50) NULL,
      [MAX_TEMPERATURE] [nvarchar](50) NULL,
      [MIN_TEMPERATURE] [nvarchar](50) NULL,
      [MAX_CURRENT] [nvarchar](50) NULL,
      [MIN_CURRENT] [nvarchar](50) NULL,
      [MAX_VOLTAGE] [nvarchar](50) NULL,
      [MIN_VOLTAGE] [nvarchar](50) NULL,
      [MAX_POWER] [nvarchar](50) NULL,
      [MIN_POWER] [nvarchar](50) NULL,
      [PERFORMANCE] [nvarchar](50) NULL,
      [FaultCode] [nvarchar](50) NULL,
      [FaultName] [nvarchar](50) NULL,
      [AREA_ID] [nvarchar](2) NULL
    )

    IF OBJECT_ID(N'tempdb..#RESULT_SET') IS NOT NULL
    BEGIN
      DROP TABLE #RESULT_SET
    END

    BEGIN
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

      DECLARE @FROM DATETIME = @startDate;
      DECLARE @TO DATETIME = @endDate;

      ;WITH SAMPLE_DATA AS (
        SELECT RESULTS_SEQS_SAMPLES.RESULT_ID, PROFILE_DEVICE_NO, MAX(SAMPLE_VALUE) AS Max, MIN(SAMPLE_VALUE) AS Min
        FROM PLIS.dbo.RESULTS_SEQS_SAMPLES
        INNER JOIN PLIS.dbo.RESULTS ON RESULTS.RESULT_ID = RESULTS_SEQS_SAMPLES.RESULT_ID AND RESULTS.SERVER_ID = 0
        WHERE RESULTS_SEQS_SAMPLES.SERVER_ID = 0 AND RESULTS.START_DATE BETWEEN @FROM AND @TO
        GROUP BY RESULTS_SEQS_SAMPLES.RESULT_ID, PROFILE_DEVICE_NO
      ), 
      SAMPLE_DATA_PROFILE_DEVICE AS (
        SELECT SAMPLE_DATA.RESULT_ID, SAMPLE_DATA.Max, SAMPLE_DATA.Min, PROFILES_DEVICES.DEVICE_TYPE_ID
        FROM PLIS.dbo.RESULTS
        INNER JOIN SAMPLE_DATA ON RESULTS.RESULT_ID=SAMPLE_DATA.RESULT_ID
        INNER JOIN PLIS.dbo.PROFILES_DEVICES ON 
          SAMPLE_DATA.PROFILE_DEVICE_NO = PROFILES_DEVICES.DEVICE_NO AND 
          RESULTS.PROFILE_ID=PROFILES_DEVICES.PROFILE_ID AND
          RESULTS.PROFILE_HISTORY_ID = PROFILES_DEVICES.HISTORY_ID AND
          PROFILES_DEVICES.SERVER_ID = 0
        WHERE PROFILES_DEVICES.DEVICE_TYPE_ID IN (1, 2, 3, 7) AND RESULTS.SERVER_ID = 0
      )
      SELECT * INTO #RESULT_SET FROM SAMPLE_DATA_PROFILE_DEVICE
      CREATE INDEX #RESULT_SET_DEVICE_TYPE_ID ON #RESULT_SET(DEVICE_TYPE_ID)

      INSERT INTO @RETURN_TBL(
        [Result_ID], [DATE], [TIME], [BARCODE], [MODEL], [MODELNAME],
        [RUNTIME_MINUTES], [MAX_TEMPERATURE], [MIN_TEMPERATURE],
        [MAX_CURRENT], [MIN_CURRENT], [MAX_VOLTAGE], [MIN_VOLTAGE],
        [MAX_POWER], [MIN_POWER], [PERFORMANCE], [FaultCode], [FaultName], [AREA_ID]
      )
      (
        SELECT
          MAIN.Result_ID,
          CONVERT(VARCHAR(10), MAIN.START_DATE, 105) AS DATE,
          CONVERT(VARCHAR(8), MAIN.START_DATE, 108) AS TIME,
          MAIN.BARCODE AS BARCODE,
          MAIN.MODEL_ID AS MODEL,
          MODEL.NAME AS MODEL_NAME,
          DATEDIFF(MI, MAIN.START_DATE, MAIN.END_DATE) AS RUNTIME_MINUTES,
          TEMP.Max AS MAX_TEMPERATURE,
          TEMP.Min AS MIN_TEMPERATURE,
          CUR.Max AS MAX_CURRENT,
          CUR.Min AS MIN_CURRENT,
          VOL.Max AS MAX_VOLTAGE,
          VOL.Min AS MIN_VOLTAGE,
          POW.Max AS MAX_POWER,
          POW.Min as MIN_POWER,
          CASE WHEN MAIN.STATUS = 1 THEN 'PASS' ELSE 'FAIL' END AS PERFORMANCE,
          ISNULL(Step_Status.DEVICE_STATUS_CODE,0) as FaultCode,
          CASE 
            WHEN Step_Status.DEVICE_STATUS_CODE=26 THEN 'System Already Charged'
            WHEN Code_Name.NAME is null AND MAIN.STATUS=0 THEN 'Station Fault Stop' 
            WHEN Code_Name.NAME is null THEN 'Charging Pass'  			 		
            ELSE Code_Name.NAME
          END as FaultName,
          MAIN.AREA_ID
        FROM PLIS.dbo.RESULTS MAIN
        INNER JOIN #RESULT_SET TEMP ON MAIN.RESULT_ID=TEMP.RESULT_ID AND TEMP.DEVICE_TYPE_ID = 7 
        INNER JOIN #RESULT_SET CUR ON TEMP.RESULT_ID= CUR.RESULT_ID AND CUR.DEVICE_TYPE_ID = 2
        INNER JOIN #RESULT_SET VOL ON VOL.RESULT_ID = CUR.RESULT_ID AND VOL.DEVICE_TYPE_ID = 3
        INNER JOIN #RESULT_SET POW ON POW.RESULT_ID=VOL.RESULT_ID AND POW.DEVICE_TYPE_ID = 1
        LEFT JOIN PLIS.dbo.MODELS MODEL ON MODEL.MODEL_ID=MAIN.MODEL_ID
        LEFT JOIN PLIS.dbo.RESULTS_STEPS_STATUS Step_Status on MAIN.RESULT_ID=Step_Status.RESULT_ID
        LEFT JOIN (
          SELECT DISTINCT STATUS_CODE_ID, NAME, STATUS_CODE_TYPE 
          FROM PLIS.dbo.DEVICES_STATUS_CODES 
          WHERE LANGUAGE_ID=0
        ) Code_Name ON Code_Name.STATUS_CODE_ID=Step_Status.DEVICE_STATUS_CODE 
          AND Code_Name.STATUS_CODE_TYPE=Step_Status.Status_Type_ID
        WHERE MAIN.AREA_ID IN (5, 6) AND MAIN.START_DATE BETWEEN @startDate AND @endDate
      );

      -- Get total count (excluding records in GasChargeSUSDtls)
      DECLARE @TotalCount INT;
      SELECT @TotalCount = COUNT(*) 
      FROM @RETURN_TBL 
      WHERE Result_ID NOT IN (SELECT Result_ID FROM GasChargeSUSDtls);

      -- Return paginated data
      SELECT * FROM @RETURN_TBL 
      WHERE Result_ID NOT IN (SELECT Result_ID FROM GasChargeSUSDtls)
      ORDER BY Result_ID DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY;

      -- Return total count as second result set
      SELECT @TotalCount AS TotalCount;
    END
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, pageSize);

    const result = await request.query(query);

    // First recordset contains the paginated data
    const data = result.recordsets[0];
    // Second recordset contains the total count
    const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
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
