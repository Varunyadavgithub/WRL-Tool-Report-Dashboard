import sql, { dbConfig3 } from "../../config/db.js";

// Departments
export const fetchDepartments = async (_, res) => {
  try {
    const query = `
        Select * from departments;
    `;

    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const result = await pool.request().query(query);
    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addDepartment = async (req, res) => {
  const { departmentName, departmentHeadId, deptCode } = req.body;

  // Basic validation
  if (!departmentName || !departmentHeadId || !deptCode) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (departmentName, departmentHeadId, deptCode) are required.",
    });
  }

  try {
    const query = `
      INSERT INTO departments (department_name, deptCode, department_head_id, created_at)
      VALUES (@department_name, @deptCode, @department_head_id, GETDATE())
    `;

    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    request.input("department_name", sql.NVarChar(100), departmentName);
    request.input("department_head_id", sql.Int, departmentHeadId);
    request.input("deptCode", sql.NVarChar(20), deptCode);

    await request.query(query);
    res
      .status(201)
      .json({ success: true, message: "Department added successfully." });

    await pool.close();
  } catch (error) {
    console.error("SQL Insert error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  const { deptCode } = req.params;
  const { departmentName, departmentHeadId } = req.body;

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();

    await pool
      .request()
      .input("deptCode", sql.VarChar, deptCode)
      .input("department_name", sql.VarChar, departmentName)
      .input("department_head_id", sql.Int, departmentHeadId).query(`
        UPDATE departments
        SET department_name = @department_name,
            department_head_id = @department_head_id
        WHERE deptCode = @deptCode
      `);

    res
      .status(200)
      .json({ success: true, message: "Department updated successfully." });
    await pool.close();
  } catch (error) {
    console.error("SQL update error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  const { deptCode } = req.params;

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();

    await pool
      .request()
      .input("deptCode", sql.VarChar, deptCode)
      .query("DELETE FROM departments WHERE deptCode = @deptCode");

    res
      .status(200)
      .json({ success: true, message: "Department deleted successfully." });
    await pool.close();
  } catch (error) {
    console.error("SQL delete error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Users
export const fetchUsers = async (_, res) => {
  try {
    const query = `
        Select * from users;
    `;

    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const result = await pool.request().query(query);
    const data = result.recordset;
    res.json({ success: true, data });
    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addUser = async (req, res) => {
  const {
    name,
    employeeId,
    employeeEmail,
    contactNumber,
    managerEmail,
    departmentId,
  } = req.body;

  // Validation
  if (
    !name ||
    !employeeId ||
    !employeeEmail ||
    !contactNumber ||
    !managerEmail ||
    !departmentId
  ) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (name, employeeId, employeeEmail, contactNumber, managerEmail, departmentId) are required.",
    });
  }

  try {
    const query = `
        INSERT INTO users (employee_id, department_id, contact_number, created_at, name, manager_email, employee_email)
        VALUES (@employeeId, @departmentId, @contactNumber, GETDATE(), @name, @managerEmail, @employeeEmail)
    `;

    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    request.input("employeeId", sql.NVarChar(50), employeeId);
    request.input("departmentId", sql.Int, departmentId);
    request.input("contactNumber", sql.NVarChar(20), contactNumber);
    request.input("name", sql.NVarChar(100), name);
    request.input("managerEmail", sql.NVarChar(100), managerEmail);
    request.input("employeeEmail", sql.NVarChar(100), employeeEmail);

    await request.query(query);
    res
      .status(201)
      .json({ success: true, message: "User added successfully." });

    await pool.close();
  } catch (error) {
    console.error("SQL Insert error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateUser = async (req, res) => {
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
    !name ||
    !employeeId ||
    !departmentId ||
    !contactNumber ||
    !employeeEmail ||
    !managerEmail
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required.",
    });
  }

  try {
    const pool = await sql.connect(dbConfig3);
    await pool
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

    res.json({ success: true, message: "User updated successfully." });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await sql.connect(dbConfig3);
    await pool
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM users WHERE id = @id`);

    res.json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};