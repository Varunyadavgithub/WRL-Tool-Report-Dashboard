import { sendReminderEmail } from "../../config/emailConfig.js";
import ReminderScheduler from "../../config/jobScheduler.js";
import sql, { dbConfig1 } from "../../config/db.js";

export const createReminder = async (req, res) => {
  const pool = await sql.connect(dbConfig1);
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    const { Title, Department, Description, SchldDate, RecptMail, Priority } =
      req.body;

    const currentDate = new Date();
    const scheduleDateTime = new Date(SchldDate);

    const insertQuery = `
      INSERT INTO Reminders 
      (Title, Description, RecptMail, SchldDate, Status, Department, Priority, CreatedAt) 
      OUTPUT INSERTED.ID
      VALUES 
      (@Title, @Desc, @RecptMail, @SchldDate, @Status, @Department, @Priority, @CreatedAt)
    `;

    request.input("Title", sql.NVarChar, Title);
    request.input("Desc", sql.NVarChar, Description);
    request.input("RecptMail", sql.NVarChar, RecptMail);
    request.input("SchldDate", sql.DateTime, scheduleDateTime);
    request.input("Department", sql.NVarChar, Department);
    request.input("Priority", sql.NVarChar, Priority);
    request.input("CreatedAt", sql.DateTime, currentDate);

    let immediateEmailSent = false;
    let scheduledJobCreated = false;

    // Check if schedule is in past or present
    if (scheduleDateTime <= currentDate) {
      request.input("Status", sql.NVarChar, "Sent");
      // Send immediate email
      immediateEmailSent = await sendReminderEmail({
        title: Title,
        description: Description,
        recipientEmail: RecptMail,
        scheduleDate: SchldDate,
        priority: Priority,
      });
    } else {
      request.input("Status", sql.NVarChar, "Scheduled");
      // Schedule future email
      scheduledJobCreated = await ReminderScheduler.scheduleReminderEmail({
        title: Title,
        description: Description,
        recipientEmail: RecptMail,
        scheduleDate: SchldDate,
        priority: Priority,
      });
    }

    const result = await request.query(insertQuery);
    const reminderId = result.recordset[0].ID;

    await transaction.commit();

    res.status(201).json({
      success: true,
      reminderId,
      immediateEmailSent,
      scheduledJobCreated,
      message:
        scheduleDateTime <= currentDate
          ? "Reminder created and email sent immediately"
          : "Reminder created and scheduled for future",
    });
  } catch (error) {
    if (transaction.done === false) {
      await transaction.rollback();
    }

    console.error("Reminder creation error:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    await pool.close();
  }
};

export const getAllReminders = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig1);

    const request = pool.request();

    const query = `
      SELECT * FROM Reminders 
      ORDER BY CreatedAt ASC
    `;

    const result = await request.query(query);
    const data = result.recordset.length > 0 ? result.recordset : [];

    await pool.close();

    res.status(200).json({
      success: true,
      reminders: data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await sql.connect(dbConfig1);
    const request = pool.request();

    request.input("Id", sql.Int, id);

    const deleteQuery = `
      DELETE FROM Reminders 
      WHERE ID = @Id
    `;

    const result = await request.query(deleteQuery);

    await pool.close();

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Reminder deleted successfully",
      id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelReminder = async (req, res) => {
  const pool = await sql.connect(dbConfig1);

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    const { id } = req.params;

    // Cancel scheduled job
    await ReminderScheduler.cancelReminderJob(id);

    // Delete reminder
    request.input("Id", sql.Int, id);

    const deleteQuery = `
      DELETE FROM Reminders 
      WHERE ID = @Id
    `;

    const result = await request.query(deleteQuery);
    await transaction.commit();

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Reminder and scheduled job cancelled successfully",
    });
  } catch (error) {
    if (transaction.done === false) {
      await transaction.rollback();
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await pool.close();
  }
};
