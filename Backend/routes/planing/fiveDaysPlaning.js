import express from "express";
import {
  uploadPlanningExcelFile,
  getPlanningExcelFiles,
  downloadPlanningExcelFile,
  deletePlanningExcelFile,
} from "../../controllers/planing/fiveDaysPlaning.js";
import {
  handleMulterError,
  uploadFiveDaysPlanExcel,
} from "../../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/upload-excel",
  uploadFiveDaysPlanExcel.single("file"),
  handleMulterError,
  uploadPlanningExcelFile
);
router.get("/files", getPlanningExcelFiles);
router.get("/download/:filename", downloadPlanningExcelFile);
router.delete("/delete/:filename", deletePlanningExcelFile);

export default router;
