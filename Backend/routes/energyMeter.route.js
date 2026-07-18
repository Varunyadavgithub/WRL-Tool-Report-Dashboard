import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getPdps, createPdp, updatePdp, deletePdp,
  getMeters, createMeter, updateMeter, deleteMeter,
} from "../controllers/reading/energyMeterConfig.controller.js";
import {
  getLiveMeters, getMeterTrend, getConsumptionReport,
  getPeakDemandReport, getPdpSummaryReport, getAlertSummaryReport,
  getAlerts, acknowledgeAlert, resolveAlert,
} from "../controllers/reading/energyMeter.controller.js";

const router = express.Router();

// PDP masters
router.get("/pdps",        authenticate, getPdps);
router.post("/pdps",       authenticate, createPdp);
router.put("/pdps/:id",    authenticate, updatePdp);
router.delete("/pdps/:id", authenticate, deletePdp);

// Meter masters
router.get("/meters",        authenticate, getMeters);
router.post("/meters",       authenticate, createMeter);
router.put("/meters/:id",    authenticate, updateMeter);
router.delete("/meters/:id", authenticate, deleteMeter);

// Live / trend / consumption
router.get("/live",        authenticate, getLiveMeters);
router.get("/trend",       authenticate, getMeterTrend);
router.get("/consumption", authenticate, getConsumptionReport);

// Reports
router.get("/reports/peak-demand",   authenticate, getPeakDemandReport);
router.get("/reports/pdp-summary",   authenticate, getPdpSummaryReport);
router.get("/reports/alert-summary", authenticate, getAlertSummaryReport);

// Alerts
router.get("/alerts",                     authenticate, getAlerts);
router.post("/alerts/:id/acknowledge",    authenticate, acknowledgeAlert);
router.post("/alerts/:id/resolve",        authenticate, resolveAlert);

export default router;
