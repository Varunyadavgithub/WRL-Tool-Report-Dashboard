import multer from "multer";
import path from "path";
import fs from "fs";

/* ===================== BASE UPLOADS DIR ===================== */

// Create uploads directory if not exists
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

/* ===================== SUB DIRECTORIES ===================== */

const bisReportDir = path.resolve(uploadsDir, "BISReport");
const fpaDefectImagesDir = path.resolve(uploadsDir, "FpaDefectImages");
const calibrationDir = path.resolve(uploadsDir, "Calibration");

if (!fs.existsSync(bisReportDir)) fs.mkdirSync(bisReportDir);
if (!fs.existsSync(fpaDefectImagesDir)) fs.mkdirSync(fpaDefectImagesDir);
if (!fs.existsSync(calibrationDir)) fs.mkdirSync(calibrationDir);

/* ===================== STORAGE FACTORY ===================== */

const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.resolve(uploadsDir, folder);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const baseFileName = path
        .basename(file.originalname, ext)
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "");

      let uniqueFilename;

      // Special handling for FPA defect images
      if (folder === "FpaDefectImages") {
        const { FGSerialNumber } = req.body;
        if (!FGSerialNumber) {
          return cb(new Error("FGSerialNumber is required for defect images"));
        }
        uniqueFilename = `${FGSerialNumber}-${Date.now()}${ext}`;
      } else {
        const uniqueValue = Math.floor(
          100000 + Math.random() * 900000,
        ).toString();
        uniqueFilename = `${baseFileName}-${uniqueValue}${ext}`;
      }

      cb(null, uniqueFilename);
    },
  });
};

/* ===================== FILE TYPE CONFIGS ===================== */

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

/* ===================== IMAGE CONFIG ===================== */

const imageFileTypes = {
  allowedTypes: ["image/jpeg", "image/jpg", "image/png"],
  maxSize: 5 * 1024 * 1024, // 5MB
  errorMessage: "Only JPG, JPEG, PNG images under 5MB are allowed",
};

/* ===================== CALIBRATION CONFIG ===================== */

const calibrationFileTypes = {
  allowedTypes: [
    "application/pdf",
    "application/x-pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ],
  errorMessage: "Only PDF or image files are allowed for calibration",
  maxSize: 10 * 1024 * 1024, // 10MB
};

/* ===================== FILE FILTERS ===================== */

const createFileFilter = (fileType) => (_, file, cb) => {
  const config = fileTypes[fileType];
  if (config.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(config.errorMessage), false);
  }
};

const imageFileFilter = (_, file, cb) => {
  if (imageFileTypes.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(imageFileTypes.errorMessage), false);
  }
};

const calibrationFileFilter = (_, file, cb) => {
  if (calibrationFileTypes.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(calibrationFileTypes.errorMessage), false);
  }
};

/* ===================== UPLOAD MIDDLEWARES ===================== */

// BIS Report PDF
export const uploadBISReportPDF = multer({
  storage: createStorage("BISReport"),
  fileFilter: createFileFilter("pdf"),
  limits: { fileSize: fileTypes.pdf.maxSize },
});

// FPA Defect Images
export const uploadFpaDefectImage = multer({
  storage: createStorage("FpaDefectImages"),
  fileFilter: imageFileFilter,
  limits: { fileSize: imageFileTypes.maxSize },
});

// ✅ Calibration Report Upload
export const uploadCalibrationReport = multer({
  storage: createStorage("Calibration"),
  fileFilter: calibrationFileFilter,
  limits: { fileSize: calibrationFileTypes.maxSize },
});

/* ===================== ERROR HANDLER ===================== */

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ success: false, message: err.message || "File upload error" });
  } else if (err) {
    return res
      .status(400)
      .json({ success: false, message: err.message || "File upload failed" });
  }
  next();
};
