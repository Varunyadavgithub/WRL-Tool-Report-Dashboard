import express from "express";
import {
  getDispatchCategoryModelCount,
  getDispatchCategorySummary,
  getDispatchModelCount,
  getDispatchModelSummary,
  getDispatchVehicleSummary,
  getDispatchVehicleUPH,
} from "../controllers/dispatch/performanceReport.js";
import {
  getFgDispatch,
  getFgUnloading,
  getQuickFgDispatch,
  getQuickFgUnloading,
} from "../controllers/dispatch/dispatchReport.js";
import { getDispatchMasterBySession } from "../controllers/dispatch/fgCasting.js";
import { getDispatchErrorLog } from "../controllers/dispatch/errorLog.js";

const router = express.Router();

// -----------------> Performance Report Routes
router.get("/vehicle-uph", getDispatchVehicleUPH);
router.get("/vehicle-summary", getDispatchVehicleSummary);
router.get("/model-count", getDispatchModelCount);
router.get("/model-summary", getDispatchModelSummary);
router.get("/category-model-count", getDispatchCategoryModelCount);
router.get("/category-summary", getDispatchCategorySummary);

// -----------------> Dispatch Report Routes
router.get("/fg-unloading", getFgUnloading);
router.get("/fg-dispatch", getFgDispatch);
router.get("/quick-fg-unloading", getQuickFgUnloading);
router.get("/quick-fg-dispatch", getQuickFgDispatch);

// -----------------> FG Casting Routes
router.get("/fg-casting", getDispatchMasterBySession);

// -----------------> Error Log Routes
router.get("/error-log", getDispatchErrorLog);

export default router;