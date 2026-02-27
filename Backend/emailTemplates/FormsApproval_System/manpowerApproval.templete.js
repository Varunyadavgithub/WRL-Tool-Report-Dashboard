import transporter from "../../config/email.config.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sendManpowerApprovalMail = async ({
  to,
  requestCode,
  departmentName,
  requiredDate,
  approvedDET,
  approvedITI,
  approvedCASUAL,
  actualDET,
  actualITI,
  actualCASUAL,
  additionalDET,
  additionalITI,
  additionalCASUAL,
  overtimeFrom,
  overtimeTo,
  overtimeTotal,
  responsibleStaff,
  justification,
  employees = [],
  role,
  pdfBuffer,                // ✅ optional PDF buffer
  currentStatus = "Pending" // ✅ approval status tracker
}) => {
  try {

    const baseUrl = process.env.BACKEND_URL || "http://localhost:3000";

    const approveUrl = `${baseUrl}/api/v1/manpower/email-action/${requestCode}/${role}/approve`;
    const rejectUrl = `${baseUrl}/api/v1/manpower/email-action/${requestCode}/${role}/reject`;

    const employeeRows = employees.length
      ? employees
          .map(
            (emp, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${emp.empCode || ""}</td>
          <td>${emp.empName || ""}</td>
          <td>${emp.category || ""}</td>
          <td>${emp.location || ""}</td>
          <td>${emp.contactNo || ""}</td>
          <td>${emp.travellingBy || ""}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="7" style="text-align:center;">No Employees Added</td></tr>`;

    const mailOptions = {
      from: {
        name: "WRL HR Automation",
        address: process.env.SMTP_USER,
      },
      to,
      subject: `Manpower Approval Request - ${departmentName}`,

      // ✅ Attachments (Logo + PDF)
      attachments: [
        {
          filename: "wrl-logo.png",
          path: path.join(__dirname, "../../assets/wrl-logo.png"),
          cid: "wrlLogo"
        },
        ...(pdfBuffer
          ? [{
              filename: `WRL-Manpower-${requestCode}.pdf`,
              content: pdfBuffer
            }]
          : [])
      ],

      html: `
      <html>
      <body style="font-family:'Times New Roman', serif; background:#ffffff; padding:40px; color:#000;">

        <div style="max-width:900px;margin:auto;">

          <!-- HEADER -->
          <div style="text-align:center;">
            <img src="cid:wrlLogo" height="70"/><br/>
            <h2 style="margin:0;">Western Refrigeration Pvt. Ltd.</h2>
            <h3 style="margin:5px 0 20px 0;">Manpower Approval Request</h3>
          </div>

          <hr style="border:1px solid #000;"/>

          <!-- STATUS TRACKER -->
          <div style="margin-top:15px;padding:8px;border:1px solid #000;">
            <strong>Current Status:</strong> ${currentStatus}
          </div>

          <!-- BASIC DETAILS -->
          <table width="100%" style="margin-top:20px;font-size:15px;">
            <tr>
              <td><strong>Request Code:</strong> ${requestCode}</td>
              <td><strong>Department:</strong> ${departmentName}</td>
            </tr>
            <tr>
              <td><strong>Required Date:</strong> ${
                requiredDate
                  ? new Date(requiredDate).toLocaleDateString()
                  : "-"
              }</td>
              <td></td>
            </tr>
          </table>

          <!-- MANPOWER HEADCOUNT -->
          <h4 style="margin-top:30px;">Manpower Headcount</h4>

          <table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse;text-align:center;">
            <tr>
              <th></th>
              <th>DET</th>
              <th>ITI</th>
              <th>CASUAL</th>
            </tr>
            <tr>
              <td style="text-align:left;"><strong>Approved</strong></td>
              <td>${approvedDET ?? 0}</td>
              <td>${approvedITI ?? 0}</td>
              <td>${approvedCASUAL ?? 0}</td>
            </tr>
            <tr>
              <td style="text-align:left;"><strong>Actual Required</strong></td>
              <td>${actualDET ?? 0}</td>
              <td>${actualITI ?? 0}</td>
              <td>${actualCASUAL ?? 0}</td>
            </tr>
            <tr>
              <td style="text-align:left;"><strong>Additional Required</strong></td>
              <td>${additionalDET ?? 0}</td>
              <td>${additionalITI ?? 0}</td>
              <td>${additionalCASUAL ?? 0}</td>
            </tr>
          </table>

          <!-- OVERTIME -->
          <h4 style="margin-top:30px;">Overtime Details</h4>

          <p>
            <strong>From:</strong> ${overtimeFrom || "-"} &nbsp;&nbsp;
            <strong>To:</strong> ${overtimeTo || "-"} &nbsp;&nbsp;
            <strong>Total Hours:</strong> ${overtimeTotal ?? 0}
          </p>

          <!-- RESPONSIBLE STAFF -->
          <h4>Responsible Staff</h4>
          <p>${responsibleStaff || "-"}</p>

          <!-- JUSTIFICATION -->
          <h4>Justification</h4>
          <p>${justification || "-"}</p>

          <!-- EMPLOYEE LIST -->
          <h4 style="margin-top:30px;">Employee List</h4>

          <table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:14px;">
            <tr>
              <th>#</th>
              <th>Emp Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Location</th>
              <th>Contact</th>
              <th>Travelling By</th>
            </tr>
            ${employeeRows}
          </table>

          <!-- SIGNATURE AREA -->
          <table width="100%" style="margin-top:50px;">
            <tr>
              <td style="text-align:left;">
                ___________________________<br/>
                HOD Approval
              </td>
              <td style="text-align:center;">
                ___________________________<br/>
                HR Approval
              </td>
              <td style="text-align:right;">
                ___________________________<br/>
                Plant Head Approval
              </td>
            </tr>
          </table>

          <!-- ACTION BUTTONS -->
          <div style="text-align:center;margin-top:40px;">
            <a href="${approveUrl}"
               style="background:#000;color:#fff;padding:10px 25px;
                      text-decoration:none;border-radius:4px;">
              APPROVE
            </a>

            &nbsp;&nbsp;&nbsp;

            <a href="${rejectUrl}"
               style="background:#555;color:#fff;padding:10px 25px;
                      text-decoration:none;border-radius:4px;">
              REJECT
            </a>
          </div>

          <!-- FOOTER DISCLAIMER -->
          <div style="margin-top:60px;font-size:11px;color:#444;">
            <hr/>
            <strong>DISCLAIMER:</strong><br/>
            The information contained in this electronic message (email) and any attachments to this email are intended for the exclusive use
            of the addressee(s) and access to this email by anyone else is unauthorized. The email may contain proprietary,
            confidential or privileged information relating to Western Refrigeration Pvt. Ltd.
            Any dissemination, distribution or copying of this communication is strictly prohibited.
          </div>

        </div>
      </body>
      </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error("Mail error:", error);
    return false;
  }
};