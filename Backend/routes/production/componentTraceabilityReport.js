import express from "express";
import {
  fetchExportData,
  generateReport,
  fetchQuickFiltersData,
} from "../../controllers/production/componentTraceabilityReport.js";

const router = express.Router();

router.get("/component-traceability", generateReport);
router.get("/export-component-traceability", fetchExportData);
router.get("/yday-component-traceability", fetchQuickFiltersData);
router.get("/today-component-traceability", fetchQuickFiltersData);

export default router;
