// ── Tag Update controller — all 4 handlers imported (getTagUpdateLogs was missing before)
import {
  getAssetTagDetails,
  newAssetTagUpdate,
  newCustomerQrUpdate,
  getTagUpdateLogs,          // ← BUG FIX: was not imported or routed
} from "../controllers/quality/tagUpdate.controller.js";

// … all your other imports remain unchanged …
import express from "express";
import { authenticate } from "../middlewares/auth.js";
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
import { getLptReport, getLptModelSummary } from "../controllers/quality/lptReport.controller.js";
import { getMassFlowReport } from "../controllers/quality/massFlowReport.controller.js";
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
  updateBisEnergyData, fetchBisEnergyData,
} from "../controllers/quality/UploadBISReport.controller.js";
import { getDispatchHoldDetails } from "../controllers/quality/holdCabinetDetails.controller.js";
import { getCPTReport } from "../controllers/quality/cptReport.controller.js";
import {
  getReworkReport,
  getReworkReportQuick,
  getReworkReportExport,
  getReworkSummaryExport,
  getReworkDefectExport,
  getProductionReport,
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
router.get("/cpt-report", authenticate, getCPTReport);

// FPA
router.get("/fpa-count", authenticate, getFpaCount);
router.get("/asset-details", authenticate, getAssetDetails);
router.get("/fpqi-details", authenticate, getFPQIDetails);
router.get("/fpa-defect", authenticate, getFpaDefect);
router.get("/fpa-defect-category", authenticate, getDefectCategory);
router.post("/add-fpa-defect", authenticate, uploadFpaDefectImage.single("image"), handleMulterError, addDefect);
router.get("/download-fpa-defect-image/:fgSrNo", authenticate, downloadDefectImage);
router.get("/history", authenticate, getFpaHistory);
router.get("/model/:model", authenticate, getFpaByModel);
router.get("/defects/:fgsrNo", authenticate, getFpaDefectDetails);

// Rework
router.get("/rework-report", authenticate, getReworkReport);
router.get("/rework-report-quick", authenticate, getReworkReportQuick);
router.get("/rework-report-export", authenticate, getReworkReportExport);
router.get("/rework-summary-export", authenticate, getReworkSummaryExport);
router.get("/rework-defect-export", authenticate, getReworkDefectExport);
router.get("/production-report", authenticate, getProductionReport);

// FPA Reports
router.get("/fpa-report", authenticate, getFpaReport);
router.get("/fpa-daily-report", authenticate, getFpaDailyReport);
router.get("/fpa-monthly-report", authenticate, getFpaMonthlyReport);
router.get("/fpa-yearly-report", authenticate, getFpaYearlyReport);
router.get("/fpa-defect-report", authenticate, getFpaDefectReport);

// LPT
router.get("/lpt-asset-details", authenticate, getLptAssetDetails);
router.get("/lpt-defect-category", authenticate, getLptDefectCategory);
router.post("/add-lpt-defect", authenticate, addLptDefect);
router.get("/lpt-defect-report", authenticate, getLptDefectReport);
router.get("/lpt-defect-count", authenticate, getLptDefectCount);
router.get("/lpt-report", authenticate, getLptReport);
router.get("/lpt-model-summary", authenticate, getLptModelSummary);

// Mass Flow
router.get("/mass-flow-report", authenticate, getMassFlowReport);

// LPT Recipe
router.get("/lpt-recipe", authenticate, getLptRecipe);
router.delete("/lpt-recipe/:modelName", authenticate, deleteLptRecipe);
router.post("/lpt-recipe", authenticate, insertLptRecipe);
router.put("/lpt-recipe/:modelName", authenticate, updateLptRecipe);

// Dispatch Hold
router.get("/model-name", authenticate, getModlelName);
router.post("/hold", authenticate, holdCabinet);
router.post("/release", authenticate, releaseCabinet);

// ──────────────────────────────────────────────────────────────────────────────
// Tag Update  ← all 4 routes now registered
router.get("/asset-tag-details", authenticate, getAssetTagDetails);
router.put("/new-asset-tag", authenticate, newAssetTagUpdate);
router.put("/new-customer-qr", authenticate, newCustomerQrUpdate);
router.get("/tag-update-logs", authenticate, getTagUpdateLogs);   // ← BUG FIX: route was missing entirely

// BIS
router.post("/upload-bis-pdf", authenticate, uploadBISReportPDF.single("file"), handleMulterError, uploadBisPdfFile);
router.get("/bis-files", authenticate, getBisPdfFiles);
router.get("/download-bis-file/:srNo", authenticate, downloadBisPdfFile);
router.delete("/delete-bis-file/:srNo", authenticate, deleteBisPdfFile);
router.put("/update-bis-file/:srNo", authenticate, uploadBISReportPDF.single("file"), handleMulterError, updateBisPdfFile);
router.get("/bis-status", authenticate, getBisReportStatus);
router.put("/bis-energy-data/:srNo", authenticate, updateBisEnergyData);
router.post("/bis-fetch-energy-data/:srNo", authenticate, fetchBisEnergyData);

// BEE Calculation
router.get("/bee/models", authenticate, getBeeModels);
router.post("/bee/models", authenticate, saveBeeModels);
router.delete("/bee/models/:model", authenticate, deleteBeeModel);
router.post("/bee/save-rating", authenticate, saveBeeRating);

// Hold Cabinet Details
router.get("/hold-cabinet-details", authenticate, getDispatchHoldDetails);

export default router;
