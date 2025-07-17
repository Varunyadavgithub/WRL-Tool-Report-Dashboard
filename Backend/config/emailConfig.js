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

export const sendReminderEmail = async (reminderData) => {
  try {
    // Validate email
    const emailToSend = reminderData.recipientEmail;

    if (!emailToSend) {
      console.log("No email provided for sending reminder");
      return false;
    }

    const currentYear = new Date().getFullYear();

    const mailOptions = {
      from: {
        name: "Vikash Kumar",
        address: "vikash.kumar@westernequipments.com",
      },
      to: emailToSend,
      subject: `Reminder: ${reminderData.title}`,
      html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f4; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Reminder Notification</h1>
        </div>
        <div style="padding: 30px; background-color: white;">
          <div style="background-color: #f9f9f9; border-left: 4px solid #2575fc; padding: 15px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #333; font-size: 20px;">${
              reminderData.title
            }</h2>
            <p style="margin: 0; color: #666; line-height: 1.6;">${
              reminderData.description
            }</p>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div style="flex: 1; background-color: #f1f1f1; border-radius: 5px; padding: 15px; margin-right: 10px; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Priority</h3>
                <p style="margin: 0; font-weight: bold;color: ${
                  reminderData.priority === "High"
                    ? "#ff4d4d"
                    : reminderData.priority === "Medium"
                    ? "#ffa500"
                    : "#4CAF50"
                };
                ">${reminderData.priority}</p>
            </div>
            
            <div style="
                flex: 1;
                background-color: #f1f1f1;
                border-radius: 5px;
                padding: 15px;
                text-align: center;
            ">
                <h3 style="
                    margin: 0 0 10px 0;
                    color: #333;
                    font-size: 16px;
                ">Scheduled Date</h3>
                <p style="
                    margin: 0;
                    color: #666;
                    font-weight: bold;
                ">${new Date(reminderData.scheduleDate).toLocaleString()}</p>
            </div>
        </div>
    </div>
    
    <div style="background-color: #f4f4f4; text-align: center; padding: 15px; font-size: 12px; color: #888;">
      © ${currentYear} WRL Tool Report. All rights reserved.
    </div>
</div>
`,
    };

    // Send email and get result
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);

    return true;
  } catch (error) {
    console.error("Detailed Email Sending Error:", {
      message: error.message,
      stack: error.stack,
    });
    return false;
  }
};

export const sendVisitorPassEmail = async ({
  to,
  cc,
  visitorName,
  photoPath,
  visitorId,
  passId,
  allowOn,
  allowTill,
  departmentToVisit,
  employeeToVisit,
  visitorContact,
  visitorEmail,
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
        address: "vikash.kumar@westernequipments.com",
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
                            <p><strong>Company:</strong> ${departmentToVisit}</p>
                            <p><strong>City:</strong> ${
                              employeeToVisit || "N/A"
                            }</p>
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
                            <p><strong>Purpose of Visit:</strong> ${purposeOfVisit}</p>
                          </td>
                          <td width="50%" style="vertical-align: top;">
                            <p><strong>Pass ID:</strong> ${passId}</p>
                            <p><strong>Allow Till:</strong> ${
                              allowTill
                                ? new Date(allowTill).toLocaleString()
                                : "N/A"
                            }</p>
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

    const currentYear = new Date().getFullYear();

    const tableRows = visitors
      .map(
        (v, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${v.visitor_name}</td>
        <td>${v.contact_no}</td>
        <td>${v.email}</td>
        <td>${v.company}</td>
        <td>${v.city}</td>
        <td>${v.state}</td>
        <td>${v.department_name}</td>
        <td>${v.employee_name}</td>
        <td>${v.purpose_of_visit}</td>
        <td>${
          v.check_in_time ? new Date(v.check_in_time).toLocaleString() : "-"
        }</td>
        <td>${
          v.check_out_time
            ? new Date(v.check_out_time).toLocaleString()
            : "Currently In"
        }</td>
      </tr>
    `
      )
      .join("");

    const emailHtml = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Visitor Report Summary</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <thead style="background-color: #f0f0f0;">
            <tr>
              <th>Sr.</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Company</th>
              <th>City</th>
              <th>State</th>
              <th>Department</th>
              <th>Employee</th>
              <th>Purpose</th>
              <th>Check In</th>
              <th>Check Out</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="margin-top: 16px; font-size: 12px; color: #888;">© ${currentYear} WRL Visitor Reports</p>
      </div>
    `;

    const mailOptions = {
      from: {
        name: "WRL Visitor Reports",
        address: "vikash.kumar@westernequipments.com",
      },
      to: "vikash.kumar@westernequipments.com",
      subject: "Visitor Report - Summary",
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Visitor report email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending visitor report email:", error);
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
