// uploadMiddleware.js
import multer from "multer";
import path from "path";
import fs from "fs";

// Create uploads directory if not exists
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Generic storage configuration
const createStorage = (prefix = "file") => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  });
};

// File type configurations
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
    maxSize: 5 * 1024 * 1024, // 5MB
  },
};

// Generic file filter
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
export const uploadExcel = multer({
  storage: createStorage("excel"),
  fileFilter: createFileFilter("excel"),
  limits: {
    fileSize: fileTypes.excel.maxSize,
  },
});

export const uploadPDF = multer({
  storage: createStorage("pdf"),
  fileFilter: createFileFilter("pdf"),
  limits: {
    fileSize: fileTypes.pdf.maxSize,
  },
});

// Utility function for error handling
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading.
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
    });
  } else if (err) {
    // An unknown error occurred when uploading.
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  }
  next();
};
