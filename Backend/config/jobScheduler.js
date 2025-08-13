import { sendReminderEmail } from "./emailConfig.js";
import sql, { dbConfig1 } from "../config/db.js";
import dotenv from "dotenv";
dotenv.config();

class ReminderScheduler {
  constructor() {
    this.pool = null;
    this.init();
  }

  async init() {
    try {
      // Create connection pool
      this.pool = await sql.connect(dbConfig1);
      console.log("SQL Connection pool initialized successfully");

      // Start job polling mechanism
      this.startJobPolling();
    } catch (error) {
      console.error("Failed to initialize SQL Connection:", error);
    }
  }

  async startJobPolling() {
    // Poll for pending reminder jobs every minute
    setInterval(async () => {
      try {
        await this.processScheduledReminders();
      } catch (error) {
        console.error("Job polling error:", error);
      }
    }, 60000); // 1 minute interval
  }

  async processScheduledReminders() {
    const pool = await sql.connect(dbConfig1);
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();
      const request = new sql.Request(transaction);

      // Select pending reminders due for processing
      const query = `
        SELECT TOP 10 Id, Title, Description, RecptMail, SchldDate
        FROM Reminders
        WHERE Status = 'Scheduled' AND SchldDate <= GETDATE()
        ORDER BY SchldDate ASC
      `;

      const result = await request.query(query);

      for (const reminder of result.recordset) {
        try {
          // Send email
          const emailSent = await sendReminderEmail({
            title: reminder.title,
            description: reminder.description,
            recipientEmail: reminder.recipientEmail,
          });

          // Update reminder status
          const updateQuery = `
            UPDATE Reminders
            SET Status = @Status
            WHERE ID = @ID
          `;

          const updateRequest = new sql.Request(transaction);
          updateRequest.input(
            "Status",
            sql.NVarChar,
            emailSent ? "Sent" : "Failed"
          );
          updateRequest.input("ID", sql.Int, reminder.ID);

          await updateRequest.query(updateQuery);
        } catch (emailError) {
          console.error(
            `Email sending failed for reminder ${reminder.ID}:`,
            emailError
          );

          // Update status to failed
          const failedUpdateQuery = `
            UPDATE Reminders
            SET Status = 'Failed'
            WHERE ID = @ID
          `;

          const failedUpdateRequest = new sql.Request(transaction);
          failedUpdateRequest.input("ID", sql.Int, reminder.ID);
          await failedUpdateRequest.query(failedUpdateQuery);
        }
      }

      await transaction.commit();
    } catch (error) {
      if (transaction && transaction.done === false) {
        await transaction.rollback();
      }
      console.error("Reminder processing error:", error);
    } finally {
      await pool.close();
    }
  }

  async scheduleReminderEmail(reminderData) {
    try {
      const pool = await sql.connect(dbConfig1);
      const request = pool.request();

      // Insert reminder with scheduled status
      const query = `
        INSERT INTO Reminders 
        (Title, Description, RecptMail, SchldDate, Status, CreatedAt)
        VALUES 
        (@Title, @Description, @RecipientEmail, @ScheduleDate, @Status, @CreatedAt)
      `;

      request.input("Title", sql.NVarChar, reminderData.title);
      request.input("Description", sql.NVarChar, reminderData.description);
      request.input("RecipientEmail", sql.NVarChar, reminderData.recptMail);
      request.input("ScheduleDate", sql.DateTime, reminderData.schldDate);
      request.input("Status", sql.NVarChar, "Scheduled");
      request.input("CreatedAt", sql.DateTime, new Date());

      await request.query(query);
      await pool.close();

      console.log(`Reminder job scheduled for ${reminderData.schldDate}`);
      return true;
    } catch (error) {
      console.error("Job scheduling failed:", error);
      return false;
    }
  }

  async cancelReminderJob(reminderId) {
    try {
      const pool = await sql.connect(dbConfig1);
      const request = pool.request();

      // Update reminder status to cancelled
      const query = `
        UPDATE Reminders
        SET Status = 'Cancelled'
        WHERE ID = @ID
      `;

      request.input("ID", sql.Int, reminderId);
      await request.query(query);

      await pool.close();

      console.log(`Cancelled job for reminder ${reminderId}`);
    } catch (error) {
      console.error("Job cancellation failed:", error);
    }
  }
}

export default new ReminderScheduler();