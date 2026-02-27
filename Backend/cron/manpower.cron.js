import cron from "node-cron";
import sql from "mssql";
import { dbConfig3 } from "../config/db.config.js";

export const startManpowerCron = () => {

  // Runs every day at 6:00 PM
  cron.schedule("0 18 * * *", async () => {

    console.log("Running 6PM Manpower Enforcement Job...");

    try {
      const pool = await sql.connect(dbConfig3);

      // Find all requests:
      // - HOD Approved
      // - Plant Head NOT Approved
      // - Not Rejected
      // - Not Final Approved

      const result = await pool.request().query(`
        SELECT *
        FROM ManpowerRequests
        WHERE HODStatus = 'Approved'
          AND (PlantHeadStatus IS NULL OR PlantHeadStatus != 'Approved')
          AND Status NOT IN ('Final Approved', 'Rejected', 'Approved')
      `);

      if (result.recordset.length === 0) {
        console.log("No pending manpower requests for 6PM enforcement.");
        return;
      }

      for (const request of result.recordset) {

        await pool.request()
          .input("Id", sql.Int, request.Id)
          .query(`
            UPDATE ManpowerRequests
            SET Status = 'Waiting HR Approval'
            WHERE Id = @Id
          `);

        console.log(
          `Request ${request.RequestCode} moved to Waiting HR Approval`
        );
      }

      console.log("6PM Enforcement Completed Successfully.");

    } catch (error) {
      console.error("6PM Enforcement Error:", error);
    }

  });

};