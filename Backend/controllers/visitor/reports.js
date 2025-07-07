import sql, { dbConfig3 } from "../../config/db.js";

// Visitor
export const fetchVisitors = async (_, res) => {
  try {
    const query = `
        Select * from visitors;
    `;

    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const result = await pool.request().query(query);
    const data=result.recordset;
    res.json({success:true,data});
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
