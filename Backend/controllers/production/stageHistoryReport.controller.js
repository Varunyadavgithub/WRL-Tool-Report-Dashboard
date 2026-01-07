import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getCurrentStageStatus = tryCatch(async (req, res) => {
  const { serialNumber } = req.query;

  if (!serialNumber) {
    throw new AppError("Serial number is required", 400);
  }

  let query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
        FROM MaterialBarcode 
      WHERE Serial = @serialNumber OR Alias = @serialNumber
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
          A.ActivityOn DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("serialNumber", sql.NVarChar, serialNumber);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Current Stage Status retrieved successfully",
      data: result,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Current Stage Status data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const getLogisticStatus = tryCatch(async (req, res) => {
  const { serialNumber } = req.query;

  if (!serialNumber) {
    throw new AppError("Serial number is required", 400);
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
    WHERE FgserialNo = ''''' + REPLACE(@SerialNumber, '''', '''''') + '''''''
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
    WHERE dm.FGSerialNo = ''''' + REPLACE(@SerialNumber, '''', '''''') + '''''''
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
      AND b.Serial = @SerialNumber
)

--------------------------------------------------------
-- ✅ FINAL OUTPUT WITH ALL DETAILS
--------------------------------------------------------
SELECT
    -- ✅ FG LABEL PRINTING
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

    -- ✅ FG AUTO SCAN
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

    -- ✅ FG UNLOADING
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

    -- ✅ VEHICLE & DOCK DETAILS (NEW)
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
      .input("serialNumber", sql.NVarChar, serialNumber);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Logistic Status retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Logistic Stage Status data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
