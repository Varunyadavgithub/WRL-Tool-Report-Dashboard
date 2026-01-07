import express from "express";
import {
  addProductionPlaningData,
  getModelName,
  getPlanMonth,
  productionPlaningData,
  updateProductionPlaningData,
} from "../controllers/planing/productionPlaning.controller.js";
import {
  uploadPlaningExcelFile,
  getPlaningExcelFiles,
  downloadPlaningExcelFile,
  deletePlaningExcelFile,
} from "../controllers/planing/fiveDaysPlaning.controller.js";
import {
  handleMulterError,
  uploadFiveDaysPlanExcel,
} from "../middlewares/uploadMiddleware.js";
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

// -----------------> 5 Days Planing Routes
router.post(
  "/upload-excel",
  uploadFiveDaysPlanExcel.single("file"),
  handleMulterError,
  uploadPlaningExcelFile
);
router.get("/files", getPlaningExcelFiles);
router.get("/download/:filename", downloadPlaningExcelFile);
router.delete("/delete/:filename", deletePlaningExcelFile);

// -----------------> Daily Plan Routes
router.post("/upload-daily-plan", addDailyPlans);
router.get("/daily-plans", fetchDailyPlans);

export default router;
