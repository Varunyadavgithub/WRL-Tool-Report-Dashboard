import transporter from "../../config/email.config.js";
import {
  VISIBLE_PRODUCTION_COLUMNS, computeProductionTotals,
  isProductionSumColumn, isProductionAvgColumn,
} from "../../services/productionExcel.service.js";

const oeeColor = (value) => (value >= 85 ? "#15803d" : value >= 65 ? "#b45309" : "#dc2626");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));

const toDisplayDate = (isoDate) => {
  if (!isoDate) return "—";
  const [year, month, day] = String(isoDate).split("-");
  return year && month && day ? `${day}-${month}-${year}` : String(isoDate);
};

const metricCard = (label, value, color) => `
  <td width="25%" style="padding:4px;vertical-align:top;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;">
      <tr><td style="padding:14px 8px;text-align:center;">
        <div style="font-size:22px;line-height:26px;font-weight:700;color:${color};">${escapeHtml(value)}</div>
        <div style="margin-top:4px;font-size:10px;line-height:14px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</div>
      </td></tr>
    </table>
  </td>`;

const cellStyle = "padding:9px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;line-height:16px;color:#334155;white-space:nowrap;";
const numberCellStyle = `${cellStyle}text-align:center;`;

// Highlight colours for the handful of columns that were called out visually
// in the original 12-column table — every other column just inherits the
// plain cell style. Kept as a lookup rather than per-column config in
// productionExcel.service.js since it's purely an email-body styling choice.
const HIGHLIGHT_COLOR = { componentQty: "#6d28d9", accepted: "#15803d", rejected: "#dc2626" };
const PERCENT_KEYS = new Set(["availability", "performance", "quality", "oee"]);

// Same VISIBLE_PRODUCTION_COLUMNS + value(row) getters that drive the
// Production Report Excel attachment, so the inline table always shows the
// exact same (hidden-columns-excluded) column set as the .xlsx.
const modelRowsHtml = (rows) => (rows || []).map((row) => `
  <tr>
    ${VISIBLE_PRODUCTION_COLUMNS.map((c) => {
      const raw = c.value(row);
      const isOee = c.key === "oee";
      const color = isOee ? oeeColor(Number(raw) || 0) : HIGHLIGHT_COLOR[c.key];
      const bold = c.key === "accepted" || c.key === "rejected" || isOee;
      const suffix = PERCENT_KEYS.has(c.key) ? "%" : "";
      const style = c.align === "center" ? numberCellStyle : cellStyle;
      const extra = `${color ? `color:${color};` : ""}${bold ? "font-weight:700;" : ""}`;
      const display = escapeHtml(raw ?? "") || "—";
      return `<td style="${style}${extra}">${display}${suffix}</td>`;
    }).join("")}
  </tr>`).join("") || `<tr><td colspan="${VISIBLE_PRODUCTION_COLUMNS.length}" style="${cellStyle}text-align:center;color:#64748b;">No production rows were recorded for this shift.</td></tr>`;

const productionHeaderHtml = () => VISIBLE_PRODUCTION_COLUMNS.map((c) => `<th style="padding:10px 8px;text-align:${c.align === "center" ? "center" : "left"};font-size:10px;letter-spacing:.35px;text-transform:uppercase;color:#334155;white-space:nowrap;">${escapeHtml(c.label)}</th>`).join("");

const productionFooterHtml = (rows) => {
  const footerTotals = computeProductionTotals(rows || []);
  return VISIBLE_PRODUCTION_COLUMNS.map((c, i) => {
    let display = "";
    if (i === 0) display = "TOTAL / AVG";
    else if (isProductionSumColumn(c.key)) display = Math.round(footerTotals[c.key] || 0);
    else if (isProductionAvgColumn(c.key)) display = `${(footerTotals[c.key] || 0).toFixed(1)}%`;
    const style = i === 0 ? cellStyle : numberCellStyle;
    const color = c.key === "oee" ? `color:${oeeColor(Number(footerTotals.oee) || 0)};` : "";
    return `<td style="${style}${color}">${escapeHtml(display)}</td>`;
  }).join("");
};

const downtimeRowsHtml = (breakdown) => (breakdown || []).length
  ? breakdown.map((item) => `<tr><td style="${cellStyle}">${escapeHtml(item.reason)}</td><td style="${numberCellStyle}color:#dc2626;font-weight:700;">${escapeHtml(item.mins)} min</td></tr>`).join("")
  : `<tr><td colspan="2" style="${cellStyle}text-align:center;color:#64748b;">No downtime was logged for this shift.</td></tr>`;

