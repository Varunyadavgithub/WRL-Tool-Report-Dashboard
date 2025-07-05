import sql, { dbConfig1 } from "../../config/db.js";

// {
// visitorPhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD…GGkg78ZEiDSEJc2ZJhVSVppSrtADJTtjCvIH+dJNLstKno//Z',
// name: 'Varun Yadav',
// contactNo: '9106547391',
// email: 'varun@gmail.com',
// company: 'WRL',
// noOfPeople: 1
// nationality: "Indian"
// identityType: "adhaar_card"
// identityNo: "56462658458"
// address: "Valsad Gujarat"
// country:"India"
// state:"Gujarat"
// city: "ahmedabad"
// postalCode : "214563"
// vehicleDetails: "GJ152534"
// allowOn: "2025-07-03"
// allowTill: "2025-07-07"
// departmentTo: "MFG"
// employeeTo: "Vikash"
// visitType: "tourism"
// specialInstruction: "Developer"
// }

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
  } = req.body;

  console.log("Req:", req.body);

  if (!name || !contactNo || !email) {
    return res.status(400).json({
      success: false,
      message: "Name, Contact No, and Email are required",
    });
  }

  try {
    const passDate = new Date(); // creation timestamp

    const query = `
      INSERT INTO visitor_passes (
        visitor_photo,
        name,
        contact_no,
        email,
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
        department_to,
        employee_to,
        visit_type,
        special_instruction,
        created_at
      )
      OUTPUT INSERTED.pass_id
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
        @DepartmentTo,
        @EmployeeTo,
        @VisitType,
        @SpecialInstruction,
        @CreatedAt
      );
    `;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();

    const request = pool
      .request()
      .input("VisitorPhoto", sql.NVarChar(sql.MAX), visitorPhoto || null) // store as base64 string
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
      .input("DepartmentTo", sql.VarChar(100), departmentTo || null)
      .input("EmployeeTo", sql.VarChar(255), employeeTo || null)
      .input("VisitType", sql.VarChar(50), visitType || null)
      .input(
        "SpecialInstruction",
        sql.NVarChar(sql.MAX),
        specialInstruction || null
      )
      .input("CreatedAt", sql.DateTime, passDate);

    const result = await request.query(query);
    const visitorPassId = result.recordset[0].pass_id;

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
