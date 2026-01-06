import sql from "mssql";
import { dbConfig1 } from "../config/db.js";
import { tryCatch } from "../config/tryCatch.js";
import { AppError } from "../utils/AppError.js";

// Fetches a list of active model variants from the **Material** table.
export const getModelVariants = tryCatch(async (_, res) => {
  const query = `
    Select Name as MaterialName, MatCode 
    From Material 
    Where Category <> 0 AND model <> 0 AND type = 100 AND Status = 1;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Model variants fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError("Failed to fetch model variants", 500);
  } finally {
    await pool.close();
  }
});

// Fetches a list of component types from the **MaterialCategory** table.
export const getCompType = tryCatch(async (_, res) => {
  const query = `
    Select CategoryCode, Name 
    From MaterialCategory 
    Where CategoryType = 200;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Component types fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError("Failed to fetch component types", 500);
  } finally {
    await pool.close();
  }
});

// Fetches a list of all work stages from the **WorkCenter** table.
export const getStageNames = tryCatch(async (_, res) => {
  const query = `
    Select Name, StationCode 
    From WorkCenter;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Stage names fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError("Failed to fetch stage names", 500);
  } finally {
    await pool.close();
  }
});

// Fetches a list of all departments from the **Department** table.
export const getDepartments = tryCatch(async (_, res) => {
  const query = `
    Select DeptCode, Name 
    From Department;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Departments fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError("Failed to fetch departments", 500);
  } finally {
    await pool.close();
  }
});
