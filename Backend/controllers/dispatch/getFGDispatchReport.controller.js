import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// Validates and formats a datetime string safe for T-SQL string injection.
// OPENQUERY requires string-concatenated dynamic SQL so mssql parameters
// cannot be used for the inner query — we validate strictly instead.
const safeDatetime = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new AppError("Invalid datetime value.", 400);
  return d.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
};

export const getFGDispatchReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const istStart = safeDatetime(convertToIST(startDate));
  const istEnd   = safeDatetime(convertToIST(endDate));

  // ── The entire script is sent as ONE batch so temp tables survive across
  //    all EXEC / sp_executesql calls within the same connection scope. ─────
  const query = `
    IF OBJECT_ID('tempdb..#LabelPrint')     IS NOT NULL DROP TABLE #LabelPrint;
    IF OBJECT_ID('tempdb..#Unloading')      IS NOT NULL DROP TABLE #Unloading;
    IF OBJECT_ID('tempdb..#DispatchMaster') IS NOT NULL DROP TABLE #DispatchMaster;
    IF OBJECT_ID('tempdb..#SerialBatch')    IS NOT NULL DROP TABLE #SerialBatch;

    CREATE TABLE #LabelPrint (
        FgserialNo     NVARCHAR(100),
        LabelPrintDate DATETIME
    );
    CREATE TABLE #Unloading (
        FgserialNo    NVARCHAR(100),
        UnloadingDate DATETIME
    );
    CREATE TABLE #DispatchMaster (
        Session_ID  NVARCHAR(50),
        Vehicle_No  NVARCHAR(50),
        DockNo      INT,
        AddedOn     DATETIME,
        FGSerialNo  NVARCHAR(100)
    );
    CREATE TABLE #SerialBatch (
        RowNum     INT,
        FgserialNo NVARCHAR(100)
    );

    -- ── Step 1: Pull serials from local DB filtered by FG Label Printing date ─
    DECLARE @start DATETIME = '${istStart}';
    DECLARE @end   DATETIME = '${istEnd}';

    INSERT INTO #LabelPrint (FgserialNo, LabelPrintDate)
    SELECT b.Serial, lp.MaxLabelDate
    FROM MaterialBarcode b
    INNER JOIN (
        SELECT PSNo, MAX(CompletedOn) AS MaxLabelDate
        FROM   ProcessRouting
        WHERE  StationCode IN (1220010, 1230017)
          AND  Status      = 2
          AND  CompletedOn >= @start
          AND  CompletedOn <= @end
        GROUP BY PSNo
    ) lp ON lp.PSNo = b.DocNo
    WHERE b.Type NOT IN (200, 0);

    -- ── Step 2: Number the serials for batch iteration ─────────────────────
    INSERT INTO #SerialBatch (RowNum, FgserialNo)
    SELECT ROW_NUMBER() OVER (ORDER BY FgserialNo), FgserialNo
    FROM #LabelPrint;

    -- ── Step 3: Fetch DispatchUnloading dates from linked server ───────────
    DECLARE @batchSize INT = 200;
    DECLARE @offset    INT = 1;
    DECLARE @maxRow    INT;
    DECLARE @inList    NVARCHAR(MAX);
    DECLARE @innerSQL  NVARCHAR(MAX);
    DECLARE @outerSQL  NVARCHAR(MAX);

    SELECT @maxRow = MAX(RowNum) FROM #SerialBatch;

    WHILE @offset <= @maxRow
    BEGIN
        SET @inList   = NULL;
        SET @innerSQL = NULL;
        SET @outerSQL = NULL;

        SELECT @inList = STUFF((
            SELECT ',' + '''' + REPLACE(FgserialNo, '''', '''''') + ''''
            FROM #SerialBatch
            WHERE RowNum BETWEEN @offset AND (@offset + @batchSize - 1)
            FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '');

        IF @inList IS NOT NULL
        BEGIN
            SET @innerSQL =
                'SELECT FgserialNo, DateTime ' +
                'FROM WWMS.dbo.DispatchUnloading ' +
                'WHERE FgserialNo IN (' + @inList + ')';

            SET @innerSQL = REPLACE(@innerSQL, '''', '''''');

            SET @outerSQL =
                'INSERT INTO #Unloading (FgserialNo, UnloadingDate) ' +
                'SELECT FgserialNo, DateTime ' +
                'FROM OPENQUERY([10.100.95.134], ''' + @innerSQL + ''')';

            EXEC sp_executesql @outerSQL;
        END;

        SET @offset = @offset + @batchSize;
    END;

    -- ── Step 4: Fetch DispatchMaster in batches of 200 ────────────────────
    SET @offset = 1;

    WHILE @offset <= @maxRow
    BEGIN
        SET @inList   = NULL;
        SET @innerSQL = NULL;
        SET @outerSQL = NULL;

        SELECT @inList = STUFF((
            SELECT ',' + '''' + REPLACE(FgserialNo, '''', '''''') + ''''
            FROM #SerialBatch
            WHERE RowNum BETWEEN @offset AND (@offset + @batchSize - 1)
            FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '');

        IF @inList IS NOT NULL
        BEGIN
            SET @innerSQL =
                'SELECT dm.Session_ID, td.Vehicle_No, td.DockNo, dm.AddedOn, dm.FGSerialNo ' +
                'FROM WWMS.dbo.DispatchMaster dm ' +
                'INNER JOIN WWMS.dbo.Tracking_Document td ON td.Document_ID = dm.Document_ID ' +
                'WHERE dm.FGSerialNo IN (' + @inList + ')';

            -- Double all single quotes for OPENQUERY wrapping
            SET @innerSQL = REPLACE(@innerSQL, '''', '''''');

            SET @outerSQL =
                'INSERT INTO #DispatchMaster (Session_ID, Vehicle_No, DockNo, AddedOn, FGSerialNo) ' +
                'SELECT Session_ID, Vehicle_No, DockNo, AddedOn, FGSerialNo ' +
                'FROM OPENQUERY([10.100.95.134], ''' + @innerSQL + ''')';

            EXEC sp_executesql @outerSQL;
        END;

        SET @offset = @offset + @batchSize;
    END;

    -- ── Step 5: Final report ───────────────────────────────────────────────
    ;WITH MB AS (
        SELECT
            b.DocNo,
            b.Serial,
            c.Name AS MaterialName
        FROM MaterialBarcode b
        INNER JOIN material c ON c.matcode = b.material
        WHERE b.Type NOT IN (200, 0)
          AND b.Serial IN (SELECT FgserialNo FROM #LabelPrint)
    )
    SELECT
        mb.Serial                                               AS FGSerialNo,
        mb.MaterialName,
        mb.DocNo,

        -- FG Label Printing (always SCANNED — it is the filter criterion)
        'SCANNED'                                               AS FG_LabelPrinting,
        lp.LabelPrintDate                                       AS FG_LabelPrinting_Date,

        -- FG Auto Scan
        CASE WHEN EXISTS (
                SELECT 1 FROM ProcessRouting p
                WHERE p.PSNo = mb.DocNo AND p.Status = 2
                  AND p.StationCode IN (1220009, 1230018))
             THEN 'SCANNED' ELSE 'NOT SCANNED'
        END                                                     AS FG_Auto_Scan,
        (SELECT MAX(p.CompletedOn) FROM ProcessRouting p
         WHERE p.PSNo = mb.DocNo AND p.Status = 2
           AND p.StationCode IN (1220009, 1230018))             AS FG_Auto_Scan_Date,

        -- FG Unloading (may not have been dispatched yet)
        CASE WHEN u.FgserialNo IS NOT NULL
             THEN 'SCANNED' ELSE 'NOT SCANNED'
        END                                                     AS FG_Unloading,
        u.UnloadingDate                                         AS FG_Unloading_Date,

        -- Vehicle / Dispatch info
        dm.Session_ID,
        dm.Vehicle_No,
        dm.DockNo,
        dm.AddedOn                                              AS Vehicle_Entry_Time

    FROM MB mb
    INNER JOIN #LabelPrint      lp ON lp.FgserialNo  = mb.Serial
    LEFT  JOIN #Unloading       u  ON u.FgserialNo   = mb.Serial
    LEFT  JOIN #DispatchMaster  dm ON dm.FGSerialNo  = mb.Serial
    ORDER BY lp.LabelPrintDate DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request().query(query);

    // The batch produces multiple recordsets (DROP/CREATE/INSERT are silent,
    // but EXEC calls may return empty sets). The final SELECT is always last.
    const recordsets = result.recordsets ?? [];
    const data = recordsets[recordsets.length - 1] ?? [];

    res.status(200).json({
      success:    true,
      message:    "FG Dispatch Report fetched successfully.",
      data,
      totalCount: data.length,
    });
  } finally {
    await pool.close();
  }
});