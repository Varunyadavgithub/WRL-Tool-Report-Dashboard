import express from "express";
import {
  handleMulterError,
  uploadBISReportPDF,
} from "../../middlewares/uploadMiddleware.js";
import {
  uploadBisPdfFile,
  getBisPdfFiles,
  downloadBisPdfFile,
  deleteBisPdfFile,
  updateBisPdfFile,
  getBisReportStatus,
} from "../../controllers/quality/UploadBISReport.js";

const router = express.Router();

router.post(
  "/upload-bis-pdf",
  uploadBISReportPDF.single("file"),
  handleMulterError,
  uploadBisPdfFile
);
router.get("/bis-files", getBisPdfFiles);
router.get("/download-bis-file/:filename", downloadBisPdfFile);
router.delete("/delete-bis-file/:filename", deleteBisPdfFile);
router.put(
  "/update-bis-file/:filename",
  uploadBISReportPDF.single("file"),
  handleMulterError,
  updateBisPdfFile
);
router.get("/bis-status", getBisReportStatus);

export default router;
