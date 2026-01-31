import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

/* ==============================
   Generate Visitor Pass
================================ */
export const generateVisitorPass = tryCatch(async (req, res, next) => {
  const { name, contactNo } = req.body;

  if (!name || !contactNo) {
    throw new AppError("Name and contact number are required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const existingVisitor = await pool
    .request()
    .input("ContactNo", sql.VarChar(20), contactNo)
    .query(`SELECT visitor_id FROM visitors WHERE contact_no = @ContactNo`);

  let visitorId;

  if (existingVisitor.recordset.length) {
    visitorId = existingVisitor.recordset[0].visitor_id;
  } else {
    const insertVisitor = await pool
      .request()
      .input("VisitorId", sql.VarChar(50), `WRLV${Date.now()}`)
      .input("Name", sql.NVarChar(255), name)
      .input("ContactNo", sql.VarChar(20), contactNo).query(`
        INSERT INTO visitors (visitor_id, name, contact_no)
        OUTPUT inserted.visitor_id
        VALUES (@VisitorId, @Name, @ContactNo)
      `);

    visitorId = insertVisitor.recordset[0].visitor_id;
  }

  if (!visitorId) {
    throw new AppError("Failed to create visitor", 500);
  }

  await pool.close();

  res.status(201).json({
    success: true,
    message: "Visitor pass generated successfully",
    data: { visitorId },
  });
});

/* ==============================
   Fetch Previous Pass
================================ */
export const fetchPreviousPass = tryCatch(async (req, res, next) => {
  const { contactNo } = req.query;

  if (!contactNo) {
    throw new AppError("Contact number is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const result = await pool
    .request()
    .input("ContactNo", sql.VarChar(20), contactNo)
    .query(`SELECT * FROM visitors WHERE contact_no = @ContactNo`);

  await pool.close();

  if (!result.recordset.length) {
    throw new AppError("No previous visitor found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Previous visitor fetched successfully",
    data: result.recordset[0],
  });
});

/* ==============================
   Get Visitor Pass Details
================================ */
export const getVisitorPassDetails = tryCatch(async (req, res, next) => {
  const { passId } = req.params;

  if (!passId) {
    throw new AppError("Pass ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const result = await pool.request().input("PassId", sql.VarChar(50), passId)
    .query(`
      SELECT vp.pass_id, vp.visitor_name, vp.visitor_contact_no
      FROM visitor_passes vp
      WHERE vp.pass_id = @PassId
    `);

  await pool.close();

  if (!result.recordset.length) {
    throw new AppError("Visitor pass not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Visitor pass details fetched successfully",
    data: result.recordset[0],
  });
});
