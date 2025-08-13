import sql, { dbConfig1 } from "../../config/db.js";

export const getLptReport = async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  try {
    const isStart = new Date(new Date(startDate).getTime() + 330 * 60000);
    const isEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

    let query = `
      SELECT * 
      FROM LPTReport 
      WHERE DateTime BETWEEN @startDate AND @endDate
    `;

    if (model) {
      query += " AND Model=@model";
    }

    query += " ORDER BY DateTime DESC";

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = await pool
      .request()
      .input("startDate", sql.DateTime, isStart)
      .input("endDate", sql.DateTime, isEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);
    res.json(result.recordset);

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};