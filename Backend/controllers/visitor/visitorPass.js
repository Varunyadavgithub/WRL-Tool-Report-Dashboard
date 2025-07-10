import sql, { dbConfig3 } from "../../config/db.js";

export const getEmployee = async (req, res) => {
  const { deptId } = req.query;

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    request.input("deptId", sql.Int, deptId);

    const result = await request.query(`
      SELECT 
        employee_id AS emp_id,
        name AS emp_name
      FROM users 
      WHERE department_id = @deptId
    `);

    res.status(200).json({
      success: true,
      data: result.recordset,
    });

    await pool.close();
  } catch (error) {
    console.error("Error fetching employee-department list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve employee and department information",
    });
  }
};

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
    specialInstruction,
    createdBy,
  } = req.body;

  if (!name || !contactNo || !email) {
    return res.status(400).json({
      success: false,
      message: "Name, Contact No, and Email are required",
    });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig3).connect();
    const visitorRequest = pool.request();

    // Handle Visitor Photo Upload (Optional)
    let photoPath = null;
    if (visitorPhoto) {
      // photoPath = await uploadVisitorPhoto(visitorPhoto);
      photoPath = visitorPhoto;
    }

    const generateVisitorId = (plantCode = 4) => {
      const now = new Date();

      const year = now.getFullYear().toString().slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      const visitorId = `WRLV${year}${month}${hours}${minutes}${seconds}`;
      return visitorId;
    };

    const uniqueVisitorId = generateVisitorId();

    // Insert visitor into `visitors` table and get inserted ID
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
      .input("VisitorPhoto", sql.NVarChar(sql.MAX), photoPath)
      .query(`
        INSERT INTO visitors (
          visitor_id,
          name,
          contact_no,
          email,
          company,
          nationality,
          identity_type,
          identity_no,
          address,
          country,
          state,
          city,
          vehicle_details,
          photo_url
        )
        OUTPUT inserted.visitor_id
        VALUES (
          @VisitorId,
          @Name,
          @ContactNo,
          @Email,
          @Company,
          @Nationality,
          @IdentityType,
          @IdentityNo,
          @Address,
          @Country,
          @State,
          @City,
          @VehicleDetails,
          @VisitorPhoto
        )
      `);

    const visitorId = insertVisitorResult.recordset[0].visitor_id;

    // Generate Unique Pass ID
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const uniquePassId = `WRLVP${year}${month}${hours}${minutes}${seconds}`;

    const query = `
      INSERT INTO visitor_passes (
        pass_id,
        visitor_id,
        visitor_photo,
        visitor_name,
        visitor_contact_no,
        visitor_email,
        department_to_visit,
        employee_to_visit,
        visit_type,
        no_of_people,
        allow_on,
        allow_till,
        special_instructions,
        created_by,
        company,
        nationality,
        identity_type,
        identity_no, 
        address,
        country,
        state,
        city,
        vehicle_details,
        status
      ) 
      VALUES (
        @PassId,
        @Visitor_id,
        @VisitorPhoto,
        @Name,
        @ContactNo,
        @Email,
        @DepartmentToVisit,
        @EmployeeToVisit,
        @VisitType,
        @NoOfPeople,
        @AllowOn,
        @AllowTill,
        @SpecialInstructions,
        @CreatedBy,
        @Company,
        @Nationality,
        @IdentityType,
        @IdentityNo,
        @Address,
        @Country,
        @State,
        @City,
        @VehicleDetails,
        @Status
      )
    `;

    // Prepare Visitor Pass Insert
    const passRequest = pool.request();

    passRequest.input("passId", sql.VarChar(50), uniquePassId);
    passRequest.input("Visitor_id", sql.VarChar(50), visitorId); // FK reference
    passRequest.input("VisitorPhoto", sql.NVarChar(sql.MAX), photoPath);
    passRequest.input("Name", sql.NVarChar(255), name);
    passRequest.input("ContactNo", sql.VarChar(20), contactNo);
    passRequest.input("Email", sql.VarChar(255), email);
    passRequest.input("DepartmentToVisit", sql.VarChar(100), departmentTo);
    passRequest.input("EmployeeToVisit", sql.VarChar(50), employeeTo || null);
    passRequest.input("VisitType", sql.VarChar(50), visitType);
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
    passRequest.input("Status", sql.Int, 0); // Active status

    const insertResult = await passRequest.query(query);

    await pool.close();
    // Send Response
    res.status(201).json({
      success: true,
      message: "Visitor pass generated successfully",
      data: {
        passId: uniquePassId,
        visitorName: name,
        allowOn: allowOn,
        departmentToVisit: departmentTo,
      },
    });
  } catch (error) {
    console.error("SQL Insert error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate visitor pass",
    });
  }
};

/**
 * Get Visitor Pass Details
 */
// export const getVisitorPassDetails = async (req, res) => {
//   try {
//     const { passId } = req.params;

//     const pool = await new sql.ConnectionPool(dbConfig3).connect();
//     const result = await pool
//       .request()
//       .input('PassId', sql.VarChar(50), passId)
//       .query(`
//         SELECT * FROM visitor_passes
//         WHERE unique_pass_id = @PassId
//       `);

//     await pool.close();

//     if (result.recordset.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Visitor pass not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: result.recordset[0]
//     });

//   } catch (error) {
//     logger.error("Get Visitor Pass Error", error);
//     res.status(500).json({
//       success: false,
//       message: "Error retrieving visitor pass"
//     });
//   }
// };

/**
 * Update Visitor Pass Status
 */
// export const updateVisitorPassStatus = async (req, res) => {
//   try {
//     const { passId } = req.params;
//     const { status } = req.body;

//     const pool = await new sql.ConnectionPool(dbConfig3).connect();
//     const result = await pool
//       .request()
//       .input('PassId', sql.VarChar(50), passId)
//       .input('Status', sql.Int, status)
//       .query(`
//         UPDATE visitor_passes
//         SET status = @Status
//         WHERE unique_pass_id = @PassId
//       `);

//     await pool.close();

//     res.status(200).json({
//       success: true,
//       message: "Visitor pass status updated successfully"
//     });

//   } catch (error) {
//     logger.error("Update Visitor Pass Status Error", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating visitor pass status"
//     });
//   }
// };
