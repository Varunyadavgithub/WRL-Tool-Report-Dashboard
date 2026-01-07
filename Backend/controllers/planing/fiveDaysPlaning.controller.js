import path from "path";
import fs from "fs";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const uploadDir = path.resolve("uploads", "FiveDaysPlan");

// Upload file controller
export const uploadPlaningExcelFile = tryCatch((req, res) => {
  if (!req.file) {
    throw new AppError("No file uploaded.", 400);
  }

  res.status(200).json({
    success: true,
    message: "Planning Excel file uploaded successfully.",
    filename: req.file.originalname,
    fileUrl: `/uploads/FiveDaysPlan/${req.file.filename}`,
  });
});

// Get files list controller
export const getPlaningExcelFiles = tryCatch((_, res) => {
  if (!fs.existsSync(uploadDir)) {
    throw new AppError("Upload directory not found.", 500);
  }

  try {
    const files = fs.readdirSync(uploadDir);
    const fileList = files.map((file, index) => ({
      id: index + 1,
      filename: file.trim(),
      url: `/uploads/FiveDaysPlan/${file}`,
    }));

    res.status(200).json({
      success: true,
      message: "Fetched planning files successfully.",
      files: fileList,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch planning files: ${error.message}`, 500);
  }
});

// Download file controller
export const downloadPlaningExcelFile = tryCatch((req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    throw new AppError("File not found.", 404);
  }

  // Using try/catch to handle download errors
  try {
    res.download(filePath, filename, (err) => {
      if (err) {
        throw new AppError(`Failed to download file: ${err.message}`, 500);
      }
    });
  } catch (error) {
    throw new AppError(`Download error: ${error.message}`, 500);
  }
});

export const deletePlaningExcelFile = tryCatch((req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    throw new AppError("File not found.", 404);
  }

  try {
    fs.unlinkSync(filePath);
    res
      .status(200)
      .json({ success: true, message: "File deleted successfully." });
  } catch (error) {
    throw new AppError(`Failed to delete planning file: ${error.message}`, 500);
  }
});
