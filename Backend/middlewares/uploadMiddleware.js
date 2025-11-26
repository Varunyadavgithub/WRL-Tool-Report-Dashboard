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
const fpaDefectImagesDir = path.resolve(uploadsDir, "FpaDefectImages");

if (!fs.existsSync(fiveDaysPlanDir)) {
  fs.mkdirSync(fiveDaysPlanDir);
}

if (!fs.existsSync(bisReportDir)) {
  fs.mkdirSync(bisReportDir);
}

if (!fs.existsSync(fpaDefectImagesDir)) {
  fs.mkdirSync(fpaDefectImagesDir);
}

// Generic storage configuration
const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.resolve(uploadsDir, folder);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueValue = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      const ext = path.extname(file.originalname);
      const baseFileName = path.basename(file.originalname, ext);

      // Create unique filename
      const uniqueFilename = `${baseFileName}-${uniqueValue}${ext}`;
      cb(null, uniqueFilename);
    },
  });
};

// # File type configurations (keep existing)
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

// # Image file settings
const imageFileTypes = {
  allowedTypes: ["image/jpeg", "image/jpg", "image/png"],
  maxSize: 5 * 1024 * 1024, // 5MB
  errorMessage: "Only JPG, JPEG, PNG images under 5MB are allowed",
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

// Image file filter
const imageFileFilter = (_, file, cb) => {
  if (imageFileTypes.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(imageFileTypes.errorMessage), false);
  }
};

// Upload Five Days Plan Excel middlewares
export const uploadFiveDaysPlanExcel = multer({
  storage: createStorage("FiveDaysPlan"),
  fileFilter: createFileFilter("excel"),
  limits: {
    fileSize: fileTypes.excel.maxSize,
  },
});

// Upload BIS Report PDF middlewares
export const uploadBISReportPDF = multer({
  storage: createStorage("BISReport"),
  fileFilter: createFileFilter("pdf"),
  limits: {
    fileSize: fileTypes.pdf.maxSize,
  },
});

// FPA Defect Image Upload Middleware
export const uploadFpaDefectImage = multer({
  storage: createStorage("FpaDefectImages"),
  fileFilter: imageFileFilter,
  limits: { fileSize: imageFileTypes.maxSize },
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
