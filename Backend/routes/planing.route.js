import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  addProductionPlaningData,
  bulkAddProductionPlaningData,
  getModelName,
  getPlanMonth,
  planStatusData,
  productionPlaningData,
  updateProductionPlaningData,
} from "../controllers/planing/productionPlaning.controller.js";
import {
  addDailyPlans,
  fetchDailyPlans,
} from "../controllers/planing/dailyPlan.controller.js";

const router = express.Router();

// -----------------> Production Planing Routes
router.get("/plan-month-year", authenticate, getPlanMonth);
router.get("/production-planing", authenticate, productionPlaningData);
router.put("/update-production-plan", authenticate, updateProductionPlaningData);
router.post("/add-production-plan", authenticate, addProductionPlaningData);
router.post(
  "/bulk-add-production-plan",
  authenticate,
  bulkAddProductionPlaningData
);
router.get("/model-name", authenticate, getModelName);
router.get("/plan-status", authenticate, planStatusData);

// -----------------> Daily Plan Routes
router.post("/upload-daily-plan", authenticate, addDailyPlans);
router.get("/daily-plans", authenticate, fetchDailyPlans);

export default router;
