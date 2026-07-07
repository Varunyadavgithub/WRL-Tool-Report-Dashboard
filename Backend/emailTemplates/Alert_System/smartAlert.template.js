import transporter from "../../config/email.config.js";

const LABELS = {
  LowOEE: "Low OEE",
  HighDowntime: "High Downtime",
  HighRejectRate: "High Reject Rate",
};

const UNITS = {
  LowOEE: "%",
  HighDowntime: " min",
  HighRejectRate: "%",
};

const breachRow = (b) => `
  <tr>
    <td style="padding:10px 12px; border-bottom:1px solid #eee; font-size:14px; color:#333;">${LABELS[b.type] || b.type}</td>
    <td style="padding:10px 12px; border-bottom:1px solid #eee; font-size:14px; color:#b91c1c; font-weight:600;">${b.metricValue}${UNITS[b.type] || ""}</td>
    <td style="padding:10px 12px; border-bottom:1px solid #eee; font-size:14px; color:#777;">${b.type === "LowOEE" ? "≥ " : "≤ "}${b.thresholdValue}${UNITS[b.type] || ""}</td>
  </tr>
`;

export const sendSmartAlertMail = async ({ to, shiftName, dateStr, breaches, narrative }) => {
  try {
    const recipients = (Array.isArray(to) ? to : String(to).split(","))
      .map((email) => email.trim())
      .filter(Boolean);

    if (!recipients.length) {
      console.warn(`No recipients for smart alert (${shiftName}, ${dateStr})`);
      return false;
    }

    const mailOptions = {
      from: { name: "WRL Smart Alerts", address: process.env.SMTP_USER },
      to: recipients,
      subject: `⚠ Smart Alert: ${shiftName} — ${dateStr}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Smart Alert</title></head>
        <body style="margin:0; padding:0; font-family:Segoe UI, Arial, sans-serif; background-color:#f4f4f7;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7; padding:30px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.1); overflow:hidden;">
                  <tr>
                    <td style="background-color:#b91c1c; color:#ffffff; padding:24px 20px; text-align:center;">
                      <h1 style="margin:0; font-size:22px;">⚠ Smart Alert</h1>
                      <p style="margin:6px 0 0; font-size:14px; opacity:0.9;">${shiftName} — ${dateStr}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:25px; line-height:1.6; color:#333;">
                      <p style="margin:0 0 16px; font-size:15px;">${narrative}</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eee; border-radius:8px; overflow:hidden;">
                        <tr style="background-color:#f8f8f8;">
                          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#777; text-transform:uppercase;">Metric</td>
                          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#777; text-transform:uppercase;">Value</td>
                          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#777; text-transform:uppercase;">Threshold</td>
                        </tr>
                        ${breaches.map(breachRow).join("")}
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px;">
                      <div style="font-size:11px; color:#9a9a9a; border-top:1px solid #eee; padding-top:15px; text-align:center;">
                        This is a system-generated alert from the WRL Dashboard assistant. Please do not reply to this email.
                      </div>
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
    console.log(`Smart alert email sent to ${recipients.join(", ")} — Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send smart alert email (${shiftName}, ${dateStr}):`, error.message);
    return false;
  }
};
