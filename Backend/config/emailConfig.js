import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter with your custom SMTP settings
const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  auth: {
    user: "maximillia.zboncak85@ethereal.email",
    pass: "2pnjdPYRSacABDtwjU",
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
        name: "Varun Yadav",
        address: "varun@gmail.com",
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

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});
