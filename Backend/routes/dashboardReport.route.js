// routes/dashboard.routes.js
import express from "express";
import {
  getAllDashboardConfigs,
  getDashboardConfigById,
  createDashboardConfig,
  updateDashboardConfig,
  deleteDashboardConfig,
  getFGPackingData,
  getFGLoadingData,
  getHourlyProductionData,
  getQualityData,
  getLossData,
} from "../controllers/dashboard/finalAreaProduction.controller.js";

const router = express.Router();

// ── Config CRUD ──
router.get("/configs",     getAllDashboardConfigs);
router.get("/configs/:id", getDashboardConfigById);
router.post("/configs",    createDashboardConfig);
router.put("/configs/:id", updateDashboardConfig);
router.delete("/configs/:id", deleteDashboardConfig);

// ── Dashboard data ──
router.get("/fg-packing", getFGPackingData);
router.get("/fg-loading", getFGLoadingData);
router.get("/hourly",     getHourlyProductionData);
router.get("/quality",    getQualityData);
router.get("/loss",       getLossData);

export default router;