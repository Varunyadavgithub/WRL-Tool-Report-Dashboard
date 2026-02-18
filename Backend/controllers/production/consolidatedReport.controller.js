import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Stage History Report
export const getCurrentStageStatus = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;

  if (!componentIdentifier) {
    throw new AppError("Component Identifier is required", 400);
  }

  let query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
      FROM MaterialBarcode 
      WHERE DocNo=(Select Psno from ProcessStageLabel where BarcodeNo=@componentIdentifier) AND type=100
    )
    SELECT 
      Psno.DocNo AS PSNO,
      M.Name AS MaterialName,
      B.StationCode,
      B.Name AS StationName,
      B.Alias AS StationAlias,
      A.ActivityOn,
      Psno.Serial2 As CustomerQR,
      Psno.VSerial,
      Psno.Alias AS BarcodeAlias,
      Psno.Serial,
      A.ActivityType,
      C.Type AS ActivityTypeName,
      U.UserName
    FROM 
      Psno
    INNER JOIN 
      ProcessActivity A ON Psno.DocNo = A.PSNO
    INNER JOIN 
      WorkCenter B ON A.StationCode = B.StationCode
    INNER JOIN 
      Material M ON Psno.Material = M.MatCode
    LEFT JOIN 
      ProcessActivityType C ON C.id = A.ActivityType
    INNER JOIN
      Users U on U.UserCode = A.Operator
    ORDER BY 
      A.ActivityOn ASC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Current Stage Status retrieved successfully",
      data: result,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Current Stage Status data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Dispatch Report
export const getLogisticStatus = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;

  if (!componentIdentifier) {
    throw new AppError("Component Identifier is required", 400);
  }

  const query = `
--------------------------------------------------------
-- STEP 1: TEMP TABLE FOR UNLOADING DATA
--------------------------------------------------------
IF OBJECT_ID('tempdb..#Dispatch') IS NOT NULL
    DROP TABLE #Dispatch;

CREATE TABLE #Dispatch (
    FgserialNo NVARCHAR(100),
    UnloadingDate DATETIME
);

--------------------------------------------------------
-- STEP 2: TEMP TABLE FOR VEHICLE & DOCK DATA
--------------------------------------------------------
IF OBJECT_ID('tempdb..#DispatchMaster') IS NOT NULL
    DROP TABLE #DispatchMaster;

CREATE TABLE #DispatchMaster (
    Session_ID NVARCHAR(50),
    Vehicle_No NVARCHAR(50),
    DockNo INT,
    AddedOn DATETIME,
    FGSerialNo NVARCHAR(100)
);

--------------------------------------------------------
-- STEP 3: OPENQUERY FOR UNLOADING
--------------------------------------------------------
DECLARE @sql NVARCHAR(MAX);

SET @sql = N'
INSERT INTO #Dispatch (FgserialNo, UnloadingDate)
SELECT FgserialNo, DateTime
FROM OPENQUERY([10.100.95.134],
  ''SELECT FgserialNo, DateTime  
    FROM WWMS.dbo.DispatchUnloading 
    WHERE FgserialNo = ''''' + REPLACE(@componentIdentifier, '''', '''''') + '''''''
)';
EXEC(@sql);

--------------------------------------------------------
-- STEP 4: OPENQUERY FOR VEHICLE, DOCK, SESSION
--------------------------------------------------------
SET @sql = N'
INSERT INTO #DispatchMaster (Session_ID, Vehicle_No, DockNo, AddedOn, FGSerialNo)
SELECT Session_ID, Vehicle_No, DockNo, AddedOn, FGSerialNo
FROM OPENQUERY([10.100.95.134],
  ''SELECT 
        dm.Session_ID,
        td.Vehicle_No,
        td.DockNo,
        dm.AddedOn,
        dm.FGSerialNo
    FROM WWMS.dbo.DispatchMaster dm
    INNER JOIN WWMS.dbo.Tracking_Document td 
        ON td.Document_ID = dm.Document_ID
    WHERE dm.FGSerialNo = ''''' + REPLACE(@componentIdentifier, '''', '''''') + '''''''
)';
EXEC(@sql);



--------------------------------------------------------
-- STEP 5: MAIN LOCAL DATA FETCH
--------------------------------------------------------
;WITH MB AS (
    SELECT
        b.DocNo,
        b.Serial,
        c.Name
    FROM MaterialBarcode b
    INNER JOIN material c 
        ON c.matcode = b.material
    WHERE b.Type NOT IN (200, 0)
      AND b.Serial = @componentIdentifier
)

--------------------------------------------------------
-- FINAL OUTPUT WITH ALL DETAILS
--------------------------------------------------------
SELECT
    -- FG LABEL PRINTING
    CASE 
        WHEN EXISTS (
            SELECT 1
            FROM ProcessRouting p
            WHERE p.PSNo = mb.DocNo
              AND p.Status = 2
              AND p.StationCode IN (1220010, 1230017)
        ) THEN 'SCANNED' ELSE 'NOT SCANNED'
    END AS [FG_LabelPrinting],

    (
        SELECT MAX(p.CompletedOn)
        FROM ProcessRouting p
        WHERE p.PSNo = mb.DocNo
          AND p.Status = 2
          AND p.StationCode IN (1220010, 1230017)
    ) AS [FG_LabelPrinting_Date],

    -- FG AUTO SCAN
    CASE 
        WHEN EXISTS (
            SELECT 1
            FROM ProcessRouting p
            WHERE p.PSNo = mb.DocNo
              AND p.Status = 2
              AND p.StationCode IN (1220009, 1230018)
        ) THEN 'SCANNED' ELSE 'NOT SCANNED'
    END AS [FG_Auto_Scan],

    (
        SELECT MAX(p.CompletedOn)
        FROM ProcessRouting p
        WHERE p.PSNo = mb.DocNo
          AND p.Status = 2
          AND p.StationCode IN (1220009, 1230018)
    ) AS [FG_Auto_Scan_Date],

    -- FG UNLOADING
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM #Dispatch d WHERE d.FgserialNo = mb.Serial
        ) THEN 'SCANNED' ELSE 'NOT SCANNED'
    END AS [FG_Unloading],

    (
        SELECT MAX(d.UnloadingDate)
        FROM #Dispatch d
        WHERE d.FgserialNo = mb.Serial
    ) AS [FG_Unloading_Date],

    -- VEHICLE & DOCK DETAILS (NEW)
    dm.Session_ID,
    dm.Vehicle_No,
    dm.DockNo,
    dm.AddedOn AS [Vehicle_Entry_Time]

FROM MB mb
LEFT JOIN #DispatchMaster dm 
    ON dm.FGSerialNo = mb.Serial;

    `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Logistic Status retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Logistic Stage Status data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Component Details
