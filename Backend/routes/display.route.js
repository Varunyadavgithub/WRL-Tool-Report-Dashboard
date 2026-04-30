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
  exportDashboardConfigs,
  importDashboardConfigs,
} from "../controllers/display/monitoring.controller.js";

import multer from "multer";



const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 },
});

const router = express.Router();

router.get("/configs/export", exportDashboardConfigs);
router.post("/configs/import", upload.single("file"), importDashboardConfigs);

// ── Config CRUD ──
router.get("/configs", getAllDashboardConfigs);
router.get("/configs/:id", getDashboardConfigById);
router.post("/configs", createDashboardConfig);
router.put("/configs/:id", updateDashboardConfig);
router.delete("/configs/:id", deleteDashboardConfig);

// ── Dashboard data ──
router.get("/production-display-1", getFGPackingData);
router.get("/production-display-2", getFGLoadingData);
router.get("/hourly", getHourlyProductionData);
router.get("/quality", getQualityData);
router.get("/loss", getLossData);



export default router;
