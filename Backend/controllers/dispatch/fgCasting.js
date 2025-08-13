import sql, { dbConfig2 } from "../../config/db.js";

export const getDispatchMasterBySession = async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).send("Missing sessionId.");
  }

  try {
    const query = `
    SELECT * FROM DispatchMaster
    WHERE Session_Id = @SessionId
  `;

    const pool = await new sql.ConnectionPool(dbConfig2).connect();
    const result = await pool
      .request()
      .input("SessionId", sql.VarChar, sessionId)
      .query(query);

    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};