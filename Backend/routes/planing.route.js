import express from "express";
import {
  addProductionPlaningData,
  getModelName,
  getPlanMonth,
  productionPlaningData,
  updateProductionPlaningData,
} from "../controllers/planing/productionPlaning.controller.js";
import {
  addDailyPlans,
  fetchDailyPlans,
} from "../controllers/planing/dailyPlan.controller.js";

const router = express.Router();

// -----------------> Production Planing Routes
router.get("/plan-month-year", getPlanMonth);
router.get("/production-planing", productionPlaningData);
router.put("/update-production-plan", updateProductionPlaningData);
router.post("/add-production-plan", addProductionPlaningData);
router.get("/model-name", getModelName);

// -----------------> Daily Plan Routes
router.post("/upload-daily-plan", addDailyPlans);
router.get("/daily-plans", fetchDailyPlans);

export default router;
