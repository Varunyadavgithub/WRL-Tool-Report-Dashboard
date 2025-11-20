import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter with your custom SMTP settings
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false, // avoid cert errors (optional; test carefully)
  },
});

export const sendVisitorPassEmail = async ({
  to,
  cc,
  photoPath,
  visitorName,
  visitorContact,
  visitorEmail,
  company,
  city,
  visitorId,
  allowOn,
  allowTill,
  departmentToVisit,
  employeeToVisit,
  purposeOfVisit,
}) => {
  try {
    if (!to) {
      console.warn("No recipient email provided");
      return false;
    }

    const currentYear = new Date().getFullYear();

    const mailOptions = {
      from: {
        name: "WRL Security Team",
        address: "security.tadgam@westernequipments.com",
      },
      to,
      cc,
      subject: `Visitor Pass Generated for ${visitorName}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Visitor Pass Notification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f0f0f0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f0f0; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #2575fc; color: #fff; padding: 20px; text-align: center;">
                      <h2 style="margin: 0">Visitor Pass Notification</h2>
                    </td>
                  </tr>

                  <!-- Image & Info -->
                  <tr>
                    <td style="padding: 20px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <!-- Left: Image -->
                          <td width="50%" align="center" valign="middle" style="padding-right: 10px;">
                            <div style="width: 150px; height: 150px; border-radius: 50%; overflow: hidden; display: inline-block;">
                              <img
                                src="${photoPath}"
                                alt="Visitor Image"
                                width="150"
                                height="150"
                                style="display: block; object-fit: cover;"
                              />
                            </div>
                          </td>

                          <!-- Right: Details -->
                          <td width="50%" valign="top" style="font-size: 14px; color: #333;">
                            <p><strong>Name:</strong> ${visitorName}</p>
                            <p><strong>Contact:</strong> ${visitorContact}</p>
                            <p><strong>Email:</strong> ${visitorEmail}</p>
                            <p><strong>Company:</strong> ${company}</p>
                            <p><strong>City:</strong> ${city || "N/A"}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Additional Details -->
                  <tr>
                    <td style="background-color: #f4f4f4; padding: 20px; font-size: 14px; color: #555;">
                      <table width="100%" cellpadding="5" cellspacing="0" border="0">
                        <tr>
                          <td width="50%" style="vertical-align: top;">
                            <p><strong>Visitor ID:</strong> ${visitorId}</p>
                            <p><strong>Allow On:</strong> ${new Date(
                              allowOn
                            ).toLocaleString()}</p>
                            <p><strong>Department to Visit:</strong> ${departmentToVisit}</p>
                          </td>
                          <td width="50%" style="vertical-align: top;">
                          <p><strong>Purpose of Visit:</strong> ${purposeOfVisit}</p>
                            <p><strong>Allow Till:</strong> ${
                              allowTill
                                ? new Date(allowTill).toLocaleString()
                                : "N/A"
                            }</p>
                             <p><strong>Employee to Visit:</strong> ${employeeToVisit}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9f9f9; text-align: center; padding: 10px; font-size: 12px; color: #666;">
                      © ${currentYear} WRL Tool Report — This is an automated message.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `Visitor pass email sent to ${to} (cc: ${cc || "none"}) — Message ID: ${
        info.messageId
      }`
    );
    return true;
  } catch (error) {
    console.error("Failed to send visitor pass email:", error);
    return false;
  }
};

export const sendVisitorReportEmail = async (visitors) => {
  try {
    if (!Array.isArray(visitors) || visitors.length === 0) {
      console.warn("No visitor data to email.");
      return false;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Visitor Report");

    worksheet.columns = [
      { header: "Sr.", key: "sr", width: 6 },
      { header: "Name", key: "visitor_name", width: 25 },
      { header: "Contact", key: "contact_no", width: 15 },
      { header: "Email", key: "email", width: 25 },
      { header: "Company", key: "company", width: 20 },
      { header: "City", key: "city", width: 15 },
      { header: "State", key: "state", width: 15 },
      { header: "Department", key: "department_name", width: 15 },
      { header: "Employee", key: "employee_name", width: 20 },
      { header: "Purpose", key: "purpose_of_visit", width: 25 },
      { header: "Check In", key: "check_in_time", width: 22 },
      { header: "Check Out", key: "check_out_time", width: 22 },
    ];

    visitors.forEach((v, i) => {
      worksheet.addRow({
        sr: i + 1,
        visitor_name: v.visitor_name,
        contact_no: v.contact_no,
        email: v.email,
        company: v.company,
        city: v.city,
        state: v.state,
        department_name: v.department_name,
        employee_name: v.employee_name,
        purpose_of_visit: v.purpose_of_visit,
        check_in_time: v.check_in_time
          ? new Date(v.check_in_time).toLocaleString()
          : "-",
        check_out_time: v.check_out_time
          ? new Date(v.check_out_time).toLocaleString()
          : "Currently In",
      });
    });

    // Style header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    // ✅ Write file to buffer (no temp file needed)
    const buffer = await workbook.xlsx.writeBuffer();

    const mailOptions = {
      from: {
        name: "WRL Visitor Reports",
        address: "security.tadgam@westernequipments.com",
      },
      to: "vikash.kumar@westernequipments.com",
      subject: "Visitor Report - Excel Summary",
      text: "Please find attached the latest visitor report (Excel format) for your reference.\n\nRegards,\nWRL Security Department",
      attachments: [
        {
          filename: `visitor-report-${
            new Date().toISOString().split("T")[0]
          }.xlsx`,
          content: buffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Visitor report email with Excel sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending visitor report email:", error);
    return false;
  }
};

export const sendCurrentlyInsideVisitorsEmail = async (visitors) => {
  try {
    if (!Array.isArray(visitors) || visitors.length === 0) {
      console.warn("No visitors currently inside.");
      return false;
    }

    // Prepare visitor details in HTML table
    const tableRows = visitors
      .map(
        (v, i) => `
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">${i + 1}</td>
          <td style="padding:8px; border:1px solid #ddd;">${v.visitor_name}</td>
          <td style="padding:8px; border:1px solid #ddd;">${v.contact_no || "-"}</td>
          <td style="padding:8px; border:1px solid #ddd;">${v.company || "-"}</td>
          <td style="padding:8px; border:1px solid #ddd;">${v.department_name || "-"}</td>
          <td style="padding:8px; border:1px solid #ddd;">${v.employee_name || "-"}</td>
          <td style="padding:8px; border:1px solid #ddd;">${new Date(
            v.check_in_time
          ).toLocaleString()}</td>
        </tr>`
      )
      .join("");

    const htmlContent = `
      <html>
      <body style="font-family: Arial, sans-serif; background-color:#f8f9fa; padding:20px;">
        <h2 style="color:#007bff;">Currently Inside Visitors</h2>
        <p>The following visitors are still inside the premises as of ${new Date().toLocaleString()}:</p>
        <table style="border-collapse:collapse; width:100%; background:#fff;">
          <thead style="background:#007bff; color:#fff;">
            <tr>
              <th style="padding:8px; border:1px solid #ddd;">#</th>
              <th style="padding:8px; border:1px solid #ddd;">Name</th>
              <th style="padding:8px; border:1px solid #ddd;">Contact</th>
              <th style="padding:8px; border:1px solid #ddd;">Company</th>
              <th style="padding:8px; border:1px solid #ddd;">Department</th>
              <th style="padding:8px; border:1px solid #ddd;">Employee To Visit</th>
              <th style="padding:8px; border:1px solid #ddd;">Check-In Time</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="margin-top:20px;">Regards,<br><strong>WRL Security Team</strong></p>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "WRL Visitor Alert",
        address: process.env.SMTP_USER, // same as used for your visitor pass emails
      },
      to: "vikash.kumar@westernequipments.com",
      subject: "⚠️ Visitors Currently Inside the Premises",
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Currently inside visitors alert sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending currently inside visitor alert:", error);
    return false;
  }
};

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});