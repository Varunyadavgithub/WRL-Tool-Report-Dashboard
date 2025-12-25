import sql, { dbConfig3 } from "../../config/db.js";

// Get Departments
export const fetchDepartments = async (req, res) => {
  const { empId } = req.query;
  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    request.input("empId", sql.VarChar(50), empId);

    const result = await request.query(`
      SELECT 
        u.name, 
        dpt.department_name,
        dpt.deptCode
      FROM users AS u
      INNER JOIN departments dpt ON u.department_id = dpt.deptCode
      WHERE employee_id = @empId
    `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });

    await pool.close();
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Employee by Department
export const getEmployee = async (_, res) => {
  try {
    const query = `Select u.name, u.employee_id, dpt.department_name, dpt.deptCode from users as u
inner join departments  dpt on u.department_id = dpt.deptCode;
    `;

    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const result = await pool.request().query(query);
    res.json(result.recordset);
    await pool.close();
  } catch (error) {
    console.error("Error fetching employee list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve employee information",
    });
  }
};

// Generate Visitor Pass with Phone Number Check
export const generateVisitorPass = async (req, res) => {
  const {
    visitorPhoto,
    name,
    contactNo,
    email,
    company,
    noOfPeople,
    nationality,
    identityType,
    identityNo,
    address,
    country,
    state,
    city,
    vehicleDetails,
    allowOn,
    allowTill,
    departmentTo,
    employeeTo,
    visitType,
    token,
    specialInstruction,
    purposeOfVisit,
    createdBy,
  } = req.body;

  if (!name || !contactNo) {
    return res.status(400).json({
      success: false,
      message: "Name, Contact No, and Email are required",
    });
  }

  try {
    // Handle Visitor Photo Upload (Optional)
    let photoPath = null;
    if (visitorPhoto) {
      photoPath = visitorPhoto;
    }
    const pool = await new sql.ConnectionPool(dbConfig3).connect();

    // Check for existing visitor by contact number
    const checkRequest = pool.request();
    const existingPassResult = await checkRequest
      .input("ContactNo", sql.VarChar(20), contactNo)
      .query(`SELECT visitor_id FROM visitors WHERE contact_no = @ContactNo`);

    let visitorId;

    if (existingPassResult.recordset.length > 0) {
      // ? Visitor already exists: reuse their ID
      visitorId = existingPassResult.recordset[0].visitor_id;
    } else {
      // ? Visitor does not exist: insert new visitor
      const visitorRequest = pool.request();

      const generateVisitorId = () => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        return `WRLV${year}${month}${hours}${minutes}${seconds}`;
      };

      const uniqueVisitorId = generateVisitorId();

      const insertVisitorResult = await visitorRequest
        .input("VisitorId", sql.VarChar(50), uniqueVisitorId)
        .input("Name", sql.NVarChar(255), name)
        .input("ContactNo", sql.VarChar(20), contactNo)
        .input("Email", sql.VarChar(255), email)
        .input("Company", sql.VarChar(255), company || null)
        .input("Nationality", sql.VarChar(100), nationality || null)
        .input("IdentityType", sql.VarChar(50), identityType || null)
        .input("IdentityNo", sql.VarChar(100), identityNo || null)
        .input("Address", sql.NVarChar(sql.MAX), address || null)
        .input("Country", sql.VarChar(100), country)
        .input("State", sql.VarChar(100), state)
        .input("City", sql.VarChar(100), city)
        .input("VehicleDetails", sql.VarChar(100), vehicleDetails)
        .input("VisitorPhoto", sql.NVarChar(sql.MAX), photoPath).query(`
          INSERT INTO visitors (
            visitor_id, name, contact_no, email, company, nationality,
            identity_type, identity_no, address, country, state, city,
            vehicle_details, photo_url
          )
          OUTPUT inserted.visitor_id
          VALUES (
            @VisitorId, @Name, @ContactNo, @Email, @Company, @Nationality,
            @IdentityType, @IdentityNo, @Address, @Country, @State, @City,
            @VehicleDetails, @VisitorPhoto
          )
        `);

      visitorId = insertVisitorResult.recordset[0].visitor_id;
    }

    // ? Create the visitor pass using the correct visitor ID
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const uniquePassId = `WRLVP${year}${month}${hours}${minutes}${seconds}`;

    const passRequest = pool.request();

    passRequest.input("PassId", sql.VarChar(50), uniquePassId);
    passRequest.input("Visitor_id", sql.VarChar(50), visitorId);
    passRequest.input(
      "VisitorPhoto",
      sql.NVarChar(sql.MAX),
      visitorPhoto || null
    );
    passRequest.input("Name", sql.NVarChar(255), name);
    passRequest.input("ContactNo", sql.VarChar(20), contactNo);
    passRequest.input("Email", sql.VarChar(255), email);
    passRequest.input("DepartmentToVisit", sql.VarChar(100), departmentTo);
    passRequest.input("EmployeeToVisit", sql.VarChar(50), employeeTo || null);
    passRequest.input("VisitType", sql.VarChar(50), visitType);
    passRequest.input("Token", sql.VarChar(50), token);
    passRequest.input("NoOfPeople", sql.Int, noOfPeople || 1);
    passRequest.input(
      "AllowOn",
      sql.DateTime,
      allowOn ? new Date(allowOn) : new Date()
    );
    passRequest.input(
      "AllowTill",
      sql.DateTime,
      allowTill ? new Date(allowTill) : null
    );
    passRequest.input(
      "SpecialInstructions",
      sql.NVarChar(sql.MAX),
      specialInstruction
    );
    passRequest.input("PurposeOfVisit", sql.VarChar(50), purposeOfVisit);
    passRequest.input("CreatedBy", sql.VarChar(50), createdBy || null);
    passRequest.input("Company", sql.VarChar(255), company);
    passRequest.input("Nationality", sql.VarChar(100), nationality);
    passRequest.input("IdentityType", sql.VarChar(50), identityType);
    passRequest.input("IdentityNo", sql.VarChar(100), identityNo);
    passRequest.input("Address", sql.NVarChar(sql.MAX), address);
    passRequest.input("Country", sql.VarChar(100), country);
    passRequest.input("State", sql.VarChar(100), state);
    passRequest.input("City", sql.VarChar(100), city);
    passRequest.input("VehicleDetails", sql.VarChar(100), vehicleDetails);
    passRequest.input("Status", sql.Int, 1);

    await passRequest.query(`
      INSERT INTO visitor_passes (
        pass_id, visitor_id, visitor_photo, visitor_name, visitor_contact_no,
        visitor_email, department_to_visit, employee_to_visit, visit_type,
        token, no_of_people, allow_on, allow_till, special_instructions,
        purpose_of_visit, created_by, company, nationality, identity_type,
        identity_no, address, country, state, city, vehicle_details, status
      )
      VALUES (
        @PassId, @Visitor_id, @VisitorPhoto, @Name, @ContactNo, @Email,
        @DepartmentToVisit, @EmployeeToVisit, @VisitType, @Token, @NoOfPeople,
        @AllowOn, @AllowTill, @SpecialInstructions, @PurposeOfVisit, @CreatedBy,
        @Company, @Nationality, @IdentityType, @IdentityNo, @Address, @Country,
        @State, @City, @VehicleDetails, @Status
      )
    `);

     await pool.close();

    res.status(201).json({
      success: true,
      message: "Visitor pass generated successfully",
      data: {
        passId: uniquePassId,
        visitorId,
        name,
        departmentToVisit: departmentTo,
      },
    });
  } catch (error) {
    console.error("Error generating visitor pass:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate visitor pass",
    });
  }
};

