/** Chemical Bulk Storage report recipients — CRUD + test/send-now (pool1 / ChemBulkStorageRecipients). */
import sql from "mssql";
import { strOrNull, toBit } from "../masterConfig/helpers.js";
import { buildChemBulkStorageReport, buildChemBulkStorageExcel } from "../../services/chemBulkStorageReport.service.js";
import { sendChemBulkStorageReportMail } from "../../emailTemplates/Chemical_System/chemBulkStorageReport.template.js";

const RECIPIENT_SELECT = `
  SELECT Id AS id, Name AS name, Email AS email, Status AS status
  FROM ChemBulkStorageRecipients`;

export const getRecipients = async (req, res) => {
  try {
    const result = await global.pool1.request().query(`${RECIPIENT_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createRecipient = async (req, res) => {
  try {
    const { name, email, status } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const result = await global.pool1.request()
      .input("name",   sql.NVarChar(150), strOrNull(name))
      .input("email",  sql.NVarChar(200), email)
      .input("status", sql.Bit, toBit(status ?? true))
      .query(`
        INSERT INTO ChemBulkStorageRecipients (Name, Email, Status)
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Email AS email, INSERTED.Status AS status
        VALUES (@name, @email, @status)
      `);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(400).json({ success: false, message: "That email is already in the recipient list." });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateRecipient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status } = req.body;

    const result = await global.pool1.request()
      .input("id",     sql.Int, id)
      .input("name",   sql.NVarChar(150), strOrNull(name))
      .input("email",  sql.NVarChar(200), email)
      .input("status", sql.Bit, toBit(status ?? true))
      .query(`
        UPDATE ChemBulkStorageRecipients SET
          Name = @name, Email = @email, Status = @status, UpdatedAt = GETDATE()
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Email AS email, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Recipient not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(400).json({ success: false, message: "That email is already in the recipient list." });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteRecipient = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool1.request().input("id", sql.Int, id).query(`DELETE FROM ChemBulkStorageRecipients WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const testRecipient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await global.pool1.request()
      .input("id", sql.Int, id)
      .query(`${RECIPIENT_SELECT} WHERE Id = @id`);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Recipient not found" });
    const recipient = result.recordset[0];

    const report = await buildChemBulkStorageReport(global.pool1);
    const attachment = await buildChemBulkStorageExcel(report);
    await sendChemBulkStorageReportMail({ to: recipient.email, ...report, attachment });

    res.json({ success: true, message: `Sent today's report to ${recipient.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const sendReportNow = async (req, res) => {
  try {
    const subsRes = await global.pool1.request().query(`SELECT Email FROM ChemBulkStorageRecipients WHERE Status = 1`);
    const emails = subsRes.recordset.map((r) => r.Email);
    if (!emails.length) return res.status(400).json({ success: false, message: "No active recipients configured." });

    const report = await buildChemBulkStorageReport(global.pool1);
    const attachment = await buildChemBulkStorageExcel(report);
    await sendChemBulkStorageReportMail({ to: emails, ...report, attachment });

    res.json({ success: true, message: `Sent today's report to ${emails.length} recipient(s).` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
