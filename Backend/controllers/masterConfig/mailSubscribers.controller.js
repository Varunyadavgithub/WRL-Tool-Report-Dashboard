/** Mail Subscribers — CRUD + shift-end test-mail trigger (pool3 / MailSubscribers). */
import sql from "mssql";
import { strOrNull, toBit } from "./helpers.js";
import { sendTestMail } from "../../emailTemplates/PartProcess_System/testMail.template.js";
import { sendShiftEndReportMail } from "../../emailTemplates/PartProcess_System/shiftEndReport.template.js";
import { buildShiftReport } from "../../services/shiftReport.service.js";
import { buildReportAttachments, REPORT_NAMES } from "../../services/reportAttachments.service.js";

// ── Mail Subscribers ─────────────────────────────────────────────────────────
const MAIL_SUBSCRIBER_SELECT = `
  SELECT
    Id AS id, EmpName AS empName, EmpId AS empId, Department AS department, Designation AS designation,
    Email AS email, Mobile AS mobile, Subscriptions AS subscriptions, Frequency AS frequency,
    Whatsapp AS whatsapp, Sms AS sms, Status AS status
  FROM MailSubscribers`;

const mapMailSubscriber = (row) => ({
  ...row,
  subscriptions: row.subscriptions ? row.subscriptions.split("|").map((s) => s.trim()).filter(Boolean) : [],
});

