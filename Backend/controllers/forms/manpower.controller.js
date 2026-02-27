import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateManpowerPDF } from "../../services/pdf.service.js";
import { sendManpowerApprovalMail } from "../../emailTemplates/FormsApproval_System/manpowerApproval.templete.js";

export const createManpowerRequest = tryCatch(async (req, res) => {
  const data = req.body;
  const pool = await sql.connect(dbConfig3);

  const requestCode = `WRL-MPR-${Date.now()}`;

  const requiredDate = data.requiredDate ? new Date(data.requiredDate) : null;

  if (!requiredDate) {
    throw new AppError("Required Date is mandatory", 400);
  }

  await pool
    .request()
    .input("RequestCode", sql.VarChar, requestCode)
    .input("DepartmentName", sql.VarChar, data.departmentName)
    .input("RequiredDate", sql.DateTime, requiredDate)
    .input("HODStatus", sql.VarChar, "Pending")
    .input("HRStatus", sql.VarChar, "Pending")
    .input("PlantHeadStatus", sql.VarChar, "Pending")
    .input("Status", sql.VarChar, "Pending HOD Approval").query(`
    INSERT INTO ManpowerRequests
    (RequestCode, DepartmentName, RequiredDate,
     HODStatus, HRStatus, PlantHeadStatus, Status)
    VALUES
    (@RequestCode, @DepartmentName, @RequiredDate,
     @HODStatus, @HRStatus, @PlantHeadStatus, @Status)
  `);

  // ✅ Send Email to HOD
  await sendManpowerApprovalMail({
    to: data.hodEmail,
    requestCode,
    departmentName: data.departmentName,
    requiredDate: data.requiredDate,

    approvedDET: data.approvedDET || 0,
    approvedITI: data.approvedITI || 0,
    approvedCASUAL: data.approvedCASUAL || 0,

    actualDET: data.actualDET || 0,
    actualITI: data.actualITI || 0,
    actualCASUAL: data.actualCASUAL || 0,

    additionalDET: data.additionalDET || 0,
    additionalITI: data.additionalITI || 0,
    additionalCASUAL: data.additionalCASUAL || 0,

    overtimeFrom: data.overtimeFrom || "-",
    overtimeTo: data.overtimeTo || "-",
    overtimeTotal: data.overtimeTotal || 0,

    responsibleStaff: data.responsibleStaff || "-",
    justification: data.justification || "-",

    employees: data.employees || [],

    role: "HOD",
  });

  // ✅ Generate PDF
  generateManpowerPDF(res, data);
});

export const approveManpowerRequest = tryCatch(async (req, res) => {
  const { requestId, role, remark } = req.body;
  const pool = await sql.connect(dbConfig3);

  const record = await pool
    .request()
    .input("Id", sql.Int, requestId)
    .query("SELECT * FROM ManpowerRequests WHERE Id=@Id");

  if (!record.recordset.length) throw new AppError("Request not found", 404);

  const request = record.recordset[0];
  const now = new Date();
  const hour = now.getHours();

  // ---------------- HOD APPROVAL ----------------
  if (role === "HOD") {
    await pool
      .request()
      .input("Id", sql.Int, requestId)
      .input("remark", sql.NVarChar, remark || "").query(`
        UPDATE ManpowerRequests
        SET HODStatus='Approved',
            HODRemark=@remark,
            Status='Pending HR & Plant Head'
        WHERE Id=@Id
      `);

    // Send Email to HR
    await sendManpowerApprovalMail({
      to: process.env.HR_EMAIL,
      requestCode: request.RequestCode,
      departmentName: request.DepartmentName,
      requiredDate: request.RequiredDate,
      totalManpower: request.ApprovedTotal || 0,
      role: "HR",
    });

    // Send Email to Plant Head
    await sendManpowerApprovalMail({
      to: process.env.PLANT_HEAD_EMAIL,
      requestCode: request.RequestCode,
      departmentName: request.DepartmentName,
      requiredDate: request.RequiredDate,
      totalManpower: request.ApprovedTotal || 0,
      role: "PlantHead",
    });
  }

  // ---------------- PLANT HEAD APPROVAL ----------------
  if (role === "PlantHead") {
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 18) {
      return res.status(400).json({
        success: false,
        message:
          "Plant Head approval not allowed after 6 PM. HR approval required.",
      });
    }

    await pool
      .request()
      .input("Id", sql.Int, requestId)
      .input("remark", sql.NVarChar, remark || "").query(`
      UPDATE ManpowerRequests
      SET PlantHeadStatus = 'Approved',
          PlantHeadRemark = @remark,
          Status = 'Final Approved',
          SecuritySent = 1
      WHERE Id = @Id
    `);

    return res.json({ success: true });
  }

  // ---------------- HR APPROVAL ----------------
  if (role === "HR") {
    await pool
      .request()
      .input("Id", sql.Int, requestId)
      .input("remark", sql.NVarChar, remark || "").query(`
        UPDATE ManpowerRequests
        SET HRStatus='Approved',
            HRRemark=@remark,
            Status='Approved',
            SecuritySent=1
        WHERE Id=@Id
      `);
  }

  res.json({ success: true });
});