// Fetch Previous Pass
export const fetchPreviousPass = async (req, res) => {
  const { contactNo } = req.query;

  if (!contactNo) {
    return res.status(400).json({
      success: false,
      message: "Contact number is required",
    });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    // Query to fetch the most recent visitor pass for the given contact number
    const query = `
      SELECT * FROM visitors WHERE contact_no = @ContactNo
    `;

    const result = await request
      .input("ContactNo", sql.VarChar(20), contactNo)
      .query(query);

    await pool.close();

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No previous visitor pass found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("Fetch Previous Pass Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch previous visitor pass",
    });
  }
};

export const getVisitorPassDetails = async (req, res) => {
  const { passId } = req.params;

  if (!passId) {
    return res.status(400).json({
      success: false,
      message: "Pass ID is required",
    });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    const query = `
      SELECT 
        vp.pass_id,
        vp.visitor_name,
        vp.visitor_contact_no,
        vp.visitor_email,
        vp.visitor_photo,
        v.company,
        v.address,
        v.city,
        v.state,
        d.department_name,
        u.name AS employee_name,
        vp.allow_on,
        vp.allow_till,
        vp.purpose_of_visit,
        vp.company,
        vp.no_of_people,
        d.department_name,
        u.name AS employee_name,
        vp.purpose_of_visit
      FROM 
        visitor_passes vp
      INNER JOIN
        visitors v ON v.visitor_id = vp.visitor_id
      LEFT JOIN 
        departments d ON vp.department_to_visit = d.deptCode
      LEFT JOIN 
        users u ON vp.employee_to_visit = u.employee_id
      WHERE 
        vp.pass_id = @PassId
    `;

    const result = await request
      .input("PassId", sql.VarChar(50), passId)
      .query(query);
    await pool.close();

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Visitor pass not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("Fetch Visitor Pass Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visitor pass details",
    });
  }
};