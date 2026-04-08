// ── Tag Update controller — all 4 handlers imported (getTagUpdateLogs was missing before)
import {
  getAssetTagDetails,
  newAssetTagUpdate,
  newCustomerQrUpdate,
  getTagUpdateLogs,          // ← BUG FIX: was not imported or routed
} from "../controllers/quality/tagUpdate.controller.js";

// … all your other imports remain unchanged …
import express from "express";
import {
  addDefect, getAssetDetails, getDefectCategory, getFpaCount,
  getFpaDefect, getFPQIDetails,
} from "../controllers/quality/fpa.controller.js";
import {
  downloadDefectImage, getFpaDailyReport, getFpaMonthlyReport,
  getFpaReport, getFpaYearlyReport,
} from "../controllers/quality/fpaReport.controller.js";
import { getFpaDefectReport } from "../controllers/quality/fpadefectReport.controller.js";
import {
  addLptDefect, getLptAssetDetails, getLptDefectCategory,
  getLptDefectCount, getLptDefectReport,
} from "../controllers/quality/lpt.controller.js";
import { getLptReport } from "../controllers/quality/lptReport.controller.js";
import {
  deleteLptRecipe, getLptRecipe, insertLptRecipe, updateLptRecipe,
} from "../controllers/quality/lptRecipe.controller.js";
import {
  getModlelName, holdCabinet, releaseCabinet,
} from "../controllers/quality/dispatchHold.controller.js";
import {
  handleMulterError, uploadBISReportPDF, uploadFpaDefectImage,
} from "../middlewares/uploadMiddleware.js";
import {
  uploadBisPdfFile, getBisPdfFiles, downloadBisPdfFile,
  deleteBisPdfFile, updateBisPdfFile, getBisReportStatus,
} from "../controllers/quality/UploadBISReport.controller.js";
import { getDispatchHoldDetails } from "../controllers/quality/holdCabinetDetails.controller.js";
import { getCPTReport } from "../controllers/quality/cptReport.controller.js";
import {
  getReworkReport, getReworkReportExport, getReworkReportQuick, getProductionReport,
} from "../controllers/quality/rework.controller.js";
import {
  deleteBeeModel, getBeeModels, saveBeeModels, saveBeeRating,
} from "../controllers/quality/beeCalculation.controller.js";
import {
  getFpaByModel, getFpaDefectDetails, getFpaHistory,
} from "../controllers/quality/fpaHistory.controller.js";

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// CPT
router.get("/cpt-report", getCPTReport);

// FPA
router.get("/fpa-count", getFpaCount);
router.get("/asset-details", getAssetDetails);
router.get("/fpqi-details", getFPQIDetails);
router.get("/fpa-defect", getFpaDefect);
router.get("/fpa-defect-category", getDefectCategory);
router.post("/add-fpa-defect", uploadFpaDefectImage.single("image"), handleMulterError, addDefect);
router.get("/download-fpa-defect-image/:fgSrNo", downloadDefectImage);
router.get("/history", getFpaHistory);
router.get("/model/:model", getFpaByModel);
router.get("/defects/:fgsrNo", getFpaDefectDetails);

// Rework
router.get("/rework-report", getReworkReport);
router.get("/rework-report-export", getReworkReportExport);
router.get("/rework-report-quick", getReworkReportQuick);
router.get("/production-report", getProductionReport);

// FPA Reports
router.get("/fpa-report", getFpaReport);
router.get("/fpa-daily-report", getFpaDailyReport);
router.get("/fpa-monthly-report", getFpaMonthlyReport);
router.get("/fpa-yearly-report", getFpaYearlyReport);
router.get("/fpa-defect-report", getFpaDefectReport);

// LPT
router.get("/lpt-asset-details", getLptAssetDetails);
router.get("/lpt-defect-category", getLptDefectCategory);
router.post("/add-lpt-defect", addLptDefect);
router.get("/lpt-defect-report", getLptDefectReport);
router.get("/lpt-defect-count", getLptDefectCount);
router.get("/lpt-report", getLptReport);

// LPT Recipe
router.get("/lpt-recipe", getLptRecipe);
router.delete("/lpt-recipe/:modelName", deleteLptRecipe);
router.post("/lpt-recipe", insertLptRecipe);
router.put("/lpt-recipe/:modelName", updateLptRecipe);

// Dispatch Hold
router.get("/model-name", getModlelName);
router.post("/hold", holdCabinet);
router.post("/release", releaseCabinet);

// ──────────────────────────────────────────────────────────────────────────────
// Tag Update  ← all 4 routes now registered
router.get("/asset-tag-details", getAssetTagDetails);
router.put("/new-asset-tag", newAssetTagUpdate);
router.put("/new-customer-qr", newCustomerQrUpdate);
router.get("/tag-update-logs", getTagUpdateLogs);   // ← BUG FIX: route was missing entirely

// BIS
router.post("/upload-bis-pdf", uploadBISReportPDF.single("file"), handleMulterError, uploadBisPdfFile);
router.get("/bis-files", getBisPdfFiles);
router.get("/download-bis-file/:srNo", downloadBisPdfFile);
router.delete("/delete-bis-file/:srNo", deleteBisPdfFile);
router.put("/update-bis-file/:srNo", uploadBISReportPDF.single("file"), handleMulterError, updateBisPdfFile);
router.get("/bis-status", getBisReportStatus);

// BEE Calculation
router.get("/bee/models", getBeeModels);
router.post("/bee/models", saveBeeModels);
router.delete("/bee/models/:model", deleteBeeModel);
router.post("/bee/save-rating", saveBeeRating);

// Hold Cabinet Details
router.get("/hold-cabinet-details", getDispatchHoldDetails);

export default router;