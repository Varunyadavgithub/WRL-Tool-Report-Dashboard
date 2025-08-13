import express from "express";
import {
  fetchExportData,
  generateReport,
} from "../../controllers/production/componentTraceabilityReport.js";

const router = express.Router();

router.get("/component-traceability", generateReport);
router.get("/export-component-traceability", fetchExportData);

export default router;