export const getMailSubscribers = async (req, res) => {
  try {
    const result = await global.pool3.request().query(`${MAIL_SUBSCRIBER_SELECT} ORDER BY Id`);
    res.json({ success: true, data: result.recordset.map(mapMailSubscriber) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createMailSubscriber = async (req, res) => {
  try {
    const m = req.body;
    if (!m.empName || !m.email) return res.status(400).json({ success: false, message: "empName and email are required" });

    const result = await global.pool3.request()
      .input("empName",       sql.NVarChar(200), m.empName)
      .input("empId",         sql.NVarChar(50),  strOrNull(m.empId))
      .input("department",    sql.NVarChar(200), strOrNull(m.department))
      .input("designation",   sql.NVarChar(200), strOrNull(m.designation))
      .input("email",         sql.NVarChar(200), m.email)
      .input("mobile",        sql.NVarChar(20),  strOrNull(m.mobile))
      .input("subscriptions", sql.NVarChar(sql.MAX), Array.isArray(m.subscriptions) ? m.subscriptions.join("|") : strOrNull(m.subscriptions))
      .input("frequency",     sql.NVarChar(50),  strOrNull(m.frequency) || "Shift-wise")
      .input("whatsapp",      sql.Bit, toBit(m.whatsapp))
      .input("sms",           sql.Bit, toBit(m.sms))
      .input("status",        sql.Bit, toBit(m.status ?? true))
      .query(`
        INSERT INTO MailSubscribers (EmpName, EmpId, Department, Designation, Email, Mobile, Subscriptions, Frequency, Whatsapp, Sms, Status)
        OUTPUT
          INSERTED.Id AS id, INSERTED.EmpName AS empName, INSERTED.EmpId AS empId, INSERTED.Department AS department, INSERTED.Designation AS designation,
          INSERTED.Email AS email, INSERTED.Mobile AS mobile, INSERTED.Subscriptions AS subscriptions, INSERTED.Frequency AS frequency,
          INSERTED.Whatsapp AS whatsapp, INSERTED.Sms AS sms, INSERTED.Status AS status
        VALUES (@empName, @empId, @department, @designation, @email, @mobile, @subscriptions, @frequency, @whatsapp, @sms, @status)
      `);

    res.json({ success: true, data: mapMailSubscriber(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMailSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const m = req.body;
    const result = await global.pool3.request()
      .input("id",            sql.Int, id)
      .input("empName",       sql.NVarChar(200), m.empName)
      .input("empId",         sql.NVarChar(50),  strOrNull(m.empId))
      .input("department",    sql.NVarChar(200), strOrNull(m.department))
      .input("designation",   sql.NVarChar(200), strOrNull(m.designation))
      .input("email",         sql.NVarChar(200), m.email)
      .input("mobile",        sql.NVarChar(20),  strOrNull(m.mobile))
      .input("subscriptions", sql.NVarChar(sql.MAX), Array.isArray(m.subscriptions) ? m.subscriptions.join("|") : strOrNull(m.subscriptions))
      .input("frequency",     sql.NVarChar(50),  strOrNull(m.frequency) || "Shift-wise")
      .input("whatsapp",      sql.Bit, toBit(m.whatsapp))
      .input("sms",           sql.Bit, toBit(m.sms))
      .input("status",        sql.Bit, toBit(m.status ?? true))
      .query(`
        UPDATE MailSubscribers SET
          EmpName = @empName, EmpId = @empId, Department = @department, Designation = @designation,
          Email = @email, Mobile = @mobile, Subscriptions = @subscriptions, Frequency = @frequency,
          Whatsapp = @whatsapp, Sms = @sms, Status = @status, UpdatedAt = GETDATE()
        OUTPUT
          INSERTED.Id AS id, INSERTED.EmpName AS empName, INSERTED.EmpId AS empId, INSERTED.Department AS department, INSERTED.Designation AS designation,
          INSERTED.Email AS email, INSERTED.Mobile AS mobile, INSERTED.Subscriptions AS subscriptions, INSERTED.Frequency AS frequency,
          INSERTED.Whatsapp AS whatsapp, INSERTED.Sms AS sms, INSERTED.Status AS status
        WHERE Id = @id
      `);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Subscriber not found" });
    res.json({ success: true, data: mapMailSubscriber(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteMailSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request().input("id", sql.Int, id).query(`DELETE FROM MailSubscribers WHERE Id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const toMinsOfDay = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const dateOnly = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Given a test start/end window picked in the UI, resolve which configured
// shift's window the start time falls into and which production day it
// belongs to — same overnight-shift rule the cron and report pages use
// (PartProcessEvents.EventDate is the day the shift STARTED on).
const resolveTestShift = async (pool, startDate, endDate) => {
  const start = new Date(String(startDate).replace(" ", "T"));
  if (Number.isNaN(start.getTime())) throw Object.assign(new Error("Invalid start date/time"), { status: 400 });
  if (endDate) {
    const end = new Date(String(endDate).replace(" ", "T"));
    if (!Number.isNaN(end.getTime()) && end <= start) {
      throw Object.assign(new Error("End date/time must be after start date/time"), { status: 400 });
    }
  }

  const shiftsRes = await pool.request().query(`SELECT ShiftName, StartTime, EndTime FROM ShiftConfigs WHERE Status = 1`);
  const curMins = start.getHours() * 60 + start.getMinutes();
  const matched = shiftsRes.recordset.find((s) => {
    const s0 = toMinsOfDay(s.StartTime);
    let e0 = toMinsOfDay(s.EndTime);
    if (s0 === null || e0 === null) return false;
    if (e0 <= s0) e0 += 1440; // overnight shift
    const tc = curMins < s0 ? curMins + 1440 : curMins;
    return tc >= s0 && tc < e0;
  });
  if (!matched) throw Object.assign(new Error("No configured shift covers that start time."), { status: 400 });

  const s0 = toMinsOfDay(matched.StartTime);
  const e0 = toMinsOfDay(matched.EndTime);
  const isOvernight = e0 <= s0;
  let dateStr;
  if (isOvernight && curMins < s0) {
    const prev = new Date(start); prev.setDate(prev.getDate() - 1);
    dateStr = dateOnly(prev);
  } else {
    dateStr = dateOnly(start);
  }
  return { shiftName: matched.ShiftName, dateStr };
};

// Sends the real shift production report (same content/format the shift-end
// cron sends), so "Send Test Mail" verifies the full pipeline — not just SMTP
// connectivity. By default uses the most recent shift that has data; pass
// startDate/endDate (from the Test modal) to target a specific shift/date
// instead, e.g. to verify a shift that has quality/downtime logs attached.
// Falls back to a plain confirmation email when there's no production data.
export const testMailSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body || {};
    const result = await global.pool3.request()
      .input("id", sql.Int, id)
      .query(`${MAIL_SUBSCRIBER_SELECT} WHERE Id = @id`);

    if (!result.recordset.length) return res.status(404).json({ success: false, message: "Subscriber not found" });
    const subscriber = mapMailSubscriber(result.recordset[0]);

    console.log(`[TestMail] subscriber=${subscriber.email} startDate=${startDate || "(none)"} endDate=${endDate || "(none)"}`);

    let shiftName, dateStr;
    if (startDate) {
      ({ shiftName, dateStr } = await resolveTestShift(global.pool3, startDate, endDate));
      console.log(`[TestMail] resolved shift="${shiftName}" date=${dateStr}`);
    } else {
      const latest = await global.pool3.request().query(`
        SELECT TOP 1 EventDate, ShiftName
        FROM PartProcessEvents
        WHERE ShiftName IS NOT NULL
        ORDER BY EventDate DESC, StartTime DESC
      `);
      if (!latest.recordset.length) {
        await sendTestMail({ to: subscriber.email, empName: subscriber.empName, subscriptions: subscriber.subscriptions });
        return res.json({ success: true, message: `No production data found yet — sent a basic test email to ${subscriber.email}` });
      }
      shiftName = latest.recordset[0].ShiftName;
      dateStr = new Date(latest.recordset[0].EventDate).toISOString().slice(0, 10);
    }

    const report = await buildShiftReport(global.pool3, { shiftName }, dateStr);
    console.log(`[TestMail] buildShiftReport(${shiftName}, ${dateStr}) -> ${report ? `${report.rows.length} row(s)` : "null (no data)"}`);
    if (!report) {
      await sendTestMail({ to: subscriber.email, empName: subscriber.empName, subscriptions: subscriber.subscriptions });
      return res.json({ success: true, message: `No production data for ${shiftName} on ${dateStr} — sent a basic test email to ${subscriber.email}` });
    }

    const reportNames = subscriber.subscriptions.filter((r) => REPORT_NAMES.includes(r));
    const attachmentsByReport = reportNames.length
      ? await buildReportAttachments(global.pool3, { shiftName }, dateStr, reportNames)
      : {};
    const attachments = reportNames.map((r) => attachmentsByReport[r]).filter(Boolean);

    await sendShiftEndReportMail({ to: subscriber.email, ...report, attachments, attachedReportNames: reportNames });

    const builtNames = reportNames.filter((r) => attachmentsByReport[r]);
    const missingNames = reportNames.filter((r) => !attachmentsByReport[r]);
    let attachNote = reportNames.length === 0
      ? " — no reports ticked for this subscriber, so no PDF was attached (edit the subscriber and pick report(s) under Report Subscriptions)"
      : builtNames.length === 0
        ? ` — ${reportNames.join(", ")} selected but no PDF could be built (likely no data for that shift)`
        : missingNames.length
          ? ` with ${builtNames.length} PDF attachment(s): ${builtNames.join(", ")} (skipped ${missingNames.join(", ")} — no data)`
          : ` with ${builtNames.length} PDF attachment(s): ${builtNames.join(", ")}`;
    attachNote = attachNote.replaceAll("PDF", "Excel");
    res.json({ success: true, message: `Sent ${shiftName} (${dateStr}) report to ${subscriber.email}${attachNote}` });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};
