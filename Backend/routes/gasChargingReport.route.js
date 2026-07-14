import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getGasChargingReport,
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
router.get("/report", authenticate, getGasChargingReport);

// GET /api/v1/gas-charging/export - Export data
router.get("/export", authenticate, exportGasChargingReport);

// ===================== FILTER OPTIONS =====================

// GET /api/v1/gas-charging/models - Get distinct models
router.get("/models", authenticate, getDistinctModels);

// GET /api/v1/gas-charging/machines - Get distinct machines
router.get("/machines", authenticate, getDistinctMachines);

// GET /api/v1/gas-charging/refrigerants - Get distinct refrigerants
router.get("/refrigerants", authenticate, getDistinctRefrigerants);

// ===================== QUICK FILTERS =====================

// GET /api/v1/gas-charging/quick/:filter - Quick filter (today, yesterday, mtd, lastWeek)
router.get("/quick/:filter", authenticate, getGasChargingQuickFilter);

// ===================== STATISTICS =====================

// GET /api/v1/gas-charging/model-stats - Model-wise statistics
router.get("/model-stats", authenticate, getModelWiseStats);

// GET /api/v1/gas-charging/machine-stats - Machine-wise statistics
router.get("/machine-stats", authenticate, getMachineWiseStats);

// GET /api/v1/gas-charging/refrigerant-stats - Refrigerant-wise statistics
router.get("/refrigerant-stats", authenticate, getRefrigerantWiseStats);

// GET /api/v1/gas-charging/weight-analysis - Gas weight analysis
router.get("/weight-analysis", authenticate, getGasWeightAnalysis);

// ===================== TRENDS =====================

// GET /api/v1/gas-charging/daily-trend - Daily trend data
router.get("/daily-trend", authenticate, getDailyTrend);

// GET /api/v1/gas-charging/hourly-trend - Hourly trend data
router.get("/hourly-trend", authenticate, getHourlyTrend);

// ===================== FAILURES =====================

// GET /api/v1/gas-charging/failures - Get failed records
router.get("/failures", authenticate, getFailedRecords);

// ===================== SINGLE RECORD =====================

// GET /api/v1/gas-charging/detail/:id - Get single record by ID
router.get("/detail/:id", authenticate, getGasChargingById);

export default router;
