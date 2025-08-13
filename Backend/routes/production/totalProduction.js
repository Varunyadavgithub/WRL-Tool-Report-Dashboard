import express from "express";
import {
  fetchExportData,
  getBarcodeDetails,
  getQuickFiltersBarcodeDetails,
} from "../../controllers/production/totalProduction.js";

const router = express.Router();

router.get("/barcode-details", getBarcodeDetails);
router.get("/export-total-production", fetchExportData);
router.get("/yday-total-production", getQuickFiltersBarcodeDetails);
router.get("/today-total-production", getQuickFiltersBarcodeDetails);
router.get("/month-total-production", getQuickFiltersBarcodeDetails);

export default router;