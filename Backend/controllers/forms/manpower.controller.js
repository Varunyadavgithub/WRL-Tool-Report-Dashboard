import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateManpowerPDF } from "../../services/pdf.service.js";
import { sendManpowerApprovalMail } from "../../emailTemplates/FormsApproval_System/manpowerApproval.templete.js";

// Reusable helper — fetches full request + employees from DB
const getFullRequestPayload = async (pool, requestId) => {
  const recordResult = await pool
    .request()
    .input("Id", sql.Int, requestId)
    .query("SELECT * FROM ManpowerRequests WHERE Id=@Id");

  const record = recordResult.recordset[0];

  const empResult = await pool
    .request()
    .input("RequestId", sql.Int, requestId)
    .query("SELECT * FROM ManpowerEmployees WHERE RequestId=@RequestId");

  const employees = empResult.recordset.map((e) => ({
    empCode: e.EmpCode,
    empName: e.EmpName,
    category: e.Category,
    location: e.Location,
    contactNo: e.ContactNo,
    travellingBy: e.TravellingBy,
  }));

  return {
    record,
    requestCode: record.RequestCode,
    departmentName: record.DepartmentName,
    requiredDate: record.RequiredDate,
    approvedDET: record.ApprovedDET,
    approvedITI: record.ApprovedITI,
    approvedCASUAL: record.ApprovedCASUAL,
    actualDET: record.ActualDET,
    actualITI: record.ActualITI,
    actualCASUAL: record.ActualCASUAL,
    additionalDET: record.AdditionalDET,
    additionalITI: record.AdditionalITI,
    additionalCASUAL: record.AdditionalCASUAL,
    overtimeFrom: record.OvertimeFrom,
    overtimeTo: record.OvertimeTo,
    overtimeTotal: record.OvertimeTotal,
    responsibleStaff: record.ResponsibleStaff,
    justification: record.Justification,
    employees,
  };
};

// Helper — send Security email and mark SecuritySent = 1
const notifySecurity = async (pool, requestId, payload) => {
  await sendManpowerApprovalMail({
    to: process.env.SECURITY_EMAIL,
    role: "Security",
    ...payload,
    currentStatus: "Final Approved",
  });

  await pool.request().input("Id", sql.Int, requestId).query(`
      UPDATE ManpowerRequests
      SET SecuritySent = 1, Status = 'Final Approved'
      WHERE Id = @Id
    `);
};

