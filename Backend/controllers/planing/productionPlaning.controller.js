import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const getModelName = tryCatch(async (req, res) => {
  const { plan } = req.query;

  if (!plan || !["assembly", "fg"].includes(plan)) {
    throw new AppError("Invalid plan type.", 400);
  }

  let query;
  if (plan === "assembly") {
    query = `
        SELECT Alias, matCode 
        FROM Material 
        WHERE type = 400 AND (Alias LIKE 'S %' OR Alias LIKE '% S')
      `;
  } else {
    query = `
        SELECT Alias, matCode 
        FROM Material 
        WHERE type = 100
      `;
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Model Name data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch Model Name data:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

export const getPlanMonth = tryCatch(async (_, res) => {
  const query = `
    Select DISTINCT(PlanMonthYear) 
    from "PlanOrderPrint"
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Plan month data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch plan month data:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

export const productionPlaningData = tryCatch(async (req, res) => {
  const { planType, planMonthYear, matcode } = req.query;

  // Only planType and planMonthYear are required
  if (!planType || !planMonthYear) {
    throw new AppError(
      "Missing required query parameters: planType and planMonthYear.",
      400
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool.request();

    request.input("planType", sql.VarChar, planType);
    request.input("planMonthYear", sql.Int, planMonthYear);

    if (matcode && matcode != 0) {
      request.input("matcode", sql.Int, matcode);
    }

    const query = `
      SELECT 
        PlanNo, PlanMonthYear, m.Alias, PlanQty, PrintLbl, PlanType, Remark, 
        u.username, CreatedOn 
      FROM PlanOrderPrint AS pop
      JOIN material m ON m.matcode = pop.PlanMaterial
      JOIN users u ON u.userCode = pop.CreatedBy
      WHERE planType = @planType AND PlanMonthYear = @planMonthYear
      ${matcode && matcode != 0 ? "AND pop.PlanMaterial = @matcode" : ""}
      order by PrintLbl desc
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Production planing data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Production planing data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const updateProductionPlaningData = tryCatch(async (req, res) => {
  const { planQty, userCode, remark, matcode, planMonthYear, planType } =
    req.body;

  if (
    !planQty ||
    !userCode ||
    !remark ||
    !matcode ||
    !planMonthYear ||
    !planType
  ) {
    throw new AppError(
      "Missing required query parameters: planQty, userCode, remark, matcode, planMonthYear and planType.",
      400
    );
  }

  const query = `
      UPDATE PlanOrderPrint 
      SET PlanQty = @planQty, CreatedBy=@userCode, Remark = @remark 
      WHERE PlanMaterial = @matcode AND PlanMonthYear = @planMonthYear AND PlanType = @planType;
    `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("planQty", sql.NVarChar, planQty)
      .input("userCode", sql.Int, userCode)
      .input("remark", sql.NVarChar, remark)
      .input("matcode", sql.NVarChar, matcode)
      .input("planMonthYear", sql.NVarChar, planMonthYear)
      .input("planType", sql.NVarChar, planType)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Production Planing Data updated successfully.",
      data: result.rowsAffected,
    });
  } catch (error) {
    throw new AppError(
      `Failed to update the production planing data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const addProductionPlaningData = tryCatch(async (req, res) => {
  const { planQty, userCode, remark, matcode, planMonthYear, planType } =
    req.body;

  if (!planQty || !userCode || !matcode || !planMonthYear || !planType) {
    throw new AppError(
      "Missing required query parameters: planQty, userCode, matcode, planMonthYear and planType.",
      400
    );
  }

  const planNo = 453454;
  const currentDateTime = new Date(new Date().getTime() + 330 * 60000);
  const status = 0;

  const query = `
      INSERT INTO PlanOrderPrint 
        (PlanNo, PlanMonthYear, PlanMaterial, PlanQty, PlanType, Remark, CreatedBy, CreatedOn, Status)
      VALUES
        (@planNo, @planMonthYear, @planMaterial, @planQty, @planType, @remark, @createdBy, @createdOn, @status);
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("planNo", sql.Int, planNo)
      .input("planMonthYear", sql.Int, planMonthYear)
      .input("planMaterial", sql.Int, matcode)
      .input("planQty", sql.Int, planQty)
      .input("planType", sql.NVarChar, planType)
      .input("remark", sql.NVarChar, remark)
      .input("createdBy", sql.Int, userCode)
      .input("createdOn", sql.DateTime, currentDateTime)
      .input("status", sql.Int, status)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Production Planing Data added successfully",
      data: result.rowsAffected,
    });
  } catch (error) {
    throw new AppError(
      `Failed to add the production planing data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
