import express from "express";
import {
  addProductionPlaningData,
  getPlanMonth,
  productionPlaningData,
  updateProductionPlaningData,
} from "../../controllers/planing/productionPlaning.js";
import { getModelName } from "../../controllers/production/modelNameUpdate.js";
import {
  handleMulterError,
  uploadFiveDaysPlanExcel,
} from "../../middlewares/uploadMiddleware.js";
import {
  deletePlanningExcelFile,
  downloadPlanningExcelFile,
  getPlanningExcelFiles,
  uploadPlanningExcelFile,
} from "../../controllers/planing/fiveDaysPlaning.js";
import {
  addDailyPlans,
  fetchDailyPlans,
} from "../../controllers/planing/dailyPlan.js";

const router = express.Router();

// -----------------> Production Planing Routes
router.get("/plan-month-year", getPlanMonth);
router.get("/model-name", getModelName);
router.get("/production-planing", productionPlaningData);
router.put("/update-production-plan", updateProductionPlaningData);
router.post("/add-production-plan", addProductionPlaningData);

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