// ===============================================================
export const createManpowerRequest = tryCatch(async (req, res) => {
  const data = req.body;
  const pool = await sql.connect(dbConfig3);

  const requestCode = `WRL-MPR-${Date.now()}`;

  const requiredDate = data.requiredDate ? new Date(data.requiredDate) : null;
  if (!requiredDate) {
    throw new AppError("Required Date is mandatory", 400);
  }

  const insertResult = await pool
    .request()
    .input("RequestCode", sql.VarChar, requestCode)
    .input("DepartmentName", sql.VarChar, data.departmentName || "")
    .input("HODName", sql.VarChar, data.hodName || "")
    .input("HODEmail", sql.VarChar, data.hodEmail || "")
    .input("RequiredDate", sql.DateTime, requiredDate)
    .input("RequiredDay", sql.VarChar, data.requiredDay || "")
    .input("ApprovedDET", sql.Int, +data.approvedDET || 0)
    .input("ApprovedITI", sql.Int, +data.approvedITI || 0)
    .input("ApprovedCASUAL", sql.Int, +data.approvedCASUAL || 0)
    .input("ApprovedTotal", sql.Int, +data.approvedTotal || 0)
    .input("ActualDET", sql.Int, +data.actualDET || 0)
    .input("ActualITI", sql.Int, +data.actualITI || 0)
    .input("ActualCASUAL", sql.Int, +data.actualCASUAL || 0)
    .input("ActualTotal", sql.Int, +data.actualTotal || 0)
    .input("AdditionalDET", sql.Int, +data.additionalDET || 0)
    .input("AdditionalITI", sql.Int, +data.additionalITI || 0)
    .input("AdditionalCASUAL", sql.Int, +data.additionalCASUAL || 0)
    .input("AdditionalTotal", sql.Int, +data.additionalTotal || 0)
    .input("TotalManpower", sql.Int, +data.totalManpower || 0)
    .input("OvertimeFrom", sql.VarChar, data.overtimeFrom || null)
    .input("OvertimeTo", sql.VarChar, data.overtimeTo || null)
    .input("OvertimeTotal", sql.Float, +data.overtimeTotal || 0)
    .input("ResponsibleStaff", sql.VarChar, data.responsibleStaff || "")
    .input("Justification", sql.NVarChar, data.justification || "")
    .input("Reverification", sql.NVarChar, data.reverification || "")
    .input("HODStatus", sql.VarChar, "Pending")
    .input("HRStatus", sql.VarChar, "Pending")
    .input("PlantHeadStatus", sql.VarChar, "Pending")
    .input("Status", sql.VarChar, "Pending HOD Approval").query(`
      INSERT INTO ManpowerRequests
      (
        RequestCode, DepartmentName, HODName, HODEmail,
        RequiredDate, RequiredDay,
        ApprovedDET, ApprovedITI, ApprovedCASUAL, ApprovedTotal,
        ActualDET, ActualITI, ActualCASUAL, ActualTotal,
        AdditionalDET, AdditionalITI, AdditionalCASUAL, AdditionalTotal,
        TotalManpower,
        OvertimeFrom, OvertimeTo, OvertimeTotal,
        ResponsibleStaff, Justification, Reverification,
        HODStatus, HRStatus, PlantHeadStatus, Status
      )
      OUTPUT INSERTED.Id
      VALUES
      (
        @RequestCode, @DepartmentName, @HODName, @HODEmail,
        @RequiredDate, @RequiredDay,
        @ApprovedDET, @ApprovedITI, @ApprovedCASUAL, @ApprovedTotal,
        @ActualDET, @ActualITI, @ActualCASUAL, @ActualTotal,
        @AdditionalDET, @AdditionalITI, @AdditionalCASUAL, @AdditionalTotal,
        @TotalManpower,
        @OvertimeFrom, @OvertimeTo, @OvertimeTotal,
        @ResponsibleStaff, @Justification, @Reverification,
        @HODStatus, @HRStatus, @PlantHeadStatus, @Status
      )
    `);

  const newRequestId = insertResult.recordset[0].Id;

  // ✅ Insert Employees
  const employees = data.employees || [];
  for (const emp of employees) {
    await pool
      .request()
      .input("RequestId", sql.Int, newRequestId)
      .input("EmpCode", sql.VarChar, emp.empCode || "")
      .input("EmpName", sql.VarChar, emp.empName || "")
      .input("Category", sql.VarChar, emp.category || "")
      .input("Location", sql.VarChar, emp.location || "")
      .input("ContactNo", sql.VarChar, emp.contactNo || "")
      .input("TravellingBy", sql.VarChar, emp.travellingBy || "").query(`
        INSERT INTO ManpowerEmployees
        (RequestId, EmpCode, EmpName, Category, Location, ContactNo, TravellingBy)
        VALUES
        (@RequestId, @EmpCode, @EmpName, @Category, @Location, @ContactNo, @TravellingBy)
      `);
  }

  // ✅ Email HOD
  await sendManpowerApprovalMail({
    to: data.hodEmail,
    role: "HOD",
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
    currentStatus: "Pending HOD Approval",
  });

  generateManpowerPDF(res, data);
});

