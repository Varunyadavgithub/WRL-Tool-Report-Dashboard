import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { getShiftReportInsight } from "../controllers/insights/shiftReportInsight.controller.js";

const router = Router();

router.get("/shift-report", authenticate, getShiftReportInsight);

export default router;
