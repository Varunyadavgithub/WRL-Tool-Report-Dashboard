import cron from "node-cron";
import sql from "mssql";
import { dbConfig3 } from "../config/db.config.js";
import { sendManpowerApprovalMail } from "../emailTemplates/FormsApproval_System/manpowerApproval.templete.js";

export const startManpowerCron = () => {

  // ============================================================
  // Runs every day at 6:00 PM
  // If Plant Head has NOT approved → escalate to HR
  // HR approves after 6PM → Security gets email (handled in controller)
  // ============================================================
  cron.schedule("0 18 * * *", async () => {
    console.log("Running 6:00 PM HR Escalation Job...");

    try {
      const pool = await sql.connect(dbConfig3);

      // Find requests where:
      // - HOD approved
      // - PlantHead NOT approved
      // - Not already rejected or final approved
      const result = await pool.request().query(`
        SELECT *
        FROM ManpowerRequests
        WHERE HODStatus = 'Approved'
          AND (PlantHeadStatus IS NULL OR PlantHeadStatus != 'Approved')
          AND Status NOT IN ('Final Approved', 'Rejected', 'Pending HR Approval')
      `);

      if (result.recordset.length === 0) {
        console.log("No requests requiring HR escalation.");
        return;
      }

      for (const request of result.recordset) {

        // ✅ Update status to Waiting HR Approval
        await pool
          .request()
          .input("Id", sql.Int, request.Id)
          .query(`
            UPDATE ManpowerRequests
            SET Status = 'Waiting HR Approval'
            WHERE Id = @Id
          `);

        // ✅ Fetch employees
        const empResult = await pool
          .request()
          .input("RequestId", sql.Int, request.Id)
          .query("SELECT * FROM ManpowerEmployees WHERE RequestId=@RequestId");

        const employees = empResult.recordset.map((e) => ({
          empCode: e.EmpCode,
          empName: e.EmpName,
          category: e.Category,
          location: e.Location,
          contactNo: e.ContactNo,
          travellingBy: e.TravellingBy,
        }));

        // ✅ Email HR — after 6PM so HR approval alone will trigger Security email
        await sendManpowerApprovalMail({
          to: process.env.HR_EMAIL,
          role: "HR",
          requestCode: request.RequestCode,
          departmentName: request.DepartmentName,
          requiredDate: request.RequiredDate,
          approvedDET: request.ApprovedDET,
          approvedITI: request.ApprovedITI,
          approvedCASUAL: request.ApprovedCASUAL,
          actualDET: request.ActualDET,
          actualITI: request.ActualITI,
          actualCASUAL: request.ActualCASUAL,
          additionalDET: request.AdditionalDET,
          additionalITI: request.AdditionalITI,
          additionalCASUAL: request.AdditionalCASUAL,
          overtimeFrom: request.OvertimeFrom,
          overtimeTo: request.OvertimeTo,
          overtimeTotal: request.OvertimeTotal,
          responsibleStaff: request.ResponsibleStaff,
          justification: request.Justification,
          employees,
          currentStatus: "⚠️ Escalated — Plant Head did not approve by 6 PM. HR action required.",
        });

        console.log(`HR escalation sent for ${request.RequestCode}`);
      }

      console.log("6:00 PM HR Escalation Job Completed.");

    } catch (error) {
      console.error("6:00 PM Escalation Error:", error);
    }
  });

};