// ===============================================================
export const approveManpowerRequest = tryCatch(async (req, res) => {
  const { requestId, role, remark } = req.body;
  const pool = await sql.connect(dbConfig3);

  const record = await pool
    .request()
    .input("Id", sql.Int, requestId)
    .query("SELECT * FROM ManpowerRequests WHERE Id=@Id");

  if (!record.recordset.length) {
    throw new AppError("Request not found", 404);
  }

  const now = new Date();
  const hour = now.getHours();

  // ================= HOD =================
  if (role === "HOD") {
    await pool
      .request()
      .input("Id", sql.Int, requestId)
      .input("remark", sql.NVarChar, remark || "")
      .input("approvedAt", sql.DateTime, now).query(`
        UPDATE ManpowerRequests
        SET HODStatus='Approved',
            HODRemark=@remark,
            HODApprovedAt=@approvedAt,
            Status='Pending HR & Plant Head'
        WHERE Id=@Id
      `);

    const payload = await getFullRequestPayload(pool, requestId);

    // ✅ Email both HR and Plant Head
    await sendManpowerApprovalMail({
      to: process.env.HR_EMAIL,
      role: "HR",
      ...payload,
      currentStatus: "Pending HR & Plant Head Approval",
    });

    await sendManpowerApprovalMail({
      to: process.env.PLANT_HEAD_EMAIL,
      role: "PlantHead",
      ...payload,
      currentStatus: "Pending HR & Plant Head Approval",
    });
  }

  // ================= HR =================
  if (role === "HR") {
    await pool
      .request()
      .input("Id", sql.Int, requestId)
      .input("remark", sql.NVarChar, remark || "")
      .input("approvedAt", sql.DateTime, now).query(`
        UPDATE ManpowerRequests
        SET HRStatus='Approved',
            HRRemark=@remark,
            HRApprovedAt=@approvedAt
        WHERE Id=@Id
      `);

    // ✅ Fetch latest state after HR update
    const { record: updatedRecord, ...payload } = await getFullRequestPayload(
      pool,
      requestId,
    );

    const isAfter6PM = hour >= 18;
    const plantHeadAlreadyApproved =
      updatedRecord.PlantHeadStatus === "Approved";

    if (isAfter6PM) {
      // After 6 PM — PlantHead approval not required, HR alone is enough
      console.log(
        `After 6PM — HR approval alone is sufficient for ${updatedRecord.RequestCode}`,
      );
      await notifySecurity(pool, requestId, payload);
    } else if (plantHeadAlreadyApproved) {
      // Before 6 PM — PlantHead already approved, now HR approved = BOTH done
      console.log(
        `Both HR & PlantHead approved for ${updatedRecord.RequestCode}`,
      );
      await notifySecurity(pool, requestId, payload);
    } else {
      // Before 6 PM — waiting for PlantHead to also approve
      await pool.request().input("Id", sql.Int, requestId).query(`
          UPDATE ManpowerRequests
          SET Status = 'Pending Plant Head Approval'
          WHERE Id = @Id
        `);

      console.log(
        `HR approved, waiting for PlantHead for ${updatedRecord.RequestCode}`,
      );
    }
  }

  // ================= PLANT HEAD =================
  if (role === "PlantHead") {
    if (hour >= 18) {
      return res.status(400).json({
        success: false,
        message: "Plant Head approval not allowed after 6 PM.",
      });
    }

    await pool
      .request()
      .input("Id", sql.Int, requestId)
      .input("remark", sql.NVarChar, remark || "")
      .input("approvedAt", sql.DateTime, now).query(`
        UPDATE ManpowerRequests
        SET PlantHeadStatus='Approved',
            PlantHeadRemark=@remark,
            PlantHeadApprovedAt=@approvedAt
        WHERE Id=@Id
      `);

    // ✅ Fetch latest state after PlantHead update
    const { record: updatedRecord, ...payload } = await getFullRequestPayload(
      pool,
      requestId,
    );

    const hrAlreadyApproved = updatedRecord.HRStatus === "Approved";

    if (hrAlreadyApproved) {
      // HR already approved before PlantHead — BOTH done
      console.log(
        `Both PlantHead & HR approved for ${updatedRecord.RequestCode}`,
      );
      await notifySecurity(pool, requestId, payload);
    } else {
      // HR hasn't approved yet — wait for HR
      await pool.request().input("Id", sql.Int, requestId).query(`
          UPDATE ManpowerRequests
          SET Status = 'Pending HR Approval'
          WHERE Id = @Id
        `);

      console.log(
        `PlantHead approved, waiting for HR for ${updatedRecord.RequestCode}`,
      );
    }
  }

  res.json({ success: true });
});