export const sendShiftEndReportMail = async ({ to, shiftName, date, rows, totals, downtimeBreakdown, attachments = [], attachedReportNames = [] }) => {
  if (!to || (Array.isArray(to) && to.length === 0)) return false;

  const selectedReports = attachedReportNames.filter(Boolean);
  const attachmentNote = selectedReports.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;"><tr><td style="padding:12px 14px;color:#1e40af;font-size:12px;line-height:18px;"><strong>Excel reports attached</strong><br/>${escapeHtml(selectedReports.join(", "))}. Open the attached .xlsx file${selectedReports.length > 1 ? "s" : ""} to sort, filter, and review the full shift data.</td></tr></table>`
    : "";
  const safeTotals = totals || {};
  const safeShiftName = escapeHtml(shiftName || "Shift");
  const displayDate = toDisplayDate(date);

  const html = `<!doctype html>
  <html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;"><tr><td style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px;background:#12336b;color:#ffffff;">
          <div style="font-size:11px;letter-spacing:1px;font-weight:700;opacity:.78;">WRL MES • SHIFT PERFORMANCE</div>
          <div style="margin-top:8px;font-size:25px;line-height:30px;font-weight:700;">${safeShiftName} Shift Report</div>
          <div style="margin-top:4px;font-size:13px;opacity:.85;">Production date: ${escapeHtml(displayDate)}</div>
        </td></tr>
        <tr><td style="padding:24px 24px 8px;">
          <div style="font-size:15px;font-weight:700;color:#1e293b;">Shift at a glance</div>
          <div style="margin-top:4px;font-size:12px;line-height:18px;color:#64748b;">Key production and quality indicators for the completed shift.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;"><tr>
            ${metricCard("Component quantity", safeTotals.componentQty ?? 0, "#2563eb")}
            ${metricCard("Accepted", safeTotals.accepted ?? 0, "#15803d")}
            ${metricCard("Rejected", safeTotals.rejected ?? 0, "#dc2626")}
            ${metricCard("Average OEE", `${safeTotals.oee ?? 0}%`, oeeColor(Number(safeTotals.oee)))}
          </tr></table>
        </td></tr>
        <tr><td style="padding:20px 24px 0px;">
          <div style="font-size:15px;font-weight:700;color:#1e293b;">Production by model</div>
          <div style="margin:4px 0 10px;font-size:12px;color:#64748b;">Detailed production output and OEE for each configured model.</div>
          <div style="overflow-x:auto;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:8px;border-spacing:0;overflow:hidden;min-width:1500px;">
              <thead><tr style="background:#eaf0fa;">${productionHeaderHtml()}</tr></thead>
              <tbody>${modelRowsHtml(rows)}</tbody>
              <tfoot><tr style="background:#f8fafc;font-weight:700;">${productionFooterHtml(rows)}</tr></tfoot>
            </table>
          </div>
        </td></tr>
        <tr><td style="padding:20px 24px 0;">
          <div style="font-size:15px;font-weight:700;color:#1e293b;">Downtime summary</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;max-width:420px;border:1px solid #e2e8f0;border-radius:8px;border-spacing:0;overflow:hidden;">
            <thead><tr style="background:#fef2f2;"><th style="padding:9px 8px;text-align:left;font-size:10px;letter-spacing:.35px;text-transform:uppercase;color:#7f1d1d;">Reason</th><th style="padding:9px 8px;text-align:center;font-size:10px;letter-spacing:.35px;text-transform:uppercase;color:#7f1d1d;">Duration</th></tr></thead>
            <tbody>${downtimeRowsHtml(downtimeBreakdown)}</tbody>
          </table>
          ${attachmentNote}
        </td></tr>
        <tr><td style="padding:28px 24px 24px;text-align:center;font-size:11px;line-height:17px;color:#94a3b8;">Western Refrigeration Pvt. Ltd. • MES Team<br/>This is an automated operational report. Please do not reply to this email.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  await transporter.sendMail({
    from: `"WRL Production Reports" <${process.env.SMTP_USER}>`,
    to,
    subject: `${shiftName || "Shift"} Shift Report | ${displayDate}`,
    html,
    attachments,
  });
  return true;
};
