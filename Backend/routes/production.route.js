import express from "express";
import { getComponentDetails } from "../controllers/production/componentDetails.js";
import {
  componentTraceabilityExportData,
  generateReport,
} from "../controllers/production/componentTraceabilityReport.js";
import {
  getHourlyCategoryCount,
  getHourlyModelCount,
  getHourlySummary,
} from "../controllers/production/hourlyReport.js";
import {
  getFinalLoadingHPFrz,
  getFinalLoadingHPChoc,
  getFinalLoadingHPSUS,
  getFinalLoadingHPCAT,
  getFinalHPCAT,
  getFinalHPChoc,
  getFinalHPFrz,
  getFinalHPSUS,
  getFoamingHpFomA,
  getFoamingHpFomB,
  getFoamingHpFomCat,
  getManualPostHP,
  getPostHPCAT,
  getPostHPFrz,
  getPostHPSUS,
} from "../controllers/production/lineHourlyReport.js";
import {
  getModelName,
  modelNameUpdate,
} from "../controllers/production/modelNameUpdate.js";
import {
  nfcReportExportData,
  getNfcReoprts,
  getQuickFiltersNfcReports,
} from "../controllers/production/nfcReport.js";
import {
  productionReportExportData,
  fetchFGData,
  fetchQuickFiltersData,
} from "../controllers/production/ProductionReport.js";
import {
  getCurrentStageStatus,
  getLogisticStatus,
} from "../controllers/production/stageHistoryReport.js";
import {
  totalProductionExportData,
  getBarcodeDetails,
  getQuickFiltersBarcodeDetails,
} from "../controllers/production/totalProduction.js";

const router = express.Router();

// -----------------> Component Details
router.get("/component-details", getComponentDetails);
// -----------------> Component Traceability
router.get("/component-traceability", generateReport);
router.get("/export-component-traceability", componentTraceabilityExportData);
// -----------------> Hourly Report
router.get("/hourly-summary", getHourlySummary);
router.get("/hourly-model-count", getHourlyModelCount);
router.get("/hourly-category-count", getHourlyCategoryCount);
// -----------------> Line Hourly Report
// FinalHP Routes
router.get("/final-loading-hp-frz", getFinalLoadingHPFrz);
router.get("/final-loading-hp-choc", getFinalLoadingHPChoc);
router.get("/final-loading-hp-sus", getFinalLoadingHPSUS);
router.get("/final-loading-hp-cat", getFinalLoadingHPCAT);

// FinalHP Routes
router.get("/final-hp-frz", getFinalHPFrz);
router.get("/final-hp-choc", getFinalHPChoc);
router.get("/final-hp-sus", getFinalHPSUS);
router.get("/final-hp-cat", getFinalHPCAT);

// PostHP Routes
router.get("/post-hp-frz", getPostHPFrz);
router.get("/manual-post-hp", getManualPostHP);
router.get("/post-hp-sus", getPostHPSUS);
router.get("/post-hp-cat", getPostHPCAT);

// FoamingHP Routes
router.get("/Foaming-hp-fom-a", getFoamingHpFomA);
router.get("/Foaming-hp-fom-b", getFoamingHpFomB);
router.get("/Foaming-hp-fom-cat", getFoamingHpFomCat);
// -----------------> Model Name Update
router.get("/get-model-name", getModelName);
router.put("/update-model-name", modelNameUpdate);
// -----------------> NFC Report
router.get("/nfc-details", getNfcReoprts);
router.get("/export-nfc-report", nfcReportExportData);
router.get("/yday-nfc-report", getQuickFiltersNfcReports);
router.get("/today-nfc-report", getQuickFiltersNfcReports);
router.get("/month-nfc-report", getQuickFiltersNfcReports);
// -----------------> Production Report
router.get("/fgdata", fetchFGData);
router.get("/export-production-report", productionReportExportData);
router.get("/yday-fgdata", fetchQuickFiltersData);
router.get("/today-fgdata", fetchQuickFiltersData);
router.get("/month-fgdata", fetchQuickFiltersData);
// -----------------> Stage History Report
router.get("/stage-history", getCurrentStageStatus);
router.get("/logistic-status", getLogisticStatus);
// -----------------> Total Production
router.get("/barcode-details", getBarcodeDetails);
router.get("/export-total-production", totalProductionExportData);
router.get("/yday-total-production", getQuickFiltersBarcodeDetails);
router.get("/today-total-production", getQuickFiltersBarcodeDetails);
router.get("/month-total-production", getQuickFiltersBarcodeDetails);

export default router;
