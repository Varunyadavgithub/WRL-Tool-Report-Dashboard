import sql, { dbConfig1 } from "../../config/db.js";

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
    postalCode,
    vehicleDetails,
    allowOn,
    allowTill,
    departmentTo,
    employeeTo,
    visitType,
    specialInstruction,
    checkInTime,
    checkOutTime,
    createdBy,
  } = req.body;

  if (!name || !contactNo || !email) {
    return res.status(400).json({
      success: false,
      message: "Name, Contact No, and Email are required",
    });
  }

  try {
    const passDate = new Date();
    const pool = await new sql.ConnectionPool(dbConfig1).connect();

    // 🔍 Step 1: Resolve employeeTo (host name) to user ID
    const employeeResult = await pool
      .request()
      .input("EmployeeName", sql.VarChar(255), employeeTo).query(`
        SELECT TOP 1 id FROM users 
        WHERE first_name = @EmployeeName OR last_name = @EmployeeName
      `);

    if (employeeResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Host employee not found",
      });
    }

    const hostEmployeeId = employeeResult.recordset[0].id;

    // ✅ Step 2: Insert into visitor_passes with correct snapshot fields
    const insertQuery = `
      INSERT INTO visitor_passes (
        visitor_photo,
        visitor_name,
        visitor_contact_no,
        visitor_email,
        company,
        no_of_people,
        nationality,
        identity_type,
        identity_no,
        address,
        country,
        state,
        city,
        postal_code,
        vehicle_details,
        allow_on,
        allow_till,
        department_to_visit,
        host_employee_id,
        visit_type,
        special_instructions,
        created_by,
        created_at,
        checkInTime,
        checkOutTime,
        created_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @VisitorPhoto,
        @Name,
        @ContactNo,
        @Email,
        @Company,
        @NoOfPeople,
        @Nationality,
        @IdentityType,
        @IdentityNo,
        @Address,
        @Country,
        @State,
        @City,
        @PostalCode,
        @VehicleDetails,
        @AllowOn,
        @AllowTill,
        @DepartmentToVisit,
        @HostEmployeeId,
        @VisitType,
        @SpecialInstruction,
        @CreatedBy,
        @CreatedAt
        @checkInTime,
        @checkOutTime
      );
    `;

    const request = pool
      .request()
      .input("VisitorPhoto", sql.NVarChar(sql.MAX), visitorPhoto || null)
      .input("Name", sql.NVarChar(255), name)
      .input("ContactNo", sql.VarChar(20), contactNo)
      .input("Email", sql.VarChar(255), email)
      .input("Company", sql.VarChar(255), company || null)
      .input("NoOfPeople", sql.Int, noOfPeople || 1)
      .input("Nationality", sql.VarChar(100), nationality || null)
      .input("IdentityType", sql.VarChar(50), identityType || null)
      .input("IdentityNo", sql.VarChar(100), identityNo || null)
      .input("Address", sql.NVarChar(sql.MAX), address || null)
      .input("Country", sql.VarChar(100), country || null)
      .input("State", sql.VarChar(100), state || null)
      .input("City", sql.VarChar(100), city || null)
      .input("PostalCode", sql.VarChar(20), postalCode || null)
      .input("VehicleDetails", sql.VarChar(100), vehicleDetails || null)
      .input("AllowOn", sql.Date, allowOn ? new Date(allowOn) : null)
      .input("AllowTill", sql.Date, allowTill ? new Date(allowTill) : null)
      .input("DepartmentToVisit", sql.VarChar(100), departmentTo || null)
      .input("HostEmployeeId", sql.Int, hostEmployeeId)
      .input("VisitType", sql.VarChar(50), visitType || null)
      .input(
        "SpecialInstruction",
        sql.NVarChar(sql.MAX),
        specialInstruction || null
      )
      .input("CreatedBy", sql.Int, createdBy)
      .input("CreatedAt", sql.DateTime, passDate)
      .input("checkInTime", sql.DateTime, checkInTime)
      .input("checkOutTime", sql.DateTime, checkOutTime);

    const result = await request.query(insertQuery);
    const visitorPassId = result.recordset[0].id;

    res.status(201).json({
      success: true,
      message: "Visitor pass generated successfully",
      visitorPassId,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate visitor pass",
      error: err.message,
    });
  }
};
