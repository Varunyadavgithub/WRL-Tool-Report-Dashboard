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
  } = req.body;

  if (!name || !contactNo || !email) {
    return res.status(400).json({
      success: false,
      message: "Name, Contact No, and Email are required",
    });
  }

  try {
    const status = 1;
    const gate = 1;
    const passDate = new Date(new Date().getTime() + 330 * 60000); // Current date/time
    const passCode = 12324;
    const businessUnit = 1;

    const query = ``;

    const pool = await new sql.ConnectionPool(dbConfig1).connect();

    const request = await pool
      .request()
      .input("VisitorPhoto", sql.VarBinary, visitorPhoto || null)
      .input("Name", sql.NVarChar, name)
      .input("ContactNo", sql.NVarChar, contactNo)
      .input("Email", sql.NVarChar, email)
      .input("Company", sql.NVarChar, company || null)
      .input("NoOfPeople", sql.Int, noOfPeople || 1)
      .input("Nationality", sql.NVarChar, nationality || null)
      .input("IdentityType", sql.Int, identityType || null)
      .input("IdentityNo", sql.NVarChar, identityNo || null)
      .input("Address", sql.NVarChar, address || null)
      .input("Country", sql.NVarChar, country || null)
      .input("State", sql.NVarChar, state || null)
      .input("City", sql.NVarChar, city || null)
      .input("PostalCode", sql.Int, postalCode || null)
      .input("Vehicledetails", sql.NVarChar, vehicleDetails || null)
      .input("AllowOn", sql.DateTime, allowOn ? new Date(allowOn) : null)
      .input("AllowTill", sql.DateTime, allowTill ? new Date(allowTill) : null)
      .input("Department", sql.Int, departmentTo || null)
      .input("ContactEmployee", sql.Int, employeeTo || null)
      .input("VisitType", sql.NVarChar, visitType || null)
      .input("SpecialInstruction", sql.NVarChar, specialInstruction || null)

      .input("Status", sql.Int, status || null)
      .input("Gate", sql.Int, gate || null)
      .input("PassDate", sql.DateTime, passDate)
      .input("VisitorPassCode", sql.Int, passCode || null)
      .input("BusinessUnit", sql.Int, businessUnit || null);

    res.status(201).json({
      success: true,
      message: "Visitor pass generated successfully",
      visitorPassId: visitorPassId,
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
