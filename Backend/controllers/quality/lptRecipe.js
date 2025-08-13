import sql, { dbConfig1 } from "../../config/db.js";

export const getLptRecipe = async (req, res) => {
  const { modelName } = req.query;

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool.request();

    let query = "SELECT * FROM LPTRecipe";

    if (modelName) {
      query += " WHERE ModelName = @modelName";
      request.input("modelName", sql.VarChar, modelName);
    }

    const result = await request.query(query);

    res.status(200).json({ success: true, data: result.recordset });

    await pool.close();
  } catch (err) {
    console.error("Get Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteLptRecipe = async (req, res) => {
  const { modelName } = req.params;

  if (!modelName) {
    return res.status(400).json({ error: "ModelName is required" });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool.request().input("modelName", sql.VarChar, modelName);

    await request.query(`
      DELETE FROM LPTRecipe WHERE ModelName = @modelName
    `);

    res
      .status(200)
      .json({ success: true, message: "Recipe deleted successfully" });

    await pool.close();
  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const insertLptRecipe = async (req, res) => {
  const {
    matCode,
    modelName,
    minTemp,
    maxTemp,
    minCurr,
    maxCurr,
    minPow,
    maxPow,
  } = req.body;

  if (
    !matCode ||
    !modelName ||
    !minTemp ||
    !maxTemp ||
    !minCurr ||
    !maxCurr ||
    !minPow ||
    !maxPow
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("matcode", sql.VarChar, matCode)
      .input("modelName", sql.VarChar, modelName)
      .input("MinTemp", sql.VarChar, minTemp)
      .input("MaxTemp", sql.VarChar, maxTemp)
      .input("MinCurrent", sql.VarChar, minCurr)
      .input("MaxCurrent", sql.VarChar, maxCurr)
      .input("MinPower", sql.VarChar, minPow)
      .input("MaxPower", sql.VarChar, maxPow);

    await request.query(`
      INSERT INTO LPTRecipe (Matcode, ModelName, MinTemp, MaxTemp, MinCurrent, MaxCurrent, MinPower, MaxPower)
      VALUES (@matcode, @modelName, @MinTemp, @MaxTemp, @MinCurrent, @MaxCurrent, @MinPower, @MaxPower)
    `);

    res
      .status(201)
      .json({ success: true, message: "Recipe inserted successfully" });

    await pool.close();
  } catch (err) {
    console.error("Insert Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateLptRecipe = async (req, res) => {
  const { modelName } = req.params;
  const { minTemp, maxTemp, minCurr, maxCurr, minPow, maxPow } = req.body;

  if (!minTemp || !maxTemp || !minCurr || !maxCurr || !minPow || !maxPow) {
    return res.status(400).json({
      error: "All fields are required",
    });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("modelName", sql.VarChar, modelName)
      .input("MinTemp", sql.VarChar, minTemp)
      .input("MaxTemp", sql.VarChar, maxTemp)
      .input("MinCurrent", sql.VarChar, minCurr)
      .input("MaxCurrent", sql.VarChar, maxCurr)
      .input("MinPower", sql.VarChar, minPow)
      .input("MaxPower", sql.VarChar, maxPow);

    await request.query(`
  UPDATE LPTRecipe
  SET 
    MinTemp = @MinTemp,
    MaxTemp = @MaxTemp,
    MinCurrent = @MinCurrent,
    MaxCurrent = @MaxCurrent,
    MinPower = @MinPower,
    MaxPower = @MaxPower
  WHERE ModelName = @modelName
`);

    res
      .status(200)
      .json({ success: true, message: "Recipe updated successfully" });

    await pool.close();
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};