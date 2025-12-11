import express from "express";
import { fetchExportData, getNfcReoprts } from "../../controllers/production/nfcReport.js";

const router = express.Router();

router.get("/nfc-details", getNfcReoprts);
router.get("/export-NFC-production", fetchExportData);

export default router;
