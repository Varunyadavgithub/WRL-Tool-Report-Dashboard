import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getDispatchCategoryModelCount,
  getDispatchCategorySummary,
  getDispatchModelCount,
  getDispatchModelSummary,
  getDispatchVehicleSummary,
  getDispatchVehicleUPH,
} from "../controllers/dispatch/performanceReport.controller.js";
import {
  getFgDispatch,
  getFgUnloading,
  getQuickFgDispatch,
  getQuickFgUnloading,
} from "../controllers/dispatch/dispatchReport.controller.js";
import { getDispatchMasterBySession } from "../controllers/dispatch/fgCasting.controller.js";
import { sendMaterialGateEntryAlertEmail } from "../controllers/dispatch/gateEntry.controller.js";
import { getDispatchErrorLog } from "../controllers/dispatch/errorLog.controller.js";
import {
  fetchDispatchErrorSerials,
  removeDispatchErrorSerials,
} from "../controllers/dispatch/removeDispatchError.controller.js";
import { getFGDispatchReport } from "../controllers/dispatch/getFGDispatchReport.controller.js";

const router = express.Router();

// -----------------> Performance Report Routes
router.get("/vehicle-uph", authenticate, getDispatchVehicleUPH);
router.get("/vehicle-summary", authenticate, getDispatchVehicleSummary);
router.get("/model-count", authenticate, getDispatchModelCount);
router.get("/model-summary", authenticate, getDispatchModelSummary);
router.get("/category-model-count", authenticate, getDispatchCategoryModelCount);
router.get("/category-summary", authenticate, getDispatchCategorySummary);

// -----------------> Dispatch Report Routes
router.get("/fg-unloading", authenticate, getFgUnloading);
router.get("/fg-dispatch", authenticate, getFgDispatch);
router.get("/quick-fg-unloading", authenticate, getQuickFgUnloading);
router.get("/quick-fg-dispatch", authenticate, getQuickFgDispatch);

// -----------------> FG Casting Routes
router.get("/fg-casting", authenticate, getDispatchMasterBySession);

// -----------------> Gate Entry Routes
router.post("/material-gate-entry", authenticate, sendMaterialGateEntryAlertEmail);

router.get("/fg-dispatch-report", authenticate, getFGDispatchReport);

// -----------------> Error Log Routes
router.get("/error-log", authenticate, getDispatchErrorLog);

// -----------------> Remove Dispatch Error Serials
router.post("/fetch-error-serials", authenticate, fetchDispatchErrorSerials);
router.post("/remove-error-serials", authenticate, removeDispatchErrorSerials);

export default router;