// ===============================================================
export const getSecurityList = tryCatch(async (req, res) => {
  const pool = await sql.connect(dbConfig3);

  const result = await pool.request().query(`
    SELECT *
    FROM ManpowerRequests
    WHERE Status = 'Final Approved'
    ORDER BY RequiredDate DESC
  `);

  res.json({ success: true, data: result.recordset });
});

// ===============================================================
export const getManpowerRequests = tryCatch(async (req, res) => {
  const pool = await sql.connect(dbConfig3);

  const result = await pool.request().query(`
    SELECT * FROM ManpowerRequests ORDER BY CreatedDate DESC
  `);

  const employeesResult = await pool.request().query(`
    SELECT * FROM ManpowerEmployees ORDER BY Id ASC
  `);

  const employeesMap = {};
  for (const emp of employeesResult.recordset) {
    if (!employeesMap[emp.RequestId]) employeesMap[emp.RequestId] = [];
    employeesMap[emp.RequestId].push(emp);
  }

  const enriched = result.recordset.map((r) => ({
    ...r,
    employees: employeesMap[r.Id] || [],
    EscalationLevel: calculateEscalationLevel(r.CreatedDate),
  }));

  res.json({ success: true, data: enriched });
});

// ===============================================================
export const rejectManpowerRequest = tryCatch(async (req, res) => {
  const { requestId, role, remark } = req.body;
  const pool = await sql.connect(dbConfig3);

  if (!requestId || !role) {
    throw new AppError("Missing parameters", 400);
  }

  const columnMap = {
    HOD: { status: "HODStatus", remark: "HODRemark" },
    HR: { status: "HRStatus", remark: "HRRemark" },
    PlantHead: { status: "PlantHeadStatus", remark: "PlantHeadRemark" },
  };

  const selected = columnMap[role];
  if (!selected) throw new AppError("Invalid role", 400);

  await pool
    .request()
    .input("Id", sql.Int, requestId)
    .input("remark", sql.NVarChar, remark || "").query(`
      UPDATE ManpowerRequests
      SET ${selected.status}='Rejected',
          ${selected.remark}=@remark,
          Status='Rejected'
      WHERE Id=@Id
    `);

  res.json({ success: true });
});

// ===============================================================
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

  res.json({ success: true, data: result.recordset });
});

// ===============================================================
export const emailApprovalHandler = async (req, res) => {
  const { code, role, action } = req.params;
  const pool = await sql.connect(dbConfig3);

  const record = await pool
    .request()
    .input("RequestCode", sql.VarChar, code)
    .query("SELECT Id FROM ManpowerRequests WHERE RequestCode=@RequestCode");

  if (!record.recordset.length) {
    return res.send("Invalid Request Code");
  }

  const requestId = record.recordset[0].Id;

  if (action === "approve") {
    await approveManpowerRequest(
      { body: { requestId, role, remark: "Approved via Email" } },
      { json: () => {}, status: () => ({ json: () => {} }) },
    );
  }

  if (action === "reject") {
    await rejectManpowerRequest(
      { body: { requestId, role, remark: "Rejected via Email" } },
      { json: () => {} },
    );
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
        <p>Request Code: <strong>${code}</strong></p>
        <p>You may now close this window.</p>
      </div>
    </body>
    </html>
  `);
};

// ===============================================================
const calculateEscalationLevel = (createdDate) => {
  const now = new Date();
  const created = new Date(createdDate);
  const diffHours = (now - created) / (1000 * 60 * 60);

  if (diffHours >= 48) return 3;
  if (diffHours >= 24) return 2;
  if (diffHours >= 12) return 1;

  return null;
};
