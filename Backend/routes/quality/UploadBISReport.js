import express from "express";
import {
  handleMulterError,
  uploadPDF,
} from "../../middlewares/uploadMiddleware.js";
import {
  deleteBisFile,
  downloadBisFile,
  getBisReportFiles,
  updateBisFile,
  uploadBisPdfFile,
} from "../../controllers/quality/UploadBISReport.js";

const router = express.Router();

router.post(
  "/upload-bis-pdf",
  uploadPDF.single("file"),
  handleMulterError,
  uploadBisPdfFile
);
router.get("/bis-files", getBisReportFiles);
router.get("/download-bis-file/:filename", downloadBisFile);
router.delete("/delete-bis-file/:filename", deleteBisFile);
router.put(
  "/update-bis-file/:filename",
  uploadPDF.single("file"),
  handleMulterError,
  updateBisFile
);

export default router;
