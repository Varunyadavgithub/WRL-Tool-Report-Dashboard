import sql, { dbConfig1, dbConfig2 } from "../../config/db.js";

export const getModelName = async (req, res) => {
  const { modelCode } = req.query;

  try {
    const query = `
    select name from material where AltName=@modelCode;
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool
      .request()
      .input("modelCode", sql.NVarChar, modelCode)
      .query(query);

    // If no record is found, return null
    if (result.recordset.length === 0) {
      return "~";
    }

    res.json(result.recordset[0].name);
    await pool.close();
  } catch (err) {
    console.error("Error fetching model name:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const modelNameUpdate = async (req, res) => {
  const { fgSerial, modelName } = req.body;

  if (!fgSerial) {
    return res.status(400).json({
      success: false,
      message: "Fg Serial number is required",
    });
  }

  try {
    const query = `Update DispatchUnloading set ModelName=@modelName where FGSerialNo=@fgSerial`;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("modelName", sql.NVarChar, modelName)
      .input("fgSerial", sql.NVarChar, fgSerial)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.rowsAffected[0],
    });
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};