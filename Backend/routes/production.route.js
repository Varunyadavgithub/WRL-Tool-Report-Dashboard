import express from "express";
import {
  componentTraceabilityExportData,
  generateReport,
} from "../controllers/production/componentTraceabilityReport.controller.js";
import {
  getHourlyCategoryCount,
  getHourlyModelCount,
  getHourlySummary,
} from "../controllers/production/hourlyReport.controller.js";
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
  getFinalLoadingHPVISI,
  getFinalHPVISI,
  getPostHPVISI,
} from "../controllers/production/lineHourlyReport.controller.js";
import {
  getFinalLoadingModelBreakdown,
  getFinalLoadingHPFrzModelBreakdown,
  getFinalLoadingHPChocModelBreakdown,
  getFinalLoadingHPVISIModelBreakdown,
  getFinalLoadingHPSUSModelBreakdown,
  getFinalHPFrzModelBreakdown,
  getFinalHPChocModelBreakdown,
  getFinalHPVISIModelBreakdown,
  getFinalHPSUSModelBreakdown,
  getPostHPFrzModelBreakdown,
  getManualPostHPModelBreakdown,
  getPostHPVISIModelBreakdown,
  getPostHPSUSModelBreakdown,
  getFoamingHpFomAModelBreakdown,
  getFoamingHpFomBModelBreakdown,
} from "../controllers/production/modelBreakdown.controller.js";
import {
  getModelName,
  modelNameUpdate,
} from "../controllers/production/modelNameUpdate.controller.js";
import {
  nfcReportExportData,
  getNfcReoprts,
  getQuickFiltersNfcReports,
} from "../controllers/production/nfcReport.controller.js";
import {
  productionReportExportData,
  fetchFGData,
  fetchQuickFiltersData,
} from "../controllers/production/ProductionReport.controller.js";
import {
  getCurrentStageStatus,
  getHistoryCard,
  getLogisticStatus,
  getComponentDetails,
  getReprintHistory,
  getReworkReport,
  getFunctionalTest,
  getSerialNumbers,
} from "../controllers/production/consolidatedReport.controller.js";
import {
  totalProductionExportData,
  getBarcodeDetails,
  getQuickFiltersBarcodeDetails,
} from "../controllers/production/totalProduction.controller.js";
import {
  getStopLossDetail,
  getStopLossLocations,
  getStopLossSummary,
} from "../controllers/production/stopLoss.controller.js";

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
// Final Loading Routes
router.get("/final-loading-hp-frz", getFinalLoadingHPFrz);
router.get("/final-loading-hp-choc", getFinalLoadingHPChoc);
router.get("/final-loading-hp-sus", getFinalLoadingHPSUS);
router.get("/final-loading-hp-cat", getFinalLoadingHPCAT);

// Final Line Routes
router.get("/final-hp-frz", getFinalHPFrz);
router.get("/final-hp-choc", getFinalHPChoc);
router.get("/final-hp-sus", getFinalHPSUS);
router.get("/final-hp-cat", getFinalHPCAT);

// Post Foaming Routes
router.get("/post-hp-frz", getPostHPFrz);
router.get("/manual-post-hp", getManualPostHP);
router.get("/post-hp-sus", getPostHPSUS);
router.get("/post-hp-cat", getPostHPCAT);

// Foaming Routes
router.get("/Foaming-hp-fom-a", getFoamingHpFomA);
router.get("/Foaming-hp-fom-b", getFoamingHpFomB);
router.get("/Foaming-hp-fom-cat", getFoamingHpFomCat);

// VISI Cooler Routes (merged into existing tabs — no new tab)
router.get("/visi-loading-hp", getFinalLoadingHPVISI);
router.get("/visi-final-hp", getFinalHPVISI);
router.get("/visi-post-hp", getPostHPVISI);

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
// -----------------> Consolidated Report
router.get("/stage-history", getCurrentStageStatus);
router.get("/logistic-status", getLogisticStatus);
router.get("/history-card", getHistoryCard);
router.get("/rework-report", getReworkReport);
router.get("/reprint-history", getReprintHistory);
router.get("/component-details", getComponentDetails);
router.get("/functional-test", getFunctionalTest);
router.get("/serial-numbers", getSerialNumbers);
// -----------------> Total Production
router.get("/barcode-details", getBarcodeDetails);
router.get("/export-total-production", totalProductionExportData);
router.get("/yday-total-production", getQuickFiltersBarcodeDetails);
router.get("/today-total-production", getQuickFiltersBarcodeDetails);
router.get("/month-total-production", getQuickFiltersBarcodeDetails);
// -----------------> Stop Loss Report
router.get("/stop-loss/summary", getStopLossSummary);
router.get("/stop-loss/detail", getStopLossDetail);
router.get("/stop-loss/locations", getStopLossLocations);
// Final Loading — model breakdown
router.get("/final-loading-model",           getFinalLoadingModelBreakdown);
router.get("/final-loading-hp-frz-model",    getFinalLoadingHPFrzModelBreakdown);
router.get("/final-loading-hp-choc-model",   getFinalLoadingHPChocModelBreakdown);
router.get("/final-loading-hp-visi-model",   getFinalLoadingHPVISIModelBreakdown);
router.get("/final-loading-hp-sus-model",    getFinalLoadingHPSUSModelBreakdown);
 
// Final Line — model breakdown
router.get("/final-hp-frz-model",            getFinalHPFrzModelBreakdown);
router.get("/final-hp-choc-model",           getFinalHPChocModelBreakdown);
router.get("/visi-final-hp-model",           getFinalHPVISIModelBreakdown);
router.get("/final-hp-sus-model",            getFinalHPSUSModelBreakdown);
 
// Post Foaming — model breakdown
router.get("/post-hp-frz-model",             getPostHPFrzModelBreakdown);
router.get("/manual-post-hp-model",          getManualPostHPModelBreakdown);
router.get("/visi-post-hp-model",            getPostHPVISIModelBreakdown);
router.get("/post-hp-sus-model",             getPostHPSUSModelBreakdown);
 
// Foaming — model breakdown
router.get("/Foaming-hp-fom-a-model",        getFoamingHpFomAModelBreakdown);
router.get("/Foaming-hp-fom-b-model",        getFoamingHpFomBModelBreakdown);

export default router;
