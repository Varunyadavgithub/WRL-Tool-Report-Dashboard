import { sendGateEntryReportEmail } from "../../config/emailConfig.js";

export const sendMaterialGateEntryEmail = async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No Gate Entry data provided." });
    }

    const emailSent = await sendGateEntryReportEmail(data);

    if (emailSent) {
      return res.status(200).json({
        success: true,
        message: "Gate Entry report sent successfully.",
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to send email." });
    }
  } catch (error) {
    console.error("Error in sendGateEntryEmail controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};
