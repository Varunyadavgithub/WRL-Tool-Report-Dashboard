import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT), // ensure number
  secure: process.env.SMTP_PORT === "465", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // optional, only if needed
  },
});

// -------------------- Visitor Pass Email --------------------
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

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Visitor Pass Notification</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f0f0f0; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; }
          .header { background-color: #2575fc; color: #fff; text-align: center; padding: 20px; }
          .section { padding: 20px; font-size: 14px; color: #333; }
          .details td { padding: 5px; vertical-align: top; }
          .footer { background-color: #f9f9f9; text-align: center; padding: 10px; font-size: 12px; color: #666; }
          .visitor-img { width: 150px; height: 150px; border-radius: 50%; object-fit: cover; display: block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h2>Visitor Pass Notification</h2></div>
          <div class="section">
            <table width="100%">
              <tr>
                <td width="50%" align="center">
                  <img src="${photoPath}" alt="Visitor Image" class="visitor-img"/>
                </td>
                <td width="50%">
                  <p><strong>Name:</strong> ${visitorName}</p>
                  <p><strong>Contact:</strong> ${visitorContact}</p>
                  <p><strong>Email:</strong> ${visitorEmail}</p>
                  <p><strong>Company:</strong> ${company}</p>
                  <p><strong>City:</strong> ${city || "N/A"}</p>
                </td>
              </tr>
            </table>
          </div>
          <div class="section" style="background-color: #f4f4f4;">
            <table width="100%" class="details">
              <tr>
                <td>
                  <p><strong>Visitor ID:</strong> ${visitorId}</p>
                  <p><strong>Allow On:</strong> ${new Date(
                    allowOn
                  ).toLocaleString()}</p>
                  <p><strong>Department to Visit:</strong> ${departmentToVisit}</p>
                </td>
                <td>
                  <p><strong>Purpose of Visit:</strong> ${purposeOfVisit}</p>
                  <p><strong>Allow Till:</strong> ${
                    allowTill ? new Date(allowTill).toLocaleString() : "N/A"
                  }</p>
                  <p><strong>Employee to Visit:</strong> ${employeeToVisit}</p>
                </td>
              </tr>
            </table>
          </div>
          <div class="footer">© ${currentYear} WRL Security Team — This is an automated message.</div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: { name: "WRL Security Team", address: process.env.SMTP_USER },
      to,
      cc,
      subject: `Visitor Pass Generated for ${visitorName}`,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `Visitor pass email sent to ${to} — Message ID: ${info.messageId}`
    );
    return true;
  } catch (error) {
    console.error("Error sending Visitor Pass email:", error);
    return false;
  }
};

// -------------------- Visitor Report Email --------------------
export const sendVisitorReportEmail = async (visitors) => {
  try {
    if (!Array.isArray(visitors) || visitors.length === 0) {
      console.warn("No visitor data to email.");
      return false;
    }

    const headers = [
      "Sr.",
      "Name",
      "Contact",
      "Email",
      "Company",
      "City",
      "State",
      "Department",
      "Employee",
      "Purpose",
      "Check In",
      "Check Out",
    ];

    const tableRows = visitors
      .map(
        (v, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${v.visitor_name || ""}</td>
        <td>${v.contact_no || ""}</td>
        <td>${v.email || ""}</td>
        <td>${v.company || ""}</td>
        <td>${v.city || ""}</td>
        <td>${v.state || ""}</td>
        <td>${v.department_name || ""}</td>
        <td>${v.employee_name || ""}</td>
        <td>${v.purpose_of_visit || ""}</td>
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

    const html = `
      <html>
      <head>
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 5px; }
          th { background-color: #2575fc; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h2>Visitor Report</h2>
        <table>
          <thead><tr>${headers
            .map((h) => `<th>${h}</th>`)
            .join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p>Regards,<br/>WRL Security Team</p>
      </body>
      </html>
    `;

    const mailOptions = {
      from: { name: "WRL Security Team", address: process.env.SMTP_USER },
      to: "vikash.kumar@westernequipments.com",
      subject: "Visitor Report",
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Visitor report email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending Visitor Report email:", error);
    return false;
  }
};

// -------------------- Gate Entry Report Email --------------------
export const sendGateEntryReportEmail = async (gateEntries) => {
  try {
    if (!Array.isArray(gateEntries) || gateEntries.length === 0) {
      console.warn("No Gate Entry data to email.");
      return false;
    }

    const headers = [
      "GATE ENTRY NUMBER",
      "GATE ENTRY DATE",
      "PO NUMBER",
      "LINE ITEM",
      "PO DATE",
      "INVOICE VALUE",
      "BASIC RATE",
      "HSN CODE AS PER INVOICE",
      "GRN:103",
      "GRN:101 /105",
      "SUPPLIER CODE",
      "SUPPLIER NAME",
      "INVOICE NO.",
      "INVOICE DATE",
      "ITEM CODE",
      "DESCRIPTION OF THE GOODS",
      "UOM",
      "INVOICE QTY.",
      "RECEIVED QTY.",
      "DISCREPANCY",
      "MATERIAL GROUP",
      "VEHICLE NO.",
      "DELIVERY TYPE",
      "VEHICLE NAME",
      "VEHICLE TYPE",
      "FUEL TYPE",
      "TOTAL CARRYING CAPACITY OF THE VEHICLE",
      "REMARKS",
    ];

    const tableRows = gateEntries
      .map(
        (entry) => `
      <tr>${headers.map((h, i) => `<td>${entry[i] || ""}</td>`).join("")}</tr>
    `
      )
      .join("");

    const html = `
      <html>
      <head>
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 5px; }
          th { background-color: #2575fc; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h2>Gate Entry Report</h2>
        <table>
          <thead><tr>${headers
            .map((h) => `<th>${h}</th>`)
            .join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p>Regards,<br/>WRL Security Team</p>
      </body>
      </html>
    `;

    const mailOptions = {
      from: { name: "WRL Inward Alert", address: process.env.SMTP_USER },
      to: "vikash.kumar@westernequipments.com",
      subject: "Gate Entry Report",
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Gate Entry report email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending Gate Entry email:", error);
    return false;
  }
};

// -------------------- Verify SMTP --------------------
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});
