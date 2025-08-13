import sql, { dbConfig1 } from "../../config/db.js";

export const getAssetTagDetails = async (req, res) => {
  const { assemblyNumber } = req.query;

  if (!assemblyNumber) {
    return res.status(400).json({
      success: false,
      message: "Assembly Number is required.",
    });
  }

  const query = `
    SELECT 
      mb.Serial + '~' + mb.VSerial + '~' + m.Alias + '~' + mb.Serial2 AS combinedserial
    FROM 
      MaterialBarcode AS mb
    INNER JOIN 
      Material AS m ON m.MatCode = mb.Material
    WHERE 
      mb.Alias = @alias
  `;

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();

    const result = await pool
      .request()
      .input("alias", sql.VarChar, assemblyNumber)
      .query(query);

    const combined = result.recordset[0]?.combinedserial;

    if (!combined) {
      return res.status(404).json({
        success: false,
        message: "No data found for the provided alias.",
        FGNo: null,
        AssetNo: null,
        ModelName: null,
        Serial2: null,
      });
    }

    const [FGNo, AssetNo, ModelName, Serial2] = combined.split("~");

    res.status(200).json({
      success: true,
      FGNo,
      AssetNo,
      ModelName,
      Serial2,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const newAssetTagUpdate = async (req, res) => {
  const { assemblyNumber, fgSerialNumber, newAssetNumber } = req.body;

  if (!assemblyNumber || !fgSerialNumber || !newAssetNumber) {
    return res.status(400).send("All fields are required.");
  }

  const query = `
    update MaterialBarcode set VSerial=@newAssetNumber where Alias=@serial and Serial=@fgSerialNumber
  `;

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool
      .request()
      .input("serial", sql.NVarChar, assemblyNumber)
      .input("fgSerialNumber", sql.NVarChar, fgSerialNumber)
      .input("newAssetNumber", sql.NVarChar, newAssetNumber)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Asset Tag updated successfully.",
    });
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const newCustomerQrUpdate = async (req, res) => {
  const { assemblyNumber, fgSerialNumber, newCustomerQr } = req.body;

  if (!assemblyNumber || !fgSerialNumber || !newCustomerQr) {
    return res.status(400).send("All fields are required.");
  }

  const query = `
    update MaterialBarcode set Serial2=@newCustomerQr where Alias=@assemblyserial and Serial=@fgSerialNumber
  `;

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool
      .request()
      .input("assemblyserial", sql.NVarChar, assemblyNumber)
      .input("fgSerialNumber", sql.NVarChar, fgSerialNumber)
      .input("newCustomerQr", sql.NVarChar, newCustomerQr)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Customer QR updated successfully.",
    });
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};