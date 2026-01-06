import { sendGateEntryAlertEmail } from "../../config/emailConfig.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

export const sendMaterialGateEntryAlertEmail = tryCatch(async (req, res) => {
  const { data } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    throw new AppError("No Gate Entry data provided.", 400);
  }

  const emailSent = await sendGateEntryAlertEmail(data);

  if (!emailSent) {
    throw new AppError("Failed to send Gate Entry alert email.", 500);
  }

  res.status(200).json({
    success: true,
    message: "Gate Entry alert sent successfully.",
  });
});
