import express from "express";
import {
  fetchExportData,
  getNfcReoprts,
  getQuickFiltersNfcReports,
} from "../../controllers/production/nfcReport.js";

const router = express.Router();

router.get("/nfc-details", getNfcReoprts);
router.get("/export-nfc-report", fetchExportData);
router.get("/yday-nfc-report", getQuickFiltersNfcReports);
router.get("/today-nfc-report", getQuickFiltersNfcReports);
router.get("/month-nfc-report", getQuickFiltersNfcReports);

export default router;