export const getComponentDetails = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;

  if (!componentIdentifier) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required query parameter: serialNumber or FG serialNumber",
      data: [],
    });
  }

  const query = `
      DECLARE @SRNO VARCHAR(50) = @componentIdentifier;
      DECLARE @DocNo INT;

      SELECT @DocNo = DocNo 
      FROM MaterialBarcode 
      WHERE Serial = @SRNO;

      IF @DocNo IS NULL
      SELECT @DocNo = DocNo 
      FROM MaterialBarcode 
      WHERE Alias = @SRNO;

      IF @DocNo IS NULL
      SELECT @DocNo = PSNo 
      FROM ProcessStageLabel 
      WHERE BarcodeNo = @SRNO;

      IF @DocNo IS NULL
      BEGIN
          SELECT 'Invalid Serial / Barcode' AS Message;
          RETURN;
      END

      SELECT 
          c.Name AS name,
          ISNULL(c.AltName,'NA') AS sapCode,
          a.Serial AS serial,
          mc.Name AS type,
          l.Name AS supplierName,
          a.ScannedOn AS scannedOn
      FROM ProcessInputBOMScan a
      JOIN ProcessInputBOM b ON a.PSNo=b.PSNo AND a.RowID=b.RowID
      JOIN Material c ON b.Material=c.MatCode
      Join MaterialCategory mc on mc.CategoryCode = c.Category
      join Ledger l on l.LedgerCode = c.Ledger
      WHERE a.PSNo=@DocNo

      UNION ALL

      SELECT 
          b.Name As name,
          b.AltName AS sapCode,
          a.Serial AS serial,
          mc.Name AS type,
          l.Name AS supplierName,
          a.CreatedOn
      FROM MaterialBarcode a
      JOIN Material b ON a.Material=b.MatCode
      Join MaterialCategory mc on mc.CategoryCode = b.Category
      join Ledger l on l.LedgerCode = b.Ledger
      WHERE a.DocNo=@DocNo
      AND a.VSerial IS NOT NULL;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("componentIdentifier", sql.VarChar, componentIdentifier)
      .query(query);

    if (!result.recordset.length) {
      return res.status(404).json({
        success: false,
        message: "No component details found for the given serial number",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Component details retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch component details: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Rework Report
export const getReworkReport = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;

  if (!componentIdentifier) {
    throw new AppError("Component Identifier is required", 400);
  }

  const query = `
    SELECT
      ROW_NUMBER() OVER (ORDER BY pr.StartedOn) AS RowNo,

        m.Alias AS [modelName],
        mc.Name AS [category],

        w.Name AS [station],
        pr.ProcessCode AS [processCode],

        it.Serial AS [assembly],

        pr.StartedOn AS [reworkIN],
        pr.CompletedOn AS [reworkOut],

        us.UserName AS [userName],
        s.Status AS [reworkStatus],

        -- Safe Duration (handles NULL completed time)
    CASE 
        WHEN pr.CompletedOn IS NULL THEN NULL
        ELSE CONCAT(
            DATEDIFF(DAY, pr.StartedOn, pr.CompletedOn), ':',
            FORMAT((DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) / 60) % 24, 'D2'), ':',
            FORMAT(DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) % 60, 'D2')
        )
    END AS [Duration (DD,HH:MM)],

    dct.Type AS [defectCategory],
    dc.Name AS [defect],
    rc.Type AS [rootCause],
    rr.Type AS [counterAction],
    it.ApproverRemark AS [remark]

    FROM InspectionTrans it
    INNER JOIN InspectionHeader ih
        ON it.InspectionLotNo = ih.InspectionLotNo

    INNER JOIN Material m
        ON ih.Material = m.MatCode

    LEFT JOIN MaterialCategory mc
        ON m.Category = mc.CategoryCode

    -- only the rework stage
    INNER JOIN ProcessRouting pr
        ON ih.DocNo = pr.PSNo
      AND pr.ProcessCode = ih.Process

    INNER JOIN WorkCenter w
        ON pr.StationCode = w.StationCode

    LEFT JOIN Status s
        ON ih.Status = s.ID
    LEFT JOIN InspectionDefect idf ON it.ID = idf.ID
    LEFT JOIN DefectCodeMaster dc ON idf.Defect = dc.Code
    LEFT JOIN DefectCategoryType dct ON dc.DefectCategory = dct.ID
    LEFT JOIN RootCause rc ON it.RootCause = rc.ID
    LEFT JOIN ReworkResolution rr ON it.ReworkResolution = rr.ID
    LEFT JOIN Users us ON it.ApprovedBy = us.UserCode

    WHERE it.NextAction = 1
      AND ih.DocNo = (Select PSNo from ProcessStageLabel where BarcodeNo = @componentIdentifier);
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Rework Report data retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Rework Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Reprint History Report
export const getReprintHistory = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;

  if (!componentIdentifier) {
    throw new AppError("Component Identifier is required", 400);
  }

  const query = `
    SELECT
      ROW_NUMBER() OVER (ORDER BY bp.PrintedOn ASC) AS [Sr_No],
      bp.Remark,
      bp.PrintedOn   AS [Printed_On],
      u.UserName     AS [Printed_By]
    FROM BarcodePrintTrail bp
    INNER JOIN Users u 
      ON u.UserCode = bp.PrintedBy
    WHERE bp.BarcodeNo = (
      SELECT BarcodeNo 
      FROM MaterialBarcode 
      WHERE Serial = @componentIdentifier 
         OR Alias = @componentIdentifier
    )
    ORDER BY bp.PrintedOn ASC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Reprint History data retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Reprint History data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// History Card Report
export const getHistoryCard = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;

  if (!componentIdentifier) {
    throw new AppError("Component Identifier is required", 400);
  }

  const query = `
    ------------------------------------------------------------
    -- GET PSNo ONLY ONCE
    ------------------------------------------------------------
    DECLARE @PSNo BIGINT;

    SELECT TOP 1 @PSNo = DocNo
    FROM MaterialBarcode
    WHERE DocNo=(Select Psno from ProcessStageLabel where BarcodeNo=@componentIdentifier) AND type=100;

    -- If no PSNo found, return empty
    IF @PSNo IS NULL
    BEGIN
      SELECT 
        NULL AS [Sr No],
        NULL AS [Date & Time],
        NULL AS [Activity],
        NULL AS [ProcessStatus],
        NULL AS [Important check point],
        NULL AS [Method of checking],
        NULL AS [Name of Operator],
        NULL AS [Issue],
        NULL AS [Action Date & Time],
        NULL AS [Action],
        NULL AS [Result]
      WHERE 1 = 0;
      RETURN;
    END

    ------------------------------------------------------------
    -- PRODUCTION HISTORY
    ------------------------------------------------------------
    ;WITH ProductionData AS
    (
      SELECT
        A.ActivityOn AS [DateTime],
        B.Name AS [Activity],
        C.Type AS [ProcessStatus],
        pb.CheckPoints AS [ImportantCheckPoint],
        pb.CheckingMethod AS [MethodOfChecking],
        U.UserName AS [OperatorName],
        NULL AS [Issue],
        NULL AS [ActionDateTime],
        NULL AS [Action],
        'OK' AS [Result]
      FROM ProcessActivity A
      INNER JOIN WorkCenter B ON A.StationCode = B.StationCode
      INNER JOIN ProductionProcess pb ON pb.ProcessCode = A.ProcessCode
      LEFT JOIN ProcessActivityType C ON C.id = A.ActivityType
      INNER JOIN Users U ON U.UserCode = A.Operator
      WHERE A.PSNo = @PSNo
    ),

    ------------------------------------------------------------
    -- REWORK EVENT
    ------------------------------------------------------------
    ReworkData AS
    (
      SELECT
        pr.StartedOn AS [DateTime],
        w.Name AS [Activity],
        'REWORK' AS [ProcessStatus],
        dc.Name AS [ImportantCheckPoint],
        pb.CheckingMethod AS [MethodOfChecking],
        us.UserName AS [OperatorName],
        dc.Name AS [Issue],
        it.InspectedOn AS [ActionDateTime],
        rr.Type AS [Action],
        'REWORKED' AS [Result],
        pr.SeqNo
      FROM InspectionHeader ih
      INNER JOIN InspectionTrans it ON it.InspectionLotNo = ih.InspectionLotNo
      INNER JOIN ProcessRouting pr ON pr.PSNo = ih.DocNo AND pr.ProcessCode = ih.Process
      INNER JOIN WorkCenter w ON w.StationCode = pr.StationCode
      LEFT JOIN ProductionProcess pb ON pb.ProcessCode = pr.ProcessCode
      LEFT JOIN InspectionDefect idf ON it.ID = idf.ID
      LEFT JOIN DefectCodeMaster dc ON idf.Defect = dc.Code
      LEFT JOIN ReworkResolution rr ON it.ReworkResolution = rr.ID
      LEFT JOIN Users us ON it.ApprovedBy = us.UserCode
      WHERE it.NextAction = 1
        AND ih.DocNo = @PSNo
    ),

    ------------------------------------------------------------
    -- PENDING ROUTE STAGES (AFTER REWORK)
    ------------------------------------------------------------
    PendingStages AS
    (
      SELECT
        NULL AS [DateTime],
        w.Name AS [Activity],
        'PENDING' AS [ProcessStatus],
        pb.CheckPoints AS [ImportantCheckPoint],
        pb.CheckingMethod AS [MethodOfChecking],
        NULL AS [OperatorName],
        NULL AS [Issue],
        NULL AS [ActionDateTime],
        NULL AS [Action],
        'WAITING' AS [Result]
      FROM ProcessRouting pr
      INNER JOIN WorkCenter w ON w.StationCode = pr.StationCode
      LEFT JOIN ProductionProcess pb ON pb.ProcessCode = pr.ProcessCode
      CROSS JOIN ReworkData r
      WHERE pr.PSNo = @PSNo
        AND pr.SeqNo > r.SeqNo
        AND pr.StartedOn IS NULL
    )

    ------------------------------------------------------------
    -- FINAL TRACEABILITY OUTPUT
    ------------------------------------------------------------
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY CASE WHEN DateTime IS NULL THEN 1 ELSE 0 END, DateTime
      ) AS [Sr No],
      FORMAT(DateTime, 'dd-MMM-yyyy HH:mm:ss') AS [Date & Time],
      Activity,
      ProcessStatus,
      ImportantCheckPoint AS [Important check point],
      MethodOfChecking AS [Method of checking],
      OperatorName AS [Name of Operator],
      Issue,
      FORMAT(ActionDateTime, 'dd-MMM-yyyy HH:mm:ss') AS [Action Date & Time],
      Action,
      Result
    FROM
    (
      SELECT DateTime, Activity, ProcessStatus, ImportantCheckPoint, MethodOfChecking, OperatorName, Issue, ActionDateTime, Action, Result
      FROM ProductionData

      UNION ALL

      SELECT DateTime, Activity, ProcessStatus, ImportantCheckPoint, MethodOfChecking, OperatorName, Issue, ActionDateTime, Action, Result
      FROM ReworkData

      UNION ALL

      SELECT DateTime, Activity, ProcessStatus, ImportantCheckPoint, MethodOfChecking, OperatorName, Issue, ActionDateTime, Action, Result
      FROM PendingStages
    ) X;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "History Card data retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch History Card data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Functional Test
