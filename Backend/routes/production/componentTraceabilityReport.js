import express from "express";
import {
  fetchExportData,
  generateReport,
  fetchQuickFiltersData,
} from "../../controllers/production/componentTraceabilityReport.js";

const route = express.Router();

route.get("/component-traceability", generateReport);
route.get("/export-component-traceability", fetchExportData);
route.get("/yday-component-traceability", fetchQuickFiltersData);
route.get("/today-component-traceability", fetchQuickFiltersData);

export default route;
