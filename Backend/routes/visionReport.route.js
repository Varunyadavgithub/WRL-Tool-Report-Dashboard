import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getHealth,
  getReportByFg,
  getReportPdfByFg,
  getAllReportsByFg,
  exportReports,
  exportReportsZip,
  proxyAsset,
} from "../controllers/visionReport.controller.js";

const router = Router();

router.get("/health", authenticate, getHealth);
router.get("/asset", authenticate, proxyAsset);
router.get("/report/:fgSerial/all", authenticate, getAllReportsByFg);
router.get("/report/:fgSerial/pdf", authenticate, getReportPdfByFg);
router.get("/report/:fgSerial", authenticate, getReportByFg);
router.post("/export/zip", authenticate, exportReportsZip);
router.post("/export", authenticate, exportReports);

export default router;
