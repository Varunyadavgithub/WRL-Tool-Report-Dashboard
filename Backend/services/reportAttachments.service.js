/**
 * Builds nodemailer-ready PDF attachments for the Mail Config "Report Matrix"
 * report types, for one shift occurrence. Used by the shift-end cron and the
 * "Send Test Mail" action so subscribers get the same Production/Quality/
 * Downtime/Hourly reports as PDFs that the report pages export.
 */
import { buildShiftReport } from "./shiftReport.service.js";
import { buildSectionsPDF } from "./reportPdf.service.js";
import {
  fetchShiftRawData, buildProductionReportBlocks, buildQualityReportBlocks,
  buildDowntimeReportBlocks, buildHourlyReportBlocks,
} from "./reportData.service.js";

export const REPORT_NAMES = ["Production Report", "Quality Report", "Downtime Report", "Hourly Report"];

const BLOCK_BUILDERS = {
  "Production Report": async (pool, shift, dateStr) => {
    const shiftReport = await buildShiftReport(pool, shift, dateStr);
    return shiftReport ? buildProductionReportBlocks(shiftReport) : null;
  },
  "Quality Report":  async (_pool, _shift, _dateStr, raw) => buildQualityReportBlocks(raw),
  "Downtime Report": async (_pool, _shift, _dateStr, raw) => buildDowntimeReportBlocks(raw),
  "Hourly Report":   async (_pool, _shift, _dateStr, raw) => buildHourlyReportBlocks(raw),
};

/**
 * @returns { [reportName]: { filename, content } } — only entries for report
 * names that actually had data are included.
 */
export const buildReportAttachments = async (pool, shift, dateStr, reportNames) => {
  const raw = await fetchShiftRawData(pool, shift, dateStr);
  const attachments = {};

  for (const name of reportNames) {
    const builder = BLOCK_BUILDERS[name];
    if (!builder) continue;
    try {
      const blocks = await builder(pool, shift, dateStr, raw);
      if (!blocks || !blocks.length) continue;

      const content = await buildSectionsPDF({
        title: `${shift.shiftName} — ${name}`,
        subtitle: `${dateStr}  |  Generated ${new Date().toLocaleString()}`,
        blocks,
      });
      attachments[name] = { filename: `${name.replace(/\s+/g, "_")}_${dateStr}.pdf`, content };
    } catch (err) {
      console.error(`[ReportAttachments] Failed building "${name}" PDF:`, err.message);
    }
  }

  return attachments;
};
