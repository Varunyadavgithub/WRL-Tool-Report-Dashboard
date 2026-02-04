import express from "express";
import {
  getEstReport,
  getEstReportByRefNo,
  getEstReportSummary,
  getEstReportQuickFilter,
  getDistinctModels,
  getDistinctOperators,
  getModelWiseStats,
  getOperatorWiseStats,
  getHourlyTrend,
  getDailyTrend,
  getFailedTests,
  exportEstReport,
  getFailureAnalysis,
} from "../controllers/quality/estReport.controller.js";

const router = express.Router();

// Main report routes
router.get("/", getEstReport);
router.get("/summary", getEstReportSummary);
router.get("/export", exportEstReport);

// Quick filter routes
router.get("/quick/:filter", getEstReportQuickFilter);

// Dropdown data routes
router.get("/models", getDistinctModels);
router.get("/operators", getDistinctOperators);

// Statistics routes
router.get("/model-stats", getModelWiseStats);
router.get("/operator-stats", getOperatorWiseStats);
router.get("/failure-analysis", getFailureAnalysis);

// Trend routes
router.get("/hourly-trend", getHourlyTrend);
router.get("/daily-trend", getDailyTrend);

// Failure routes
router.get("/failures", getFailedTests);

// Single record route (keep at end to avoid conflicts)
router.get("/:refNo", getEstReportByRefNo);

export default router;
