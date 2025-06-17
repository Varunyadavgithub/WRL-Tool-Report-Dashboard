import express from "express";
import {
  uploadFile,
  getFiles,
  downloadFile,
  deleteFile,
} from "../../controllers/planing/fiveDaysPlaning.js";
import {
  handleMulterError,
  uploadExcel,
} from "../../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/upload-excel",
  uploadExcel.single("file"),
  handleMulterError,
  uploadFile
);
router.get("/files", getFiles);
router.get("/download/:filename", downloadFile);
router.delete("/delete/:filename", deleteFile);

export default router;
