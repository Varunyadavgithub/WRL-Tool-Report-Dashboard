import express from "express";
import { authenticate } from "../middlewares/auth.js";
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
router.get("/", authenticate, getEstReport);
router.get("/summary", authenticate, getEstReportSummary);
router.get("/export", authenticate, exportEstReport);

// Quick filter routes
router.get("/quick/:filter", authenticate, getEstReportQuickFilter);

// Dropdown data routes
router.get("/models", authenticate, getDistinctModels);
router.get("/operators", authenticate, getDistinctOperators);

// Statistics routes
router.get("/model-stats", authenticate, getModelWiseStats);
router.get("/operator-stats", authenticate, getOperatorWiseStats);
router.get("/failure-analysis", authenticate, getFailureAnalysis);

// Trend routes
router.get("/hourly-trend", authenticate, getHourlyTrend);
router.get("/daily-trend", authenticate, getDailyTrend);

// Failure routes
router.get("/failures", authenticate, getFailedTests);

// Single record route (keep at end to avoid conflicts)
router.get("/:refNo", authenticate, getEstReportByRefNo);

export default router;
