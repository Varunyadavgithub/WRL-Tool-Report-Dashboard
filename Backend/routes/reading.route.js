import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getDehumidifierStatus,
  getDehumidifierTrend,
  getDehumidifierSummary,
} from "../controllers/reading/dehumidifier.controller.js";

const router = express.Router();

// ==================== Routes ====================

// live table
router.get("/", authenticate, getDehumidifierStatus);

// graph data  ← ADD THIS
router.get("/machine-reading", authenticate, getDehumidifierTrend);

router.get("/machine-summary", authenticate, getDehumidifierSummary);

export default router;
