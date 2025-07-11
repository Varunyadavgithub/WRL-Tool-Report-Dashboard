import express from "express";
import {
  addProductionPlaningData,
  getModelName,
  getPlanMonth,
  productionPlaningData,
  updateProductionPlaningData,
} from "../controllers/planing/productionPlaning.js";
import {
  uploadPlanningExcelFile,
  getPlanningExcelFiles,
  downloadPlanningExcelFile,
  deletePlanningExcelFile,
} from "../controllers/planing/fiveDaysPlaning.js";
import {
  handleMulterError,
  uploadFiveDaysPlanExcel,
} from "../middlewares/uploadMiddleware.js";
import {
  addDailyPlans,
  fetchDailyPlans,
} from "../controllers/planing/dailyPlan.js";

const router = express.Router();

// -----------------> Production Planing Routes
router.get("/plan-month-year", getPlanMonth);
router.get("/production-planing", productionPlaningData);
router.put("/update-production-plan", updateProductionPlaningData);
router.post("/add-production-plan", addProductionPlaningData);
router.get("/model-name", getModelName);

// -----------------> 5 Days Planing Routes
router.post(
  "/upload-excel",
  uploadFiveDaysPlanExcel.single("file"),
  handleMulterError,
  uploadPlanningExcelFile
);
router.get("/files", getPlanningExcelFiles);
router.get("/download/:filename", downloadPlanningExcelFile);
router.delete("/delete/:filename", deletePlanningExcelFile);

// -----------------> Daily Plan Routes
router.post("/upload-daily-plan", addDailyPlans);
router.get("/daily-plans", fetchDailyPlans);

export default router;
