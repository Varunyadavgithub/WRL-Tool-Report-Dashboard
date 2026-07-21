import transporter from "../../config/email.config.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));

// Used when no shift data is available, so Mail Config can still verify SMTP delivery.
export const sendTestMail = async ({ to, empName, subscriptions = [] }) => {
  const reportList = subscriptions.length
    ? `<div style="margin-top:18px;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;"><strong style="color:#1e3a8a;">Selected Excel reports</strong><div style="margin-top:7px;color:#334155;">${subscriptions.map(escapeHtml).join(" &bull; ")}</div></div>`
    : `<div style="margin-top:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#64748b;">No report subscriptions have been selected yet.</div>`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <div style="padding:24px 12px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <div style="padding:24px 28px;background:#12336b;color:#ffffff;"><div style="font-size:11px;letter-spacing:1px;font-weight:bold;opacity:.8;">WRL MES</div><div style="margin-top:8px;font-size:24px;font-weight:bold;">Mail configuration test</div></div>
        <div style="padding:24px 28px;font-size:14px;line-height:21px;"><p style="margin-top:0;">Hi ${escapeHtml(empName || "there")},</p><p>This confirms that your Part Process report subscription can receive emails from the WRL Dashboard.</p>${reportList}<p style="margin-bottom:0;color:#64748b;font-size:12px;">When a subscribed shift report is sent, its selected report data will be attached as an Excel (.xlsx) file.</p></div>
        <div style="padding:18px 28px;text-align:center;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:17px;">Western Refrigeration Pvt. Ltd. &bull; MES Team<br/>This is an automated test notification. Please do not reply.</div>
      </div>
    </div>
  </body></html>`;

  await transporter.sendMail({
    from: `"WRL Dashboard" <${process.env.SMTP_USER}>`,
    to,
    subject: "Mail Configuration Test | WRL MES",
    html,
  });
  return true;
};
