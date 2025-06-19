import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads", "FiveDaysPlan");

// Upload file controller
export const uploadPlanningExcelFile = (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  return res.status(200).json({
    success: true,
    filename: req.file.originalname,
    fileUrl: `/uploads/FiveDaysPlan/${req.file.filename}`,
  });
};

// Get files list controller
export const getPlanningExcelFiles = (_, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const fileList = files.map((file, index) => ({
      id: index + 1,
      filename: file.trim(),
      url: `/uploads/FiveDaysPlan/${file}`,
    }));
    res.status(200).json({ success: true, files: fileList });
  } catch (error) {
    console.error("Error reading files:", error.message);
    res.status(500).json({ success: false, message: "Error reading files" });
  }
};

// Download file controller
export const downloadPlanningExcelFile = (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error("Download error:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Failed to download file" });
    }
  });
};

// Delete file controller
export const deletePlanningExcelFile = (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  try {
    fs.unlinkSync(filePath);
    res
      .status(200)
      .json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete file" });
  }
};
