import transporter from "../../config/email.config.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));

const buildTable = (rows, title, color) => {
  let table = `
    <h3 style="background-color:${color};color:#ffffff;padding:8px 12px;margin:24px 0 0;border-radius:6px 6px 0 0;font-family:Arial,Helvetica,sans-serif;">${title}</h3>
    <table border="0" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;width:100%;font-size:12px;">
      <tr style="background-color:#f1f5f9;text-align:center;">
        <th style="border:1px solid #e2e8f0;padding:6px;">Tank Code</th>
        <th style="border:1px solid #e2e8f0;padding:6px;">Weight @ 9 AM (kg)</th>
        <th style="border:1px solid #e2e8f0;padding:6px;">Level @ 9 AM (mm)</th>
        <th style="border:1px solid #e2e8f0;padding:6px;">Temp @ 9 AM (°C)</th>
        <th style="border:1px solid #e2e8f0;padding:6px;">Consumption (kg)</th>
        <th style="border:1px solid #e2e8f0;padding:6px;">Reading Time</th>
      </tr>`;

  if (!rows.length) {
    table += `<tr><td colspan="6" style="border:1px solid #e2e8f0;padding:10px;text-align:center;color:#94a3b8;">No 9 AM reading found for today.</td></tr>`;
  } else {
    rows.forEach((r) => {
      table += `
      <tr style="text-align:center;">
        <td style="border:1px solid #e2e8f0;padding:6px;text-align:left;">${escapeHtml(r.tankCode)}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.weight ?? ""}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.level ?? ""}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.temp ?? ""}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${r.consumption ?? ""}</td>
        <td style="border:1px solid #e2e8f0;padding:6px;">${escapeHtml(r.readingTime)}</td>
      </tr>`;
    });
  }
  table += "</table>";
  return table;
};

export const sendChemBulkStorageReportMail = async ({ to, isoRows, polyRows, generatedAt, attachment }) => {
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;">
    <div style="padding:24px 12px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <div style="padding:24px 28px;background:#12336b;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
          <div style="font-size:11px;letter-spacing:1px;font-weight:bold;opacity:.8;">WRL MES</div>
          <div style="margin-top:8px;font-size:22px;font-weight:bold;">Daily Chemical Tank Report</div>
          <div style="margin-top:4px;font-size:12px;opacity:.8;">Generated ${generatedAt.toLocaleString()}</div>
        </div>
        <div style="padding:24px 28px;">
          ${buildTable(isoRows, "ISOCYANATE CHEMICAL DATA", "#dc2626")}
          ${buildTable(polyRows, "RAW POLYOL CHEMICAL DATA", "#16a34a")}
        </div>
        <div style="padding:18px 28px;text-align:center;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:17px;font-family:Arial,Helvetica,sans-serif;">
          Western Refrigeration Pvt. Ltd. &bull; MES Team<br/>This is an automated notification. Please do not reply.
        </div>
      </div>
    </div>
  </body></html>`;

  await transporter.sendMail({
    from: `"WRL Dashboard" <${process.env.SMTP_USER}>`,
    to,
    subject: "Daily Chemical Tank Report",
    html,
    attachments: attachment ? [{
      filename: `ChemBulkStorageReport_${generatedAt.toISOString().slice(0, 10)}.xlsx`,
      content: attachment,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }] : [],
  });
  return true;
};
