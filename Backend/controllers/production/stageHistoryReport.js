import sql, { dbConfig1, dbConfig2 } from "../../config/db.js";

export const getCurrentStageStatus = async (req, res) => {
  const { serialNumber } = req.query;

  if (!serialNumber) {
    return res.status(400).json({
      success: false,
      message: "Serial number is required",
    });
  }
  try {
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
    C.Type AS ActivityTypeName
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
ORDER BY 
    A.ActivityOn DESC;
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("serialNumber", sql.NVarChar, serialNumber);

    const result = await request.query(query);
    res.status(200).json({
      success: true,
      result,
    });
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getLogisticStatus = async (req, res) => {
  const { serialNumber } = req.query;

  if (!serialNumber) {
    return res.status(400).json({
      success: false,
      message: "Serial number is required",
    });
  }
  try {
    let query = `
      Select du.DateTime [Dispt_Unload_time], dm.Session_ID, dm.AddedOn [Dispatch_time], td.Vehicle_No, td.DockNo, td.LatestStatus  
      from DispatchUnloading du
      left join DispatchMaster dm on dm.FGSerialNo = du.FGSerialNo
      left join Tracking_Document td on td.Session_ID = dm.Session_ID
      where du.FGSerialNo = @serialNumber
    `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const request = pool
      .request()
      .input("serialNumber", sql.NVarChar, serialNumber);

    const result = await request.query(query);
    res.status(200).json({
      success: true,
      result,
    });
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