export const getSecurityList = tryCatch(async (req, res) => {
  const pool = await sql.connect(dbConfig3);

  const result = await pool.request().query(`
    SELECT *
    FROM ManpowerRequests
    WHERE Status='Approved'
    ORDER BY RequiredDate DESC
  `);

  res.json({ success: true, data: result.recordset });
});

export const getManpowerRequests = tryCatch(async (req, res) => {
  const pool = await sql.connect(dbConfig3);

  const result = await pool.request().query(`
    SELECT *
    FROM ManpowerRequests
    ORDER BY CreatedDate DESC
  `);

  res.json({ success: true, data: result.recordset });
});

export const rejectManpowerRequest = tryCatch(async (req, res) => {
  const { requestId, role, remark } = req.body;

  const pool = await sql.connect(dbConfig3);

  if (!requestId || !role) {
    throw new AppError("Missing parameters", 400);
  }

  let column = "";
  let remarkColumn = "";

  if (role === "HOD") {
    column = "HODStatus";
    remarkColumn = "HODRemark";
  }

  if (role === "PlantHead") {
    column = "PlantHeadStatus";
    remarkColumn = "PlantHeadRemark";
  }

  if (role === "HR") {
    column = "HRStatus";
    remarkColumn = "HRRemark";
  }

  await pool
    .request()
    .input("Id", sql.Int, requestId)
    .input("remark", sql.NVarChar, remark || "").query(`
      UPDATE ManpowerRequests
      SET ${column}='Rejected',
          ${remarkColumn}=@remark,
          Status='Rejected'
      WHERE Id=@Id
    `);

  res.json({ success: true, message: "Request Rejected" });
});

export const getDepartments = tryCatch(async (req, res) => {
  const pool = await sql.connect(dbConfig3);

  const result = await pool.request().query(`
    SELECT 
        dpt.id,
        dpt.deptCode,
        dpt.department_name,
        u.name,
        u.employee_email
    FROM departments dpt
    INNER JOIN users u 
        ON dpt.department_head_id = u.employee_id
    ORDER BY dpt.department_name
  `);

  res.json({
    success: true,
    data: result.recordset,
  });
});

export const emailApprovalHandler = async (req, res) => {
  const { code, role, action } = req.params;

  const pool = await sql.connect(dbConfig3);

  if (action === "approve") {
    await pool.request().input("RequestCode", sql.VarChar, code)
      .query(`UPDATE ManpowerRequests
              SET ${role}Status='Approved'
              WHERE RequestCode=@RequestCode`);
  }

  if (action === "reject") {
    await pool.request().input("RequestCode", sql.VarChar, code)
      .query(`UPDATE ManpowerRequests
              SET Status='Rejected'
              WHERE RequestCode=@RequestCode`);
  }

  res.send(`
    <html>
    <body style="font-family:Arial;background:#f4f6f9;
                 display:flex;justify-content:center;
                 align-items:center;height:100vh;">

      <div style="background:white;padding:40px;
                  border-radius:10px;
                  box-shadow:0 10px 25px rgba(0,0,0,0.1);
                  text-align:center;max-width:500px;">

        <h2 style="color:${action === "approve" ? "#28a745" : "#dc3545"};">
          ${action === "approve" ? "Approval Successful" : "Request Rejected"}
        </h2>

        <p style="margin-top:15px;color:#555;">
          Request Code: <strong>${code}</strong>
        </p>

        <p style="margin-top:10px;">
          You may now close this window.
        </p>

        <button onclick="window.close()"
          style="margin-top:20px;
                 background:#003366;
                 color:white;
                 padding:10px 20px;
                 border:none;
                 border-radius:5px;">
          Close
        </button>

      </div>

    </body>
    </html>
  `);
};
