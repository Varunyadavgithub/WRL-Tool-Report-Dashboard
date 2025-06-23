import sql from "mssql";
import { dbConfig1 } from "../config/db.js";

// Fetches a list of active model variants from the Material table.
export const getModelVariants = async (_, res) => {
  try {
    const query = `
    SELECT Name AS MaterialName, MatCode 
    FROM Material 
    WHERE Category <> 0 AND model <> 0 AND type = 100 AND Status = 1;
  `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool.request().query(query);
    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Fetches a list of all work stages from the WorkCenter table.
export const getStageNames = async (_, res) => {
  try {
    const query = `
    SELECT Name, StationCode 
    FROM WorkCenter;
  `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool.request().query(query);
    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDepartments = async (_, res) => {
  try {
    const query = `
    SELECT  DeptCode, Name FROM Department;
  `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool.request().query(query);
    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
