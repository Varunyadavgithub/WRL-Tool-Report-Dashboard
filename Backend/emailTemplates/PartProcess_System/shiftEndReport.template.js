import transporter from "../../config/email.config.js";

const oeeColor = (v) => (v >= 85 ? "#16a34a" : v >= 65 ? "#d97706" : "#dc2626");

const toDisplayDate = (isoDate) => {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
};

const modelRowsHtml = (rows) => rows.map((r) => `
  <tr>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;">${r.sapCode}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;">${r.itemDescription}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${r.planQty}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${r.actualQty}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#7c3aed;">${r.componentQty}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;font-weight:bold;">${r.accepted}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:bold;">${r.rejected}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${r.lossMins}</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${r.availability}%</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${r.performance}%</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${r.quality}%</td>
    <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:${oeeColor(r.oee)};">${r.oee}%</td>
  </tr>
`).join("");

const downtimeRowsHtml = (breakdown) => breakdown.length
  ? breakdown.map((d) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;">${d.reason}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:bold;">${d.mins}</td>
    </tr>
  `).join("")
  : `<tr><td colspan="2" style="padding:8px;text-align:center;color:#94a3b8;">No downtime logged</td></tr>`;

export const sendShiftEndReportMail = async ({ to, shiftName, date, rows, totals, downtimeBreakdown, attachments = [], attachedReportNames = [] }) => {
  if (!to || (Array.isArray(to) && to.length === 0)) return false;

  const extraReports = attachedReportNames.filter((n) => n !== "Production Report");
  const attachmentNote = extraReports.length
    ? `<div style="margin-top:16px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;color:#1e40af;">
         📎 Also attached as PDF: ${extraReports.join(", ")}
       </div>`
    : "";

  const html = `
  <div style="font-family:Arial,sans-serif;padding:15px;color:#1e293b;">
    <h2 style="color:#2575fc;margin-bottom:2px;">${shiftName} — Production Report</h2>
    <p style="color:#64748b;margin-top:0;">${toDisplayDate(date)}</p>

    <table cellpadding="0" cellspacing="0" style="margin:10px 0 18px;">
      <tr>
        ${[
          ["Component Qty", totals.componentQty, "#2563eb"],
          ["Accepted", totals.accepted, "#16a34a"],
          ["Rejected", totals.rejected, "#dc2626"],
          ["Avg OEE", `${totals.oee}%`, oeeColor(totals.oee)],
        ].map(([label, value, color]) => `
          <td style="padding:10px 18px;text-align:center;">
            <div style="font-size:20px;font-weight:bold;color:${color};">${value}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">${label}</div>
          </td>
        `).join("")}
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;">
          ${["SAP Code","Item Description","Plan Qty","Sheet Qty","Component Qty","Accepted","Rejected","Loss (min)","A (%)","P (%)","Q (%)","OEE (%)"]
            .map((h) => `<th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${modelRowsHtml(rows)}</tbody>
      <tfoot>
        <tr style="background:#f8fafc;font-weight:bold;">
          <td colspan="3" style="padding:6px 8px;border:1px solid #e2e8f0;">TOTAL</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${totals.actualQty}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#7c3aed;">${totals.componentQty}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;">${totals.accepted}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;">${totals.rejected}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${totals.lossMins}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${totals.availability}%</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${totals.performance}%</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${totals.quality}%</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;color:${oeeColor(totals.oee)};">${totals.oee}%</td>
        </tr>
      </tfoot>
    </table>

    <h3 style="margin-top:22px;margin-bottom:6px;color:#334155;font-size:14px;">Downtime Breakdown</h3>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:420px;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">Reason</th>
          <th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">Minutes</th>
        </tr>
      </thead>
      <tbody>${downtimeRowsHtml(downtimeBreakdown)}</tbody>
    </table>
    ${attachmentNote}

    <div style="margin-top:25px;font-size:12px;color:#777;border-top:1px solid #eee;padding-top:15px;text-align:center;">
      <div style="font-size:11px;color:#9a9a9a;">
        © ${new Date().getFullYear()} MES Team | Western Refrigeration Pvt. Ltd.<br/>
        This is a system-generated notification. Please do not reply to this email.
      </div>
    </div>
  </div>
  `;

  await transporter.sendMail({
    from: `"WRL Production Reports" <${process.env.SMTP_USER}>`,
    to,
    subject: `${shiftName} Production Report — ${toDisplayDate(date)}`,
    html,
    attachments,
  });
  return true;
};
