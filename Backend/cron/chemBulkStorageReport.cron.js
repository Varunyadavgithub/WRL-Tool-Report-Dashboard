/**
 * Chemical Bulk Storage report — sends the daily ISO/POLY tank reading
 * summary (ported from the standalone Python script that used to run this
 * externally) to every active recipient in ChemBulkStorageRecipients, once
 * per day at 09:15 (shortly after the 9 AM reading window closes).
 */
import cron from "node-cron";
import { buildChemBulkStorageReport, buildChemBulkStorageExcel } from "../services/chemBulkStorageReport.service.js";
import { sendChemBulkStorageReportMail } from "../emailTemplates/Chemical_System/chemBulkStorageReport.template.js";

const sendDailyReport = async () => {
  const pool = global.pool1;
  if (!pool) return;

  try {
    const subsRes = await pool.request().query(`SELECT Email FROM ChemBulkStorageRecipients WHERE Status = 1`);
    const emails = subsRes.recordset.map((r) => r.Email);
    if (!emails.length) {
      console.log("[ChemBulkStorageReport] No active recipients configured — skipping.");
      return;
    }

    const report = await buildChemBulkStorageReport(pool);
    const attachment = await buildChemBulkStorageExcel(report);
    await sendChemBulkStorageReportMail({ to: emails, ...report, attachment });
    console.log(`[ChemBulkStorageReport] Sent to ${emails.length} recipient(s).`);
  } catch (err) {
    console.error("[ChemBulkStorageReport] Failed:", err.message);
  }
};

export const startChemBulkStorageReportCron = () => {
  cron.schedule("15 9 * * *", sendDailyReport);
  console.log("[ChemBulkStorageReport] Cron started — daily at 09:15.");
};
