import multer from "multer";
import path from "path";
import fs from "fs";

// Create uploads directory if not exists
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Ensure subdirectories exist
const fiveDaysPlanDir = path.resolve(uploadsDir, "FiveDaysPlan");
const bisReportDir = path.resolve(uploadsDir, "BISReport");

if (!fs.existsSync(fiveDaysPlanDir)) {
  fs.mkdirSync(fiveDaysPlanDir);
}

if (!fs.existsSync(bisReportDir)) {
  fs.mkdirSync(bisReportDir);
}

// Generic storage configuration
const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.resolve(uploadsDir, folder);
      cb(null, uploadPath);
    },
    filename: (_, file, cb) => {
      cb(null, file.originalname);
    },
  });
};

// File type configurations (keep existing)
const fileTypes = {
  excel: {
    allowedTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
    errorMessage: "Only Excel files are allowed (.xlsx, .xls)",
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  pdf: {
    allowedTypes: ["application/pdf", "application/x-pdf"],
    errorMessage: "Only PDF files are allowed",
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};

// Generic file filter (keep existing)
const createFileFilter = (fileType) => {
  return (_, file, cb) => {
    const config = fileTypes[fileType];

    if (config.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(config.errorMessage), false);
    }
  };
};

// Create upload middlewares
export const uploadFiveDaysPlanExcel = multer({
  storage: createStorage("FiveDaysPlan"),
  fileFilter: createFileFilter("excel"),
  limits: {
    fileSize: fileTypes.excel.maxSize,
  },
});

export const uploadBISReportPDF = multer({
  storage: createStorage("BISReport"),
  fileFilter: createFileFilter("pdf"),
  limits: {
    fileSize: fileTypes.pdf.maxSize,
  },
});

// Existing error handling middleware
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  }
  next();
};
