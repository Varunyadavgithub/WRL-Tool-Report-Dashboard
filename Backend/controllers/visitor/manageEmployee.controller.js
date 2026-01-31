import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

/* ==============================
   Departments
================================ */

/* Get all departments */
export const fetchDepartments = tryCatch(async (_, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool.request().query(`
    SELECT * FROM departments
  `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Departments fetched successfully",
    data: result.recordset,
  });
});

/* Add department */
export const addDepartment = tryCatch(async (req, res) => {
  const { departmentName, departmentHeadId, deptCode } = req.body;

  if (!departmentName || !departmentHeadId || !deptCode) {
    throw new AppError(
      "departmentName, departmentHeadId and deptCode are required",
      400,
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  await pool
    .request()
    .input("department_name", sql.NVarChar(100), departmentName)
    .input("department_head_id", sql.Int, departmentHeadId)
    .input("deptCode", sql.NVarChar(20), deptCode).query(`
      INSERT INTO departments (
        department_name, deptCode, department_head_id, created_at
      )
      VALUES (@department_name, @deptCode, @department_head_id, GETDATE())
    `);

  await pool.close();

  res.status(201).json({
    success: true,
    message: "Department added successfully",
  });
});

/* Update department */
export const updateDepartment = tryCatch(async (req, res) => {
  const { deptCode } = req.params;
  const { departmentName, departmentHeadId } = req.body;

  if (!deptCode) {
    throw new AppError("Department code is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .input("deptCode", sql.VarChar(20), deptCode)
    .input("department_name", sql.NVarChar(100), departmentName)
    .input("department_head_id", sql.Int, departmentHeadId).query(`
      UPDATE departments
      SET department_name = @department_name,
          department_head_id = @department_head_id
      WHERE deptCode = @deptCode
    `);

  await pool.close();

  if (result.rowsAffected[0] === 0) {
    throw new AppError("Department not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Department updated successfully",
  });
});

/* Delete department */
export const deleteDepartment = tryCatch(async (req, res) => {
  const { deptCode } = req.params;

  if (!deptCode) {
    throw new AppError("Department code is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .input("deptCode", sql.VarChar(20), deptCode)
    .query(`DELETE FROM departments WHERE deptCode = @deptCode`);

  await pool.close();

  if (result.rowsAffected[0] === 0) {
    throw new AppError("Department not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Department deleted successfully",
  });
});

/* ==============================
   Users
================================ */

/* Get all users */
export const fetchUsers = tryCatch(async (_, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool.request().query(`
    SELECT * FROM users
  `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: result.recordset,
  });
});

/* Add user */
export const addUser = tryCatch(async (req, res) => {
  const {
    name,
    employeeId,
    employeeEmail,
    contactNumber,
    managerEmail,
    departmentId,
  } = req.body;

  if (
    !name ||
    !employeeId ||
    !employeeEmail ||
    !contactNumber ||
    !managerEmail ||
    !departmentId
  ) {
    throw new AppError("All user fields are required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  await pool
    .request()
    .input("employeeId", sql.NVarChar(50), employeeId)
    .input("departmentId", sql.Int, departmentId)
    .input("contactNumber", sql.NVarChar(20), contactNumber)
    .input("name", sql.NVarChar(100), name)
    .input("managerEmail", sql.NVarChar(100), managerEmail)
    .input("employeeEmail", sql.NVarChar(100), employeeEmail).query(`
      INSERT INTO users (
        employee_id, department_id, contact_number,
        created_at, name, manager_email, employee_email
      )
      VALUES (
        @employeeId, @departmentId, @contactNumber,
        GETDATE(), @name, @managerEmail, @employeeEmail
      )
    `);

  await pool.close();

  res.status(201).json({
    success: true,
    message: "User added successfully",
  });
});

/* Update user */
export const updateUser = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    employeeId,
    departmentId,
    contactNumber,
    employeeEmail,
    managerEmail,
  } = req.body;

  if (
    !id ||
    !name ||
    !employeeId ||
    !departmentId ||
    !contactNumber ||
    !employeeEmail ||
    !managerEmail
  ) {
    throw new AppError("All fields are required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar(100), name)
    .input("employee_id", sql.NVarChar(50), employeeId)
    .input("department_id", sql.Int, departmentId)
    .input("contact_number", sql.NVarChar(20), contactNumber)
    .input("employee_email", sql.NVarChar(100), employeeEmail)
    .input("manager_email", sql.NVarChar(100), managerEmail).query(`
      UPDATE users
      SET name = @name,
          employee_id = @employee_id,
          department_id = @department_id,
          contact_number = @contact_number,
          employee_email = @employee_email,
          manager_email = @manager_email
      WHERE id = @id
    `);

  await pool.close();

  if (result.rowsAffected[0] === 0) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "User updated successfully",
  });
});

/* Delete user */
export const deleteUser = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("User ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`DELETE FROM users WHERE id = @id`);

  await pool.close();

  if (result.rowsAffected[0] === 0) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});
