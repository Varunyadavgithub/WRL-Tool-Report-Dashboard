import cron from "node-cron";
import { runCalibrationEscalation } from "../services/escalation.service.js";

export const startCalibrationCron = () => {
  // ⏰ Runs every day at 9 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("⏰ Calibration escalation cron started");
    await runCalibrationEscalation();
  });

  console.log("✅ Calibration escalation cron registered (09:00 AM)");
};
