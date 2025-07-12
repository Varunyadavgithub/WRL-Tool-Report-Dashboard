import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter with your custom SMTP settings
const transporter = nodemailer.createTransport({
  host: "202.162.229.102",
  port: 587,
  secure: false, // use TLS
  auth: {
    user: "vikash.kumar@westernequipments.com",
    pass: "@Bombom12@",
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
      cc, // ? Add CC field here
      subject: `Visitor Pass Generated for ${visitorName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #2575fc; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Visitor Pass Notification</h2>
          </div>
          <div style="padding: 20px;">
            <p><strong>Visitor Name:</strong> ${visitorName}</p>
            <p><strong>Contact:</strong> ${visitorContact}</p>
            <p><strong>Email:</strong> ${visitorEmail}</p>
            <p><strong>Department:</strong> ${departmentToVisit}</p>
            <p><strong>Employee to Visit:</strong> ${
              employeeToVisit || "N/A"
            }</p>
            <p><strong>Purpose:</strong> ${purposeOfVisit}</p>
            <p><strong>Pass ID:</strong> ${passId}</p>
            <p><strong>Allow On:</strong> ${new Date(
              allowOn
            ).toLocaleString()}</p>
            <p><strong>Allow Till:</strong> ${
              allowTill ? new Date(allowTill).toLocaleString() : "N/A"
            }</p>
          </div>
          <div style="background-color: #f9f9f9; text-align: center; padding: 10px; font-size: 12px; color: #666;">
            © ${currentYear} WRL Tool Report — This is an automated message.
          </div>
        </div>
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

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});
