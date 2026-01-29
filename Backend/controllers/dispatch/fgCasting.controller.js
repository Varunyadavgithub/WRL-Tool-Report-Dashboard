import sql from "mssql";
import { dbConfig2 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getDispatchMasterBySession = tryCatch(async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    throw new AppError("Missing required query parameters: sessionId.", 400);
  }

  const query = `
   /*----------------------------------------------------
      STEP 1 : Collect FG Serials
    ----------------------------------------------------*/
    IF OBJECT_ID('tempdb..#FGList') IS NOT NULL
        DROP TABLE #FGList;

    SELECT DISTINCT
        CAST(FGSerialNo AS VARCHAR(50)) AS FGSerialNo
    INTO #FGList
    FROM DispatchMaster
    WHERE Session_ID = @SessionId;


    /*----------------------------------------------------
      STEP 2 : Build IN list
    ----------------------------------------------------*/
    DECLARE @FG_IN_LIST NVARCHAR(MAX);

    SELECT @FG_IN_LIST =
        STRING_AGG('''' + FGSerialNo + '''', ',')
    FROM #FGList;


    /*----------------------------------------------------
      STEP 2.5 : Escape for OPENQUERY
    ----------------------------------------------------*/
    DECLARE @FG_IN_LIST_ESCAPED NVARCHAR(MAX);
    SET @FG_IN_LIST_ESCAPED = REPLACE(@FG_IN_LIST, '''', '''''');


    /*----------------------------------------------------
      STEP 3 : Dynamic SQL
    ----------------------------------------------------*/
    DECLARE @sql NVARCHAR(MAX);

    SET @sql = N'
    SELECT
        dm.ModelName,
        dm.Session_ID,
        mb.Serial        AS FG_Serial,
        mb.VSerial,

        -- Split Serial2
        LEFT(mb.Serial2, CHARINDEX(''/'', mb.Serial2 + ''/'') - 1) AS NFCID,
        SUBSTRING(
            mb.Serial2,
            CHARINDEX(''/'', mb.Serial2 + ''/'') + 1,
            LEN(mb.Serial2)
        ) AS CustomerQR,

        mb.CreatedOn
    FROM DispatchMaster dm
    INNER JOIN OPENQUERY(
        WRL_SERVER,
        ''
        SELECT
            Serial,
            VSerial,
            Serial2,
            CreatedOn
        FROM Garuda_WRL_LIVE.dbo.MaterialBarcode
        WHERE Serial IN (' + @FG_IN_LIST_ESCAPED + ')
        ''
    ) mb
        ON mb.Serial COLLATE SQL_Latin1_General_CP1_CI_AS
         = dm.FGSerialNo COLLATE SQL_Latin1_General_CP1_CI_AS
    WHERE dm.Session_ID = ''' + @SessionId + ''';';

    EXEC (@sql);
  `;

  const pool = await new sql.ConnectionPool(dbConfig2).connect();

  try {
    const result = await pool
      .request()
      .input("SessionId", sql.VarChar, sessionId)
      .query(query);

    res.json({
      success: true,
      message: "FG Casting data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch FG Casting data:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});
