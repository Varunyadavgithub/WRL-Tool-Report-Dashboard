import express from "express";
import {
  getGasChargingReport,
  getGasChargingSummary,
  getGasChargingFaults,
  getDistinctModels,
  getDistinctMachines,
  getDistinctRefrigerants,
  getGasChargingQuickFilter,
  getGasChargingById,
  exportGasChargingReport,
  getModelWiseStats,
  getMachineWiseStats,
  getDailyTrend,
  getHourlyTrend,
  getFailedRecords,
  getRefrigerantWiseStats,
  getGasWeightAnalysis,
} from "../controllers/quality/gasCharging.controller.js";

const router = express.Router();

// ===================== MAIN ROUTES =====================

// GET /api/v1/gas-charging/report - Get paginated report data
router.get("/report", getGasChargingReport);

// GET /api/v1/gas-charging/summary - Get summary statistics
router.get("/summary", getGasChargingSummary);

// GET /api/v1/gas-charging/faults - Get fault analysis
router.get("/faults", getGasChargingFaults);

// GET /api/v1/gas-charging/export - Export data
router.get("/export", exportGasChargingReport);

// ===================== FILTER OPTIONS =====================

// GET /api/v1/gas-charging/models - Get distinct models
router.get("/models", getDistinctModels);

// GET /api/v1/gas-charging/machines - Get distinct machines
router.get("/machines", getDistinctMachines);

// GET /api/v1/gas-charging/refrigerants - Get distinct refrigerants
router.get("/refrigerants", getDistinctRefrigerants);

// ===================== QUICK FILTERS =====================

// GET /api/v1/gas-charging/quick/:filter - Quick filter (today, yesterday, mtd, lastWeek)
router.get("/quick/:filter", getGasChargingQuickFilter);

// ===================== STATISTICS =====================

// GET /api/v1/gas-charging/model-stats - Model-wise statistics
router.get("/model-stats", getModelWiseStats);

// GET /api/v1/gas-charging/machine-stats - Machine-wise statistics
router.get("/machine-stats", getMachineWiseStats);

// GET /api/v1/gas-charging/refrigerant-stats - Refrigerant-wise statistics
router.get("/refrigerant-stats", getRefrigerantWiseStats);

// GET /api/v1/gas-charging/weight-analysis - Gas weight analysis
router.get("/weight-analysis", getGasWeightAnalysis);

// ===================== TRENDS =====================

// GET /api/v1/gas-charging/daily-trend - Daily trend data
router.get("/daily-trend", getDailyTrend);

// GET /api/v1/gas-charging/hourly-trend - Hourly trend data
router.get("/hourly-trend", getHourlyTrend);

// ===================== FAILURES =====================

// GET /api/v1/gas-charging/failures - Get failed records
router.get("/failures", getFailedRecords);

// ===================== SINGLE RECORD =====================

// GET /api/v1/gas-charging/detail/:id - Get single record by ID
router.get("/detail/:id", getGasChargingById);

export default router;