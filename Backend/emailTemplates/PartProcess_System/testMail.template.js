import transporter from "../../config/email.config.js";

// -------------------- Mail Config "Send Test Mail" --------------------
export const sendTestMail = async ({ to, empName, subscriptions = [] }) => {
  const html = `
  <div style="font-family:Arial,sans-serif;padding:15px;color:#1e293b;">
    <h2 style="color:#2575fc;margin-bottom:2px;">Test Email</h2>
    <p style="color:#64748b;margin-top:0;">Mail Configuration — WRL Dashboard</p>

    <p>Hi ${empName || "there"},</p>
    <p>This is a test email confirming your mail subscription is configured correctly. If you received this, emails sent from the WRL Dashboard will reach this inbox.</p>

    ${subscriptions.length ? `
      <p style="margin-bottom:4px;"><b>Subscribed reports:</b></p>
      <ul style="margin-top:0;">
        ${subscriptions.map((s) => `<li>${s}</li>`).join("")}
      </ul>
    ` : `<p style="color:#94a3b8;">No report subscriptions selected yet.</p>`}

    <div style="margin-top:25px;font-size:12px;color:#777;border-top:1px solid #eee;padding-top:15px;text-align:center;">
      <div style="font-size:11px;color:#9a9a9a;">
        © ${new Date().getFullYear()} MES Team | Western Refrigeration Pvt. Ltd.<br/>
        This is a system-generated test notification. Please do not reply to this email.
      </div>
    </div>
  </div>
  `;

  await transporter.sendMail({
    from: `"WRL Dashboard" <${process.env.SMTP_USER}>`,
    to,
    subject: "Test Email — Mail Configuration",
    html,
  });
  return true;
};
