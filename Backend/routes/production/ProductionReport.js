import express from "express";
import {
  fetchExportData,
  fetchFGData,
  fetchQuickFiltersData,
} from "../../controllers/production/ProductionReport.js";

const router = express.Router();

router.get("/fgdata", fetchFGData);
router.get("/export-production-report", fetchExportData);
router.get("/yday-fgdata", fetchQuickFiltersData);
router.get("/today-fgdata", fetchQuickFiltersData);
router.get("/month-fgdata", fetchQuickFiltersData);

export default router;