export const getFunctionalTest = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;

  if (!componentIdentifier) {
    throw new AppError("Component Identifier is required", 400);
  }

  const query = `
    DECLARE @ScanBarcode VARCHAR(50) = @componentIdentifier;

    ------------------------------------------------------------
    -- STEP 1 : Find PSNo
    ------------------------------------------------------------
    DECLARE @PSNo BIGINT;

    SELECT TOP 1 @PSNo = PSNo
    FROM ProcessStageLabel
    WHERE BarcodeNo = @ScanBarcode;

    ------------------------------------------------------------
    -- STEP 2 : Store all barcodes of same unit
    ------------------------------------------------------------
    DECLARE @Barcodes TABLE (BarcodeNo VARCHAR(50));

    INSERT INTO @Barcodes(BarcodeNo)
    SELECT BarcodeNo
    FROM ProcessStageLabel
    WHERE PSNo = @PSNo;

    ------------------------------------------------------------
    -- RESULT 1 : GAS CHARGE DETAILS
    ------------------------------------------------------------
    SELECT 
        'GAS_CHARGING' AS TestType,
        GC.*
    FROM GasChargeDtls GC
    WHERE GC.BARCODE IN (SELECT BarcodeNo FROM @Barcodes);

    ------------------------------------------------------------
    -- RESULT 2 : EST STAGING DETAILS
    ------------------------------------------------------------
    SELECT 
        'EST' AS TestType,
        EST.*
    FROM ESTStaging EST
    WHERE EST.serial_no IN (SELECT BarcodeNo FROM @Barcodes);

    ------------------------------------------------------------
    -- RESULT 3 : MFT STAGING DETAILS
    ------------------------------------------------------------
    SELECT 
        'MFT' AS TestType,
        MFT.*
    FROM MFTStaging MFT
    WHERE MFT.EQUIPMENT_NO IN (SELECT BarcodeNo FROM @Barcodes);
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier);

    const result = await request.query(query);

    // ─── 3 separate recordsets from 3 SELECT statements ─────
    const gasChargingData = result.recordsets[0] || [];
    const estData = result.recordsets[1] || [];
    const mftData = result.recordsets[2] || [];

    // ─── Summary ────────────────────────────────────────────
    const summary = {
      gasCharging: gasChargingData.length,
      est: estData.length,
      mft: mftData.length,
      total: gasChargingData.length + estData.length + mftData.length,
    };

    res.status(200).json({
      success: true,
      message: "Functional Test data retrieved successfully",
      data: {
        gasCharging: gasChargingData,
        est: estData,
        mft: mftData,
      },
      summary,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Functional Test data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
