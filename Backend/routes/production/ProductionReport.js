import express from "express";
import {
  fetchExportData,
  fetchFGData,
  fetchMonthProductionData,
  fetchTodayProductionData,
  fetchYearProductionData,
  fetchYesterdayProductionData,
} from "../../controllers/production/ProductionReport.js";

const router = express.Router();

router.get("/fgdata", fetchFGData);
router.get("/export-production-report", fetchExportData);
router.get("/yday-fgdata", fetchYesterdayProductionData);
router.get("/today-fgdata", fetchTodayProductionData);
router.get("/month-fgdata", fetchMonthProductionData);
router.get("/year-fgdata", fetchYearProductionData);

export default router;
